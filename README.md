<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/lockup/banner/lockup-horizontal-dark-banner.png">
    <img alt="Off-Limits" width="480" src="docs/brand/lockup/banner/lockup-horizontal-light-banner.png">
  </picture>
</p>

A free, open-source tool that lets you choose what your AI assistants can see and touch in your own projects and on your own machines.

You keep one clear list. Off-Limits applies it in layers, tells every assistant in a standard way that a boundary exists and how to behave at it, and includes a test that shows you what holds in your setup.

> **Status: early development (0.0.x).** You can keep a policy file and check text against it. The guard and filter that apply it to your assistant are next. See the [roadmap](docs/ROADMAP.md).

## What it does

| Layer                  | What it does                                                                                             | Status  |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| Notice                 | A standard message and exit code at a boundary, plus a snippet for `AGENTS.md` or `CLAUDE.md`            | Planned |
| Guard                  | Checks each tool call before it runs and refuses it if it mentions something on your list                | Planned |
| Filter                 | Replaces matching lines in command output, listings and logs with one marker line                        | Planned |
| Generated ignore files | Writes the ignore files other assistants read from your one list                                         | Planned |
| Isolation              | Starts your assistant in a view where the entries are not mounted or not readable                        | Planned |
| Test and scan          | `offlimits test` tries common workarounds against your setup. `offlimits scan` shows where names appear. | Planned |

**Honest promise:** Off-Limits reduces accidental exposure, and with the isolation layer it enforces your list. Each layer's coverage is documented, and the test command shows what holds on your machine.

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

`add`, `list` and `remove` run only when a person is typing at a terminal. Anywhere else (an assistant's shell, a pipe) they refuse with the same message and change nothing, because your list is private.

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
| `npm run check`        | Format check, lint, type check and tests, as CI runs them |

There is no browser interface yet, so there is no end-to-end test script.

## Environment variables

| Variable           | Meaning                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OFFLIMITS_POLICY` | Path of the policy file. Default: `%APPDATA%\offlimits\policy.yaml` on Windows, `$XDG_CONFIG_HOME/offlimits/policy.yaml` or `~/.config/offlimits/policy.yaml` elsewhere. |
| `OFFLIMITS_DEBUG`  | Set to `1` to print why a policy file was rejected. The reasons never include text from the file.                                                                        |

## Project structure

```
src/core/      pure logic: policy schema, matchers, boundary signal
src/platform/  the operating system: policy file, scanner, terminal
src/cli/       commands and the program entry point
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
