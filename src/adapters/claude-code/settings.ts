/**
 * Adds and removes the guard in a Claude Code settings file. The rest of the file, including any
 * other hooks the owner has, is left exactly as it was.
 */
export type Settings = Record<string, unknown>;

/** Marks the handlers this tool added, so they can be found again to update or remove. */
export const GUARD_MARKER = "Off-Limits";

export interface GuardCommand {
  /** The Node executable, as an absolute path. */
  readonly node: string;
  /** The guard's entry point, as an absolute path. */
  readonly script: string;
}

/** The settings file has a shape this code does not know how to change safely. */
export class UnsupportedSettingsError extends Error {}

/** Seconds Claude Code waits for the guard. The guard gives up sooner, and refuses. */
const GUARD_TIMEOUT_SECONDS = 5;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isGuardHandler = (handler: unknown): boolean =>
  isRecord(handler) && handler.statusMessage === GUARD_MARKER;

function preToolUseGroups(settings: Settings): unknown[] {
  const hooks = settings.hooks;
  if (hooks === undefined) return [];
  if (!isRecord(hooks)) throw new UnsupportedSettingsError("hooks is not an object");
  const groups = hooks.PreToolUse;
  if (groups === undefined) return [];
  if (!Array.isArray(groups)) throw new UnsupportedSettingsError("PreToolUse is not a list");
  return groups as unknown[];
}

function withGroups(settings: Settings, groups: unknown[]): Settings {
  const { hooks: oldHooks, ...rest } = settings;
  const hooks: Record<string, unknown> = isRecord(oldHooks) ? { ...oldHooks } : {};
  if (groups.length > 0) hooks.PreToolUse = groups;
  else delete hooks.PreToolUse;
  return Object.keys(hooks).length > 0 ? { ...rest, hooks } : rest;
}

export function hasGuard(settings: Settings): boolean {
  return preToolUseGroups(settings).some(
    (group) => isRecord(group) && Array.isArray(group.hooks) && group.hooks.some(isGuardHandler),
  );
}

/** Takes out every handler this tool added. Other handlers, and their groups, stay. */
export function withoutGuard(settings: Settings): { settings: Settings; removed: number } {
  let removed = 0;
  const groups: unknown[] = [];
  for (const group of preToolUseGroups(settings)) {
    if (!isRecord(group) || !Array.isArray(group.hooks)) {
      groups.push(group);
      continue;
    }
    const handlers = group.hooks as unknown[];
    const kept = handlers.filter((handler) => !isGuardHandler(handler));
    removed += handlers.length - kept.length;
    if (kept.length > 0 || kept.length === handlers.length) groups.push({ ...group, hooks: kept });
  }
  return { settings: removed > 0 ? withGroups(settings, groups) : settings, removed };
}

/**
 * Registers the guard for every tool call. It runs the Node executable directly (no shell, so
 * paths with spaces are safe), refuses if it cannot run or runs out of time (`onFailure`), and is
 * added alongside whatever hooks are already there.
 */
export function withGuard(settings: Settings, command: GuardCommand): Settings {
  const cleaned = withoutGuard(settings).settings;
  const group = {
    matcher: "*",
    hooks: [
      {
        type: "command",
        command: command.node,
        args: [command.script],
        timeout: GUARD_TIMEOUT_SECONDS,
        onFailure: "block",
        statusMessage: GUARD_MARKER,
      },
    ],
  };
  return withGroups(cleaned, [...preToolUseGroups(cleaned), group]);
}
