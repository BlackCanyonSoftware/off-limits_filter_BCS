# 0001. TypeScript on Node

- Status: accepted (owner, 2026-10-30). Revised 2026-11-17: the baseline moved from Node 22 to Node 26, the current LTS.

## Context

Off-Limits is a command-line tool and a set of hooks that assistants run before every tool call. It must work the same on Windows, macOS and Linux, install in one command, and start quickly.

## Options considered

1. **TypeScript on Node.** Distributed through npm and `npx`. Strict typing, one runtime on all three platforms, a large audience that already has Node because their assistants need it.
2. **Python.** Distributed through pipx. A very small core and Python is already installed on the maintainer's machine. Windows packaging and start-up are slightly rougher.
3. **Go or Rust single binary.** Fastest start-up and no runtime. Heavier toolchain for contributors and cross-compiling releases adds early overhead.

## Decision

TypeScript (`strict`) on Node 26 LTS or newer (first written as Node 22; CI and the project now both use `.nvmrc`, which says 26), built with `tsc`, tested with Vitest, linted with ESLint and formatted with Prettier. Command-line parsing uses Node's built-in `util.parseArgs`. The policy is read and checked with the standard library alone, so the tool has no runtime dependencies (see ADR 0006). Package names and publishers are verified before install.

## Consequences

- Contributors need only Node and npm.
- Hook start-up is a Node process launch. Its overhead is measured against a budget stated in ADR 0006.
- A native single binary stays possible later because the core is pure functions with no framework ties.
