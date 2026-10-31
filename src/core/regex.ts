/** Escapes text so it can be embedded in a regular expression as a literal. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
