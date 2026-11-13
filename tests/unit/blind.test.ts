import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  blindCandidates,
  blindKeyProblem,
  blindMatches,
  blindValueFor,
  keyCheckFor,
} from "../../src/core/blind.js";
import { decide } from "../../src/core/match.js";
import { parseEntry, parsePolicy } from "../../src/core/policy.js";
import { describeEntry } from "../../src/cli/commands/list.js";
import { posixContext } from "../helpers/context.js";

// A fixed fake hasher: keyed by a made-up key, so a different key gives different hashes.
const hasher = (key: string) => (name: string) =>
  createHash("sha256").update(`${key}:${name}`).digest("hex");
const hash = hasher("key-one");
const alpha = blindValueFor("client-alpha", hash);
const b64 = (text: string): string => Buffer.from(text).toString("base64");

describe("blindCandidates (US-018)", () => {
  it("offers every whole word and every run of up to four words, joined", () => {
    const candidates = blindCandidates("cat client-alpha_beta gamma/notes.md");
    for (const wanted of [
      "cat",
      "client",
      "alpha",
      "beta",
      "clientalpha",
      "clientalphabeta",
      "gamma",
      "notes",
      "md",
    ]) {
      expect(candidates.has(wanted), wanted).toBe(true);
    }
  });

  it("joins words only across a hyphen, underscore or spaces, not across other characters", () => {
    const candidates = blindCandidates("client/alpha client.alpha client,alpha");
    expect(candidates.has("clientalpha")).toBe(false);
    expect(blindCandidates("client alpha").has("clientalpha")).toBe(true);
    expect(blindCandidates("client__ __alpha").has("clientalpha")).toBe(true);
  });

  it("normalises the way a name is: case and full-width letters", () => {
    expect(blindCandidates("CLIENT-Alpha").has("clientalpha")).toBe(true);
    expect(blindCandidates("ｃｌｉｅｎｔ-ａｌｐｈａ").has("clientalpha")).toBe(true);
  });

  it("skips a word too long to be a name, such as a base64 blob, without joining across it", () => {
    const candidates = blindCandidates(`client ${"x".repeat(80)} alpha`);
    expect(candidates.has("clientalpha")).toBe(false);
  });
});

describe("blindValueFor and blindMatches", () => {
  it("gives the same value for every spelling of a name", () => {
    expect(blindValueFor("Client Alpha", hash)).toBe(alpha);
    expect(blindValueFor("CLIENT_ALPHA", hash)).toBe(alpha);
    expect(blindValueFor("clientalpha", hash)).toBe(alpha);
  });

  it("gives a different value under a different key, so the hash alone is not the name", () => {
    expect(blindValueFor("client-alpha", hasher("key-two"))).not.toBe(alpha);
  });

  it.each([
    "cat client-alpha/notes.md",
    "cat Client_Alpha/notes.md",
    "ls client alpha",
    "cat ClientAlpha.txt",
    "/home/kyle/clients/CLIENT-ALPHA/x",
    "see the client-alpha folder",
  ])("matches a whole-word use: %s", (text) => {
    expect(blindMatches(alpha, text, hash)).toBe(true);
  });

  it.each([
    "cat notes.md",
    "cat client-beta/notes.md",
    "cat myclientalphafolder/x",
    "cat alpha-client/x",
  ])("does not match: %s", (text) => {
    expect(blindMatches(alpha, text, hash)).toBe(false);
  });

  it("matches a name of up to four words, and not five", () => {
    const four = blindValueFor("one two three four", hash);
    const five = blindValueFor("one two three four five", hash);
    expect(blindMatches(four, "x one-two-three-four y", hash)).toBe(true);
    expect(blindMatches(five, "x one-two-three-four-five y", hash)).toBe(false);
  });
});

describe("blind entries in a policy", () => {
  const policy = {
    version: 1 as const,
    entries: [{ kind: "blind" as const, mode: "hide" as const, value: alpha }],
  };

  it("are checked with the matcher's hasher, and see the same spellings other entries do", () => {
    const ctx = { ...posixContext(), blindHash: hash };
    expect(decide(policy, "cat client-alpha/x", ctx).blocked).toBe(true);
    expect(decide(policy, 'cat cl"ient"-alpha/x', ctx).blocked).toBe(true);
    expect(decide(policy, `echo ${b64("client-alpha")} | base64 -d`, ctx).blocked).toBe(true);
    expect(decide(policy, "d=client; cat ${d}-alpha/x", ctx).blocked).toBe(true);
    expect(decide(policy, "ls src", ctx).blocked).toBe(false);
  });

  it("count as a match when there is no hasher, so a missing key refuses rather than allows", () => {
    expect(decide(policy, "ls src", posixContext()).blocked).toBe(true);
  });

  it("must hold a 64-digit hash, and a bad value is rejected without repeating it", () => {
    expect(parseEntry({ kind: "blind", mode: "hide", value: alpha }).ok).toBe(true);
    const bad = parseEntry({ kind: "blind", mode: "hide", value: "client-alpha" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.problems.join(" ").toLowerCase()).not.toContain("alpha");
    expect(
      parsePolicy({ version: 1, entries: [{ kind: "blind", mode: "hide", value: "XYZ" }] }).ok,
    ).toBe(false);
  });

  it("are listed by the start of their hash only", () => {
    const [first] = policy.entries;
    if (!first) throw new Error("the policy has no entry");
    const line = describeEntry(first);
    expect(line).toBe(`[hide] blind: ${alpha.slice(0, 8)}…`);
    expect(line).not.toContain(alpha);
  });
});

describe("blindKeyProblem: a wrong key must never silently allow", () => {
  const entries = [{ kind: "blind" }];
  const check = keyCheckFor(hash);

  it("needs no key when there are no blind entries", () => {
    expect(blindKeyProblem({ entries: [{ kind: "name" }] }, undefined)).toBeUndefined();
  });

  it("says which problem: no key, no key check in the policy, or the wrong key", () => {
    expect(blindKeyProblem({ entries, keyCheck: check }, undefined)).toBe("no-key");
    expect(blindKeyProblem({ entries }, hash)).toBe("no-key-check");
    expect(blindKeyProblem({ entries, keyCheck: check }, hasher("key-two"))).toBe("wrong-key");
  });

  it("is satisfied by the key that made the check, and the check reveals nothing about the key or the names", () => {
    expect(blindKeyProblem({ entries, keyCheck: check }, hash)).toBeUndefined();
    expect(check).toMatch(/^[0-9a-f]{64}$/u);
    expect(check).not.toBe(alpha);
  });
});
