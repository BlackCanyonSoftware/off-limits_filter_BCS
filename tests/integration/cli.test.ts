import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_ERROR, EXIT_OK } from "../../src/core/signal.js";

// Runs the built program (`npm test` builds first) the way an assistant's shell would:
// no terminal, so the owner-only commands must refuse.
const MAIN = fileURLToPath(new URL("../../dist/cli/main.js", import.meta.url));

let dir: string;
let policyFile: string;

function runMain(...args: string[]) {
  const result = spawnSync(process.execPath, [MAIN, ...args], {
    encoding: "utf8",
    env: { ...process.env, OFFLIMITS_POLICY: policyFile },
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const POLICY = JSON.stringify({
  version: 1,
  entries: [{ kind: "name", mode: "hide", value: "project-nightingale" }],
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "offlimits-cli-"));
  policyFile = join(dir, "policy.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("offlimits program", () => {
  it("prints the package version", () => {
    const { code, stdout } = runMain("--version");
    expect(code).toBe(EXIT_OK);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/u);
  });

  it("creates a policy with init (US-001) and does not overwrite it", () => {
    expect(runMain("init").code).toBe(EXIT_OK);
    expect(existsSync(policyFile)).toBe(true);
    const before = readFileSync(policyFile, "utf8");
    expect(runMain("init").code).toBe(EXIT_OK);
    expect(readFileSync(policyFile, "utf8")).toBe(before);
  });

  it("blocks at a boundary with the standard message and exit code (US-007)", () => {
    writeFileSync(policyFile, POLICY);
    const { code, stdout, stderr } = runMain("check", "ls", "project_nightingale");
    expect(code).toBe(EXIT_BLOCKED);
    expect(stdout).toBe("");
    expect(stderr.trim()).toBe(BLOCKED_MESSAGE);
  });

  it("allows text that touches nothing", () => {
    writeFileSync(policyFile, POLICY);
    const { code, stdout } = runMain("check", "ls", "src");
    expect(code).toBe(EXIT_OK);
    expect(stdout.trim()).toBe("allowed");
  });

  it("asks for init when there is no policy", () => {
    expect(runMain("check", "anything").code).toBe(EXIT_ERROR);
  });

  it("fails closed on a policy it cannot use", () => {
    writeFileSync(policyFile, "this is: [not a policy");
    const { code, stderr } = runMain("check", "anything");
    expect(code).toBe(EXIT_BLOCKED);
    expect(stderr.trim()).toBe(BLOCKED_MESSAGE);
  });

  it("refuses to add, list or remove without a terminal, and changes nothing (US-002, US-003)", () => {
    writeFileSync(policyFile, POLICY);
    for (const args of [["add", "client-alpha"], ["list"], ["remove", "1"]]) {
      const { code, stdout, stderr } = runMain(...args);
      expect(code).toBe(EXIT_BLOCKED);
      expect(stdout).toBe("");
      expect(stderr.trim()).toBe(BLOCKED_MESSAGE);
    }
    expect(readFileSync(policyFile, "utf8")).toBe(POLICY);
  });
});
