import type { Env } from "../../src/core/env.js";
import type { MatchContext } from "../../src/core/match.js";
import type { Entry, EntryKind, EntryMode } from "../../src/core/policy.js";

type Links = Readonly<Record<string, string>>;

interface ContextOptions {
  cwd?: string;
  links?: Links;
  env?: Env;
}

/** Behaves like realpath for a file system where `from` is a link to `to`. */
function fakeRealpath(links: Links): (path: string) => string {
  return (path) => {
    for (const [from, to] of Object.entries(links)) {
      if (path === from || path.startsWith(`${from}/`)) return to + path.slice(from.length);
    }
    return path;
  };
}

export function posixContext(options: ContextOptions = {}): MatchContext {
  return {
    cwd: options.cwd ?? "/work/project",
    home: "/home/kyle",
    caseSensitive: true,
    realpath: fakeRealpath(options.links ?? {}),
    ...(options.env ? { env: options.env } : {}),
  };
}

export function windowsContext(options: ContextOptions = {}): MatchContext {
  return {
    cwd: options.cwd ?? "C:\\Work\\Project",
    home: "C:\\Users\\Kyle",
    caseSensitive: false,
    windows: true,
    realpath: fakeRealpath(options.links ?? {}),
    ...(options.env ? { env: options.env } : {}),
  };
}

export function entry(kind: EntryKind, value: string, mode: EntryMode = "hide"): Entry {
  return { kind, mode, value };
}
