#!/usr/bin/env node
/**
 * The output filter: `some-command | offlimits-filter`. Lines that touch anything on the policy are
 * replaced by one marker line per run, and everything else passes through unchanged (US-010).
 * If the policy cannot be read or anything fails, it prints nothing more and exits 2: it never
 * passes raw text through (ADR 0008). Built as CommonJS like the guard, for start-up time, so it
 * must not use `import.meta` or top-level `await`.
 */
import { homedir } from "node:os";
import { lineMatcher } from "../core/filter.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED } from "../core/signal.js";
import { createMatchContext } from "../platform/context.js";
import { recordEvent } from "../platform/counts.js";
import { countsPath, policyPath } from "../platform/paths.js";
import { createFileStore } from "../platform/policy-store.js";
import { createBoundedRegexTester } from "../platform/regex.js";
import { filterStream } from "./run.js";

/** The longest one `regex` entry may take on one line. Each line is its own test. */
const REGEX_EACH_MS = 50;

const home = homedir();
const countsFile = countsPath(process.env, process.platform, home);
const debugSetting = process.env.OFFLIMITS_DEBUG ?? "";
const debug = debugSetting !== "" && debugSetting !== "0";

function fail(reason: string): void {
  recordEvent(countsFile, "failed");
  if (debug) process.stderr.write(`[offlimits:debug] ${reason}\n`);
  process.stderr.write(`${BLOCKED_MESSAGE}\n`, () => {
    process.exit(EXIT_BLOCKED);
  });
}

/** `--assistant <name>`: filter as that assistant, so entries meant for others do not apply. */
function assistantArgument(argv: readonly string[]): string | undefined {
  const at = argv.indexOf("--assistant");
  return at === -1 ? undefined : argv[at + 1];
}

async function main(): Promise<void> {
  const loaded = createFileStore(policyPath(process.env, process.platform, home)).load();
  if (loaded.status !== "ok") {
    fail(`the policy is ${loaded.status}`);
    return;
  }

  // Output lines are names and paths already shown, so links are not followed: that would cost a
  // file-system lookup for every word of a long listing.
  const context = createMatchContext({
    followLinks: false,
    regexTest: createBoundedRegexTester({ eachMs: REGEX_EACH_MS }),
  });
  const isHidden = lineMatcher(loaded.policy, context, assistantArgument(process.argv.slice(2)));

  process.stdin.setEncoding("utf8");
  const result = await filterStream(
    process.stdin,
    (text) =>
      new Promise<void>((resolve, reject) => {
        process.stdout.write(text, (error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
    isHidden,
  );
  if (!result.ok) fail("the filter stopped");
  else if (result.hidden > 0) recordEvent(countsFile, "filtered", result.hidden);
}

process.on("uncaughtException", () => {
  fail("an unexpected error");
});
main().catch(() => {
  fail("an unexpected error");
});
