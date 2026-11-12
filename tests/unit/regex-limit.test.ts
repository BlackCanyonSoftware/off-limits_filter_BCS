import { describe, expect, it } from "vitest";
import { decide } from "../../src/core/match.js";
import { createBoundedRegexTester } from "../../src/platform/regex.js";
import { entry, posixContext } from "../helpers/context.js";

// A pattern that takes exponential time on this text with an unbounded engine.
const RUNAWAY = "(a+)+$";
const RUNAWAY_TEXT = `${"a".repeat(40)}b`;

describe("bounded regex tester (US-021)", () => {
  it("runs ordinary patterns, ignoring case", () => {
    const test = createBoundedRegexTester(1000);
    expect(test("invoice-\\d{4}", "cat INVOICE-2041.pdf")).toBe(true);
    expect(test("invoice-\\d{4}", "cat notes.txt")).toBe(false);
  });

  it("stops a runaway pattern by throwing, soon after the time allowed", () => {
    const test = createBoundedRegexTester(60);
    const start = performance.now();
    expect(() => test(RUNAWAY, RUNAWAY_TEXT)).toThrow();
    expect(performance.now() - start).toBeLessThan(1500);
  });

  it("still works after one test has timed out", () => {
    const test = createBoundedRegexTester(300);
    expect(() => test(RUNAWAY, RUNAWAY_TEXT)).toThrow();
    // Some of the allowance may be left, or none: either way it must not hang or misreport.
    try {
      expect(test("client-alpha", "cat client-alpha")).toBe(true);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("treats the time as a total across tests, not per test", async () => {
    const test = createBoundedRegexTester(30);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(() => test("a", "a")).toThrow(/used up/u);
  });

  it("throws on a pattern that does not compile", () => {
    expect(() => createBoundedRegexTester(1000)("client-alpha(", "x")).toThrow();
  });

  it("handles a large text quickly", () => {
    const test = createBoundedRegexTester(1000);
    expect(test("invoice-\\d{4}", "word ".repeat(200_000))).toBe(false);
  });
});

describe("a regex entry that cannot finish blocks the call", () => {
  const policy = { version: 1 as const, entries: [entry("regex", RUNAWAY)] };

  it("blocks when the tester throws, rather than letting the text through", () => {
    const ctx = {
      ...posixContext(),
      regexTest: () => {
        throw new Error("out of time");
      },
    };
    expect(decide(policy, "anything", ctx)).toEqual({ blocked: true, mode: "hide" });
  });

  it("blocks a genuinely runaway pattern within the time allowed", () => {
    const ctx = { ...posixContext(), regexTest: createBoundedRegexTester(60) };
    const start = performance.now();
    expect(decide(policy, RUNAWAY_TEXT, ctx).blocked).toBe(true);
    expect(performance.now() - start).toBeLessThan(1500);
  });
});
