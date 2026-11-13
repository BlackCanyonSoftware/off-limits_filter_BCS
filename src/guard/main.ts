#!/usr/bin/env node
/**
 * The guard: Claude Code runs this before every tool call, with the call as JSON on standard
 * input. Exit 0 lets the call run. Exit 2 refuses it, and Claude Code shows the assistant what is
 * on standard error. Claude Code lets a call run on any other exit code, so every failure here,
 * of any kind, ends as a refusal (ADR 0007). Keep the imports few: each costs start-up time.
 *
 * The guard is built as CommonJS (`tsconfig.guard.json`), not as an ES module like the rest of the
 * package: Node's ES module loader alone adds more than the whole start-up budget. So this file
 * must not use `import.meta` or top-level `await`. Node's compile cache was tried and made it
 * slower (ADR 0006), so it is not used.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { ASSISTANT_ID, parseHookInput } from "../adapters/claude-code/input.js";
import { type BlindHasher, blindKeyProblem } from "../core/blind.js";
import { decide } from "../core/match.js";
import type { Policy } from "../core/policy.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED } from "../core/signal.js";
import { createMatchContext } from "../platform/context.js";
import { type CountedEvent, recordEvent } from "../platform/counts.js";
import { blindKeyPath, claudeSettingsFiles, countsPath, policyPath } from "../platform/paths.js";
import { createFileStore } from "../platform/policy-store.js";
import { createBoundedRegexTester } from "../platform/regex.js";
import { protections } from "./protections.js";

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
/** Claude Code is told to wait 5 seconds; the guard refuses on its own a little sooner. */
const WATCHDOG_MS = 3000;
/** The most time all `regex` entries together may take on one call. */
const REGEX_BUDGET_MS = 100;

const home = homedir();
const countsFile = countsPath(process.env, process.platform, home);
const debugSetting = process.env.OFFLIMITS_DEBUG ?? "";
const debug = debugSetting !== "" && debugSetting !== "0";

/** Refuses the call. The reason is shown only when debugging, and never names an entry. */
function refuse(reason: string, event: CountedEvent = "failed"): void {
  recordEvent(countsFile, event);
  if (debug) process.stderr.write(`[offlimits:debug] ${reason}\n`);
  process.stderr.write(`${BLOCKED_MESSAGE}\n`, () => {
    process.exit(EXIT_BLOCKED);
  });
}

async function readInput(): Promise<string | undefined> {
  // Reading standard input in one go avoids starting Node's stream machinery, which costs
  // start-up time. If that is not possible here, fall back to reading it as a stream.
  try {
    const all = readFileSync(0);
    return all.length > MAX_INPUT_BYTES ? undefined : all.toString("utf8");
  } catch {
    // Fall through to the stream.
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    // Keep reading past the limit, so the sender is not left writing to a closed pipe.
    if (size <= MAX_INPUT_BYTES) chunks.push(buffer);
  }
  return size > MAX_INPUT_BYTES ? undefined : Buffer.concat(chunks).toString("utf8");
}

/** Why the call should be refused, or undefined when it may run. */
async function reasonToRefuse(): Promise<{ reason: string; event: CountedEvent } | undefined> {
  const failed = (reason: string): { reason: string; event: CountedEvent } => ({
    reason,
    event: "failed",
  });
  const raw = await readInput();
  if (raw === undefined) return failed("the input could not be read or was too large");

  const input = parseHookInput(raw);
  if (!input.ok) return failed("the input was not a tool call it understands");

  const loaded = createFileStore(policyPath(process.env, process.platform, home)).load();
  if (loaded.status !== "ok") return failed(`the policy is ${loaded.status}`);

  // Blind entries are hashes, and checking them needs the key. A missing key is a refusal, never
  // an allow. The key code is loaded only when there are blind entries, to keep start-up short.
  let blindHash: BlindHasher | undefined;
  if (loaded.policy.entries.some((entry) => entry.kind === "blind")) {
    const { hasherFor, loadBlindKey } = await import("../platform/blind-key.js");
    const key = loadBlindKey(blindKeyPath(process.env, process.platform, home), process.env);
    if (key === undefined) return failed("the key for the blind entries is missing");
    blindHash = hasherFor(key);
    const problem = blindKeyProblem(loaded.policy, blindHash);
    if (problem !== undefined) return failed(`the key does not fit this policy (${problem})`);
  }

  const cwd = input.cwd ?? process.cwd();
  const guarded = protections({
    policyFile: policyPath(process.env, process.platform, home),
    settingsFiles: claudeSettingsFiles(
      process.env,
      process.platform,
      home,
      [cwd, process.env.CLAUDE_PROJECT_DIR].filter((folder): folder is string => !!folder),
    ),
    // This file is dist/guard-cjs/guard/main.js; the program files are everything in dist.
    programDir: resolve(__dirname, "..", ".."),
    countsFile,
    keyFile: blindKeyPath(process.env, process.platform, home),
  });
  const policy: Policy = {
    version: 1,
    entries: [...guarded.map((protection) => protection.entry), ...loaded.policy.entries],
  };

  const context = createMatchContext({
    cwd,
    regexTest: createBoundedRegexTester(REGEX_BUDGET_MS),
    ...(blindHash ? { blindHash } : {}),
  });
  return decide(policy, input.text, context, ASSISTANT_ID).blocked
    ? { reason: "it matched", event: "blocked" }
    : undefined;
}

async function main(): Promise<void> {
  const refusal = await reasonToRefuse();
  // Allowed: exit 0 with no output.
  if (refusal !== undefined) refuse(refusal.reason, refusal.event);
}

setTimeout(() => {
  refuse("the guard took too long");
}, WATCHDOG_MS).unref();
process.on("uncaughtException", () => {
  refuse("an unexpected error");
});
main().catch(() => {
  refuse("an unexpected error");
});
