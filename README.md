# claude-workspace

My Claude Code setup, shared across machines. `~/.claude` symlinks into this repo, so editing a skill or setting on any machine edits the repo.

## New machine

```bash
git clone https://github.com/ntwkrgr/claude-workspace.git ~/Developer/claude-workspace
~/Developer/claude-workspace/install.sh
brew install jq node   # or: sudo apt install jq nodejs — jq for the .env guard, node for the status line
```

Then start Claude Code once. Plugins listed in `settings.json` install from their marketplaces.

## Staying in sync

A SessionStart hook runs `install.sh --pull` each session: it fast-forwards this repo and links any new skills. It does nothing if you have local changes or the branches diverge, so commit and push changes from wherever you make them.

Anything `install.sh` replaces goes to `~/.claude/backup-<timestamp>/`.

## What's linked

| Repo path | Linked at |
|-----------|-----------|
| `AGENTS.md` | `~/.claude/AGENTS.md` (global instructions) |
| `CLAUDE.md` | `~/.claude/CLAUDE.md` (imports `AGENTS.md`) |
| `claude-code/settings.json` | `~/.claude/settings.json` (plugins, hooks, preferences) |
| `claude-code/statusline.sh` | `~/.claude/statusline.sh` |
| `claude-code/hooks/*` | `~/.claude/hooks/*` (includes `statusline.js`, the status line) |
| `claude-code/superpowers/*` | `~/.claude/superpowers/*` |
| `skills/<name>` | `~/.claude/skills/<name>` |

Not synced: account-synced skills (`~/.claude/skills/synced/`, delivered by the Claude app), `settings.local.json` (per-machine overrides), plugin install state, and MCP servers in `~/.claude.json`.
