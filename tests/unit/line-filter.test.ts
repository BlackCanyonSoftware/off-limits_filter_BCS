import { describe, expect, it } from "vitest";
import {
  MAX_LINE_LENGTH,
  createLineFilter,
  filteredMarker,
  lineMatcher,
} from "../../src/core/filter.js";
import { filterStream } from "../../src/filter/run.js";
import { entry, posixContext } from "../helpers/context.js";

const hidesSecret = (line: string): boolean => line.includes("SECRET");

/** Runs text through a filter in the given pieces and returns everything it showed. */
function filterAll(
  pieces: string[],
  isHidden: (line: string) => boolean = hidesSecret,
  max?: number,
): { shown: string; hidden: number } {
  const filter = createLineFilter(isHidden, max);
  let shown = "";
  for (const piece of pieces) shown += filter.push(piece);
  shown += filter.end();
  return { shown, hidden: filter.hidden };
}

describe("filteredMarker", () => {
  it("says how many lines, in the singular or plural, and names nothing", () => {
    expect(filteredMarker(1)).toBe("[offlimits:filtered] 1 line hidden\n");
    expect(filteredMarker(3)).toBe("[offlimits:filtered] 3 lines hidden\n");
  });
});

describe("createLineFilter (US-010)", () => {
  it("passes text through exactly when nothing matches", () => {
    const text = "one\ntwo\r\nthree\n\nfour";
    expect(filterAll([text])).toEqual({ shown: text, hidden: 0 });
  });

  it("replaces a matching line with one marker line", () => {
    expect(filterAll(["a\nthe SECRET is here\nb\n"])).toEqual({
      shown: "a\n[offlimits:filtered] 1 line hidden\nb\n",
      hidden: 1,
    });
  });

  it("replaces a run of matching lines with a single marker, and separate runs with separate markers", () => {
    const out = filterAll(["a\nSECRET 1\nSECRET 2\nSECRET 3\nb\nSECRET 4\nc\n"]);
    expect(out.shown).toBe(
      "a\n[offlimits:filtered] 3 lines hidden\nb\n[offlimits:filtered] 1 line hidden\nc\n",
    );
    expect(out.hidden).toBe(4);
  });

  it("handles a run at the very start and the very end", () => {
    expect(filterAll(["SECRET\nSECRET\na\nSECRET"]).shown).toBe(
      "[offlimits:filtered] 2 lines hidden\na\n[offlimits:filtered] 1 line hidden\n",
    );
  });

  it("does not care how the text is cut into pieces", () => {
    const text = "alpha\nbeta SECRET gamma\ndelta\nSECRET\nepsilon";
    const whole = filterAll([text]);
    for (const size of [1, 2, 3, 5, 7, 11]) {
      const pieces = text.match(new RegExp(`[\\s\\S]{1,${String(size)}}`, "g")) ?? [];
      expect(filterAll(pieces)).toEqual(whole);
    }
  });

  it("finds a match that is split across two pieces", () => {
    expect(filterAll(["abc SEC", "RET def\nok\n"]).shown).toBe(
      "[offlimits:filtered] 1 line hidden\nok\n",
    );
  });

  it("shows nothing for empty input, and keeps a missing final newline", () => {
    expect(filterAll([])).toEqual({ shown: "", hidden: 0 });
    expect(filterAll(["no newline at the end"]).shown).toBe("no newline at the end");
  });

  it("hides a line that is too long to keep, and carries on after it", () => {
    const long = "x".repeat(50);
    const out = filterAll(["short\n", long, "more of the same line\nafter\n"], hidesSecret, 20);
    expect(out.shown).toBe("short\n[offlimits:filtered] 1 line hidden\nafter\n");
  });

  it("hides a too-long line even when its end is never reached", () => {
    expect(filterAll(["ok\n", "y".repeat(100)], hidesSecret, 20).shown).toBe(
      "ok\n[offlimits:filtered] 1 line hidden\n",
    );
  });

  it("hides a too-long line that arrives all at once, with its newline", () => {
    expect(filterAll([`${"z".repeat(40)}\nnext\n`], hidesSecret, 20).shown).toBe(
      "[offlimits:filtered] 1 line hidden\nnext\n",
    );
  });

  it("has a sensible default limit", () => {
    expect(MAX_LINE_LENGTH).toBeGreaterThanOrEqual(65_536);
  });

  it("does not catch an exception from the test, so the caller can stop", () => {
    const filter = createLineFilter(() => {
      throw new Error("broken");
    });
    expect(() => filter.push("a\n")).toThrow("broken");
  });
});

describe("lineMatcher", () => {
  const policy = { version: 1 as const, entries: [entry("name", "project-nightingale")] };
  const matches = lineMatcher(policy, posixContext());

  it("matches a line that mentions an entry, however it is spelled", () => {
    expect(matches("drwxr-xr-x  Project_Nightingale")).toBe(true);
    expect(matches("src/project-nightingale/a.ts")).toBe(true);
    expect(matches("nothing to see")).toBe(false);
  });

  it("reads text written as UTF-16, with a NUL after each letter", () => {
    expect(matches("p\0r\0o\0j\0e\0c\0t\0-\0n\0i\0g\0h\0t\0i\0n\0g\0a\0l\0e\0")).toBe(true);
  });

  it("applies only the entries meant for the given assistant", () => {
    const scoped = {
      version: 1 as const,
      entries: [{ ...entry("name", "client-alpha"), assistants: ["other"] }],
    };
    expect(lineMatcher(scoped, posixContext(), "claude-code")("client-alpha")).toBe(false);
    expect(lineMatcher(scoped, posixContext(), "other")("client-alpha")).toBe(true);
    expect(lineMatcher(scoped, posixContext())("client-alpha")).toBe(true);
  });
});

describe("filterStream: never passes text through when something fails (US-010)", () => {
  async function* source(...chunks: string[]): AsyncGenerator<string> {
    await Promise.resolve();
    for (const chunk of chunks) yield chunk;
  }

  it("copies a stream, hiding matching lines", async () => {
    let written = "";
    const result = await filterStream(
      source("a\nSECRET\n", "b\n"),
      (text) => {
        written += text;
        return Promise.resolve();
      },
      hidesSecret,
    );
    expect(result).toEqual({ ok: true, hidden: 1 });
    expect(written).toBe("a\n[offlimits:filtered] 1 line hidden\nb\n");
  });

  it("stops and reports failure when the test throws, writing nothing after", async () => {
    let written = "";
    const result = await filterStream(
      source("fine\n", "this line makes the test throw\n", "never shown\n"),
      (text) => {
        written += text;
        return Promise.resolve();
      },
      (line) => {
        if (line.includes("throw")) throw new Error("crash");
        return false;
      },
    );
    expect(result).toEqual({ ok: false });
    expect(written).toBe("fine\n");
    expect(written).not.toContain("never shown");
  });

  it("reports failure when the input stream breaks", async () => {
    async function* broken(): AsyncGenerator<string> {
      await Promise.resolve();
      yield "before\n";
      throw new Error("pipe closed");
    }
    const result = await filterStream(broken(), () => Promise.resolve(), hidesSecret);
    expect(result).toEqual({ ok: false });
  });

  it("reports failure when writing fails", async () => {
    const result = await filterStream(
      source("a\n"),
      () => Promise.reject(new Error("EPIPE")),
      hidesSecret,
    );
    expect(result).toEqual({ ok: false });
  });
});
