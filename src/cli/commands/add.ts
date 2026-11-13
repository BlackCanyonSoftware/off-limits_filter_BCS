import { type BlindHasher, blindKeyProblem, blindValueFor, keyCheckFor } from "../../core/blind.js";
import { entryMatches } from "../../core/match.js";
import { type Entry, addEntry, parseEntry } from "../../core/policy.js";
import { EXIT_ERROR, EXIT_OK } from "../../core/signal.js";
import { type EntryWarning, warningsFor } from "../../core/warnings.js";
import { type Deps, confirm, loadForOwner, requireTerminal } from "../deps.js";
import { describeEntry } from "./list.js";

export interface AddOptions {
  value: string | undefined;
  kind: string | undefined;
  mode: string | undefined;
  assistants: string[];
  note: string | undefined;
  /** Store only a keyed hash of the name (US-018). */
  blind: boolean;
}

const WARNING_TEXT: Record<EntryWarning, string> = {
  short: "Warning: this is short. It may match more than you intend.",
  common: "Warning: this is a common word. It may block ordinary work.",
};

/** The kinds whose effect on this folder can be shown by looking at file and folder names. */
const PREVIEWABLE: ReadonlySet<Entry["kind"]> = new Set(["name", "path", "glob", "regex"]);

async function previewLines(entry: Entry, deps: Deps): Promise<string[]> {
  if (!PREVIEWABLE.has(entry.kind)) {
    return ["A preview is not available for this kind of entry."];
  }
  const found = await deps.scanner.scan(deps.match.cwd, (relativePath) =>
    entryMatches(entry, relativePath, deps.previewMatch),
  );
  const count = `${String(found.files)} files, ${String(found.directories)} folders`;
  return [
    found.files + found.directories === 0
      ? "Nothing in this folder matches it."
      : `This would match, in this folder: ${count}${found.truncated ? " or more (the scan stopped early)" : ""}.`,
  ];
}

/** The blind form of a name entry: the same mode, scope and note, and only a keyed hash for value. */
function toBlind(entry: Entry, hash: BlindHasher): Entry {
  return {
    kind: "blind",
    mode: entry.mode,
    value: blindValueFor(entry.value, hash),
    ...(entry.assistants ? { assistants: entry.assistants } : {}),
    ...(entry.note !== undefined ? { note: entry.note } : {}),
  };
}

/**
 * US-002, US-005 and US-018: adds an entry after showing what it would catch, from a terminal
 * only. With `--blind` the name is stored only as a keyed hash (ADR 0012), using a key kept
 * outside the policy; the key is made only after the owner confirms.
 */
export async function addCommand(options: AddOptions, deps: Deps): Promise<number> {
  const blocked = requireTerminal(deps);
  if (blocked !== undefined) return blocked;

  const loaded = loadForOwner(deps);
  if ("exit" in loaded) return loaded.exit;

  const value =
    options.value ??
    (await deps.io.ask(
      "What should be kept off-limits? (Tab completes names from this folder) ",
      deps.suggest(deps.match.cwd),
    ));
  const parsed = parseEntry({
    kind: options.kind ?? "name",
    mode: options.mode ?? "hide",
    value,
    ...(options.assistants.length > 0 ? { assistants: options.assistants } : {}),
    ...(options.note !== undefined ? { note: options.note } : {}),
  });
  if (!parsed.ok) {
    for (const problem of parsed.problems) deps.io.stderr(problem);
    return EXIT_ERROR;
  }

  let existingHash: BlindHasher | undefined;
  if (options.blind) {
    if (parsed.entry.kind !== "name") {
      deps.io.stderr("--blind works with names only.");
      return EXIT_ERROR;
    }
    if (loaded.policy.entries.some((entry) => entry.kind === "blind") && !deps.blind.hasKey) {
      deps.io.stderr(
        `Your policy has blind entries, but there is no key on this machine (${deps.blind.keyPath}, or OFFLIMITS_BLIND_KEY). Install it first: a new key would orphan them.`,
      );
      return EXIT_ERROR;
    }
    if (deps.blind.hasKey) {
      existingHash = deps.blind.ensureKey();
      if (blindKeyProblem(loaded.policy, existingHash) === "wrong-key") {
        deps.io.stderr(
          `The key at ${deps.blind.keyPath} does not match this policy's blind entries, so nothing was added.`,
        );
        return EXIT_ERROR;
      }
    }
  }

  const plan = existingHash && options.blind ? toBlind(parsed.entry, existingHash) : parsed.entry;
  const added = addEntry(loaded.policy, plan);
  if (!added.ok) {
    deps.io.stderr("That entry is already on your list.");
    return EXIT_ERROR;
  }

  deps.io.stdout(
    options.blind
      ? `[${parsed.entry.mode}] blind: (stored only as a keyed hash)`
      : describeEntry(parsed.entry),
  );
  for (const line of await previewLines(parsed.entry, deps)) deps.io.stdout(line);
  for (const warning of warningsFor(parsed.entry)) deps.io.stdout(WARNING_TEXT[warning]);

  if (!(await confirm(deps, "Add it?"))) {
    deps.io.stdout("Nothing changed.");
    return EXIT_OK;
  }

  if (options.blind) {
    const stored = toBlind(parsed.entry, existingHash ?? deps.blind.ensureKey());
    const final = addEntry(loaded.policy, stored);
    if (!final.ok) {
      deps.io.stderr("That entry is already on your list.");
      return EXIT_ERROR;
    }
    const hasher = existingHash ?? deps.blind.ensureKey();
    deps.store.save({ ...final.policy, keyCheck: keyCheckFor(hasher) });
    deps.io.stdout("Added. The name itself is not written anywhere.");
    deps.io.stdout(
      `Keep the key at ${deps.blind.keyPath} out of any repository, and install it on every machine that uses this policy.`,
    );
    return EXIT_OK;
  }
  deps.store.save(added.policy);
  deps.io.stdout("Added.");
  return EXIT_OK;
}
