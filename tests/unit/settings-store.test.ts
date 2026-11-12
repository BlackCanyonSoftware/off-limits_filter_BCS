import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSettingsStore } from "../../src/platform/claude-settings.js";
import { claudeSettingsFiles, claudeSettingsPath } from "../../src/platform/paths.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "offlimits-settings-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("Claude Code settings store", () => {
  it("reports a missing file", () => {
    expect(createSettingsStore(join(dir, "settings.json")).load()).toEqual({ status: "missing" });
  });

  it("reads an object, with or without a byte order mark", () => {
    const path = join(dir, "settings.json");
    writeFileSync(path, JSON.stringify({ model: "m" }));
    expect(createSettingsStore(path).load()).toEqual({ status: "ok", settings: { model: "m" } });
    writeFileSync(path, `${String.fromCharCode(0xfeff)}${JSON.stringify({ model: "m" })}`);
    expect(createSettingsStore(path).load().status).toBe("ok");
  });

  it.each([
    ["not JSON", "{ model: "],
    ["an array", "[1]"],
    ["null", "null"],
    ["a string", '"x"'],
  ])("reports %s as invalid, so nothing is rewritten", (_name, text) => {
    const path = join(dir, "settings.json");
    writeFileSync(path, text);
    expect(createSettingsStore(path).load()).toEqual({ status: "invalid" });
  });

  it("keeps a copy of the original the first time it replaces a file, and only then", () => {
    const path = join(dir, "settings.json");
    writeFileSync(path, '{"model":"original"}');
    const store = createSettingsStore(path);

    const first = store.save({ model: "one" });
    expect(first.backup).toBe(`${path}.offlimits-backup`);
    expect(readFileSync(`${path}.offlimits-backup`, "utf8")).toBe('{"model":"original"}');

    const second = store.save({ model: "two" });
    expect(second.backup).toBeUndefined();
    expect(readFileSync(`${path}.offlimits-backup`, "utf8")).toBe('{"model":"original"}');
    expect(store.load()).toEqual({ status: "ok", settings: { model: "two" } });
  });

  it("creates the folder and file when there were none, with no backup", () => {
    const path = join(dir, ".claude", "settings.json");
    expect(createSettingsStore(path).save({ a: 1 })).toEqual({ backup: undefined });
    expect(readFileSync(path, "utf8")).toBe('{\n  "a": 1\n}\n');
  });

  it("leaves no temporary file behind", () => {
    const path = join(dir, "settings.json");
    mkdirSync(dir, { recursive: true });
    createSettingsStore(path).save({ a: 1 });
    expect(readdirSync(dir)).toEqual(["settings.json"]);
  });
});

describe("settings paths", () => {
  it("uses CLAUDE_CONFIG_DIR when set, and ~/.claude otherwise", () => {
    expect(claudeSettingsPath({ CLAUDE_CONFIG_DIR: "/custom" }, "linux", "/home/kyle")).toBe(
      "/custom/settings.json",
    );
    expect(claudeSettingsPath({}, "linux", "/home/kyle")).toBe("/home/kyle/.claude/settings.json");
    expect(claudeSettingsPath({}, "win32", "C:\\Users\\Kyle")).toBe(
      "C:\\Users\\Kyle\\.claude\\settings.json",
    );
  });

  it("lists the user's file and each project folder's shared and local files, once", () => {
    expect(
      claudeSettingsFiles({}, "linux", "/home/kyle", ["/work/p", "/work/p", "/work/q"]),
    ).toEqual([
      "/home/kyle/.claude/settings.json",
      "/work/p/.claude/settings.json",
      "/work/p/.claude/settings.local.json",
      "/work/q/.claude/settings.json",
      "/work/q/.claude/settings.local.json",
    ]);
  });
});
