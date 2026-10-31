# Handoff

Read this first in every session. Update it at the end of every session.

## Current state

Milestone 0 is done and committed locally: tooling, core, CLI skeleton, 20 tests, CI workflow (not run until pushed), all documents, and the brand banners. Next is Milestone 1 (policy and matcher).

## Decisions made (2026-10-30)

| Topic              | Decision                                                             | Where              |
| ------------------ | -------------------------------------------------------------------- | ------------------ |
| Core promise of v1 | Declare, guard and filter; isolation is a later milestone            | ADR 0004           |
| Stack              | TypeScript on Node 22 LTS or newer                                   | ADR 0001           |
| Rigor tier         | MVP, plus the Production tier's threat model                         | PRD                |
| Licence            | MIT (already in the repository's initial commit)                     | `LICENSE`          |
| Policy home        | User config folder, YAML                                             | ADR 0002           |
| Boundary signal    | Fixed message and exit code 2, never naming the entry                | ADR 0003           |
| Platforms          | Core on Windows, macOS, Linux; isolation recipes Linux and WSL first | PRD A2, ROADMAP M6 |
| First assistants   | Claude Code guard; ignore-file generation for others from M5         | ROADMAP            |

## Work in progress

None.

## Next steps

1. Owner reviews and pushes M0. Check the first CI run on all three platforms.
2. Start M1 (policy and matcher), in a fresh session.

## Open questions

- Package and domain name availability (PRD A5): `offlimits` and `off-limits` both return 404 on npm as of 2026-10-30. GitHub and domains are unchecked. Check again before the first publish.
- Brand assets are ready (kit `off-limits`, generated 2026-10-30, in `C:\Users\Kpier\Documents\Brand Logos`). The README-set banners are in `docs/brand/` and verified with `brandkit check`. In `brands/off-limits/brand.toml` the `tagline`, `summary` and `domain` are still empty: the owner to supply them if wanted. Owner to confirm the wording of the artwork-licence line now in `README.md` and `CONTRIBUTING.md` (see `docs/DESIGN.md`, Brand).
- Whether the hook ships as a sub-command or a separate tiny package (decide with M2 measurements).

## Gotchas

- Use made-up names (`client-alpha`, `project-nightingale`) in all code, tests, docs and examples. Real entry names never go in the repository.
- Verify the Claude Code hook format against current documentation at the start of M2 (PRD A1).
- Do not launch windows or apps on the owner's desktop without asking. Avoid `wsl` calls during setup; one earlier call may have flashed a console window.
- The feasibility assessment lives outside the repo at `C:\Users\Kpier\Documents\Off-Limits_Idea\Off-Limits_Feasibility_Assessment.md`. Its sources should be re-verified before any are quoted in public docs.
- Commits are local only. The owner pushes.

## Placeholders

- `offlimits check --entry <value> <text>` takes entries on the command line. This is a skeleton for the walking skeleton; from M1 it reads the policy file instead.
- `package.json` has `"private": true` so nothing is published by accident. Remove at release.

## Known issues and tech debt

- `npm audit` reports 11 moderate findings, all via `minimatch` in the lint toolchain (dev-only, not shipped). The offered fix is a breaking downgrade of ESLint, so it was not applied. CI fails only on high or critical. Re-check when ESLint or typescript-eslint release updates.
- TypeScript is pinned to `~6.0.3` because `typescript-eslint` 8.x supports `<6.1.0`. Move to TypeScript 7 when it is supported.

## Session log

| Date       | Summary                                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-30 | M0 finished: README and CONTRIBUTING written after the owner cleared the guard hook; milestone marked done.                                                       |
| 2026-10-30 | Brand: bundled the README banner pair into `docs/brand/` with `brandkit bundle`, verified with `brandkit check`, documented the brand in `docs/DESIGN.md`.        |
| 2026-10-30 | M0: tooling, core, CLI skeleton, 20 tests, CI workflow, AGENTS, CLAUDE, CHANGELOG. README and CONTRIBUTING blocked by the owner's guard hook; pending.            |
| 2026-10-30 | Kickoff: questions answered, git initialised and synced with the remote, PRD, architecture, design, roadmap, ADRs 0001 to 0004 and this handoff written. No code. |
