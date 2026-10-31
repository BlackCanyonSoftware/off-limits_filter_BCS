import { describe, expect, it } from "vitest";
import { warningsFor } from "../../src/core/warnings.js";
import { entry } from "../helpers/context.js";

describe("warningsFor (US-005)", () => {
  it("warns about a short entry", () => {
    expect(warningsFor(entry("name", "ab"))).toEqual(["short"]);
  });

  it("counts length after normalising, so separators do not make it longer", () => {
    expect(warningsFor(entry("name", "a-b_c"))).toEqual(["short"]);
  });

  it("warns about a common word", () => {
    expect(warningsFor(entry("name", "Doc"))).toEqual(["short", "common"]);
    expect(warningsFor(entry("name", "Docs"))).toEqual(["common"]);
    expect(warningsFor(entry("name", "project"))).toEqual(["common"]);
  });

  it("stays quiet for a distinctive entry", () => {
    expect(warningsFor(entry("name", "project-nightingale"))).toEqual([]);
  });
});
