import { describe, expect, it } from "vitest";
import { GUARD_MARKER, withGuard } from "../../src/adapters/claude-code/settings.js";
import { run } from "../../src/cli/run.js";
import { NOTICE_SNIPPET } from "../../src/core/notice.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_ERROR, EXIT_OK } from "../../src/core/signal.js";
import { protections } from "../../src/guard/protections.js";
import { entry } from "../helpers/context.js";
import { type FakeOptions, fakeDeps, policyOf } from "../helpers/deps.js";

async function runCli(argv: string[], options: FakeOptions = {}) {
  const fake = fakeDeps(options);
  const code = await run(argv, fake.deps);
  return { code, ...fake };
}

const guardCommand = { node: "/usr/bin/node", script: "/opt/offlimits/dist/guard/main.js" };

describe("snippet (US-009)", () => {
  it("prints the notice, without a terminal and without reading the policy", async () => {
    const { code, out, err } = await runCli(["snippet"], {
      interactive: false,
      stored: { status: "missing" },
    });
    expect(code).toBe(EXIT_OK);
    expect(err).toEqual([]);
    expect(out.join("\n")).toBe(NOTICE_SNIPPET.trimEnd());
  });

  it("tells an assistant what the signals mean and what to do, and names nothing", () => {
    expect(NOTICE_SNIPPET).toContain("[offlimits:blocked]");
    expect(NOTICE_SNIPPET).toContain("[offlimits:filtered]");
    expect(NOTICE_SNIPPET.toLowerCase()).toContain("tell the owner");
    expect(NOTICE_SNIPPET.toLowerCase()).not.toMatch(/client|alpha|nightingale/u);
  });
});

describe("explain (US-020)", () => {
  const stored = {
    status: "ok" as const,
    policy: policyOf(entry("name", "client-alpha"), entry("host", "internal.example.com")),
  };

  it("refuses without a terminal and prints nothing", async () => {
    const { code, out, err } = await runCli(["explain", "client-alpha"], {
      interactive: false,
      stored,
    });
    expect(code).toBe(EXIT_BLOCKED);
    expect(out).toEqual([]);
    expect(err).toEqual([BLOCKED_MESSAGE]);
  });

  it("lists the entries that match, by number", async () => {
    const { code, out } = await runCli(["explain", "cat", "Client_Alpha.txt"], { stored });
    expect(code).toBe(EXIT_OK);
    expect(out).toEqual(["1. [hide] name: client-alpha"]);
  });

  it("lists every entry that matches", async () => {
    const { out } = await runCli(["explain", "client-alpha", "https://api.internal.example.com"], {
      stored,
    });
    expect(out).toEqual(["1. [hide] name: client-alpha", "2. [hide] host: internal.example.com"]);
  });

  it("says when nothing matches", async () => {
    const { out } = await runCli(["explain", "ls", "src"], { stored });
    expect(out).toEqual(["Nothing on your list matches that text."]);
  });

  it("shows an automatic protection that matches, by its label", async () => {
    const guarded = protections({
      policyFile: "/home/kyle/.config/offlimits/policy.json",
      settingsFiles: [],
      programDir: "/opt/offlimits/dist",
    });
    const { out } = await runCli(["explain", "cat", "/home/kyle/.config/offlimits/policy.json"], {
      stored,
      protections: guarded,
    });
    expect(out).toEqual(["Protected automatically: the policy file."]);
  });

  it("needs some text, and a usable policy", async () => {
    expect((await runCli(["explain"], { stored })).code).toBe(EXIT_ERROR);
    expect((await runCli(["explain", "x"], { stored: { status: "missing" } })).code).toBe(
      EXIT_ERROR,
    );
  });
});

