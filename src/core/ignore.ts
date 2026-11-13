import { type PathContext, describePath, resolveAbsolute } from "./path.js";
import type { Entry, Policy } from "./policy.js";

export interface IgnoreTarget {
  /** The file other assistants read, in `.gitignore` syntax. */
  readonly file: string;
  readonly tool: string;
}

/** The ignore files other assistants read. Each is written from the same policy. */
export const IGNORE_TARGETS: readonly IgnoreTarget[] = [
  { file: ".cursorignore", tool: "Cursor" },
  { file: ".geminiignore", tool: "Gemini CLI" },
  { file: ".aiignore", tool: "JetBrains AI tools" },
  { file: ".agentsignore", tool: "agents that read a shared ignore file" },
];

/** Marks a file this tool wrote, so a later run knows it may replace it. */
export const GENERATED_MARKER = "# offlimits:generated";

export interface IgnorePatterns {
  readonly lines: readonly string[];
  /** Entries that cannot be written as an ignore pattern, by reason, for the owner to see. */
  readonly skipped: { readonly notFiles: number; readonly outsideFolder: number };
}

const GITIGNORE_SPECIAL = /[\\*?[\]!#]/gu;
const escapeLiteral = (text: string): string => text.replace(GITIGNORE_SPECIAL, "\\$&");

/** `a` becomes `[aA]`, so one pattern matches whatever capitals are used. */
function anyCase(word: string): string {
  return Array.from(word)
    .map((char) => {
      const lower = char.toLowerCase();
      const upper = char.toUpperCase();
      return lower === upper ? escapeLiteral(char) : `[${lower}${upper}]`;
    })
    .join("");
}

/**
 * A name as patterns: any capitals, and a hyphen, underscore or space (or nothing) between its
 * words, matched anywhere in a file or folder name.
 */
function namePatterns(value: string): string[] {
  const words = value.split(/[\s_-]+/u).filter((word) => word.length > 0);
  if (words.length === 0) return [];
  const joined = words.map(anyCase);
  return [...new Set([`*${joined.join("[-_ ]")}*`, `*${joined.join("")}*`])];
}

/**
 * Turns a policy into ignore patterns for the folder `projectDir`. Only entries that name files
 * and folders can be written this way: names, paths and globs. Others (variables, hosts, commands,
 * conversations, regular expressions) are counted as skipped, as are paths outside the folder.
 */
export function ignorePatterns(
  policy: Policy,
  projectDir: string,
  ctx: PathContext,
): IgnorePatterns {
  const lines = new Set<string>();
  let notFiles = 0;
  let outsideFolder = 0;
  const base = resolveAbsolute(projectDir, ctx);
  const baseKey = ctx.caseSensitive ? base : base.toLowerCase();

  const add = (entry: Entry): void => {
    switch (entry.kind) {
      case "name":
        for (const pattern of namePatterns(entry.value)) lines.add(pattern);
        return;
      case "glob": {
        const glob = entry.value.replaceAll("\\", "/");
        if (/^(?:~|\/|[A-Za-z]:)/u.test(glob)) outsideFolder++;
        else lines.add(glob);
        return;
      }
      case "path": {
        const shape = describePath(entry.value);
        if (!shape.absolute) {
          lines.add(`**/${shape.segments.join("/")}/`);
          return;
        }
        const full = resolveAbsolute(entry.value, ctx);
        const key = ctx.caseSensitive ? full : full.toLowerCase();
        if (key !== baseKey && !key.startsWith(baseKey.endsWith("/") ? baseKey : `${baseKey}/`)) {
          outsideFolder++;
          return;
        }
        const inside = full.slice(base.length).replace(/^\/+/u, "");
        if (inside.length > 0) lines.add(`/${inside.split("/").map(escapeLiteral).join("/")}/`);
        return;
      }
      case "env":
      case "host":
      case "command":
      case "conversation":
      case "regex":
      case "blind":
        notFiles++;
        return;
    }
  };
  for (const entry of policy.entries) add(entry);
  return { lines: [...lines], skipped: { notFiles, outsideFolder } };
}

/** The text of one ignore file: a header that says what it is and covers, then the patterns. */
export function renderIgnoreFile(target: IgnoreTarget, patterns: IgnorePatterns): string {
  return [
    GENERATED_MARKER,
    `# Written by Off-Limits for ${target.tool}. Do not edit by hand: run \`offlimits ignore-files\` again.`,
    "# This hides matching files from the tool's listings, search and context. Commands the tool runs",
    "# in a terminal may still reach them, so see docs/THREAT-MODEL.md for what this covers.",
    "# This file lists your entries in plain text: keep it out of any repository you share.",
    "",
    ...patterns.lines,
    "",
  ].join("\n");
}
