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
import { decide } from "../core/match.js";
import type { Policy } from "../core/policy.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED } from "../core/signal.js";
import { createMatchContext } from "../platform/context.js";
import { claudeSettingsFiles, policyPath } from "../platform/paths.js";
import { createFileStore } from "../platform/policy-store.js";
import { createBoundedRegexTester } from "../platform/regex.js";
import { protections } from "./protections.js";

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
/** Claude Code is told to wait 5 seconds; the guard refuses on its own a little sooner. */
const WATCHDOG_MS = 3000;
/** The most time all `regex` entries together may take on one call. */
const REGEX_BUDGET_MS = 100;

const debugSetting = process.env.OFFLIMITS_DEBUG ?? "";
const debug = debugSetting !== "" && debugSetting !== "0";

/** Refuses the call. The reason is shown only when debugging, and never names an entry. */
function refuse(reason: string): void {
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
async function reasonToRefuse(): Promise<string | undefined> {
  const raw = await readInput();
  if (raw === undefined) return "the input could not be read or was too large";

  const input = parseHookInput(raw);
  if (!input.ok) return "the input was not a tool call it understands";

  const home = homedir();
  const loaded = createFileStore(policyPath(process.env, process.platform, home)).load();
  if (loaded.status !== "ok") return `the policy is ${loaded.status}`;

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
  });
  const policy: Policy = {
    version: 1,
    entries: [...guarded.map((protection) => protection.entry), ...loaded.policy.entries],
  };

  const context = createMatchContext({ cwd, regexTest: createBoundedRegexTester(REGEX_BUDGET_MS) });
  return decide(policy, input.text, context, ASSISTANT_ID).blocked ? "it matched" : undefined;
}

async function main(): Promise<void> {
  const reason = await reasonToRefuse();
  // Allowed: exit 0 with no output.
  if (reason !== undefined) refuse(reason);
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
