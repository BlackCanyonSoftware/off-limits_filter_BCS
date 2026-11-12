import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { type Policy, parsePolicy } from "../core/policy.js";

export type LoadResult =
  | { status: "missing" }
  | { status: "invalid"; problems: string[] }
  | { status: "ok"; policy: Policy };

export interface PolicyStore {
  readonly path: string;
  load(): LoadResult;
  save(policy: Policy): void;
}

/** The byte order mark some Windows editors add to the front of a UTF-8 file. */
const BYTE_ORDER_MARK = 0xfeff;

const withoutByteOrderMark = (text: string): string =>
  text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text;

/** A policy is a short list of entries; anything bigger is not one. */
const MAX_POLICY_BYTES = 1_000_000;

/**
 * The policy as a JSON file (ADR 0006). Problems are reported as sentences that never include
 * text from the file, because the file is exactly where the owner's names are.
 */
export function createFileStore(path: string): PolicyStore {
  return {
    path,

    load() {
      let text: string;
      try {
        text = readFileSync(path, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: "missing" };
        return { status: "invalid", problems: ["The policy file could not be read."] };
      }
      if (text.length > MAX_POLICY_BYTES) {
        return { status: "invalid", problems: ["The policy file is too large to be a policy."] };
      }

      let data: unknown;
      try {
        data = JSON.parse(withoutByteOrderMark(text));
      } catch {
        return { status: "invalid", problems: ["The policy file is not valid JSON."] };
      }

      const parsed = parsePolicy(data);
      return parsed.ok
        ? { status: "ok", policy: parsed.policy }
        : { status: "invalid", problems: parsed.problems };
    },

    save(policy) {
      // Owner-only on systems that honour modes. On Windows the file inherits the profile
      // folder's access rules, which already limit it to the user (see docs/THREAT-MODEL.md).
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      const temporary = `${path}.${String(process.pid)}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(policy, null, 2)}\n`, { mode: 0o600 });
      renameSync(temporary, path);
    },
  };
}
