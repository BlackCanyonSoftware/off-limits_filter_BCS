import { normalise } from "./normalise.js";
import type { Entry } from "./policy.js";

export type EntryWarning = "short" | "common";

const MIN_NORMALISED_LENGTH = 4;

/** Everyday words that appear in ordinary project work, so an entry made of one blocks a lot. */
const COMMON_WORDS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "app",
  "apps",
  "assets",
  "backup",
  "bin",
  "build",
  "code",
  "config",
  "data",
  "demo",
  "dev",
  "dist",
  "doc",
  "docs",
  "example",
  "file",
  "files",
  "home",
  "images",
  "index",
  "lib",
  "log",
  "logs",
  "main",
  "misc",
  "name",
  "new",
  "node",
  "notes",
  "old",
  "private",
  "prod",
  "project",
  "public",
  "readme",
  "secret",
  "src",
  "temp",
  "test",
  "tests",
  "tmp",
  "user",
  "users",
  "work",
]);

/** Things worth telling the owner before an entry is added, because it may catch ordinary work. */
export function warningsFor(entry: Entry): EntryWarning[] {
  const value = normalise(entry.value);
  const warnings: EntryWarning[] = [];
  if (value.length < MIN_NORMALISED_LENGTH) warnings.push("short");
  if (COMMON_WORDS.has(value)) warnings.push("common");
  return warnings;
}
