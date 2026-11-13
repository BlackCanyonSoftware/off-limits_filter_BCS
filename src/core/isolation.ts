import { decide, type MatchContext } from "./match.js";
import type { Policy } from "./policy.js";

/** One thing in a folder, as the planner needs to know it. */
export interface DirEntry {
  readonly name: string;
  readonly isDirectory: boolean;
  /** Where a link points, for a symbolic link; undefined for anything else. */
  readonly linkTarget?: string | undefined;
}

/** How the planner looks at the file system. Real in the program, fake in tests. */
export interface FileSystemView {
  list(directory: string): DirEntry[] | undefined;
  exists(path: string): boolean;
  isDirectory(path: string): boolean;
}

/** A piece of the isolated view, in the order it must be set up. */
export type Mount =
  | { readonly kind: "tmpfs"; readonly path: string }
  | { readonly kind: "bind"; readonly path: string }
  | { readonly kind: "symlink"; readonly path: string; readonly target: string }
  | { readonly kind: "empty-file"; readonly path: string };

export interface IsolationPlan {
  /** The view root: the folder rebuilt so hidden names are absent from it. */
  readonly root: string;
  /** In the order they must be applied. */
  readonly mounts: readonly Mount[];
  /** How many things inside the root are absent from the view. */
  readonly hiddenInside: number;
  /** Paths outside the root that are masked in place: they stay visible by name, but empty. */
  readonly maskedOutside: readonly string[];
  /** Environment variables to remove, from `env` entries. */
  readonly unsetEnv: readonly string[];
  /** Entries that isolation cannot express (hosts, commands, conversations, expressions). */
  readonly notExpressible: number;
  /** True when the walk stopped at its limit, so something may have been missed. */
  readonly truncated: boolean;
}

const MAX_ITEMS = 50_000;

const sep = (path: string): string => path.replaceAll("\\", "/");
const join = (directory: string, name: string): string =>
  directory.endsWith("/") ? `${directory}${name}` : `${directory}/${name}`;
const isInside = (path: string, folder: string): boolean =>
  path === folder || path.startsWith(folder.endsWith("/") ? folder : `${folder}/`);

/**
 * Finds what the policy hides under `root`: every file or folder whose path matches an entry. A
 * folder that matches is hidden whole, and not walked into. Links are not followed. Paths outside
 * the root named by `path` entries are found too, if they exist.
 */
export function findHidden(
  policy: Policy,
  root: string,
  fs: FileSystemView,
  ctx: MatchContext,
): { inside: string[]; outside: string[]; truncated: boolean } {
  const base = sep(root);
  const inside: string[] = [];
  let seen = 0;
  let truncated = false;
  const queue: string[] = [base];
  for (let directory = queue.shift(); directory !== undefined; directory = queue.shift()) {
    for (const child of fs.list(directory) ?? []) {
      if (++seen > MAX_ITEMS) {
        truncated = true;
        return { inside, outside: [], truncated };
      }
      const path = join(directory, child.name);
      if (decide(policy, path, ctx).blocked) {
        inside.push(path);
      } else if (child.isDirectory && child.linkTarget === undefined) {
        queue.push(path);
      }
    }
  }

  // An absolute path entry outside the root is masked where it is.
  const outside = policy.entries
    .filter((entry) => entry.kind === "path")
    .map((entry) => sep(entry.value))
    .filter((path) => /^(?:\/|[A-Za-z]:)/u.test(path) && !isInside(path, base) && fs.exists(path));
  return { inside, outside: [...new Set(outside)], truncated };
}

/**
 * Builds the view: the root is replaced by an empty folder, and everything not hidden is mounted
 * back into it, so a hidden name is not an empty folder but simply absent. Folders on the way to
 * something hidden are rebuilt the same way; any other folder is mounted whole. A link is
 * recreated as a link, and so dangles if it pointed at something hidden.
 */
