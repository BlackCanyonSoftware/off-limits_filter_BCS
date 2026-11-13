import { bubblewrapArguments, dockerArguments, planIsolation } from "../../core/isolation.js";
import { EXIT_ERROR } from "../../core/signal.js";
import type { BackendName } from "../../platform/isolation.js";
import { type Deps, loadForOwner, requireTerminal } from "../deps.js";

export interface RunOptions {
  readonly command: readonly string[];
  readonly backend: string | undefined;
  readonly image: string | undefined;
  readonly dryRun: boolean;
  readonly folder: string | undefined;
}

const BACKENDS: readonly BackendName[] = ["bubblewrap", "docker"];

/**
 * US-017: runs a command in a view where what the policy hides is not there at all (ADR 0011). A
 * hidden name is absent from listings, not an empty folder, so no spelling, encoding or script can
 * reach it. The only output about what is hidden is a count, except for `--dry-run`, which shows
 * the plan and so runs only for a person at a terminal.
 */
export function runIsolatedCommand(options: RunOptions, deps: Deps): number {
  if (options.command.length === 0) {
    deps.io.stderr("run needs a command after --, for example: offlimits run -- bash");
    return EXIT_ERROR;
  }
  if (options.dryRun) {
    const blocked = requireTerminal(deps);
    if (blocked !== undefined) return blocked;
  }
  const loaded = loadForOwner(deps);
  if ("exit" in loaded) return loaded.exit;

  const root = options.folder ?? deps.match.cwd;
  if (
    root
      .replaceAll("\\", "/")
      .split("/")
      .filter((part) => part !== "").length < 2
  ) {
    deps.io.stderr("Run from a project folder, not from the top of a drive or the file system.");
    return EXIT_ERROR;
  }

  const available = deps.isolation.availableBackends();
  const requested = options.backend as BackendName | undefined;
  if (requested !== undefined && !BACKENDS.includes(requested)) {
    deps.io.stderr("The backend must be bubblewrap or docker.");
    return EXIT_ERROR;
  }
  const backend = requested ?? available[0];
  if (backend === undefined || !available.includes(backend)) {
    deps.io.stderr(
      requested === undefined
        ? "No isolation tool can run here. Install bubblewrap (Linux, or Linux inside WSL) or Docker. See docs/ISOLATION.md."
        : `${requested} cannot run here. See docs/ISOLATION.md.`,
    );
    return EXIT_ERROR;
  }

  const plan = planIsolation(loaded.policy, root, deps.isolation.fileSystem, deps.match);
  if (plan.truncated) {
    deps.io.stderr("The folder is too large to check completely, so nothing was run.");
    return EXIT_ERROR;
  }

  const common = { cwd: root, command: options.command };
  const [program, args] =
    backend === "bubblewrap"
      ? ["bwrap", bubblewrapArguments(plan, common)]
      : ["docker", dockerArguments(plan, { ...common, image: options.image ?? "ubuntu:24.04" })];

  if (options.dryRun) {
    deps.io.stdout(`Backend: ${backend}`);
    deps.io.stdout(`Hidden inside ${plan.root}: ${String(plan.hiddenInside)}`);
    for (const path of plan.maskedOutside)
      deps.io.stdout(`Masked in place (name still visible): ${path}`);
    deps.io.stdout(`Variables removed: ${String(plan.unsetEnv.length)}`);
    deps.io.stdout(`${program} ${args.join(" ")}`);
    return 0;
  }

  deps.io.stderr(
    `[offlimits] ${String(plan.hiddenInside + plan.maskedOutside.length)} hidden, ${String(plan.unsetEnv.length)} variables removed, running in ${backend}.`,
  );
  if (plan.notExpressible > 0) {
    deps.io.stderr(
      `[offlimits] ${String(plan.notExpressible)} entries (hosts, commands, conversations, expressions) cannot be hidden this way.`,
    );
  }
  return deps.isolation.run(program, args);
}
