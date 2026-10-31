import { readdir } from "node:fs/promises";
import { join } from "node:path";

export interface ScanResult {
  files: number;
  directories: number;
  /** True when the scan stopped at its limit, so the counts are a lower bound. */
  truncated: boolean;
}

export interface ProjectScanner {
  /** Counts the files and folders under `root` whose relative path satisfies `matches`. */
  scan(root: string, matches: (relativePath: string) => boolean): Promise<ScanResult>;
}

export const MAX_SCANNED_ITEMS = 20_000;
const SKIPPED_FOLDERS: ReadonlySet<string> = new Set([".git", "node_modules"]);

/** Walks a folder breadth-first without following links, to preview what an entry would catch. */
export const fileScanner: ProjectScanner = {
  async scan(root, matches) {
    const result: ScanResult = { files: 0, directories: 0, truncated: false };
    let seen = 0;
    const queue: string[] = [""];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      let children;
      try {
        children = await readdir(join(root, next), { withFileTypes: true });
      } catch {
        continue; // A folder that cannot be read is skipped.
      }
      for (const child of children) {
        const relative = next === "" ? child.name : `${next}/${child.name}`;
        const isFolder = child.isDirectory();
        if (isFolder && SKIPPED_FOLDERS.has(child.name)) continue;
        if (++seen > MAX_SCANNED_ITEMS) return { ...result, truncated: true };
        if (matches(relative)) {
          if (isFolder) result.directories++;
          else result.files++;
        }
        if (isFolder) queue.push(relative);
      }
    }
    return result;
  },
};
