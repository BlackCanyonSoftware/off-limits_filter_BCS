#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { createMatchContext } from "../platform/context.js";
import { policyPath } from "../platform/paths.js";
import { createFileStore } from "../platform/policy-store.js";
import { fileScanner } from "../platform/scanner.js";
import { ask, isInteractive } from "../platform/terminal.js";
import type { Deps } from "./deps.js";
import { run } from "./run.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

const debugSetting = process.env.OFFLIMITS_DEBUG ?? "";

const deps: Deps = {
  io: {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
    interactive: isInteractive(),
    ask,
  },
  version: packageJson.version,
  store: createFileStore(policyPath(process.env, process.platform, homedir())),
  scanner: fileScanner,
  match: createMatchContext(),
  debug: debugSetting !== "" && debugSetting !== "0",
};

process.exitCode = await run(process.argv.slice(2), deps);
