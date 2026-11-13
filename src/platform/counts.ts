import { appendFileSync, readFileSync } from "node:fs";

/** What the audit counts: refusals, lines hidden by the filter, and refusals because of a failure. */
export type CountedEvent = "blocked" | "filtered" | "failed";

export interface Counts {
  blocked: number;
  filtered: number;
  failed: number;
  /** The date of the first event, or undefined when there are none. */
  since: string | undefined;
}

/**
 * Records one event by appending a line to the counts file. The line holds a date, the kind of
 * event and a number, and never anything from a call or the policy (US-011). Counting must never
 * change what the guard or filter decides, so a failure to write is ignored.
 */
export function recordEvent(path: string, event: CountedEvent, amount = 1): void {
  try {
    appendFileSync(path, `${new Date().toISOString().slice(0, 10)} ${event} ${String(amount)}\n`);
  } catch {
    // The count is lost; the decision it describes is not affected.
  }
}

const LINE = /^(\d{4}-\d{2}-\d{2}) (blocked|filtered|failed) (\d+)$/u;

/** Adds up the counts file. A missing file is no events; a line that is not an event is skipped. */
export function readCounts(path: string): Counts {
  const counts: Counts = { blocked: 0, filtered: 0, failed: 0, since: undefined };
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return counts;
  }
  for (const line of text.split("\n")) {
    const match = LINE.exec(line);
    if (!match) continue;
    const [, date, event, amount] = match as unknown as [string, string, CountedEvent, string];
    counts[event] += Number(amount);
    counts.since ??= date;
  }
  return counts;
}
