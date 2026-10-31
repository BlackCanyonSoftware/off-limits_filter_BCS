import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_OK } from "../../src/core/signal.js";

// Runs the built program (`npm test` builds first), as an assistant's hook would.
const MAIN = fileURLToPath(new URL("../../dist/cli/main.js", import.meta.url));

function runMain(...args: string[]) {
  const result = spawnSync(process.execPath, [MAIN, ...args], { encoding: "utf8" });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("offlimits program", () => {
  it("prints the package version", () => {
    const { code, stdout } = runMain("--version");
    expect(code).toBe(EXIT_OK);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/u);
  });

  it("exits with the blocked code and standard message at a boundary", () => {
    const { code, stdout, stderr } = runMain(
      "check",
      "--entry",
      "project-nightingale",
      "ls",
      "project_nightingale",
    );
    expect(code).toBe(EXIT_BLOCKED);
    expect(stdout).toBe("");
    expect(stderr.trim()).toBe(BLOCKED_MESSAGE);
  });
});
