import type { Env } from "./env.js";
import { compileGlob } from "./glob.js";
import { normalise } from "./normalise.js";
import {
  type PathContext,
  containsRunWithWildcards,
  describePath,
  fold,
  hasWildcard,
  insideWithWildcards,
  resolveAbsolute,
} from "./path.js";
import type { Entry, EntryMode, Policy } from "./policy.js";
import { escapeRegExp } from "./regex.js";
import { pathPieces, splitTokens } from "./tokens.js";
import { textViews } from "./views.js";

/** Runs a regular expression against text. May throw, for example when it runs out of time. */
export type RegexTester = (pattern: string, text: string) => boolean;

export interface MatchContext extends PathContext {
  /**
   * How `regex` entries are run. The default is a plain test with no time limit; the guard and
   * the owner commands supply one that stops a runaway expression (US-021).
   */
  readonly regexTest?: RegexTester;
  /** Variables the matcher may fill in when text refers to them (`$HOME`, `%USERPROFILE%`). */
  readonly env?: Env;
}

const plainRegexTest: RegexTester = (pattern, text) => new RegExp(pattern, "iu").test(text);

/**
 * Every piece of text is compared as written, however much text there is. Following links costs
 * a file-system lookup each, so only this many pieces (and only pieces up to this length) get one.
 */
const MAX_LINK_LOOKUPS = 200;
const MAX_LINK_LOOKUP_LENGTH = 1024;
/** How many `cd` steps in one piece of text are followed. */
const MAX_FOLDERS = 8;
/** A wildcard pattern needs this many fixed characters before it counts as naming something. */
const MIN_PATTERN_LITERALS = 4;

export type Decision = { blocked: false } | { blocked: true; mode: EntryMode };

/** The path spellings found in a piece of text, worked out at most once per decision. */
type Candidates = () => readonly string[];

function lazily<T>(compute: () => T): () => T {
  let cache: { value: T } | undefined;
  return () => (cache ??= { value: compute() }).value;
}

const FOLDER_CHANGERS: ReadonlySet<string> = new Set([
  "cd",
  "chdir",
  "pushd",
  "set-location",
  "sl",
]);

/**
 * The folders a command line moves into with `cd`, in order, so a relative path after
 * `cd /home/me/clients && cat client-alpha/notes` is read from where it would really be.
 */
function foldersEntered(text: string, ctx: MatchContext): string[] {
  const tokens = splitTokens(text);
  const folders: string[] = [];
  let current = ctx.cwd;
  for (let i = 0; i < tokens.length - 1 && folders.length < MAX_FOLDERS; i++) {
    if (!FOLDER_CHANGERS.has((tokens[i] ?? "").toLowerCase())) continue;
    let target = tokens[i + 1] ?? "";
    // PowerShell's `Set-Location -Path <folder>`.
    if (/^-(?:path|literalpath)$/iu.test(target)) target = tokens[i + 2] ?? "";
    if (target === "" || target.startsWith("-")) continue;
    current = resolveAbsolute(target, { ...ctx, cwd: current });
    folders.push(current);
  }
  return folders;
}

/**
 * Every spelling of a path an assistant might use for the same place: as written (with the
 * working directory, any `cd`, and home applied) and, within the lookup budget, with links
 * resolved. Folded for comparison.
 */
function candidatePaths(text: string, ctx: MatchContext): string[] {
  const candidates = new Set<string>();
  const pieces = pathPieces(text);
  let lookups = 0;
  for (const piece of pieces) {
    const absolute = resolveAbsolute(piece, ctx);
    candidates.add(fold(absolute, ctx));
    if (lookups >= MAX_LINK_LOOKUPS || piece.length > MAX_LINK_LOOKUP_LENGTH) continue;
    lookups++;
    try {
      candidates.add(fold(resolveAbsolute(ctx.realpath(absolute), ctx), ctx));
    } catch {
      // A path that cannot be resolved is compared as written.
    }
  }
  for (const folder of foldersEntered(text, ctx)) {
    const from = { ...ctx, cwd: folder };
    for (const piece of pieces) candidates.add(fold(resolveAbsolute(piece, from), ctx));
  }
  return [...candidates];
}

function pathMatches(value: string, candidates: readonly string[], ctx: MatchContext): boolean {
  const shape = describePath(value);
  if (shape.absolute) {
    const base = fold(resolveAbsolute(value, ctx), ctx);
    return candidates.some((candidate) => insideWithWildcards(candidate, base));
  }
  const wanted = shape.segments.map((segment) => fold(segment, ctx));
  return candidates.some((candidate) => containsRunWithWildcards(candidate.split("/"), wanted));
}

function globMatches(value: string, candidates: readonly string[], ctx: MatchContext): boolean {
  const anchored = describePath(value).absolute;
  const pattern = fold(anchored ? resolveAbsolute(value, ctx) : value.replaceAll("\\", "/"), ctx);
  const regex = compileGlob(pattern, anchored);
  return candidates.some((candidate) => {
    // A glob that matches a folder also covers what is inside it.
    const parts = candidate.split("/");
    return parts.some((_, index) => regex.test(parts.slice(0, index + 1).join("/")));
  });
}

/**
 * A name entry against a wildcard a shell would expand: `cat client-al*` could be reading
 * `client-alpha`. Only a pattern with enough fixed characters counts, so `*.md` does not.
 */
