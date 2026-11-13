import { type MatchContext, decide } from "./match.js";
import type { Policy } from "./policy.js";

/** A line longer than this is hidden whole, because it cannot be checked without keeping it all. */
export const MAX_LINE_LENGTH = 1_048_576;

/** The one line shown in place of a run of hidden lines. It names nothing (ADR 0003). */
export function filteredMarker(count: number): string {
  return `[offlimits:filtered] ${String(count)} ${count === 1 ? "line" : "lines"} hidden\n`;
}

/**
 * Builds the test for one line of output: true when the line touches anything on the policy.
 * A NUL character is dropped first, so text a tool writes as UTF-16 (a NUL after each letter) is
 * read as the text it is. Only entries that apply to the given assistant count.
 */
export function lineMatcher(
  policy: Policy,
  ctx: MatchContext,
  assistant?: string,
): (line: string) => boolean {
  return (line) => decide(policy, line.replaceAll("\0", ""), ctx, assistant).blocked;
}

export interface LineFilter {
  /** Takes the next piece of output, and returns what may be shown of it so far. */
  push(chunk: string): string;
  /** Call once at the end of the output. Returns what is left to show. */
  end(): string;
  /** How many lines have been hidden so far. */
  readonly hidden: number;
}

/**
 * Replaces each run of consecutive lines that match with one marker line, and passes everything
 * else through byte for byte. Works on a stream, so lines may arrive in any pieces, and keeps only
 * the unfinished line in memory. A line too long to keep is hidden whole. If `isHidden` throws,
 * the exception is not caught here: the caller must stop and show nothing more.
 */
export function createLineFilter(
  isHidden: (line: string) => boolean,
  maxLineLength: number = MAX_LINE_LENGTH,
): LineFilter {
  let pending = "";
  let tooLong = false;
  let run = 0;
  let total = 0;

  const hide = (): void => {
    run++;
    total++;
  };
  const flushRun = (): string => {
    if (run === 0) return "";
    const marker = filteredMarker(run);
    run = 0;
    return marker;
  };
  /** One finished line, `terminator` being the newline that ended it, if any. */
  const finishLine = (line: string, terminator: string): string => {
    if (isHidden(line)) {
      hide();
      return "";
    }
    return flushRun() + line + terminator;
  };

  return {
    get hidden() {
      return total;
    },

    push(chunk) {
      let output = "";
      let rest = chunk;
      while (rest.length > 0) {
        const newline = rest.indexOf("\n");
        if (newline === -1) {
          if (!tooLong) pending += rest;
          if (pending.length > maxLineLength) {
            tooLong = true;
            pending = "";
          }
          break;
        }
        const piece = rest.slice(0, newline);
        rest = rest.slice(newline + 1);
        if (tooLong || pending.length + piece.length > maxLineLength) {
          hide();
        } else {
          output += finishLine(pending + piece, "\n");
        }
        pending = "";
        tooLong = false;
      }
      return output;
    },

    end() {
      if (tooLong) hide();
      else if (pending.length > 0) {
        const last = pending;
        pending = "";
        return finishLine(last, "") + flushRun();
      }
      pending = "";
      tooLong = false;
      return flushRun();
    },
  };
}
