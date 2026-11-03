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

# Global instructions, settings, and status line
link "$repo/AGENTS.md" "$claude/AGENTS.md"
link "$repo/CLAUDE.md" "$claude/CLAUDE.md"
link "$repo/claude-code/settings.json" "$claude/settings.json"
link "$repo/claude-code/statusline.sh" "$claude/statusline.sh"

# Hook scripts and superpowers config, one link per file
for f in "$repo"/claude-code/hooks/* "$repo"/claude-code/superpowers/*; do
  link "$f" "$claude/${f#"$repo"/claude-code/}"
done

# Skills, one link per skill folder (leaves the app-managed skills/synced alone)
for d in "$repo"/skills/*/; do
  link "${d%/}" "$claude/skills/$(basename "$d")"
done

# Removes skill links whose folder was deleted from the repo
for l in "$claude"/skills/*; do
  if [[ -L "$l" && ! -e "$l" && "$(readlink "$l")" == "$repo"/* ]]; then
    rm "$l"
    echo "removed ~/.claude/skills/$(basename "$l")"
  fi
done

# Flags missing tools the synced config depends on
command -v jq >/dev/null || echo "warning: statusline.sh and block-env-edits.sh need jq (brew install jq / sudo apt install jq)"
command -v node >/dev/null || echo "warning: the status line (hooks/statusline.js) needs node"
exit 0
