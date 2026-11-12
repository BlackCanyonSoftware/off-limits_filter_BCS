import type { Entry } from "../core/policy.js";

/** Something the guard protects on its own, whatever the owner's policy says. */
export interface Protection {
  /** Shown to the owner by `explain`; never shown to an assistant. */
  readonly label: string;
  readonly entry: Entry;
}

export interface ProtectedPaths {
  readonly policyFile: string;
  readonly settingsFiles: readonly string[];
  readonly programDir: string;
}

/** Commands that read or change the owner's list or the guard itself. */
const OWNER_COMMANDS = ["add", "list", "remove", "explain", "install", "uninstall"] as const;

const forbidPath = (value: string): Entry => ({ kind: "path", mode: "forbid", value });

/**
 * What a session must not be able to read, change or run, so it cannot see the list or switch the
 * guard off: the policy file, the settings that register the guard, the guard's own program files,
 * and the commands that manage them (ADR 0007).
 */
export function protections(paths: ProtectedPaths): Protection[] {
  return [
    { label: "the policy file", entry: forbidPath(paths.policyFile) },
    ...[...new Set(paths.settingsFiles)].map((file) => ({
      label: "a Claude Code settings file",
      entry: forbidPath(file),
    })),
    { label: "the guard's program files", entry: forbidPath(paths.programDir) },
    ...OWNER_COMMANDS.map((command) => ({
      label: `the owner-only command "offlimits ${command}"`,
      entry: { kind: "command", mode: "forbid", value: `offlimits ${command}` } satisfies Entry,
    })),
  ];
}
