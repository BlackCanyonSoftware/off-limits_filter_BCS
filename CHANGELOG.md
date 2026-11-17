# Changelog

All notable user-visible changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **Node 26 or newer is now required** (the current LTS). The project, its tests and CI all run on Node 26; earlier versions are no longer tested.

### Added

- **Blind entries.** `offlimits add --blind <name>` stores only a keyed hash of a name (HMAC-SHA-256), so a policy can be shared without naming what it protects. The key is kept outside the policy in `blind.key` beside it, or in `OFFLIMITS_BLIND_KEY`, and the guard protects it. A blind entry matches whole words in every common spelling and in every reading the guard already does (quoting, codes, variables, base64), but not a name embedded in a longer word. A policy with blind entries carries a key check, and a missing, absent or wrong key makes the guard, filter and `check` refuse everything instead of silently allowing.
- **`offlimits sync [file]`** replaces your policy with one from a file path (or `OFFLIMITS_SYNC_SOURCE`) after checking it, and keeps your policy if the source is missing, unreadable or invalid. It names no entry and runs only at a terminal. The `offlimits test` report gains a group for blind entries.
- `offlimits run [--backend bubblewrap|docker] [--image <image>] [--dry-run] -- <command>` runs a command in a view where what your policy hides is absent, not shown as an empty folder, using bubblewrap (Linux, or inside WSL) or Docker. The rest of the folder stays mounted and writable; a link that points at something hidden is left out; paths outside the folder are masked in place; `env` entries are removed from the environment. It prints only a count of what is hidden. `docs/ISOLATION.md` has the recipes, including Windows (WSL, or a separate user with an access rule). The planner and builders are tested with fake file systems; the runtime tests need a working bubblewrap and are skipped elsewhere.
- `offlimits ignore-files` writes `.cursorignore`, `.geminiignore`, `.aiignore` and `.agentsignore` from your policy. Names become patterns that ignore capitals and separators; paths inside the folder and globs carry over; entries that are not file names are counted and said so. It asks before writing, never replaces a file it did not write, says in each file what it covers and does not, and offers to add the files to `.git/info/exclude`. Patterns are checked against `git check-ignore` in the tests.
- `offlimits scan [folder]` shows where your entries already appear: files and line numbers in the folder, and commit messages and file paths in git history. Locations only, at a terminal only.
- Tab completes names from the current folder at the `add` prompt.

## [0.1.0] - 2026-11-12

### Added

- **`offlimits test`** tries twelve groups of common workarounds (spelling and case, paths, Windows path forms, links, quoting, wildcards, variables, encodings, invisible characters, other tools, reaching the policy or the guard, and very long input) against the real guard and filter, using made-up names in a temporary folder. It never reads your policy, shows which attempts held, lists any that got through, shows four documented limits separately, and exits 1 if a covered group let something through. A run takes about 12 seconds.
- The guard and filter now read the common ways one thing is written: shell quoting, percent, hex, unicode and octal codes, base64 and hex tokens, variables (from the environment and set in the text itself, including a name built from pieces), zero-width characters and terminal colour codes, `cd` or `pushd` followed by a relative path, wildcards that could expand to a protected name, and Windows `\\?\` prefixes and trailing dots.
- `docs/THREAT-MODEL.md` is complete, with the measured results; `docs/RELEASING.md` lists the steps to publish; `npm run demo` runs a short narrated demonstration.
- **The output filter.** `some-command | offlimits-filter` hides lines that touch your list, replacing each run with one marker line (`[offlimits:filtered] 3 lines hidden`) and passing everything else through unchanged. It works on streams of any size, hides lines too long to check, reads UTF-16 text, and if it cannot read your policy or anything fails it prints nothing more and exits 2.
- `offlimits count` shows how many tool calls the guard refused, how many lines the filter hid, and how many refusals were because a check could not be made, since the first one. The counts hold dates and numbers only, never a name.
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
