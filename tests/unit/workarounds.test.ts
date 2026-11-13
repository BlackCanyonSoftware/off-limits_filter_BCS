import { describe, expect, it } from "vitest";
import { decide } from "../../src/core/match.js";
import type { Entry, Policy } from "../../src/core/policy.js";
import { entry, posixContext, windowsContext } from "../helpers/context.js";

const policyOf = (...entries: Entry[]): Policy => ({ version: 1, entries });
const b64 = (text: string): string => Buffer.from(text).toString("base64");
const ZWSP = String.fromCharCode(0x200b);

const nameEntry = policyOf(entry("name", "client-alpha"));
const folderEntry = policyOf(entry("path", "/home/kyle/clients/client-alpha"));
const env = { HOME: "/home/kyle", CLIENTS: "/home/kyle/clients" };

const refused = (policy: Policy, text: string, ctx = posixContext({ env })): boolean =>
  decide(policy, text, ctx).blocked;

describe("quoting (a shell reads these as the same word)", () => {
  it.each([
    'cat cl"ient"-alpha/notes.md',
    "cat 'client-'alpha/notes.md",
    "cat cl\\ient-alpha/notes.md",
    "cat \"client\"'-alpha'/notes.md",
  ])("refuses a name written as %s", (text) => {
    expect(refused(nameEntry, text)).toBe(true);
  });

  it("refuses a path written with quoting inside it", () => {
    expect(refused(folderEntry, 'cat /home/kyle/clients/cl"ient"-alpha/notes.md')).toBe(true);
    expect(refused(folderEntry, "cat /home/kyle/clients/'client-alpha'/notes.md")).toBe(true);
  });
});

describe("encodings (text spelled with codes)", () => {
  it.each([
    ["percent codes", "cat cl%69ent-alpha/notes.md"],
    ["hex escapes", "cat $'\\x63lient-alpha'"],
    ["unicode escapes", "printf '\\u0063lient-alpha'"],
    ["octal escapes", "cat $'\\143lient-alpha'"],
    ["base64", `echo ${b64("client-alpha")} | base64 -d | xargs cat`],
    ["hex", `echo ${Buffer.from("client-alpha").toString("hex")} | xxd -r -p`],
  ])("refuses %s", (_name, text) => {
    expect(refused(nameEntry, text)).toBe(true);
  });

  it("refuses an encoded path, too", () => {
    expect(
      refused(folderEntry, `cat $(echo ${b64("/home/kyle/clients/client-alpha")} | base64 -d)`),
    ).toBe(true);
  });
});

describe("variables (filled in before the shell runs them)", () => {
  it.each([
    "cat $HOME/clients/client-alpha/notes.md",
    "cat ${HOME}/clients/client-alpha/notes.md",
    "cat $CLIENTS/client-alpha/notes.md",
    "d=client-alpha; cat $CLIENTS/$d/notes.md",
    "a=client; b=-alpha; cat $CLIENTS/${a}${b}/notes.md",
    'd=client; cat "$CLIENTS"/"$d"-alpha',
  ])("refuses %s", (text) => {
    expect(refused(folderEntry, text)).toBe(true);
  });

  it("refuses a name assembled from pieces", () => {
    expect(refused(nameEntry, "a=cli; b=ent; c=-alpha; cat $a$b$c")).toBe(true);
  });

  it("fills in Windows variables on Windows", () => {
    const win = policyOf(entry("path", "C:\\Users\\Kyle\\Clients\\client-alpha"));
    const ctx = windowsContext({ env: { USERPROFILE: "C:\\Users\\Kyle" } });
    expect(refused(win, "type %USERPROFILE%\\Clients\\client-alpha\\notes.txt", ctx)).toBe(true);
    expect(refused(win, "type $env:USERPROFILE\\Clients\\client-alpha\\notes.txt", ctx)).toBe(true);
  });
});

describe("invisible characters and look-alikes", () => {
  it("refuses a name with zero-width characters or colour codes inside it", () => {
    expect(refused(nameEntry, `cat cli${ZWSP}ent-alpha`)).toBe(true);
    expect(refused(nameEntry, `ls cl${String.fromCharCode(0x1b)}[31mient-alpha`)).toBe(true);
  });

  it("refuses a name in full-width letters", () => {
    expect(refused(nameEntry, "cat ｃｌｉｅｎｔ－ａｌｐｈａ")).toBe(true);
  });
});