export function planIsolation(
  policy: Policy,
  root: string,
  fs: FileSystemView,
  ctx: MatchContext,
): IsolationPlan {
  const base = sep(root);
  const found = findHidden(policy, root, fs, ctx);
  const hidden = new Set(found.inside);
  const mounts: Mount[] = [];

  const hasHiddenInside = (directory: string): boolean =>
    found.inside.some((path) => isInside(path, directory) && path !== directory);

  /**
   * A link whose target names something hidden would carry the name into the view, readable with
   * `readlink`, so it is left out as well, and counted as hidden.
   */
  const pointsAtHidden = (directory: string, target: string): boolean =>
    decide(policy, target, ctx).blocked || decide(policy, join(directory, target), ctx).blocked;
  let hiddenLinks = 0;

  const rebuild = (directory: string): void => {
    mounts.push({ kind: "tmpfs", path: directory });
    for (const child of fs.list(directory) ?? []) {
      const path = join(directory, child.name);
      if (hidden.has(path)) continue;
      if (child.linkTarget !== undefined) {
        if (pointsAtHidden(directory, sep(child.linkTarget))) {
          hiddenLinks++;
          continue;
        }
        mounts.push({ kind: "symlink", path, target: child.linkTarget });
      } else if (child.isDirectory && hasHiddenInside(path)) {
        rebuild(path);
      } else {
        mounts.push({ kind: "bind", path });
      }
    }
  };
  // The root is where the command works, so it must be writable: rebuilt around what is hidden,
  // or mounted whole when nothing in it is.
  if (hidden.size > 0) rebuild(base);
  else mounts.push({ kind: "bind", path: base });

  const outside = found.outside;
  for (const path of outside) {
    mounts.push(fs.isDirectory(path) ? { kind: "tmpfs", path } : { kind: "empty-file", path });
  }

  return {
    root: base,
    mounts,
    hiddenInside: hidden.size + hiddenLinks,
    maskedOutside: outside,
    unsetEnv: policy.entries.filter((e) => e.kind === "env").map((e) => e.value),
    notExpressible: policy.entries.filter((e) =>
      ["host", "command", "conversation", "regex"].includes(e.kind),
    ).length,
    truncated: found.truncated,
  };
}

export interface BackendOptions {
  /** The folder the command starts in. */
  readonly cwd: string;
  readonly command: readonly string[];
}

/**
 * The `bwrap` (bubblewrap) command line for a plan: the whole system read-only, a private
 * `/dev`, `/proc` and `/tmp`, the root rebuilt as the plan says, and the environment variables
 * removed. The command dies with its parent. Used on Linux, and inside WSL on Windows.
 */
export function bubblewrapArguments(plan: IsolationPlan, options: BackendOptions): string[] {
  const args = [
    "--die-with-parent",
    "--ro-bind",
    "/",
    "/",
    "--dev",
    "/dev",
    "--proc",
    "/proc",
    "--tmpfs",
    "/tmp",
  ];
  for (const name of plan.unsetEnv) args.push("--unsetenv", name);
  for (const mount of plan.mounts) {
    switch (mount.kind) {
      case "tmpfs":
        args.push("--tmpfs", mount.path);
        break;
      case "bind":
        args.push("--bind", mount.path, mount.path);
        break;
      case "symlink":
        args.push("--symlink", mount.target, mount.path);
        break;
      case "empty-file":
        args.push("--ro-bind", "/dev/null", mount.path);
        break;
    }
  }
  args.push("--chdir", options.cwd, "--", ...options.command);
  return args;
}

/**
 * The `docker run` arguments for a plan: the allowed parts of the root are mounted at the same
 * paths, and nothing hidden is mounted at all. The command runs in `image`, which must have the
 * tools it needs. Variables are not passed on, so `env` entries are absent by construction.
 */
export function dockerArguments(
  plan: IsolationPlan,
  options: BackendOptions & { readonly image: string },
): string[] {
  const args = ["run", "--rm", "-i"];
  for (const mount of plan.mounts) {
    if (mount.kind === "bind") args.push("-v", `${mount.path}:${containerPath(mount.path)}`);
  }
  args.push("-w", containerPath(sep(options.cwd)), options.image, ...options.command);
  return args;
}

/** A path as a Linux container sees it: `C:/work/x` becomes `/c/work/x`. */
export function containerPath(path: string): string {
  const drive = /^([A-Za-z]):\//u.exec(path);
  return drive ? `/${(drive[1] ?? "").toLowerCase()}/${path.slice(3)}` : path;
}
