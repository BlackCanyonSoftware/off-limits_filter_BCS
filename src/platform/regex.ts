import { Script, createContext } from "node:vm";
import type { RegexTester } from "../core/match.js";

/** How long a regular expression may run, in total across tests and/or for each test. */
export interface RegexLimits {
  readonly totalMs?: number;
  readonly eachMs?: number;
}

/**
 * Runs `regex` entries with a time limit (US-021). A regular expression written without care can
 * take exponential time on some text, and a guard that hangs is worse than one that refuses.
 * Each test runs in a separate V8 context with a timeout that stops it. `totalMs` is a limit
 * across every test made with the returned function, so many slow expressions cannot add up (the
 * guard); `eachMs` is a limit on each test alone, for a stream of many lines (the filter). When
 * time runs out it throws, and the matcher treats that as a match, so the call is refused.
 */
export function createBoundedRegexTester(limits: RegexLimits | number): RegexTester {
  const { totalMs, eachMs }: RegexLimits =
    typeof limits === "number" ? { totalMs: limits } : limits;
  const deadline = totalMs === undefined ? undefined : performance.now() + totalMs;
  let sandbox: { pattern: string; text: string } | undefined;
  let script: Script | undefined;

  return (pattern, text) => {
    let allowed = eachMs ?? Number.POSITIVE_INFINITY;
    if (deadline !== undefined) {
      allowed = Math.min(allowed, Math.floor(deadline - performance.now()));
      if (allowed <= 0) throw new Error("The time allowed for regular expressions is used up.");
    }
    // Created on first use, because most policies have no regex entries.
    sandbox ??= createContext({ pattern: "", text: "" }) as { pattern: string; text: string };
    script ??= new Script('new RegExp(pattern, "iu").test(text)');
    sandbox.pattern = pattern;
    sandbox.text = text;
    return script.runInContext(sandbox, {
      ...(Number.isFinite(allowed) ? { timeout: allowed } : {}),
    }) as boolean;
  };
}
