/** The name this assistant goes by in an entry's `assistants` list. */
export const ASSISTANT_ID = "claude-code";

export type HookInput = { ok: true; text: string; cwd: string | undefined } | { ok: false };

const MAX_DEPTH = 32;
const MAX_PIECES = 200_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

class TooComplex extends Error {}

/**
 * Reads what Claude Code sends a PreToolUse hook (a JSON object with `tool_name`, `tool_input` and
 * `cwd`) and turns it into the text to check: the tool's name and every string, key and number
 * inside its input, whatever the tool. Taking everything means a tool this code has never heard
 * of, or an MCP tool, is covered too. Anything unexpected is not ok, and the guard refuses.
 */
export function parseHookInput(raw: string): HookInput {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (!isRecord(data) || typeof data.tool_name !== "string") return { ok: false };

  const pieces: string[] = [data.tool_name];
  const walk = (value: unknown, depth: number): void => {
    if (depth > MAX_DEPTH || pieces.length > MAX_PIECES) throw new TooComplex();
    if (typeof value === "string") {
      pieces.push(value);
    } else if (typeof value === "number") {
      pieces.push(String(value));
    } else if (Array.isArray(value)) {
      for (const item of value as unknown[]) walk(item, depth + 1);
    } else if (isRecord(value)) {
      for (const [key, item] of Object.entries(value)) {
        pieces.push(key);
        walk(item, depth + 1);
      }
    }
  };
  try {
    walk(data.tool_input, 0);
  } catch (error) {
    if (error instanceof TooComplex) return { ok: false };
    throw error;
  }

  const cwd = typeof data.cwd === "string" && data.cwd !== "" ? data.cwd : undefined;
  return { ok: true, text: pieces.join("\n"), cwd };
}
