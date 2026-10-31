import { posix, win32 } from "node:path";

export type Env = Readonly<Record<string, string | undefined>>;

/**
 * Where the policy file lives (ADR 0002). `OFFLIMITS_POLICY` overrides it. Otherwise it sits in
 * the user's config folder, outside any repository: `%APPDATA%\offlimits` on Windows,
 * `$XDG_CONFIG_HOME/offlimits` or `~/.config/offlimits` elsewhere.
 */
export function policyPath(env: Env, platform: NodeJS.Platform, home: string): string {
  const override = env.OFFLIMITS_POLICY;
  if (override !== undefined && override !== "") return override;
  if (platform === "win32") {
    const appData = env.APPDATA ?? win32.join(home, "AppData", "Roaming");
    return win32.join(appData, "offlimits", "policy.yaml");
  }
  const xdg = env.XDG_CONFIG_HOME;
  const config = xdg !== undefined && xdg !== "" ? xdg : posix.join(home, ".config");
  return posix.join(config, "offlimits", "policy.yaml");
}
