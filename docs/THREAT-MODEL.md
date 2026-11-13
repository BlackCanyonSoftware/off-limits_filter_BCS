# Threat model

Status: **complete for 0.1.0.** The results below come from running `offlimits test` (US-012). Run it on your own machine to reproduce them; this page and that output are meant to agree, and a difference is a bug.

Off-Limits is an engineering safeguard. It helps you decide what your AI assistants can see and touch in your own projects and on your own machines. It is not a compliance control, a secrets manager or a data-loss-prevention product.

## What it protects

- **Your list** (the policy): the names, paths, hosts, commands and other entries you chose. The list is itself something to protect, because it is made of exactly what you do not want shown.
- **The things on it:** files, folders, environment variables, hosts, commands, conversations.
- **The guard itself:** its settings, its program files, the policy file and the counts file, so a session cannot switch it off or read them.

## What it is designed to do

Reduce accidental exposure, and, with isolation, enforce your list. These are different strengths, and each layer says which one it offers.

| Level of effort                | What you are protecting against                                              | What helps                                  |
| ------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------- |
| Accident or habit              | The assistant opens, searches or lists something by routine                  | Guard and filter                            |
| Curiosity                      | A capable agent works around a block to finish its task                      | Guard and notice help; isolation holds      |
| Content that tries to steer it | Text in a file, page or tool result that talks the agent into reading things | Isolation; guard and notice reduce the risk |
| What a vendor keeps            | What leaves the machine and is stored                                        | Out of scope. Only not sending it helps.    |

## Layers and coverage

"Strength" is **reduces** (stops routine access and sets behaviour) or **enforces** (the thing is not there to reach).

| Layer                               | Strength | Covers                                                                                          | Does not cover                                                                                                | State |
| ----------------------------------- | -------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----- |
| Notice (`snippet`, standard signal) | reduces  | Assistants that follow instructions learn a boundary exists and stop, without learning its name | Anything that does not read or follow the instruction                                                         | built |
| Guard (pre-tool check)              | reduces  | Tool calls whose input mentions an entry, in assistants that support a pre-tool hook            | Assistants without hooks; channels the hook never sees (below); things text matching does not read (below)    | built |
| Filter (output)                     | reduces  | Command output, listings and logs run through it                                                | Commands run without it                                                                                       | built |
| Generated ignore files              | reduces  | What other assistants' own ignore files hide from their listings and context                    | Terminals and tools each assistant does not route through its ignore file                                     | built |
| Isolation (`offlimits run`)         | enforces | Entries that are not mounted or not readable in the assistant's view                            | Anything the isolation recipe leaves mounted                                                                  | built |
| Policy file and settings protection | reduces  | Reads and edits of the policy, the counts, the guard's settings and its program files           | A session running with the owner's full rights in an unguarded channel                                        | built |
| Terminal-only commands              | reduces  | `add`, `list`, `remove`, `explain`, `install` and `uninstall` refuse unless a person is typing  | A session that has been given a real terminal (the guard also refuses these commands when it sees them typed) | built |

## What was tried, and what held

`offlimits test` tries each group of workarounds against the real built guard and filter, using made-up names (`client-alpha` and friends) in a temporary folder. It never reads your policy. Each cell is attempts held out of attempts made.

Run on 2026-11-12, Windows 10, Node 26, commit `5fabdcd`:

