---
name: agentsmd-audit
description: Audit a project's AGENTS.md or CLAUDE.md so it stays current, relevant, and lean, using Claude Code's best-practices guide. Use whenever the user runs /agentsmd-audit, or says things like "audit AGENTS.md", "clean up CLAUDE.md", "my AGENTS.md is too long", "is my CLAUDE.md stale", "trim the instructions file", or when Claude Code warns that an instruction file is over the recommended length.
argument-hint: "[path to a specific instruction file]"
---

# /agentsmd-audit

Audit the current repo's instruction file and propose changes one at a time. Nothing changes without the user's approval.

The user's argument: `$ARGUMENTS`

Every line loads on every task, so each must hold something Claude can't work out from the repo. "No changes" is a good outcome: never invent proposals to look useful.

## Step 1: Find the file and the guide

Audit the file at `$ARGUMENTS` if given. Otherwise audit the repo's `AGENTS.md` or `CLAUDE.md`, following symlinks and `@` imports to the real content. Note its line count.

Fetch both guides. They win over this skill if they disagree; if a fetch fails, say so and continue.
- https://code.claude.com/docs/en/best-practices
- https://code.claude.com/docs/en/memory

## Step 2: Check the file

Verify each claim against the repo and record the evidence.

- **Loading:** `AGENTS.md` is ignored when a `CLAUDE.md` or `CLAUDE.local.md` sits at or above the working directory without importing it.
- **Stale:** paths, commands, and scripts that no longer exist; repo changes since the file's last commit (`git log`).
- **Conflicts:** within the file, and against nested instruction files and `.claude/rules/`.
- **Missing:** test, typecheck, or lint commands the repo defines but the file omits. Add nothing else from this check.
- **Cut:** what Claude can derive (layouts, dependency lists, architecture), default behavior, and old-model workarounds (`IMPORTANT`, all caps, "think hard", "don't be lazy").
- **Move:** multi-step procedures to a skill, rules for one area to `.claude/rules/` with `paths:`, zero-exception rules to a hook or deny rule.
- **Sharpen:** rewrite vague lines so they can be verified, or cut them.
- **Size:** target under 200 lines. `@` imports don't reduce context, so never propose one as a trim.

Keep exact verification commands, misleading code, decisions not in the repo, and anything corrected twice.

## Step 3: Check it against the user's work

Skip this step when `$ARGUMENTS` names a file. Otherwise give a subagent the commands below. It returns patterns with short quotes, and ignores anything unrelated to how Claude should work.

```bash
# Last 20 sessions for this repo and its worktrees
main=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
slug=$(printf %s "$main" | sed 's#[/.]#-#g')
find ~/.claude/projects -maxdepth 2 -name '*.jsonl' \( -path "*/$slug/*" -o -path "*/$slug--claude-worktrees-*" \) -exec ls -t {} + | head -20

# Typed messages from one session
jq -r 'select(.type=="user" and (.isMeta|not) and (.isSidechain|not)) | .message.content
  | if type=="string" then . else (map(select(.type=="text").text) | join("\n")) end' <session.jsonl>

# Feedback notes across all projects
grep -rl 'type: feedback' ~/.claude/projects/*/memory
```

- **Add** a line when the same correction appears in 2+ sessions.
- **Remove** a line when the user repeatedly overrode it, or the work it governs is gone. Never remove one because it wasn't mentioned: a followed rule leaves no trace.

## Step 4: Consider the global file

Read `~/.claude/AGENTS.md` or `~/.claude/CLAUDE.md`, but don't audit it line by line. Propose a global change only when it's broadly helpful and one of these is true:

- The same feedback appears in 2+ different projects' notes.
- A global line is broken, or conflicts with the project file.

Propose at most 2 per run, after all project proposals. When in doubt, leave it out.

## Step 5: Propose one change at a time

Each card is one change. Split unrelated edits, even if they're small. Order them by impact: Loading, Stale, Conflicts, Missing, Add, Move, Cut, Sharpen, global.

Only propose edits to instruction files and move destinations. Other repo problems go in the final report.

Call AskUserQuestion once per card:

- `question`: "N of M: <change>", then the reason, the evidence, and the exact diff. For a move, include the new file's contents.
- `options`: **Approve** / **Deny**. Give **Approve** a `preview` with the diff.

On **Approve**, apply it immediately, using `update-config` for hooks and deny rules. On **Deny**, skip it. If the user answers with free text, revise the change and ask again. Re-read the file before the next card, and drop any card that no longer applies.

With nothing to propose, say the file looks healthy, give its line count, and stop.

## Step 6: Report

State lines before and after, and how many changes were approved and denied. Name each repo with uncommitted edits, since the skill never commits. A global file symlinked into a repo counts. List any other repo problems you noticed, one line each.
