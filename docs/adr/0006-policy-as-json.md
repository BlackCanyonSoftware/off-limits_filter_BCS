# 0006. The policy is a JSON file, and the tool has no runtime dependencies

- Status: accepted (owner, 2026-10-30). Supersedes the file-format part of [ADR 0002](0002-policy-format-and-location.md).

## Context

The guard runs before every tool call an assistant makes, so its cost is paid hundreds of times a day. ADR 0002 chose a YAML policy file, and ADR 0001 chose `yaml` and `zod` to read and check it.

Measured on the development machine (Windows, Node 26, median of nine runs, M2 session):

| What                                      | Time               |
| ----------------------------------------- | ------------------ |
| A bare Node process (`node -e 0`)         | ~120 ms            |
| Loading `yaml`                            | +~100 ms           |
| Loading `zod`                             | +~210 ms           |
| The CLI with both libraries (`--version`) | ~460 ms            |
| The CLI with neither (`--version`)        | ~180 ms            |
| The tool's own matcher code               | no measurable cost |

The libraries, not the matcher, were the cost, and a guard that adds a third to a half second to every tool call would be switched off. The PRD's original target (100 ms including start-up) was also out of reach on this machine, because a bare Node process already takes longer than that.

## Options considered

1. **JSON with hand-written validation.** Node reads it with no library. The tool has no runtime dependencies.
2. **Keep YAML, give the guard a small parser for the exact shape the tool writes.** Hand-editing with comments still works, but a hand edit that uses other YAML features would make the guard refuse until fixed, and the parser is more code to trust.
3. **Keep YAML and `zod`, and bundle the guard into one file with esbuild.** Adds a build tool and a build step. It could cut file-loading time but could not be promised to reach the target.

## Decision

Option 1.

- The policy is `policy.json` in the same user config folder, written as indented JSON and replaced atomically. The location rules from ADR 0002 are unchanged.
- `yaml` and `zod` are removed. Validation is hand-written in `src/core/policy.ts`. Its messages never repeat a value from the file.
- A file larger than 1 MB, or with a byte order mark, or with unknown fields, is handled explicitly: a byte order mark is accepted, the rest fail closed.
- A comment cannot live in JSON, so an entry's private `note` field is the place for one.
- **Start-up budget.** The target is stated as overhead: the guard adds **no more than 30 ms** to a bare Node start (`node -e 0`) on the same machine, median of nine runs. The PRD and roadmap are updated to say so. The measured result is recorded in `docs/HANDOFF.md`.

## Consequences

- The tool has no runtime dependencies, which also shrinks what a security tool has to trust.
- Nothing was released, so there is nothing to migrate. A `policy.yaml` from an M1 build is ignored; run `offlimits init` and add entries again.
- Owners who liked commented YAML lose comments. The `note` field covers the common need.
- Both libraries can be reconsidered later if a feature needs them, but not on the guard's path.
