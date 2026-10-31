# Changelog

All notable user-visible changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `offlimits init` creates your policy file (owner-only on systems that support it) in your user config folder. `OFFLIMITS_POLICY` overrides the location.
- `offlimits add`, `list` and `remove` manage your entries. They run only when a person is typing at a terminal and otherwise refuse with the standard message.
- `add` shows how many files and folders in the current folder an entry would match, warns about short or common entries, and asks for confirmation.
- Eight kinds of entry: `name`, `path`, `glob`, `command`, `env`, `host`, `conversation` and `regex`, each with a `hide` or `forbid` mode and an optional list of assistants.
- `offlimits check <text>` reports whether text touches your list, with the standard boundary message and exit code 2 when it does. It ignores case, separators, `..`, `~`, relative spellings and links. A policy that cannot be used blocks.
- `offlimits --version` and `--help`.
