# Isolation: running where hidden things are absent

The guard and the filter read text, so they can only reduce what an assistant reaches. Isolation is different: it runs a command in a view where the things on your list are not there at all, so no spelling, encoding or script can reach them. A hidden name is absent from listings, not shown as an empty folder.

```bash
node dist/cli/main.js run -- bash
```

Everything after `--` is the command, here an interactive shell. Run your assistant the same way, for example `node dist/cli/main.js run -- claude`.

## What it does

1. Reads your policy and finds everything under the current folder that an entry matches (names, paths, globs).
2. Rebuilds the folder as an empty view and mounts every other file and folder back into it, writable, so your project still works.
3. Leaves out any link that points at something hidden, because a link's target would show the name to anyone who reads it.
4. Masks paths outside the folder that your `path` entries name, in place. Their names stay visible in the parent folder's listing, but they are empty.
5. Removes the environment variables named by `env` entries.
6. Prints only a count of what is hidden, never which. Use `--dry-run` at a terminal to see the plan.

Hosts, commands, conversations and regular expressions cannot be hidden this way, and the command says how many entries that was.

## Choosing a backend

`run` uses the first backend that works on your machine, or the one you name with `--backend`.

| Backend    | Where                       | What to install               | Notes                                                                                   |
| ---------- | --------------------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| bubblewrap | Linux, and Linux inside WSL | `sudo apt install bubblewrap` | Fast, no image. Needs user namespaces, which some systems forbid; `run` checks it works |
| Docker     | Anywhere Docker runs        | Docker                        | Runs in an image (`--image`, default `ubuntu:24.04`) that must hold the tools you need  |

Check what will happen without running anything:

```bash
node dist/cli/main.js run --dry-run -- true
```

### Dev containers

A dev container can use the same view. Run the Docker plan with `--dry-run`, and copy the `-v` mounts it prints into the `mounts` of your `devcontainer.json`. Mount only those, and nothing from the hidden list is mounted at all.

### Windows

Windows has neither tool natively. There are two routes, and neither has been run on a real machine by the author yet (see "What has not been verified").

**Inside WSL.** Install Ubuntu in WSL, then in an Ubuntu shell:

1. `sudo apt install bubblewrap nodejs`
2. Go to your project, for example `cd /mnt/c/Users/Kyle/Documents/my-project`
3. Run `node /path/to/off-limits_filter_BCS/dist/cli/main.js run --dry-run -- true`

Keep your policy where WSL can read it, by setting `OFFLIMITS_POLICY` to a file path inside WSL.

**A separate Windows user.** Windows can deny a user access to a folder. The assistant runs as that user, so it cannot read what you denied. Run these in an elevated PowerShell (Run as administrator):

1. `net user ai-agent <a password you choose> /add`
2. `icacls "C:\Clients\client-alpha" /deny "ai-agent:(OI)(CI)F"`
3. Start the assistant as that user, for example `runas /user:ai-agent "cmd /k"`.

The folder's name is still visible in its parent folder's listing, because the parent grants that user list access. Denying list access on the parent hides the name too, but also everything else in it. Use made-up names to try this first.

## What it covers, and what it does not

- **Covers:** everything in the group "known not covered by text matching" in `offlimits test`: a name built or chosen by a command, a look-alike letter, a script that holds the name. There is nothing to read, so none of them reaches it. It also covers every other spelling, because the name is not there.
- **Does not cover:** hosts and network access, commands, conversations, and anything outside the folder you did not name with a `path` entry. Paths outside the folder stay visible by name. Anything the assistant already learned stays learned.
- **Links:** a link that points at something hidden is left out. Other links are recreated as they were.
- **Speed:** the plan is made by listing folders, up to 50,000 items. A larger folder is refused, with a message, rather than half checked.

## What has been verified, and what has not

The planner, the command builders and the `run` command are tested with fake file systems and fake tools, including a check that no hidden name appears in the arguments.

**Docker: seen working for real (2026-11-18).** `tests/integration/isolation-docker.test.ts` runs real Docker on a Linux engine (Docker Desktop on the Windows development machine, image `alpine:3.20`). It checks that listings lack the hidden name, that reads fail however the path is written, that ordinary work and writes still run, and that a protected variable is not passed on. A control in the same file runs the same read with the whole folder mounted and must show the notes, so a pass cannot be a mount that silently failed. The first real run found that Docker rejected a Windows path written with backslashes; the command builder now converts it. The tests skip when Docker is missing or is in Windows-container mode, and a skip is not a pass.

**Bubblewrap: seen working for real (2026-11-18).** `tests/integration/isolation-runtime.test.ts` runs real bubblewrap 0.9.0 in WSL2 Ubuntu, with the same four checks and the same kind of control. It runs only on Linux where a working bubblewrap exists, so it skips on Windows and macOS.

**What that does not show.** Both runs were on one machine. The bubblewrap run was inside WSL2, not on a native Linux host, and neither has run in CI yet. Some systems forbid the user namespaces bubblewrap needs, and `run` says so rather than starting. To repeat the bubblewrap run yourself in WSL:

1. In an Ubuntu (WSL) shell, run `sudo apt install bubblewrap git`, and install Node 26 or newer
2. Clone the project, then run `npm ci` and `npm run build`
3. Run `npx vitest run tests/integration/isolation-runtime.test.ts` and check that nothing is skipped and everything passes.
