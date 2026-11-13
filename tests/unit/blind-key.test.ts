import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { blindValueFor } from "../../src/core/blind.js";
import { createBlindKey, hasherFor, loadBlindKey } from "../../src/platform/blind-key.js";
import { blindKeyPath } from "../../src/platform/paths.js";

let dir: string;
let keyFile: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "offlimits-key-"));
  keyFile = join(dir, "blind.key");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("the blind key (US-018)", () => {
  it("is 32 random bytes written as 64 hex digits, and is different each time", () => {
    const first = createBlindKey(keyFile);
    expect(first).toHaveLength(32);
    expect(readFileSync(keyFile, "utf8")).toMatch(/^[0-9a-f]{64}\n$/u);
    const other = createBlindKey(join(dir, "other.key"));
    expect(first.equals(other)).toBe(false);
  });

  it.skipIf(process.platform === "win32")("is readable by its owner only", () => {
    createBlindKey(keyFile);
    expect(statSync(keyFile).mode & 0o777).toBe(0o600);
  });

  it("never replaces a key that exists", () => {
    createBlindKey(keyFile);
    const before = readFileSync(keyFile, "utf8");
    expect(() => createBlindKey(keyFile)).toThrow();
    expect(readFileSync(keyFile, "utf8")).toBe(before);
  });

  it("is loaded from the file, or from OFFLIMITS_BLIND_KEY, which wins", () => {
    const made = createBlindKey(keyFile);
    expect(loadBlindKey(keyFile, {})?.equals(made)).toBe(true);
    const fromEnv = "ab".repeat(32);
    expect(loadBlindKey(keyFile, { OFFLIMITS_BLIND_KEY: fromEnv })?.toString("hex")).toBe(fromEnv);
  });

  it.each([
    ["missing", undefined],
    ["too short", "abcd"],
    ["not hex", "zz".repeat(32)],
    ["empty", ""],
  ])("is not a usable key when the file is %s", (_name, text) => {
    if (text !== undefined) writeFileSync(keyFile, text);
    expect(loadBlindKey(keyFile, {})).toBeUndefined();
  });

  it("is not a usable key when the variable is set to something that is not one (no fallback to the file)", () => {
    createBlindKey(keyFile);
    expect(loadBlindKey(keyFile, { OFFLIMITS_BLIND_KEY: "not-a-key" })).toBeUndefined();
  });

  it("makes a keyed hash: 64 hex digits, steady for a key, different for another", () => {
    const one = hasherFor(Buffer.from("01".repeat(32), "hex"));
    const two = hasherFor(Buffer.from("02".repeat(32), "hex"));
    expect(one("clientalpha")).toMatch(/^[0-9a-f]{64}$/u);
    expect(one("clientalpha")).toBe(one("clientalpha"));
    expect(one("clientalpha")).not.toBe(two("clientalpha"));
    expect(blindValueFor("Client-Alpha", one)).toBe(one("clientalpha"));
  });

  it("lives beside the policy file", () => {
    expect(blindKeyPath({}, "linux", "/home/kyle")).toBe("/home/kyle/.config/offlimits/blind.key");
    expect(blindKeyPath({ OFFLIMITS_POLICY: "/tmp/x/policy.json" }, "linux", "/home/kyle")).toBe(
      "/tmp/x/blind.key",
    );
  });
});
