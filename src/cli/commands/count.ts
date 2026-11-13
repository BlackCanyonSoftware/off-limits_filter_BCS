import { EXIT_OK } from "../../core/signal.js";
import type { Deps } from "../deps.js";

/**
 * US-011: how many calls were refused and lines hidden. It holds numbers and a date, never a name,
 * so it runs anywhere.
 */
export function countCommand(deps: Deps): number {
  const counts = deps.readCounts();
  if (counts.since === undefined) {
    deps.io.stdout("Nothing has been refused or hidden yet.");
    return EXIT_OK;
  }
  deps.io.stdout(`Counting since ${counts.since}.`);
  deps.io.stdout(`Tool calls refused: ${String(counts.blocked)}`);
  deps.io.stdout(`Lines hidden by the filter: ${String(counts.filtered)}`);
  deps.io.stdout(`Calls refused because a check could not be made: ${String(counts.failed)}`);
  return EXIT_OK;
}
