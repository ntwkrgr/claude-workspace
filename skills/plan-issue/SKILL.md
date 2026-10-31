---
name: plan-issue
description: Write a superpowers implementation plan for one or more GitHub issues, post it on each issue, and commit and push it to the repo. Use whenever the user runs /plan-issue, or asks to "plan issue 42", "write a plan for issue 17", "plan these issues", or wants an implementation plan for an existing issue before working on it. /new-issue hands off here after filing an issue.
argument-hint: "[issue number(s) or URL(s)]"
---

# /plan-issue

Write an implementation plan for one or more GitHub issues, save it in the repo, post it on the issue, tag the issue `planned`, commit and push the plan, then offer to start `/work-issue`.

The user's input: `$ARGUMENTS`

Planning uses the **superpowers-extended-cc** plugin's `writing-plans` skill, so the plan comes out in the format `/work-issue` and `/subagent-driven-development` consume (task blocks with acceptance criteria, verify commands, and `modelTier` metadata for model routing). The plan is pushed to the repo *and* posted to the issue — the saved copy is what makes it executable later.

The user can stop at any gate. When they decline, stop cleanly — whatever was already saved or posted stays as-is.

**When `/work-issue` calls this** (its issue has no plan, or the user chose **Re-plan**): plan just that issue, skip the Step 1 question — the user already chose — still ask the Step 2 effort question, pass any re-plan notes as the planner's "Guidance" line, and skip Step 5, handing the plan path back to `/work-issue`.

## Step 0: Pick the issues

1. Confirm the repo: `gh repo view --json nameWithOwner,url -q '.nameWithOwner'`. If it fails (not a git repo, no GitHub remote, or `gh` not authenticated), report what failed and stop.
2. Parse issue numbers from `$ARGUMENTS` — `42`, `#42`, or issue URLs, several allowed (`12 15 #19`).
3. If there are none, list open issues:
   ```bash
   gh issue list --state open --limit 4 --json number,title
   ```
   Ask with AskUserQuestion, `multiSelect: true`: "Which issue(s) should I plan?" — one option per issue (newest first), labeled `#<N> <title>` (title shortened to fit). The user can type other numbers via "Other". If there are no open issues, say so and stop.

## Step 1: Check each issue

```bash
gh issue view <N> --json number,title,body,state,url,comments
ls docs/superpowers/plans/*-issue-<N>-*.md 2>/dev/null
base=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
git fetch origin "$base"
git ls-tree -r --name-only "origin/$base" docs/superpowers/plans | grep -- "-issue-<N>-"
```

- If `gh issue view` fails, report the error and drop that issue.
- If a plan file exists (locally or on `origin/<base>`) but the issue has no plan comment, say so in the question below, and on **Skip**, post that file (Step 3).
- If the issue is **closed**, or **already has a plan** (a local plan file, a file on `origin/<base>`, or a comment starting `_Implementation plan (superpowers writing-plans)`), ask with AskUserQuestion, stating which in the question text: **Plan it** / **Skip**. Before re-planning, delete the old `docs/superpowers/plans/*-issue-<N>-*` files so `/work-issue` finds only the new plan. The old comment stays on the issue; the new plan posts below it.

## Step 2: Plan with superpowers on Opus subagents

If any issues are left to plan, ask once with AskUserQuestion, however many issues there are: "Which effort level should the planners use?" — **xhigh (Recommended)** / **high** / **medium**.

