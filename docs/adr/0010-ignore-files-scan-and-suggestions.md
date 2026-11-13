# 0010. Ignore files, scan and name suggestions

- Status: accepted (M5, 2026-11-12)

## Context

Most AI coding assistants have their own ignore file, with their own name and slightly different rules, and none of them shares a list with the others. The owner already has one policy. M5 turns that policy into those files (US-014), shows where its entries already appear so they can be tidied (US-015), and makes typing an entry easier (US-016).

## Decision

**Ignore files** (`offlimits ignore-files [folder]`).

1. **Four files from one policy:** `.cursorignore`, `.geminiignore`, `.aiignore` and `.agentsignore`, in `.gitignore` syntax. They are all written the same way; only the tool named in the header differs.
2. **What can be written.** Names, paths and globs. A name becomes patterns that ignore capitals and the separators hyphen, underscore and space (and also match with none), matched anywhere in a file or folder name. An absolute path inside the folder becomes an anchored folder pattern; a relative path matches anywhere. A relative glob passes through. Paths and globs outside the folder, and entries that are not files (variables, hosts, commands, conversations, regular expressions), are left out, and the command says how many.
3. **What each file says about itself.** A header marks the file as generated (`# offlimits:generated`), says it hides matching files from the tool's listings, search and context, says commands the tool runs in a terminal may still reach them (the tools' own documentation says so, and the threat model records it as "reduces"), and warns that the file holds the owner's entries in plain text.
4. **Care with the owner's files.** The command runs only at a terminal, asks before writing, never replaces a file that does not carry the marker, and, if the folder is a git repository, offers to add the file names to `.git/info/exclude` so they stay out of what is shared.
5. **Checked against git.** A test writes the generated patterns into a real repository and uses `git check-ignore` to confirm the right files are hidden and others are not, so the syntax is verified by the tool that defines it.

**Scan** (`offlimits scan [folder]`).

1. Reads text files under the folder (not following links) and reports, for each file that mentions an entry, the file and the line numbers, or that its own name matches. It uses the same matcher as the guard and filter, so it finds the same spellings.
2. It leaves out `.git`, `node_modules`, `dist` and `coverage`, binary files (a NUL in the first 8 KB) and files over 1 MB, and stops after 5,000 files, saying so.
3. It also reads git history: every commit message line and every path ever committed, in all branches, and reports counts and the first few matching paths. It does not read file contents across history.
4. It shows locations, which are as sensitive as the entries, so it runs only at a terminal. It does not change anything, and it says plainly that history needs a rewrite to remove a name, which this tool does not do.
5. Speed measured on this repository (129 files, about 40,000 lines): 1 to 2 seconds, about 25 microseconds per line.

**Suggestions.** At the `add` prompt, Tab completes names of files and folders in the current folder and just inside its folders (up to 500, skipping `.git`, `node_modules`, `dist`, `coverage`). Nothing is read from the files.

## Consequences

- The same list now reaches the other assistants' ignore files, with the limits written in each file. These files reduce what the other tools show; the guard and isolation remain the layers that act on tool calls.
- Ignore files hold entries in plain text and live in the project folder, so the exclude offer and the header warning matter. The owner decides whether to commit them.
- A name pattern matches names, not contents. It covers a file called `client-alpha-notes.md`, not a file that merely mentions the name; `offlimits scan` is for finding those.
- Git history is not rewritten. If an entry appears in history, the owner has to decide whether to rewrite it with a tool built for that.
- The Tab completion has been exercised only through the code that builds the suggestions and the prompt's wiring; it has not been tried by a person at a real terminal.
