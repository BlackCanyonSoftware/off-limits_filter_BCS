# Releasing 0.1.0

Publishing is the owner's step. This page lists what is ready, what to check, and the steps in order. Run commands in PowerShell, in the folder `C:\Users\Kpier\Documents\off-limits_filter_BCS`.

## What is ready

- Version `0.1.0` in `package.json`, with `"private": true` still set so nothing is published by accident.
- `CHANGELOG.md` has a `0.1.0` entry.
- `offlimits test` holds for every group text matching is meant to cover (see `docs/THREAT-MODEL.md`).
- Names checked on 2026-11-12: `offlimits`, `off-limits`, `offlimits-cli` and `@blackcanyonsoftware/offlimits` are all unclaimed on npm. Domains and trademarks were not checked.

## Before publishing: check it yourself

1. Push the commits and wait for the CI run on `main` to finish. It must pass on Windows, macOS and Linux. The guard and filter tests run the built programs on all three.
2. Try the guard on a copy of your Claude Code settings first:
   1. Run `Copy-Item $env:USERPROFILE\.claude\settings.json $env:TEMP\settings-copy.json`
   2. Run `node dist\cli\main.js init`
   3. Run `node dist\cli\main.js add` and type a made-up name such as `project-nightingale`, then `y`
   4. Run `node dist\cli\main.js install --settings $env:TEMP\settings-copy.json` and answer `y`
   5. Open `$env:TEMP\settings-copy.json` and check the `Off-Limits` handler is there, next to your existing hooks.
3. Run `claude --version` and check it is 2.1.295 or later.
4. Install it for real (`node dist\cli\main.js install`), start a Claude Code session, and ask it to read something that matches your made-up name. It should be refused with `[offlimits:blocked]`. Then run `node dist\cli\main.js count`.
5. Run `node dist\cli\main.js test` and read the report.

## GitHub settings (once)

1. Open the repository on GitHub, and click the gear next to **About**.
2. Description: `Choose what your AI assistants can see and touch. One list, a guard, an output filter and a test that shows what holds.`
3. Topics: `ai-assistants`, `privacy`, `claude-code`, `guard`, `cli`, `typescript`. Click **Save changes**.
4. Open **Settings**, then **General**, then scroll to **Social preview** and click **Edit**, then **Upload an image**, and choose `C:\Users\Kpier\Documents\Brand Logos\dist\off-limits\social\og-light.png`.
5. Open **Settings**, then **Code security**, then find **Private vulnerability reporting** and click **Enable**. `SECURITY.md` points people there.

## Publishing to npm

1. Decide the package name. `offlimits` is free; the README and the guard's command names use it.
2. In `package.json`, delete the line `"private": true,`.
3. Run `npm run check:ci` and make sure everything passes.
4. Run `npm login`, and sign in (two-factor, if you use it).
5. Run `npm publish --dry-run` and read the list of files. It should hold `dist/`, `README.md`, `LICENSE` and `package.json`.
6. Run `npm publish`.
7. Run `git tag v0.1.0`, then `git push origin v0.1.0`, and create a GitHub release from that tag using the `0.1.0` section of `CHANGELOG.md`.

## Known limits to say in the release notes

- Text matching reduces accidental exposure. It does not run commands, so a name a command builds at run time is outside it. Isolation (planned) covers that.
- Verified on one Windows machine; CI covers the other platforms.
- The guard has not been run in a live Claude Code session before this release; the steps above do that.
