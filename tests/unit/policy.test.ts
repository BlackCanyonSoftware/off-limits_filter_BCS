import { describe, expect, it } from "vitest";
import {
  PolicySchema,
  addEntry,
  emptyPolicy,
  findEntryIndex,
  parseEntry,
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
    const result = parseEntry({ kind, mode: "hide", value });
    expect(result.ok).toBe(false);
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
});

describe("PolicySchema", () => {
  it("accepts an empty policy", () => {
    expect(PolicySchema.safeParse(emptyPolicy()).success).toBe(true);
  });

  it("rejects another version and unknown keys", () => {
    expect(PolicySchema.safeParse({ version: 2, entries: [] }).success).toBe(false);
    expect(PolicySchema.safeParse({ version: 1, entries: [], extra: true }).success).toBe(false);
  });

  it("rejects a policy containing an invalid entry", () => {
    const policy = { version: 1, entries: [{ kind: "env", mode: "hide", value: "bad name" }] };
    expect(PolicySchema.safeParse(policy).success).toBe(false);
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
