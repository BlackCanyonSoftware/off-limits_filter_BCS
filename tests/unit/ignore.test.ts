import { describe, expect, it } from "vitest";
import {
  GENERATED_MARKER,
  IGNORE_TARGETS,
  ignorePatterns,
  renderIgnoreFile,
} from "../../src/core/ignore.js";
import type { Policy } from "../../src/core/policy.js";
import { entry, posixContext } from "../helpers/context.js";

const policyOf = (...entries: Policy["entries"]): Policy => ({ version: 1, entries });
const ctx = posixContext({ cwd: "/work/project" });

describe("ignorePatterns (US-014)", () => {
  it("writes a name as patterns that ignore capitals and separators", () => {
    const { lines } = ignorePatterns(policyOf(entry("name", "client-alpha")), "/work/project", ctx);
    expect(lines).toEqual([
      "*[cC][lL][iI][eE][nN][tT][-_ ][aA][lL][pP][hH][aA]*",
      "*[cC][lL][iI][eE][nN][tT][aA][lL][pP][hH][aA]*",
    ]);
  });

  it("writes a one-word name once", () => {
    expect(
      ignorePatterns(policyOf(entry("name", "nightingale")), "/work/project", ctx).lines,
    ).toHaveLength(1);
  });

  it("escapes characters a pattern would treat specially", () => {
    const { lines } = ignorePatterns(policyOf(entry("name", "a[1]!#")), "/work/project", ctx);
    expect(lines[0]).toBe("*[aA]\\[1\\]\\!\\#*");
  });

  it("writes an absolute path inside the folder as an anchored folder pattern", () => {
    const { lines, skipped } = ignorePatterns(
      policyOf(entry("path", "/work/project/clients/client-alpha")),
      "/work/project",
      ctx,
    );
    expect(lines).toEqual(["/clients/client-alpha/"]);
    expect(skipped.outsideFolder).toBe(0);
  });

  it("leaves out a path outside the folder, and counts it", () => {
    const { lines, skipped } = ignorePatterns(
      policyOf(
        entry("path", "/home/kyle/clients/client-alpha"),
        entry("path", "/work/project-two/x"),
      ),
      "/work/project",
      ctx,
    );
    expect(lines).toEqual([]);
    expect(skipped.outsideFolder).toBe(2);
  });

  it("writes a relative path to match anywhere", () => {
    expect(
      ignorePatterns(policyOf(entry("path", "clients/client-alpha")), "/work/project", ctx).lines,
    ).toEqual(["**/clients/client-alpha/"]);
  });

  it("passes a relative glob through, and leaves out an absolute one", () => {
    const { lines, skipped } = ignorePatterns(
      policyOf(entry("glob", "*.pem"), entry("glob", "~/keys/*"), entry("glob", "/etc/*")),
      "/work/project",
      ctx,
    );
    expect(lines).toEqual(["*.pem"]);
    expect(skipped.outsideFolder).toBe(2);
  });

  it("counts entries that cannot be file patterns", () => {
    const { lines, skipped } = ignorePatterns(
      policyOf(
        entry("env", "TOKEN"),
        entry("host", "a.example.com"),
        entry("command", "curl"),
        entry("conversation", "c-1"),
        entry("regex", "x+"),
      ),
      "/work/project",
      ctx,
    );
    expect(lines).toEqual([]);
    expect(skipped.notFiles).toBe(5);
  });

  it("writes each pattern once, even when entries overlap", () => {
    const { lines } = ignorePatterns(
      policyOf(entry("name", "client-alpha"), entry("name", "Client_Alpha")),
      "/work/project",
      ctx,
    );
    expect(lines).toHaveLength(2);
  });
});

describe("renderIgnoreFile", () => {
  const target = IGNORE_TARGETS[0];
  it("has the four targets other assistants read", () => {
    expect(IGNORE_TARGETS.map((t) => t.file)).toEqual([
      ".cursorignore",
      ".geminiignore",
      ".aiignore",
      ".agentsignore",
    ]);
  });

  it("marks the file as ours, says what it covers and does not, and warns that it holds the entries", () => {
    if (!target) throw new Error("no target");
    const text = renderIgnoreFile(target, {
      lines: ["a/", "*.pem"],
      skipped: { notFiles: 0, outsideFolder: 0 },
    });
    expect(text.startsWith(GENERATED_MARKER)).toBe(true);
    expect(text).toContain("Cursor");
    expect(text).toContain("listings, search and context");
    expect(text).toContain("may still reach them");
    expect(text).toContain("plain text");
    expect(text).toContain("\na/\n*.pem\n");
  });

  it("names no entry in its header, so a made-up name appears only in the patterns", () => {
    if (!target) throw new Error("no target");
    const text = renderIgnoreFile(target, {
      lines: [],
      skipped: { notFiles: 0, outsideFolder: 0 },
    });
    expect(text.toLowerCase()).not.toMatch(/client|alpha/u);
  });
});
