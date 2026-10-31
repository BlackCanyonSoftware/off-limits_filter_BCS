# Handoff

Read this first in every session. Update it at the end of every session.

## Current state

Planning is written and committed locally. No code exists yet. Waiting for the owner's go-ahead on the plan, then Milestone 0.

## Decisions made (2026-10-30)

| Topic | Decision | Where |
|---|---|---|
| Core promise of v1 | Declare, guard and filter; isolation is a later milestone | ADR 0004 |
| Stack | TypeScript on Node 22 LTS or newer | ADR 0001 |
| Rigor tier | MVP, plus the Production tier's threat model | PRD |
| Licence | MIT (already in the repository's initial commit) | `LICENSE` |
| Policy home | User config folder, YAML | ADR 0002 |
| Boundary signal | Fixed message and exit code 2, never naming the entry | ADR 0003 |
| Platforms | Core on Windows, macOS, Linux; isolation recipes Linux and WSL first | PRD A2, ROADMAP M6 |
| First assistants | Claude Code guard; ignore-file generation for others from M5 | ROADMAP |

## Work in progress

None.

## Next steps

1. Owner reviews `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/ROADMAP.md` and the ADRs.
2. On approval, start M0 (walking skeleton).

## Open questions

- Package and domain name availability (PRD A5), checked before the first publish.
- Brand assets are not ready. Ask the owner before any visual work. Brand Logos folder: `C:\Users\Kpier\Documents\Brand Logos`.
- Whether the hook ships as a sub-command or a separate tiny package (decide with M2 measurements).

## Gotchas

- Use made-up names (`client-alpha`, `project-nightingale`) in all code, tests, docs and examples. Real entry names never go in the repository.
- Verify the Claude Code hook format against current documentation at the start of M2 (PRD A1).
- Do not launch windows or apps on the owner's desktop without asking. Avoid `wsl` calls during setup; one earlier call may have flashed a console window.
- The feasibility assessment lives outside the repo at `C:\Users\Kpier\Documents\Off-Limits_Idea\Off-Limits_Feasibility_Assessment.md`. Its sources should be re-verified before any are quoted in public docs.
- Commits are local only. The owner pushes.

## Placeholders

None.

## Session log

| Date | Summary |
|---|---|
| 2026-10-30 | Kickoff: questions answered, git initialised and synced with the remote, PRD, architecture, design, roadmap, ADRs 0001 to 0004 and this handoff written. No code. |
