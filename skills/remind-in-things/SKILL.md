---
name: remind-in-things
description: >
  Turn the open action items from the current conversation into a Things to-do with a
  checklist and a reminder. Use this skill whenever the user says /remind-in-things, "remind
  me to check this tomorrow", "put this in Things", "save these action items to Things",
  "add a reminder for the follow-ups", "don't let me forget to do this", or otherwise asks
  to be reminded about what's left to do from the work just discussed. Requires the Things
  MCP (mcp__things__add_todo).
---

# Remind in Things

Collect what the user still has to do from this conversation and save it as one Things
to-do: a clear title, a few lines of context in the notes, the action items as a checklist,
and a scheduled reminder. When the reminder fires, the to-do alone should be enough to
pick the work back up without reopening the conversation.

## 1. Load the tool

If `mcp__things__add_todo` is listed only as a deferred tool, load it with ToolSearch
(`select:mcp__things__add_todo`) before calling it. If the Things MCP isn't available at
all, say so and give the user the to-do as text instead.

## 2. Gather the action items

Read back through the conversation and pick out what is still open:

- things only the user can do (run a command that needs their password, check something
  on a real device, set a date, decide between options)
- checks or verifications that couldn't be done yet, and why
- follow-ups in other places (another repo, another app, a person to tell)
- the next step to ask Claude for, if work is waiting on the user

Leave out work that is already finished. The to-do is for what's left, not a recap.

If nothing is open, tell the user that and don't create an empty to-do.

## 3. Work out when

Use the user's words: "tomorrow", "Monday", "next week", "in 2 hours", "at 3pm". Convert
them to an absolute date from today's date in the session context, and use the
`YYYY-MM-DD@HH:MM` form so Things shows a notification.

When the user names a day but no time, use 09:00. When they give no timing at all, use
tomorrow at 09:00. Say in your reply which time you picked so they can change it.

## 4. Write the to-do

**Title:** the project plus what to do, short enough to read in a notification.
Example: "Check Coregulation Journal contributing factors branch".

**Notes:** two to four plain sentences: where the work stands (branch, document,
ticket), what isn't done yet, and what to do first when the reminder fires. Name exact
branches, files and versions so the user can find them.

**Checklist:** one item per action, in the order the user should do them. Start each with
a verb. Keep exact commands verbatim, because the user may copy them from Things. Aim for
3-8 items; merge tiny ones, and leave detail to the notes.

Only set `list_title`, `tags` or `deadline` when the user names a project, area or tag, or
gives a hard due date. Make one to-do, unless the user asks for several or the items
clearly belong to unrelated projects.

Leave secrets out of the to-do: no passwords, tokens or API keys, even if they came up in
the conversation.

## 5. Create it and confirm

Call `mcp__things__add_todo` with `title`, `when`, `notes` and `checklist_items`. Then tell
the user in a few lines: the title, the reminder date and time, and a one-line summary of
the checklist. Don't repeat the whole checklist; it's in Things now.

## Example

After a coding session where the tests couldn't run, the user says "remind me to check this
tomorrow":

- title: `Check Coregulation Journal contributing factors branch`
- when: `2026-10-24@09:00`
- notes: `Branch practitioner-view: contributing factors feature (9 commits on top of 9c876d1). Not pushed or merged. Unit and UI tests have not run yet. Then tell Claude to run the full test suite and pick merge / PR / keep.`
- checklist:
  - `Update CoreSimulator in Terminal: sudo xcodebuild -runFirstLaunch`
  - `Have Claude run the full unit + UI test suite`
  - `Simulator check: new form section, review/detail screens, Dashboard donut`
  - `Real device: check Insights cards for new guardrail refusals`
  - `PRIVACY.md: set the effective date before republishing`
