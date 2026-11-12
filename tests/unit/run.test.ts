import { describe, expect, it } from "vitest";
import { run } from "../../src/cli/run.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_ERROR, EXIT_OK } from "../../src/core/signal.js";
import { entry } from "../helpers/context.js";
import { type FakeOptions, fakeDeps, policyOf } from "../helpers/deps.js";

async function runCli(argv: string[], options: FakeOptions = {}) {
  const fake = fakeDeps(options);
  const code = await run(argv, fake.deps);
  return { code, ...fake };
}

describe("general", () => {
  it("prints the version", async () => {
    const { code, out } = await runCli(["--version"]);
    expect({ code, out }).toEqual({ code: EXIT_OK, out: ["9.9.9"] });
  });

  it("prints help when given no command", async () => {
    const { code, out } = await runCli([]);
    expect(code).toBe(EXIT_OK);
    expect(out[0]).toContain("Usage:");
  });

  it("rejects an unknown command and an unknown option", async () => {
    expect((await runCli(["frobnicate"])).code).toBe(EXIT_ERROR);
    expect((await runCli(["--nope"])).code).toBe(EXIT_ERROR);
  });
});

describe("init (US-001)", () => {
  it("creates an empty policy and says where it is", async () => {
    const { code, out, saved } = await runCli(["init"], { stored: { status: "missing" } });
    expect(code).toBe(EXIT_OK);
    expect(saved).toEqual([{ version: 1, entries: [] }]);
    expect(out.join("\n")).toContain("/config/offlimits/policy.json");
  });

  it("works without a terminal", async () => {
    const { code } = await runCli(["init"], { stored: { status: "missing" }, interactive: false });
    expect(code).toBe(EXIT_OK);
  });

  it("leaves an existing policy alone", async () => {
    const { code, saved } = await runCli(["init"], {
      stored: { status: "ok", policy: policyOf(entry("name", "client-alpha")) },
    });
    expect(code).toBe(EXIT_OK);
    expect(saved).toEqual([]);
  });

  it("never overwrites a file it cannot read", async () => {
    const { code, saved } = await runCli(["init"], {
      stored: { status: "invalid", problems: ["x"] },
    });
    expect(code).toBe(EXIT_ERROR);
    expect(saved).toEqual([]);
  });
});

