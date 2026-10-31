# 0002. Policy format and location

- Status: accepted (owner, 2026-10-30)

## Context

One policy drives every layer. It lists the things the owner wants kept out of an assistant's view, so the file itself deserves care.

## Options considered

1. **YAML in the user config folder.** Readable and commentable. Outside any repository by default.
2. **JSON or TOML.** Simpler to parse; JSON has no comments, and TOML nests poorly for lists of entries.
3. **Committed in the repository.** Convenient for teams, but the file would hold the names themselves.

## Decision

- A single `policy.yaml` in the user config folder (`%APPDATA%\offlimits` on Windows, `$XDG_CONFIG_HOME/offlimits` or `~/.config/offlimits` elsewhere), created with owner-only permissions. `OFFLIMITS_POLICY` overrides the path.
- Each entry has a `kind`, a `mode` (`hide` or `forbid`), a `value`, an optional list of `assistants`, and an optional private `note`.
- The file is validated with a schema at load. An invalid or unreadable file means the guard and filter fail closed.
- A committed hashed list (the "blind list") is an opt-in, added in M7.

## Consequences

- Names never need to be committed to a repository.
- Teams that want a shared list use the blind list once it exists.
- The guard has one well-known file to protect.
