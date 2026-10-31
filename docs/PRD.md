# Off-Limits: Product Requirements

- Status: draft for owner approval
- Date: 2026-10-30
- Tier: MVP, plus the Production tier's threat model
- Basis: `Off-Limits_Feasibility_Assessment.md` (2026-10-30)

## 1. Problem and vision

AI assistants with access to a machine or a repository can read, search and list nearly everything the user can. People often have good reasons to keep some of it out of the assistant's view: client material under agreement, a private module, credentials, a conversation, a tool they are not ready to show, anything they would rather not send to a model vendor.

Each assistant offers its own partial answer: its own ignore file, its own semantics, usually files only, and usually hiding contents but not names. Nobody keeps one policy across assistants, and little of it can be tested.

**Vision:** Off-Limits is a free, open-source tool that gives you one clear, portable list of what your assistants may not see or touch in your own projects and on your own machines. It applies that list through several layers, tells every assistant in a standard way that a boundary exists and how to behave at it, and shows you with a built-in test what holds and what does not.

**Honest promise:** _Reduces accidental exposure, and, with an isolation layer, enforces it._ The tool says plainly what each layer does and does not cover. That candour is a feature.

## 2. Target users

| User                                     | Situation                                                     | Need                                                  |
| ---------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| Freelancer or small studio               | Runs an assistant in a folder that also holds client material | Keep named client folders out of the assistant's view |
| Developer with a private module          | Public repo plus a private part on the same disk              | One list that every assistant respects                |
| Security, legal or regulated-data worker | Assistant has a terminal on a machine with sensitive material | Evidence of what is blocked, and a way to test it     |
| Local-agent builder (e.g. Can-AI)        | Autonomous agent with a shell                                 | A guard and output filter it can embed                |

All of them are using data they already own or have legitimate access to, on their own machines.

## 3. Goals and scope boundaries

### Goals

- G1. One policy file drives every layer.
- G2. A standard, recognisable boundary signal (message and exit code) that any assistant can learn.
- G3. A guard and an output filter that stop routine access and keep names out of listings, search results and errors.
- G4. A test command that tries common workarounds against the user's own setup and reports what got through.
- G5. Clear documentation of what each layer covers, written for non-experts.
- G6. Useful to one person on day one; simple enough to adopt in minutes.

### Scope boundaries

- Off-Limits manages what an assistant may see and touch. It is not a secrets manager, a data-loss-prevention product or a compliance control.
- It controls what the assistant can read on the machine, not what a vendor does with data the assistant already received.
- It does not set out to become a vendor standard. The policy file is kept clean enough to propose later.

## 4. User stories

Priorities use MoSCoW. Milestone references are in `ROADMAP.md`.

| ID     | Story                                                                                                                                                                                   | Priority | Milestone |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------- |
| US-001 | As a user, I create a policy with one command so I can start using the tool in under a minute.                                                                                          | Must     | M1        |
| US-002 | As a user, I add an entry (path, glob, name, command, env, host, regex) with a mode of `hide` or `forbid`, from a terminal I am typing at.                                              | Must     | M1        |
| US-003 | As a user, I list and remove entries, from a terminal I am typing at.                                                                                                                   | Must     | M1        |
| US-004 | As a user, I want names matched however they are typed (case, spaces, `-`, `_`) so small spelling differences do not leave gaps.                                                        | Must     | M1        |
| US-005 | As a user, before adding an entry I see what it would match, with a warning for short or common names, so ordinary work is not blocked by accident.                                     | Must     | M1        |
| US-006 | As a user, I install the guard into Claude Code with one command, and it checks every tool call before it runs.                                                                         | Must     | M2        |
| US-007 | As a user, a blocked call returns a standard message and exit code that never names the entry, so the assistant learns a boundary exists without learning what is behind it.            | Must     | M2        |
| US-008 | As a user, the guard protects its own policy and settings so a session cannot switch it off.                                                                                            | Must     | M2        |
| US-009 | As a user, I generate a short snippet for `AGENTS.md` or `CLAUDE.md` that tells assistants how to behave at a boundary.                                                                 | Must     | M2        |
| US-010 | As a user, command output and listings pass through a filter that replaces matching lines with one marker line, and prints nothing if the filter itself fails.                          | Must     | M3        |
| US-011 | As a user, I see how many calls were blocked or filtered, never which names.                                                                                                            | Should   | M3        |
| US-012 | As a user, I run `offlimits test` and get a report of which common workarounds (wildcards, quoting, encoding, case, links, variable expansion, relative paths) got through in my setup. | Must     | M4        |
| US-013 | As a user, I read a plain-language threat model and per-layer coverage table.                                                                                                           | Must     | M4        |
| US-014 | As a user, one policy generates the ignore files other assistants read (`.cursorignore`, `.geminiignore`, `.aiignore`, `.agentsignore`), with a note on what each does not cover.       | Should   | M5        |
| US-015 | As a user, `offlimits scan` shows where my entries already appear (git history, docs, config, lockfiles) so I can tidy real exposure.                                                   | Should   | M5        |
| US-016 | As a user, I get type-ahead suggestions drawn from the project (folders, plugins, models, modes) so entries are spelled right.                                                          | Could    | M5        |
| US-017 | As a user, `offlimits run -- <command>` starts my assistant in a masked view where the entries are absent.                                                                              | Should   | M6        |
| US-018 | As a user, I can keep a hashed (blind) list in a repository instead of plain names.                                                                                                     | Could    | M7        |
| US-019 | As a user with two machines, the guard on one machine uses the list from the other, and keeps its last good copy when that machine is off.                                              | Could    | M7        |

