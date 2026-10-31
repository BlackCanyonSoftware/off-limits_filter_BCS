import { describe, expect, it } from "vitest";
import { mentionsAny } from "../../src/core/match.js";

describe("mentionsAny (US-004)", () => {
  const entries = ["Client Alpha"];

  it.each(["open client_alpha/notes.md", "CLIENT-ALPHA", "list clientalpha", "Client Alpha"])(
    "matches %s",
    (text) => {
      expect(mentionsAny(entries, text)).toBe(true);
    },
  );

  it("does not match unrelated text", () => {
    expect(mentionsAny(entries, "open project-nightingale/readme.md")).toBe(false);
  });

  it("matches when any one entry is mentioned", () => {
    expect(mentionsAny(["project-nightingale", "client-alpha"], "cat client_alpha.txt")).toBe(true);
  });

  it("never matches on an empty or separator-only entry", () => {
    expect(mentionsAny(["", " - "], "anything at all")).toBe(false);
  });

  it("never matches when there are no entries", () => {
    expect(mentionsAny([], "anything at all")).toBe(false);
  });
});
