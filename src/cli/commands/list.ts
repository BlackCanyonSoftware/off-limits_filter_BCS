import type { Entry } from "../../core/policy.js";
import { EXIT_OK } from "../../core/signal.js";
import { type Deps, loadForOwner, requireTerminal } from "../deps.js";

export function describeEntry(entry: Entry): string {
  const scope = entry.assistants ? ` (for ${entry.assistants.join(", ")})` : "";
  const note = entry.note ? `  # ${entry.note}` : "";
  return `[${entry.mode}] ${entry.kind}: ${entry.value}${scope}${note}`;
}

/** US-003: shows the list. It holds the names, so it only runs for a person at a terminal. */
export function listCommand(deps: Deps): number {
  const blocked = requireTerminal(deps);
  if (blocked !== undefined) return blocked;

  const loaded = loadForOwner(deps);
  if ("exit" in loaded) return loaded.exit;

  if (loaded.policy.entries.length === 0) {
    deps.io.stdout("Your list is empty. Add something with `offlimits add`.");
    return EXIT_OK;
  }
  loaded.policy.entries.forEach((entry, index) => {
    deps.io.stdout(`${String(index + 1)}. ${describeEntry(entry)}`);
  });
  return EXIT_OK;
}
