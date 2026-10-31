import { z } from "zod";
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

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const HOST_NAME = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/u;

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

export const EntrySchema = z
  .strictObject({
    kind: z.enum(ENTRY_KINDS),
    mode: z.enum(ENTRY_MODES),
    value: z.string().trim().min(1).max(500),
    assistants: z.array(z.string().trim().min(1).max(64)).min(1).max(20).optional(),
    note: z.string().max(500).optional(),
  })
  .check((ctx) => {
    const problem = valueProblem(ctx.value.kind, ctx.value.value);
    if (problem !== undefined) {
      ctx.issues.push({ code: "custom", message: problem, input: ctx.value, path: ["value"] });
    }
  });

export const PolicySchema = z.strictObject({
  version: z.literal(1),
  entries: z.array(EntrySchema).max(1000),
});

export type Entry = z.infer<typeof EntrySchema>;
export type Policy = z.infer<typeof PolicySchema>;

export const emptyPolicy = (): Policy => ({ version: 1, entries: [] });

/** The reasons an input is not a valid entry, as plain sentences that never echo the value. */
export function parseEntry(
  input: unknown,
): { ok: true; entry: Entry } | { ok: false; problems: string[] } {
  const result = EntrySchema.safeParse(input);
  if (result.success) return { ok: true, entry: result.data };
  return { ok: false, problems: result.error.issues.map((issue) => issue.message) };
}

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
