import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { Settings } from "../adapters/claude-code/settings.js";

export type SettingsLoad =
  { status: "missing" } | { status: "invalid" } | { status: "ok"; settings: Settings };

export interface SettingsStore {
  readonly path: string;
  load(): SettingsLoad;
  /** Writes the file. The first time it replaces an existing one, a copy is kept beside it. */
  save(settings: Settings): { backup: string | undefined };
}

const BYTE_ORDER_MARK = 0xfeff;

export function createSettingsStore(path: string): SettingsStore {
  return {
    path,

    load() {
      let text: string;
      try {
        text = readFileSync(path, "utf8");
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === "ENOENT"
          ? { status: "missing" }
          : { status: "invalid" };
      }
      try {
        const data: unknown = JSON.parse(
          text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text,
        );
        if (typeof data !== "object" || data === null || Array.isArray(data)) {
          return { status: "invalid" };
        }
        return { status: "ok", settings: data as Settings };
      } catch {
        return { status: "invalid" };
      }
    },

    save(settings) {
      const backup = `${path}.offlimits-backup`;
      let backedUp: string | undefined;
      if (existsSync(path) && !existsSync(backup)) {
        copyFileSync(path, backup);
        backedUp = backup;
      }
      mkdirSync(dirname(path), { recursive: true });
      const temporary = `${path}.${String(process.pid)}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`);
      renameSync(temporary, path);
      return { backup: backedUp };
    },
  };
}
