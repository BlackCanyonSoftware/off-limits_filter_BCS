import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bubblewrapArguments, planIsolation } from "../../src/core/isolation.js";
import type { Policy } from "../../src/core/policy.js";
import { createMatchContext } from "../../src/platform/context.js";
import { availableBackends, realFileSystem } from "../../src/platform/isolation.js";

// These run real bubblewrap, so they run only where a working one exists: Linux with user
// namespaces allowed. Everywhere else they are skipped, and a skip is not a pass.
const hasBubblewrap = availableBackends(process.platform).includes("bubblewrap");

let root: string;
const policy: Policy = {
  version: 1,
  entries: [
    { kind: "name", mode: "hide", value: "client-alpha" },
    { kind: "env", mode: "forbid", value: "ALPHA_TOKEN" },
  ],
};

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "offlimits-iso-")));
  mkdirSync(join(root, "clients", "client-alpha"), { recursive: true });
  mkdirSync(join(root, "clients", "other"), { recursive: true });
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "clients", "client-alpha", "notes.md"), "made-up notes\n");
  writeFileSync(join(root, "clients", "other", "a.md"), "ordinary\n");
  writeFileSync(join(root, "src", "index.ts"), "x\n");
  writeFileSync(join(root, "Client_Alpha-plan.md"), "plan\n");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function inside(command: string) {
  const plan = planIsolation(policy, root, realFileSystem, createMatchContext({ cwd: root }));
  const args = bubblewrapArguments(plan, { cwd: root, command: ["sh", "-c", command] });
  return spawnSync("bwrap", args, {
    encoding: "utf8",
    env: { ...process.env, ALPHA_TOKEN: "made-up-secret" },
  });
}

describe.skipIf(!hasBubblewrap)("isolation with real bubblewrap (US-017)", () => {
  it("control: with the whole system mounted and no hiding, the same read does show the notes", () => {
    // Proves the tests below can fail: if bubblewrap did not start, "cannot read" would pass
    // for the wrong reason.
    const plain = spawnSync(
      "bwrap",
      ["--ro-bind", "/", "/", "--chdir", root, "cat", "clients/client-alpha/notes.md"],
      { encoding: "utf8" },
    );
    expect(plain.stdout).toBe("made-up notes\n");
  });

  it("leaves a hidden name out of listings, rather than showing an empty folder", () => {
    const listing = inside("ls clients; ls").stdout;
    expect(listing).toContain("other");
    expect(listing).toContain("src");
    expect(listing.toLowerCase()).not.toContain("alpha");
  });

  it("cannot read a hidden file however the path is written", () => {
    for (const command of [
      "cat clients/client-alpha/notes.md",
      "cat clients/Client_Alpha/notes.md",
      'cat "$(printf "clients/client-%s/notes.md" alpha)"',
      "cat clients/cl*/notes.md",
      "cat Client_Alpha-plan.md",
    ]) {
      const result = inside(command);
      expect(result.status, command).not.toBe(0);
      expect(result.stdout, command).not.toContain("made-up notes");
    }
  });

  it("still lets ordinary work run, and write, in the rest of the folder", () => {
    expect(inside("cat clients/other/a.md").stdout).toBe("ordinary\n");
    const write = inside("echo hi > src/new.txt && cat src/new.txt");
    expect(write.status).toBe(0);
    expect(write.stdout).toBe("hi\n");
  });

  it("removes a protected variable", () => {
    expect(inside('echo "[${ALPHA_TOKEN}]"').stdout).toBe("[]\n");
  });
});
