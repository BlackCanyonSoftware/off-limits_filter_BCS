import { parseArgs } from "node:util";
import { EXIT_ERROR, EXIT_OK } from "../core/signal.js";
import { addCommand } from "./commands/add.js";
import { checkCommand } from "./commands/check.js";
import { countCommand } from "./commands/count.js";
import { explainCommand } from "./commands/explain.js";
import { ignoreFilesCommand } from "./commands/ignore-files.js";
import { initCommand } from "./commands/init.js";
import { installCommand, uninstallCommand } from "./commands/install.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove.js";
import { runIsolatedCommand } from "./commands/run-isolated.js";
import { scanCommand } from "./commands/scan.js";
import { snippetCommand } from "./commands/snippet.js";
import { syncCommand } from "./commands/sync.js";
import { testCommand } from "./commands/test.js";
import type { Deps } from "./deps.js";

const HELP = `offlimits: keep chosen things out of your AI assistants' view

Usage:
  offlimits init                      Create your policy file
  offlimits add [value] [options]     Add an entry (from a terminal)
  offlimits list                      Show your entries (from a terminal)
  offlimits remove [number|value]     Remove an entry (from a terminal)
  offlimits explain <text>            Show which entries match some text (from a terminal)
  offlimits check <text>              Say whether text touches anything on your list
  offlimits count                     Show how many calls were refused and lines hidden
  offlimits test                      Try common workarounds against the guard and filter
  offlimits run [options] -- <cmd>    Run a command where hidden things are absent
  offlimits sync [file]               Replace your policy with one from a file, keeping yours if it is bad
  offlimits scan [folder]             Show where your entries already appear (from a terminal)
  offlimits ignore-files [folder]     Write ignore files for other assistants (from a terminal)
  offlimits install                   Add the guard to Claude Code (from a terminal)
  offlimits uninstall                 Remove the guard from Claude Code (from a terminal)
  offlimits snippet                   Print the notice for AGENTS.md or CLAUDE.md
  offlimits --version

Output filter (a separate command): some-command | offlimits-filter

add options:
  --kind <kind>        name (default), path, glob, command, env, host, conversation, regex
  --mode <mode>        hide (default) or forbid
  --assistant <name>   Apply only to this assistant (repeatable)
  --note <text>        A private note for yourself
  --blind              Store only a keyed hash of the name, so the policy can be shared (names only)

check options:
  --assistant <name>   Check as this assistant (the guard uses claude-code)

run options (everything after -- is the command):
  --backend <name>     bubblewrap or docker (default: the first one that works here)
  --image <image>      For docker: the image to run in (default ubuntu:24.04)
  --folder <path>      The folder to rebuild (default: the current folder)
  --dry-run            Show the plan instead of running it (from a terminal)

install and uninstall options:
  --settings <path>    A Claude Code settings file other than your own

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
        settings: { type: "string" },
        backend: { type: "string" },
        image: { type: "string" },
        "dry-run": { type: "boolean" },
        folder: { type: "string" },
        blind: { type: "boolean" },
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
  const words = rest.join(" ");
  switch (command) {
    case "init":
      return initCommand(deps);
    case "add":
      return addCommand(
        {
          value: rest.length > 0 ? words : undefined,
          kind: values.kind,
          mode: values.mode,
          assistants,
          note: values.note,
          blind: values.blind === true,
        },
        deps,
      );
    case "list":
      return listCommand(deps);
    case "remove":
      return removeCommand(rest.length > 0 ? words : undefined, deps);
    case "explain":
      return explainCommand(words, deps);
    case "check":
      return checkCommand(words, assistants[0], deps);
    case "run":
      return runIsolatedCommand(
        {
          command: rest,
          backend: values.backend,
          image: values.image,
          dryRun: values["dry-run"] === true,
          folder: values.folder,
        },
        deps,
      );
    case "sync":
      return syncCommand(rest.length > 0 ? words : undefined, deps);
    case "scan":
      return scanCommand(rest.length > 0 ? words : undefined, deps);
    case "ignore-files":
      return ignoreFilesCommand(rest.length > 0 ? words : undefined, deps);
    case "test":
      return testCommand(deps);
    case "count":
      return countCommand(deps);
    case "install":
      return installCommand(values.settings, deps);
    case "uninstall":
      return uninstallCommand(values.settings, deps);
    case "snippet":
      return snippetCommand(deps);
    default:
      io.stderr("Unknown command. Try `offlimits --help`.");
      return EXIT_ERROR;
  }
}
