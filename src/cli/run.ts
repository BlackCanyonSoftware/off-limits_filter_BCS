import { parseArgs } from "node:util";
import { mentionsAny } from "../core/match.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_ERROR, EXIT_OK } from "../core/signal.js";

export interface Io {
  stdout(line: string): void;
  stderr(line: string): void;
}

const HELP = `offlimits: keep chosen things out of your AI assistants' view

Usage:
  offlimits --version
  offlimits check --entry <value> [--entry <value> ...] <text>

check (skeleton in 0.0.x, reads a policy file from M1):
  Reports whether <text> mentions any --entry value, ignoring case and the
  separators space, "-" and "_".

Exit codes:
  0  allowed
  1  usage or general error
  2  blocked`;

/** Runs one command and returns its exit code. Pure apart from the supplied `io`. */
export function run(argv: readonly string[], io: Io, version: string): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        entry: { type: "string", multiple: true },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch {
    io.stderr("Could not read those options. Try `offlimits --help`.");
    return EXIT_ERROR;
  }

  const { values, positionals } = parsed;

  if (values.version) {
    io.stdout(version);
    return EXIT_OK;
  }

  const [command, ...rest] = positionals;

  if (values.help || command === undefined) {
    io.stdout(HELP);
    return EXIT_OK;
  }

  if (command !== "check") {
    io.stderr("Unknown command. Try `offlimits --help`.");
    return EXIT_ERROR;
  }

  const entries = values.entry ?? [];
  const text = rest.join(" ");
  if (entries.length === 0 || text.length === 0) {
    io.stderr("check needs at least one --entry and some text. Try `offlimits --help`.");
    return EXIT_ERROR;
  }

  if (mentionsAny(entries, text)) {
    io.stderr(BLOCKED_MESSAGE);
    return EXIT_BLOCKED;
  }

  io.stdout("allowed");
  return EXIT_OK;
}
