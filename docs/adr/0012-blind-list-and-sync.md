# 0012. The blind list and sync

- Status: accepted (M7, 2026-11-12)

## Context

A policy lists exactly what the owner wants kept out of an assistant's view, so the file is itself sensitive (ADR 0002, ADR 0006). Two real needs follow. A team may want to share one policy without every file in a repository naming what it protects (US-018). And one person with two machines wants both to use the same list, with the guard keeping its last good copy when the other machine is off (US-019). Both change what is stored, so both need a decision first.

## Decision

**The blind list.**

1. **A new kind of entry, `blind`.** Its value is a keyed hash, not a name: HMAC-SHA-256, as 64 hex digits, of the name after the usual normalising (case, separators and invisible characters removed). The name itself is written nowhere. `offlimits add --blind <name>` makes one; it works for names only.
2. **The key lives outside the policy.** It is 32 random bytes as 64 hex digits, in `blind.key` beside the policy file (owner-only where modes apply), or in the `OFFLIMITS_BLIND_KEY` environment variable, which wins. The key is created only after the owner confirms `add`, never replaces an existing one, and is one of the guard's automatic protections: a session cannot read it. A policy shared without the key means nothing to whoever has it.
3. **Matching is by whole word.** The text is cut into words, and every run of up to four words joined by a hyphen, underscore or space is normalised and hashed and compared. `client-alpha`, `Client_Alpha`, `client alpha`, `ClientAlpha` and a path segment all match; `myclientalphafolder` does not, because the name is embedded in a longer word. That is the price of storing only a hash: it cannot be searched for inside other words. Names longer than four words cannot be blind. Words over 64 characters are skipped, so a base64 blob is not joined into a name. Every other view of the text (quoting removed, codes decoded, variables filled in, base64 decoded) is checked the same way, so a blind entry holds against the same workarounds a plain name does.
4. **A wrong key must never silently allow.** Found in testing: with a well-formed but wrong key, every blind entry matches nothing, so everything would be allowed with no warning. So a policy with blind entries carries a `keyCheck`, a hash of a fixed text under the key, and the guard, filter and `check` verify that the key reproduces it. A missing key, a missing key check, or a mismatch each refuse everything. A policy with no blind entries needs no key. The key check reveals nothing about the key or the names.
5. **No key means refuse, not allow.** In the matcher, a blind entry with no hasher counts as a match.
6. **What a blind entry cannot do.** It cannot make ignore-file patterns (there is no name to write) or be previewed by name later; `add` previews against the plain name before it is converted. Isolation works with it, because it hides what the matcher finds in paths. `list` shows only the start of the hash.
7. **Honest limits.** A blind list obscures; it does not encrypt. A short or common name can be guessed offline by someone who has both the policy and the key. Without the key, the hashes cannot be tested. Whoever holds the key can test guesses, so it should be kept like any other secret and installed by hand on each machine.

**Sync.**

1. `offlimits sync [file]` pulls a policy from a **file path**, such as a synced folder or a share, or from `OFFLIMITS_SYNC_SOURCE`. It never reads a network address: the tool works offline, and fetching a URL would break that.
2. **The last good copy is kept.** The source is read and checked first. If it is missing, unreadable, not JSON or not a valid policy, nothing changes and the command says "Your policy is unchanged". It also says "Already in step" when the two match.
3. It asks before replacing, shows only how many entries each side has, and names no entry. It runs only at a terminal, because it replaces the list. `sync` is one of the guard's protected commands.
4. After a sync it warns when the policy has blind entries and the key is missing here, or does not fit. The key is never synced: it is installed by hand, so sharing a policy does not share what it protects.
5. **Not built: unattended sync.** A scheduled task has no terminal, and letting `sync` run without one would let anything that can run commands replace the list with one it controls. That needs a decision about trust (a signed source, or a source the guard itself is not allowed to write), so it is left for the owner to decide and for a later milestone.

## Consequences

- A policy with `blind` entries cannot be read by someone without the key, and breaks safely, with a refusal, when the key is wrong or missing.
- The policy format gains a kind and an optional `keyCheck`. Policies without blind entries are unchanged.
- `offlimits test` has a group for blind entries (held 6/6 on both layers on 2026-11-12) and lists the embedded-in-a-longer-word case among the documented limits.
- Two machines keep in step by running `offlimits sync` by hand, or from a terminal-attached task of the owner's own, until unattended sync is decided.
