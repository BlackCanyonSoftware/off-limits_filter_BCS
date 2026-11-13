import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lineMatcher } from "../../src/core/filter.js";
import { IGNORE_TARGETS, ignorePatterns, renderIgnoreFile } from "../../src/core/ignore.js";
import type { Policy } from "../../src/core/policy.js";
import { contentScanner } from "../../src/platform/content-scanner.js";
import { createMatchContext } from "../../src/platform/context.js";
import { readHistory } from "../../src/platform/git-history.js";
import { suggestNames } from "../../src/platform/suggestions.js";

let dir: string;
const git = (...args: string[]) =>
  spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", windowsHide: true });
const put = (relative: string, text: string | Buffer): void => {
  mkdirSync(join(dir, relative, ".."), { recursive: true });
  writeFileSync(join(dir, relative), text);
};

const policy: Policy = {
  version: 1,
  entries: [{ kind: "name", mode: "hide", value: "client-alpha" }],
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "offlimits-m5-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("generated ignore patterns, checked by git itself (US-014)", () => {
  it("hide the files and folders they are meant to, and nothing else", () => {
    const entries: Policy["entries"] = [
      { kind: "name", mode: "hide", value: "client-alpha" },
      { kind: "path", mode: "forbid", value: join(dir, "clients", "private") },
      { kind: "glob", mode: "hide", value: "*.pem" },
    ];
    const { lines } = ignorePatterns(
      { version: 1, entries },
      dir,
      createMatchContext({ cwd: dir }),
    );
    const target = IGNORE_TARGETS[0];
    if (!target) throw new Error("no target");
    expect(git("init", "-q").status).toBe(0);
    put(
      ".gitignore",
      renderIgnoreFile(target, { lines, skipped: { notFiles: 0, outsideFolder: 0 } }),
    );

    const ignored = (path: string): boolean => git("check-ignore", "-q", path).status === 0;
    for (const hidden of [
      "Client_Alpha/notes.md",
      "CLIENT-ALPHA.txt",
      "clientalpha/x",
      "docs/client alpha.md",
      "clients/private/a.md",
      "keys/server.pem",
    ]) {
      expect(ignored(hidden), hidden).toBe(true);
    }
    for (const shown of ["src/index.ts", "clients/public/a.md", "README.md", "keys/server.pub"]) {
      expect(ignored(shown), shown).toBe(false);
    }
  });
});

describe("content scanner (US-015)", () => {
  it("finds entries by file name and by line, with line numbers", async () => {
    put("notes.md", "one\nsee client-alpha here\nthree\nCLIENT_ALPHA again\n");
    put("src/client-alpha-config.json", "{}");
    put("clean.txt", "nothing here\n");
    const scan = await contentScanner.scan(
      dir,
      lineMatcher(policy, createMatchContext({ cwd: dir, followLinks: false })),
    );
    const byPath = new Map(scan.hits.map((hit) => [hit.path, hit]));
    expect(byPath.get("notes.md")).toMatchObject({ lines: [2, 4], total: 2, nameMatches: false });
    expect(byPath.get("src/client-alpha-config.json")).toMatchObject({
      nameMatches: true,
      total: 0,
    });
    expect(byPath.has("clean.txt")).toBe(false);
    expect(scan.filesRead).toBe(3);
  });

  it("leaves out git, dependencies, build output, binary files and very large files", async () => {
    put(".git/HEAD", "client-alpha");
    put("node_modules/p/index.js", "client-alpha");
    put("dist/out.js", "client-alpha");
    put("image.bin", Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from("client-alpha")]));
    put("huge.txt", `client-alpha\n${"x".repeat(1_100_000)}`);
    const scan = await contentScanner.scan(
      dir,
      lineMatcher(policy, createMatchContext({ cwd: dir, followLinks: false })),
    );
    expect(scan.hits).toEqual([]);
  });
});

describe("git history reader (US-015)", () => {
  it("reads commit messages and every path that was ever committed, once", () => {
    if (git("init", "-q").status !== 0) return;
    git("config", "user.email", "test@example.invalid");
    git("config", "user.name", "Test");
    put("old/client-alpha-notes.md", "a");
    git("add", "-A");
    expect(git("commit", "-q", "-m", "add notes for client-alpha").status).toBe(0);
    put("old/client-alpha-notes.md", "b");
    git("rm", "-q", "-r", "--cached", "old");
    git("commit", "-q", "-m", "remove them");
    const history = readHistory(dir);
    expect(history?.messageLines).toContain("add notes for client-alpha");
    expect(history?.paths).toEqual(["old/client-alpha-notes.md"]);
  });

  it("is undefined for a folder that is not a repository", () => {
    expect(readHistory(dir)).toBeUndefined();
  });
});

describe("name suggestions (US-016)", () => {
  it("offers the names of files and folders, and of what is just inside folders, sorted", () => {
    put("clients/client-alpha/notes.md", "x");
    put("docs/readme.md", "x");
    put("top.txt", "x");
    put("node_modules/p/i.js", "x");
    put(".git/HEAD", "x");
    // Only the folder itself and what is just inside its folders: notes.md is one level too deep.
    expect(suggestNames(dir)).toEqual(["client-alpha", "clients", "docs", "readme.md", "top.txt"]);
  });

  it("copes with a folder that does not exist", () => {
    expect(suggestNames(join(dir, "missing"))).toEqual([]);
  });
});