describe("add (US-002, US-005)", () => {
  it("refuses with the standard signal when no person is at a terminal, and changes nothing", async () => {
    const { code, err, out, saved, asked } = await runCli(["add", "client-alpha"], {
      interactive: false,
    });
    expect(code).toBe(EXIT_BLOCKED);
    expect(err).toEqual([BLOCKED_MESSAGE]);
    expect(out).toEqual([]);
    expect(saved).toEqual([]);
    expect(asked).toEqual([]);
  });

  it("stores the entry after the owner confirms", async () => {
    const { code, saved } = await runCli(["add", "client-alpha"], { answers: ["y"] });
    expect(code).toBe(EXIT_OK);
    expect(saved).toEqual([policyOf({ kind: "name", mode: "hide", value: "client-alpha" })]);
  });

  it("stores nothing when the owner declines", async () => {
    const { code, saved, out } = await runCli(["add", "client-alpha"], { answers: ["n"] });
    expect(code).toBe(EXIT_OK);
    expect(saved).toEqual([]);
    expect(out).toContain("Nothing changed.");
  });

  it("treats an empty answer as no", async () => {
    expect((await runCli(["add", "client-alpha"], { answers: [""] })).saved).toEqual([]);
  });

  it("asks for the value when none is given", async () => {
    const { saved, asked } = await runCli(["add"], { answers: ["project-nightingale", "y"] });
    expect(asked[0]).toContain("off-limits");
    expect(saved[0]?.entries[0]?.value).toBe("project-nightingale");
  });

  it("carries kind, mode, assistants and note into the entry", async () => {
    const { saved } = await runCli(
      [
        "add",
        "internal.example.com",
        "--kind",
        "host",
        "--mode",
        "forbid",
        "--assistant",
        "claude-code",
        "--assistant",
        "other",
        "--note",
        "staging",
      ],
      { answers: ["y"] },
    );
    expect(saved[0]?.entries).toEqual([
      {
        kind: "host",
        mode: "forbid",
        value: "internal.example.com",
        assistants: ["claude-code", "other"],
        note: "staging",
      },
    ]);
  });

  it("joins a value given as several words", async () => {
    const { saved } = await runCli(["add", "Client", "Alpha"], { answers: ["y"] });
    expect(saved[0]?.entries[0]?.value).toBe("Client Alpha");
  });

  it("rejects an unusable value without repeating it", async () => {
    const { code, err, saved, out } = await runCli(["add", "client-alpha(", "--kind", "regex"], {
      answers: ["y"],
    });
    expect(code).toBe(EXIT_ERROR);
    expect(saved).toEqual([]);
    expect([...err, ...out].join(" ").toLowerCase()).not.toContain("alpha");
  });

  it("rejects an unknown kind", async () => {
    expect((await runCli(["add", "x", "--kind", "folder"], { answers: ["y"] })).code).toBe(
      EXIT_ERROR,
    );
  });

  it("refuses a duplicate", async () => {
    const { code, saved } = await runCli(["add", "Client_Alpha"], {
      stored: { status: "ok", policy: policyOf(entry("name", "client-alpha")) },
      answers: ["y"],
    });
    expect(code).toBe(EXIT_ERROR);
    expect(saved).toEqual([]);
  });

  it("asks for init first when there is no policy", async () => {
    const { code, err } = await runCli(["add", "client-alpha"], { stored: { status: "missing" } });
    expect(code).toBe(EXIT_ERROR);
    expect(err.join(" ")).toContain("offlimits init");
  });

  it("shows what the entry would match in this folder before asking", async () => {
    const { out } = await runCli(["add", "client-alpha"], {
      scan: { files: 12, directories: 3, truncated: false },
      answers: ["n"],
    });
    expect(out.join("\n")).toContain("12 files, 3 folders");
  });

  it("says so when nothing matches, and when the scan stopped early", async () => {
    const none = await runCli(["add", "client-alpha"], { answers: ["n"] });
    expect(none.out.join("\n")).toContain("Nothing in this folder matches");
    const partial = await runCli(["add", "client-alpha"], {
      scan: { files: 5, directories: 0, truncated: true },
      answers: ["n"],
    });
    expect(partial.out.join("\n")).toContain("stopped early");
  });

  it("says a preview is unavailable for kinds that are not file names", async () => {
    const { out } = await runCli(["add", "API_TOKEN", "--kind", "env"], { answers: ["n"] });
    expect(out.join("\n")).toContain("preview is not available");
  });

  it("warns about a short or common entry and still needs a yes", async () => {
    const short = await runCli(["add", "ab"], { answers: ["n"] });
    expect(short.out.join("\n")).toContain("short");
    expect(short.saved).toEqual([]);
    const common = await runCli(["add", "docs"], { answers: ["y"] });
    expect(common.out.join("\n")).toContain("common word");
    expect(common.saved).toHaveLength(1);
  });

  it("does not warn about a distinctive entry", async () => {
    const { out } = await runCli(["add", "project-nightingale"], { answers: ["n"] });
    expect(out.join("\n")).not.toContain("Warning");
  });
});

describe("list (US-003)", () => {
  it("refuses without a terminal and prints nothing", async () => {
    const { code, out, err } = await runCli(["list"], {
      interactive: false,
      stored: { status: "ok", policy: policyOf(entry("name", "client-alpha")) },
    });
    expect(code).toBe(EXIT_BLOCKED);
    expect(out).toEqual([]);
    expect(err).toEqual([BLOCKED_MESSAGE]);
  });

  it("numbers the entries", async () => {
    const { out } = await runCli(["list"], {
      stored: {
        status: "ok",
        policy: policyOf(entry("name", "client-alpha"), {
          kind: "host",
          mode: "forbid",
          value: "internal.example.com",
          assistants: ["claude-code"],
          note: "staging",
        }),
      },
    });
    expect(out).toEqual([
      "1. [hide] name: client-alpha",
      "2. [forbid] host: internal.example.com (for claude-code)  # staging",
    ]);
  });

  it("says when the list is empty", async () => {
    expect((await runCli(["list"])).out.join(" ")).toContain("empty");
  });
});

