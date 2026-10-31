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
    expect(createFileStore(join(dir, "policy.yaml")).load()).toEqual({ status: "missing" });
  });

  it("saves and loads a policy, creating folders as needed", () => {
    const store = createFileStore(join(dir, "nested", "offlimits", "policy.yaml"));
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

  it("writes a file the owner can read as plain YAML with a header", () => {
    const path = join(dir, "policy.yaml");
    createFileStore(path).save({ version: 1, entries: [entry("name", "client-alpha")] });
    const text = readFileSync(path, "utf8");
    expect(text.startsWith("# Your Off-Limits policy")).toBe(true);
    expect(text).toContain("value: client-alpha");
  });

  it("leaves no temporary file behind", () => {
    createFileStore(join(dir, "policy.yaml")).save({ version: 1, entries: [] });
    expect(readdirSync(dir)).toEqual(["policy.yaml"]);
  });

  it.skipIf(process.platform === "win32")("creates the file and folder owner-only (US-001)", () => {
    const path = join(dir, "config", "policy.yaml");
    createFileStore(path).save({ version: 1, entries: [] });
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, "config")).mode & 0o777).toBe(0o700);
  });

  it("replaces an earlier policy", () => {
    const store = createFileStore(join(dir, "policy.yaml"));
    store.save({ version: 1, entries: [entry("name", "client-alpha")] });
    store.save({ version: 1, entries: [] });
    expect(store.load()).toEqual({ status: "ok", policy: { version: 1, entries: [] } });
  });

  it.each([
    ["not YAML at all", ": : :\n  - ["],
    ["an empty file", ""],
    ["the wrong shape", "just a string"],
    ["another version", "version: 2\nentries: []\n"],
    ["an alias", "version: 1\nentries: []\nx: &a 1\ny: *a\n"],
  ])("fails closed on %s", (_name, text) => {
    const path = join(dir, "policy.yaml");
    writeFileSync(path, text);
    const result = createFileStore(path).load();
    expect(result.status).toBe("invalid");
  });

  it("reports a bad entry by position, without repeating anything from the file (names stay out)", () => {
    const path = join(dir, "policy.yaml");
    writeFileSync(
      path,
      "version: 1\nentries:\n  - kind: name\n    mode: hide\n    value: client-alpha\n    bogus: client-alpha\n",
    );
    const result = createFileStore(path).load();
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.problems.length).toBeGreaterThan(0);
      expect(result.problems.join(" ").toLowerCase()).not.toContain("alpha");
    }
  });

  it("treats a path that is a folder as unreadable rather than missing", () => {
    const path = join(dir, "policy.yaml");
    mkdirSync(path);
    expect(createFileStore(path).load().status).toBe("invalid");
  });
});
