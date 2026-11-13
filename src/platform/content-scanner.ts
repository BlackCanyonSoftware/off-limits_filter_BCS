import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export interface FileHit {
  /** Relative to the scanned folder, with forward slashes. */
  readonly path: string;
  /** True when the file's own name or path matches. */
  readonly nameMatches: boolean;
  /** Up to the first few line numbers (from 1) that match. */
  readonly lines: readonly number[];
  /** How many lines match in all. */
  readonly total: number;
}

export interface ContentScan {
  readonly hits: readonly FileHit[];
  readonly filesRead: number;
  /** True when the scan stopped at its limit, so there may be more. */
  readonly truncated: boolean;
}

export interface ContentScanner {
  /** Finds files, under `root`, whose name or any line of text satisfies `isHit`. */
  scan(root: string, isHit: (text: string) => boolean): Promise<ContentScan>;
}

export const MAX_FILES_READ = 5000;
const MAX_FILE_BYTES = 1_000_000;
const MAX_LINES_REPORTED = 20;
const SKIPPED_FOLDERS: ReadonlySet<string> = new Set([".git", "node_modules", "dist", "coverage"]);

/** Text files only: a NUL early on means binary, which is left out. */
const looksBinary = (bytes: Buffer): boolean => bytes.subarray(0, 8000).includes(0);

/** Reads each text file under a folder, without following links, to find where entries appear. */
export const contentScanner: ContentScanner = {
  async scan(root, isHit) {
    const hits: FileHit[] = [];
    let filesRead = 0;
    const queue: string[] = [""];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      let children;
      try {
        children = await readdir(join(root, next), { withFileTypes: true });
      } catch {
        continue;
      }
      for (const child of children) {
        const relative = next === "" ? child.name : `${next}/${child.name}`;
        if (child.isDirectory()) {
          if (!SKIPPED_FOLDERS.has(child.name)) queue.push(relative);
          continue;
        }
        if (!child.isFile()) continue;
        if (filesRead >= MAX_FILES_READ) return { hits, filesRead, truncated: true };
        filesRead++;

        const nameMatches = isHit(relative);
        const lines: number[] = [];
        let total = 0;
        try {
          if ((await stat(join(root, relative))).size <= MAX_FILE_BYTES) {
            const bytes = await readFile(join(root, relative));
            if (!looksBinary(bytes)) {
              bytes
                .toString("utf8")
                .split("\n")
                .forEach((line, index) => {
                  if (!isHit(line)) return;
                  total++;
                  if (lines.length < MAX_LINES_REPORTED) lines.push(index + 1);
                });
            }
          }
        } catch {
          // A file that cannot be read is skipped.
        }
        if (nameMatches || total > 0) hits.push({ path: relative, nameMatches, lines, total });
      }
    }
    return { hits, filesRead, truncated: false };
  },
};
