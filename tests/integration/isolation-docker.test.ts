import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dockerArguments, planIsolation } from "../../src/core/isolation.js";
import type { Policy } from "../../src/core/policy.js";
import { createMatchContext } from "../../src/platform/context.js";
import { availableBackends, realFileSystem } from "../../src/platform/isolation.js";

// These run real Docker, so they run only where Docker reaches a Linux engine. A Windows runner
// can have Docker in Windows-container mode, which cannot run this image, so that is skipped
// too. A skip is not a pass. A small image keeps a pull cheap; set OFFLIMITS_TEST_DOCKER_IMAGE
// to use one you already have (it needs `sh`, `ls`, `cat` and `echo`).
const IMAGE = process.env.OFFLIMITS_TEST_DOCKER_IMAGE ?? "alpine:3.20";

function hasLinuxDocker(): boolean {
  if (!availableBackends(process.platform).includes("docker")) return false;
  const info = spawnSync("docker", ["info", "--format", "{{.OSType}}"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 15_000,
  });
  return info.status === 0 && info.stdout.trim() === "linux";
}

const runnable = hasLinuxDocker();

let root = "";
const policy: Policy = {
  version: 1,
  entries: [
    { kind: "name", mode: "hide", value: "client-alpha" },
    { kind: "env", mode: "forbid", value: "ALPHA_TOKEN" },
  ],
};

beforeAll(() => {
  if (!runnable) return;
  const present = spawnSync("docker", ["image", "inspect", IMAGE], {
    stdio: "ignore",
    windowsHide: true,
  });
  if (present.status !== 0) {
    const pulled = spawnSync("docker", ["pull", "--quiet", IMAGE], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 150_000,
    });
    if (pulled.status !== 0) throw new Error(`could not pull the test image ${IMAGE}`);
  }
  root = realpathSync(mkdtempSync(join(tmpdir(), "offlimits-docker-")));
  mkdirSync(join(root, "clients", "client-alpha"), { recursive: true });
  mkdirSync(join(root, "clients", "other"), { recursive: true });
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "clients", "client-alpha", "notes.md"), "made-up notes\n");
  writeFileSync(join(root, "clients", "other", "a.md"), "ordinary\n");
  writeFileSync(join(root, "src", "index.ts"), "x\n");
  writeFileSync(join(root, "Client_Alpha-plan.md"), "plan\n");
}, 180_000);

afterAll(() => {
  if (root !== "") rmSync(root, { recursive: true, force: true });
});

function inside(command: string) {
  const plan = planIsolation(policy, root, realFileSystem, createMatchContext({ cwd: root }));
  const args = dockerArguments(plan, {
    cwd: root,
    command: ["sh", "-c", command],
    image: IMAGE,
  });
  return spawnSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, ALPHA_TOKEN: "made-up-secret" },
    timeout: 60_000,
  });
}

describe.skipIf(!runnable)("isolation with real Docker (US-017)", () => {
  it("control: with the whole folder mounted, the same read does show the notes", () => {
    // Proves the tests below can fail: if this did not show the notes, "cannot read" would
    // pass for the wrong reason.
    const mounted = spawnSync(
      "docker",
      dockerArguments(
        {
          root,
          mounts: [{ kind: "bind", path: root }],
          hiddenInside: 0,
          maskedOutside: [],
          unsetEnv: [],
          notExpressible: 0,
          truncated: false,
        },
        { cwd: root, command: ["cat", "clients/client-alpha/notes.md"], image: IMAGE },
      ),
      { encoding: "utf8", windowsHide: true, timeout: 60_000 },
    );
    expect(mounted.stdout).toBe("made-up notes\n");
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

  it("does not pass a protected variable on", () => {
    expect(inside('echo "[${ALPHA_TOKEN}]"').stdout).toBe("[]\n");
  });
});
