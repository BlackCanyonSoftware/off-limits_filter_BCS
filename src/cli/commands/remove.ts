import { findEntryIndex, removeEntryAt } from "../../core/policy.js";
import { EXIT_ERROR, EXIT_OK } from "../../core/signal.js";
import { type Deps, confirm, loadForOwner, requireTerminal } from "../deps.js";
import { describeEntry } from "./list.js";

/** US-003: removes one entry, by its number in `list` or by its value. */
export async function removeCommand(target: string | undefined, deps: Deps): Promise<number> {
  const blocked = requireTerminal(deps);
  if (blocked !== undefined) return blocked;

  const loaded = loadForOwner(deps);
  if ("exit" in loaded) return loaded.exit;
  const { policy } = loaded;

  const wanted = (target ?? (await deps.io.ask("Which entry (its number or its value)? "))).trim();
  const number = /^\d+$/u.test(wanted) ? Number(wanted) - 1 : -1;
  const index =
    number >= 0 && number < policy.entries.length ? number : findEntryIndex(policy, wanted);
  const entry = policy.entries[index];
  if (entry === undefined) {
    deps.io.stderr("No entry matches that. Run `offlimits list` to see your entries.");
    return EXIT_ERROR;
  }

  deps.io.stdout(describeEntry(entry));
  if (!(await confirm(deps, "Remove it?"))) {
    deps.io.stdout("Nothing changed.");
    return EXIT_OK;
  }
  deps.store.save(removeEntryAt(policy, index));
  deps.io.stdout("Removed.");
  return EXIT_OK;
}
