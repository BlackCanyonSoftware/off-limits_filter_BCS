import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Entry } from "../../src/core/policy.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_OK } from "../../src/core/signal.js";

// Runs the built filter as it is used: `some-command | offlimits-filter`. `npm test` builds first.
const FILTER = fileURLToPath(new URL("../../dist/guard-cjs/filter/main.js", import.meta.url));

let dir: string;
let policyFile: string;

function writePolicy(entries: Entry[]): void {
  writeFileSync(policyFile, JSON.stringify({ version: 1, entries }));
}

function runFilter(input: string | Buffer, args: string[] = [], cwd: string = dir) {
  const result = spawnSync(process.execPath, [FILTER, ...args], {
    input,
    cwd,
    env: { ...process.env, OFFLIMITS_POLICY: policyFile, OFFLIMITS_DEBUG: "" },
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    code: result.status,
    stdout: result.stdout.toString("utf8"),
    stderr: result.stderr.toString("utf8"),
  };
}

/** What a failure must look like: nothing on standard output, only the signal, exit 2. */
function expectFailedClosed(result: ReturnType<typeof runFilter>): void {
  expect(result.code).toBe(EXIT_BLOCKED);
  expect(result.stdout).toBe("");
  expect(result.stderr.trim()).toBe(BLOCKED_MESSAGE);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "offlimits-filter-"));
  policyFile = join(dir, "policy.json");
  writePolicy([{ kind: "name", mode: "hide", value: "project-nightingale" }]);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("filter: hiding lines (US-010)", () => {
  it("passes text that touches nothing through unchanged", () => {
    const text = "total 8\ndrwxr-xr-x  src\r\n-rw-r--r--  README.md\nno final newline";
    expect(runFilter(text)).toEqual({ code: EXIT_OK, stdout: text, stderr: "" });
  });

  it("replaces a run of lines that mention an entry with one marker line", () => {
    const input = "a\nProject_Nightingale/one\nproject-nightingale/two\nb\n";
    expect(runFilter(input)).toEqual({
      code: EXIT_OK,
      stdout: "a\n[offlimits:filtered] 2 lines hidden\nb\n",
      stderr: "",
    });
  });

  it("applies only the entries meant for the assistant it is run as", () => {
    writePolicy([
      { kind: "name", mode: "hide", value: "project-nightingale", assistants: ["other"] },
    ]);
    expect(runFilter("project-nightingale\n", ["--assistant", "claude-code"]).stdout).toBe(
      "project-nightingale\n",
    );
    expect(runFilter("project-nightingale\n", ["--assistant", "other"]).stdout).toBe(
      "[offlimits:filtered] 1 line hidden\n",
    );
  });

  it("hides a path entry in a listing", () => {
    writePolicy([{ kind: "path", mode: "forbid", value: join(dir, "private") }]);
    const input = `${join(dir, "private", "notes.md")}\n${join(dir, "public", "a.md")}\n`;
    expect(runFilter(input).stdout).toBe(
      `[offlimits:filtered] 1 line hidden\n${join(dir, "public", "a.md")}\n`,
    );
  });

  it("applies a regular expression line by line", () => {
    writePolicy([{ kind: "regex", mode: "hide", value: "invoice-\\d{4}" }]);
    expect(runFilter("a\ninvoice-2041.pdf\nb\n").stdout).toBe(
      "a\n[offlimits:filtered] 1 line hidden\nb\n",
    );
  });

  it("never shows what it hid, even to a debugging owner", () => {
    const result = runFilter("secret project-nightingale line\n");
    expect(result.stdout.toLowerCase()).not.toContain("nightingale");
    expect(result.stderr).toBe("");
  });

  it("handles empty input", () => {
    expect(runFilter("")).toEqual({ code: EXIT_OK, stdout: "", stderr: "" });
  });
});

