# Roadmap

Sizes: S (about a day), M (a few days), L (a week or more). Status: planned, in progress, done.

## Milestones

| #   | Milestone                                              | Stories           | Size | Status      |
| --- | ------------------------------------------------------ | ----------------- | ---- | ----------- |
| M0  | Walking skeleton                                       | none (foundation) | S    | in progress |
| M1  | Policy and matcher                                     | US-001 to US-005  | M    | planned     |
| M2  | Guard and notice                                       | US-006 to US-009  | M    | planned     |
| M3  | Filter and audit                                       | US-010, US-011    | S    | planned     |
| M4  | Adversarial tests, threat model, first release (0.1.0) | US-012, US-013    | M    | planned     |
| M5  | Reach: other assistants, scan, type-ahead              | US-014 to US-016  | M    | planned     |
| M6  | Isolation launcher                                     | US-017            | L    | planned     |
| M7  | Blind list and machine sync                            | US-018, US-019    | M    | planned     |

### M0. Walking skeleton

Goal: a fresh clone builds, runs and tests with documented commands.
Scope: package setup, `tsc` strict build, ESLint, Prettier, Vitest, `.editorconfig`, `.gitattributes`, `.gitignore`, `.nvmrc`, one CLI command (`offlimits --version`) and one trivial `check` against an in-memory policy, CI on Windows, macOS and Linux, `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`.
Exit criteria: `npm ci && npm run lint && npm run typecheck && npm test && npm run build` pass locally; CI workflow file present (not verified until pushed).

### M1. Policy and matcher

Goal: a real policy file and a trustworthy matcher.
Scope: schema, load and save with owner-only permissions, normaliser, matchers per kind, `init`, `add`, `list`, `remove`, `check`, TTY-only edits, match preview and common-word warnings.
Exit criteria: all Must acceptance criteria for US-001 to US-005 pass; matcher unit tests cover case, separators, Unicode forms, relative paths and links on all three platforms in CI.

### M2. Guard and notice

Goal: Claude Code asks the guard before every tool call.
Scope: verify hook format against current documentation (assumption A1), hook entry point, `install` and `uninstall` for Claude Code settings, self-protection of policy, settings and program files, `snippet` command, standard refusal text.
Exit criteria: integration tests run the hook process against a temporary policy; start-up time measured against the 100 ms budget and recorded in the HANDOFF; if the budget fails, split out a dependency-free entry point.

### M3. Filter and audit

Goal: names stay out of listings, search results and errors.
Scope: stream filter with fail-closed behaviour, filtered marker, counters for blocked and filtered calls, `count` command.
Exit criteria: filter tests include crash, malformed policy, very long lines, very long working directories and binary-looking input; none passes raw text through.

### M4. Adversarial tests, threat model, first release

Goal: the project can show what holds.
Scope: `offlimits test` with at least 8 workaround classes (wildcards, quoting, encoding, case, links, variable expansion, relative paths, assembled paths), `docs/THREAT-MODEL.md`, README coverage table, demo repository script, release notes, check name availability (A5), version 0.1.0.
Exit criteria: the coverage table and `offlimits test` output agree; a new developer clones the repo and ships a small change using only the README and `AGENTS.md`. Publishing is the owner's step.

### M5. Reach

Scope: generated ignore files from one policy (US-014), `scan` (US-015), type-ahead from project folders and common config formats (US-016).

### M6. Isolation launcher

Scope: `offlimits run -- <command>` with masked views. Recipes for bubblewrap, Docker and dev container on Linux and WSL; separate-user and ACL recipe on Windows. Re-run `offlimits test` inside isolation and document which classes close.

### M7. Blind list and sync

Scope: keyed hashed entries with the key kept outside the repository, whole-token matching, a plain note on what a blind list does and does not do. Pull-based sync that keeps the last good copy when the source is unavailable.

## Now / Next / Later

- **Now:** plan approval, then M0.
- **Next:** M1, M2.
- **Later:** M3 to M7.

## Tech debt

None yet. Every `TODO` in the code gets an entry here.