Spawn one planner per issue with the Agent tool — all in the same message, so they run in parallel — using exactly these settings:
- `subagent_type`: `"general-purpose"` (it needs the Skill tool and Write to save the plan files; the read-only `Plan` agent can't save them)
- `model`: `"opus"`
- `effort`: the level the user picked: `"xhigh"`, `"high"`, or `"medium"`

The subagent starts with no context, so give it everything it needs in the prompt. Include the "Original request" line only when this conversation has the user's own words behind the issue (e.g. you came here from `/new-issue`), and the "Guidance" line only when there are re-plan notes; otherwise leave them out.

```
Write an implementation plan for GitHub issue #<N> in <owner/repo> (<issue URL>).

Title: <title>
Body: <issue body, verbatim>
Original request from the user: <verbatim>
Guidance from the user: <re-plan notes>
Repo root: <absolute path of the working directory>

Invoke the Skill tool with `superpowers-extended-cc:writing-plans` and follow it, with these
adjustments because you're running as a subagent on behalf of a GitHub issue:
- The spec is the GitHub issue above. In the plan header, set **Spec:** to the issue URL.
- Save the plan as docs/superpowers/plans/<YYYY-MM-DD>-issue-<N>-<short-slug>.md, with the
  .tasks.json beside it, as the skill describes.
- You can't ask the user questions. Where the issue is ambiguous, make the most reasonable
  call and record it under "Deferred decisions" so a human can review it.
- Skip the skill's Execution Handoff entirely — don't call AskUserQuestion and don't start
  executing. The calling session handles what happens next.
- Only write the plan .md and .tasks.json. Don't modify source code and don't commit.
- This is planning only: investigate by reading files. Don't build, compile, run tests,
  prototype the code in a scratch copy, or launch or change simulators, emulators, or devices.
  Executing or verifying the plan happens later, in a separate run.

When done, reply with just: the plan .md path, the .tasks.json path, and a one-line summary.
```

If a planner fails, delete any `*-issue-<N>-*` plan files it left, report its error, and carry on with the rest.

## Step 3: Post each plan on its issue

This step always runs: every plan ends up as a comment on its issue, however it was written and wherever it's saved, and a plan isn't finished until it's posted. If posting fails, report it as unfinished.

Read the plan `.md` and post it as a comment, prefixed with one line pointing at the saved copy:

```
_Implementation plan (superpowers writing-plans) — saved at `<plan path>`._

<plan markdown>
```

Write the comment body to a temp file and use `--body-file` so the Markdown survives intact:

```bash
gh issue comment <N> --body-file <tmpfile>
```

GitHub rejects comments over 65,536 characters, and full plans with code can exceed that. If the body is too long, split it at task boundaries (`### Task` headings) into several comments, each starting with `(part i/n)`, and post them in order.

Once every part of the plan is posted, tag the issue `planned`, creating the label first if the repo doesn't have it:

```bash
gh label create "planned" --description "Implementation plan posted on the issue" 2>/dev/null || true
gh issue edit <N> --add-label "planned"
```

If a comment fails to post, don't add the label to that issue. If tagging fails, report it and carry on; the plan is already posted.

## Step 4: Commit and push each plan

Commit every plan file this run wrote, deleted, or posted that doesn't already match `origin/<base>`. Use a short-lived branch merged back into the base:

```bash
git pull --ff-only origin "$base"
git switch -c "plan-issue-<N>"
git add -A -- 'docs/superpowers/plans/*-issue-<N>-*'
git commit -m "docs: add implementation plan for #<N>"
git switch "$base"
git merge "plan-issue-<N>"
git push origin "$base"
git branch -d "plan-issue-<N>"
```

With several issues, name the branch after the first issue and repeat the `git add` and `git commit` lines once per issue. The quoted pathspec also stages a re-plan's deleted files and leaves everything else in the checkout alone.

First check that the checkout is on `<base>` with nothing staged (`git branch --show-current`, `git diff --cached --quiet`). If it isn't, leave the plan uncommitted and report why; `/work-issue` still carries an uncommitted plan onto its branch. If a command fails, report the commit as unfinished; the plan is already on the issue.

## Step 5: Report, then offer /work-issue

For each planned issue, report the comment URL(s), a one-line gist of the plan, the plan path, and whether it reached `<base>`.

If none were planned, stop here. Otherwise ask with AskUserQuestion:
- **One issue planned** → "Start /work-issue #<N> now?" — **Work it now** / **Not now**.
- **Several planned** → "Start /work-issue on one of these now?" — one option per planned issue (up to 3, labeled `#<N> <title>`) plus **Not now**.

On a pick, invoke the Skill tool with skill `work-issue` and the issue number as `args`, and follow it. On **Not now**, note they can run `/work-issue <N>` later, and stop.
