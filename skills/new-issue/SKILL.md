---
name: new-issue
description: Create a GitHub issue in the current repo from a short prompt — drafts a title, 1-3 sentence description, and labels/metadata for approval, files it with `gh`, then optionally hands off to /plan-issue to plan it. Use whenever the user runs /new-issue, or asks to "file an issue", "open an issue", "log a bug", "make a ticket", or "track this in GitHub", even if they don't name the skill. Supports "--v" / "verbatim" to post the prompt as-is with no drafting.
argument-hint: "[--v|verbatim] <what the issue is about>"
---

# /new-issue

Turn the user's prompt into a GitHub issue in the current repository, with an approval gate before anything is created and an optional hand-off to `/plan-issue` afterward.

The user's prompt: `$ARGUMENTS`

## Step 0: Preflight

Confirm you're in a GitHub repo and learn what metadata is available:

```bash
gh repo view --json nameWithOwner,url -q '.nameWithOwner'
gh label list --limit 100 --json name,description
```

If `gh repo view` fails (not a git repo, no GitHub remote, or `gh` not authenticated), tell the user what failed and stop — don't guess a repo.

If `$ARGUMENTS` is empty, ask the user what the issue should be about before going further.

## Verbatim mode

If the prompt contains `--v`, `--verbatim`, or the word `verbatim` used as an instruction (e.g. "verbatim: ...", "...post this verbatim"), the user wants their words posted unedited:

1. Remove only the flag token itself (`--v`, `--verbatim`, or the `verbatim` instruction word/phrase). Everything else stays exactly as typed — same wording, punctuation, line breaks, typos. Don't fix, reformat, or summarize.
2. Title: GitHub requires one. Use the first line of the remaining text if it's 80 characters or fewer; otherwise write a short, plain title (under ~70 chars) that names the topic.
3. Create the issue with no labels, assignee, or other metadata — write the body to a temp file and use `--body-file` so whitespace and special characters survive:
   ```bash
   gh issue create --title "<title>" --body-file <tmpfile>
   ```
4. Report the issue URL and **stop**. No approval step, no planning offer — the flag means "just post it."

## Step 1: Draft and get approval

Read the prompt and, if it references code, files, or behavior in the repo, take a quick look so the draft is accurate (a few targeted reads, not a full investigation — planning happens later).

Draft:
- **Title** — short, specific, imperative or descriptive (e.g. "Retry failed webhook deliveries with backoff"), under ~70 chars.
- **Description** — 1-3 sentences: what's wrong or wanted, and why it matters. Keep it tight; this is a ticket, not a spec.
- **Labels** — pick from the repo's existing labels only (from preflight). Choose the ones that genuinely fit (type like `bug`/`enhancement`, area, priority if the repo uses them). If a clearly-needed label doesn't exist, list it separately as "new label — will be created if you approve" rather than silently inventing it.
- **Other metadata** — include assignee, milestone, or project only when the prompt asks for them or they're obvious (e.g. "assign to me" → `@me`). Otherwise omit.

Format the draft like this:

```
Repo: owner/name
Title: <title>
Description: <1-3 sentences, exactly as it will be saved>
Labels: bug, api   (new: <label>, if any)
Assignee / Milestone: <only if set>
```

Ask for approval with AskUserQuestion:
- `question`: "Create this issue?" followed by a blank line and the full draft above — every field, with the exact title and description text that will be saved.
- `options`: **Create it** / **Edit** / **Cancel**. Give **Create it** a `preview` containing the same full draft, so it's visible whichever option is focused.

- **Edit** → apply the user's changes and ask again with the revised draft embedded the same way. Loop until they approve or cancel.
- **Cancel** → stop. Nothing was created.

## Step 2: Create the issue, then offer planning

On approval, create any approved new labels first (`gh label create "<name>"`), then the issue. Use `--body-file` for the description:

```bash
gh issue create --title "<title>" --body-file <tmpfile> --label "bug" --label "api" [--assignee @me] [--milestone "<m>"]
```

Share the issue URL, then ask with AskUserQuestion: "Plan it now?" — options: **Plan it now** / **Not now**.
- **Plan it now** → invoke the Skill tool with skill `plan-issue` and the issue number as `args`, and follow it. It writes and posts the plan, then offers `/work-issue`.
- **Not now** → stop. The issue stays as created; the user can run `/plan-issue <N>` later.
