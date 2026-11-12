import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import type { MatchContext, RegexTester } from "../core/match.js";

/**
 * The matching context for this machine: where we are, who we are, and how links resolve.
 * `cwd` is the folder the assistant works in, which is not always the folder this process is in.
 */
export function createMatchContext(
  options: { cwd?: string; regexTest?: RegexTester } = {},
): MatchContext {
  return {
    cwd: options.cwd ?? process.cwd(),
    home: homedir(),
    caseSensitive: process.platform !== "win32" && process.platform !== "darwin",
    realpath: (path) => realpathSync(path),
    ...(options.regexTest ? { regexTest: options.regexTest } : {}),
  };
}
