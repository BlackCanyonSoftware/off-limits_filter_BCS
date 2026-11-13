#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMatchContext } from "../platform/context.js";
import { createSettingsStore } from "../platform/claude-settings.js";
import {
  claudeSettingsFiles,
  claudeSettingsPath,
  countsPath,
  policyPath,
} from "../platform/paths.js";
import { readCounts } from "../platform/counts.js";
import { createFileStore } from "../platform/policy-store.js";
import { createBoundedRegexTester } from "../platform/regex.js";
import { contentScanner } from "../platform/content-scanner.js";
import { realFiles } from "../platform/files.js";
import { readHistory } from "../platform/git-history.js";
import { availableBackends, realFileSystem, runAttached } from "../platform/isolation.js";
import { fileScanner } from "../platform/scanner.js";
import { suggestNames } from "../platform/suggestions.js";
import { createFixture, createRunner } from "../platform/selftest.js";
import { ask, isInteractive } from "../platform/terminal.js";
import { protections } from "../guard/protections.js";
import type { Deps } from "./deps.js";
import { run } from "./run.js";

const here = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(here, "../../package.json"), "utf8")) as {
  version: string;
};

/** The most time all `regex` entries together may take when checking text. */
const REGEX_BUDGET_MS = 100;

const home = homedir();
const policyFile = policyPath(process.env, process.platform, home);
const countsFile = countsPath(process.env, process.platform, home);
const debugSetting = process.env.OFFLIMITS_DEBUG ?? "";
const baseContext = createMatchContext();

const deps: Deps = {
  io: {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
    interactive: isInteractive(),
    ask,
  },
  version: packageJson.version,
  store: createFileStore(policyFile),
  scanner: fileScanner,
  match: createMatchContext({ regexTest: createBoundedRegexTester(REGEX_BUDGET_MS) }),
  previewMatch: baseContext,
  scanMatch: createMatchContext({
    followLinks: false,
    regexTest: createBoundedRegexTester({ eachMs: 50 }),
  }),
  files: realFiles,
  isolation: {
    fileSystem: realFileSystem,
    availableBackends: () => availableBackends(process.platform),
    run: runAttached,
  },
  contentScanner,
  history: readHistory,
  suggest: suggestNames,
  protections: protections({
    policyFile,
    settingsFiles: claudeSettingsFiles(
      process.env,
      process.platform,
      home,
      [process.cwd(), process.env.CLAUDE_PROJECT_DIR].filter(
        (folder): folder is string => !!folder,
      ),
    ),
    programDir: resolve(here, ".."),
    countsFile,
  }),
  readCounts: () => readCounts(countsFile),
  selfTest: {
    createFixture,
    runner: createRunner({
      guard: resolve(here, "../guard-cjs/guard/main.js"),
      filter: resolve(here, "../guard-cjs/filter/main.js"),
    }),
  },
  openSettings: (path) =>
    createSettingsStore(path ?? claudeSettingsPath(process.env, process.platform, home)),
  guardCommand: { node: process.execPath, script: resolve(here, "../guard-cjs/guard/main.js") },
  debug: debugSetting !== "" && debugSetting !== "0",
};

process.exitCode = await run(process.argv.slice(2), deps);
