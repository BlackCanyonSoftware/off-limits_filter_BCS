import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFileStore } from "../../src/platform/policy-store.js";
import { entry } from "../helpers/context.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "offlimits-store-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("file policy store", () => {
  it("reports a missing file", () => {
    expect(createFileStore(join(dir, "policy.json")).load()).toEqual({ status: "missing" });
  });

  it("saves and loads a policy, creating folders as needed", () => {
    const store = createFileStore(join(dir, "nested", "offlimits", "policy.json"));
    const policy = {
      version: 1 as const,
      entries: [
        entry("name", "client-alpha"),
        {
          kind: "host" as const,
          mode: "forbid" as const,
          value: "internal.example.com",
          assistants: ["claude-code"],
          note: "staging",
        },
      ],
    };
    store.save(policy);
    expect(store.load()).toEqual({ status: "ok", policy });
  });

  it("writes a file the owner can read, as indented JSON", () => {
    const path = join(dir, "policy.json");
    createFileStore(path).save({ version: 1, entries: [entry("name", "client-alpha")] });
    const text = readFileSync(path, "utf8");
    expect(text).toContain('  "version": 1');
    expect(text).toContain('"value": "client-alpha"');
    expect(text.endsWith("\n")).toBe(true);
  });

  it("leaves no temporary file behind", () => {
    createFileStore(join(dir, "policy.json")).save({ version: 1, entries: [] });
    expect(readdirSync(dir)).toEqual(["policy.json"]);
  });

  it.skipIf(process.platform === "win32")("creates the file and folder owner-only (US-001)", () => {
    const path = join(dir, "config", "policy.json");
    createFileStore(path).save({ version: 1, entries: [] });
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, "config")).mode & 0o777).toBe(0o700);
  });

  it("replaces an earlier policy", () => {
    const store = createFileStore(join(dir, "policy.json"));
    store.save({ version: 1, entries: [entry("name", "client-alpha")] });
    store.save({ version: 1, entries: [] });
    expect(store.load()).toEqual({ status: "ok", policy: { version: 1, entries: [] } });
  });

  it("accepts a file that starts with a byte order mark", () => {
    const path = join(dir, "policy.json");
    writeFileSync(
      path,
      `${String.fromCharCode(0xfeff)}${JSON.stringify({ version: 1, entries: [] })}`,
    );
    expect(createFileStore(path).load().status).toBe("ok");
  });

  it.each([
    ["not JSON at all", "{ not json"],
    ["an empty file", ""],
    ["the wrong shape", '"just a string"'],
    ["another version", '{"version": 2, "entries": []}'],
    ["an unknown field", '{"version": 1, "entries": [], "extra": true}'],
    ["a file that is too large", `{"version": 1, "entries": [], "x": "${"a".repeat(1_100_000)}"}`],
  ])("fails closed on %s", (_name, text) => {
    const path = join(dir, "policy.json");
    writeFileSync(path, text);
    expect(createFileStore(path).load().status).toBe("invalid");
  });

  it("reports a bad entry by position, without repeating anything from the file (names stay out)", () => {
    const path = join(dir, "policy.json");
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        entries: [
          { kind: "name", mode: "hide", value: "client-alpha" },
          { kind: "env", mode: "hide", value: "client alpha" },
        ],
      }),
    );
    const result = createFileStore(path).load();
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      const text = result.problems.join(" ");
      expect(text).toContain("entries.1");
      expect(text.toLowerCase()).not.toContain("alpha");
    }
  });

  it("does not repeat anything from a file that is not JSON (names stay out)", () => {
    const path = join(dir, "policy.json");
    writeFileSync(path, "client-alpha is not json");
    const result = createFileStore(path).load();
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.problems.join(" ").toLowerCase()).not.toContain("alpha");
    }
  });

  it("treats a path that is a folder as unreadable rather than missing", () => {
    const path = join(dir, "policy.json");
    mkdirSync(path);
    expect(createFileStore(path).load().status).toBe("invalid");
  });
});
