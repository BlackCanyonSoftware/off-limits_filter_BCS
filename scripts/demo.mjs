// A short, narrated demonstration with made-up names, using the real built guard and filter.
// Run with `npm run demo` (builds first). It reads nothing of yours and cleans up after itself.
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { execPath, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { createFixture, createRunner } from "../dist/platform/selftest.js";

const dist = (path) => fileURLToPath(new URL(`../dist/${path}`, import.meta.url));
const say = (text = "") => stdout.write(`${text}\n`);

const { fixture, cleanup } = createFixture();
const runner = createRunner({
  guard: dist("guard-cjs/guard/main.js"),
  filter: dist("guard-cjs/filter/main.js"),
});

try {
  say("Off-Limits demo");
  say("A made-up project has a folder called client-alpha, and a policy that protects it.");
  say("The guard checks each tool call before it runs:");
  say();

  const calls = [
    [
      "Read a file in the protected folder",
      { call: { tool: "Read", input: { file_path: join(fixture.protectedDir, "notes.md") } } },
    ],
    ["The same, with the name spelled differently", { command: "cat Client_Alpha/notes.md" }],
    ["The same, with quotes a shell would remove", { command: 'cat cl"ient"-alpha/notes.md' }],
    [
      "The same, reached with cd and a relative path",
      { command: `cd ${join(fixture.root, "clients")} && cat client-alpha/notes.md` },
    ],
    [
      "Read the policy file itself",
      { call: { tool: "Read", input: { file_path: fixture.policyFile } } },
    ],
    ["Ordinary work", { command: "git status && npm test" }],
  ];
  for (const [label, attempt] of calls) {
    const outcome = await runner.guard({ label, ...attempt }, fixture);
    say(`  ${outcome === "held" ? "refused " : "allowed "}  ${label}`);
  }

  say();
  say("The filter hides lines in command output that touch the list:");
  say();
  const lines = [
    "total 3",
    "drwxr-xr-x  client-alpha",
    "drwxr-xr-x  CLIENT_ALPHA-backup",
    "drwxr-xr-x  other",
    "-rw-r--r--  README.md",
  ];
  const output = await new Promise((resolve) => {
    const child = spawn(execPath, [dist("guard-cjs/filter/main.js")], {
      cwd: fixture.root,
      env: { ...process.env, OFFLIMITS_POLICY: fixture.policyFile },
    });
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.on("close", () => resolve(Buffer.concat(chunks).toString("utf8")));
    child.stdin.end(`${lines.join("\n")}\n`);
  });
  say("  before:");
  for (const line of lines) say(`    ${line}`);
  say("  after:");
  for (const line of output.trimEnd().split("\n")) say(`    ${line}`);

  say();
  say("This is text matching: it reduces accidental exposure. Run `node dist/cli/main.js test`");
  say("to see exactly what holds, and read docs/THREAT-MODEL.md for what does not.");
} finally {
  cleanup();
}
