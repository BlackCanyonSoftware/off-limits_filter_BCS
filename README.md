<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/lockup/banner/lockup-horizontal-dark-banner.png">
    <img alt="Off-Limits" width="480" src="docs/brand/lockup/banner/lockup-horizontal-light-banner.png">
  </picture>
</p>

A free, open-source tool that lets you choose what your AI assistants can see and touch in your own projects and on your own machines.

You keep one clear list. Off-Limits applies it in layers, tells every assistant in a standard way that a boundary exists and how to behave at it, and includes a test that shows you what holds in your setup.

> **Status: 0.1.0, the first release.** You can keep a policy file, add a guard to Claude Code, filter command output, and run a test that shows what holds. Isolation and the other assistants' ignore files come later. See the [roadmap](docs/ROADMAP.md) and the [threat model](docs/THREAT-MODEL.md).

## What it does

| Layer                  | What it does                                                                                                       | Status     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------- |
| Notice                 | A standard message and exit code at a boundary, plus a snippet for `AGENTS.md` or `CLAUDE.md`                      | Built      |
| Guard                  | Checks each tool call before it runs and refuses it if it mentions something on your list                          | Built      |
| Filter                 | Replaces matching lines in command output, listings and logs with one marker line                                  | Built      |
| Generated ignore files | Writes the ignore files other assistants read from your one list                                                   | Planned    |
| Isolation              | Starts your assistant in a view where the entries are not mounted or not readable                                  | Planned    |
| Test and scan          | `offlimits test` tries common workarounds against your setup. `offlimits scan` (planned) shows where names appear. | Test built |

**Honest promise:** Off-Limits reduces accidental exposure, and with the isolation layer it enforces your list. Each layer's coverage is documented, and the test command shows what holds on your machine.

## What holds

`offlimits test` tries twelve groups of common workarounds against the real guard and filter, with made-up names in a temporary folder, and reports what held. Results from one run (full detail and the limits are in the [threat model](docs/THREAT-MODEL.md)):

| Group                                                       | Guard    | Filter   |
| ----------------------------------------------------------- | -------- | -------- |
| Spelling and case                                           | held 5/5 | held 5/5 |
| Paths written another way (`..`, `cd` then a relative path) | held 6/6 | held 6/6 |
| Windows path forms                                          | held 5/5 | -        |
| Through a link                                              | held 2/2 | -        |
| Quoting a shell removes                                     | held 4/4 | -        |
| Wildcards a shell expands                                   | held 4/4 | -        |
| Variables and assembled names                               | held 6/6 | -        |
| Text spelled with codes (base64, hex, escapes)              | held 6/6 | held 6/6 |
| Invisible characters                                        | held 3/3 | held 3/3 |
| Other tools, hosts and variables                            | held 7/7 | -        |
| Reaching the policy, the guard or its settings              | held 7/7 | -        |
| Very long and odd input                                     | held 2/2 | held 2/2 |

Text matching reduces accidental exposure. It does not run commands, so a name a command builds at run time, a look-alike letter from another alphabet, and the content of a script are outside what it can read. The test shows these separately, and isolation (planned) is the layer that covers them.

```bash
node dist/cli/main.js test
npm run demo
```

## Quick start

You need Node 22.13 or newer.

```bash
git clone https://github.com/BlackCanyonSoftware/off-limits_filter_BCS.git
cd off-limits_filter_BCS
npm ci
npm run build
node dist/cli/main.js --version
```

Create your policy, then add something to keep off-limits:

```bash
node dist/cli/main.js init
node dist/cli/main.js add
```

`add` asks what to keep off-limits. Typing the value at the prompt, rather than after the command, keeps it out of your shell history. It shows what the entry would match in your current folder, warns if it is short or a common word, and asks you to confirm. Then ask whether some text touches your list:

```bash
node dist/cli/main.js check cat Client_Alpha/notes.md
```

```
[offlimits:blocked] This touches something the owner has marked off-limits. Do not try another way. Tell the owner.
```

The exit code is `2` when blocked, `0` when allowed and `1` for a usage error.

An entry can be a `name` (the default), `path`, `glob`, `command`, `env`, `host`, `conversation` or `regex`, for example `add internal.example.com --kind host`. Names ignore case and the separators space, `-` and `_`. Run `offlimits --help` for all options.

### Add the guard to Claude Code

```bash
node dist/cli/main.js install
node dist/cli/main.js snippet
```

`install` adds a check that runs before every tool call Claude Code makes, next to any hooks you already have, and keeps a copy of your settings first. `snippet` prints a short notice to put in your `AGENTS.md` or `CLAUDE.md`. A call that touches something on your list is refused with the message above, and so is any call the guard cannot check. The guard needs Claude Code 2.1.295 or later to refuse safely if it ever cannot run. It adds about 28 ms to each call (`npm run measure`). Remove it with `uninstall`. If a refusal puzzles you, `explain <text>` shows which entry matched.

### Hide names in command output

```bash
ls | node dist/guard-cjs/filter/main.js
```

The filter (`offlimits-filter` once installed) replaces each run of lines that touch your list with one marker line, and passes everything else through unchanged. If it cannot read your policy, or anything goes wrong, it prints nothing more and exits with code 2. It covers the commands you pipe through it. `offlimits count` shows how many calls were refused and lines hidden, as numbers and a date only.

`add`, `list`, `remove`, `explain`, `install` and `uninstall` run only when a person is typing at a terminal. Anywhere else (an assistant's shell, a pipe) they refuse with the same message and change nothing, because your list is private.

## Scripts

| Command                | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Rebuilds on change                                        |
| `npm run build`        | Compiles `src/` to `dist/`                                |
| `npm test`             | Builds, then runs unit and integration tests              |
| `npm run lint`         | ESLint with strict type-aware rules                       |
| `npm run format`       | Formats every file with Prettier                          |
| `npm run format:check` | Checks formatting without changing files                  |
| `npm run typecheck`    | TypeScript strict type check (no output files)            |
| `npm run demo`         | A short narrated demonstration with made-up names         |
| `npm run measure`      | Times the guard's start-up against a bare Node start      |
| `npm run check`        | Format check, lint, type check and tests, as CI runs them |

There is no browser interface yet, so there is no end-to-end test script.

## Environment variables

| Variable           | Meaning                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OFFLIMITS_POLICY` | Path of the policy file. Default: `%APPDATA%\offlimits\policy.json` on Windows, `$XDG_CONFIG_HOME/offlimits/policy.json` or `~/.config/offlimits/policy.json` elsewhere. |
| `OFFLIMITS_DEBUG`  | Set to `1` to print why a policy file was rejected. The reasons never include text from the file.                                                                        |

## Project structure

```
src/core/      pure logic: policy schema, matchers, boundary signal
src/platform/  the operating system: policy file, scanner, terminal
src/cli/       commands and the program entry point
src/guard/     the Claude Code hook (built separately as CommonJS)
src/filter/    the output filter (built with the guard)
src/adapters/  Claude Code hook input and settings
tests/         unit/, integration/ and helpers/
docs/          PRD, architecture, design, roadmap, decisions, handoff
docs/brand/    generated brand banners (do not edit by hand)
```

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Design and brand](docs/DESIGN.md)
- [Roadmap](docs/ROADMAP.md)
- [Decision records](docs/adr/)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Licence

The code is [MIT](LICENSE). The Off-Limits and Black Canyon Software names, logos and artwork (including the files in `docs/brand/`) identify Black Canyon Software and its products and are not covered by that licence.
