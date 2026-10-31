# 0004. Ship guard and filter first, isolation later

- Status: accepted (owner, 2026-10-30)

## Context
The assessment shows two ways to protect a name. Guards and filters are quick to build and stop routine access. Isolation, where the entry is absent from the assistant's view, is the only layer that truly hides a name, but it takes longer and depends on the platform.

## Options considered
1. **Declare, guard and filter first; isolation as a later milestone.**
2. **Isolation first.**

## Decision
Option 1. Version 0.1.0 delivers the policy, notice, guard, filter, audit counts, the adversarial test command and the threat model. The `offlimits run` launcher with masked views follows in M6.

## Consequences
- A useful release arrives in weeks, and it already contains the code that proves what holds.
- Documentation states clearly that guard and filter reduce accidental exposure, and that isolation is the layer that enforces.
- The test command is built before isolation so that isolation can later be shown to close the gaps it reports.
