import { describe, expect, it } from "vitest";
import { decide, entryMatches } from "../../src/core/match.js";
import type { Policy } from "../../src/core/policy.js";
import { entry, posixContext, windowsContext } from "../helpers/context.js";

describe("name entries (US-004)", () => {
  const alpha = entry("name", "Client Alpha");

  it.each(["open client_alpha/notes.md", "CLIENT-ALPHA", "list clientalpha", "Client Alpha"])(
    "matches %s",
    (text) => {
      expect(entryMatches(alpha, text, posixContext())).toBe(true);
    },
  );

  it("does not match unrelated text", () => {
    expect(entryMatches(alpha, "open project-nightingale/readme.md", posixContext())).toBe(false);
  });
});

describe("path entries (US-004)", () => {
  const absolute = entry("path", "/home/kyle/clients/client-alpha");

  it("matches the folder and anything inside it", () => {
    const ctx = posixContext();
    expect(entryMatches(absolute, "ls /home/kyle/clients/client-alpha", ctx)).toBe(true);
    expect(entryMatches(absolute, "cat /home/kyle/clients/client-alpha/a/b.md", ctx)).toBe(true);
  });

  it("does not match a sibling that only shares a prefix", () => {
    expect(entryMatches(absolute, "ls /home/kyle/clients/client-alpha-two", posixContext())).toBe(
      false,
    );
  });

  it("sees through .. and repeated slashes", () => {
    const ctx = posixContext();
    expect(entryMatches(absolute, "cat /home/kyle/clients/other/../client-alpha/x", ctx)).toBe(
      true,
    );
    expect(entryMatches(absolute, "cat /home//kyle/./clients/client-alpha/x", ctx)).toBe(true);
  });

  it("resolves a relative spelling against the working directory", () => {
    const ctx = posixContext({ cwd: "/home/kyle/clients" });
    expect(entryMatches(absolute, "cat client-alpha/notes.md", ctx)).toBe(true);
    expect(entryMatches(absolute, "cat ./client-alpha/../client-alpha/notes.md", ctx)).toBe(true);
  });

  it("expands ~ on either side", () => {
    const home = entry("path", "~/clients/client-alpha");
    const ctx = posixContext();
    expect(entryMatches(home, "cat /home/kyle/clients/client-alpha/x", ctx)).toBe(true);
    expect(entryMatches(absolute, "cat ~/clients/client-alpha/x", ctx)).toBe(true);
  });

  it("follows a link to the protected folder", () => {
    const ctx = posixContext({
      links: { "/work/project/shortcut": "/home/kyle/clients/client-alpha" },
    });
    expect(entryMatches(absolute, "cat shortcut/notes.md", ctx)).toBe(true);
  });

  it("matches a relative entry wherever that run of folder names appears", () => {
    const relative = entry("path", "clients/client-alpha");
    const ctx = posixContext();
    expect(entryMatches(relative, "cat /srv/clients/client-alpha/x", ctx)).toBe(true);
    expect(entryMatches(relative, "cat /srv/client-alpha/clients/x", ctx)).toBe(false);
  });

  it("follows the file system's rule for case", () => {
    const relative = entry("path", "client-alpha");
    expect(entryMatches(relative, "cat Client-Alpha/x", posixContext())).toBe(false);
    expect(entryMatches(relative, "cat Client-Alpha/x", windowsContext())).toBe(true);
  });

  it("handles Windows drives, either slash, and quoted paths with spaces", () => {
    const win = entry("path", "C:\\Users\\Kyle\\Clients\\Client Alpha");
    const ctx = windowsContext();
    expect(entryMatches(win, 'type "c:/USERS/kyle/clients/client alpha/notes.txt"', ctx)).toBe(
      true,
    );
    expect(
      entryMatches(win, 'type "C:\\\\Users\\\\Kyle\\\\Clients\\\\Client Alpha\\\\x"', ctx),
    ).toBe(true);
    expect(entryMatches(win, "type D:\\Users\\Kyle\\Clients\\Client Alpha", ctx)).toBe(false);
  });
});

