import { describe, expect, it } from "vitest";
import {
  bubblewrapArguments,
  containerPath,
  dockerArguments,
  findHidden,
  planIsolation,
} from "../../src/core/isolation.js";
import type { Entry, Policy } from "../../src/core/policy.js";
import { entry, posixContext } from "../helpers/context.js";
import { type Tree, fakeFileSystem } from "../helpers/fake-fs.js";

const policyOf = (...entries: Entry[]): Policy => ({ version: 1, entries });
const ctx = posixContext({ cwd: "/work/project" });

const tree: Tree = {
  work: {
    project: {
      "README.md": "x",
      src: { "index.ts": "x", "util.ts": "x" },
      clients: {
        "client-alpha": { "notes.md": "x" },
        other: { "a.md": "x" },
        shortcut: { linksTo: "/work/project/clients/client-alpha" },
      },
      docs: { "Client_Alpha-plan.md": "x", "readme.md": "x" },
      bin: { linksTo: "/usr/bin" },
    },
  },
  secrets: { "keys.txt": "x" },
};
const fs = fakeFileSystem(tree);
const alpha = policyOf(entry("name", "client-alpha"));

describe("findHidden", () => {
  it("finds a matching folder or file anywhere under the root, spelled however it is written", () => {
    const { inside } = findHidden(alpha, "/work/project", fs, ctx);
    expect(inside.sort()).toEqual([
      "/work/project/clients/client-alpha",
      "/work/project/docs/Client_Alpha-plan.md",
    ]);
  });

  it("does not look inside a folder it hides, and does not follow links", () => {
    const { inside } = findHidden(alpha, "/work/project", fs, ctx);
    expect(inside.some((path) => path.endsWith("notes.md"))).toBe(false);
    expect(inside.some((path) => path.includes("shortcut"))).toBe(false);
  });

  it("finds an absolute path outside the root that exists, and ignores one that does not", () => {
    const found = findHidden(
      policyOf(entry("path", "/secrets"), entry("path", "/nowhere")),
      "/work/project",
      fs,
      ctx,
    );
    expect(found.outside).toEqual(["/secrets"]);
    expect(found.inside).toEqual([]);
  });
});

describe("planIsolation (US-017)", () => {
  const plan = planIsolation(alpha, "/work/project", fs, ctx);

  it("rebuilds the root and every folder on the way to something hidden, in order", () => {
    const kinds = plan.mounts.map((m) => `${m.kind}:${m.path}`);
    expect(kinds[0]).toBe("tmpfs:/work/project");
    expect(kinds).toContain("tmpfs:/work/project/clients");
    expect(kinds).toContain("tmpfs:/work/project/docs");
    // A folder is emptied before anything is mounted inside it.
    expect(kinds.indexOf("tmpfs:/work/project/clients")).toBeLessThan(
      kinds.indexOf("bind:/work/project/clients/other"),
    );
  });

  it("mounts every other folder and file back whole, so the project stays usable", () => {
    const binds = plan.mounts.filter((m) => m.kind === "bind").map((m) => m.path);
    expect(binds).toEqual(
      expect.arrayContaining([
        "/work/project/README.md",
        "/work/project/src",
        "/work/project/clients/other",
        "/work/project/docs/readme.md",
      ]),
    );
  });

  it("recreates other links as links, but leaves out one that points at something hidden", () => {
    expect(plan.mounts).toContainEqual({
      kind: "symlink",
      path: "/work/project/bin",
      target: "/usr/bin",
    });
    // The link to the hidden folder would show its name to a `readlink`, so it is not in the view.
    expect(plan.mounts.some((m) => m.kind === "symlink" && m.path.endsWith("shortcut"))).toBe(
      false,
    );
    expect(JSON.stringify(plan.mounts).toLowerCase()).not.toContain("client-alpha");
  });

  it("leaves nothing hidden in the plan's mounts: no hidden name is mounted anywhere", () => {
    const text = JSON.stringify(plan.mounts).toLowerCase();
    expect(text.replace(/client-alpha/gu, "").includes("client_alpha")).toBe(false);
    expect(
      plan.mounts.some((m) => m.kind === "bind" && m.path.toLowerCase().includes("alpha")),
    ).toBe(false);
    // The folder, the file, and the link that pointed at the folder.
    expect(plan.hiddenInside).toBe(3);
  });

  it("mounts the whole root, writable, when nothing in it is hidden", () => {
    const none = planIsolation(
      policyOf(entry("name", "nothing-like-this")),
      "/work/project",
      fs,
      ctx,
    );
    expect(none.mounts).toEqual([{ kind: "bind", path: "/work/project" }]);
    expect(none.hiddenInside).toBe(0);
  });

  it("masks a path outside the root in place, and says its name stays visible", () => {
    const outside = planIsolation(
      policyOf(entry("path", "/secrets"), entry("path", "/work/project/README.md")),
      "/work/project",
      fs,
      ctx,
    );
    expect(outside.maskedOutside).toEqual(["/secrets"]);
    expect(outside.mounts).toContainEqual({ kind: "tmpfs", path: "/secrets" });
  });

  it("masks an outside file with an empty file", () => {
    const file = planIsolation(
      policyOf(entry("path", "/secrets/keys.txt")),
      "/work/project",
      fs,
      ctx,
    );
    expect(file.mounts).toContainEqual({ kind: "empty-file", path: "/secrets/keys.txt" });
  });

  it("removes variables from env entries, and counts what cannot be hidden this way", () => {
    const mixed = planIsolation(
      policyOf(
        entry("env", "ALPHA_TOKEN"),
        entry("host", "a.example.com"),
        entry("command", "curl"),
        entry("regex", "x+"),
      ),
      "/work/project",
      fs,
      ctx,
    );
    expect(mixed.unsetEnv).toEqual(["ALPHA_TOKEN"]);
    expect(mixed.notExpressible).toBe(3);
  });
});

