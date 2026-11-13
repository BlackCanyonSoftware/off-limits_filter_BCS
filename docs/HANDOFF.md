# Handoff

Read this first in every session. Update it at the end of every session.

## Current state

Milestones 0 and 1 are done and committed locally. You can `init` a policy, `add`, `list` and `remove` entries (terminal only), and `check` text against it. 144 tests pass; the CI workflow has never run (nothing is pushed). Next is Milestone 2 (guard and notice): the Claude Code hook, `snippet`, `install`, and self-protection.

Brand last checked: 2026-11-06 · brandkit 1.56.1 · Brand Logos commit eef776be (dirty, other brands' files only) · set: readme · result: in sync

The brand is built to IBM Carbon (design-standards rollout, kit 1.56.0 directions). The repo has no screen, so only the record changed; see `docs/DESIGN.md`, Brand.

## Decisions made (2026-10-30)

| Topic              | Decision                                                             | Where              |
| ------------------ | -------------------------------------------------------------------- | ------------------ |
| Core promise of v1 | Declare, guard and filter; isolation is a later milestone            | ADR 0004           |
| Stack              | TypeScript on Node 22 LTS or newer                                   | ADR 0001           |
| Rigor tier         | MVP, plus the Production tier's threat model                         | PRD                |
| Licence            | MIT (already in the repository's initial commit)                     | `LICENSE`          |
| Policy home        | User config folder, JSON                                             | ADR 0002, 0006     |
| Boundary signal    | Fixed message and exit code 2, never naming the entry                | ADR 0003           |
| Platforms          | Core on Windows, macOS, Linux; isolation recipes Linux and WSL first | PRD A2, ROADMAP M6 |
| First assistants   | Claude Code guard; ignore-file generation for others from M5         | ROADMAP            |
| Matching per kind  | One rule per kind; Windows permissions rely on the profile folder    | ADR 0005           |

## Work in progress

None.

## Status: 0.1.0 is built, with M5 and M6 on top of it

M0 to M6 are built and committed (M6: `run`, the isolation planner, bubblewrap and Docker builders, `docs/ISOLATION.md`, ADR 0011) (M5: `ignore-files`, `scan`, Tab completion at the `add` prompt, ADR 0010): the policy and matcher, the guard, `install`/`uninstall`, `explain`, `snippet`, the output filter, the audit counts, `offlimits test`, the finished threat model, and the 0.1.0 version and changelog. About 474 tests pass. Designs: ADR 0005 to 0010. The guard and filter are built as CommonJS in `dist/guard-cjs/` (see AGENTS.md for the rules that follow).

**Measured:** `offlimits test` held for every covered group on this Windows machine (`docs/THREAT-MODEL.md`). The guard adds about 31 to 33 ms over a bare Node start (`npm run measure`; 25 to 33 ms seen depending on machine load; the budget is 30). The previous commit measured 31 ms against 33 ms for this one, so the broader matching cost about 2 ms.

**Not verified:** `offlimits install` has never been run against a real Claude Code settings file and the guard has never run in a live session; the filter has not been used in a real pipeline by a person; CI has not run any of M2 to M4. `docs/RELEASING.md` has the steps. The Windows permissions story is relied on, not measured.

**M5 notes:** `scan` takes 1 to 2 seconds on this repository (about 25 microseconds per line); a first run measured 5.6 seconds while the machine was busy. The ignore-file patterns are checked with real `git check-ignore`. Tab completion at the prompt has not been tried by a person at a real terminal.

**M6 notes:** the planner found a real problem in testing: a link pointing at a hidden folder would carry the name into the view, so such links are now left out. Real bubblewrap and Docker have NOT been run: the runtime tests (`tests/integration/isolation-runtime.test.ts`) skip without a working bubblewrap and were skipped on this Windows machine. Run them in WSL (steps in `docs/ISOLATION.md`) before claiming isolation works. Windows has no native backend.

**Known limits:** the filter reads input as UTF-8 text. The counts file has no reset. Text matching cannot read what a command builds at run time, look-alike letters, or a script's content (isolation, M6, covers them). On this Windows machine a process cannot start from a working directory over about 260 characters whatever the program.

**A mistake to avoid:** a scratch `git worktree` with a junction to `node_modules` emptied the real `node_modules` when it was removed. It was restored with `npm ci`. Do not junction `node_modules` into a worktree you will delete.

## Next steps

1. M7: the blind list (keyed hashes instead of names, key kept outside the repository) and pull-based sync that keeps the last good copy. Both change the policy format, so each needs an ADR first.
2. Run the isolation runtime tests in WSL (or any Linux) and record the result in the threat model.
3. Last, the owner's own steps: review, push, and `docs/RELEASING.md`.

## Open questions

- Package and domain name availability (PRD A5): `offlimits` and `off-limits` both return 404 on npm as of 2026-10-30. GitHub and domains are unchecked. Check again before the first publish.
- Brand assets are ready (kit `off-limits`, re-synced 2026-11-01 from brandkit 1.49.0, in `C:\Users\Kpier\Documents\Brand Logos`). The typeface is now Libre Franklin, not Nunito; the palette is unchanged. The README-set banners are in `docs/brand/` and verified with `brandkit check`. In `brands/off-limits/brand.toml` the `tagline`, `summary` and `domain` are still empty: the owner to supply them if wanted. Owner to confirm the wording of the artwork-licence line now in `README.md` and `CONTRIBUTING.md` (see `docs/DESIGN.md`, Brand).
- Whether the hook ships as a sub-command or a separate tiny package (decide with M2 measurements).

## Gotchas

- Use made-up names (`client-alpha`, `project-nightingale`) in all code, tests, docs and examples. Real entry names never go in the repository.
- Verify the Claude Code hook format against current documentation at the start of M2 (PRD A1).
- Do not launch windows or apps on the owner's desktop without asking. Avoid `wsl` calls during setup; one earlier call may have flashed a console window.
- The feasibility assessment lives outside the repo at `C:\Users\Kpier\Documents\Off-Limits_Idea\Off-Limits_Feasibility_Assessment.md`. Its sources should be re-verified before any are quoted in public docs.
- Commits are local only. The owner pushes.

## Placeholders

- None in the code. The M0 skeleton `check --entry` is gone: `check` now reads the policy file.
- `package.json` has `"private": true` so nothing is published by accident. Remove at release.

## Known issues and tech debt

- `npm audit` reports 11 moderate findings, all via `minimatch` in the lint toolchain (dev-only, not shipped). The offered fix is a breaking downgrade of ESLint, so it was not applied. CI fails only on high or critical. Re-check when ESLint or typescript-eslint release updates.
- Matching limits (regex time budget, variable expansion, link-lookup budget, unquoted paths with spaces) are in the Tech debt table in `docs/ROADMAP.md` with the milestone that owns each.
- The prompt (`ask`) and the terminal check were tried only with piped input in this session, not by a person at a real terminal. Try `offlimits add client-alpha` yourself in a terminal before relying on it.
- TypeScript is pinned to `~6.0.3` because `typescript-eslint` 8.x supports `<6.1.0`. Move to TypeScript 7 when it is supported.

## Session log

| Date       | Summary                                                                                                                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-06 | Design-standards rollout: preflight clean, README banner set already matched the current build (no re-bundle), no UI to bring up. Recorded IBM Carbon, the typeface roles and provenance in DESIGN.md, and retired the hex table there. AGENTS.md gains the brand rule. |
| 2026-11-01 | Brand re-sync: kit rebuilt (1.49.0, typeface now Libre Franklin). Re-bundled the README set into `docs/brand/`, verified with `brandkit check`, updated DESIGN.md. No stylesheet exists, so no font ships yet.                                                          |
| 2026-10-30 | M1: policy schema, eight matchers, file store, scanner, `init`/`add`/`list`/`remove`/`check`, 144 tests, ADR 0005.                                                                                                                                                      |
| 2026-10-30 | M0 finished: README and CONTRIBUTING written after the owner cleared the guard hook; milestone marked done.                                                                                                                                                             |
| 2026-10-30 | Brand: bundled the README banner pair into `docs/brand/` with `brandkit bundle`, verified with `brandkit check`, documented the brand in `docs/DESIGN.md`.                                                                                                              |
| 2026-10-30 | M0: tooling, core, CLI skeleton, 20 tests, CI workflow, AGENTS, CLAUDE, CHANGELOG. README and CONTRIBUTING blocked by the owner's guard hook; pending.                                                                                                                  |
| 2026-10-30 | Kickoff: questions answered, git initialised and synced with the remote, PRD, architecture, design, roadmap, ADRs 0001 to 0004 and this handoff written. No code.                                                                                                       |
