import { Script, createContext } from "node:vm";
import type { RegexTester } from "../core/match.js";

/**
 * Runs `regex` entries with a time limit (US-021). A regular expression written without care can
 * take exponential time on some text, and a guard that hangs is worse than one that refuses.
 * Each test runs in a separate V8 context with a timeout that stops it; the limit is a total
 * across every test made with the returned function, so many slow expressions cannot add up.
 * When time runs out it throws, and the matcher treats that as a match, so the call is refused.
 */
export function createBoundedRegexTester(totalMs: number): RegexTester {
  const deadline = performance.now() + totalMs;
  let sandbox: { pattern: string; text: string } | undefined;
  let script: Script | undefined;

  return (pattern, text) => {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining <= 0) throw new Error("The time allowed for regular expressions is used up.");
    // Created on first use, because most policies have no regex entries.
    sandbox ??= createContext({ pattern: "", text: "" }) as { pattern: string; text: string };
    script ??= new Script('new RegExp(pattern, "iu").test(text)');
    sandbox.pattern = pattern;
    sandbox.text = text;
    return script.runInContext(sandbox, { timeout: remaining }) as boolean;
  };
}