| Group                                          | Guard (before a call) | Filter (output) | What the attempts were                                                                                                   |
| ---------------------------------------------- | --------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Spelling and case                              | held 5/5              | held 5/5        | Capitals, separators left out or swapped, spaces, full-width letters                                                     |
| Paths written another way                      | held 6/6              | held 6/6        | Full paths, `..`, doubled separators, a relative path after `cd` or `pushd`, after two `cd` steps                        |
| Windows path forms                             | held 5/5              | -               | `\\?\` and `\\.\` prefixes, trailing dots and spaces, forward slashes in another case                                    |
| Through a link                                 | held 2/2              | -               | A link (junction on Windows) to the folder, read by a command and by a tool                                              |
| Quoting that a shell removes                   | held 4/4              | -               | Quotes or a backslash inside a name or a full path                                                                       |
| Wildcards a shell expands                      | held 4/4              | -               | `*`, `?` and `[a]` standing for part of a name                                                                           |
| Variables and assembled names                  | held 6/6              | -               | `$VAR`, `${VAR}`, `%VAR%`, a variable set earlier in the same command, a name built from two or three pieces             |
| Text spelled with codes                        | held 6/6              | held 6/6        | Base64, hexadecimal, percent codes, hex, unicode and octal escapes                                                       |
| Invisible characters                           | held 3/3              | held 3/3        | A zero-width space, a soft hyphen, terminal colour codes inside a name                                                   |
| Other tools, hosts and variables               | held 7/7              | -               | `Read`, `Grep`, `Glob`, `Write`, a web fetch of a protected host, a protected variable, a tool whose name holds the name |
| Reaching the policy, the guard or its settings | held 7/7              | -               | Reading or searching the policy and counts, editing the settings, `offlimits list`, `add` and `uninstall`                |
| Very long and odd input                        | held 2/2              | held 2/2        | The name after 2 MB of other text, after a NUL character                                                                 |

On Linux and macOS the same test runs in CI, and the groups that are specific to Windows report "not applicable". A system that will not create links reports that group as not applicable too, and does not count it as held.

A test that always said "held" would prove nothing, so the test suite also runs the same attempts against an empty policy and checks that all of them get through.

## What text matching does not cover

These four attempts are part of the test, shown separately, and are expected to get through (all four did on 2026-11-12). Isolation (M6) covers them, because there the thing is not there to reach.

| Attempt                                   | Why                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| A name built by a command                 | The guard reads text; it does not run commands, so it cannot see what a command prints |
| A name chosen by a command (`ls`, `head`) | Same reason                                                                            |
| A look-alike letter from another alphabet | Look-alike letters are not the same letter, and no list of them is complete            |
| A script file that holds the name         | The command names a script, and the script's content is not part of the call           |

## Isolation

`offlimits run` (ADR 0011) is the layer that enforces. It rebuilds the working folder with everything the policy hides left out, so a hidden name is absent from listings and nothing can reach it however it is written. By construction it closes the four attempts text matching cannot read: a name built by a command, a name chosen by a command, a look-alike letter, and a script that holds the name. It also removes `env` entries from the environment.

It does not hide hosts, commands, conversations or regular expressions. Paths outside the working folder that your entries name are masked in place, so their names stay visible in their parent's listing. A link that points at something hidden is left out of the view, because its target would show the name.

**Verified:** the planner and the command builders, with fake file systems, including that no hidden name appears in the arguments given to the tool. **Not verified:** real bubblewrap or Docker runs. The runtime tests exist and run only where a working bubblewrap exists; they were skipped on the development machine (Windows). Treat this layer as designed and unit-tested, not yet seen working.

## Where this applies and where it does not

- **Channels the guard and filter do not see.** Browsers, screenshots, IDE panels, files you attach by hand, and anything that reaches the assistant without passing through a tool call. Isolation is the layer that removes the thing itself.
- **Names that appear elsewhere.** Git history, build output, error messages, imports, manifests and other files that refer to something can show what it is called. `offlimits scan` shows where your entries already appear, in files and in git history.
- **Text matching has limits you can measure.** It reads the common ways one thing is written, listed above. It does not run anything, so what a command builds at run time is outside it. A wildcard counts only when it has enough fixed characters to name something (four), so `cl*` does not and `client-al*` does (ADR 0009).
- **Links.** The guard follows links for the first 200 pieces of text in a call (each up to 1,024 characters); every piece is also compared as written. The filter does not follow links.
- **Windows short names** (`CLIENT~1`) are not read.
- **Nothing is retroactive.** Anything an assistant saw before an entry existed stays in that session.
- **Vendor-side retention** is out of scope.

## Behaviour when something goes wrong

- **Fail closed.** A guard or filter that cannot read or understand its policy refuses, or prints nothing more. It never passes input through. A check that runs out of time refuses (US-021). Every internal failure in the guard ends as exit 2 (ADR 0007), and the filter does the same (ADR 0008).
- **Claude Code version.** A guard that fails to start, is missing or stalls refuses the call only on Claude Code 2.1.295 or later, which has the setting for it (ADR 0007). `offlimits install` says so. On an older version the guard still refuses on every failure it can catch itself.
- **Counts without names.** The guard and filter append a date, a kind and a number to a counts file for each refusal or run that hid lines, and nothing else (ADR 0008). The file is protected from sessions like the policy file.
- **No names in output.** Refusals, errors, validation messages, test output and logs never repeat an entry. The only exception is a terminal-only command run by the owner for the owner (`list`, `add`, `explain`).
- **One signal.** Every refusal is the same message and exit code, so the signal carries no information about what matched.

## The policy file

- It lives in your user config folder, outside any repository, and is written atomically.
- On Linux and macOS it is created with mode `0600` in a `0700` folder. CI checks this.
- **On Windows** Node cannot set access rules, and the tool does not shell out to do it. The file sits under your profile folder (`%APPDATA%`), which by default only you, administrators and the system can read. If you change those defaults, the file follows them. This is relied on, not measured: check the folder's access rules if it matters to you. See ADR 0005.
- A session running as you, with a tool that reads files, can read any file you can. That is why the guard protects the policy path, and why isolation is the stronger layer.

## Limits of the terminal-only rule

`add`, `list`, `remove`, `explain`, `install` and `uninstall` run only when both input and output are a terminal. A pipe, a redirected shell or a typical agent shell is not one. An assistant that has been given a real interactive terminal is. The guard therefore also refuses tool calls that run these commands from a session.

## What has not been verified

- The guard has not been run in a live Claude Code session, and `offlimits install` has not been run against a real settings file. The registration was checked against the documentation (ADR 0007).
- The test results above are from one Windows machine. The same test runs in CI on Windows, macOS and Linux once the project is pushed.
- The generated ignore files have been checked against git's own matching, not against each assistant's: how Cursor, Gemini CLI and others read them is their documentation's word, and they say commands run in a terminal may still reach the files.
- Isolation has not been run for real. `docs/ISOLATION.md` has the steps to run its tests in WSL.
