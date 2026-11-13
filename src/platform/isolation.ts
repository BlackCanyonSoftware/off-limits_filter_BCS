import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readlinkSync, statSync } from "node:fs";
import type { DirEntry, FileSystemView } from "../core/isolation.js";

/** The real file system, as the planner looks at it: listing without following links. */
export const realFileSystem: FileSystemView = {
  list(directory): DirEntry[] | undefined {
    try {
      return readdirSync(directory, { withFileTypes: true }).map((child) => {
        const isLink = child.isSymbolicLink();
        let isDirectory = child.isDirectory();
        let linkTarget: string | undefined;
        if (isLink) {
          linkTarget = readlinkSync(`${directory}/${child.name}`);
          try {
            isDirectory = statSync(`${directory}/${child.name}`).isDirectory();
          } catch {
            isDirectory = false;
          }
        }
        return { name: child.name, isDirectory, linkTarget };
      });
    } catch {
      return undefined;
    }
  },
  exists: (path) => existsSync(path),
  isDirectory: (path) => {
    try {
      return lstatSync(path).isDirectory();
    } catch {
      return false;
    }
  },
};

export type BackendName = "bubblewrap" | "docker";

/** True when `command` runs and exits 0 with these arguments, with no window and no output. */
function works(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, { stdio: "ignore", windowsHide: true, timeout: 15_000 });
  return result.status === 0;
}

/**
 * Which isolation tools can run here. bubblewrap must run a trivial command, not just exist,
 * because many systems have it installed but forbid the user namespaces it needs. Docker must
 * reach its service.
 */
export function availableBackends(platform: NodeJS.Platform): BackendName[] {
  const found: BackendName[] = [];
  if (platform === "linux" && works("bwrap", ["--ro-bind", "/", "/", "true"]))
    found.push("bubblewrap");
  if (works("docker", ["info"])) found.push("docker");
  return found;
}

/** Runs a command with the terminal attached, and returns its exit code. */
export function runAttached(command: string, args: string[]): number {
  const result = spawnSync(command, args, { stdio: "inherit" });
  return result.status ?? 1;
}
