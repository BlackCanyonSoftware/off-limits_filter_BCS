import { entryMatches, matchingEntries } from "../../core/match.js";
import { EXIT_ERROR, EXIT_OK } from "../../core/signal.js";
import { type Deps, loadForOwner, requireTerminal } from "../deps.js";
import { describeEntry } from "./list.js";

/**
 * US-020: tells the owner which entries match some text, and which automatic protections do.
 * A refusal never says, so this is the owner's private way to understand one, and it runs only
 * for a person at a terminal.
 */
export function explainCommand(text: string, deps: Deps): number {
  const blocked = requireTerminal(deps);
  if (blocked !== undefined) return blocked;

  if (text.length === 0) {
    deps.io.stderr("explain needs some text to look at. Try `offlimits --help`.");
    return EXIT_ERROR;
  }
  const loaded = loadForOwner(deps);
  if ("exit" in loaded) return loaded.exit;

  const protectedLabels = deps.protections
    .filter((protection) => entryMatches(protection.entry, text, deps.match))
    .map((protection) => protection.label);
  const positions = matchingEntries(loaded.policy, text, deps.match);

  for (const label of protectedLabels) deps.io.stdout(`Protected automatically: ${label}.`);
  for (const position of positions) {
    const entry = loaded.policy.entries[position];
    if (entry) deps.io.stdout(`${String(position + 1)}. ${describeEntry(entry)}`);
  }
  if (protectedLabels.length === 0 && positions.length === 0) {
    deps.io.stdout("Nothing on your list matches that text.");
  }
  return EXIT_OK;
}
