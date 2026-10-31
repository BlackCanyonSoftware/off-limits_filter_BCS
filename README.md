<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/lockup/banner/lockup-horizontal-dark-banner.png">
    <img alt="Off-Limits" width="480" src="docs/brand/lockup/banner/lockup-horizontal-light-banner.png">
  </picture>
</p>

A free, open-source tool that lets you choose what your AI assistants can see and touch in your own projects and on your own machines.

You keep one clear list. Off-Limits applies it in layers, tells every assistant in a standard way that a boundary exists and how to behave at it, and includes a test that shows you what holds in your setup.

> **Status: early development (0.0.x).** The foundation is in place and the first features are being built. See the [roadmap](docs/ROADMAP.md).

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

Try the skeleton `check` command (it will read your policy file from Milestone 1 onward):

```bash
node dist/cli/main.js check --entry client-alpha cat Client_Alpha/notes.md
```

```
[offlimits:blocked] This touches something the owner has marked off-limits. Do not try another way. Tell the owner.
```

The exit code is `2` when blocked, `0` when allowed and `1` for a usage error.

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

None are read yet. Planned: `OFFLIMITS_POLICY` (policy file path) and `OFFLIMITS_DEBUG` (debug log). See `docs/ARCHITECTURE.md`.

## Project structure

```
src/core/      pure logic: normaliser, matcher, boundary signal
src/cli/       command handling and the program entry point
tests/         unit/ and integration/
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
