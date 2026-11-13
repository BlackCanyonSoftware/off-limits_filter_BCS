// Builds the package: everything as ES modules into dist/, then the guard as CommonJS into
// dist/guard-cjs/ (see the note in src/guard/run.ts for why the guard is different).
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execPath, exit } from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const tsc = fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url));

rmSync(new URL("../dist", import.meta.url), { recursive: true, force: true });

for (const project of ["tsconfig.build.json", "tsconfig.guard.json"]) {
  const result = spawnSync(execPath, [tsc, "-p", project], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) exit(result.status ?? 1);
}

// The package is "type": "module", so mark the guard's folder as CommonJS.
mkdirSync(new URL("../dist/guard-cjs", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../dist/guard-cjs/package.json", import.meta.url),
  '{ "type": "commonjs" }\n',
);
