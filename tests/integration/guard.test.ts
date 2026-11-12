import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Entry } from "../../src/core/policy.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_OK } from "../../src/core/signal.js";

// Runs the built guard as Claude Code does: the tool call as JSON on standard input, and the
// exit code and standard error as the answer. `npm test` builds first.
const GUARD = fileURLToPath(new URL("../../dist/guard/main.js", import.meta.url));

let dir: string;
let policyFile: string;
let claudeDir: string;

function writePolicy(entries: Entry[]): void {
  writeFileSync(policyFile, JSON.stringify({ version: 1, entries }));
}

function runGuard(input: string, extraEnv: Record<string, string> = {}) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    OFFLIMITS_POLICY: policyFile,
    CLAUDE_CONFIG_DIR: claudeDir,
    OFFLIMITS_DEBUG: "",
    ...extraEnv,
  };
  delete env.CLAUDE_PROJECT_DIR;
  const result = spawnSync(process.execPath, [GUARD], { input, encoding: "utf8", env });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const call = (toolName: string, toolInput: unknown, cwd = dir): string =>
  JSON.stringify({
    session_id: "test",
    cwd,
    hook_event_name: "PreToolUse",
    tool_name: toolName,
    tool_input: toolInput,
  });

const bash = (command: string): string => call("Bash", { command });

/** What every refusal must look like: exit 2, nothing on standard output, only the signal. */
function expectRefused(result: ReturnType<typeof runGuard>): void {
  expect(result.code).toBe(EXIT_BLOCKED);
  expect(result.stdout).toBe("");
  expect(result.stderr.trim()).toBe(BLOCKED_MESSAGE);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "offlimits-guard-"));
  policyFile = join(dir, "policy.json");
  claudeDir = join(dir, "claude-config");
  mkdirSync(claudeDir);
  writePolicy([{ kind: "name", mode: "hide", value: "project-nightingale" }]);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("guard: deciding (US-006, US-007)", () => {
  it("lets a call that touches nothing run, with no output", () => {
    const result = runGuard(bash("ls src && npm test"));
    expect(result).toEqual({ code: EXIT_OK, stdout: "", stderr: "" });
  });

  it("refuses a call that mentions an entry, with only the standard signal", () => {
    expectRefused(runGuard(bash("cat docs/Project_Nightingale/notes.md")));
  });

  it("looks inside the content of a file being written", () => {
    expectRefused(
      runGuard(call("Write", { file_path: join(dir, "a.md"), content: "see project-nightingale" })),
    );
  });

  it("covers a tool it has never heard of, including its name", () => {
    writePolicy([{ kind: "name", mode: "forbid", value: "client-alpha" }]);
    expectRefused(runGuard(call("mcp__client_alpha__search", { query: "anything" })));
    expect(runGuard(call("mcp__other__search", { query: "anything" })).code).toBe(EXIT_OK);
  });

  it("applies path entries relative to the folder the assistant is working in", () => {
    writePolicy([{ kind: "path", mode: "forbid", value: join(dir, "private") }]);
    expectRefused(runGuard(call("Read", { file_path: join(dir, "private", "notes.md") })));
    expectRefused(runGuard(call("Read", { file_path: "private/notes.md" }, dir)));
    expect(runGuard(call("Read", { file_path: join(dir, "public", "a.md") })).code).toBe(EXIT_OK);
  });

  it("applies only the entries meant for this assistant", () => {
    writePolicy([
      { kind: "name", mode: "hide", value: "project-nightingale", assistants: ["other"] },
    ]);
    expect(runGuard(bash("cat project-nightingale")).code).toBe(EXIT_OK);
  });

  it("applies entries that name this assistant", () => {
    writePolicy([
      { kind: "name", mode: "hide", value: "project-nightingale", assistants: ["claude-code"] },
    ]);
    expectRefused(runGuard(bash("cat project-nightingale")));
  });

  it("never names the entry in what it prints, even when debugging", () => {
    const result = runGuard(bash("cat project-nightingale"), { OFFLIMITS_DEBUG: "1" });
    expect(result.code).toBe(EXIT_BLOCKED);
    expect(result.stderr).toContain("[offlimits:debug]");
    expect(result.stderr.toLowerCase()).not.toContain("nightingale");
  });
});