describe("remove (US-003)", () => {
  const stored = {
    status: "ok" as const,
    policy: policyOf(entry("name", "client-alpha"), entry("name", "project-nightingale")),
  };

  it("refuses without a terminal and changes nothing", async () => {
    const { code, saved } = await runCli(["remove", "1"], { interactive: false, stored });
    expect(code).toBe(EXIT_BLOCKED);
    expect(saved).toEqual([]);
  });

  it("removes by number after confirmation", async () => {
    const { code, saved } = await runCli(["remove", "1"], { stored, answers: ["y"] });
    expect(code).toBe(EXIT_OK);
    expect(saved[0]?.entries.map((e) => e.value)).toEqual(["project-nightingale"]);
  });

  it("removes by value, however it is spelled", async () => {
    const { saved } = await runCli(["remove", "Project_Nightingale"], { stored, answers: ["y"] });
    expect(saved[0]?.entries.map((e) => e.value)).toEqual(["client-alpha"]);
  });

  it("keeps the entry when the owner declines", async () => {
    const { saved } = await runCli(["remove", "1"], { stored, answers: ["n"] });
    expect(saved).toEqual([]);
  });

  it("asks which entry when none is given", async () => {
    const { saved, asked } = await runCli(["remove"], { stored, answers: ["2", "y"] });
    expect(asked[0]).toContain("Which entry");
    expect(saved[0]?.entries.map((e) => e.value)).toEqual(["client-alpha"]);
  });

  it("reports an entry that does not exist", async () => {
    const { code, saved } = await runCli(["remove", "nothing-like-it"], { stored });
    expect(code).toBe(EXIT_ERROR);
    expect(saved).toEqual([]);
  });
});

describe("check (US-004, US-007)", () => {
  const stored = { status: "ok" as const, policy: policyOf(entry("name", "client-alpha")) };

  it("allows text that touches nothing", async () => {
    expect(await runCli(["check", "open", "notes.md"], { stored })).toMatchObject({
      code: EXIT_OK,
      out: ["allowed"],
      err: [],
    });
  });

  it("blocks with the standard message and never names the entry", async () => {
    const { code, out, err } = await runCli(["check", "cat", "Client_Alpha.txt"], { stored });
    expect(code).toBe(EXIT_BLOCKED);
    expect(out).toEqual([]);
    expect(err).toEqual([BLOCKED_MESSAGE]);
  });

  it("works without a terminal", async () => {
    const { code } = await runCli(["check", "cat", "client-alpha"], { stored, interactive: false });
    expect(code).toBe(EXIT_BLOCKED);
  });

  it("applies only the entries meant for the named assistant", async () => {
    const scoped = {
      status: "ok" as const,
      policy: policyOf({ ...entry("name", "client-alpha"), assistants: ["claude-code"] }),
    };
    expect(
      (await runCli(["check", "client-alpha", "--assistant", "claude-code"], { stored: scoped }))
        .code,
    ).toBe(EXIT_BLOCKED);
    expect(
      (await runCli(["check", "client-alpha", "--assistant", "other"], { stored: scoped })).code,
    ).toBe(EXIT_OK);
  });

  it("needs some text", async () => {
    expect((await runCli(["check"], { stored })).code).toBe(EXIT_ERROR);
  });

  it("asks for init when there is no policy", async () => {
    const { code, err } = await runCli(["check", "x"], { stored: { status: "missing" } });
    expect(code).toBe(EXIT_ERROR);
    expect(err.join(" ")).toContain("offlimits init");
  });

  it("fails closed when the policy cannot be used", async () => {
    const { code, err } = await runCli(["check", "anything"], {
      stored: { status: "invalid", problems: ["entries.0.value: bad"] },
    });
    expect(code).toBe(EXIT_BLOCKED);
    expect(err).toEqual([BLOCKED_MESSAGE]);
  });

  it("shows why a policy was rejected only when debugging is on", async () => {
    const stored = { status: "invalid" as const, problems: ["entries.0.value: bad"] };
    expect((await runCli(["check", "x"], { stored })).err.join(" ")).not.toContain("entries.0");
    expect((await runCli(["check", "x"], { stored, debug: true })).err.join(" ")).toContain(
      "entries.0",
    );
  });
});
