import type { MatchContext } from "../core/match.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_ERROR } from "../core/signal.js";
import type { Policy } from "../core/policy.js";
import type { PolicyStore } from "../platform/policy-store.js";
import type { ProjectScanner } from "../platform/scanner.js";

export interface Io {
  stdout(line: string): void;
  stderr(line: string): void;
  /** True only when a person is typing at a terminal. */
  readonly interactive: boolean;
  ask(question: string): Promise<string>;
}

/** Everything a command needs from the outside world, so tests can supply fakes. */
export interface Deps {
  readonly io: Io;
  readonly version: string;
  readonly store: PolicyStore;
  readonly scanner: ProjectScanner;
  readonly match: MatchContext;
  /** Prints why a policy was rejected. Reasons never include text from the file. */
  readonly debug: boolean;
}

/**
 * Commands that change or reveal the list run only for a person at a terminal. Anywhere else
 * (an assistant's shell, a pipe) they refuse with the standard signal and do nothing.
 */
export function requireTerminal(deps: Deps): number | undefined {
  if (deps.io.interactive) return undefined;
  deps.io.stderr(BLOCKED_MESSAGE);
  return EXIT_BLOCKED;
}

/** Loads the policy for an owner command, or explains why that cannot be done. */
export function loadForOwner(deps: Deps): { policy: Policy } | { exit: number } {
  const loaded = deps.store.load();
  if (loaded.status === "ok") return { policy: loaded.policy };
  if (loaded.status === "missing") {
    deps.io.stderr("You have no policy yet. Run `offlimits init` first.");
    return { exit: EXIT_ERROR };
  }
  deps.io.stderr("Your policy file cannot be used. Set OFFLIMITS_DEBUG=1 to see why.");
  if (deps.debug) for (const problem of loaded.problems) deps.io.stderr(`[debug] ${problem}`);
  return { exit: EXIT_ERROR };
}

export async function confirm(deps: Deps, question: string): Promise<boolean> {
  const answer = (await deps.io.ask(`${question} [y/N] `)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}
