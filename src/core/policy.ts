import { normalise } from "./normalise.js";
import { describePath } from "./path.js";

export const ENTRY_KINDS = [
  "path",
  "glob",
  "name",
  "command",
  "env",
  "host",
  "conversation",
  "regex",
] as const;
export const ENTRY_MODES = ["hide", "forbid"] as const;

export type EntryKind = (typeof ENTRY_KINDS)[number];
export type EntryMode = (typeof ENTRY_MODES)[number];

export interface Entry {
  kind: EntryKind;
  mode: EntryMode;
  value: string;
  /** The assistants this entry applies to. Absent means all of them. */
  assistants?: string[];
  /** A private note for the owner. */
  note?: string;
}

export interface Policy {
  version: 1;
  entries: Entry[];
}

const MAX_ENTRIES = 1000;
const MAX_VALUE_LENGTH = 500;
const MAX_NOTE_LENGTH = 500;
const MAX_ASSISTANTS = 20;
const MAX_ASSISTANT_LENGTH = 64;

const ENTRY_FIELDS: ReadonlySet<string> = new Set(["kind", "mode", "value", "assistants", "note"]);
const POLICY_FIELDS: ReadonlySet<string> = new Set(["version", "entries"]);

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const HOST_NAME = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (options as readonly string[]).includes(value);

/**
 * Why a value is unusable for its kind, or undefined when it is fine. Messages never repeat
 * the value, so a rejected entry cannot leak into a log or a terminal recording.
 */
function valueProblem(kind: EntryKind, value: string): string | undefined {
  switch (kind) {
    case "env":
      return ENV_NAME.test(value)
        ? undefined
        : "An environment variable name uses letters, digits and underscores, and does not start with a digit.";
    case "host":
      return HOST_NAME.test(value)
        ? undefined
        : "A host name uses letters, digits, dots and hyphens, for example example.com.";
    case "regex":
      try {
        new RegExp(value, "iu");
        return undefined;
      } catch {
        return "That is not a valid regular expression.";
      }
    case "name":
      return normalise(value).length > 0 ? undefined : "A name needs at least one letter or digit.";
    case "path":
      return describePath(value).segments.length > 0
        ? undefined
        : "Choose a more specific path: this one would cover everything under its root.";
    case "glob":
      return value.replace(/[*?/\\~]/gu, "").length > 0
        ? undefined
        : "A glob needs some fixed text in it, otherwise it matches everything.";
    case "command":
    case "conversation":
      return undefined;
  }
}

export type ParseEntryResult = { ok: true; entry: Entry } | { ok: false; problems: string[] };
export type ParsePolicyResult = { ok: true; policy: Policy } | { ok: false; problems: string[] };

/**
 * Checks anything that claims to be an entry. The reasons are plain sentences that never echo
 * the value, and an entry that passes comes back trimmed and with only the known fields.
 */
export function parseEntry(input: unknown): ParseEntryResult {
  if (!isRecord(input)) return { ok: false, problems: ["An entry must be an object."] };

  const problems: string[] = [];
  if (Object.keys(input).some((field) => !ENTRY_FIELDS.has(field))) {
    problems.push("An entry has a field that is not recognised.");
  }

  const { kind, mode, value, assistants, note } = input;
  if (!isOneOf(ENTRY_KINDS, kind)) problems.push(`kind must be one of: ${ENTRY_KINDS.join(", ")}.`);
  if (!isOneOf(ENTRY_MODES, mode)) problems.push(`mode must be one of: ${ENTRY_MODES.join(", ")}.`);

  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length === 0 || trimmed.length > MAX_VALUE_LENGTH) {
    problems.push(`value must be text of 1 to ${String(MAX_VALUE_LENGTH)} characters.`);
  } else if (isOneOf(ENTRY_KINDS, kind)) {
    const problem = valueProblem(kind, trimmed);
    if (problem !== undefined) problems.push(problem);
  }

  let assistantList: string[] | undefined;
  if (assistants !== undefined) {
    const names = Array.isArray(assistants)
      ? (assistants as unknown[]).map((name) => (typeof name === "string" ? name.trim() : ""))
      : [];
    if (
      names.length === 0 ||
      names.length > MAX_ASSISTANTS ||
      names.some((name) => name.length === 0 || name.length > MAX_ASSISTANT_LENGTH)
    ) {
      problems.push("assistants must be a list of up to 20 names.");
    } else {
      assistantList = names;
    }
  }

  if (note !== undefined && (typeof note !== "string" || note.length > MAX_NOTE_LENGTH)) {
    problems.push(`note must be text of at most ${String(MAX_NOTE_LENGTH)} characters.`);
  }

  if (problems.length > 0 || !isOneOf(ENTRY_KINDS, kind) || !isOneOf(ENTRY_MODES, mode)) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    entry: {
      kind,
      mode,
      value: trimmed,
      ...(assistantList !== undefined ? { assistants: assistantList } : {}),
      ...(typeof note === "string" ? { note } : {}),
    },
  };
}

/** Checks parsed data as a whole policy. Problems name the entry's position, never its content. */
export function parsePolicy(data: unknown): ParsePolicyResult {
  if (!isRecord(data)) return { ok: false, problems: ["The policy must be an object."] };

  const problems: string[] = [];
  if (Object.keys(data).some((field) => !POLICY_FIELDS.has(field))) {
    problems.push("The policy has a field that is not recognised.");
  }
  if (data.version !== 1) problems.push("version must be 1.");

  const raw = data.entries;
  const entries: Entry[] = [];
  if (!Array.isArray(raw)) {
    problems.push("entries must be a list.");
  } else if (raw.length > MAX_ENTRIES) {
    problems.push(`entries has more than ${String(MAX_ENTRIES)} items.`);
  } else {
    (raw as unknown[]).forEach((item, index) => {
      const parsed = parseEntry(item);
      if (parsed.ok) entries.push(parsed.entry);
      else problems.push(...parsed.problems.map((p) => `entries.${String(index)}: ${p}`));
    });
  }

  return problems.length > 0
    ? { ok: false, problems }
    : { ok: true, policy: { version: 1, entries } };
}

export const emptyPolicy = (): Policy => ({ version: 1, entries: [] });

/** Two entries are the same when they have the same kind and the same value once normalised. */
function sameEntry(a: Entry, b: Entry): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === "name"
    ? normalise(a.value) === normalise(b.value)
    : a.value.toLowerCase() === b.value.toLowerCase();
}

export function addEntry(
  policy: Policy,
  entry: Entry,
): { ok: true; policy: Policy } | { ok: false; reason: "duplicate" } {
  if (policy.entries.some((existing) => sameEntry(existing, entry))) {
    return { ok: false, reason: "duplicate" };
  }
  return { ok: true, policy: { ...policy, entries: [...policy.entries, entry] } };
}

/** Removes the entry at a zero-based index. Returns the policy unchanged when out of range. */
export function removeEntryAt(policy: Policy, index: number): Policy {
  return { ...policy, entries: policy.entries.filter((_, position) => position !== index) };
}

/** Finds an entry by its value, ignoring case and, for names, the usual separators. */
export function findEntryIndex(policy: Policy, value: string): number {
  const probe = value.trim();
  return policy.entries.findIndex(
    (entry) =>
      entry.value.toLowerCase() === probe.toLowerCase() ||
      (entry.kind === "name" && normalise(entry.value) === normalise(probe)),
  );
}
