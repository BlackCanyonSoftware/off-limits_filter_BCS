# 0007. How the Claude Code guard works

- Status: accepted (M2, 2026-11-12)

## Context

Claude Code can run a command before every tool call (a `PreToolUse` hook). The command receives the call as JSON on standard input. This ADR records what the hook contract says, checked against Claude Code's documentation on 2026-11-12 (<https://code.claude.com/docs/en/hooks>), and what we decided because of it.

What the documentation says that shapes the design:

- Exit code **2** blocks the call, and standard error is what the assistant is shown. Exit 0 with no output means no decision, and the call goes on to the normal permission flow.
- **Any other outcome lets the call run:** another exit code (including 1, the usual failure code), a crash, a hook that cannot start (for example a missing file), invalid output, or a timeout. The documentation says so directly: a hook meant to enforce a policy must use exit 2, and "don't count on a stalled hook to act as a gate".
- The one exception is a handler setting **`onFailure: "block"`**, which makes any failure act like exit 2. It needs Claude Code **2.1.295 or later**.
- A handler can run in **exec form**: `command` is the executable and `args` the argument list, with no shell. That is safe for Windows paths with spaces.
- The matcher `*` matches every tool. MCP tools are named `mcp__<server>__<tool>`.
- Hooks from several settings files **merge**, and matching hooks run in parallel. A project's settings can set `disableAllHooks`, so a session that can write settings could switch hooks off.
- For file tools `tool_input.file_path` is absolute (backslashes on Windows). Bash and PowerShell calls carry `command`. Other tools carry their own fields, and the full list is not stable.
- The hook's input also carries `cwd`, the folder the assistant is working in.

## Decision

1. **Every failure is a refusal.** The guard exits 2 on unreadable or oversized input, input that is not a recognised tool call, a missing or invalid policy, a regular expression that runs out of time, an internal error, and a 3-second watchdog. It exits 0, printing nothing, only when it has read the call and found nothing on the policy. The refusal text and code are the standard signal (ADR 0003).
2. **Registration.** `offlimits install` adds one handler to `PreToolUse` in the user's Claude Code settings: matcher `*`, exec form (`command` is the Node executable, `args` is the guard's path), `timeout: 5`, `onFailure: "block"`, and `statusMessage: "Off-Limits"`. That message is the marker used to find the handler again, so `install` updates rather than duplicates and `uninstall` removes only ours. Other hooks and settings are left exactly as they were. The first change to an existing file keeps one copy of the original beside it (`settings.json.offlimits-backup`).
3. **What is checked.** The tool's name, and every string, key and number anywhere in its input, whatever the tool. This covers tools and MCP tools the code has never heard of, and it includes the content of a file being written.
4. **Where relative paths are resolved.** From the `cwd` in the hook's input, not the guard's own folder.
5. **Which entries apply.** Those with no `assistants` list, and those that name `claude-code`.
6. **Automatic protections**, applied whatever the policy says and refused in `forbid` mode: the policy file; Claude Code settings files (the user's, and each project's shared and local file for the folder in use); the guard's program files (everything in `dist/`); and the commands that read or change the list or the guard (`offlimits add`, `list`, `remove`, `explain`, `install`, `uninstall`). `explain` shows the owner which of these a text touches.
7. **Built as CommonJS.** The package is ES modules, but the guard is compiled separately as CommonJS into `dist/guard-cjs/`, reads standard input in one call, and has few imports. Measured on the development machine, in pairs against a bare Node start so machine drift cancels out (41 runs, median): the guard adds about **28 ms** (bare Node about 52 ms, the guard about 81 ms), inside the 30 ms budget of ADR 0006. The first ES module version added about 55 ms. Node's compile cache was tried and added time for modules this small, so it is not used. `npm run measure` repeats the measurement.

## Consequences

- The guarantee that a failed or timed-out guard refuses the call needs Claude Code 2.1.295 or later. On an older version, the guard still refuses on every failure it can catch itself, but a crash before it starts, a missing file or a stall would let the call run. `install` says so.
- A session cannot read the policy, switch the guard off by editing settings, or run the management commands, as far as string matching and paths can tell. A session that is given a real interactive terminal could still run them by hand, and `explain` and the others refuse only when no terminal is attached; the guard's refusal of the command text covers that case too.
- The guard blocks an assistant from editing Claude Code settings files while it is installed, including in unrelated projects. The owner edits those files directly, or runs `offlimits uninstall` first.
- The guard is a second build target with its own tsconfig. It duplicates the shared code in compiled form (a few files), which is the price of the start-up time.
- Untested against a live Claude Code session as of this ADR. The unit and process-level tests run the real built guard with real hook-shaped input; registration was checked against the documentation, not by a live install.
