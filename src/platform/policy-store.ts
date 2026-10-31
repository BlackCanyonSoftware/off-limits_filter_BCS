import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import YAML from "yaml";
import { type Policy, PolicySchema } from "../core/policy.js";

export type LoadResult =
  | { status: "missing" }
  | { status: "invalid"; problems: string[] }
  | { status: "ok"; policy: Policy };

export interface PolicyStore {
  readonly path: string;
  load(): LoadResult;
  save(policy: Policy): void;
}

const HEADER = `# Your Off-Limits policy: what your AI assistants may not see or touch.
# This list is private. Change it with \`offlimits add\`, \`list\` and \`remove\`.
`;

/**
 * The policy as a YAML file. Problems are reported as sentences that never include text from
 * the file, because the file is exactly where the owner's names are.
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

      let data: unknown;
      try {
        data = YAML.parse(text, { maxAliasCount: 0 });
      } catch {
        return { status: "invalid", problems: ["The policy file is not valid YAML."] };
      }

      const parsed = PolicySchema.safeParse(data);
      if (parsed.success) return { status: "ok", policy: parsed.data };
      return {
        status: "invalid",
        problems: parsed.error.issues.map(
          (issue) => `${issue.path.join(".") || "policy"}: ${issue.message}`,
        ),
      };
    },

    save(policy) {
      // Owner-only on systems that honour modes. On Windows the file inherits the profile
      // folder's access rules, which already limit it to the user (see docs/THREAT-MODEL.md).
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      const temporary = `${path}.${String(process.pid)}.tmp`;
      writeFileSync(temporary, HEADER + YAML.stringify(policy), { mode: 0o600 });
      renameSync(temporary, path);
    },
  };
}
