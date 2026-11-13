import type { Settings } from "../../src/adapters/claude-code/settings.js";
import type { Deps } from "../../src/cli/deps.js";
import type { MatchContext } from "../../src/core/match.js";
import type { Policy } from "../../src/core/policy.js";
import type { Protection } from "../../src/guard/protections.js";
import type { SettingsLoad, SettingsStore } from "../../src/platform/claude-settings.js";
import type { ContentScan } from "../../src/platform/content-scanner.js";
import type { Counts } from "../../src/platform/counts.js";
import type { Files } from "../../src/platform/files.js";
import type { FileSystemView } from "../../src/core/isolation.js";
import type { History } from "../../src/platform/git-history.js";
import type { BackendName } from "../../src/platform/isolation.js";
import type { LoadResult, PolicyStore } from "../../src/platform/policy-store.js";
import type { ScanResult } from "../../src/platform/scanner.js";
import type { AttemptRunner, Fixture } from "../../src/selftest/types.js";
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
  counts?: Counts;
  /** Files that exist, by path. Writes and appends update it. */
  files?: Map<string, string>;
  directories?: string[];
  contentScan?: ContentScan;
  history?: History;
  suggestions?: string[];
  backends?: BackendName[];
  fileSystem?: FileSystemView;
  /** The exit code the fake isolated command returns. */
  runExit?: number;
  fixture?: Fixture;
  runner?: AttemptRunner;
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
  /** The fake file system, as it ended up. */
  files: Map<string, string>;
  /** Every suggestion list given to a prompt. */
  suggestionsGiven: (readonly string[] | undefined)[];
  /** Every isolated command started: the program and its arguments. */
  started: { program: string; args: string[] }[];
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
  const files = options.files ?? new Map<string, string>();
  const suggestionsGiven: (readonly string[] | undefined)[] = [];
  const started: { program: string; args: string[] }[] = [];
  const fakeFiles: Files = {
    exists: (path) => files.has(path),
    isDirectory: (path) => (options.directories ?? []).includes(path),
    read: (path) => files.get(path),
    write: (path, text) => {
      files.set(path, text);
    },
    append: (path, text) => {
      files.set(path, (files.get(path) ?? "") + text);
    },
  };
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
      ask: (question, suggestions) => {
        asked.push(question);
        suggestionsGiven.push(suggestions);
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
    scanMatch: match,
    files: fakeFiles,
    isolation: {
      fileSystem: options.fileSystem ?? {
        list: () => [],
        exists: () => false,
        isDirectory: () => false,
      },
      availableBackends: () => options.backends ?? ["bubblewrap"],
      run: (program, args) => {
        started.push({ program, args });
        return options.runExit ?? 0;
      },
    },
    contentScanner: {
      scan: () =>
        Promise.resolve(options.contentScan ?? { hits: [], filesRead: 0, truncated: false }),
    },
    history: () => options.history,
    suggest: () => options.suggestions ?? [],
    protections: options.protections ?? [],
    selfTest: {
      createFixture: () => ({
        fixture: options.fixture ?? {
          root: "/tmp/fx",
          protectedDir: "/tmp/fx/clients/client-alpha",
          link: "/tmp/fx/clients/shortcut",
          policyFile: "/tmp/fx/policy.json",
          settingsFile: "/tmp/fx/claude/settings.json",
          countsFile: "/tmp/fx/counts.log",
          platform: "linux",
        },
        cleanup: () => undefined,
      }),
      runner: options.runner ?? {
        guard: () => Promise.resolve("held"),
        filter: (attempts) => Promise.resolve(attempts.map(() => "held" as const)),
      },
    },
    readCounts: () => options.counts ?? { blocked: 0, filtered: 0, failed: 0, since: undefined },
    openSettings: (path) => {
      settingsPathsOpened.push(path);
      return settingsStore;
    },
    guardCommand: { node: "/usr/bin/node", script: "/opt/offlimits/dist/guard/main.js" },
    debug: options.debug ?? false,
  };

  return {
    deps,
    out,
    err,
    asked,
    saved,
    savedSettings,
    settingsPathsOpened,
    files,
    suggestionsGiven,
    started,
  };
}
