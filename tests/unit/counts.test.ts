import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../../src/cli/run.js";
import { EXIT_OK } from "../../src/core/signal.js";
import { readCounts, recordEvent } from "../../src/platform/counts.js";
import { countsPath } from "../../src/platform/paths.js";
import { createBoundedRegexTester } from "../../src/platform/regex.js";
import { fakeDeps } from "../helpers/deps.js";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "offlimits-counts-"));
  file = join(dir, "counts.log");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("audit counts (US-011)", () => {
  it("is empty when there is no file", () => {
    expect(readCounts(file)).toEqual({ blocked: 0, filtered: 0, failed: 0, since: undefined });
  });

  it("adds up the events it was given", () => {
    recordEvent(file, "blocked");
    recordEvent(file, "blocked");
    recordEvent(file, "filtered", 5);
    recordEvent(file, "failed");
    const counts = readCounts(file);
    expect(counts).toMatchObject({ blocked: 2, filtered: 5, failed: 1 });
    expect(counts.since).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });

  it("writes only a date, a kind and a number, never anything else", () => {
    recordEvent(file, "blocked");
    recordEvent(file, "filtered", 12);
    for (const line of readFileSync(file, "utf8").trim().split("\n")) {
      expect(line).toMatch(/^\d{4}-\d{2}-\d{2} (blocked|filtered|failed) \d+$/u);
    }
  });

  it("skips lines that are not events, and reads the first date as the start", () => {
    writeFileSync(file, "garbage\n2026-01-02 blocked 3\n\n2026-02-01 filtered 4\nnot an event 5\n");
    expect(readCounts(file)).toEqual({ blocked: 3, filtered: 4, failed: 0, since: "2026-01-02" });
  });

  it("never throws when it cannot write, because counting must not change a decision", () => {
    expect(() => {
      recordEvent(join(dir, "no", "such", "folder", "counts.log"), "blocked");
    }).not.toThrow();
  });

  it("lives beside the policy file", () => {
    expect(countsPath({}, "linux", "/home/kyle")).toBe("/home/kyle/.config/offlimits/counts.log");
    expect(countsPath({ OFFLIMITS_POLICY: "/tmp/x/policy.json" }, "linux", "/home/kyle")).toBe(
      "/tmp/x/counts.log",
    );
  });
});

describe("count command", () => {
  it("shows the numbers and the date, and runs without a terminal", async () => {
    const fake = fakeDeps({
      interactive: false,
      counts: { blocked: 4, filtered: 17, failed: 1, since: "2026-11-12" },
    });
    expect(await run(["count"], fake.deps)).toBe(EXIT_OK);
    expect(fake.out).toEqual([
      "Counting since 2026-11-12.",
      "Tool calls refused: 4",
      "Lines hidden by the filter: 17",
      "Calls refused because a check could not be made: 1",
    ]);
  });

  it("says so when there is nothing yet", async () => {
    const fake = fakeDeps();
    await run(["count"], fake.deps);
    expect(fake.out).toEqual(["Nothing has been refused or hidden yet."]);
  });
});

describe("per-test regex limit (the filter's)", () => {
  it("stops one runaway test without a total limit, and lets later tests run", () => {
    const test = createBoundedRegexTester({ eachMs: 150 });
    expect(() => test("(a+)+$", `${"a".repeat(40)}b`)).toThrow();
    expect(test("client-alpha", "cat client-alpha")).toBe(true);
    expect(test("client-alpha", "cat something-else")).toBe(false);
  });

  it("has no total limit, so many ordinary tests all run", () => {
    // A generous limit for each test: this checks there is no total, not how fast one test is.
    const test = createBoundedRegexTester({ eachMs: 2000 });
    for (let i = 0; i < 300; i++) expect(test("a", "a")).toBe(true);
  });
});
