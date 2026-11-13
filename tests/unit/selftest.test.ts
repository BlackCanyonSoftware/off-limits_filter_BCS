import { describe, expect, it } from "vitest";
import { run } from "../../src/cli/run.js";
import { EXIT_ERROR, EXIT_OK } from "../../src/core/signal.js";
import { WORKAROUND_CLASSES } from "../../src/selftest/classes.js";
import { anyGotThrough, formatReport, runSelfTest } from "../../src/selftest/run.js";
import type { AttemptRunner, Fixture, Outcome } from "../../src/selftest/types.js";
import { fakeDeps } from "../helpers/deps.js";

const fixture = (
  platform: NodeJS.Platform = "linux",
  link: string | undefined = "/tmp/fx/clients/shortcut",
): Fixture => ({
  root: "/tmp/fx",
  protectedDir: "/tmp/fx/clients/client-alpha",
  link,
  policyFile: "/tmp/fx/policy.json",
  settingsFile: "/tmp/fx/claude/settings.json",
  countsFile: "/tmp/fx/counts.log",
  platform,
});

const allHeld: AttemptRunner = {
  guard: () => Promise.resolve("held"),
  filter: (attempts) => Promise.resolve(attempts.map((): Outcome => "held")),
};

describe("the workaround classes (US-012)", () => {
  it("has at least eight classes that text matching is meant to cover", () => {
    expect(WORKAROUND_CLASSES.filter((c) => !c.outsideTextMatching).length).toBeGreaterThanOrEqual(
      8,
    );
  });

  it("covers the classes the roadmap names", () => {
    const ids = WORKAROUND_CLASSES.map((c) => c.id);
    for (const wanted of [
      "spelling",
      "paths",
      "links",
      "quoting",
      "wildcards",
      "variables",
      "encodings",
    ]) {
      expect(ids).toContain(wanted);
    }
  });

  it("uses made-up names only", () => {
    const text = WORKAROUND_CLASSES.flatMap((c) => c.attempts(fixture()))
      .map((a) => JSON.stringify(a))
      .join("\n")
      .toLowerCase();
    expect(text).toContain("client-alpha");
    expect(text).not.toMatch(/kpier|kyle1/u);
  });

  it("gives every attempt a label and something to run", () => {
    for (const workaround of WORKAROUND_CLASSES) {
      for (const attempt of workaround.attempts(fixture("win32"))) {
        expect(attempt.label.length).toBeGreaterThan(0);
        expect(
          attempt.command !== undefined || attempt.call !== undefined || attempt.line !== undefined,
        ).toBe(true);
      }
    }
  });
});

describe("runSelfTest and the report", () => {
  it("reports every applicable class as held when everything is refused", async () => {
    const results = await runSelfTest(fixture(), allHeld);
    expect(anyGotThrough(results)).toBe(false);
    const report = formatReport(results).join("\n");
    expect(report).toContain("Every class that text matching is meant to cover held.");
    expect(report).toContain("Spelling and case");
    expect(report).not.toContain("GOT THROUGH");
  });

  it("names what got through, by class and layer, and says so plainly", async () => {
    const runner: AttemptRunner = {
      guard: (attempt) =>
        Promise.resolve(
          attempt.label === "Single quotes around part of it" ? "got-through" : "held",
        ),
      filter: (attempts) => Promise.resolve(attempts.map((): Outcome => "held")),
    };
    const results = await runSelfTest(fixture(), runner);
    expect(anyGotThrough(results)).toBe(true);
    const report = formatReport(results).join("\n");
    expect(report).toContain("GOT THROUGH 1/4");
    expect(report).toContain("Got through:");
    expect(report).toContain(
      "Quoting that a shell removes (guard): Single quotes around part of it",
    );
    expect(report).not.toContain("Every class that text matching is meant to cover held.");
  });

  it("does not count the documented gaps as failures, but shows them", async () => {
    const runner: AttemptRunner = {
      guard: (attempt) =>
        Promise.resolve(attempt.label === "A script that holds the name" ? "got-through" : "held"),
      filter: (attempts) => Promise.resolve(attempts.map((): Outcome => "held")),
    };
    const results = await runSelfTest(fixture(), runner);
    expect(anyGotThrough(results)).toBe(false);
    expect(formatReport(results).join("\n")).toContain("1 of 5 got through");
  });

  it("marks a class that cannot be tried here as not applicable, not as held", async () => {
    const results = await runSelfTest(fixture("linux"), allHeld);
    const windows = results.find((r) => r.id === "windows-forms");
    expect(windows?.guard).toEqual({ status: "not-applicable", reason: "this is not Windows" });
    const noLink = await runSelfTest({ ...fixture("linux"), link: undefined }, allHeld);
    expect(noLink.find((r) => r.id === "links")?.guard.status).toBe("not-applicable");
    expect(formatReport(noLink).join("\n")).toContain("not applicable");
  });

  it("tries the Windows forms on Windows", async () => {
    const results = await runSelfTest(fixture("win32"), allHeld);
    expect(results.find((r) => r.id === "windows-forms")?.guard).toMatchObject({
      status: "tried",
      total: 5,
    });
  });

  it("sends a class's filter lines to the filter together, and reads one answer per line", async () => {
    const calls: number[] = [];
    const runner: AttemptRunner = {
      guard: () => Promise.resolve("held"),
      filter: (attempts) => {
        calls.push(attempts.length);
        return Promise.resolve(attempts.map((): Outcome => "held"));
      },
    };
    await runSelfTest(fixture(), runner);
    expect(calls.length).toBeGreaterThan(0);
    expect(Math.max(...calls)).toBeGreaterThan(1);
  });
});

describe("the test command", () => {
  it("exits 0 and prints the report when everything held, from anywhere", async () => {
    const fake = fakeDeps({ interactive: false });
    expect(await run(["test"], fake.deps)).toBe(EXIT_OK);
    expect(fake.out.join("\n")).toContain("Every class that text matching is meant to cover held.");
  });

  it("exits 1 when something got through", async () => {
    const fake = fakeDeps({
      runner: {
        guard: () => Promise.resolve("got-through"),
        filter: (a) => Promise.resolve(a.map((): Outcome => "held")),
      },
    });
    expect(await run(["test"], fake.deps)).toBe(EXIT_ERROR);
    expect(fake.out.join("\n")).toContain("Some attempts got through.");
  });

  it("never reads the owner's policy", async () => {
    const fake = fakeDeps({ stored: { status: "invalid", problems: ["x"] } });
    let read = false;
    const store = {
      ...fake.deps.store,
      load: () => {
        read = true;
        return { status: "missing" as const };
      },
    };
    await run(["test"], { ...fake.deps, store });
    expect(read).toBe(false);
  });

  it("says what went wrong, and exits 1, when the programs cannot be run", async () => {
    const fake = fakeDeps({
      runner: {
        guard: () => Promise.reject(new Error("the guard did not run as expected")),
        filter: () => Promise.reject(new Error("no")),
      },
    });
    expect(await run(["test"], fake.deps)).toBe(EXIT_ERROR);
    expect(fake.err.join(" ")).toContain("the guard did not run as expected");
    expect(fake.err.join(" ")).toContain("npm run build");
  });
});
