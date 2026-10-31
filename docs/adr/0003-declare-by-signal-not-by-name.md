# 0003. Declare a boundary by signal, not by name

- Status: accepted (owner, 2026-10-30)

## Context

Two jobs pull against each other. The assistant should not learn the name of a hidden thing, and it should be told clearly that a boundary exists so that it stops instead of searching for another route. Declaring "X is off-limits" requires saying X.

## Options considered

1. **Name the entry in the refusal.** Clear for the assistant, but the refusal itself reveals the name.
2. **Silent failure.** Reveals nothing, but assistants then retry and try other routes.
3. **Standard signal.** One fixed message and one fixed exit code for every refusal, plus a standing instruction the owner places in `AGENTS.md` or `CLAUDE.md`.

## Decision

Option 3. Every refusal prints `[offlimits:blocked] This touches something the owner has marked off-limits. Do not try another way. Tell the owner.` and exits with code 2. Filtered output uses one marker line, `[offlimits:filtered] N line(s) hidden`. Neither names the entry, the rule or the kind.

## Consequences

- Assistants that follow instructions learn how to behave at a boundary without learning what is behind it.
- Owners get a single recognisable signal across assistants.
- The signal is soft by itself. Layers that enforce (generated ignore files, isolation) are covered by later milestones and described honestly in the threat model.
