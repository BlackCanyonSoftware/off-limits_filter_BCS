import { normalise } from "./normalise.js";

/** A keyed hash of an already-normalised name: the only thing a blind entry stores. */
export type BlindHasher = (normalisedName: string) => string;

/** A blind entry's value: a 256-bit hash, as 64 hex digits. */
export const BLIND_HASH = /^[0-9a-f]{64}$/u;

/** The longest name, in words, that a blind entry can match (`client-alpha` is two). */
const MAX_WORDS = 4;
/** A word list longer than this in one run is a blob, not a name. */
const MAX_WORD_LENGTH = 64;

const WORD = /[\p{L}\p{N}]+/gu;
/** Between the words of one name: a hyphen, an underscore or spaces. */
const NAME_SEPARATOR = /^[-_ \t]+$/u;

/** A fixed text hashed under the key, so a wrong key can be told apart from the right one. */
const KEY_CHECK_TEXT = "offlimits-key-check";

/** The key check value a policy with blind entries carries (`keyCheck`). It reveals nothing about the key. */
export function keyCheckFor(hash: BlindHasher): string {
  return hash(KEY_CHECK_TEXT);
}

/**
 * Whether the key in hand can read a policy's blind entries. A policy with blind entries must carry
 * a key check, and the key must reproduce it: otherwise every blind entry would silently match
 * nothing, which would allow what the owner meant to hide. A policy without blind entries needs no
 * key. The answer names no entry.
 */
export function blindKeyProblem(
  policy: {
    readonly keyCheck?: string | undefined;
    readonly entries: readonly { readonly kind: string }[];
  },
  hash: BlindHasher | undefined,
): "no-key" | "no-key-check" | "wrong-key" | undefined {
  if (!policy.entries.some((entry) => entry.kind === "blind")) return undefined;
  if (hash === undefined) return "no-key";
  if (policy.keyCheck === undefined) return "no-key-check";
  return keyCheckFor(hash) === policy.keyCheck ? undefined : "wrong-key";
}

/** The hash a blind entry stores for a name, however the name is spelled. */
export function blindValueFor(name: string, hash: BlindHasher): string {
  return hash(normalise(name));
}

/**
 * Every whole word, and every run of up to four words joined by hyphens, underscores or spaces, in
 * the text, normalised the way a name is. A blind entry is checked against these, so it matches
 * `client-alpha`, `Client_Alpha` and `client alpha`, but not `myclientalphafolder`, where the name
 * is embedded in a longer word. That is the price of storing only a hash.
 */
export function blindCandidates(text: string): Set<string> {
  const candidates = new Set<string>();
  let run: string[] = [];
  let lastEnd = 0;

  const flush = (): void => {
    for (let start = 0; start < run.length; start++) {
      let joined = "";
      for (let end = start; end < run.length && end < start + MAX_WORDS; end++) {
        joined += run[end] ?? "";
        candidates.add(joined);
      }
    }
    run = [];
  };

  for (const match of text.matchAll(WORD)) {
    const word = match[0];
    if (word.length > MAX_WORD_LENGTH) {
      flush();
      lastEnd = match.index + word.length;
      continue;
    }
    const gap = text.slice(lastEnd, match.index);
    if (run.length > 0 && !NAME_SEPARATOR.test(gap)) flush();
    run.push(normalise(word));
    lastEnd = match.index + word.length;
  }
  flush();
  return candidates;
}

/** True when any candidate in the text hashes to `value`. */
export function blindMatches(value: string, text: string, hash: BlindHasher): boolean {
  for (const candidate of blindCandidates(text)) {
    if (candidate.length > 0 && hash(candidate) === value) return true;
  }
  return false;
}
