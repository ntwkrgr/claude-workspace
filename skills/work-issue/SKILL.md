---
name: work-issue
description: Pick up a GitHub issue and carry it to a pull request — finds the issue's superpowers plan (saved locally by /plan-issue, posted on the issue, or written fresh with /plan-issue), creates an issue branch in an isolated worktree, executes the plan with superpowers-extended-cc:subagent-driven-development, and finishes with a PR that closes the issue. Use whenever the user runs /work-issue, or says things like "work on issue 42", "pick up issue 17", "implement issue 8", "fix issue 23", "start on that issue", or pastes a GitHub issue URL and asks to build it.
argument-hint: "<issue number or URL>"
---

# /work-issue

Take a GitHub issue from "filed" to "PR open": find or write its plan, set up a branch, execute the plan with superpowers, and open a PR that closes the issue.

The user's input: `$ARGUMENTS`

This is the companion to `/plan-issue`, which pushes plans to the base branch (or opens a PR from a `plan-issue-*` branch when the base is protected) at `docs/superpowers/plans/<date>-issue-<N>-<slug>.md` and posts them as an issue comment beginning `_Implementation plan (superpowers writing-plans)`. Execution is handed to the **superpowers-extended-cc** skills so the user gets the same review loop, model routing, and resume behavior as the rest of their workflow — don't implement tasks yourself.

The user can stop at any gate. When they decline, stop cleanly and leave everything already done (plan files, branch, commits) in place.

## Step 0: Preflight

1. Parse the issue number from `$ARGUMENTS` (`42`, `#42`, or a full issue URL). If there's nothing to parse, ask which issue.
2. Confirm the repo and read the issue:
   ```bash
   gh repo view --json nameWithOwner,defaultBranchRef -q '.nameWithOwner + " " + .defaultBranchRef.name'
   gh issue view <N> --json number,title,body,state,labels,url,comments
   ```
   If either fails, report the error and stop.
3. If the issue is **closed**, ask whether to continue anyway before going further.
4. Check for work already in flight, so you resume rather than duplicate:
   ```bash
   git branch --list "issue-<N>-*"; git worktree list
   gh pr list --state open --search "<N> in:body" --json number,title,headRefName,url
   ```
   If a branch, worktree, or open PR for this issue exists, tell the user what you found and ask: **Resume it** / **Start fresh** / **Cancel**. Resuming means using that branch/worktree; subagent-driven-development's ledger will pick up where it left off. An open PR from a `plan-issue-*` branch is a plan PR, not work in flight. Don't ask about it here; Step 1 uses it.

## Step 1: Find the plan

Run `git fetch origin <base>` first, so a stale checkout can't hide a plan. Then look in this order and use the first hit:

1. **Saved locally** — `ls docs/superpowers/plans/*-issue-<N>-*.md` (ignore `.tasks.json`). Use the `.md` and the `.tasks.json` beside it.
2. **On the base branch** — `git ls-tree -r --name-only origin/<base> docs/superpowers/plans | grep -- '-issue-<N>-'`. Read it with `git show origin/<base>:<path>`. The worktree in Step 3 will already contain it.
3. **In an open plan PR**: the `plan-issue-*` PR found in Step 0. Run `git fetch origin <head>`, then look in `origin/<head>` the same way as 2.
4. **Posted on the issue** — the newest comment whose body starts with `_Implementation plan (superpowers writing-plans)`. If it was split into `(part i/n)` comments, join the parts in order. Strip the first pointer line and the part markers, then save the rest to `docs/superpowers/plans/<today>-issue-<N>-<slug>.md`. There's no `.tasks.json` in this case; the execution skill rebuilds tasks from the plan text.
5. **No plan yet** — invoke the Skill tool with skill `plan-issue` and the issue number as `args`, and follow it. It saves the plan, posts it on the issue, and hands back here.

If the plan came from a file (1–3) and the issue has no plan comment, post it and tag the issue now, as in `/plan-issue` Step 3.

## Step 2: Confirm before starting

