import { describe, expect, it } from "vitest";
import { run } from "../../src/cli/run.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_ERROR, EXIT_OK } from "../../src/core/signal.js";

function runCli(...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = run(argv, { stdout: (l) => out.push(l), stderr: (l) => err.push(l) }, "9.9.9");
  return { code, out, err };
}

describe("run", () => {
  it("prints the version", () => {
    expect(runCli("--version")).toEqual({ code: EXIT_OK, out: ["9.9.9"], err: [] });
  });

  it("prints help when given no command", () => {
    const { code, out } = runCli();
    expect(code).toBe(EXIT_OK);
    expect(out[0]).toContain("Usage:");
  });

  it("rejects an unknown command", () => {
    const { code, err } = runCli("frobnicate");
    expect(code).toBe(EXIT_ERROR);
    expect(err[0]).toContain("Unknown command");
  });

  it("rejects an unknown option", () => {
    expect(runCli("--nope").code).toBe(EXIT_ERROR);
  });

  it("asks for an entry and text when check is incomplete", () => {
    expect(runCli("check", "--entry", "client-alpha").code).toBe(EXIT_ERROR);
    expect(runCli("check", "some", "text").code).toBe(EXIT_ERROR);
  });

  it("allows text that mentions no entry", () => {
    expect(runCli("check", "--entry", "client-alpha", "open", "notes.md")).toEqual({
      code: EXIT_OK,
      out: ["allowed"],
      err: [],
    });
  });

  it("blocks with the standard message, without naming the entry (US-007)", () => {
    const { code, out, err } = runCli(
      "check",
      "--entry",
      "client-alpha",
      "cat",
      "Client_Alpha.txt",
    );
    expect(code).toBe(EXIT_BLOCKED);
    expect(out).toEqual([]);
    expect(err).toEqual([BLOCKED_MESSAGE]);
    expect(err.join("\n").toLowerCase()).not.toContain("alpha");
  });
});