### Acceptance criteria (Must stories)

**US-001** Given no policy exists, when I run `offlimits init`, then a policy file is created in the user config folder with owner-only permissions, and the command prints where it is.

**US-002** Given a terminal session, when I run `offlimits add <entry>`, then the entry is stored and I am shown a match preview first. Given no terminal (piped input, an assistant's shell), when I run the same command, then it refuses with the standard message and changes nothing.

**US-003** Given the same rules as US-002, `list` and `remove` work only from a terminal.

**US-004** Given an entry `Client Alpha`, when a tool call mentions `client_alpha`, `CLIENT-ALPHA` or `clientalpha`, then it matches.

**US-005** Given an entry shorter than four characters or on a common-words list, when I add it, then I see a warning and the count of matches in the current project, and I must confirm.

**US-006** Given the guard is installed, when Claude Code attempts a tool call whose input mentions an entry, then the call is refused before it runs.

**US-007** Given a refusal, then the message is exactly the standard message, the exit code is the documented blocked code, and neither names the entry or the rule that matched.

**US-008** Given a tool call that reads or edits the policy file, the guard's settings or the guard's own program files, then it is refused under the same rules.

**US-009** Given `offlimits snippet`, then the output is a short text block that tells an assistant to stop at a boundary, not look for another route, and tell the owner. It contains no entry names.

**US-010** Given command output with a matching line, then the line is replaced by a single marker line. Given a crash or malformed policy, then the filter prints nothing and exits with the blocked code.

**US-012** Given a policy and a sample entry, `offlimits test` reports pass or fail per workaround class and exits non-zero if any class got through. It uses made-up names unless told otherwise.

**US-013** Given the repository, `docs/THREAT-MODEL.md` and the README coverage table exist and agree with what `offlimits test` reports.

## 5. Non-functional requirements

| Area           | Requirement                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Fail closed    | A guard or filter that cannot read its policy refuses or prints nothing. It never passes through.                                             |
| Names stay out | Entry names never appear in logs, errors, test output, block messages, telemetry or committed docs and fixtures. All tests use made-up names. |
| Speed          | Guard decision under 100 ms on a typical machine, including start-up, for a policy of up to 500 entries.                                      |
| Platforms      | Windows, macOS and Linux for the core. Isolation recipes target Linux and WSL first.                                                          |
| Privacy        | No network calls, no telemetry. The tool works fully offline.                                                                                 |
| Dependencies   | Few and well maintained. Each one is justified in an ADR or the PR that adds it.                                                              |
| Accessibility  | CLI output readable without colour, and works with screen readers. Any web page follows WCAG 2.2 AA.                                          |
| Docs           | A new developer can clone the repo and ship a small change using only `README.md` and `AGENTS.md`.                                            |

## 6. Success measures

- The maintainer uses it daily with Can-AI and finds it faster than the old component.
- `offlimits test` ships with at least 8 workaround classes, each with a documented result per layer.
- A new user installs and blocks their first entry in under five minutes (timed on a fresh machine).
- A few people outside the project try it and report back. Adoption is unproven, and this is how to learn.

## 7. Assumptions

- A1. Claude Code's pre-tool hook can refuse a call and return a message to the assistant. To be verified against the installed version's documentation at the start of M2.
- A2. Node 22 LTS or newer is acceptable for users. Installation is by `npx` or `npm i -g`.
- A3. The policy lives in the user config folder by default (`%APPDATA%\offlimits` on Windows, `$XDG_CONFIG_HOME/offlimits` elsewhere), overridable by `OFFLIMITS_POLICY`.
- A4. The repository's existing MIT licence stays.
- A5. The name "Off-Limits" and the package name are available. To be checked before the first publish.

## 8. Risks

| Risk                                             | Mitigation                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| People read "off-limits" as "safe"               | Threat-model page, coverage table, and a test command that shows what holds |
| Assistants change their hook formats             | Core independent of adapters; adapters thin and versioned                   |
| Common words block normal work                   | Match preview and warnings before adding                                    |
| A session edits the guard's settings             | Guard protects its own files; isolation removes the problem                 |
| Scope creep into secrets management              | Scope boundaries above; roadmap review each milestone                       |
| Platform quirks on Windows (long paths, quoting) | Tests on Windows in CI from M0                                              |

## 9. Open questions

1. Package and domain names: confirm availability (A5).
2. Should the Claude Code hook ship as a separate tiny package for faster start-up, or as a sub-command of the main CLI? Decide with measurements in M2.
3. Which second assistant gets a full guard adapter after Claude Code? M5 starts with ignore-file generation only.

## 10. Glossary

| Term            | Meaning                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Entry           | One item on the policy: a path, glob, name, command, environment variable, host, conversation id or regex |
| Policy          | The file of entries and their modes                                                                       |
| Hide            | Mode where the entry should not appear in anything the assistant sees                                     |
| Forbid          | Mode where the assistant may know the thing exists but may not touch it                                   |
| Guard           | The pre-tool check that refuses a call before it runs                                                     |
| Filter          | The stream filter that replaces matching output lines with a marker                                       |
| Boundary signal | The standard message and exit code shown at a refusal                                                     |
| Isolation       | Running the assistant in a view where the entries are not mounted or not readable                         |
| Blind list      | A policy stored as keyed hashes of normalised tokens instead of names                                     |
| Layer           | One of notice, guard, filter, generated ignore files, isolation, audit and test, scan, type-ahead         |
