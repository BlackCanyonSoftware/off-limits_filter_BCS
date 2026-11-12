import { posix, win32 } from "node:path";

export type Env = Readonly<Record<string, string | undefined>>;

const pathModule = (platform: NodeJS.Platform): typeof posix =>
  platform === "win32" ? win32 : posix;

/**
 * Where the policy file lives (ADR 0002, ADR 0006). `OFFLIMITS_POLICY` overrides it. Otherwise it
 * sits in the user's config folder, outside any repository: `%APPDATA%\offlimits` on Windows,
 * `$XDG_CONFIG_HOME/offlimits` or `~/.config/offlimits` elsewhere.
 */
export function policyPath(env: Env, platform: NodeJS.Platform, home: string): string {
  const override = env.OFFLIMITS_POLICY;
  if (override !== undefined && override !== "") return override;
  if (platform === "win32") {
    const appData = env.APPDATA ?? win32.join(home, "AppData", "Roaming");
    return win32.join(appData, "offlimits", "policy.json");
  }
  const xdg = env.XDG_CONFIG_HOME;
  const config = xdg !== undefined && xdg !== "" ? xdg : posix.join(home, ".config");
  return posix.join(config, "offlimits", "policy.json");
}

/** Claude Code's user settings file: in `CLAUDE_CONFIG_DIR` if set, otherwise `~/.claude`. */
export function claudeSettingsPath(env: Env, platform: NodeJS.Platform, home: string): string {
  const path = pathModule(platform);
  const override = env.CLAUDE_CONFIG_DIR;
  const folder = override !== undefined && override !== "" ? override : path.join(home, ".claude");
  return path.join(folder, "settings.json");
}

/**
 * Every settings file that could carry or switch off the guard: the user's, and the project's
 * shared and local files for the folders Claude Code was started in.
 */
export function claudeSettingsFiles(
  env: Env,
  platform: NodeJS.Platform,
  home: string,
  projectFolders: readonly string[],
): string[] {
  const path = pathModule(platform);
  const projectFiles = [...new Set(projectFolders)].flatMap((folder) => [
    path.join(folder, ".claude", "settings.json"),
    path.join(folder, ".claude", "settings.local.json"),
  ]);
  return [claudeSettingsPath(env, platform, home), ...projectFiles];
}
