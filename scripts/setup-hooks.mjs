// Points git at the committed hooks in .githooks. Does nothing outside a git checkout
// (for example when the package is installed from a tarball).
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (existsSync(".git")) {
  spawnSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
}