describe("glob entries", () => {
  it("matches a file pattern in any folder", () => {
    const pem = entry("glob", "*.pem");
    const ctx = posixContext();
    expect(entryMatches(pem, "cat keys/server.pem", ctx)).toBe(true);
    expect(entryMatches(pem, "cat keys/server.pub", ctx)).toBe(false);
  });

  it("covers what is inside a matched folder", () => {
    const folder = entry("glob", "secret-*");
    expect(entryMatches(folder, "cat secret-plans/a/b.txt", posixContext())).toBe(true);
  });

  it("supports ** across folders and a fixed file name", () => {
    const creds = entry("glob", "**/credentials.json");
    const ctx = posixContext();
    expect(entryMatches(creds, "cat /a/b/c/credentials.json", ctx)).toBe(true);
    expect(entryMatches(creds, "cat /a/b/c/credentials.json.bak", ctx)).toBe(false);
  });

  it("anchors a home-relative glob", () => {
    const anchored = entry("glob", "~/clients/*/private");
    const ctx = posixContext();
    expect(entryMatches(anchored, "ls /home/kyle/clients/client-alpha/private/x", ctx)).toBe(true);
    expect(entryMatches(anchored, "ls /srv/clients/client-alpha/private/x", ctx)).toBe(false);
  });

  it("follows the file system's rule for case", () => {
    const pem = entry("glob", "*.pem");
    expect(entryMatches(pem, "cat KEY.PEM", windowsContext())).toBe(true);
    expect(entryMatches(pem, "cat KEY.PEM", posixContext())).toBe(false);
  });
});

describe("command entries", () => {
  it("matches the command however it is invoked", () => {
    const curl = entry("command", "curl");
    const ctx = posixContext();
    expect(entryMatches(curl, "/usr/bin/curl -s https://example.org", ctx)).toBe(true);
    expect(entryMatches(curl, "C:\\tools\\CURL.EXE -s x", windowsContext())).toBe(true);
    expect(entryMatches(curl, "curling is a sport", ctx)).toBe(false);
  });

  it("matches a command with fixed arguments", () => {
    const push = entry("command", "git push");
    const ctx = posixContext();
    expect(entryMatches(push, "git  push origin main", ctx)).toBe(true);
    expect(entryMatches(push, "git pull origin main", ctx)).toBe(false);
  });
});

describe("env entries", () => {
  const token = entry("env", "API_TOKEN");

  it.each(["echo $API_TOKEN", "echo ${api_token}", "echo %API_TOKEN%", "process.env.API_TOKEN"])(
    "matches %s",
    (text) => {
      expect(entryMatches(token, text, posixContext())).toBe(true);
    },
  );

  it("does not match a longer name that merely contains it", () => {
    expect(entryMatches(token, "echo $MY_API_TOKEN_2", posixContext())).toBe(false);
  });
});

describe("host entries", () => {
  const host = entry("host", "internal.example.com");

  it("matches the host and its subdomains", () => {
    const ctx = posixContext();
    expect(entryMatches(host, "curl https://internal.example.com/x", ctx)).toBe(true);
    expect(entryMatches(host, "curl https://api.INTERNAL.example.com:8443/x", ctx)).toBe(true);
  });

  it("does not match a different host that ends the same way", () => {
    expect(entryMatches(host, "curl https://notinternal.example.com", posixContext())).toBe(false);
  });
});

describe("conversation and regex entries", () => {
  it("finds a conversation id, ignoring case", () => {
    expect(entryMatches(entry("conversation", "conv-8F3A"), "open conv-8f3a", posixContext())).toBe(
      true,
    );
  });

  it("applies a regular expression to the text", () => {
    const invoice = entry("regex", "invoice-\\d{4}");
    expect(entryMatches(invoice, "cat INVOICE-2041.pdf", posixContext())).toBe(true);
    expect(entryMatches(invoice, "cat invoice-final.pdf", posixContext())).toBe(false);
  });
});

describe("decide", () => {
  const policy: Policy = {
    version: 1,
    entries: [
      { kind: "name", mode: "forbid", value: "project-nightingale" },
      { kind: "name", mode: "hide", value: "client-alpha", assistants: ["claude-code"] },
    ],
  };

  it("allows text that touches nothing", () => {
    expect(decide(policy, "ls src", posixContext())).toEqual({ blocked: false });
  });

  it("blocks with the entry's mode and says nothing else", () => {
    expect(decide(policy, "cat project_nightingale.md", posixContext())).toEqual({
      blocked: true,
      mode: "forbid",
    });
  });

  it("applies an entry only to the assistants it names", () => {
    expect(decide(policy, "cat client-alpha.md", posixContext(), "claude-code")).toEqual({
      blocked: true,
      mode: "hide",
    });
    expect(decide(policy, "cat client-alpha.md", posixContext(), "another-assistant")).toEqual({
      blocked: false,
    });
  });

  it("applies every entry when no assistant is given", () => {
    expect(decide(policy, "cat client-alpha.md", posixContext()).blocked).toBe(true);
  });

  it("lets a hide match win over a forbid match", () => {
    expect(decide(policy, "diff client-alpha project-nightingale", posixContext())).toEqual({
      blocked: true,
      mode: "hide",
    });
  });

  it("allows everything under an empty policy", () => {
    expect(decide({ version: 1, entries: [] }, "anything", posixContext())).toEqual({
      blocked: false,
    });
  });
});
