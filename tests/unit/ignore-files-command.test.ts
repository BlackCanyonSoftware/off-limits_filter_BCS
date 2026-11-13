import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GENERATED_MARKER } from "../../src/core/ignore.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_ERROR, EXIT_OK } from "../../src/core/signal.js";
import { run } from "../../src/cli/run.js";
import { entry } from "../helpers/context.js";
import { type FakeOptions, fakeDeps, policyOf } from "../helpers/deps.js";

const dir = join("/work", "project");
const withEntries = {
  status: "ok" as const,
  policy: policyOf(
    entry("name", "client-alpha"),
    entry("path", "/work/project/clients/x"),
    entry("env", "TOKEN"),
  ),
};

async function runCli(argv: string[], options: FakeOptions = {}) {
  const fake = fakeDeps({ stored: withEntries, ...options });
  const code = await run(argv, fake.deps);
  return { code, ...fake };
}

describe("ignore-files (US-014)", () => {
  it("refuses without a terminal and writes nothing", async () => {
    const { code, err, files } = await runCli(["ignore-files"], { interactive: false });
    expect(code).toBe(EXIT_BLOCKED);
    expect(err).toEqual([BLOCKED_MESSAGE]);
    expect(files.size).toBe(0);
  });

  it("needs a usable policy", async () => {
    expect((await runCli(["ignore-files"], { stored: { status: "missing" } })).code).toBe(
      EXIT_ERROR,
    );
  });

  it("writes the four files after the owner confirms, each marked as generated", async () => {
    const { code, files, out } = await runCli(["ignore-files"], { answers: ["y"] });
    expect(code).toBe(EXIT_OK);
    for (const name of [".cursorignore", ".geminiignore", ".aiignore", ".agentsignore"]) {
      expect(files.get(join(dir, name))?.startsWith(GENERATED_MARKER)).toBe(true);
    }
    expect(out.join("\n")).toContain("cannot be written as file patterns");
    expect(out.join("\n")).toContain("Commands run in a terminal may still reach them");
  });

  it("writes nothing when the owner declines", async () => {
    const { files, out } = await runCli(["ignore-files"], { answers: ["n"] });
    expect(files.size).toBe(0);
    expect(out).toContain("Nothing changed.");
  });

  it("writes for a folder it is given", async () => {
    const { files } = await runCli(["ignore-files", "/somewhere/else"], { answers: ["y"] });
    // The name entry still gives patterns for any folder, and the path entry is outside it.
    expect(files.has(join("/somewhere/else", ".cursorignore"))).toBe(true);
    expect([...files.keys()].every((path) => path.includes("else"))).toBe(true);
  });

  it("leaves alone a file it did not write, and writes the rest", async () => {
    const foreign = join(dir, ".cursorignore");
    const { files, out } = await runCli(["ignore-files"], {
      answers: ["y"],
      files: new Map([[foreign, "my own rules\n"]]),
    });
    expect(files.get(foreign)).toBe("my own rules\n");
    expect(files.has(join(dir, ".geminiignore"))).toBe(true);
    expect(out.join("\n")).toContain(
      ".cursorignore already exists and was not written by Off-Limits",
    );
  });

  it("replaces a file it wrote earlier", async () => {
    const earlier = join(dir, ".aiignore");
    const { files } = await runCli(["ignore-files"], {
      answers: ["y"],
      files: new Map([[earlier, `${GENERATED_MARKER}\nold\n`]]),
    });
    expect(files.get(earlier)).not.toContain("old\n");
    expect(files.get(earlier)).toContain("[cC][lL]");
  });

  it("says so and writes nothing when no entry can be a file pattern", async () => {
    const { files, out } = await runCli(["ignore-files"], {
      stored: { status: "ok", policy: policyOf(entry("env", "TOKEN")) },
    });
    expect(files.size).toBe(0);
    expect(out).toContain("Nothing to write.");
  });

  it("offers to keep the files out of git, and does so on a yes", async () => {
    const exclude = join(dir, ".git", "info", "exclude");
    const { files, asked } = await runCli(["ignore-files"], {
      answers: ["y", "y"],
      directories: [join(dir, ".git")],
      files: new Map([[exclude, "*.log"]]),
    });
    expect(asked.some((q) => q.includes(".git/info/exclude"))).toBe(true);
    expect(files.get(exclude)).toBe(
      "*.log\n.cursorignore\n.geminiignore\n.aiignore\n.agentsignore\n",
    );
  });

  it("does not add to git's exclude list on a no, or when they are already there", async () => {
    const exclude = join(dir, ".git", "info", "exclude");
    const declined = await runCli(["ignore-files"], {
      answers: ["y", "n"],
      directories: [join(dir, ".git")],
    });
    expect(declined.files.has(exclude)).toBe(false);
    const already = await runCli(["ignore-files"], {
      answers: ["y"],
      directories: [join(dir, ".git")],
      files: new Map([[exclude, ".cursorignore\n.geminiignore\n.aiignore\n.agentsignore\n"]]),
    });
    expect(already.asked.some((q) => q.includes("exclude"))).toBe(false);
  });
});
