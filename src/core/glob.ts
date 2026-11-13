import { escapeRegExp } from "./regex.js";

/**
 * Compiles a glob into a regular expression over slash-separated, already-folded paths.
 * `*` and `?` stay within one segment, `**` crosses segments, and `[abc]`, `[a-z]` and `[!a]`
 * match one character from a set. A relative glob may match starting at any segment; an anchored
 * one must match from the root.
 */
export function compileGlob(pattern: string, anchored: boolean): RegExp {
  const chars = Array.from(pattern);
  let source = "";
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i] ?? "";
    if (char === "*") {
      if (chars[i + 1] === "*") {
        i++;
        if (chars[i + 1] === "/") {
          i++;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else if (char === "[") {
      const close = chars.indexOf("]", i + 2);
      if (close === -1) {
        source += escapeRegExp(char);
      } else {
        let set = chars.slice(i + 1, close).join("");
        const negated = set.startsWith("!") || set.startsWith("^");
        if (negated) set = set.slice(1);
        const members = set.replace(/[\\\]^]/gu, "\\$&");
        // A negated set must not match the separator either.
        source += negated ? `[^${members}/]` : `[${members}]`;
        i = close;
      }
    } else {
      source += escapeRegExp(char);
    }
  }
  return new RegExp(anchored ? `^${source}$` : `(?:^|/)${source}$`, "u");
}
