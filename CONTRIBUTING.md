# Contributing to Off-Limits

Thank you for helping. This page explains how to set up, how work flows, and what "done" means. The short version for AI assistants is in [AGENTS.md](AGENTS.md).

## Setup

1. Install Node 22.13 or newer (`.nvmrc` says `22`).
2. Fork or clone the repository, then:

```bash
npm ci
npm run check
```

`npm ci` also installs the pre-commit hook. A fresh clone should pass `npm run check` before you change anything. If it does not, open an issue.

## Workflow

1. Pick a story from [docs/ROADMAP.md](docs/ROADMAP.md). Stories and acceptance criteria are in [docs/PRD.md](docs/PRD.md).
2. Write the failing test first for domain logic and for every bug fix.
3. Build the smallest version that works end to end.
4. Read your own diff as a demanding reviewer would.
5. Update the docs the change touches, in the same commit.

## Branches and commits

- Keep `main` working.
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Explain why, not only what.
- Keep commits small and focused, ideally under about 400 changed lines excluding generated files.
- Do not mix formatting or refactoring with behaviour changes in one commit.

## Code conventions

- TypeScript `strict`; ES modules; local imports end in `.js`.
- `src/core/` is pure: no file system, process, network or clock. Side effects live in `src/platform/` behind small interfaces.
- Validate untrusted input once at the boundary and pass typed data inward.
- Fail fast and handle errors explicitly. Never swallow an error.
- One source of truth for every rule, constant and type.
- Use the glossary terms in the PRD.

## Rules specific to this project

- **Names stay out.** Real entry values never appear in code, tests, docs, fixtures, logs or commit messages. Use made-up names such as `client-alpha`.
- **Fail closed.** The guard and filter refuse or print nothing when they cannot trust their policy.
- **One signal.** Refusals use the shared message and exit code and never name the entry.
- **Honest docs.** Say what each layer covers and what it does not.
- **Brand files are generated.** Do not edit anything in `docs/brand/` by hand. See [docs/DESIGN.md](docs/DESIGN.md).

## Testing strategy

- Many fast unit tests for `src/core/`.
- Integration tests run the built program as a hook would and check exit codes and output.
- Adversarial tests (Milestone 4) hold the workaround classes used by `offlimits test`.
- Tests check behaviour through public interfaces, are deterministic, and use fakes for time, files and processes where needed. Name them after the behaviour and reference story IDs.
- Coverage is a signal, not a target.

## Quality gates

| Gate             | Command                        | Where it runs        |
| ---------------- | ------------------------------ | -------------------- |
| Formatting       | `npm run format:check`         | pre-commit, CI       |
| Lint             | `npm run lint`                 | pre-commit, CI       |
| Type check       | `npm run typecheck`            | pre-commit, CI       |
| Tests            | `npm test`                     | CI (run before a PR) |
| Dependency audit | `npm audit --audit-level=high` | CI                   |

Fix the reported problem rather than bypassing a gate. A suppression needs a comment explaining why.

## Definition of Done

1. It meets the acceptance criteria.
2. Tests cover the new behaviour and the whole suite passes.
3. Format check, lint and type check pass, and the build succeeds.
4. You ran it and saw it work.
5. The project rules above hold.
6. Affected docs are updated: README or AGENTS.md if commands changed, ROADMAP status, an ADR for any significant decision, CHANGELOG for user-visible changes.
7. No leftover debug code, commented-out code or untracked TODOs. Every TODO has a ROADMAP entry.
8. It is committed as a focused Conventional Commit.

## Releases

Semantic Versioning, with [CHANGELOG.md](CHANGELOG.md) in Keep a Changelog format. The maintainer publishes.

## Licence

By contributing you agree your contribution is licensed under the [MIT licence](LICENSE). The Off-Limits and Black Canyon Software names, logos and artwork are not part of that licence.
