import { entryMatches } from "../../core/match.js";
import { type Entry, addEntry, parseEntry } from "../../core/policy.js";
import { EXIT_ERROR, EXIT_OK } from "../../core/signal.js";
import { type EntryWarning, warningsFor } from "../../core/warnings.js";
import { type Deps, confirm, loadForOwner, requireTerminal } from "../deps.js";
import { describeEntry } from "./list.js";

export interface AddOptions {
  value: string | undefined;
  kind: string | undefined;
  mode: string | undefined;
  assistants: string[];
  note: string | undefined;
}

const WARNING_TEXT: Record<EntryWarning, string> = {
  short: "Warning: this is short. It may match more than you intend.",
  common: "Warning: this is a common word. It may block ordinary work.",
};

/** The kinds whose effect on this folder can be shown by looking at file and folder names. */
const PREVIEWABLE: ReadonlySet<Entry["kind"]> = new Set(["name", "path", "glob", "regex"]);

async function previewLines(entry: Entry, deps: Deps): Promise<string[]> {
  if (!PREVIEWABLE.has(entry.kind)) {
    return ["A preview is not available for this kind of entry."];
  }
  const found = await deps.scanner.scan(deps.match.cwd, (relativePath) =>
    entryMatches(entry, relativePath, deps.previewMatch),
  );
  const count = `${String(found.files)} files, ${String(found.directories)} folders`;
  return [
    found.files + found.directories === 0
      ? "Nothing in this folder matches it."
      : `This would match, in this folder: ${count}${found.truncated ? " or more (the scan stopped early)" : ""}.`,
  ];
}

/** US-002 and US-005: adds an entry after showing what it would catch, from a terminal only. */
export async function addCommand(options: AddOptions, deps: Deps): Promise<number> {
  const blocked = requireTerminal(deps);
  if (blocked !== undefined) return blocked;

  const loaded = loadForOwner(deps);
  if ("exit" in loaded) return loaded.exit;

  const value = options.value ?? (await deps.io.ask("What should be kept off-limits? "));
  const parsed = parseEntry({
    kind: options.kind ?? "name",
    mode: options.mode ?? "hide",
    value,
    ...(options.assistants.length > 0 ? { assistants: options.assistants } : {}),
    ...(options.note !== undefined ? { note: options.note } : {}),
  });
  if (!parsed.ok) {
    for (const problem of parsed.problems) deps.io.stderr(problem);
    return EXIT_ERROR;
  }

  const added = addEntry(loaded.policy, parsed.entry);
  if (!added.ok) {
    deps.io.stderr("That entry is already on your list.");
    return EXIT_ERROR;
  }

  deps.io.stdout(describeEntry(parsed.entry));
  for (const line of await previewLines(parsed.entry, deps)) deps.io.stdout(line);
  for (const warning of warningsFor(parsed.entry)) deps.io.stdout(WARNING_TEXT[warning]);

  if (!(await confirm(deps, "Add it?"))) {
    deps.io.stdout("Nothing changed.");
    return EXIT_OK;
  }
  deps.store.save(added.policy);
  deps.io.stdout("Added.");
  return EXIT_OK;
}
