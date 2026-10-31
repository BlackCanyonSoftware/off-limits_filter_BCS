# 0005. How each kind of entry is matched

- Status: accepted (M1, 2026-10-30)

## Context

An entry is matched against free text: a command line, a tool call, a listing. Each kind of thing (a path, a host, an environment variable) is written differently in that text, and a single "contains" test either misses real references or blocks ordinary work. The rules also have to give the same answer on Windows, macOS and Linux, and a refusal must never reveal which entry matched.

## Decision

The core matcher is pure. It receives the text, the entry and a small context (working directory, home folder, a link resolver, whether the file system is case-sensitive). Platform code supplies the context. Each kind has one rule:

| Kind           | Matches                                                                                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | The name anywhere in the text, ignoring case, space, `-` and `_` (`Client Alpha`, `client_alpha`, `clientalpha`).                                                                                                           |
| `path`         | An absolute (or `~`) path covers that folder and everything inside it. A relative path matches that run of folder names wherever it appears.                                                                                |
| `glob`         | `*`, `?` and `**` patterns. A pattern with no slash may match any one segment; one with a slash matches from any segment boundary; `~` or absolute is anchored. A pattern that matches a folder also covers what is inside. |
| `command`      | The command as whole words, however it is invoked: `/usr/bin/curl`, `CURL.EXE` and `curl` are the same. Fixed arguments must follow as whole words.                                                                         |
| `env`          | The variable name as a whole word, in any spelling: `$NAME`, `${NAME}`, `%NAME%`, `process.env.NAME`, or bare.                                                                                                              |
| `host`         | The host and anything under it (`api.example.com` for `example.com`), not look-alikes (`notexample.com`).                                                                                                                   |
| `conversation` | The id as written, ignoring case.                                                                                                                                                                                           |
| `regex`        | The expression, case-insensitive and Unicode-aware, against the raw text. An expression that cannot be compiled blocks.                                                                                                     |

Path rules in detail:

- Every piece of the text that could be a path is read as written (with `~` and the working directory applied, `.` and `..` resolved, both slashes treated alike) and compared. Quoted spans are also kept whole, so a path with spaces in it is one candidate.
- Case is folded only where the file system ignores it (Windows, macOS), so `Client-Alpha` and `client-alpha` are different folders on Linux, as they are on disk.
- Links are followed for the first 200 pieces of text (up to 1,024 characters each); every piece is still compared as written however long the text is. The lookups are shared by all entries in one decision.

Other decisions:

- **Entries are checked against the assistant they name.** An entry with no `assistants` applies to every assistant. With no assistant given, every entry applies.
- **A match on a `hide` entry wins over a match on a `forbid` entry.** The decision carries only the mode, never the entry.
- **Windows file permissions.** Node cannot set Windows access rules, and running `icacls` would open console windows and add a dependency on its output. The policy is written under the user's profile folder (`%APPDATA%`), which by default is readable only by that user, administrators and the system. POSIX systems get mode `0600` on the file and `0700` on its folder. The threat model (M4) states this plainly.
- **Validation never repeats the value.** Messages say what is wrong with a kind of value, not what the value was.
- **Preview.** `add` shows how many files and folders in the current folder an entry would catch, for the kinds that can be judged from names (`name`, `path`, `glob`, `regex`). The scan skips `.git` and `node_modules`, does not follow links, and stops at 20,000 items.

## Consequences

- One matcher serves `check` now and the guard and filter later.
- Known limits, tracked in `docs/ROADMAP.md`: variable expansion in text (`$HOME/...`), unquoted paths that contain spaces, and encoded text are not decoded here. Those are the adversarial classes `offlimits test` (M4) reports on. A `regex` entry has no time limit yet; the guard's own time budget (M2) covers it.
- Link following is best-effort within its budget, which is why the isolation layer (M6) remains the only enforcing one.
