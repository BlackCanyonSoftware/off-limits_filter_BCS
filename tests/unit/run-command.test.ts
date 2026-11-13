import { describe, expect, it } from "vitest";
import { run } from "../../src/cli/run.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_ERROR, EXIT_OK } from "../../src/core/signal.js";
import { entry } from "../helpers/context.js";
import { fakeFileSystem } from "../helpers/fake-fs.js";
import { type FakeOptions, fakeDeps, policyOf } from "../helpers/deps.js";

const fileSystem = fakeFileSystem({
  work: { project: { src: { "a.ts": "x" }, "client-alpha": { "n.md": "x" }, "README.md": "x" } },
});
const stored = {
  status: "ok" as const,
  policy: policyOf(entry("name", "client-alpha"), entry("env", "ALPHA_TOKEN")),
};

async function runCli(argv: string[], options: FakeOptions = {}) {
  const fake = fakeDeps({ stored, fileSystem, ...options });
  const code = await run(argv, fake.deps);
  return { code, ...fake };
}

describe("run (US-017)", () => {
  it("needs a command after --", async () => {
    const { code, err } = await runCli(["run"]);
    expect(code).toBe(EXIT_ERROR);
    expect(err.join(" ")).toContain("needs a command");
  });

  it("starts the command in bubblewrap with the hidden thing left out, and passes its exit code on", async () => {
    const { code, started } = await runCli(["run", "--", "bash", "-c", "ls"], { runExit: 7 });
    expect(code).toBe(7);
    expect(started).toHaveLength(1);
    expect(started[0]?.program).toBe("bwrap");
    const text = started[0]?.args.join(" ") ?? "";
    expect(text).toContain("--unsetenv ALPHA_TOKEN");
    expect(text).toContain("/work/project/src");
    expect(text).not.toContain("client-alpha");
    expect(text.endsWith("-- bash -c ls")).toBe(true);
  });

  it("says only how many things are hidden, never which, even without a terminal", async () => {
    const { err, out } = await runCli(["run", "--", "ls"], { interactive: false });
    expect(out).toEqual([]);
    expect(err.join("\n")).toContain("1 hidden, 1 variables removed, running in bubblewrap");
    expect(err.join("\n").toLowerCase()).not.toContain("alpha");
  });

  it("uses docker when asked, with the image given", async () => {
    const { started } = await runCli(
      ["run", "--backend", "docker", "--image", "node:22", "--", "make"],
      {
        backends: ["docker"],
      },
    );
    expect(started[0]?.program).toBe("docker");
    expect(started[0]?.args).toContain("node:22");
    expect(started[0]?.args.join(" ")).not.toContain("client-alpha");
  });

  it("uses the first backend that works when none is asked for", async () => {
    const { started } = await runCli(["run", "--", "ls"], { backends: ["docker", "bubblewrap"] });
    expect(started[0]?.program).toBe("docker");
  });

  it("explains how to get an isolation tool when none can run, and runs nothing", async () => {
    const { code, err, started } = await runCli(["run", "--", "ls"], { backends: [] });
    expect(code).toBe(EXIT_ERROR);
    expect(err.join(" ")).toContain("docs/ISOLATION.md");
    expect(started).toEqual([]);
  });

  it("refuses a backend that cannot run here, or does not exist", async () => {
    const missing = await runCli(["run", "--backend", "docker", "--", "ls"], {
      backends: ["bubblewrap"],
    });
    expect(missing.code).toBe(EXIT_ERROR);
    expect(missing.started).toEqual([]);
    expect((await runCli(["run", "--backend", "podman", "--", "ls"])).code).toBe(EXIT_ERROR);
  });

  it("will not rebuild the top of a drive or the file system", async () => {
    const { code, started } = await runCli(["run", "--folder", "/", "--", "ls"]);
    expect(code).toBe(EXIT_ERROR);
    expect(started).toEqual([]);
  });

  it("needs a usable policy", async () => {
    const { code, started } = await runCli(["run", "--", "ls"], { stored: { status: "missing" } });
    expect(code).toBe(EXIT_ERROR);
    expect(started).toEqual([]);
  });

  it("notes what isolation cannot hide", async () => {
    const { err } = await runCli(["run", "--", "ls"], {
      stored: {
        status: "ok",
        policy: policyOf(entry("name", "client-alpha"), entry("host", "a.example.com")),
      },
    });
    expect(err.join("\n")).toContain(
      "1 entries (hosts, commands, conversations, expressions) cannot be hidden this way",
    );
  });
});

describe("run --dry-run", () => {
  it("refuses without a terminal, because the plan shows what is hidden", async () => {
    const { code, err, started } = await runCli(["run", "--dry-run", "--", "ls"], {
      interactive: false,
    });
    expect(code).toBe(EXIT_BLOCKED);
    expect(err).toEqual([BLOCKED_MESSAGE]);
    expect(started).toEqual([]);
  });

  it("shows the plan and runs nothing", async () => {
    const { code, out, started } = await runCli(["run", "--dry-run", "--", "ls"]);
    expect(code).toBe(EXIT_OK);
    expect(started).toEqual([]);
    expect(out.join("\n")).toContain("Backend: bubblewrap");
    expect(out.join("\n")).toContain("Hidden inside /work/project: 1");
    expect(out.join("\n")).toContain("bwrap --die-with-parent");
  });
});
