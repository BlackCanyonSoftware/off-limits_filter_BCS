import { describe, expect, it } from "vitest";
import { parseHookInput } from "../../src/adapters/claude-code/input.js";

const call = (
  toolName: unknown,
  toolInput?: unknown,
  extra: Record<string, unknown> = {},
): string =>
  JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: toolName,
    tool_input: toolInput,
    ...extra,
  });

describe("parseHookInput", () => {
  it("collects the tool name and every string in the input", () => {
    const result = parseHookInput(call("Bash", { command: "ls src", description: "list" }));
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.text).toContain("Bash");
      expect(result.text).toContain("ls src");
      expect(result.text).toContain("list");
    }
  });

  it("reads file tools, search tools and web tools alike", () => {
    for (const [tool, input, expected] of [
      ["Read", { file_path: "/home/kyle/a.txt" }, "/home/kyle/a.txt"],
      ["Write", { file_path: "/a", content: "body text" }, "body text"],
      ["Edit", { file_path: "/a", old_string: "old", new_string: "new" }, "new"],
      ["Grep", { pattern: "needle", path: "/src" }, "needle"],
      ["Glob", { pattern: "**/*.md" }, "**/*.md"],
      ["WebFetch", { url: "https://example.com", prompt: "read it" }, "https://example.com"],
      ["WebSearch", { query: "a query" }, "a query"],
    ] as const) {
      const result = parseHookInput(call(tool, input));
      expect(result.ok && result.text.includes(expected)).toBe(true);
    }
  });

  it("covers a tool it has never heard of, including its name", () => {
    const result = parseHookInput(
      call("mcp__acme__lookup", { query: "x", nested: { deep: ["y"] } }),
    );
    expect(
      result.ok && ["mcp__acme__lookup", "x", "deep", "y"].every((t) => result.text.includes(t)),
    ).toBe(true);
  });

  it("includes keys and numbers, not only strings", () => {
    const result = parseHookInput(call("Tool", { "some-key": 4821, flag: true, nothing: null }));
    expect(result.ok && result.text.includes("some-key") && result.text.includes("4821")).toBe(
      true,
    );
  });

  it("works with a tool that has no input", () => {
    const result = parseHookInput(JSON.stringify({ tool_name: "ExitPlanMode" }));
    expect(result).toEqual({ ok: true, text: "ExitPlanMode", cwd: undefined });
  });

  it("reads the working directory the assistant is in", () => {
    const withCwd = parseHookInput(call("Bash", { command: "ls" }, { cwd: "/work/project" }));
    expect(withCwd.ok && withCwd.cwd).toBe("/work/project");
    const empty = parseHookInput(call("Bash", { command: "ls" }, { cwd: "" }));
    expect(empty.ok && empty.cwd).toBeUndefined();
  });

  it.each([
    ["text that is not JSON", "not json"],
    ["an empty string", ""],
    ["a JSON array", "[1, 2]"],
    ["JSON null", "null"],
    ["a call with no tool name", JSON.stringify({ tool_input: { command: "ls" } })],
    ["a tool name that is not text", JSON.stringify({ tool_name: 5 })],
  ])("is not ok for %s, so the guard refuses", (_name, raw) => {
    expect(parseHookInput(raw)).toEqual({ ok: false });
  });

  it("is not ok for input nested too deeply to be a real call", () => {
    let nested: unknown = "x";
    for (let i = 0; i < 100; i++) nested = { next: nested };
    expect(parseHookInput(call("Tool", nested))).toEqual({ ok: false });
  });

  it("is not ok for input with an absurd number of pieces", () => {
    const many = Array.from({ length: 210_000 }, () => "a");
    expect(parseHookInput(call("Tool", { many }))).toEqual({ ok: false });
  });
});
