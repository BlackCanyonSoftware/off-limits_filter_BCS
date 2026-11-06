# Off-Limits: guide for AI coding assistants

Off-Limits is a free, open-source command-line tool that lets people choose what their AI assistants can see and touch in their own projects. One policy file drives a guard, an output filter and a standard boundary signal.

**Start every session by reading `docs/HANDOFF.md`. End every session by updating it.**

## Rigor tier

MVP, plus the Production tier's threat model (`docs/THREAT-MODEL.md`, written in Milestone 4).

## Commands

```bash
npm ci                 # install exactly what the lockfile says
npm run build          # tsc: src/ to dist/
npm test               # builds, then runs Vitest (unit and integration)
npm run lint           # ESLint, strict type-aware
npm run format         # Prettier write
npm run format:check   # Prettier check
npm run typecheck      # tsc --noEmit over src and tests
npm run check          # all of the above gates, as CI runs them
```

They work on Windows, macOS and Linux. Node 22.13 or newer (`.nvmrc`). A pre-commit hook in `.githooks/` (installed by `npm ci`) runs format check, lint and typecheck.

## Project map

- `src/core/`: pure functions only. No file system, process, network or clock. Policy schema, matchers per kind (ADR 0005), path and glob rules, warnings, signal text and exit codes.
- `src/platform/`: everything that touches the operating system: policy file store, project scanner, terminal, config path, match context.
- `src/cli/`: `run.ts` dispatches commands, each in `commands/`, using injected `Deps` (see `deps.ts`) and returning an exit code. `main.ts` is the thin entry point.
- `src/guard/`, `src/filter/`, `src/adapters/`: planned. See `docs/ARCHITECTURE.md`.
- `tests/unit/`, `tests/integration/`: tests mirror `src/`. Integration tests run the built program from `dist/`.
- `docs/`: PRD, ARCHITECTURE, DESIGN, ROADMAP, HANDOFF, `adr/`.

## Conventions

- TypeScript `strict`, ES modules, imports end in `.js`. No `any`; validate untrusted input once at the boundary with a schema and pass typed data inward.
- Keep domain logic pure. Side effects live in `platform/` behind small interfaces that tests replace with fakes.
- Small functions, early returns, intention-revealing names, comments that explain why. No dead or commented-out code.
- Use the glossary terms in `docs/PRD.md`: entry, policy, guard, filter, boundary signal, isolation.
- Add dependencies only with a reason. Verify the exact package name and publisher before installing.

## Rules that must never be broken

- **Names stay out.** Entry values never appear in logs, errors, test output, block messages, docs, fixtures or commit messages. Use made-up names only: `client-alpha`, `project-nightingale`.
- **Fail closed.** If the guard or filter cannot read or understand its policy, it refuses or prints nothing. It never passes input through.
- **One signal.** Every refusal uses `BLOCKED_MESSAGE` and exit code 2 from `src/core/signal.ts`. It never says which entry or rule matched.
- **No network, no telemetry.** The tool works fully offline.
- **Honest claims.** Docs describe what each layer covers. Do not claim more than `offlimits test` shows.
- **Brand.** Load tokens from the brand bundle; never retype a brand colour, size or font; never edit generated brand files (`docs/brand/`) by hand. The brand is `off-limits` and its design standard is IBM Carbon (`docs/DESIGN.md`, Brand).
- Secrets never go in code, git history or logs.
- Never weaken, skip or delete a test, or bypass a hook (`--no-verify`) to get a passing run.

## Git

- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), small and focused, explaining why.
- Commit locally. **Never push.** The owner reviews and pushes.
- No attribution lines for AI tools in commits or docs. Commits are authored by the owner only.
- Plain `git commit`; do not pin an identity on the command line.
- No history rewriting or force-push unless the owner asks.

## Building a slice

1. Restate the story's acceptance criteria from `docs/PRD.md`.
2. Write the failing test first for domain logic and for every bug fix. Name tests after the behaviour and reference story IDs (`US-004`).
3. Build the smallest version that works end to end.
4. Review your own diff: naming, duplication, dead code, scope, whether any name could leak.
5. Update the docs the change touches (README, ROADMAP status, ADR for significant decisions, CHANGELOG for user-visible changes).
6. Commit once the Definition of Done holds.

## Definition of Done

1. Meets the acceptance criteria.
2. Tests cover the new behaviour and the whole suite passes.
3. Format check, lint and typecheck pass with no new warnings, and the build succeeds.
4. You ran it and observed the result.
5. The rules above hold.
6. Affected docs are updated in the same commit.
7. No leftover debug code, untracked TODOs, or placeholders presented as real.
8. Committed locally as a focused Conventional Commit.

## Ask before

Changing the stack, adding a paid service or anything with ongoing cost, changing the policy file format or the boundary signal once released, deleting files you did not create, or opening windows or apps on the owner's desktop.

## Report format

At the end of a session or milestone: Summary, Done, Verification (each check with its actual result; anything unrun is "not verified"), Try it, Decisions and assumptions, Deviations, Known issues and tech debt, Next, Needs you.

More detail: `CONTRIBUTING.md`.
