import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { run } from "../../src/cli/run.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_ERROR, EXIT_OK } from "../../src/core/signal.js";
import { entry } from "../helpers/context.js";
import { type FakeOptions, fakeDeps, policyOf } from "../helpers/deps.js";

const hash = (name: string): string =>
  createHash("sha256").update(`fake-key:${name}`).digest("hex");
const alphaHash = hash("clientalpha");
const keyCheck = hash("offlimits-key-check");
const KEY = "/config/offlimits/blind.key";

async function runCli(argv: string[], options: FakeOptions = {}) {
  const fake = fakeDeps(options);
  const code = await run(argv, fake.deps);
  return { code, ...fake };
}

describe("add --blind (US-018)", () => {
  it("stores only a hash: the name is written nowhere", async () => {
    const { code, saved, out } = await runCli(["add", "--blind", "Client Alpha"], {
      answers: ["y"],
    });
    expect(code).toBe(EXIT_OK);
    expect(saved[0]?.entries).toEqual([{ kind: "blind", mode: "hide", value: alphaHash }]);
    // The policy also gets a key check, so a wrong key can be told from the right one.
    expect(saved[0]?.keyCheck).toBe(keyCheck);
    expect(JSON.stringify(saved).toLowerCase()).not.toContain("alpha");
    expect(out.join("\n").toLowerCase()).not.toContain("alpha");
  });

  it("shows only that it will be a hash before asking, and points at the key afterwards", async () => {
    const { out } = await runCli(["add", "--blind", "client-alpha"], { answers: ["y"] });
    expect(out.join("\n")).toContain("blind: (stored only as a keyed hash)");
    expect(out.join("\n")).toContain(`Keep the key at ${KEY} out of any repository`);
  });

  it("keeps the mode, assistants and note", async () => {
    const { saved } = await runCli(
      [
        "add",
        "--blind",
        "client-alpha",
        "--mode",
        "forbid",
        "--assistant",
        "claude-code",
        "--note",
        "n",
      ],
      { answers: ["y"] },
    );
    expect(saved[0]?.entries[0]).toEqual({
      kind: "blind",
      mode: "forbid",
      value: alphaHash,
      assistants: ["claude-code"],
      note: "n",
    });
  });

  it("still previews against the plain name and warns about a short one", async () => {
    const { out, asked } = await runCli(["add", "--blind", "ab"], {
      answers: ["n"],
      scan: { files: 2, directories: 0, truncated: false },
    });
    expect(out.join("\n")).toContain("2 files, 0 folders");
    expect(out.join("\n")).toContain("short");
    expect(asked).toHaveLength(1);
  });

  it("writes nothing, and makes no key, when the owner declines", async () => {
    const { saved, out } = await runCli(["add", "--blind", "client-alpha"], { answers: ["n"] });
    expect(saved).toEqual([]);
    expect(out).toContain("Nothing changed.");
  });

  it("works with names only", async () => {
    const { code, saved } = await runCli(
      ["add", "--blind", "internal.example.com", "--kind", "host"],
      {
        answers: ["y"],
      },
    );
    expect(code).toBe(EXIT_ERROR);
    expect(saved).toEqual([]);
  });

  it("will not make a second key when the policy already has blind entries and this machine has none", async () => {
    const { code, err, saved } = await runCli(["add", "--blind", "client-beta"], {
      stored: { status: "ok", policy: policyOf({ kind: "blind", mode: "hide", value: alphaHash }) },
      hasKey: false,
      answers: ["y"],
    });
    expect(code).toBe(EXIT_ERROR);
    expect(err.join(" ")).toContain("orphan");
    expect(saved).toEqual([]);
  });

  it("will not add when the key here does not match the policy's blind entries", async () => {
    const { code, err, saved } = await runCli(["add", "--blind", "client-beta"], {
      stored: {
        status: "ok",
        policy: {
          ...policyOf({ kind: "blind", mode: "hide", value: alphaHash }),
          keyCheck: "0".repeat(64),
        },
      },
      hasKey: true,
      answers: ["y"],
    });
    expect(code).toBe(EXIT_ERROR);
    expect(err.join(" ")).toContain("does not match");
    expect(saved).toEqual([]);
  });

  it("refuses a duplicate when the key is here", async () => {
    const { code, saved } = await runCli(["add", "--blind", "CLIENT_ALPHA"], {
      stored: {
        status: "ok",
        policy: { ...policyOf({ kind: "blind", mode: "hide", value: alphaHash }), keyCheck },
      },
      hasKey: true,
      answers: ["y"],
    });
    expect(code).toBe(EXIT_ERROR);
    expect(saved).toEqual([]);
  });

  it("is refused without a terminal", async () => {
    const { code, err } = await runCli(["add", "--blind", "x-y-z"], { interactive: false });
    expect(code).toBe(EXIT_BLOCKED);
    expect(err).toEqual([BLOCKED_MESSAGE]);
  });
});

