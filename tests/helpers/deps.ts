import type { Settings } from "../../src/adapters/claude-code/settings.js";
import type { Deps } from "../../src/cli/deps.js";
import type { MatchContext } from "../../src/core/match.js";
import type { Policy } from "../../src/core/policy.js";
import type { Protection } from "../../src/guard/protections.js";
import type { SettingsLoad, SettingsStore } from "../../src/platform/claude-settings.js";
import type { LoadResult, PolicyStore } from "../../src/platform/policy-store.js";
import type { ScanResult } from "../../src/platform/scanner.js";
import { posixContext } from "./context.js";

export interface FakeOptions {
  interactive?: boolean;
  /** Answers given to prompts, in order. Anything asked beyond these is answered "". */
  answers?: string[];
  /** What the store holds to begin with. Defaults to an empty, valid policy. */
  stored?: LoadResult;
  /** What the settings file holds to begin with. Defaults to no file. */
  settings?: SettingsLoad;
  protections?: Protection[];
  scan?: ScanResult;
  match?: MatchContext;
  debug?: boolean;
}

export interface Fake {
  deps: Deps;
  out: string[];
  err: string[];
  asked: string[];
  /** Every policy passed to `save`, oldest first. */
  saved: Policy[];
  /** Every settings object written, oldest first, and the paths asked for. */
  savedSettings: Settings[];
  settingsPathsOpened: (string | undefined)[];
}

export const policyOf = (...entries: Policy["entries"]): Policy => ({ version: 1, entries });

/** A complete set of fake dependencies for command tests, recording what the command did. */
export function fakeDeps(options: FakeOptions = {}): Fake {
  const out: string[] = [];
  const err: string[] = [];
  const asked: string[] = [];
  const saved: Policy[] = [];
  const savedSettings: Settings[] = [];
  const settingsPathsOpened: (string | undefined)[] = [];
  const answers = [...(options.answers ?? [])];
  let stored: LoadResult = options.stored ?? { status: "ok", policy: policyOf() };
  let settings: SettingsLoad = options.settings ?? { status: "missing" };

  const store: PolicyStore = {
    path: "/config/offlimits/policy.json",
    load: () => stored,
    save: (policy) => {
      saved.push(policy);
      stored = { status: "ok", policy };
    },
  };

  const settingsStore: SettingsStore = {
    path: "/home/kyle/.claude/settings.json",
    load: () => settings,
    save: (next) => {
      savedSettings.push(next);
      settings = { status: "ok", settings: next };
      return { backup: undefined };
    },
  };

  const match = options.match ?? posixContext();
  const deps: Deps = {
    io: {
      stdout: (line) => out.push(line),
      stderr: (line) => err.push(line),
      interactive: options.interactive ?? true,
      ask: (question) => {
        asked.push(question);
        return Promise.resolve(answers.shift() ?? "");
      },
    },
    version: "9.9.9",
    store,
    scanner: {
      scan: () => Promise.resolve(options.scan ?? { files: 0, directories: 0, truncated: false }),
    },
    match,
    previewMatch: match,
    protections: options.protections ?? [],
    openSettings: (path) => {
      settingsPathsOpened.push(path);
      return settingsStore;
    },
    guardCommand: { node: "/usr/bin/node", script: "/opt/offlimits/dist/guard/main.js" },
    debug: options.debug ?? false,
  };

  return { deps, out, err, asked, saved, savedSettings, settingsPathsOpened };
}