function nameWildcardMatches(needle: string, text: string): boolean {
  let checked = 0;
  for (const piece of text.split(/[\s"'`=,;()<>|&/\\]+/u)) {
    if (!hasWildcard(piece)) continue;
    if (++checked > 500) break;
    const pattern = normalise(piece);
    if (pattern.replace(/[*?[\]]/gu, "").length < MIN_PATTERN_LITERALS) continue;
    if (compileGlob(pattern, true).test(needle)) return true;
  }
  return false;
}

const EXECUTABLE_SUFFIX = /\.(?:exe|cmd|bat|com)$/iu;

/** `C:\tools\Curl.EXE` and `/usr/bin/curl` both read as `curl`. */
function commandForm(token: string): string {
  const base = token.replaceAll("\\", "/").split("/").pop() ?? token;
  return base.replace(EXECUTABLE_SUFFIX, "").toLowerCase();
}

function commandMatches(value: string, text: string): boolean {
  const wanted = value.toLowerCase().split(/\s+/u);
  const tokens = splitTokens(text);
  for (let start = 0; start + wanted.length <= tokens.length; start++) {
    const same = wanted.every((word, offset) => {
      const token = tokens[start + offset] ?? "";
      return offset === 0 ? commandForm(token) === commandForm(word) : token.toLowerCase() === word;
    });
    if (same) return true;
  }
  return false;
}

/** Matches `$NAME`, `${NAME}`, `%NAME%`, `process.env.NAME`, or the bare name, as a whole word. */
function envMatches(value: string, text: string): boolean {
  return new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(value)}(?![A-Za-z0-9_])`, "iu").test(text);
}

/** Matches the host itself and anything under it, such as `api.example.com` for `example.com`. */
function hostMatches(value: string, text: string): boolean {
  const host = escapeRegExp(value);
  return new RegExp(`(?<![a-z0-9-])(?:[a-z0-9-]+\\.)*${host}(?![a-z0-9-])`, "iu").test(text);
}

function regexMatches(value: string, text: string, ctx: MatchContext): boolean {
  try {
    return (ctx.regexTest ?? plainRegexTest)(value, text);
  } catch {
    // An expression that cannot be compiled, or does not finish in time, blocks rather than
    // letting text through.
    return true;
  }
}

export function entryMatches(
  entry: Entry,
  text: string,
  ctx: MatchContext,
  candidates: Candidates = lazily(() => candidatePaths(text, ctx)),
): boolean {
  switch (entry.kind) {
    case "name": {
      const needle = normalise(entry.value);
      return (
        needle.length > 0 && (normalise(text).includes(needle) || nameWildcardMatches(needle, text))
      );
    }
    case "path":
      return pathMatches(entry.value, candidates(), ctx);
    case "glob":
      return globMatches(entry.value, candidates(), ctx);
    case "command":
      return commandMatches(entry.value, text);
    case "env":
      return envMatches(entry.value, text);
    case "host":
      return hostMatches(entry.value, text);
    case "conversation":
      return text.toLowerCase().includes(entry.value.toLowerCase());
    case "regex":
      return regexMatches(entry.value, text, ctx);
  }
}

const appliesTo = (entry: Entry, assistant: string | undefined): boolean =>
  assistant === undefined || !entry.assistants || entry.assistants.includes(assistant);

interface Subject {
  readonly text: string;
  readonly candidates: Candidates;
}

/**
 * The text as written, and each other reading of it (quoting removed, codes decoded, variables
 * filled in, encoded tokens decoded, invisible characters dropped), each with its own path
 * spellings. Worked out once per decision, and only when an entry needs it.
 */
function subjectsOf(text: string, ctx: MatchContext): () => readonly Subject[] {
  return lazily(() =>
    [text, ...textViews(text, ctx.env ?? {})].map((view) => ({
      text: view,
      candidates: lazily(() => candidatePaths(view, ctx)),
    })),
  );
}

const touches = (entry: Entry, subjects: readonly Subject[], ctx: MatchContext): boolean =>
  subjects.some((subject) => entryMatches(entry, subject.text, ctx, subject.candidates));

/**
 * The positions of every entry that matches, for the owner to see why something was refused.
 * Never used on the guard's path: a refusal does not say which entry matched.
 */
export function matchingEntries(
  policy: Policy,
  text: string,
  ctx: MatchContext,
  assistant?: string,
): number[] {
  const subjects = subjectsOf(text, ctx);
  const found: number[] = [];
  policy.entries.forEach((entry, index) => {
    if (appliesTo(entry, assistant) && touches(entry, subjects(), ctx)) found.push(index);
  });
  return found;
}

/**
 * Decides whether text touches anything on the policy. Only entries that apply to the given
 * assistant count; with none given, all do. The result never says which entry matched.
 * A match on a `hide` entry wins over a match on a `forbid` one.
 */
export function decide(
  policy: Policy,
  text: string,
  ctx: MatchContext,
  assistant?: string,
): Decision {
  let mode: EntryMode | undefined;
  const subjects = subjectsOf(text, ctx);
  for (const entry of policy.entries) {
    if (!appliesTo(entry, assistant) || !touches(entry, subjects(), ctx)) continue;
    if (entry.mode === "hide") return { blocked: true, mode: "hide" };
    mode = "forbid";
  }
  return mode === undefined ? { blocked: false } : { blocked: true, mode };
}
