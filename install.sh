#!/usr/bin/env bash
# Links this repo's Claude config into ~/.claude. Safe to re-run.
# The SessionStart hook in settings.json runs it with --pull on every session.
set -uo pipefail

repo="$(cd "$(dirname "$0")" && pwd -P)"
claude="$HOME/.claude"
backup="$claude/backup-$(date +%Y%m%d-%H%M%S)"

# Stops without changes if another clone that still exists owns ~/.claude
owner="$(readlink "$claude/settings.json")"
if [[ "$owner" == */claude-code/settings.json && "$owner" != "$repo/claude-code/settings.json" && -e "$owner" ]]; then
  echo "warning: ~/.claude is linked to ${owner%/claude-code/settings.json}, not $repo. Delete one clone, then re-run install.sh."
  exit 1
fi

# Fast-forwards to the remote; does nothing on local changes, divergence, or no network
if [[ "${1:-}" == "--pull" ]]; then
  git -C "$repo" -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=5 pull --ff-only -q >/dev/null 2>&1
fi

# Symlinks $2 to $1, first moving anything else already at $2 into the backup folder
link() {
  local src="$1" dest="$2"
  if [[ "$(readlink "$dest")" == "$src" ]]; then
    return
  fi
  if [[ -e "$dest" || -L "$dest" ]]; then
    mkdir -p "$(dirname "$backup/${dest#"$claude"/}")"
    mv "$dest" "$backup/${dest#"$claude"/}"
    echo "backed up ~/.claude/${dest#"$claude"/} to ${backup/#$HOME/~}"
  fi
  mkdir -p "$(dirname "$dest")"
  ln -s "$src" "$dest"
  echo "linked ~/.claude/${dest#"$claude"/}"
}

# Global instructions and settings
link "$repo/AGENTS.md" "$claude/AGENTS.md"
link "$repo/CLAUDE.md" "$claude/CLAUDE.md"
link "$repo/claude-code/settings.json" "$claude/settings.json"

# Hook scripts and superpowers config, one link per file
for f in "$repo"/claude-code/hooks/* "$repo"/claude-code/superpowers/*; do
  link "$f" "$claude/${f#"$repo"/claude-code/}"
done

# Skills, one link per skill folder (leaves the app-managed skills/synced alone)
for d in "$repo"/skills/*/; do
  link "${d%/}" "$claude/skills/$(basename "$d")"
done

# Removes links into this repo whose target was deleted from the repo
for l in "$claude"/* "$claude"/hooks/* "$claude"/superpowers/* "$claude"/skills/*; do
  if [[ -L "$l" && ! -e "$l" && "$(readlink "$l")" == "$repo"/* ]]; then
    rm "$l"
    echo "removed ~/.claude/${l#"$claude"/}"
  fi
done

# Flags missing tools the synced config depends on
command -v jq >/dev/null || echo "warning: hooks/block-env-edits.sh and hooks/statusline.sh need jq (brew install jq / sudo apt install jq)"
command -v node >/dev/null || echo "warning: the subagent status line (hooks/statusline.js) needs node"

# With --pull, prints one line if this clone is behind GitHub, has unpushed commits, or has uncommitted changes
if [[ "${1:-}" == "--pull" ]]; then
  # Reads unpushed (left) and behind (right) commit counts against the upstream; both fall back to 0 when there is no upstream
  counts="$(git -C "$repo" rev-list --left-right --count HEAD...@{u} 2>/dev/null || true)"
  read -r unpushed behind <<<"${counts:-0 0}"

  # Sets dirty to 1 when the working tree has any uncommitted or untracked changes
  dirty=""
  if [[ -n "$(git -C "$repo" status --porcelain)" ]]; then
    dirty=1
  fi

  # Builds a comma-separated list of only the non-zero parts, in the fixed order behind, unpushed, uncommitted
  parts=""
  if [[ "$behind" -gt 0 ]]; then
    parts="$behind behind"
  fi
  if [[ "$unpushed" -gt 0 ]]; then
    parts="${parts:+$parts, }$unpushed unpushed"
  fi
  if [[ -n "$dirty" ]]; then
    parts="${parts:+$parts, }uncommitted changes"
  fi

  # Prints the warning line for Claude to relay, only when at least one part is present
  if [[ -n "$parts" ]]; then
    echo "warning: claude-workspace on this Mac is out of sync with GitHub ($parts). Tell the user this at the start of your first reply, and that ~/Developer/claude-workspace needs a commit/push or pull."
  fi
fi
exit 0
