import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import type { BlindHasher } from "../core/blind.js";
import type { MatchContext, RegexTester } from "../core/match.js";

export interface ContextOptions {
  /** The folder the assistant works in, which is not always the folder this process is in. */
  readonly cwd?: string;
  readonly regexTest?: RegexTester;
  /** Checks `blind` entries; without it they cannot be checked and so count as matches. */
  readonly blindHash?: BlindHasher;
  /** False compares paths as written, without a file-system lookup for each. Default true. */
  readonly followLinks?: boolean;
}

/** The matching context for this machine: where we are, who we are, and how links resolve. */
export function createMatchContext(options: ContextOptions = {}): MatchContext {
  const followLinks = options.followLinks ?? true;
  return {
    cwd: options.cwd ?? process.cwd(),
    home: homedir(),
    caseSensitive: process.platform !== "win32" && process.platform !== "darwin",
    windows: process.platform === "win32",
    env: process.env,
    realpath: followLinks ? (path) => realpathSync(path) : (path) => path,
    ...(options.regexTest ? { regexTest: options.regexTest } : {}),
    ...(options.blindHash ? { blindHash: options.blindHash } : {}),
  };
}
