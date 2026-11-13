import { lineMatcher } from "../../core/filter.js";
import { EXIT_OK } from "../../core/signal.js";
import { type Deps, loadForOwner, requireTerminal } from "../deps.js";

const MAX_FILES_SHOWN = 15;
const MAX_PATHS_SHOWN = 5;

/**
 * US-015: shows where the owner's entries already appear (files in a folder, and git history),
 * so those places can be tidied. It shows locations, which are as sensitive as the entries, so it
 * runs only for a person at a terminal.
 */
export async function scanCommand(folder: string | undefined, deps: Deps): Promise<number> {
  const blocked = requireTerminal(deps);
  if (blocked !== undefined) return blocked;

  const loaded = loadForOwner(deps);
  if ("exit" in loaded) return loaded.exit;

  const dir = folder ?? deps.match.cwd;
  const matches = lineMatcher(loaded.policy, deps.scanMatch);
  const scan = await deps.contentScanner.scan(dir, matches);
  deps.io.stdout(
    `Looked at ${String(scan.filesRead)} files in ${dir}${scan.truncated ? " (stopped at the limit, so there may be more)" : ""}.`,
  );

  if (scan.hits.length === 0) {
    deps.io.stdout("None of them mention your entries.");
  } else {
    deps.io.stdout(`Files that mention your entries: ${String(scan.hits.length)}`);
    for (const hit of scan.hits.slice(0, MAX_FILES_SHOWN)) {
      const where = [
        hit.nameMatches ? "the file's own name" : "",
        hit.total > 0
          ? `${hit.total === 1 ? "line" : "lines"} ${hit.lines.join(", ")}${hit.total > hit.lines.length ? `, and ${String(hit.total - hit.lines.length)} more` : ""}`
          : "",
      ].filter((part) => part !== "");
      deps.io.stdout(`  ${hit.path}  (${where.join("; ")})`);
    }
    if (scan.hits.length > MAX_FILES_SHOWN) {
      deps.io.stdout(`  and ${String(scan.hits.length - MAX_FILES_SHOWN)} more files`);
    }
  }

  const history = deps.history(dir);
  if (history === undefined) {
    deps.io.stdout("There is no git history here to look at.");
  } else {
    const messages = history.messageLines.filter(matches).length;
    const paths = history.paths.filter(matches);
    deps.io.stdout(
      `In git history: ${String(messages)} commit message ${messages === 1 ? "line" : "lines"}, ${String(paths.length)} file ${paths.length === 1 ? "path" : "paths"}.`,
    );
    for (const path of paths.slice(0, MAX_PATHS_SHOWN)) deps.io.stdout(`  ${path}`);
    if (paths.length > MAX_PATHS_SHOWN) {
      deps.io.stdout(`  and ${String(paths.length - MAX_PATHS_SHOWN)} more paths`);
    }
  }

  deps.io.stdout(
    "A name in these places can show an assistant what something is called. Reword or remove it in your files; history needs a rewrite, which this tool does not do.",
  );
  return EXIT_OK;
}
