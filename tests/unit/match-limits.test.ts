import { describe, expect, it } from "vitest";
import { decide, entryMatches } from "../../src/core/match.js";
import { entry, posixContext } from "../helpers/context.js";

const filler = (count: number): string =>
  Array.from({ length: count }, (_, i) => `word${String(i)}`).join(" ");

describe("long text", () => {
  const protectedFolder = entry("path", "/home/kyle/clients/client-alpha");

  it("still catches a path that comes after hundreds of other words", () => {
    const text = `${filler(500)} cat /home/kyle/clients/client-alpha/notes.md`;
    expect(entryMatches(protectedFolder, text, posixContext())).toBe(true);
  });

  it("still catches a glob after hundreds of other words", () => {
    const text = `${filler(500)} cat keys/server.pem`;
    expect(entryMatches(entry("glob", "*.pem"), text, posixContext())).toBe(true);
  });

  it("still catches a very long piece of text containing a path", () => {
    const text = `cat /home/kyle/clients/client-alpha/${"x".repeat(5000)}`;
    expect(entryMatches(protectedFolder, text, posixContext())).toBe(true);
  });
});

describe("link lookups", () => {
  it("are shared by every entry in one decision, not repeated for each", () => {
    let lookups = 0;
    const ctx = {
      ...posixContext(),
      realpath: (path: string) => {
        lookups++;
        return path;
      },
    };
    const policy = {
      version: 1 as const,
      entries: [
        entry("path", "/home/kyle/clients/one"),
        entry("path", "/home/kyle/clients/two"),
        entry("glob", "*.pem"),
      ],
    };
    decide(policy, "cat a.txt b.txt", ctx);
    // One lookup for each of the three pieces of text. Per entry it would be nine.
    expect(lookups).toBe(3);
  });

  it("stop at a fixed budget, while plain comparison continues", () => {
    let lookups = 0;
    const ctx = {
      ...posixContext(),
      realpath: (path: string) => {
        lookups++;
        return path;
      },
    };
    entryMatches(entry("path", "/home/kyle/clients/one"), filler(1000), ctx);
    expect(lookups).toBe(200);
  });
});
