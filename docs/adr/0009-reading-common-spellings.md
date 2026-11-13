# 0009. The matcher reads the common ways one thing is written

- Status: accepted (M4, 2026-11-12)

## Context

A guard that compares text with a list is easy to get past by writing the same thing differently: another case, quotes inside a name, a variable that holds half of it, a relative path after `cd`. The roadmap's M4 asks the project to say what holds and to show it with a test. A test that only lists failures is not useful, so the first job was to make the matcher read the ordinary ways a shell, a decoder or a person treats two spellings as one thing.

## Decision

1. **Views.** Besides the text as written, the matcher checks other readings of it, built only when the text shows signs of needing them: invisible characters and terminal colour codes removed; then every combination of codes decoded (`%63`, `\x63`, `c`, `\143`), variables filled in (`$VAR`, `${VAR}`, `%VAR%`, `$env:VAR`, from the environment and from assignments in the text itself, a few levels deep) and shell quoting removed; plus tokens that decode from base64 or hex when the result reads as text. The steps always run in that order (codes first, so removing a backslash does not eat the one in `\x63`; quoting last, so `"$d"-alpha` resolves), and every combination is tried because one step can mangle text another needs, such as quoting removal on a Windows path.
2. **Paths.** A `cd`, `pushd`, `chdir` or `Set-Location` in the text moves where later relative paths are read from, up to eight steps. Windows `\\?\` and `\\.\` prefixes are read as the path they name, and on Windows a name's trailing dots and spaces are dropped. A wildcard in a path counts when it could expand to the protected folder or something inside it.
3. **Names and wildcards.** A name entry also matches a wildcard that could expand to it, but only when the pattern has at least four fixed characters. `client-al*` counts; `*.md` and `cl*` do not, so ordinary commands are not caught.
4. **Normalising.** Invisible characters are dropped when names are compared, and full-width letters fold through Unicode compatibility.
5. **No evaluation.** Nothing is run and no file is read to build a view. A name a command builds at run time, a look-alike letter from another alphabet, and the content of a script are outside what text matching can read. They are part of `offlimits test`, shown separately and expected to get through, and they are what isolation (M6) is for.
6. **Bounded.** Each view is built only when needed; at most 10,000 tokens are tried for encodings and eight `cd` steps followed; link lookups stay capped as before.

## Consequences

- `offlimits test` can report real results, and it can tell when something gets through (the suite runs it against an empty policy).
- Every call now does a little more work. Measured against the previous commit under the same conditions, the guard's start-up overhead rose from about 31 ms to about 33 ms. The budget in ADR 0006 stands, with that noise in mind: results between 25 and 33 ms were seen on one machine depending on its load.
- False positives are possible where text really does mention an entry in a form the matcher now decodes. The wildcard threshold and the requirement that decoded tokens read as text keep this rare; the test suite holds a set of ordinary commands that must still be allowed.
- Anything a new workaround needs is a new view, added with a test on both sides: it must be caught, and ordinary work must not be.