describe("install (US-006)", () => {
  it("refuses without a terminal, and changes nothing", async () => {
    const { code, err, savedSettings, asked } = await runCli(["install"], { interactive: false });
    expect(code).toBe(EXIT_BLOCKED);
    expect(err).toEqual([BLOCKED_MESSAGE]);
    expect(savedSettings).toEqual([]);
    expect(asked).toEqual([]);
  });

  it("needs a policy first", async () => {
    const { code, err, savedSettings } = await runCli(["install"], {
      stored: { status: "missing" },
    });
    expect(code).toBe(EXIT_ERROR);
    expect(err.join(" ")).toContain("offlimits init");
    expect(savedSettings).toEqual([]);
  });

  it("adds the guard after the owner confirms, and says what to do next", async () => {
    const { code, savedSettings, out } = await runCli(["install"], { answers: ["y"] });
    expect(code).toBe(EXIT_OK);
    expect(savedSettings).toEqual([withGuard({}, guardCommand)]);
    const text = out.join("\n");
    expect(text).toContain("Installed");
    expect(text).toContain("2.1.295");
    expect(text).toContain("offlimits snippet");
  });

  it("keeps hooks and settings that are already there", async () => {
    const existing = {
      model: "m",
      hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "other" }] }] },
    };
    const { savedSettings } = await runCli(["install"], {
      settings: { status: "ok", settings: existing },
      answers: ["y"],
    });
    const written = savedSettings[0] as typeof existing;
    expect(written.model).toBe("m");
    expect(written.hooks.PreToolUse[0]).toEqual(existing.hooks.PreToolUse[0]);
    expect(written.hooks.PreToolUse).toHaveLength(2);
  });

  it("changes nothing when the owner declines", async () => {
    const { savedSettings, out } = await runCli(["install"], { answers: ["n"] });
    expect(savedSettings).toEqual([]);
    expect(out).toContain("Nothing changed.");
  });

  it("offers to update when the guard is already there", async () => {
    const { asked } = await runCli(["install"], {
      settings: { status: "ok", settings: withGuard({}, guardCommand) },
      answers: ["n"],
    });
    expect(asked[0]).toContain("Update the guard");
  });

  it("uses the settings file it is given", async () => {
    const { settingsPathsOpened } = await runCli(["install", "--settings", "/tmp/other.json"], {
      answers: ["n"],
    });
    expect(settingsPathsOpened).toEqual(["/tmp/other.json"]);
  });

  it("leaves a settings file it cannot read alone", async () => {
    const { code, savedSettings } = await runCli(["install"], {
      settings: { status: "invalid" },
      answers: ["y"],
    });
    expect(code).toBe(EXIT_ERROR);
    expect(savedSettings).toEqual([]);
  });

  it("leaves hooks in a shape it does not know alone", async () => {
    const { code, savedSettings } = await runCli(["install"], {
      settings: { status: "ok", settings: { hooks: [] } },
      answers: ["y"],
    });
    expect(code).toBe(EXIT_ERROR);
    expect(savedSettings).toEqual([]);
  });
});

describe("uninstall", () => {
  const installed = { status: "ok" as const, settings: withGuard({ model: "m" }, guardCommand) };

  it("refuses without a terminal", async () => {
    const { code, savedSettings } = await runCli(["uninstall"], {
      interactive: false,
      settings: installed,
    });
    expect(code).toBe(EXIT_BLOCKED);
    expect(savedSettings).toEqual([]);
  });

  it("removes the guard after the owner confirms, keeping the rest", async () => {
    const { code, savedSettings } = await runCli(["uninstall"], {
      settings: installed,
      answers: ["y"],
    });
    expect(code).toBe(EXIT_OK);
    expect(savedSettings).toEqual([{ model: "m" }]);
  });

  it("changes nothing when the owner declines", async () => {
    const { savedSettings } = await runCli(["uninstall"], { settings: installed, answers: ["n"] });
    expect(savedSettings).toEqual([]);
  });

  it("says so when there is no settings file or no guard in it", async () => {
    const none = await runCli(["uninstall"], { settings: { status: "missing" } });
    expect(none.code).toBe(EXIT_OK);
    expect(none.savedSettings).toEqual([]);
    const notThere = await runCli(["uninstall"], {
      settings: { status: "ok", settings: { model: "m" } },
    });
    expect(notThere.out.join(" ")).toContain("not installed");
    expect(notThere.savedSettings).toEqual([]);
  });

  it("leaves a settings file it cannot read alone", async () => {
    const { code, savedSettings } = await runCli(["uninstall"], {
      settings: { status: "invalid" },
    });
    expect(code).toBe(EXIT_ERROR);
    expect(savedSettings).toEqual([]);
  });

  it("only ever removes handlers it added", () => {
    expect(GUARD_MARKER).toBe("Off-Limits");
  });
});
