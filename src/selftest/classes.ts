import { join } from "node:path";
import type { Attempt, Fixture, WorkaroundClass } from "./types.js";

/** The variable the test sets for the guard, so attempts can refer to the fixture through it. */
export const ROOT_VARIABLE = "OFFLIMITS_TEST_ROOT";

const b64 = (text: string): string => Buffer.from(text).toString("base64");
const hex = (text: string): string => Buffer.from(text).toString("hex");
const code = (...points: number[]): string => String.fromCharCode(...points);

/** Where things are, written with the separators this system uses. */
function where(fx: Fixture): { notes: string; clients: string; link: string | undefined } {
  return {
    notes: join(fx.protectedDir, "notes.md"),
    clients: join(fx.root, "clients"),
    link: fx.link === undefined ? undefined : join(fx.link, "notes.md"),
  };
}

/** The names the test policy protects, none of them real: `client-alpha` and friends. */
const spelling: WorkaroundClass = {
  id: "spelling",
  title: "Spelling and case",
  layers: ["guard", "filter"],
  attempts: () => [
    { label: "Capital letters and an underscore", command: "cat Client_Alpha/notes.md" },
    { label: "All capitals", command: "cat CLIENT-ALPHA/notes.md" },
    { label: "Separators left out", command: "cat clientalpha/notes.md" },
    { label: "Spaces instead of a hyphen", command: "ls client alpha" },
    {
      label: "Full-width letters",
      command: `cat ${code(0xff43, 0xff4c, 0xff49, 0xff45, 0xff4e, 0xff54, 0xff0d, 0xff41, 0xff4c, 0xff50, 0xff48, 0xff41)}/notes.md`,
    },
  ],
};

const paths: WorkaroundClass = {
  id: "paths",
  title: "Paths written another way",
  layers: ["guard", "filter"],
  attempts: (fx) => {
    const w = where(fx);
    return [
      { label: "The full path", command: `cat ${w.notes}` },
      {
        label: "Through a parent folder and ..",
        command: `cat ${join(w.clients, "other", "..", "client-alpha", "notes.md")}`,
      },
      {
        label: "With a doubled separator",
        command: `cat ${w.clients}${fx.platform === "win32" ? "\\\\" : "//"}client-alpha${fx.platform === "win32" ? "\\" : "/"}notes.md`,
      },
      {
        label: "A relative path after cd",
        command: `cd ${w.clients} && cat client-alpha/notes.md`,
      },
      {
        label: "A relative path after pushd",
        command: `pushd ${w.clients} && cat ./client-alpha/notes.md`,
      },
      {
        label: "A relative path after two cd steps",
        command: `cd ${fx.root} && cd clients && cat client-alpha/notes.md`,
      },
    ];
  },
};

const windowsForms: WorkaroundClass = {
  id: "windows-forms",
  title: "Windows path forms",
  layers: ["guard"],
  notApplicable: (fx) => (fx.platform === "win32" ? undefined : "this is not Windows"),
  attempts: (fx) => {
    const notes = join(fx.protectedDir, "notes.md");
    return [
      { label: "The extended-length prefix", command: `type \\\\?\\${notes}` },
      { label: "The device prefix", command: `type \\\\.\\${notes}` },
      { label: "A trailing dot on a folder name", command: `type ${fx.protectedDir}.\\notes.md` },
      {
        label: "A trailing space on a folder name",
        command: `type "${fx.protectedDir} \\notes.md"`,
      },
      {
        label: "Forward slashes and other case",
        command: `type ${notes.replaceAll("\\", "/").toUpperCase()}`,
      },
    ];
  },
};

const links: WorkaroundClass = {
  id: "links",
  title: "Through a link",
  layers: ["guard"],
  notApplicable: (fx) =>
    fx.link === undefined ? "this system would not create a link" : undefined,
  attempts: (fx) => [
    { label: "A link to the folder", command: `cat ${where(fx).link ?? ""}` },
    {
      label: "A link, read with another tool",
      call: { tool: "Read", input: { file_path: where(fx).link ?? "" } },
    },
  ],
};

