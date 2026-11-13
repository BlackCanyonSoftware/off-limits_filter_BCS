import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { BlindHasher } from "../core/blind.js";

const KEY_HEX = /^[0-9a-f]{64}$/u;

/**
 * The key that blind entries are hashed with: 32 random bytes, as 64 hex digits. It comes from the
 * environment variable `OFFLIMITS_BLIND_KEY` if set, otherwise from a file beside the policy. It is
 * kept out of the policy on purpose: the policy can then be shared, and the hashes in it mean
 * nothing without the key. Returns undefined if there is no usable key.
 */
export function loadBlindKey(
  path: string,
  env: Readonly<Record<string, string | undefined>>,
): Buffer | undefined {
  const fromEnv = env.OFFLIMITS_BLIND_KEY?.trim().toLowerCase();
  if (fromEnv !== undefined && fromEnv !== "") {
    return KEY_HEX.test(fromEnv) ? Buffer.from(fromEnv, "hex") : undefined;
  }
  try {
    const text = readFileSync(path, "utf8").trim().toLowerCase();
    return KEY_HEX.test(text) ? Buffer.from(text, "hex") : undefined;
  } catch {
    return undefined;
  }
}

/** Makes a new key in a file that is readable by its owner only. Never replaces one that exists. */
export function createBlindKey(path: string): Buffer {
  const key = randomBytes(32);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  // `wx` fails if the file exists, so an existing key is never overwritten.
  writeFileSync(path, `${key.toString("hex")}\n`, { mode: 0o600, flag: "wx" });
  return key;
}

/** The keyed hash (HMAC-SHA-256) that blind entries hold, as 64 hex digits. */
export function hasherFor(key: Buffer): BlindHasher {
  return (normalisedName) => createHmac("sha256", key).update(normalisedName, "utf8").digest("hex");
}
