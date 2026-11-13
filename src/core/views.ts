/**
 * Other readings of the same text. A shell, a decoder or a person treats these as the thing they
 * stand for, so the matcher checks them as well as the text as written. Each view is built only
 * when the text shows signs of needing it, and every one is bounded. Everything is text work: no
 * command is run, and no file is read.
 */
import type { Env } from "./env.js";

const code = (...points: number[]): string => String.fromCharCode(...points);

/** Zero-width characters, the soft hyphen and the byte order mark: invisible when printed. */
const INVISIBLE = new RegExp(`[${code(0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad)}]`, "gu");
/** A terminal colour or cursor sequence: ESC, then `[`, then parameters, then a letter. */
const ANSI = new RegExp(`${code(0x1b)}\\[[0-9;?]*[ -/]*[@-~]`, "gu");

const MAX_TOKENS = 10_000;
const MIN_ENCODED_LENGTH = 8;

/** Takes out what is invisible when printed, and terminal colour sequences. */
export function stripInvisible(text: string): string {
  return text.replace(ANSI, "").replace(INVISIBLE, "");
}

/**
 * Reads shell quoting as the shell does: `cl"ient"-al'pha'` and `cl\ient` both mean `client`.
 * A backslash before a letter or digit is dropped, which also mangles a Windows path in this view;
 * that is harmless, because the text as written is still checked.
 */
export function removeShellQuoting(text: string): string {
  return text.replace(/["']/gu, "").replace(/\\(?=[A-Za-z0-9._-])/gu, "");
}

/** Decodes `%63`, `\x63`, `\u0063` and `\143` (octal), the ways text is spelled with codes. */
export function decodeEscapes(text: string): string {
  return text
    .replace(/%([0-9a-fA-F]{2})/gu, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/gu, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/gu, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/gu, (_, hex: string) =>
      String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)),
    )
    .replace(/\\([0-7]{3})/gu, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}

const printable = (text: string): boolean => {
  if (text.length < 4) return false;
  let good = 0;
  for (const char of text) {
    const point = char.codePointAt(0) ?? 0;
    if ((point >= 0x20 && point < 0x7f) || point === 0x0a || point === 0x09) good++;
  }
  return good / text.length >= 0.9;
};

/** Text that base64 or hex tokens in the input decode to, when it reads as text. */
export function decodeTokens(text: string): string[] {
  const decoded: string[] = [];
  const tokens = text.split(/[\s"'`=,;()<>|&:]+/u).slice(0, MAX_TOKENS);
  for (const token of tokens) {
    if (token.length < MIN_ENCODED_LENGTH) continue;
    let bytes: Buffer | undefined;
    if (/^(?:[0-9a-fA-F]{2})+$/u.test(token)) bytes = Buffer.from(token, "hex");
    else if (/^[A-Za-z0-9+/_-]+={0,2}$/u.test(token)) bytes = Buffer.from(token, "base64");
    if (!bytes) continue;
    const text = bytes.toString("utf8");
    if (printable(text)) decoded.push(text);
  }
  return decoded;
}

/** Variable assignments written in the text itself: `d=client`, `set d=client`, `$d = "client"`. */
function assignments(text: string): Record<string, string> {
  const found: Record<string, string> = {};
  const unquote = (value: string): string => value.replace(/^["']|["']$/gu, "");
  for (const match of text.matchAll(
    /(?:^|[\s;&|(])(?:set\s+)?([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|'[^']*'|[^\s;&|)]*)/gu,
  )) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) found[name] = unquote(value);
  }
  for (const match of text.matchAll(
    /\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("[^"]*"|'[^']*'|[^\s;]+)/gu,
  )) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) found[name] = unquote(value);
  }
  return found;
}

/**
 * Replaces `$NAME`, `${NAME}`, `%NAME%` and `$env:NAME` with their values: those set in the text
 * itself first, then those in the environment. Done a few times, so one variable may hold another.
 */
export function expandVariables(text: string, env: Env): string {
  const own = assignments(text);
  const lookup = (name: string): string | undefined => own[name] ?? env[name];
  let result = text;
  for (let pass = 0; pass < 3; pass++) {
    const next = result.replace(
      /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$env:([A-Za-z_][A-Za-z0-9_]*)|\$([A-Za-z_][A-Za-z0-9_]*)|%([A-Za-z_][A-Za-z0-9_]*)%/gu,
      (whole, braced?: string, ps?: string, bare?: string, percent?: string) =>
        lookup(braced ?? ps ?? bare ?? percent ?? "") ?? whole,
    );
    if (next === result) break;
    result = next;
  }
  return result;
}

/**
 * Every extra reading worth checking, besides the text as written: invisible characters removed,
 * then each combination of codes decoded, variables filled in and quoting removed, and encoded
 * tokens decoded. A reading identical to the text is left out.
 */
export function textViews(text: string, env: Env): string[] {
  const views = new Set<string>();
  const add = (view: string): void => {
    if (view !== text && view.length > 0) views.add(view);
  };

  const invisible = stripInvisible(text);
  add(invisible);

  // Each step that the text shows signs of needing. Every combination of them is tried, always in
  // this order: codes first (so quoting removal does not eat the backslash of `\x63`), variables
  // next, quoting last (so `"$d"-alpha` resolves). Combinations matter because a step can mangle
  // text that the others need, such as quoting removal on a Windows path.
  const steps: ((value: string) => string)[] = [];
  if (/%[0-9a-fA-F]{2}|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F{]|\\[0-7]{3}/u.test(invisible)) {
    steps.push(decodeEscapes);
  }
  if (/\$|%[A-Za-z_]/u.test(invisible)) steps.push((value) => expandVariables(value, env));
  if (/["'\\]/u.test(invisible)) steps.push(removeShellQuoting);
  for (let chosen = 1; chosen < 1 << steps.length; chosen++) {
    let view = invisible;
    steps.forEach((step, index) => {
      if (chosen & (1 << index)) view = step(view);
    });
    add(view);
  }

  for (const decoded of decodeTokens(text)) add(decoded);
  return [...views];
}
