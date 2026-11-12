# Threat model

Status: **draft**, started in M2 and finished in M4. The coverage table says what each layer is designed to do and whether it exists yet. In M4 `offlimits test` fills in a "verified" column from real runs, and this page and that output must agree.

Off-Limits is an engineering safeguard. It helps you decide what your AI assistants can see and touch in your own projects and on your own machines. It is not a compliance control, a secrets manager or a data-loss-prevention product.

## What it protects

- **Your list** (the policy): the names, paths, hosts, commands and other entries you chose. The list is itself something to protect, because it is made of exactly what you do not want shown.
- **The things on it:** files, folders, environment variables, hosts, commands, conversations.
- **The guard itself:** its settings, its program files and the policy file, so a session cannot switch it off or read it.

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

| Layer                               | Strength | Covers                                                                                          | Does not cover                                                                                         | State  |
| ----------------------------------- | -------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------ |
| Notice (`snippet`, standard signal) | reduces  | Assistants that follow instructions learn a boundary exists and stop, without learning its name | Anything that does not read or follow the instruction                                                  | M2     |
| Guard (pre-tool check)              | reduces  | Tool calls whose input mentions an entry, in assistants that support a pre-tool hook            | Assistants without hooks; channels the hook never sees (below); text that no longer reads as the entry | M2     |
| Filter (output)                     | reduces  | Command output, listings and logs run through it                                                | Commands run without it                                                                                | M3     |
| Generated ignore files              | reduces  | What other assistants' own ignore files hide from their listings and context                    | Terminals and tools each assistant does not route through its ignore file                              | M5     |
| Isolation (`offlimits run`)         | enforces | Entries that are not mounted or not readable in the assistant's view                            | Anything the isolation recipe leaves mounted                                                           | M6     |
| Policy file and settings protection | reduces  | Reads and edits of the policy, the guard's settings and its program files by a session          | A session running with the owner's full rights in an unguarded channel                                 | M2     |
| Terminal-only commands              | reduces  | `add`, `list`, `remove` and `explain` refuse unless a person is typing at a terminal            | A session that has been given a real terminal                                                          | M1, M2 |

## Where this applies and where it does not

- **Channels the guard and filter do not see.** Browsers, screenshots, IDE panels, files you attach by hand, and anything that reaches the assistant without passing through a tool call. Isolation is the layer that removes the thing itself.
- **Names that appear elsewhere.** Git history, build output, error messages, imports, manifests and other files that refer to something can show what it is called. `offlimits scan` (M5) shows where your entries already appear.
- **Matching is text matching.** It is designed to read the many ways one thing is written (case, separators, `..`, `~`, relative paths, links within a budget). Text transformed into a different representation is outside what string matching reads; `offlimits test` (M4) reports which classes get through in your setup. Isolation is not affected by how something is written.
- **Nothing is retroactive.** Anything an assistant saw before an entry existed stays in that session.
- **Vendor-side retention** is out of scope.

## Behaviour when something goes wrong

- **Fail closed.** A guard or filter that cannot read or understand its policy refuses, or prints nothing. It never passes input through. A check that runs out of time refuses (US-021).
- **No names in output.** Refusals, errors, validation messages, test output and logs never repeat an entry. The only exception is a terminal-only command run by the owner for the owner (`list`, `add`, `explain`).
- **One signal.** Every refusal is the same message and exit code, so the signal carries no information about what matched.

## The policy file

- It lives in your user config folder, outside any repository, and is written atomically.
- On Linux and macOS it is created with mode `0600` in a `0700` folder. CI checks this.
- **On Windows** Node cannot set access rules, and the tool does not shell out to do it. The file sits under your profile folder (`%APPDATA%`), which by default only you, administrators and the system can read. If you change those defaults, the file follows them. See ADR 0005.
- A session running as you, with a tool that reads files, can read any file you can. That is why the guard protects the policy path, and why isolation is the stronger layer.

## Limits of the terminal-only rule

`add`, `list`, `remove` and `explain` run only when both input and output are a terminal. A pipe, a redirected shell or a typical agent shell is not one. An assistant that has been given a real interactive terminal is. The guard therefore also refuses tool calls that run these commands from a session.

## Open items for M4

- Fill the "verified" column from `offlimits test` runs, per layer and per workaround class.
- Document each isolation recipe's coverage and how to confirm it.
- State the Windows story with a measured check, not only the default.