describe("filter: failing closed (US-010)", () => {
  it("prints nothing and exits 2 when there is no policy", () => {
    rmSync(policyFile);
    expectFailedClosed(runFilter("project-nightingale\nplain text\n"));
  });

  it.each([
    ["not JSON", "{ nope"],
    ["the wrong shape", JSON.stringify({ version: 1, entries: "x" })],
    ["an unknown version", JSON.stringify({ version: 9, entries: [] })],
    [
      "an entry that is not valid",
      JSON.stringify({ version: 1, entries: [{ kind: "env", mode: "hide", value: "a b" }] }),
    ],
    ["empty", ""],
  ])("prints nothing and exits 2 when the policy is %s", (_name, text) => {
    writeFileSync(policyFile, text);
    expectFailedClosed(runFilter("plain text that must not appear\n"));
  });

  it("hides a regular expression that cannot finish rather than showing the line, and stays quick", () => {
    writePolicy([{ kind: "regex", mode: "forbid", value: "(a+)+$" }]);
    const start = performance.now();
    const result = runFilter(`fine\n${"a".repeat(40)}b\nalso fine\n`);
    expect(result.stdout).toBe("fine\n[offlimits:filtered] 1 line hidden\nalso fine\n");
    expect(result.code).toBe(EXIT_OK);
    expect(performance.now() - start).toBeLessThan(5000);
  });
});

describe("filter: hard inputs", () => {
  it("hides a line too long to check (3 MB), and carries on after it", () => {
    const input = `before\n${"x".repeat(3 * 1024 * 1024)}project-nightingale\nafter\n`;
    expect(runFilter(input).stdout).toBe("before\n[offlimits:filtered] 1 line hidden\nafter\n");
  });

  it("hides a name that falls across the pieces the input arrives in", () => {
    // 200 KB of padding puts the name across an internal chunk boundary.
    const padding = "p".repeat(65_534);
    const input = `${padding}proj${"\n".repeat(0)}ect-nightingale\nok\n`;
    expect(runFilter(input).stdout).toBe("[offlimits:filtered] 1 line hidden\nok\n");
  });

  it("reads text written as UTF-16, as some Windows tools write it", () => {
    const text = Buffer.from("see project-nightingale here\r\nnext\r\n", "utf16le");
    const result = runFilter(text);
    expect(result.code).toBe(EXIT_OK);
    expect(result.stdout.replaceAll("\0", "").toLowerCase()).not.toContain("nightingale");
  });

  it("copes with binary-looking input without failing or showing a hidden line", () => {
    const binary = Buffer.concat([
      Buffer.from([0, 1, 2, 3, 255, 254, 253, 0, 0, 10]),
      Buffer.from("project-nightingale\n"),
      Buffer.from([200, 201, 202, 10]),
    ]);
    const result = runFilter(binary);
    expect(result.code).toBe(EXIT_OK);
    expect(result.stdout).not.toContain("nightingale");
    expect(result.stdout).toContain("[offlimits:filtered] 1 line hidden");
  });

  it("runs from a long working directory, and matches very long paths", ({ skip }) => {
    // Some systems will not start any program from a folder over about 260 characters, however
    // simple the program is, so aim for a long one the system accepts and check it first.
    let deep = dir;
    while (deep.length + 29 <= 250) deep = join(deep, "a-folder-name-of-some-length");
    try {
      mkdirSync(deep, { recursive: true });
    } catch {
      skip(); // This system will not make a path that long.
    }
    const probe = spawnSync(process.execPath, ["-e", "0"], { cwd: deep });
    if (probe.status !== 0) skip(); // Not the filter's doing: a bare Node cannot start there either.

    writePolicy([{ kind: "path", mode: "forbid", value: join(deep, "private") }]);
    const longPath = join(deep, "private", "x".repeat(300), "notes.md");
    const result = runFilter(`a\n${longPath}\nrelative/private/notes.md\nb\n`, [], deep);
    expect(result).toEqual({
      code: EXIT_OK,
      stdout: "a\n[offlimits:filtered] 1 line hidden\nrelative/private/notes.md\nb\n",
      stderr: "",
    });
  });
});

describe("filter: counting (US-011)", () => {
  it("records how many lines it hid, and nothing else", () => {
    runFilter("a\nproject-nightingale\nproject-nightingale\nb\n");
    const log = readFileSync(join(dir, "counts.log"), "utf8").trim();
    expect(log).toMatch(/^\d{4}-\d{2}-\d{2} filtered 2$/u);
    expect(log.toLowerCase()).not.toContain("nightingale");
  });

  it("records nothing when nothing was hidden", () => {
    runFilter("a\nb\n");
    expect(() => readFileSync(join(dir, "counts.log"))).toThrow();
  });

  it("records a failure when it fails closed", () => {
    rmSync(policyFile);
    runFilter("x\n");
    expect(readFileSync(join(dir, "counts.log"), "utf8")).toMatch(/failed 1\n$/u);
  });
});
