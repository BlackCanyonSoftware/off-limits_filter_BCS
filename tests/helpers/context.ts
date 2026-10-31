import type { MatchContext } from "../../src/core/match.js";
import type { Entry, EntryKind, EntryMode } from "../../src/core/policy.js";

type Links = Readonly<Record<string, string>>;

/** Behaves like realpath for a file system where `from` is a link to `to`. */
function fakeRealpath(links: Links): (path: string) => string {
  return (path) => {
    for (const [from, to] of Object.entries(links)) {
      if (path === from || path.startsWith(`${from}/`)) return to + path.slice(from.length);
    }
    return path;
  };
}

export function posixContext(options: { cwd?: string; links?: Links } = {}): MatchContext {
  return {
    cwd: options.cwd ?? "/work/project",
    home: "/home/kyle",
    caseSensitive: true,
    realpath: fakeRealpath(options.links ?? {}),
  };
}

export function windowsContext(options: { cwd?: string; links?: Links } = {}): MatchContext {
  return {
    cwd: options.cwd ?? "C:\\Work\\Project",
    home: "C:\\Users\\Kyle",
    caseSensitive: false,
    realpath: fakeRealpath(options.links ?? {}),
  };
}

export function entry(kind: EntryKind, value: string, mode: EntryMode = "hide"): Entry {
  return { kind, mode, value };
}
