# Changelog

All notable user-visible changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **The guard.** `offlimits install` registers a check that runs before every Claude Code tool call, alongside any hooks you already have, and `offlimits uninstall` removes it. A call that mentions something on your list is refused with the standard message and exit code 2. Any failure refuses too. It also protects your policy file, Claude Code's settings files, its own program files and the commands that manage your list, automatically. Needs Claude Code 2.1.295 or later to refuse safely if it ever cannot run.
- `offlimits explain <text>` (from a terminal) shows which entries match some text, so you can understand a refusal.
- `offlimits snippet` prints a short notice for `AGENTS.md` or `CLAUDE.md` that tells an assistant what the boundary signal means.
- `regex` entries now run with a time limit. One that cannot finish refuses the call instead of hanging it.
- `npm run measure` times the guard's start-up against a bare Node start.

- `offlimits init` creates your policy file (owner-only on systems that support it) in your user config folder. `OFFLIMITS_POLICY` overrides the location.
- `offlimits add`, `list` and `remove` manage your entries. They run only when a person is typing at a terminal and otherwise refuse with the standard message.
- `add` shows how many files and folders in the current folder an entry would match, warns about short or common entries, and asks for confirmation.
- Eight kinds of entry: `name`, `path`, `glob`, `command`, `env`, `host`, `conversation` and `regex`, each with a `hide` or `forbid` mode and an optional list of assistants.
- `offlimits check <text>` reports whether text touches your list, with the standard boundary message and exit code 2 when it does. It ignores case, separators, `..`, `~`, relative spellings and links. A policy that cannot be used blocks.
- `offlimits --version` and `--help`.

### Changed

- The policy is now `policy.json` instead of `policy.yaml`, and the tool has no runtime dependencies. Loading the YAML and validation libraries added about 300 ms to every start. Run `offlimits init` and add your entries again if you used an earlier build.
