import { describe, expect, it } from "vitest";
import { run } from "../../src/cli/run.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_ERROR, EXIT_OK } from "../../src/core/signal.js";
import type { ContentScan } from "../../src/platform/content-scanner.js";
import { entry } from "../helpers/context.js";
import { type FakeOptions, fakeDeps, policyOf } from "../helpers/deps.js";

const stored = { status: "ok" as const, policy: policyOf(entry("name", "client-alpha")) };

async function runCli(argv: string[], options: FakeOptions = {}) {
  const fake = fakeDeps({ stored, ...options });
  const code = await run(argv, fake.deps);
  return { code, ...fake };
}

const scan = (hits: ContentScan["hits"], extra: Partial<ContentScan> = {}): ContentScan => ({
  hits,
  filesRead: 40,
  truncated: false,
  ...extra,
});

describe("scan (US-015)", () => {
  it("refuses without a terminal and prints nothing", async () => {
    const { code, out, err } = await runCli(["scan"], { interactive: false });
    expect(code).toBe(EXIT_BLOCKED);
    expect(out).toEqual([]);
    expect(err).toEqual([BLOCKED_MESSAGE]);
  });

  it("needs a usable policy", async () => {
    expect((await runCli(["scan"], { stored: { status: "missing" } })).code).toBe(EXIT_ERROR);
  });

  it("says when nothing mentions the entries", async () => {
    const { code, out } = await runCli(["scan"], { contentScan: scan([]) });
    expect(code).toBe(EXIT_OK);
    expect(out.join("\n")).toContain("Looked at 40 files");
    expect(out.join("\n")).toContain("None of them mention your entries.");
  });

  it("lists where entries appear, by file and line, and by file name", async () => {
    const { out } = await runCli(["scan"], {
      contentScan: scan([
        { path: "docs/notes.md", nameMatches: false, lines: [3, 18, 40], total: 3 },
        { path: "src/config.ts", nameMatches: false, lines: [7], total: 1 },
        { path: "client-alpha.md", nameMatches: true, lines: [], total: 0 },
        { path: "big.log", nameMatches: false, lines: [1, 2], total: 50 },
      ]),
    });
    const text = out.join("\n");
    expect(text).toContain("Files that mention your entries: 4");
    expect(text).toContain("docs/notes.md  (lines 3, 18, 40)");
    expect(text).toContain("src/config.ts  (line 7)");
    expect(text).toContain("client-alpha.md  (the file's own name)");
    expect(text).toContain("big.log  (lines 1, 2, and 48 more)");
  });

  it("shows only the first files, and says how many more", async () => {
    const hits = Array.from({ length: 20 }, (_, i) => ({
      path: `f${String(i)}.md`,
      nameMatches: false,
      lines: [1],
      total: 1,
    }));
    const { out } = await runCli(["scan"], { contentScan: scan(hits) });
    expect(out.join("\n")).toContain("and 5 more files");
  });

  it("says when the scan stopped at its limit", async () => {
    const { out } = await runCli(["scan"], { contentScan: scan([], { truncated: true }) });
    expect(out.join("\n")).toContain("stopped at the limit");
  });

  it("looks in git history: counts message lines and shows matching paths", async () => {
    const { out } = await runCli(["scan"], {
      contentScan: scan([]),
      history: {
        messageLines: ["add feature", "notes about client-alpha", "CLIENT_ALPHA again", "fix bug"],
        paths: ["old/Client-Alpha/notes.md", "src/index.ts"],
      },
    });
    const text = out.join("\n");
    expect(text).toContain("In git history: 2 commit message lines, 1 file path.");
    expect(text).toContain("old/Client-Alpha/notes.md");
    expect(text).not.toContain("src/index.ts");
  });

  it("says when there is no history, and always ends with how to tidy up", async () => {
    const { out } = await runCli(["scan"], { contentScan: scan([]) });
    expect(out.join("\n")).toContain("no git history here");
    expect(out.join("\n")).toContain("Reword or remove it in your files");
  });
});

describe("type-ahead at the add prompt (US-016)", () => {
  it("offers names from the folder, and only when the value is not given", async () => {
    const asked = await runCli(["add"], {
      suggestions: ["clients", "docs", "notes.md"],
      answers: ["clients", "n"],
    });
    expect(asked.suggestionsGiven[0]).toEqual(["clients", "docs", "notes.md"]);
    const given = await runCli(["add", "clients"], { suggestions: ["clients"], answers: ["n"] });
    expect(given.suggestionsGiven).not.toContainEqual(["clients"]);
  });
});
