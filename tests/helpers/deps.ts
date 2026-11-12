import type { Deps } from "../../src/cli/deps.js";
import type { MatchContext } from "../../src/core/match.js";
import type { Policy } from "../../src/core/policy.js";
import type { LoadResult, PolicyStore } from "../../src/platform/policy-store.js";
import type { ScanResult } from "../../src/platform/scanner.js";
import { posixContext } from "./context.js";

export interface FakeOptions {
  interactive?: boolean;
  /** Answers given to prompts, in order. Anything asked beyond these is answered "". */
  answers?: string[];
  /** What the store holds to begin with. Defaults to an empty, valid policy. */
  stored?: LoadResult;
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
}

export const policyOf = (...entries: Policy["entries"]): Policy => ({ version: 1, entries });

/** A complete set of fake dependencies for command tests, recording what the command did. */
export function fakeDeps(options: FakeOptions = {}): Fake {
  const out: string[] = [];
  const err: string[] = [];
  const asked: string[] = [];
  const saved: Policy[] = [];
  const answers = [...(options.answers ?? [])];
  let stored: LoadResult = options.stored ?? { status: "ok", policy: policyOf() };

  const store: PolicyStore = {
    path: "/config/offlimits/policy.json",
    load: () => stored,
    save: (policy) => {
      saved.push(policy);
      stored = { status: "ok", policy };
    },
  };

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
    match: options.match ?? posixContext(),
    debug: options.debug ?? false,
  };

  return { deps, out, err, asked, saved };
}
