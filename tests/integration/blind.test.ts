import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { blindValueFor, keyCheckFor } from "../../src/core/blind.js";
import { BLOCKED_MESSAGE, EXIT_BLOCKED, EXIT_OK } from "../../src/core/signal.js";
import { hasherFor } from "../../src/platform/blind-key.js";

const dist = (path: string): string =>
  fileURLToPath(new URL(`../../dist/${path}`, import.meta.url));
const GUARD = dist("guard-cjs/guard/main.js");
const FILTER = dist("guard-cjs/filter/main.js");
const CLI = dist("cli/main.js");

const KEY_HEX = "7f".repeat(32);
const hash = hasherFor(Buffer.from(KEY_HEX, "hex"));

let dir: string;
let policyFile: string;
let keyFile: string;

const env = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => {
  const copy: NodeJS.ProcessEnv = {
    ...process.env,
    OFFLIMITS_POLICY: policyFile,
    OFFLIMITS_DEBUG: "",
    ...extra,
  };
  delete copy.OFFLIMITS_BLIND_KEY;
  return { ...copy, ...extra };
};
const guard = (command: string, extra: Record<string, string> = {}) =>
  spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify({ tool_name: "Bash", cwd: dir, tool_input: { command } }),
    encoding: "utf8",
    env: env(extra),
  });
const filter = (text: string, extra: Record<string, string> = {}) =>
  spawnSync(process.execPath, [FILTER], { input: text, encoding: "utf8", env: env(extra) });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "offlimits-blind-"));
  policyFile = join(dir, "policy.json");
  keyFile = join(dir, "blind.key");
  writeFileSync(keyFile, `${KEY_HEX}\n`);
  writeFileSync(
    policyFile,
    JSON.stringify({
      version: 1,
      entries: [{ kind: "blind", mode: "hide", value: blindValueFor("project-nightingale", hash) }],
      keyCheck: keyCheckFor(hash),
    }),
  );
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("the guard with a blind entry (US-018)", () => {
  it("refuses the made-up name in any common spelling, and allows ordinary work", () => {
    for (const command of [
      "cat Project_Nightingale/notes.md",
      "cat project-nightingale",
      'cat pr"oject"-nightingale/x',
      `echo ${Buffer.from("project-nightingale").toString("base64")} | base64 -d`,
    ]) {
      const result = guard(command);
      expect(result.status, command).toBe(EXIT_BLOCKED);
      expect(result.stderr.trim()).toBe(BLOCKED_MESSAGE);
    }
    expect(guard("git status && npm test").status).toBe(EXIT_OK);
  });

  it("does not match the name inside a longer word, which is the price of storing only a hash", () => {
    expect(guard("cat myprojectnightingalefolder/x").status).toBe(EXIT_OK);
  });

  it("reads the key from OFFLIMITS_BLIND_KEY when there is no file", () => {
    rmSync(keyFile);
    expect(guard("cat project-nightingale").status).toBe(EXIT_BLOCKED);
    expect(guard("cat project-nightingale", { OFFLIMITS_BLIND_KEY: KEY_HEX }).status).toBe(
      EXIT_BLOCKED,
    );
    expect(guard("ls src", { OFFLIMITS_BLIND_KEY: KEY_HEX }).status).toBe(EXIT_OK);
  });

  it("refuses everything when the key is missing, rather than allowing", () => {
    rmSync(keyFile);
    const result = guard("ls src");
    expect(result.status).toBe(EXIT_BLOCKED);
    expect(result.stderr.trim()).toBe(BLOCKED_MESSAGE);
  });

  it("refuses everything when the key is wrong, because then nothing can be checked", () => {
    writeFileSync(keyFile, "not a key\n");
    expect(guard("ls src").status).toBe(EXIT_BLOCKED);
  });

  it("refuses everything when the key is well formed but is not the policy's key, instead of silently allowing", () => {
    writeFileSync(keyFile, `${"11".repeat(32)}\n`);
    for (const command of ["ls src", "cat project-nightingale"]) {
      const result = guard(command);
      expect(result.status, command).toBe(EXIT_BLOCKED);
      expect(result.stderr.trim()).toBe(BLOCKED_MESSAGE);
    }
  });

  it("refuses everything when the policy has blind entries but carries no key check", () => {
    writeFileSync(
      policyFile,
      JSON.stringify({
        version: 1,
        entries: [
          { kind: "blind", mode: "hide", value: blindValueFor("project-nightingale", hash) },
        ],
      }),
    );
    expect(guard("ls src").status).toBe(EXIT_BLOCKED);
  });

  it("refuses a session that tries to read the key file", () => {
    const result = spawnSync(process.execPath, [GUARD], {
      input: JSON.stringify({ tool_name: "Read", cwd: dir, tool_input: { file_path: keyFile } }),
      encoding: "utf8",
      env: env(),
    });
    expect(result.status).toBe(EXIT_BLOCKED);
  });

  it("does not refuse when the policy has no blind entries and there is no key", () => {
    writeFileSync(
      policyFile,
      JSON.stringify({
        version: 1,
        entries: [{ kind: "name", mode: "hide", value: "other-thing" }],
      }),
    );
    rmSync(keyFile);
    expect(guard("ls src").status).toBe(EXIT_OK);
  });
});

describe("the filter with a blind entry", () => {
  it("hides lines that hold the name, and passes the rest", () => {
    const result = filter("a\nProject_Nightingale-notes.md\nb\n");
    expect(result).toMatchObject({
      status: EXIT_OK,
      stdout: "a\n[offlimits:filtered] 1 line hidden\nb\n",
    });
  });

  it("prints nothing and exits 2 when the key is missing", () => {
    rmSync(keyFile);
    const result = filter("a\nb\n");
    expect(result.status).toBe(EXIT_BLOCKED);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe(BLOCKED_MESSAGE);
  });
});

describe("the filter with the wrong key", () => {
  it("prints nothing and exits 2", () => {
    writeFileSync(keyFile, `${"11".repeat(32)}\n`);
    const result = filter("a\nb\n");
    expect(result.status).toBe(EXIT_BLOCKED);
    expect(result.stdout).toBe("");
  });
});

describe("the CLI with a blind entry", () => {
  it("checks text against it, using the key beside the policy", () => {
    const blocked = spawnSync(process.execPath, [CLI, "check", "cat", "Project_Nightingale/x"], {
      encoding: "utf8",
      env: env(),
    });
    expect(blocked.status).toBe(EXIT_BLOCKED);
    const allowed = spawnSync(process.execPath, [CLI, "check", "cat", "README.md"], {
      encoding: "utf8",
      env: env(),
    });
    expect(allowed.status).toBe(EXIT_OK);
  });

  it("answers blocked for everything when the key is the wrong one", () => {
    writeFileSync(keyFile, `${"11".repeat(32)}\n`);
    const result = spawnSync(process.execPath, [CLI, "check", "cat", "README.md"], {
      encoding: "utf8",
      env: env(),
    });
    expect(result.status).toBe(EXIT_BLOCKED);
  });
});
