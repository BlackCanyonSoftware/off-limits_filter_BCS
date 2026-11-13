const INVISIBLE_CODES = [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad];
const INVISIBLE = new RegExp(
  INVISIBLE_CODES.map((point) => String.fromCharCode(point)).join("|"),
  "gu",
);
const SEPARATORS = /[\s_-]+/gu;

/**
 * Reduces text to the form used for matching: Unicode-compatibility folded, lower-cased,
 * with spaces, hyphens and underscores and invisible characters removed, so `Client Alpha`,
 * `client_alpha` and `CLIENT-ALPHA` all become `clientalpha`.
 */
export function normalise(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(INVISIBLE, "").replace(SEPARATORS, "");
}
