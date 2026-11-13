import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT_VARIABLE, testPolicyEntries } from "../selftest/classes.js";
import type { Attempt, AttemptRunner, Fixture, Outcome } from "../selftest/types.js";

/**
 * Makes the temporary folder `offlimits test` works in: made-up folders and files, a link to one
 * of them where the system allows, and a policy that protects them. Nothing of the owner's is read.
 */
export function createFixture(): { fixture: Fixture; cleanup: () => void } {
  // The real path, so a temporary folder that is itself a link (macOS) does not confuse the test.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "offlimits-test-")));
  const protectedDir = join(root, "clients", "client-alpha");
  mkdirSync(protectedDir, { recursive: true });
  mkdirSync(join(root, "clients", "other"));
  writeFileSync(join(protectedDir, "notes.md"), "made-up notes\n");

  let link: string | undefined;
  try {
    const target = join(root, "clients", "shortcut");
    // A junction needs no special rights on Windows; a plain link does.
    symlinkSync(protectedDir, target, process.platform === "win32" ? "junction" : "dir");
    link = target;
  } catch {
    link = undefined;
  }

  const policyFile = join(root, "policy.json");
  const fixture: Fixture = {
    root,
    protectedDir,
    link,
    policyFile,
    settingsFile: join(root, "claude", "settings.json"),
    countsFile: join(root, "counts.log"),
    platform: process.platform,
  };
  writeFileSync(policyFile, JSON.stringify({ version: 1, entries: testPolicyEntries(fixture) }));
  return {
    fixture,
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/** Runs a built program with some input, and collects its exit code and standard output. */
function runProgram(
  script: string,
  input: string,
  fixture: Fixture,
): Promise<{ status: number | null; stdout: string }> {
  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      OFFLIMITS_POLICY: fixture.policyFile,
      OFFLIMITS_DEBUG: "",
      CLAUDE_CONFIG_DIR: join(fixture.root, "claude"),
      [ROOT_VARIABLE]: fixture.root,
    };
    delete env.CLAUDE_PROJECT_DIR;
    const child = spawn(process.execPath, [script], { cwd: fixture.root, env });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stdin.on("error", () => undefined); // The program may stop reading early.
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status, stdout: Buffer.concat(chunks).toString("utf8") });
    });
    child.stdin.end(input);
  });
}

/** Runs attempts against the real built guard and filter, each guard attempt as its own process. */
export function createRunner(scripts: { guard: string; filter: string }): AttemptRunner {
  return {
    async guard(attempt: Attempt, fixture: Fixture): Promise<Outcome> {
      const call = attempt.call
        ? { tool_name: attempt.call.tool, tool_input: attempt.call.input }
        : { tool_name: "Bash", tool_input: { command: attempt.command ?? "" } };
      const result = await runProgram(
        scripts.guard,
        JSON.stringify({ cwd: fixture.root, ...call }),
        fixture,
      );
      if (result.status === 2) return "held";
      if (result.status === 0) return "got-through";
      throw new Error("the guard did not run as expected");
    },

    async filter(attempts: readonly Attempt[], fixture: Fixture): Promise<Outcome[]> {
      const lines = attempts.map((attempt) => attempt.line ?? attempt.command ?? "");
      const result = await runProgram(scripts.filter, `${lines.join("\n")}\n`, fixture);
      if (result.status !== 0) throw new Error("the filter did not run as expected");
      // A line the filter let through appears in what it printed; a hidden one does not.
      const shown = new Set(result.stdout.split("\n"));
      return lines.map((line) => (shown.has(line) ? "got-through" : "held"));
    },
  };
}
