import { compileGlob } from "./glob.js";

/**
 * Path handling that behaves the same on every platform, so the matcher can be tested once.
 * Everything here works on text; the only outside knowledge arrives through `PathContext`.
 */
export interface PathContext {
  readonly cwd: string;
  readonly home: string;
  /** Resolves links. Returns the input unchanged when it cannot be resolved. */
  readonly realpath: (absolutePath: string) => string;
  /** False where `A` and `a` are the same file (Windows, macOS by default). */
  readonly caseSensitive: boolean;
  /** True on Windows, where a name may end in dots or spaces that are not part of it. */
  readonly windows?: boolean;
}

interface RootAndRest {
  readonly root: string;
  readonly rest: string;
}

function splitRoot(raw: string): RootAndRest {
  let path = raw.replaceAll("\\", "/");
  // Windows' extended-length (`\\?\C:\x`) and device (`\\.\C:\x`) prefixes name the same place.
  if (path.startsWith("//?/") || path.startsWith("//./")) {
    path = path.slice(4);
    if (/^UNC\//iu.test(path)) path = `//${path.slice(4)}`;
  }
  const drive = /^[A-Za-z]:(?=\/|$)/u.exec(path);
  if (drive) return { root: `${drive[0].toLowerCase()}/`, rest: path.slice(drive[0].length) };
  if (path.startsWith("//")) return { root: "//", rest: path.slice(2) };
  if (path.startsWith("/")) return { root: "/", rest: path.slice(1) };
  return { root: "", rest: path };
}

/**
 * Drops empty and `.` parts and applies `..`. A `..` above a root is ignored. On Windows a name's
 * trailing dots and spaces are dropped too, because the system ignores them.
 */
function collapse(root: string, rest: string, windows = false): string[] {
  const parts: string[] = [];
  for (const raw of rest.split("/")) {
    if (raw === "" || raw === ".") continue;
    if (raw === "..") {
      if (parts.length > 0 && parts[parts.length - 1] !== "..") parts.pop();
      else if (root === "") parts.push("..");
      continue;
    }
    const part = windows ? raw.replace(/[. ]+$/u, "") : raw;
    if (part !== "") parts.push(part);
  }
  return parts;
}

const isHomeRelative = (path: string): boolean => path === "~" || /^~[\\/]/u.test(path);

/** What an entry's path value means: where it is anchored, and the segments after that. */
export interface PathShape {
  readonly absolute: boolean;
  readonly segments: readonly string[];
}

export function describePath(value: string): PathShape {
  const homeRelative = isHomeRelative(value);
  const { root, rest } = splitRoot(homeRelative ? value.slice(1) : value);
  return { absolute: homeRelative || root !== "", segments: collapse(root, rest) };
}

/** Makes a path absolute (home and working directory applied, `.` and `..` resolved). */
export function resolveAbsolute(raw: string, ctx: PathContext): string {
  const windows = ctx.windows ?? false;
  const expanded = isHomeRelative(raw) ? ctx.home + raw.slice(1) : raw;
  const own = splitRoot(expanded);
  if (own.root !== "") return own.root + collapse(own.root, own.rest, windows).join("/");
  const base = splitRoot(ctx.cwd);
  return base.root + collapse(base.root, `${base.rest}/${own.rest}`, windows).join("/");
}

/** Lower-cases a path where the file system ignores case. */
export function fold(path: string, ctx: PathContext): string {
  return ctx.caseSensitive ? path : path.toLowerCase();
}

/** True when `candidate` is `base` or lies inside it. Both must be resolved and folded. */
export function isInside(candidate: string, base: string): boolean {
  return candidate === base || candidate.startsWith(base.endsWith("/") ? base : `${base}/`);
}

/** True when `needle` appears as a contiguous run of whole segments in `haystack`. */
export function containsRun(haystack: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0) return false;
  for (let start = 0; start + needle.length <= haystack.length; start++) {
    if (needle.every((part, offset) => haystack[start + offset] === part)) return true;
  }
  return false;
}

export const hasWildcard = (text: string): boolean => /[*?[]/u.test(text);

/** A segment from text that may contain `*`, `?` or `[a]`, against a literal segment. */
export function segmentFits(pattern: string, segment: string): boolean {
  return hasWildcard(pattern) ? compileGlob(pattern, true).test(segment) : pattern === segment;
}

/**
 * Like `isInside`, for a candidate that may contain wildcards a shell would expand: true when the
 * pattern could expand to `base` or something inside it. A pattern with fewer segments than `base`
 * could only expand to a folder above it, which does not read what is inside `base`.
 */
export function insideWithWildcards(candidate: string, base: string): boolean {
  if (!hasWildcard(candidate)) return isInside(candidate, base);
  const patterns = candidate.split("/");
  const wanted = base.split("/");
  return (
    patterns.length >= wanted.length &&
    wanted.every((part, i) => segmentFits(patterns[i] ?? "", part))
  );
}

/** Like `containsRun`, for a haystack whose segments may contain wildcards. */
export function containsRunWithWildcards(
  haystack: readonly string[],
  needle: readonly string[],
): boolean {
  if (needle.length === 0) return false;
  for (let start = 0; start + needle.length <= haystack.length; start++) {
    if (needle.every((part, offset) => segmentFits(haystack[start + offset] ?? "", part))) {
      return true;
    }
  }
  return false;
}