describe("sync (US-019)", () => {
  const source = "/shared/policy.json";
  const incoming = JSON.stringify({
    version: 1,
    entries: [entry("name", "client-alpha"), entry("host", "a.example.com")],
  });
  const sourceFiles = (text: string): Map<string, string> => new Map([[source, text]]);

  it("is refused without a terminal, because it replaces the list", async () => {
    const { code, err, saved } = await runCli(["sync", source], {
      interactive: false,
      files: sourceFiles(incoming),
    });
    expect(code).toBe(EXIT_BLOCKED);
    expect(err).toEqual([BLOCKED_MESSAGE]);
    expect(saved).toEqual([]);
  });

  it("needs a source, from the argument or from OFFLIMITS_SYNC_SOURCE", async () => {
    expect((await runCli(["sync"])).code).toBe(EXIT_ERROR);
    const viaEnv = await runCli(["sync"], {
      syncSource: source,
      files: sourceFiles(incoming),
      answers: ["y"],
    });
    expect(viaEnv.code).toBe(EXIT_OK);
    expect(viaEnv.saved).toHaveLength(1);
  });

  it("replaces the policy with the source's after the owner confirms, and names no entry", async () => {
    const { code, saved, out, asked } = await runCli(["sync", source], {
      files: sourceFiles(incoming),
      answers: ["y"],
      stored: { status: "ok", policy: policyOf(entry("name", "old-one")) },
    });
    expect(code).toBe(EXIT_OK);
    expect(saved[0]?.entries).toHaveLength(2);
    expect(asked[0]).toContain("(1 entries)");
    expect(asked[0]).toContain("(2 entries)");
    expect(out.join("\n")).toContain("You now have 2 entries.");
    expect(out.join("\n").toLowerCase()).not.toContain("client");
  });

  it("keeps the policy it has when the source cannot be read", async () => {
    const { code, err, saved } = await runCli(["sync", "/shared/missing.json"]);
    expect(code).toBe(EXIT_ERROR);
    expect(err.join(" ")).toContain("Your policy is unchanged.");
    expect(saved).toEqual([]);
  });

  it.each([
    ["not JSON", "{ nope"],
    ["not a policy", JSON.stringify({ version: 2, entries: [] })],
    [
      "a policy with a bad entry",
      JSON.stringify({ version: 1, entries: [{ kind: "env", mode: "hide", value: "a b" }] }),
    ],
    ["empty", ""],
  ])("keeps the policy it has when the source is %s", async (_name, text) => {
    const { code, err, saved } = await runCli(["sync", source], {
      files: sourceFiles(text),
      answers: ["y"],
    });
    expect(code).toBe(EXIT_ERROR);
    expect(err.join(" ")).toContain("Your policy is unchanged.");
    expect(saved).toEqual([]);
  });

  it("says so when it is already in step, and changes nothing", async () => {
    const same = policyOf(entry("name", "client-alpha"));
    const { code, out, saved } = await runCli(["sync", source], {
      files: sourceFiles(JSON.stringify(same)),
      stored: { status: "ok", policy: same },
    });
    expect(code).toBe(EXIT_OK);
    expect(out).toContain("Already in step (1 entries).");
    expect(saved).toEqual([]);
  });

  it("changes nothing when the owner declines", async () => {
    const { saved, out } = await runCli(["sync", source], {
      files: sourceFiles(incoming),
      answers: ["n"],
    });
    expect(saved).toEqual([]);
    expect(out).toContain("Nothing changed.");
  });

  it("starts from nothing when there is no policy yet", async () => {
    const { saved, asked } = await runCli(["sync", source], {
      files: sourceFiles(incoming),
      answers: ["y"],
      stored: { status: "missing" },
    });
    expect(asked[0]).toContain("Use the policy from");
    expect(saved).toHaveLength(1);
  });

  it("reads a source that starts with a byte order mark", async () => {
    const bom = `${String.fromCharCode(0xfeff)}${incoming}`;
    expect(
      (await runCli(["sync", source], { files: sourceFiles(bom), answers: ["y"] })).saved,
    ).toHaveLength(1);
  });

  it("warns when the policy has blind entries and there is no key here", async () => {
    const blind = JSON.stringify({
      version: 1,
      entries: [{ kind: "blind", mode: "hide", value: alphaHash }],
    });
    const noKey = await runCli(["sync", source], {
      files: sourceFiles(blind),
      answers: ["y"],
      hasKey: false,
    });
    expect(noKey.out.join("\n")).toContain("no key here");
    expect(noKey.out.join("\n")).toContain(KEY);
    const withKey = await runCli(["sync", source], {
      files: sourceFiles(blind),
      answers: ["y"],
      hasKey: true,
    });
    expect(withKey.out.join("\n")).not.toContain("no key here");
  });
});
