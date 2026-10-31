import { decide } from "../../core/match.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_ERROR, EXIT_OK } from "../../core/signal.js";
import type { Deps } from "../deps.js";

/**
 * Says whether text touches anything on the policy. Runs anywhere, and reveals nothing but the
 * verdict. A policy that exists but cannot be used fails closed: the answer is "blocked".
 */
export function checkCommand(text: string, assistant: string | undefined, deps: Deps): number {
  if (text.length === 0) {
    deps.io.stderr("check needs some text to look at. Try `offlimits --help`.");
    return EXIT_ERROR;
  }

  const loaded = deps.store.load();
  if (loaded.status === "missing") {
    deps.io.stderr("You have no policy yet. Run `offlimits init` first.");
    return EXIT_ERROR;
  }
  if (loaded.status === "invalid") {
    if (deps.debug) for (const problem of loaded.problems) deps.io.stderr(`[debug] ${problem}`);
    deps.io.stderr(BLOCKED_MESSAGE);
    return EXIT_BLOCKED;
  }

  if (decide(loaded.policy, text, deps.match, assistant).blocked) {
    deps.io.stderr(BLOCKED_MESSAGE);
    return EXIT_BLOCKED;
  }
  deps.io.stdout("allowed");
  return EXIT_OK;
}
