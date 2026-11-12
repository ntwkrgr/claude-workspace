---
name: triage
description: Triage a GitHub repo's open issues — reviews them and proposes labels, priorities, duplicates to close, stale issues to close or ping, and issues that need more info, plus which ones are ready to pick up next with /work-issue. Nothing changes on GitHub until the user approves the list. Use whenever the user runs /triage, or says things like "triage the issues", "clean up the backlog", "what's in the issue queue", "label these issues", "find duplicate issues", "close stale issues", or "what should I work on next" in a GitHub repo.
argument-hint: "[scope, e.g. unlabeled | bugs | older than 90 days | #12 #15]"
---

# /triage

Review open GitHub issues in the current repo, propose a numbered list of changes, and apply only what the user approves.

The user's scope: `$ARGUMENTS`

The point is a tidy, trustworthy backlog with minimal effort from the user. That means proposals have to be right more often than not: a wrong "duplicate" closes someone's real issue, and noisy label churn makes the user stop trusting the list. When in doubt, leave an issue alone — "no change" is a fine outcome for most issues.

## Step 0: Preflight and scope

```bash
gh repo view --json nameWithOwner -q .nameWithOwner
gh label list --limit 200 --json name,description
```

If `gh repo view` fails, report the error and stop.

Turn `$ARGUMENTS` into a fetch. With no scope, take all open issues, newest first, up to 100:

```bash
gh issue list --state open --limit 100 \
  --json number,title,body,labels,assignees,milestone,createdAt,updatedAt,comments,url
```

Narrow it with `--label`, `--search` (e.g. `no:label`, `updated:<2026-07-01`), or specific numbers via `gh issue view`, as the scope asks. If more than 100 issues match, say so, triage the first 100, and mention the user can rerun with a narrower scope.

For duplicate detection, also fetch recently closed issues, titles and bodies only:

```bash
gh issue list --state closed --limit 100 --json number,title,body,stateReason
```

Learn the repo's conventions from the labels: which ones mean type (`bug`, `enhancement`…), area, priority (`P1`, `priority: high`…), and status (`needs info`, `stale`…). Only propose a kind of change the repo has labels for — if there are no priority labels, don't invent a priority scheme.

## Step 1: Review each issue

For each issue, decide whether any of these apply. Most issues will get zero or one.

- **Labels** — add missing type/area labels, or remove clearly wrong ones. Use existing labels only. If a label the repo clearly needs is missing (e.g. no `duplicate` label at all), propose creating it as a separate numbered item.
- **Priority** — only if the repo has priority labels and the issue has none. Base it on stated impact: crashes, data loss, security, or blocking users rank high; polish ranks low.
- **Duplicate** — only when two issues describe the same problem or request, not merely the same area. Keep the older or more detailed one open, and close the other with `--duplicate-of`. If you'd need to guess, leave it out.
- **Stale** — no activity for 90+ days and no linked PR. Propose a comment asking if it's still relevant (default), or closing as "not planned" when it's clearly obsolete — for example, it references removed code (`git grep` to check) or a feature that has since shipped.
- **Needs info** — a bug report with no steps to reproduce, expected/actual behavior, or version. Propose a short comment asking for exactly what's missing, plus the repo's `needs info`-style label if it has one.

Separately, pick up to 3 **Next up** issues: well-defined, unblocked, and impactful. Note whether each has a plan (a comment starting `_Implementation plan (superpowers writing-plans)`, or a local `docs/superpowers/plans/*-issue-<N>-*.md`). These are recommendations only, not changes.

Write every comment you'll post in full now: 1-3 friendly, specific sentences. The user approves exact text, not a description of it.

## Step 2: Present the proposal and get approval

Number every proposed change, one line each, grouped by kind:

```
Triage: owner/repo (<count> open issues reviewed, <K> changes proposed)

Labels
  1. #41 Login fails on Safari: +bug +auth
  2. #38 Dark mode toggle: +enhancement, -bug
Duplicates
  3. #44 → close as duplicate of #12 (both: CSV export drops the header row)
Stale
  4. #19 Old webhook retry idea: comment "Is this still needed? Closing in 2 weeks if there's no reply."
Needs info
  5. #47 App crashes: +needs-info, comment "Thanks! Could you share the iOS version and steps to reproduce?"

Next up (no changes): #41 (has plan), #33, #29
```

Ask with AskUserQuestion:

- `question`: "Apply these triage changes?" followed by a blank line and the full numbered list.
- `options`: **Apply all** / **Apply some** / **Cancel**. Give **Apply all** a `preview` with the same list.
  - **Apply some** → ask which numbers to skip or change. They can also answer with free text via "Other" (e.g. "all except 3 and 5", "make 4 a close"). Revise the list, show it in the prompt again, and re-ask.
  - **Cancel** → stop. Nothing changed.

If there are zero proposed changes, skip the question: say the backlog looks clean, list the Next up picks, and stop.

## Step 3: Apply approved changes

Apply each approved item. Pass comment text through `--body-file` / a temp file, so quotes and Markdown survive:

```bash
gh label create "<name>" --description "<desc>"                        # approved new labels first
gh issue edit <N> --add-label "bug" --add-label "auth" --remove-label "question"
gh issue close <N> --duplicate-of <M> --comment "Closing as a duplicate of #<M>."
gh issue close <N> --reason "not planned" --comment "<text>"
gh issue comment <N> --body-file <tmpfile>
```

Keep going if one item fails, and collect the errors.

Report a short summary: how many changes were applied, any failures with their error message, and the Next up picks with the command to start one (`/work-issue <N>`). Then stop.
