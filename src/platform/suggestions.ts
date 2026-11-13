import { readdirSync } from "node:fs";
import { join } from "node:path";

const SKIPPED: ReadonlySet<string> = new Set([".git", "node_modules", "dist", "coverage"]);
const MAX_SUGGESTIONS = 500;

/**
 * Names a person might want to type at the `add` prompt (US-016): the files and folders in a
 * folder and in the folders just inside it. Names only; nothing is read from the files.
 */
export function suggestNames(root: string): string[] {
  const names = new Set<string>();
  const list = (folder: string): string[] => {
    try {
      return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
        SKIPPED.has(entry.name) ? [] : [entry.isDirectory() ? `${entry.name}/` : entry.name],
      );
    } catch {
      return [];
    }
  };
  for (const name of list(root)) {
    names.add(name.replace(/\/$/u, ""));
    if (name.endsWith("/")) {
      for (const inner of list(join(root, name))) names.add(inner.replace(/\/$/u, ""));
    }
    if (names.size >= MAX_SUGGESTIONS) break;
  }
  return [...names].sort((a, b) => a.localeCompare(b)).slice(0, MAX_SUGGESTIONS);
}