Gather what the user needs to decide: the task headings (`grep '^### Task' <plan>`), the plan's **Goal** line, any **Deferred decisions**, the base branch (the repo default from Step 0), and the branch name `issue-<N>-<short-slug>` (lowercase, hyphens, slug ≤ ~5 words from the issue title).

Put all of it **inside the AskUserQuestion prompt** — text written before a tool call can be collapsed in some interfaces, and the user can't approve what they can't see:

- `question`: "Start work on #<N>?" followed by a blank line and:
  ```
  Issue: #<N> <title>
  Plan: <plan path> (<source: saved locally | on <base> | in plan PR #<n> | from issue comment | new>)
  Goal: <goal line>
  Tasks:
    1. <task heading>
    2. ...
  Deferred decisions: <list, or "none">
  Branch: issue-<N>-<slug> from <base>, in an isolated worktree
  ```
- `options`: **Start** / **Re-plan** / **Cancel**. Give **Start** a `preview` with the same content.

- **Re-plan** → ask what should change, invoke `plan-issue` for #<N> with that guidance (it replaces the saved plan and posts the new one), and ask again.
- **Cancel** → stop. Any plan written in Step 1 stays saved and posted.

Choosing **Start** is the user's consent to create the worktree and branch, so don't ask about that again.

## Step 3: Set up the branch

1. Update the base: `git fetch origin <base>`.
2. Create the isolated workspace with `superpowers-extended-cc:using-git-worktrees`, branch `issue-<N>-<slug>` from `origin/<base>`. The user already consented in Step 2. If a native worktree tool is available, that skill will use it.
3. Bring the plan onto the branch, unless it's already on `origin/<base>`. A plan that `/plan-issue` couldn't push, or one rebuilt from an issue comment, is untracked in the original checkout, so a fresh worktree won't contain it. **Move** (not copy) the plan `.md` and its `.tasks.json` from the original checkout into the same `docs/superpowers/plans/` path in the worktree, then commit them:
   ```bash
   git add docs/superpowers/plans/<plan>.md docs/superpowers/plans/<plan>.md.tasks.json
   git commit -m "docs: add implementation plan for #<N>"
   ```
   Committing the plan means it travels with the PR for reviewers, and a later session can resume from the worktree.

   A plan from a plan PR isn't in the original checkout. Instead of moving it, run `git checkout origin/<head> -- <plan>.md <plan>.md.tasks.json` in the worktree and commit as above. The files then match the plan PR byte for byte, so the two can't conflict. Then close the plan PR and delete its branch: `gh pr close <PR> --delete-branch --comment "Plan committed on issue-<N>-<slug>; it will reach <base> with the work for #<N>."` If `gh pr diff <PR> --name-only` shows plans for other issues too, leave the PR open and say so.

## Step 4: Execute the plan

Invoke the Skill tool with `superpowers-extended-cc:subagent-driven-development`, passing the plan path inside the worktree, and follow it. It will find the worktree you just made and skip creating another, then run its per-task implement → review loop, with model routing from the user's config.

Two things to carry into it from this skill:
- The **Spec** is the GitHub issue — when the skill reads the spec, read the issue body (`gh issue view <N>`).
- When it reaches `superpowers-extended-cc:finishing-a-development-branch`, follow Step 5 below for the issue-specific parts.

## Step 5: Finish and link the issue

`finishing-a-development-branch` presents its options (merge locally / push and create PR / keep as-is); the choice stays the user's. Add the issue link to whichever they pick:

- **Push and create a PR** → title it after the issue (`<issue title> (#<N>)`, or match the repo's PR title convention if one is evident from `gh pr list --state merged --limit 10`). The body must start with `Closes #<N>` so GitHub links the PR and closes the issue on merge, then a short summary of what changed and a pointer to the committed plan file. Follow the repo's PR template if it has one. Report the PR URL.
- **Merge locally** → GitHub won't close the issue on its own. After the merge succeeds, ask whether to close it with a comment: `gh issue close <N> --comment "Fixed in <short-sha> on <base>."`
- **Keep as-is** → leave the issue alone and report the branch and worktree path so the user can come back with `/work-issue <N>` (Step 0 will offer to resume).

Then stop.
