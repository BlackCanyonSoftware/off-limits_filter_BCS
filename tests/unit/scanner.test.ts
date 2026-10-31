import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileScanner } from "../../src/platform/scanner.js";

let root: string;

function touch(relative: string): void {
  const path = join(root, relative);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "x");
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "offlimits-scan-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("fileScanner", () => {
  it("counts matching files and folders by relative path", async () => {
    touch("client-alpha/a.txt");
    touch("client-alpha/sub/b.txt");
    touch("other/c.txt");
    const result = await fileScanner.scan(root, (path) => path.includes("client-alpha"));
    expect(result).toEqual({ files: 2, directories: 2, truncated: false });
  });

  it("uses forward slashes in the paths it tests", async () => {
    touch("a/b/c.txt");
    const seen: string[] = [];
    await fileScanner.scan(root, (path) => {
      seen.push(path);
      return false;
    });
    expect(seen).toContain("a/b/c.txt");
  });

  it("skips .git and node_modules", async () => {
    touch("node_modules/client-alpha/x.js");
    touch(".git/client-alpha");
    touch("src/y.ts");
    const result = await fileScanner.scan(root, (path) => path.includes("client-alpha"));
    expect(result).toEqual({ files: 0, directories: 0, truncated: false });
  });

  it("copes with a folder that does not exist", async () => {
    const result = await fileScanner.scan(join(root, "missing"), () => true);
    expect(result).toEqual({ files: 0, directories: 0, truncated: false });
  });
});
