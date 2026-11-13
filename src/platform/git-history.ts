import { spawnSync } from "node:child_process";

export interface History {
  /** Every line of every commit message, in all branches. */
  readonly messageLines: readonly string[];
  /** Every file path that appears in any commit, once each. */
  readonly paths: readonly string[];
}

const run = (root: string, args: string[]): string | undefined => {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout : undefined;
};

/** The commit messages and file paths in a folder's git history, or undefined if it has none. */
export function readHistory(root: string): History | undefined {
  const messages = run(root, ["log", "--all", "--format=%B"]);
  const paths = run(root, ["log", "--all", "--name-only", "--format="]);
  if (messages === undefined || paths === undefined) return undefined;
  return {
    messageLines: messages.split("\n").filter((line) => line.trim().length > 0),
    paths: [...new Set(paths.split("\n").filter((line) => line.length > 0))],
  };
}
