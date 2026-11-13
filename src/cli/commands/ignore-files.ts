import { join } from "node:path";
import {
  GENERATED_MARKER,
  IGNORE_TARGETS,
  ignorePatterns,
  renderIgnoreFile,
} from "../../core/ignore.js";
import { EXIT_OK } from "../../core/signal.js";
import { type Deps, confirm, loadForOwner, requireTerminal } from "../deps.js";

/**
 * US-014: writes the ignore files other assistants read, from the one policy. It holds the
 * owner's entries in plain text, so it runs only for a person at a terminal, asks before writing,
 * never replaces a file it did not write, and offers to keep the files out of git.
 */
export async function ignoreFilesCommand(folder: string | undefined, deps: Deps): Promise<number> {
  const blocked = requireTerminal(deps);
  if (blocked !== undefined) return blocked;

  const loaded = loadForOwner(deps);
  if ("exit" in loaded) return loaded.exit;

  const dir = folder ?? deps.match.cwd;
  const patterns = ignorePatterns(loaded.policy, dir, deps.previewMatch);
  const { notFiles, outsideFolder } = patterns.skipped;

  deps.io.stdout(`${String(patterns.lines.length)} patterns, for ${dir}.`);
  if (notFiles > 0) {
    deps.io.stdout(
      `${String(notFiles)} entries (variables, hosts, commands, conversations, expressions) cannot be written as file patterns.`,
    );
  }
  if (outsideFolder > 0) {
    deps.io.stdout(`${String(outsideFolder)} entries point outside this folder and were left out.`);
  }
  if (patterns.lines.length === 0) {
    deps.io.stdout("Nothing to write.");
    return EXIT_OK;
  }

  const writable = IGNORE_TARGETS.filter((target) => {
    const existing = deps.files.read(join(dir, target.file));
    if (existing === undefined || existing.includes(GENERATED_MARKER)) return true;
    deps.io.stdout(
      `${target.file} already exists and was not written by Off-Limits, so it is left alone.`,
    );
    return false;
  });
  if (writable.length === 0) return EXIT_OK;

  deps.io.stdout(`Files: ${writable.map((target) => target.file).join(", ")}`);
  deps.io.stdout(
    "They hide matching files from each tool's listings, search and context. Commands run in a terminal may still reach them.",
  );
  if (!(await confirm(deps, "Write these files?"))) {
    deps.io.stdout("Nothing changed.");
    return EXIT_OK;
  }
  for (const target of writable) {
    deps.files.write(join(dir, target.file), renderIgnoreFile(target, patterns));
  }
  deps.io.stdout("Written.");

  const exclude = join(dir, ".git", "info", "exclude");
  if (deps.files.isDirectory(join(dir, ".git"))) {
    const current = deps.files.read(exclude) ?? "";
    const missing = writable
      .map((target) => target.file)
      .filter((file) => !current.split("\n").includes(file));
    if (missing.length > 0) {
      deps.io.stdout("These files hold your entries in plain text.");
      if (
        await confirm(deps, "Add them to .git/info/exclude so they stay out of the repository?")
      ) {
        deps.files.append(
          exclude,
          `${current === "" || current.endsWith("\n") ? "" : "\n"}${missing.join("\n")}\n`,
        );
        deps.io.stdout("Added.");
      }
    }
  }
  return EXIT_OK;
}
