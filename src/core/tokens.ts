const TOKEN_BREAKS = /[\s"'`=,;()<>|&]+/u;
const QUOTED_SPAN = /"([^"\n]{1,1024})"|'([^'\n]{1,1024})'|`([^`\n]{1,1024})`/gu;

/**
 * Splits free text (a command line, a tool call, a listing) into the pieces that might be
 * paths, commands or names. Quotes, redirections and separators are break points; the
 * colon and both slashes are not, so `C:\Users\me` and `/home/me` stay whole.
 */
export function splitTokens(text: string): string[] {
  return text.split(TOKEN_BREAKS).filter((token) => token.length > 0);
}

/**
 * The pieces of text that might be a path: the tokens above, plus every quoted span kept
 * whole, so a path with spaces in it (`"C:\Client Alpha\notes.txt"`) is still one candidate.
 */
export function pathPieces(text: string): string[] {
  const quoted = [...text.matchAll(QUOTED_SPAN)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
  return [...splitTokens(text), ...quoted.filter((span) => span.trim().length > 0)];
}
