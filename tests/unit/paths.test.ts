import { describe, expect, it } from "vitest";
import { policyPath } from "../../src/platform/paths.js";

describe("policyPath (ADR 0002)", () => {
  it("uses OFFLIMITS_POLICY when set", () => {
    expect(policyPath({ OFFLIMITS_POLICY: "/tmp/mine.yaml" }, "linux", "/home/kyle")).toBe(
      "/tmp/mine.yaml",
    );
  });

  it("ignores an empty override", () => {
    expect(policyPath({ OFFLIMITS_POLICY: "" }, "linux", "/home/kyle")).toBe(
      "/home/kyle/.config/offlimits/policy.yaml",
    );
  });

  it("uses APPDATA on Windows, with a fallback", () => {
    expect(
      policyPath({ APPDATA: "C:\\Users\\Kyle\\AppData\\Roaming" }, "win32", "C:\\Users\\Kyle"),
    ).toBe("C:\\Users\\Kyle\\AppData\\Roaming\\offlimits\\policy.yaml");
    expect(policyPath({}, "win32", "C:\\Users\\Kyle")).toBe(
      "C:\\Users\\Kyle\\AppData\\Roaming\\offlimits\\policy.yaml",
    );
  });

  it("uses XDG_CONFIG_HOME elsewhere, with ~/.config as the fallback", () => {
    expect(policyPath({ XDG_CONFIG_HOME: "/xdg" }, "linux", "/home/kyle")).toBe(
      "/xdg/offlimits/policy.yaml",
    );
    expect(policyPath({}, "darwin", "/Users/kyle")).toBe(
      "/Users/kyle/.config/offlimits/policy.yaml",
    );
  });
});
