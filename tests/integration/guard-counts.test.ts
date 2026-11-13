import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_OK } from "../../src/core/signal.js";

const GUARD = fileURLToPath(new URL("../../dist/guard-cjs/guard/main.js", import.meta.url));
const CLI = fileURLToPath(new URL("../../dist/cli/main.js", import.meta.url));

let dir: string;
let policyFile: string;
let countsFile: string;

const env = (): NodeJS.ProcessEnv => {
  const copy: NodeJS.ProcessEnv = {
    ...process.env,
    OFFLIMITS_POLICY: policyFile,
    OFFLIMITS_DEBUG: "",
  };
  delete copy.CLAUDE_PROJECT_DIR;
  return copy;
};

const guard = (input: string) =>
  spawnSync(process.execPath, [GUARD], { input, encoding: "utf8", env: env() });
const bash = (command: string): string =>
  JSON.stringify({ tool_name: "Bash", cwd: dir, tool_input: { command } });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "offlimits-gcount-"));
  policyFile = join(dir, "policy.json");
  countsFile = join(dir, "counts.log");
  writeFileSync(
    policyFile,
    JSON.stringify({
      version: 1,
      entries: [{ kind: "name", mode: "hide", value: "project-nightingale" }],
    }),
  );
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("the guard counts what it refuses (US-011)", () => {
  it("records nothing for a call it allows", () => {
    expect(guard(bash("ls")).status).toBe(EXIT_OK);
    expect(() => readFileSync(countsFile)).toThrow();
  });

  it("records a refusal because of a match, as blocked, with no name in it", () => {
    expect(guard(bash("cat project-nightingale")).status).toBe(EXIT_BLOCKED);
    const log = readFileSync(countsFile, "utf8").trim();
    expect(log).toMatch(/^\d{4}-\d{2}-\d{2} blocked 1$/u);
  });

  it("records a refusal because a check could not be made, as failed", () => {
    rmSync(policyFile);
    expect(guard(bash("ls")).status).toBe(EXIT_BLOCKED);
    expect(readFileSync(countsFile, "utf8")).toMatch(/ failed 1\n$/u);
  });

  it("still refuses with the standard signal when the counts file cannot be written", () => {
    // A folder where the file should be makes every write fail.
    rmSync(countsFile, { force: true });
    writeFileSync(join(dir, "placeholder"), "");
    const result = spawnSync(process.execPath, [GUARD], {
      input: bash("cat project-nightingale"),
      encoding: "utf8",
      env: { ...env(), OFFLIMITS_POLICY: policyFile },
    });
    expect(result.status).toBe(EXIT_BLOCKED);
    expect(result.stderr.trim()).toBe(BLOCKED_MESSAGE);
  });

  it("refuses to let a session read or change the counts file", () => {
    const result = guard(
      JSON.stringify({ tool_name: "Read", cwd: dir, tool_input: { file_path: countsFile } }),
    );
    expect(result.status).toBe(EXIT_BLOCKED);
    expect(result.stderr.trim()).toBe(BLOCKED_MESSAGE);
  });

  it("shows up in `offlimits count`", () => {
    guard(bash("cat project-nightingale"));
    guard(bash("cat project-nightingale"));
    const result = spawnSync(process.execPath, [CLI, "count"], { encoding: "utf8", env: env() });
    expect(result.status).toBe(EXIT_OK);
    expect(result.stdout).toContain("Tool calls refused: 2");
    expect(result.stdout.toLowerCase()).not.toContain("nightingale");
  });
});
