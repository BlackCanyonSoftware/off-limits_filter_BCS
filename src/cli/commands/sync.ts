import { blindKeyProblem } from "../../core/blind.js";
import { EXIT_ERROR, EXIT_OK } from "../../core/signal.js";
import { parsePolicy } from "../../core/policy.js";
import { type Deps, confirm, requireTerminal } from "../deps.js";

/** The byte order mark some Windows editors add to the front of a UTF-8 file. */
const withoutByteOrderMark = (text: string): string =>
  text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

/**
 * US-019: brings this machine's policy in step with one kept somewhere else, such as a synced
 * folder or a share, by pulling it from a file path. The source is read and checked before
 * anything changes; if it is missing, unreadable or not a valid policy, the policy already here is
 * kept and nothing is replaced. It names no entry. It only reads a path, never a network address
 * (the tool works offline), and it runs only at a terminal, because it replaces the list.
 */
export async function syncCommand(source: string | undefined, deps: Deps): Promise<number> {
  const blocked = requireTerminal(deps);
  if (blocked !== undefined) return blocked;

  const from = source ?? deps.syncSource;
  if (from === undefined || from === "") {
    deps.io.stderr(
      "sync needs a source file: offlimits sync <file>, or set OFFLIMITS_SYNC_SOURCE.",
    );
    return EXIT_ERROR;
  }

  const text = deps.files.read(from);
  if (text === undefined) {
    deps.io.stderr(`Could not read ${from}. Your policy is unchanged.`);
    return EXIT_ERROR;
  }
  let data: unknown;
  try {
    data = JSON.parse(withoutByteOrderMark(text));
  } catch {
    deps.io.stderr("The source is not valid JSON. Your policy is unchanged.");
    return EXIT_ERROR;
  }
  const parsed = parsePolicy(data);
  if (!parsed.ok) {
    deps.io.stderr("The source is not a valid policy. Your policy is unchanged.");
    return EXIT_ERROR;
  }

  const current = deps.store.load();
  const have = current.status === "ok" ? current.policy.entries.length : 0;
  if (current.status === "ok" && JSON.stringify(current.policy) === JSON.stringify(parsed.policy)) {
    deps.io.stdout(`Already in step (${String(have)} entries).`);
    return EXIT_OK;
  }

  const question =
    current.status === "ok"
      ? `Replace your policy (${String(have)} entries) with the one from ${from} (${String(parsed.policy.entries.length)} entries)?`
      : `Use the policy from ${from} (${String(parsed.policy.entries.length)} entries)?`;
  if (!(await confirm(deps, question))) {
    deps.io.stdout("Nothing changed.");
    return EXIT_OK;
  }
  deps.store.save(parsed.policy);
  deps.io.stdout(`Done. You now have ${String(parsed.policy.entries.length)} entries.`);

  const problem = blindKeyProblem(
    parsed.policy,
    deps.blind.hasKey ? deps.blind.ensureKey() : undefined,
  );
  if (problem === "wrong-key" || problem === "no-key-check") {
    deps.io.stdout(
      "The key here does not fit this policy's blind entries. The guard refuses everything until the right key is installed.",
    );
  }
  if (parsed.policy.entries.some((entry) => entry.kind === "blind") && !deps.blind.hasKey) {
    deps.io.stdout(
      `This policy has blind entries and there is no key here. The guard refuses everything until the key is at ${deps.blind.keyPath} (or in OFFLIMITS_BLIND_KEY).`,
    );
  }
  return EXIT_OK;
}
