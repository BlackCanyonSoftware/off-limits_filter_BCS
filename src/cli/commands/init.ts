import { emptyPolicy } from "../../core/policy.js";
import { EXIT_ERROR, EXIT_OK } from "../../core/signal.js";
import type { Deps } from "../deps.js";

/** US-001: creates the policy file if there is none. Never overwrites an existing one. */
export function initCommand(deps: Deps): number {
  const loaded = deps.store.load();
  if (loaded.status === "ok") {
    deps.io.stdout(`You already have a policy at ${deps.store.path}.`);
    return EXIT_OK;
  }
  if (loaded.status === "invalid") {
    deps.io.stderr(
      `A file at ${deps.store.path} exists but cannot be used. Fix or remove it, then run init again.`,
    );
    return EXIT_ERROR;
  }
  deps.store.save(emptyPolicy());
  deps.io.stdout(`Created your policy at ${deps.store.path}.`);
  deps.io.stdout("Add something to it with `offlimits add`.");
  return EXIT_OK;
}
