import { escapeRegExp } from "./regex.js";

/**
 * Compiles a glob into a regular expression over slash-separated, already-folded paths.
 * `*` and `?` stay within one segment, `**` crosses segments. A relative glob may match
 * starting at any segment; an anchored one must match from the root.
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
    } else {
      source += escapeRegExp(char);
    }
  }
  return new RegExp(anchored ? `^${source}$` : `(?:^|/)${source}$`, "u");
}
