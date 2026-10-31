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
}

interface RootAndRest {
  readonly root: string;
  readonly rest: string;
}

function splitRoot(raw: string): RootAndRest {
  const path = raw.replaceAll("\\", "/");
  const drive = /^[A-Za-z]:(?=\/|$)/u.exec(path);
  if (drive) return { root: `${drive[0].toLowerCase()}/`, rest: path.slice(drive[0].length) };
  if (path.startsWith("//")) return { root: "//", rest: path.slice(2) };
  if (path.startsWith("/")) return { root: "/", rest: path.slice(1) };
  return { root: "", rest: path };
}

/** Drops empty and `.` parts and applies `..`. A `..` above a root is ignored. */
function collapse(root: string, rest: string): string[] {
  const parts: string[] = [];
  for (const part of rest.split("/")) {
    if (part === "" || part === ".") continue;
    if (part !== "..") {
      parts.push(part);
    } else if (parts.length > 0 && parts[parts.length - 1] !== "..") {
      parts.pop();
    } else if (root === "") {
      parts.push("..");
    }
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
  const expanded = isHomeRelative(raw) ? ctx.home + raw.slice(1) : raw;
  const own = splitRoot(expanded);
  if (own.root !== "") return own.root + collapse(own.root, own.rest).join("/");
  const base = splitRoot(ctx.cwd);
  return base.root + collapse(base.root, `${base.rest}/${own.rest}`).join("/");
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
