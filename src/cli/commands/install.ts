import {
  UnsupportedSettingsError,
  hasGuard,
  withGuard,
  withoutGuard,
} from "../../adapters/claude-code/settings.js";
import { EXIT_ERROR, EXIT_OK } from "../../core/signal.js";
import { type Deps, confirm, loadForOwner, requireTerminal } from "../deps.js";

/** The Claude Code version that added the setting which makes a failed hook refuse the call. */
const MINIMUM_CLAUDE_CODE = "2.1.295";

/** US-006: registers the guard with Claude Code, alongside any hooks already there. */
export async function installCommand(
  settingsPath: string | undefined,
  deps: Deps,
): Promise<number> {
  const blocked = requireTerminal(deps);
  if (blocked !== undefined) return blocked;

  const loadedPolicy = loadForOwner(deps);
  if ("exit" in loadedPolicy) return loadedPolicy.exit;

  const store = deps.openSettings(settingsPath);
  const loaded = store.load();
  if (loaded.status === "invalid") {
    deps.io.stderr(`${store.path} could not be read as JSON, so nothing was changed.`);
    return EXIT_ERROR;
  }
  const current = loaded.status === "ok" ? loaded.settings : {};

  let updated;
  try {
    updated = withGuard(current, deps.guardCommand);
  } catch (error) {
    if (!(error instanceof UnsupportedSettingsError)) throw error;
    deps.io.stderr(
      `The hooks in ${store.path} are not in a shape this can change safely, so nothing was changed.`,
    );
    return EXIT_ERROR;
  }

  const verb = hasGuard(current) ? "Update the guard in" : "Add the guard to";
  if (!(await confirm(deps, `${verb} ${store.path}?`))) {
    deps.io.stdout("Nothing changed.");
    return EXIT_OK;
  }
  const { backup } = store.save(updated);
  deps.io.stdout(
    `Installed. The guard now checks every tool call Claude Code makes, before it runs.`,
  );
  if (backup) deps.io.stdout(`Your original settings were saved to ${backup}.`);
  deps.io.stdout(
    `Claude Code ${MINIMUM_CLAUDE_CODE} or later is needed for the guard to refuse a call safely if it ever cannot run. Check with \`claude --version\`.`,
  );
  deps.io.stdout(
    "Add the notice for your assistant to AGENTS.md or CLAUDE.md with `offlimits snippet`.",
  );
  return EXIT_OK;
}

/** Removes the guard from Claude Code's settings. Other hooks are left alone. */
export async function uninstallCommand(
  settingsPath: string | undefined,
  deps: Deps,
): Promise<number> {
  const blocked = requireTerminal(deps);
  if (blocked !== undefined) return blocked;

  const store = deps.openSettings(settingsPath);
  const loaded = store.load();
  if (loaded.status === "missing") {
    deps.io.stdout(`There is no settings file at ${store.path}, so there is nothing to remove.`);
    return EXIT_OK;
  }
  if (loaded.status === "invalid") {
    deps.io.stderr(`${store.path} could not be read as JSON, so nothing was changed.`);
    return EXIT_ERROR;
  }

  let result;
  try {
    result = withoutGuard(loaded.settings);
  } catch (error) {
    if (!(error instanceof UnsupportedSettingsError)) throw error;
    deps.io.stderr(
      `The hooks in ${store.path} are not in a shape this can change safely, so nothing was changed.`,
    );
    return EXIT_ERROR;
  }
  if (result.removed === 0) {
    deps.io.stdout("The guard is not installed there.");
    return EXIT_OK;
  }
  if (!(await confirm(deps, `Remove the guard from ${store.path}?`))) {
    deps.io.stdout("Nothing changed.");
    return EXIT_OK;
  }
  store.save(result.settings);
  deps.io.stdout("Removed. Claude Code no longer runs the guard.");
  return EXIT_OK;
}