describe("moving first, then using a relative path", () => {
  it.each([
    "cd /home/kyle/clients && cat client-alpha/notes.md",
    "cd /home/kyle/clients; cat ./client-alpha/notes.md",
    "pushd /home/kyle/clients && cat client-alpha/notes.md",
    "cd /home/kyle && cd clients && cat client-alpha/notes.md",
    "cd ~/clients && cat client-alpha/notes.md",
  ])("refuses %s", (text) => {
    expect(refused(folderEntry, text, posixContext({ cwd: "/somewhere/else" }))).toBe(true);
  });

  it("refuses PowerShell's Set-Location the same way", () => {
    const win = policyOf(entry("path", "C:\\Clients\\client-alpha"));
    expect(
      refused(
        win,
        "Set-Location C:\\Clients; Get-Content client-alpha\\notes.txt",
        windowsContext(),
      ),
    ).toBe(true);
    expect(
      refused(
        win,
        "Set-Location -Path C:\\Clients; type client-alpha\\notes.txt",
        windowsContext(),
      ),
    ).toBe(true);
  });

  it("allows moving elsewhere", () => {
    expect(refused(folderEntry, "cd /home/kyle/other && cat client-alpha/notes.md")).toBe(false);
  });
});

describe("wildcards (a shell expands these to real names)", () => {
  it.each([
    "cat client-al*/notes.md",
    "cat client-alph?/notes.md",
    "cat client-[a]lpha/notes.md",
    "cat *lient-alpha/notes.md",
  ])("refuses %s for a name", (text) => {
    expect(refused(nameEntry, text)).toBe(true);
  });

  it("refuses a pattern that could expand to a protected folder", () => {
    const ctx = posixContext({ cwd: "/home/kyle/clients", env });
    expect(refused(folderEntry, "cat client-al*/notes.md", ctx)).toBe(true);
    expect(refused(folderEntry, "cat /home/kyle/clients/c*/notes.md", ctx)).toBe(true);
    expect(refused(folderEntry, "cat */notes.md", ctx)).toBe(true);
  });

  it("allows ordinary wildcards that name nothing in particular", () => {
    for (const text of [
      "git add *",
      "ls *.md",
      "rm -f *.tmp",
      "cat src/**/*.ts",
      "ls cl*",
      "find . -name '*.js'",
    ]) {
      expect(refused(nameEntry, text)).toBe(false);
    }
    expect(refused(folderEntry, "ls *")).toBe(false);
    // Run in the folder that holds the protected one, `ls *` does list what is inside it.
    expect(refused(folderEntry, "ls *", posixContext({ cwd: "/home/kyle/clients", env }))).toBe(
      true,
    );
  });
});

describe("Windows path forms", () => {
  const win = policyOf(entry("path", "C:\\Users\\Kyle\\Clients\\client-alpha"));

  it.each([
    "type \\\\?\\C:\\Users\\Kyle\\Clients\\client-alpha\\notes.txt",
    "type \\\\.\\C:\\Users\\Kyle\\Clients\\client-alpha\\notes.txt",
    "type C:\\Users\\Kyle\\Clients\\client-alpha.\\notes.txt",
    "type C:\\Users\\Kyle\\Clients\\client-alpha \\notes.txt",
    "type c:/USERS/kyle/clients/CLIENT-ALPHA/notes.txt",
  ])("refuses %s", (text) => {
    expect(refused(win, text, windowsContext())).toBe(true);
  });

  it("does not treat trailing dots as part of a name on other systems", () => {
    const posix = policyOf(entry("path", "/home/kyle/clients/client-alpha"));
    expect(refused(posix, "cat /home/kyle/clients/client-alpha./notes.md")).toBe(false);
  });
});

describe("ordinary work is not caught by any of this", () => {
  const policy = policyOf(
    entry("name", "client-alpha"),
    entry("path", "/home/kyle/clients/client-alpha"),
    entry("env", "ALPHA_TOKEN"),
    entry("host", "alpha.internal.example"),
  );

  it.each([
    "ls src && npm test",
    "git log --oneline -20",
    "echo $HOME",
    "cat $HOME/notes.txt",
    "cd /home/kyle/projects && ls",
    "curl https://example.com/api?q=client",
    "echo SGVsbG8gd29ybGQsIHRoaXMgaXMgbm90aGluZw== | base64 -d",
    "sha256sum release-1.2.3.tar.gz a3f5b8c9d2e1f4a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3",
    'printf "100%%\\n"',
    "name=world; echo hello $name",
  ])("allows %s", (text) => {
    expect(refused(policy, text)).toBe(false);
  });
});
