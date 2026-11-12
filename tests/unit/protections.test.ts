import { describe, expect, it } from "vitest";
import { decide, entryMatches } from "../../src/core/match.js";
import { protections } from "../../src/guard/protections.js";
import { posixContext, windowsContext } from "../helpers/context.js";

const paths = {
  policyFile: "/home/kyle/.config/offlimits/policy.json",
  settingsFiles: ["/home/kyle/.claude/settings.json", "/work/project/.claude/settings.local.json"],
  programDir: "/opt/offlimits/dist",
};

const policyOf = (...list: ReturnType<typeof protections>) => ({
  version: 1 as const,
  entries: list.map((protection) => protection.entry),
});

const blocked = (text: string, ctx = posixContext()): boolean =>
  decide(policyOf(...protections(paths)), text, ctx).blocked;

describe("automatic protections", () => {
  it.each([
    ["reading the policy file", "cat /home/kyle/.config/offlimits/policy.json"],
    ["a relative route to it", "cat ../../home/kyle/.config/offlimits/../offlimits/policy.json"],
    ["through the home folder", "cat ~/.config/offlimits/policy.json"],
    ["a tool input naming it", '{"file_path":"/home/kyle/.config/offlimits/policy.json"}'],
    ["editing the user settings", "Edit /home/kyle/.claude/settings.json"],
    ["editing the project's local settings", "Write /work/project/.claude/settings.local.json"],
    ["running the guard's own program", "node /opt/offlimits/dist/cli/main.js check x"],
    ["reading the guard's program files", "cat /opt/offlimits/dist/guard/main.js"],
    ["listing the entries", "offlimits list"],
    ["adding an entry", "offlimits add client-alpha"],
    ["removing an entry", "offlimits remove 1"],
    ["explaining a match", "offlimits explain some text"],
    ["uninstalling the guard", "offlimits uninstall"],
    ["installing again", "offlimits install --settings /tmp/x.json"],
    ["the same through npx", "npx offlimits list"],
    ["a different capitalisation", "OFFLIMITS LIST"],
  ])("refuses %s", (_name, text) => {
    expect(blocked(text)).toBe(true);
  });

  it.each([
    ["ordinary work", "ls src && npm test"],
    ["the commands that reveal nothing", "offlimits check some text"],
    ["printing the notice", "offlimits snippet"],
    ["a similar folder that is not the policy", "cat /home/kyle/.config/other/policy.json"],
    ["a sibling of the program folder", "cat /opt/offlimits/distribution/readme.md"],
    ["another project's settings", "cat /work/other/.claude/settings.json"],
  ])("allows %s", (_name, text) => {
    expect(blocked(text)).toBe(false);
  });

  it("follows the file system's rules for case on Windows", () => {
    const win = protections({
      policyFile: "C:\\Users\\Kyle\\AppData\\Roaming\\offlimits\\policy.json",
      settingsFiles: [],
      programDir: "C:\\Tools\\offlimits\\dist",
    });
    const ctx = windowsContext();
    const refused = (text: string): boolean => decide(policyOf(...win), text, ctx).blocked;
    expect(refused("type c:/users/kyle/appdata/roaming/OFFLIMITS/policy.json")).toBe(true);
    expect(
      refused('type "C:\\\\Users\\\\Kyle\\\\AppData\\\\Roaming\\\\offlimits\\\\policy.json"'),
    ).toBe(true);
    expect(refused("dir C:\\Tools\\offlimits\\dist\\cli")).toBe(true);
    expect(refused("dir C:\\Tools\\offlimits\\docs")).toBe(false);
  });

  it("gives each protection a label for the owner and counts every settings file once", () => {
    const list = protections({
      ...paths,
      settingsFiles: [...paths.settingsFiles, ...paths.settingsFiles],
    });
    expect(list.every((protection) => protection.label.length > 0)).toBe(true);
    expect(list.filter((protection) => protection.label.includes("settings"))).toHaveLength(2);
  });

  it("protects with the forbid mode", () => {
    expect(protections(paths).every((protection) => protection.entry.mode === "forbid")).toBe(true);
    const policyEntry = protections(paths)[0];
    expect(
      policyEntry &&
        entryMatches(
          policyEntry.entry,
          "cat /home/kyle/.config/offlimits/policy.json",
          posixContext(),
        ),
    ).toBe(true);
  });
});
