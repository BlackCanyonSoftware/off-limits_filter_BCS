import { parseArgs } from "node:util";
import { EXIT_ERROR, EXIT_OK } from "../core/signal.js";
import { addCommand } from "./commands/add.js";
import { checkCommand } from "./commands/check.js";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove.js";
import type { Deps } from "./deps.js";

const HELP = `offlimits: keep chosen things out of your AI assistants' view

Usage:
  offlimits init                      Create your policy file
  offlimits add [value] [options]     Add an entry (from a terminal)
  offlimits list                      Show your entries (from a terminal)
  offlimits remove [number|value]     Remove an entry (from a terminal)
  offlimits check <text>              Say whether text touches anything on your list
  offlimits --version

add options:
  --kind <kind>        name (default), path, glob, command, env, host, conversation, regex
  --mode <mode>        hide (default) or forbid
  --assistant <name>   Apply only to this assistant (repeatable)
  --note <text>        A private note for yourself

check options:
  --assistant <name>   Check as this assistant

Matching ignores case and, for names, the separators space, "-" and "_".
Your policy lives in your user config folder; set OFFLIMITS_POLICY to use another file.

Exit codes:
  0  success, or allowed
  1  usage or general error
  2  blocked`;

/** Runs one command and returns its exit code. Everything outside the process comes from `deps`. */
export async function run(argv: readonly string[], deps: Deps): Promise<number> {
  const { io } = deps;
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        kind: { type: "string" },
        mode: { type: "string" },
        assistant: { type: "string", multiple: true },
        note: { type: "string" },
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
    io.stdout(deps.version);
    return EXIT_OK;
  }

  const [command, ...rest] = positionals;
  if (values.help || command === undefined) {
    io.stdout(HELP);
    return EXIT_OK;
  }

  const assistants = values.assistant ?? [];
  switch (command) {
    case "init":
      return initCommand(deps);
    case "add":
      return addCommand(
        {
          value: rest.length > 0 ? rest.join(" ") : undefined,
          kind: values.kind,
          mode: values.mode,
          assistants,
          note: values.note,
        },
        deps,
      );
    case "list":
      return listCommand(deps);
    case "remove":
      return removeCommand(rest.length > 0 ? rest.join(" ") : undefined, deps);
    case "check":
      return checkCommand(rest.join(" "), assistants[0], deps);
    default:
      io.stderr("Unknown command. Try `offlimits --help`.");
      return EXIT_ERROR;
  }
}
