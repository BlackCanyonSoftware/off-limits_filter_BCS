// Measures the guard's start-up overhead against a bare Node start (ADR 0006).
// Run with `npm run measure` (builds first). The budget is 30 ms over bare Node.
//
// A machine's speed drifts while this runs, so each run starts bare Node and the guard back to
// back and keeps the difference; the result is the median difference, which cancels the drift.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath, stdout } from "node:process";
import { fileURLToPath } from "node:url";

const RUNS = 41;
const BUDGET_MS = 30;
const guard = fileURLToPath(new URL("../dist/guard-cjs/guard/main.js", import.meta.url));

const folder = mkdtempSync(join(tmpdir(), "offlimits-measure-"));
const policyFile = join(folder, "policy.json");
writeFileSync(
  policyFile,
  JSON.stringify({
    version: 1,
    entries: [{ kind: "name", mode: "hide", value: "project-nightingale" }],
  }),
);
const input = JSON.stringify({
  tool_name: "Bash",
  cwd: folder,
  tool_input: { command: "ls src" },
});
const env = { ...process.env, OFFLIMITS_POLICY: policyFile };

function time(args, stdin) {
  const start = performance.now();
  spawnSync(execPath, args, { input: stdin, env, stdio: ["pipe", "ignore", "ignore"] });
  return performance.now() - start;
}

const middle = (numbers) => [...numbers].sort((a, b) => a - b)[Math.floor(numbers.length / 2)];

try {
  time([guard], input); // The first run warms the disk cache and is not counted.
  const bare = [];
  const withGuard = [];
  for (let run = 0; run < RUNS; run++) {
    bare.push(time(["-e", "0"], ""));
    withGuard.push(time([guard], input));
  }
  const overhead = middle(withGuard.map((ms, run) => ms - (bare[run] ?? 0)));
  stdout.write(
    `bare node: ${middle(bare).toFixed(0)} ms   guard: ${middle(withGuard).toFixed(0)} ms   ` +
      `overhead: ${overhead.toFixed(0)} ms (budget ${String(BUDGET_MS)} ms, median of ${String(RUNS)} pairs)\n`,
  );
  stdout.write(overhead <= BUDGET_MS ? "within budget\n" : "OVER budget\n");
} finally {
  rmSync(folder, { recursive: true, force: true });
}
