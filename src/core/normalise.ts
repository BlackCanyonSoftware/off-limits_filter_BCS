const SEPARATORS = /[\s_-]+/gu;

/**
 * Reduces text to the form used for matching: Unicode-compatibility folded, lower-cased,
 * with spaces, hyphens and underscores removed, so `Client Alpha`, `client_alpha` and
 * `CLIENT-ALPHA` all become `clientalpha`.
 */
export function normalise(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(SEPARATORS, "");
}
