import { describe, expect, it } from "vitest";
import { containsRun, describePath, fold, isInside, resolveAbsolute } from "../../src/core/path.js";
import { posixContext, windowsContext } from "../helpers/context.js";

describe("describePath", () => {
  it("reads anchoring and segments", () => {
    expect(describePath("/a/b")).toEqual({ absolute: true, segments: ["a", "b"] });
    expect(describePath("C:\\Users\\Kyle")).toEqual({
      absolute: true,
      segments: ["Users", "Kyle"],
    });
    expect(describePath("~/clients/x")).toEqual({ absolute: true, segments: ["clients", "x"] });
    expect(describePath("clients/./x/../y")).toEqual({
      absolute: false,
      segments: ["clients", "y"],
    });
  });

  it("finds nothing to match in a bare root or home", () => {
    expect(describePath("/").segments).toEqual([]);
    expect(describePath("C:\\").segments).toEqual([]);
    expect(describePath("~").segments).toEqual([]);
    expect(describePath(".").segments).toEqual([]);
  });
});

describe("resolveAbsolute", () => {
  it("applies the working directory, home, . and ..", () => {
    const ctx = posixContext({ cwd: "/work/project" });
    expect(resolveAbsolute("src/../lib/./a.ts", ctx)).toBe("/work/project/lib/a.ts");
    expect(resolveAbsolute("../other", ctx)).toBe("/work/other");
    expect(resolveAbsolute("~/notes", ctx)).toBe("/home/kyle/notes");
    expect(resolveAbsolute("/a//b/../c", ctx)).toBe("/a/c");
  });

  it("ignores .. above the root", () => {
    expect(resolveAbsolute("/../../x", posixContext())).toBe("/x");
  });

  it("treats both slashes alike and lower-cases the drive letter", () => {
    const ctx = windowsContext({ cwd: "C:\\Work\\Project" });
    expect(resolveAbsolute("D:\\Data\\..\\Files/x", ctx)).toBe("d:/Files/x");
    expect(resolveAbsolute("src\\a.ts", ctx)).toBe("c:/Work/Project/src/a.ts");
    expect(resolveAbsolute("~\\notes", ctx)).toBe("c:/Users/Kyle/notes");
  });
});

describe("fold", () => {
  it("lower-cases only where the file system ignores case", () => {
    expect(fold("/A/B", posixContext())).toBe("/A/B");
    expect(fold("c:/A/B", windowsContext())).toBe("c:/a/b");
  });
});

describe("isInside", () => {
  it("accepts the base itself and anything below it, on a segment boundary", () => {
    expect(isInside("/a/b", "/a/b")).toBe(true);
    expect(isInside("/a/b/c", "/a/b")).toBe(true);
    expect(isInside("/a/bc", "/a/b")).toBe(false);
    expect(isInside("/a/b/c", "/")).toBe(true);
  });
});

describe("containsRun", () => {
  it("finds a contiguous run of whole segments", () => {
    expect(containsRun(["a", "b", "c"], ["b", "c"])).toBe(true);
    expect(containsRun(["a", "b", "c"], ["a", "c"])).toBe(false);
    expect(containsRun(["ab"], ["a"])).toBe(false);
    expect(containsRun(["a"], [])).toBe(false);
  });
});
