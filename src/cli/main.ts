#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { run } from "./run.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

process.exitCode = run(
  process.argv.slice(2),
  {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  },
  packageJson.version,
);
