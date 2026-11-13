import type { GuardCommand } from "../adapters/claude-code/settings.js";
import type { BlindHasher } from "../core/blind.js";
import type { FileSystemView } from "../core/isolation.js";
import type { MatchContext } from "../core/match.js";
import type { Policy } from "../core/policy.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_ERROR } from "../core/signal.js";
import type { Protection } from "../guard/protections.js";
import type { SettingsStore } from "../platform/claude-settings.js";
import type { ContentScanner } from "../platform/content-scanner.js";
import type { Counts } from "../platform/counts.js";
import type { Files } from "../platform/files.js";
import type { BackendName } from "../platform/isolation.js";
import type { History } from "../platform/git-history.js";
import type { PolicyStore } from "../platform/policy-store.js";
import type { ProjectScanner } from "../platform/scanner.js";
import type { AttemptRunner, Fixture } from "../selftest/types.js";

export interface Io {
  stdout(line: string): void;
  stderr(line: string): void;
  /** True only when a person is typing at a terminal. */
  readonly interactive: boolean;
  /** Asks a question. Given suggestions, Tab completes what has been typed. */
  ask(question: string, suggestions?: readonly string[]): Promise<string>;
}

/** Everything a command needs from the outside world, so tests can supply fakes. */
export interface Deps {
  readonly io: Io;
  readonly version: string;
  readonly store: PolicyStore;
  readonly scanner: ProjectScanner;
  /** For checking text. `regex` entries run with a time limit. */
  readonly match: MatchContext;
  /** For previewing an entry across many file names, where a per-test time limit costs too much. */
  readonly previewMatch: MatchContext;
  /** For scanning many lines of text: each `regex` test is limited, and links are not followed. */
  readonly scanMatch: MatchContext;
  readonly files: Files;
  /** The key for blind entries: where it lives, whether one exists, and how to get its hasher. */
  readonly blind: {
    readonly keyPath: string;
    readonly hasKey: boolean;
    /** The hasher for the existing key, making a new key first only if there is none. */
    ensureKey(): BlindHasher;
  };
  /** Where `offlimits sync` pulls from when no file is given (OFFLIMITS_SYNC_SOURCE). */
  readonly syncSource: string | undefined;
  /** What `offlimits run` needs: how to look at the file system, what can run, and how to run. */
  readonly isolation: {
    readonly fileSystem: FileSystemView;
    availableBackends(): BackendName[];
    run(program: string, args: string[]): number;
  };
  readonly contentScanner: ContentScanner;
  /** The commit messages and paths in a folder's git history, or undefined if it has none. */
  history(folder: string): History | undefined;
  /** Names worth suggesting at the `add` prompt, from a folder. */
  suggest(folder: string): string[];
  /** What the guard protects on its own, for `explain`. */
  readonly protections: readonly Protection[];
  /** The audit counts: how many calls were refused and lines hidden. */
  readCounts(): Counts;
  /** What `offlimits test` needs: a temporary fixture, and a way to run attempts. */
  readonly selfTest: {
    createFixture(): { fixture: Fixture; cleanup(): void };
    readonly runner: AttemptRunner;
  };
  /** Opens Claude Code's settings file: the given path, or the user's own. */
  openSettings(path?: string): SettingsStore;
  /** How Claude Code is told to run the guard. */
  readonly guardCommand: GuardCommand;
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
