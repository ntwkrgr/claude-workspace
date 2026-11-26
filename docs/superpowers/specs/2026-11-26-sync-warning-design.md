# Out-of-sync warning for install.sh --pull

## Intent

A Mac's claude-workspace clone fell 9 commits behind GitHub without anyone noticing. An uncommitted edit to `claude-code/settings.json` made `git pull --ff-only` fail, and `install.sh --pull` discards pull errors. The user wants to hear about it whenever a machine gets out of step, so no machine is left behind again.

## Goals

- Warn the user at session start when this clone is behind GitHub, has unpushed commits, or has uncommitted changes.
- Deliver the warning through Claude: the SessionStart hook's stdout reaches Claude as context, and Claude leads its first reply with it. This works in the CLI, the desktop app, and over Remote Control.

## Non-goals

- Fixing the state automatically (stash, commit, push).
- macOS banners or any alert outside Claude.
- Changing what the pull does.

## Anti-goals

- A warning when everything is in sync.
- A failed session start: the check must never exit non-zero or block the hook.

## Constraints

- bash 3.2 compatible (macOS default).
- Runs only with `--pull`, so manual `./install.sh` runs stay quiet.
- Offline: `origin/main` may be stale, so the behind count can be low or zero. Unpushed and uncommitted are still correct.

## Approaches

1. **Check inside install.sh after the pull (chosen).** Same script, same hook entry, and it reuses the stdout-to-Claude path the jq/node warnings already use.
2. Separate hook script plus a second SessionStart entry. Rejected: one more file and settings entry for the same job.
3. macOS notification via `osascript`. Rejected by the user in favor of Claude telling them; Mac-only and needs notification permission.

## Design

After the pull block in `install.sh`, when `--pull` was given:

- `git rev-list --left-right --count HEAD...@{u}` gives unpushed (left) and behind (right) counts. If there's no upstream, skip the counts.
- `git status --porcelain` non-empty means uncommitted changes.
- `git symbolic-ref --short -q HEAD` gives the branch; anything other than `main` (or a detached HEAD) adds `on <branch>, not main` (`on detached HEAD, not main`).
- If any part applies, print one line:
  `warning: claude-workspace on this Mac is out of sync with GitHub (<parts>). Tell the user this at the start of your first reply, and that ~/Developer/claude-workspace needs a commit/push or pull.`
  `<parts>` lists only the non-zero items, for example `9 behind, uncommitted changes`.

README "Staying in sync" gets one sentence about the warning.

## Left to the builder

Exact wording of the line and the variable names.
