import { normalise } from "./normalise.js";

/**
 * True when the text mentions any entry, however it is capitalised or separated.
 * An entry that is empty after normalising never matches, so a blank value cannot
 * block everything.
 */
export function mentionsAny(entries: readonly string[], text: string): boolean {
  const haystack = normalise(text);
  return entries.some((entry) => {
    const needle = normalise(entry);
    return needle.length > 0 && haystack.includes(needle);
  });
}
