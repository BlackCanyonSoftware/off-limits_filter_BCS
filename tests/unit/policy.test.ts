import { describe, expect, it } from "vitest";
import {
  addEntry,
  emptyPolicy,
  findEntryIndex,
  parseEntry,
  parsePolicy,
  removeEntryAt,
} from "../../src/core/policy.js";
import { entry } from "../helpers/context.js";

describe("parseEntry", () => {
  it("accepts a complete entry and trims the value", () => {
    const result = parseEntry({
      kind: "name",
      mode: "hide",
      value: "  client-alpha ",
      assistants: ["claude-code"],
      note: "private",
    });
    expect(result).toEqual({
      ok: true,
      entry: {
        kind: "name",
        mode: "hide",
        value: "client-alpha",
        assistants: ["claude-code"],
        note: "private",
      },
    });
  });

  it("accepts an entry with only the required fields", () => {
    expect(parseEntry({ kind: "host", mode: "forbid", value: "internal.example.com" })).toEqual({
      ok: true,
      entry: { kind: "host", mode: "forbid", value: "internal.example.com" },
    });
  });

  it.each([
    ["env", "not a name"],
    ["env", "1ABC"],
    ["host", "has space.com"],
    ["host", "-bad.example.com"],
    ["regex", "client-alpha("],
    ["name", " - _ "],
    ["path", "/"],
    ["path", "~"],
    ["glob", "**"],
    ["glob", "*/"],
  ] as const)("rejects a %s entry with the value %j", (kind, value) => {
    expect(parseEntry({ kind, mode: "hide", value }).ok).toBe(false);
  });

  it("never repeats the rejected value in its reasons (names stay out)", () => {
    const result = parseEntry({ kind: "regex", mode: "hide", value: "client-alpha(" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(" ").toLowerCase()).not.toContain("alpha");
  });

  it("rejects an unknown kind, mode or field", () => {
    expect(parseEntry({ kind: "folder", mode: "hide", value: "x" }).ok).toBe(false);
    expect(parseEntry({ kind: "name", mode: "block", value: "x" }).ok).toBe(false);
    expect(parseEntry({ kind: "name", mode: "hide", value: "x", extra: 1 }).ok).toBe(false);
  });

  it.each([
    ["a missing value", { kind: "name", mode: "hide" }],
    ["a non-text value", { kind: "name", mode: "hide", value: 5 }],
    ["an empty value", { kind: "name", mode: "hide", value: "   " }],
    ["a value that is too long", { kind: "name", mode: "hide", value: "x".repeat(501) }],
    ["an empty assistants list", { kind: "name", mode: "hide", value: "x", assistants: [] }],
    ["assistants that are not text", { kind: "name", mode: "hide", value: "x", assistants: [1] }],
    ["assistants that are not a list", { kind: "name", mode: "hide", value: "x", assistants: "a" }],
    ["a note that is not text", { kind: "name", mode: "hide", value: "x", note: 1 }],
    ["a note that is too long", { kind: "name", mode: "hide", value: "x", note: "n".repeat(501) }],
  ])("rejects %s", (_name, input) => {
    expect(parseEntry(input).ok).toBe(false);
  });

  it.each([null, undefined, "text", 5, [], [1]])("rejects %j as an entry", (input) => {
    expect(parseEntry(input).ok).toBe(false);
  });
});

describe("parsePolicy", () => {
  it("accepts an empty policy", () => {
    expect(parsePolicy(emptyPolicy())).toEqual({ ok: true, policy: emptyPolicy() });
  });

  it("accepts a policy with entries", () => {
    const policy = { version: 1, entries: [entry("name", "client-alpha")] };
    expect(parsePolicy(policy)).toEqual({ ok: true, policy });
  });

  it("rejects another version, unknown fields, and the wrong shape", () => {
    expect(parsePolicy({ version: 2, entries: [] }).ok).toBe(false);
    expect(parsePolicy({ version: 1, entries: [], extra: true }).ok).toBe(false);
    expect(parsePolicy({ version: 1 }).ok).toBe(false);
    expect(parsePolicy({ version: 1, entries: "x" }).ok).toBe(false);
    expect(parsePolicy("a string").ok).toBe(false);
    expect(parsePolicy(null).ok).toBe(false);
  });

  it("rejects a policy with too many entries", () => {
    const entries = Array.from({ length: 1001 }, (_, i) =>
      entry("name", `entry-number-${String(i)}`),
    );
    expect(parsePolicy({ version: 1, entries }).ok).toBe(false);
  });

  it("names the position of a bad entry without repeating anything from it (names stay out)", () => {
    const result = parsePolicy({
      version: 1,
      entries: [
        entry("name", "client-alpha"),
        { kind: "env", mode: "hide", value: "client alpha" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const text = result.problems.join(" ");
      expect(text).toContain("entries.1");
      expect(text.toLowerCase()).not.toContain("alpha");
    }
  });
});

describe("addEntry, removeEntryAt, findEntryIndex", () => {
  it("adds an entry without changing the original policy", () => {
    const before = emptyPolicy();
    const result = addEntry(before, entry("name", "client-alpha"));
    expect(result.ok).toBe(true);
    expect(before.entries).toEqual([]);
    if (result.ok) expect(result.policy.entries).toHaveLength(1);
  });

  it("refuses a duplicate, treating name spellings as the same", () => {
    const first = addEntry(emptyPolicy(), entry("name", "Client Alpha"));
    if (!first.ok) throw new Error("setup failed");
    expect(addEntry(first.policy, entry("name", "client_alpha"))).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });

  it("allows the same value under a different kind", () => {
    const first = addEntry(emptyPolicy(), entry("name", "client-alpha"));
    if (!first.ok) throw new Error("setup failed");
    expect(addEntry(first.policy, entry("host", "client-alpha")).ok).toBe(true);
  });

  it("removes by position and ignores a position out of range", () => {
    const policy = {
      version: 1 as const,
      entries: [entry("name", "client-alpha"), entry("name", "project-nightingale")],
    };
    expect(removeEntryAt(policy, 0).entries.map((e) => e.value)).toEqual(["project-nightingale"]);
    expect(removeEntryAt(policy, 5).entries).toHaveLength(2);
  });

  it("finds an entry by value, ignoring case and name separators", () => {
    const policy = {
      version: 1 as const,
      entries: [entry("name", "Client Alpha"), entry("host", "internal.example.com")],
    };
    expect(findEntryIndex(policy, "client_alpha")).toBe(0);
    expect(findEntryIndex(policy, "INTERNAL.example.com")).toBe(1);
    expect(findEntryIndex(policy, "nothing")).toBe(-1);
  });
});
