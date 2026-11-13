import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXIT_OK } from "../../src/core/signal.js";
import { createFixture, createRunner } from "../../src/platform/selftest.js";
import { WORKAROUND_CLASSES } from "../../src/selftest/classes.js";
import { runSelfTest } from "../../src/selftest/run.js";

const dist = (path: string): string =>
  fileURLToPath(new URL(`../../dist/${path}`, import.meta.url));
const CLI = dist("cli/main.js");
const runner = createRunner({
  guard: dist("guard-cjs/guard/main.js"),
  filter: dist("guard-cjs/filter/main.js"),
});

describe("offlimits test, run for real (US-012, US-013)", () => {
  it("runs every class against the built guard and filter, and every covered class holds", () => {
    const result = spawnSync(process.execPath, [CLI, "test"], { encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(EXIT_OK);
    expect(result.stdout).toContain("Every class that text matching is meant to cover held.");
    const heldRows = result.stdout.split("\n").filter((line) => /held \d+\/\d+/u.test(line));
    expect(heldRows.length).toBeGreaterThanOrEqual(8);
    expect(result.stdout).not.toContain("GOT THROUGH");
  }, 120_000);

  it("can tell when something gets through: the same attempts against an empty policy", async () => {
    const { fixture, cleanup } = createFixture();
    try {
      writeFileSync(fixture.policyFile, JSON.stringify({ version: 1, entries: [] }));
      const classes = WORKAROUND_CLASSES.filter((c) =>
        ["spelling", "quoting", "encodings"].includes(c.id),
      );
      const results = await runSelfTest(fixture, runner, classes);
      for (const result of results) {
        expect(result.guard).toMatchObject({ status: "tried", held: 0 });
      }
    } finally {
      cleanup();
    }
  }, 120_000);

  it("holds against the real test policy, for the same classes", async () => {
    const { fixture, cleanup } = createFixture();
    try {
      const classes = WORKAROUND_CLASSES.filter((c) =>
        ["spelling", "quoting", "encodings"].includes(c.id),
      );
      const results = await runSelfTest(fixture, runner, classes);
      for (const result of results) {
        expect(result.guard).toMatchObject({ status: "tried", gotThrough: [] });
      }
    } finally {
      cleanup();
    }
  }, 120_000);
});
