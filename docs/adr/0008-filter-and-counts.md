# 0008. The output filter and the audit counts

- Status: accepted (M3, 2026-11-12)

## Context

Names leak through what a tool prints back: directory listings, search results, error messages and logs, not only through deliberate reads (the Can-AI build found this first). The guard (ADR 0007) stops a call before it runs; the filter covers what comes out. The roadmap also asks for counts of what was refused or hidden, without ever recording a name (US-011).

## Decision

**The filter** is a separate command, `offlimits-filter`, used as `some-command | offlimits-filter`.

1. **Line by line.** A line that touches anything on the policy is hidden. Each run of consecutive hidden lines is replaced by one marker, `[offlimits:filtered] N lines hidden` (`1 line hidden` in the singular). Every other line passes through byte for byte, including a missing final newline and `\r\n` endings. The marker names no entry (ADR 0003).
2. **Streaming.** It keeps only the unfinished line in memory, so output of any size works, and lines can arrive in any pieces; a name split across two pieces is still found.
3. **A line too long to keep is hidden whole.** Over 1 MiB, a line cannot be checked without holding all of it, so it is hidden rather than passed. Memory stays bounded.
4. **Binary and UTF-16 text.** A NUL character is dropped before matching, so text a tool writes as UTF-16 (a NUL after each letter) reads as the text it is. Input is read as UTF-8, so truly binary data is not preserved byte for byte: the filter is for text.
5. **Fail closed.** If the policy is missing or invalid, or anything fails (the test throws, the input breaks, a write fails), the filter writes nothing more, prints the standard signal on standard error and exits 2. It never falls back to passing text through. Lines already written were each checked.
6. **Entries.** Every entry applies unless `--assistant <name>` is given, in which case entries meant for other assistants do not. Both `hide` and `forbid` entries hide lines.
7. **No link lookups.** Output lines are names and paths already shown, and a file-system lookup for every word of a long listing would be slow. Paths are compared as written, resolved against the working directory.
8. **`regex` entries are limited per line**, 50 ms each, not in total (a stream has no natural total). A line whose test cannot finish is hidden. A policy with regex entries is therefore slower on large output, because each test runs in a separate V8 context.
9. **Built like the guard**: CommonJS, in `dist/guard-cjs/filter/main.js`, so it starts quickly in a pipeline. It is not protected by the guard's automatic protections, because it reveals nothing.

**The audit counts.**

1. The guard appends one line per refusal and the filter one line per run that hid anything, to `counts.log` beside the policy file. A line holds a date, a kind (`blocked`, `filtered` or `failed`) and a number, and nothing else. `failed` means the guard or filter refused because it could not make its check.
2. Appending a short line is one atomic write, so many guards running at once do not corrupt it. A failure to write is ignored: counting never changes a decision.
3. `offlimits count` adds the lines up. It shows numbers and a date, so it runs anywhere.
4. The counts file is one of the guard's automatic protections, so a session cannot read or edit it.

## Consequences

- A user has to put the filter in their pipeline. Like any wrapper, it covers only the commands run through it. The isolation layer (M6) does not have this limit.
- On this Windows machine the operating system will not start any process, even a bare Node, from a working directory over about 260 characters, whatever the program is. The filter test uses a long directory the system accepts, and long paths inside the input, and skips with a note if the system will not make one.
- The counts file grows by about 25 bytes per event and is never trimmed. A way to reset it is not part of this milestone.