const quoting: WorkaroundClass = {
  id: "quoting",
  title: "Quoting that a shell removes",
  layers: ["guard"],
  attempts: (fx) => [
    { label: "Double quotes inside the name", command: 'cat cl"ient"-alpha/notes.md' },
    { label: "Single quotes around part of it", command: "cat 'client-'alpha/notes.md" },
    { label: "A backslash before a letter", command: "cat cl\\ient-alpha/notes.md" },
    {
      label: "Quotes inside a full path",
      command: `cat ${fx.protectedDir.replace("client-alpha", 'cl"ient"-alpha')}${fx.platform === "win32" ? "\\" : "/"}notes.md`,
    },
  ],
};

const wildcards: WorkaroundClass = {
  id: "wildcards",
  title: "Wildcards a shell expands",
  layers: ["guard"],
  attempts: (fx) => {
    const sep = fx.platform === "win32" ? "\\" : "/";
    const clients = join(fx.root, "clients");
    return [
      {
        label: "A star after part of the name",
        command: `cat ${clients}${sep}client-al*${sep}notes.md`,
      },
      {
        label: "A question mark for one letter",
        command: `cat ${clients}${sep}client-alph?${sep}notes.md`,
      },
      { label: "A set of letters", command: `cat ${clients}${sep}client-[a]lpha${sep}notes.md` },
      { label: "A star at the start", command: `cat ${clients}${sep}*lient-alpha${sep}notes.md` },
    ];
  },
};

const variables: WorkaroundClass = {
  id: "variables",
  title: "Variables and assembled names",
  layers: ["guard"],
  attempts: (fx) => {
    const sep = fx.platform === "win32" ? "\\" : "/";
    return [
      {
        label: "A path through an environment variable",
        command: `cat $${ROOT_VARIABLE}/clients/client-alpha/notes.md`,
      },
      {
        label: "The same with braces",
        command: `cat \${${ROOT_VARIABLE}}/clients/client-alpha/notes.md`,
      },
      {
        label: "A folder name held in a variable",
        command: `d=client-alpha; cat ${join(fx.root, "clients")}${sep}$d${sep}notes.md`,
      },
      {
        label: "A name built from two variables",
        command: `a=client; b=-alpha; cat ${join(fx.root, "clients")}${sep}\${a}\${b}${sep}notes.md`,
      },
      {
        label: "A name built from three pieces",
        command: "a=cli; b=ent; c=-alpha; cat $a$b$c/notes.md",
      },
      ...(fx.platform === "win32"
        ? [
            {
              label: "A Windows variable",
              command: `type %${ROOT_VARIABLE}%\\clients\\client-alpha\\notes.md`,
            },
          ]
        : []),
    ];
  },
};

const encodings: WorkaroundClass = {
  id: "encodings",
  title: "Text spelled with codes",
  layers: ["guard", "filter"],
  attempts: () => [
    { label: "Base64", command: `echo ${b64("client-alpha")} | base64 -d | xargs cat` },
    { label: "Hexadecimal", command: `echo ${hex("client-alpha")} | xxd -r -p | xargs cat` },
    { label: "Percent codes", command: "cat cl%69ent-alpha/notes.md" },
    { label: "Hex escapes", command: "cat $'\\x63lient-alpha'/notes.md" },
    { label: "Unicode escapes", command: "printf '\\u0063lient-alpha'" },
    { label: "Octal escapes", command: "cat $'\\143lient-alpha'/notes.md" },
  ],
};

const invisible: WorkaroundClass = {
  id: "invisible",
  title: "Invisible characters",
  layers: ["guard", "filter"],
  attempts: () => [
    {
      label: "A zero-width space inside the name",
      command: `cat cli${code(0x200b)}ent-alpha/notes.md`,
    },
    { label: "A soft hyphen inside the name", command: `cat cli${code(0xad)}ent-alpha/notes.md` },
    {
      label: "Terminal colour codes inside the name",
      command: `ls cl${code(0x1b)}[31mient${code(0x1b)}[0m-alpha`,
    },
  ],
};

/** A blind entry for the made-up name `project-nightingale`: only its keyed hash is in the policy. */
const blind: WorkaroundClass = {
  id: "blind",
  title: "Blind entries (stored only as a hash)",
  layers: ["guard", "filter"],
  attempts: () => [
    { label: "Capitals and an underscore", command: "cat Project_Nightingale/notes.md" },
    { label: "The plain name", command: "ls project-nightingale" },
    { label: "Spaces instead of a hyphen", command: "cat project nightingale" },
    { label: "Quotes inside the name", command: 'cat pr"oject"-nightingale/notes.md' },
    { label: "Base64", command: `echo ${b64("project-nightingale")} | base64 -d | xargs cat` },
    { label: "Inside a path", command: "cat /srv/clients/Project-Nightingale/notes.md" },
  ],
};

