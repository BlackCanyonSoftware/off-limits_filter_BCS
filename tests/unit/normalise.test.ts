import { describe, expect, it } from "vitest";
import { normalise } from "../../src/core/normalise.js";

describe("normalise (US-004)", () => {
  it("treats case, spaces, hyphens and underscores as the same", () => {
    const forms = ["Client Alpha", "client_alpha", "CLIENT-ALPHA", "clientalpha"];
    expect(new Set(forms.map(normalise))).toEqual(new Set(["clientalpha"]));
  });

  it("folds compatibility characters such as full-width letters", () => {
    expect(normalise("ＣＬＩＥＮＴ")).toBe("client");
  });

  it("returns an empty string for separators only", () => {
    expect(normalise(" - _ ")).toBe("");
  });
});
