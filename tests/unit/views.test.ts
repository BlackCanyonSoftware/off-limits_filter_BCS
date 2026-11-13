import { describe, expect, it } from "vitest";
import {
  decodeEscapes,
  decodeTokens,
  expandVariables,
  removeShellQuoting,
  stripInvisible,
  textViews,
} from "../../src/core/views.js";

const b64 = (text: string): string => Buffer.from(text).toString("base64");
const ZWSP = String.fromCharCode(0x200b);
const ESC = String.fromCharCode(0x1b);

describe("stripInvisible", () => {
  it("takes out zero-width characters, the soft hyphen and terminal colour codes", () => {
    expect(stripInvisible(`cli${ZWSP}ent${String.fromCharCode(0xad)}-alpha`)).toBe("client-alpha");
    expect(stripInvisible(`cl${ESC}[31mient${ESC}[0m-alpha`)).toBe("client-alpha");
  });
});

describe("removeShellQuoting", () => {
  it.each([
    ["cl\"ient\"-al'pha'", "client-alpha"],
    ["cl\\ient-alpha", "client-alpha"],
    ["'client-'alpha", "client-alpha"],
  ])("reads %s as %s", (text, expected) => {
    expect(removeShellQuoting(text)).toBe(expected);
  });
});

describe("decodeEscapes", () => {
  it.each([
    ["cl%69ent-alpha", "client-alpha"],
    ["\\x63lient-alpha", "client-alpha"],
    ["\\u0063lient-alpha", "client-alpha"],
    ["\\u{63}lient-alpha", "client-alpha"],
    ["\\143lient-alpha", "client-alpha"],
  ])("decodes %s", (text, expected) => {
    expect(decodeEscapes(text)).toBe(expected);
  });

  it("leaves ordinary text alone", () => {
    expect(decodeEscapes("cat notes.md")).toBe("cat notes.md");
  });
});

describe("decodeTokens", () => {
  it("decodes a base64 token that reads as text", () => {
    expect(decodeTokens(`echo ${b64("client-alpha")} | base64 -d`)).toContain("client-alpha");
  });

  it("decodes a URL-safe base64 token and a hex token", () => {
    expect(decodeTokens(b64("client-alpha?>>")).join(" ")).toContain("client-alpha");
    expect(decodeTokens(Buffer.from("client-alpha").toString("hex"))).toContain("client-alpha");
  });

  it("ignores tokens that decode to noise, and short ones", () => {
    expect(decodeTokens("deadbeef0123456789abcdef")).toEqual([]);
    expect(decodeTokens("abcd ef12")).toEqual([]);
    expect(decodeTokens("git status --short")).toEqual([]);
  });
});

describe("expandVariables", () => {
  const env = { HOME: "/home/kyle", ROOT: "C:\\Clients" };

  it("fills in $NAME, ${NAME}, %NAME% and $env:NAME from the environment", () => {
    expect(expandVariables("$HOME/a ${HOME}/b %ROOT%\\c $env:ROOT", env)).toBe(
      "/home/kyle/a /home/kyle/b C:\\Clients\\c C:\\Clients",
    );
  });

  it("fills in variables the text sets itself, and pieces joined together", () => {
    expect(expandVariables("a=client; b=-alpha; cat ${a}${b}/notes", {})).toContain(
      "client-alpha/notes",
    );
    expect(expandVariables("set d=client-alpha & type %d%", {})).toContain("type client-alpha");
    expect(expandVariables('$d = "client-alpha"; cat $d', {})).toContain("cat client-alpha");
  });

  it("leaves a variable it does not know as it was", () => {
    expect(expandVariables("cat $UNKNOWN/x", env)).toBe("cat $UNKNOWN/x");
  });

  it("lets one variable hold another, a few levels deep", () => {
    expect(expandVariables("a=$b; b=$c; c=client-alpha; cat $a", {})).toContain("cat client-alpha");
  });
});

describe("textViews", () => {
  it("is empty for plain text, so ordinary calls cost nothing extra", () => {
    expect(textViews("ls src && npm test", {})).toEqual([]);
  });

  it("combines readings, so quoting around a variable still resolves", () => {
    const views = textViews('d=client; cat "$d"-alpha', {});
    expect(views.some((view) => view.includes("cat client-alpha"))).toBe(true);
  });

  it("includes the decoded form of an encoded token", () => {
    expect(
      textViews(`echo ${b64("client-alpha")}`, {}).some((v) => v.includes("client-alpha")),
    ).toBe(true);
  });
});
