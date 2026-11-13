# 0011. The isolation launcher

- Status: accepted (M6, 2026-11-12)

## Context

The guard and filter read text (ADR 0007, ADR 0008), and `offlimits test` shows what that cannot reach: a name built by a command, a look-alike letter, the content of a script (ADR 0009). The only layer that closes those is one where the thing is not there. The assessment named it: a masked view, where "there is nothing to list".

## Decision

1. **A view built by allow-listing, not by blanking.** Mounting an empty directory over a hidden folder leaves its name in the parent's listing. So the planner rebuilds the parent as an empty filesystem and mounts back every sibling that is not hidden, recursing into any folder that holds something hidden deeper. The hidden name is simply absent. Folders with nothing hidden inside are mounted whole.
2. **What is hidden.** Everything under the working folder whose path an entry matches, using the same matcher as the guard, so spelling and case do not matter. A folder that matches is hidden whole and not walked into; links are not followed. An absolute `path` entry outside the folder is masked in place (an empty folder or file), because rebuilding its parent could mean rebuilding `/`. Its name stays visible, and the command and the guide say so.
3. **Links.** A link is recreated as a link, unless its target (as written, or joined to its folder) matches the policy, in which case it is left out and counted as hidden. This was found by a test: the first version recreated every link, and a link to a hidden folder would have carried the name into the view where `readlink` shows it.
4. **Environment variables.** `env` entries are removed from the command's environment (bubblewrap `--unsetenv`; Docker does not pass the host environment on).
5. **Two backends.** bubblewrap on Linux and inside WSL, and Docker. The command builders are pure functions of the plan. A backend counts as available only if it runs: bubblewrap must run a trivial command, because many systems have it but forbid the user namespaces it needs, and Docker must answer `docker info`. Probes run with no window.
6. **The working folder is writable.** The system is mounted read-only, and the rebuilt folder's contents are mounted read-write, so a project still works. A folder with nothing hidden is mounted whole, writable.
7. **Refusals.** It will not rebuild the top of a drive or the file system, a folder too large to check (over 50,000 items), or run when no backend works. Each says why. Output about what is hidden is a count only; `--dry-run` shows the plan and runs only at a terminal.
8. **Windows.** No native backend. The guide documents WSL and a separate-user-with-an-ACL recipe, written for the owner to run, because setting access rules from this tool would mean shelling out to system tools with windows and rights.

## Consequences

- Isolation closes the groups text matching documents as outside its reach, by construction, and is the layer the threat model calls enforcing. "By construction" is a design claim, not a measurement: the runtime tests need a working bubblewrap and were skipped on the development machine, so isolation has not been seen working. The guide gives the steps to run them in WSL.
- Docker runs in an image, so the owner's tools must be in it. This is the main reason bubblewrap is the first choice where it works.
- Hosts, commands, conversations and regular expressions cannot be hidden by mounts. The command counts them.
- Names of masked outside paths stay visible in their parent's listing.
- Anything a session has already seen stays seen, as with every other layer.
