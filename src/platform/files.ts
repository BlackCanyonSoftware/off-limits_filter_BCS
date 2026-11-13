import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";

/** The few file operations commands need beyond the policy, behind an interface tests can fake. */
export interface Files {
  exists(path: string): boolean;
  isDirectory(path: string): boolean;
  /** The text of a file, or undefined when it cannot be read. */
  read(path: string): string | undefined;
  write(path: string, text: string): void;
  append(path: string, text: string): void;
}

export const realFiles: Files = {
  exists: (path) => existsSync(path),
  isDirectory: (path) => {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  },
  read: (path) => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return undefined;
    }
  },
  write: (path, text) => {
    writeFileSync(path, text);
  },
  append: (path, text) => {
    appendFileSync(path, text);
  },
};