describe("guard: protecting itself (US-008)", () => {
  beforeEach(() => {
    writePolicy([]); // An empty policy: only the automatic protections remain.
  });

  it.each([
    ["reading the policy file", () => call("Read", { file_path: policyFile })],
    ["searching inside it", () => call("Grep", { pattern: "value", path: policyFile })],
    [
      "editing the user settings",
      () =>
        call("Edit", {
          file_path: join(claudeDir, "settings.json"),
          old_string: "a",
          new_string: "b",
        }),
    ],
    [
      "writing a project's local settings",
      () =>
        call("Write", { file_path: join(dir, ".claude", "settings.local.json"), content: "{}" }),
    ],
    ["reading the guard's own program", () => call("Read", { file_path: GUARD })],
    ["listing the entries", () => bash("offlimits list")],
    ["adding an entry", () => bash("offlimits add something")],
    ["removing the guard", () => bash("npx offlimits uninstall")],
  ])("refuses %s", (_name, make) => {
    expectRefused(runGuard(make()));
  });

  it("still lets ordinary work run", () => {
    expect(runGuard(bash("git status")).code).toBe(EXIT_OK);
    expect(runGuard(call("Read", { file_path: join(dir, "src", "index.ts") })).code).toBe(EXIT_OK);
  });
});

describe("guard: failing closed (US-007, ADR 0007)", () => {
  it.each([
    ["no input at all", ""],
    ["input that is not JSON", "not json"],
    ["a JSON array", "[]"],
    ["a call with no tool name", JSON.stringify({ tool_input: { command: "ls" } })],
  ])("refuses on %s", (_name, input) => {
    expectRefused(runGuard(input));
  });

  it("refuses when there is no policy", () => {
    rmSync(policyFile);
    expectRefused(runGuard(bash("ls")));
  });

  it.each([
    ["not JSON", "{ nope"],
    ["the wrong shape", JSON.stringify({ version: 1, entries: "x" })],
    ["an unknown version", JSON.stringify({ version: 9, entries: [] })],
    [
      "an entry that is not valid",
      JSON.stringify({ version: 1, entries: [{ kind: "env", mode: "hide", value: "a b" }] }),
    ],
  ])("refuses when the policy is %s", (_name, text) => {
    writeFileSync(policyFile, text);
    expectRefused(runGuard(bash("ls")));
  });

  it("explains why only when debugging, and still never names an entry", () => {
    writeFileSync(policyFile, "client-alpha is not json");
    const quiet = runGuard(bash("ls"));
    expect(quiet.stderr).not.toContain("debug");
    const loud = runGuard(bash("ls"), { OFFLIMITS_DEBUG: "1" });
    expect(loud.stderr).toContain("the policy is invalid");
    expect(loud.stderr.toLowerCase()).not.toContain("alpha");
  });

  it("refuses input too large to be a tool call, and does not hang or break the pipe", () => {
    const huge = call("Write", { content: "a".repeat(17 * 1024 * 1024) });
    expectRefused(runGuard(huge));
  });

  it("refuses a regular expression that cannot finish, quickly (US-021)", () => {
    writePolicy([{ kind: "regex", mode: "forbid", value: "(a+)+$" }]);
    const start = performance.now();
    const result = runGuard(bash(`${"a".repeat(40)}b`));
    expectRefused(result);
    expect(performance.now() - start).toBeLessThan(3000);
  });

  it("applies an ordinary regular expression", () => {
    writePolicy([{ kind: "regex", mode: "hide", value: "invoice-\\d{4}" }]);
    expectRefused(runGuard(bash("cat invoice-2041.pdf")));
    expect(runGuard(bash("cat notes.pdf")).code).toBe(EXIT_OK);
  });
});