describe("bubblewrapArguments", () => {
  const plan = planIsolation(alpha, "/work/project", fs, ctx);
  const args = bubblewrapArguments(
    { ...plan, unsetEnv: ["ALPHA_TOKEN"] },
    { cwd: "/work/project/src", command: ["bash", "-c", "ls"] },
  );

  it("starts from a read-only system with a private /dev, /proc and /tmp, and dies with its parent", () => {
    expect(args.slice(0, 11)).toEqual([
      "--die-with-parent",
      "--ro-bind",
      "/",
      "/",
      "--dev",
      "/dev",
      "--proc",
      "/proc",
      "--tmpfs",
      "/tmp",
      "--unsetenv",
    ]);
  });

  it("removes variables, applies the mounts in plan order, then runs the command where asked", () => {
    expect(args).toContain("ALPHA_TOKEN");
    expect(args.indexOf("--tmpfs", 10)).toBeLessThan(args.indexOf("--bind"));
    expect(args.slice(-6)).toEqual(["--chdir", "/work/project/src", "--", "bash", "-c", "ls"]);
  });

  it("never mentions a hidden name in its arguments", () => {
    expect(args.join(" ").toLowerCase()).not.toContain("client-alpha");
    expect(args.join(" ").toLowerCase()).not.toContain("client_alpha");
  });
});

describe("dockerArguments", () => {
  const plan = planIsolation(alpha, "/work/project", fs, ctx);
  const args = dockerArguments(plan, { cwd: "/work/project", command: ["make"], image: "node:22" });

  it("mounts only what is allowed, at the same paths, and runs in the image", () => {
    expect(args.slice(0, 3)).toEqual(["run", "--rm", "-i"]);
    expect(args).toContain("/work/project/src:/work/project/src");
    expect(args.slice(-4)).toEqual(["-w", "/work/project", "node:22", "make"]);
  });

  it("never mentions a hidden name in its arguments", () => {
    expect(args.join(" ").toLowerCase()).not.toContain("client-alpha");
    expect(args.join(" ").toLowerCase()).not.toContain("client_alpha");
  });

  it("translates Windows drive paths for the Linux container", () => {
    expect(containerPath("C:/Users/Kyle/work")).toBe("/c/Users/Kyle/work");
    expect(containerPath("/home/kyle")).toBe("/home/kyle");
    const windows = dockerArguments(
      {
        root: "C:/work",
        mounts: [{ kind: "bind", path: "C:/work/src" }],
        hiddenInside: 1,
        maskedOutside: [],
        unsetEnv: [],
        notExpressible: 0,
        truncated: false,
      },
      { cwd: "C:\\work", command: ["ls"], image: "ubuntu" },
    );
    expect(windows).toContain("C:/work/src:/c/work/src");
    expect(windows).toContain("/c/work");
  });
});
