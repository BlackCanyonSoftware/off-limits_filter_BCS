import { describe, expect, it } from "vitest";
import {
  GUARD_MARKER,
  UnsupportedSettingsError,
  hasGuard,
  withGuard,
  withoutGuard,
} from "../../src/adapters/claude-code/settings.js";

const command = {
  node: "C:\\Program Files\\nodejs\\node.exe",
  script: "C:\\tools\\offlimits\\dist\\guard\\main.js",
};

const otherHook = { type: "command", command: "other-tool", timeout: 10 };

describe("withGuard", () => {
  it("adds the guard to empty settings", () => {
    const result = withGuard({}, command);
    expect(result).toEqual({
      hooks: {
        PreToolUse: [
          {
            matcher: "*",
            hooks: [
              {
                type: "command",
                command: command.node,
                args: [command.script],
                timeout: 5,
                onFailure: "block",
                statusMessage: GUARD_MARKER,
              },
            ],
          },
        ],
      },
    });
  });

  it("runs the executable directly with the script as an argument, so spaces in paths are safe", () => {
    const handler = (withGuard({}, command).hooks as { PreToolUse: { hooks: unknown[] }[] })
      .PreToolUse[0]?.hooks[0] as Record<string, unknown>;
    expect(handler.command).toBe(command.node);
    expect(handler.args).toEqual([command.script]);
  });

  it("makes a failed or timed-out guard refuse the call", () => {
    const handler = (withGuard({}, command).hooks as { PreToolUse: { hooks: unknown[] }[] })
      .PreToolUse[0]?.hooks[0] as Record<string, unknown>;
    expect(handler.onFailure).toBe("block");
    expect(handler.timeout).toBeLessThanOrEqual(10);
  });

  it("keeps everything else in the file exactly as it was", () => {
    const settings = {
      model: "some-model",
      permissions: { allow: ["Bash(ls)"] },
      hooks: {
        PostToolUse: [{ matcher: "Edit", hooks: [otherHook] }],
        PreToolUse: [{ matcher: "Bash", hooks: [otherHook] }],
      },
    };
    const result = withGuard(settings, command) as typeof settings;
    expect(result.model).toBe("some-model");
    expect(result.permissions).toEqual({ allow: ["Bash(ls)"] });
    expect(result.hooks.PostToolUse).toEqual(settings.hooks.PostToolUse);
    expect(result.hooks.PreToolUse).toHaveLength(2);
    expect(result.hooks.PreToolUse[0]).toEqual(settings.hooks.PreToolUse[0]);
  });

  it("does not change the settings it was given", () => {
    const settings = { hooks: { PreToolUse: [] } };
    withGuard(settings, command);
    expect(settings).toEqual({ hooks: { PreToolUse: [] } });
  });

  it("updates an earlier install instead of adding a second", () => {
    const first = withGuard({}, command);
    const second = withGuard(first, { ...command, script: "/new/place/main.js" });
    const groups = (second.hooks as { PreToolUse: unknown[] }).PreToolUse;
    expect(groups).toHaveLength(1);
    expect(JSON.stringify(second)).toContain("/new/place/main.js");
    expect(JSON.stringify(second)).not.toContain("C:\\\\tools");
  });

  it.each([
    ["hooks that is not an object", { hooks: [] }],
    ["PreToolUse that is not a list", { hooks: { PreToolUse: {} } }],
  ])("refuses settings with %s rather than guessing", (_name, settings) => {
    expect(() => withGuard(settings, command)).toThrow(UnsupportedSettingsError);
  });
});

describe("withoutGuard and hasGuard", () => {
  it("removes only the guard and leaves other hooks, in the same group or another", () => {
    const settings = {
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [otherHook] },
          {
            matcher: "*",
            hooks: [otherHook, { type: "command", command: "x", statusMessage: GUARD_MARKER }],
          },
        ],
      },
    };
    const result = withoutGuard(settings);
    expect(result.removed).toBe(1);
    expect(result.settings).toEqual({
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [otherHook] },
          { matcher: "*", hooks: [otherHook] },
        ],
      },
    });
  });

  it("drops a group left empty, and the hooks section when nothing is left", () => {
    expect(withoutGuard(withGuard({}, command))).toEqual({ settings: {}, removed: 1 });
    const model = withGuard({ model: "m" }, command);
    expect(withoutGuard(model).settings).toEqual({ model: "m" });
  });

  it("keeps other hook events when it removes the guard", () => {
    const settings = withGuard({ hooks: { Stop: [{ hooks: [otherHook] }] } }, command);
    expect(withoutGuard(settings).settings).toEqual({ hooks: { Stop: [{ hooks: [otherHook] }] } });
  });

  it("returns the settings unchanged when there is no guard", () => {
    const settings = { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [otherHook] }] } };
    expect(withoutGuard(settings)).toEqual({ settings, removed: 0 });
  });

  it("reports whether the guard is there", () => {
    expect(hasGuard({})).toBe(false);
    expect(hasGuard(withGuard({}, command))).toBe(true);
    expect(hasGuard({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [otherHook] }] } })).toBe(
      false,
    );
  });

  it("refuses settings it cannot read the shape of", () => {
    expect(() => withoutGuard({ hooks: "x" })).toThrow(UnsupportedSettingsError);
  });
});
