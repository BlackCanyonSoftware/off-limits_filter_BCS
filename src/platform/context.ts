import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import type { MatchContext } from "../core/match.js";

/** The matching context for this machine: where we are, who we are, and how links resolve. */
export function createMatchContext(): MatchContext {
  return {
    cwd: process.cwd(),
    home: homedir(),
    caseSensitive: process.platform !== "win32" && process.platform !== "darwin",
    realpath: (path) => realpathSync(path),
  };
}