const otherTools: WorkaroundClass = {
  id: "other-tools",
  title: "Other tools, hosts and variables",
  layers: ["guard"],
  attempts: (fx) => [
    { label: "Reading a file", call: { tool: "Read", input: { file_path: where(fx).notes } } },
    {
      label: "Searching inside the folder",
      call: { tool: "Grep", input: { pattern: "todo", path: fx.protectedDir } },
    },
    {
      label: "Listing the folder",
      call: { tool: "Glob", input: { pattern: "**/*", path: fx.protectedDir } },
    },
    {
      label: "Writing into the folder",
      call: { tool: "Write", input: { file_path: where(fx).notes, content: "x" } },
    },
    {
      label: "Fetching a protected host",
      call: {
        tool: "WebFetch",
        input: { url: "https://api.alpha.internal.example/data", prompt: "read" },
      },
    },
    { label: "Printing a protected variable", command: "echo $ALPHA_TOKEN" },
    {
      label: "A tool whose name holds the name",
      call: { tool: "mcp__client_alpha__lookup", input: { query: "anything" } },
    },
  ],
};

const selfProtection: WorkaroundClass = {
  id: "self-protection",
  title: "Reaching the policy, the guard or its settings",
  layers: ["guard"],
  attempts: (fx) => [
    {
      label: "Reading the policy file",
      call: { tool: "Read", input: { file_path: fx.policyFile } },
    },
    {
      label: "Searching inside the policy file",
      call: { tool: "Grep", input: { pattern: "value", path: fx.policyFile } },
    },
    {
      label: "Editing the settings that register the guard",
      call: {
        tool: "Edit",
        input: { file_path: fx.settingsFile, old_string: "a", new_string: "b" },
      },
    },
    {
      label: "Reading the counts file",
      call: { tool: "Read", input: { file_path: fx.countsFile } },
    },
    { label: "Listing the entries", command: "offlimits list" },
    { label: "Removing the guard", command: "npx offlimits uninstall" },
    { label: "Adding an entry", command: "offlimits add something" },
  ],
};

const longInput: WorkaroundClass = {
  id: "long-input",
  title: "Very long and odd input",
  layers: ["guard", "filter"],
  attempts: () => {
    const padded = `${"x".repeat(2 * 1024 * 1024)} client-alpha`;
    return [
      { label: "The name after 2 MB of other text", command: `echo ${padded}` },
      { label: "The name after a NUL character", command: `echo a${code(0)}b client-alpha` },
    ];
  },
};

/** What string matching is documented not to cover: shown, expected to get through, not a failure. */
const outsideTextMatching: WorkaroundClass = {
  id: "outside-text-matching",
  title: "Known not covered by text matching (isolation covers these)",
  layers: ["guard"],
  outsideTextMatching: true,
  attempts: (fx) => [
    { label: "A name built by a command", command: `cat "$(printf 'client-%s' alpha)/notes.md"` },
    {
      label: "A name chosen by a command",
      command: `cat "$(ls ${join(fx.root, "clients")} | head -1)/notes.md"`,
    },
    {
      label: "A look-alike letter from another alphabet",
      command: `cat client-${code(0x0430)}lpha/notes.md`,
    },
    { label: "A script that holds the name", command: "bash ./run-the-thing.sh" },
    {
      label: "A blind name inside a longer word (blind entries match whole words)",
      command: "cat myprojectnightingalefolder/notes.md",
    },
  ],
};

export const WORKAROUND_CLASSES: readonly WorkaroundClass[] = [
  spelling,
  paths,
  windowsForms,
  links,
  quoting,
  wildcards,
  variables,
  encodings,
  invisible,
  blind,
  otherTools,
  selfProtection,
  longInput,
  outsideTextMatching,
];

/** The entries the test policy holds. Made up: nothing here is from anyone's real policy. */
export function testPolicyEntries(fx: Pick<Fixture, "protectedDir">): object[] {
  return [
    { kind: "name", mode: "hide", value: "client-alpha" },
    { kind: "path", mode: "forbid", value: fx.protectedDir },
    { kind: "env", mode: "forbid", value: "ALPHA_TOKEN" },
    { kind: "host", mode: "forbid", value: "alpha.internal.example" },
  ];
}

export type { Attempt };
