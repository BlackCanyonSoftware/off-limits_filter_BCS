import { createLineFilter } from "../core/filter.js";

export type FilterResult = { ok: true; hidden: number } | { ok: false };

/**
 * Passes text from `source` to `write`, hiding the lines `isHidden` picks out (US-010). If anything
 * at all goes wrong, for any reason, it stops, writes nothing more, and reports failure: the
 * filter never falls back to passing text through. Lines already written were each checked.
 */
export async function filterStream(
  source: AsyncIterable<string>,
  write: (text: string) => Promise<void>,
  isHidden: (line: string) => boolean,
): Promise<FilterResult> {
  const filter = createLineFilter(isHidden);
  try {
    for await (const chunk of source) {
      const shown = filter.push(chunk);
      if (shown.length > 0) await write(shown);
    }
    const rest = filter.end();
    if (rest.length > 0) await write(rest);
    return { ok: true, hidden: filter.hidden };
  } catch {
    return { ok: false };
  }
}
