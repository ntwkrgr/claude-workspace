---
name: handoff-prompt
description: >
  Write a self-contained hand-off prompt for a fresh Claude Code session and give it in the
  chat as one copyable code block. Use whenever the user runs /handoff-prompt (optionally
  followed by what the prompt is for), or says things like "give me a prompt for a new
  session", "write a hand-off prompt", "prompt to continue this elsewhere", "give me
  something to paste into a new session", "hand this off to another session", or otherwise
  wants a new session to execute a plan, continue a task, or review work without them
  re-explaining it.
---

# Handoff prompt

The user wants to carry the current work into a new Claude Code session, and needs the
prompt to paste there. That session starts cold: it has the repo and the instruction files
Claude Code loads automatically, and nothing from this conversation. The prompt works when
a capable engineer holding only the prompt and the repo could pick up the work and finish
it.

## 1. Decide what the new session must do

Use the text after `/handoff-prompt` if there is any. Otherwise work it out from the
conversation: the plan just written, the task left half done, the work waiting for review.

If you can't tell what the new session should deliver, ask one question with
AskUserQuestion, offering the likely hand-offs as options (your recommendation first,
marked "(Recommended)"). If it is clear, write the prompt without asking.

## 2. Gather and check the facts

Collect what the new session needs:

- the folder to open the session in (absolute path) and the branch the work is on
  (`git branch --show-current`)
- the files that hold the requirements: plan, spec, issue, notes, the code at the centre
  of the work
- what is done and what is left (`git log`, `git status`, the plan's checkboxes)
- working practices this session settled on
- the user's preferences that bear on this task

Check that every file path you name exists (`ls`, `test -e`) before you write it into the
prompt, and leave out any you can't confirm. A wrong path sends the new session hunting;
a missing one costs nothing. If the conversation names a file that isn't there, describe
what it was for instead of giving its path, and mention it in the check line.

Watch for things that exist only here: uncommitted changes, unpushed commits, files in a
scratchpad or `/tmp`. The new session may run on another machine or clone where they
won't exist. Don't point the prompt at scratch files; for uncommitted or unpushed work,
use the check line after the block to tell the user to commit and push first.

## 3. Write the prompt

Use these sections, in this order. Leave out "Practices to keep" when
there is nothing project-specific to say.

```
<Title: the task of the new session, in plain words>

Where to run it: <absolute folder path>, on branch `<branch>`.

<the slash command and its arguments (usually the plan path), alone on its line, exactly as
it must be typed, if the work starts with one>

## Your task
<Two or three sentences: the project, what is already done, what this session must
deliver. One sentence on what is out of scope.>

## Read these files first
1. `<path>`: <why, in a few words>
2. ...

## Practices to keep
- <branching and merge rules, review steps, how to build and test, how to check visual
  work, anything learned the hard way>

## My preferences
- <only the ones that would change what the new session does>

## What to give me at the end
- <concrete deliverables, and what "done" means>
```

How to write it well:

- **Stand on its own.** No "as discussed", "the plan above", "the bug we found", "the
  approach we agreed on". Say the thing itself: name the file, quote the error, state the
  finding, give the decision and its reason. If a finding matters and lives only in this
  conversation (a ruled-out cause, a reproduction step, a measured number), write it into
  the prompt; the new session has no other way to learn it.
- **Open questions go in "Your task".** Say what is undecided, what to check
  to decide it, and when to stop and ask the user.
- **Situation and goal over rules.** A clear picture of where things stand and what done
  looks like steers better than a list of dos and don'ts. Use plain, direct sentences and
  cut anything the engineer wouldn't miss.
- **Preferences.** Claude Code already loads `~/.claude/CLAUDE.md`, `AGENTS.md` and the
  repo's own instruction files into the new session, so don't copy them out. Include
  preferences the user stated only in this conversation, plus the few from those files
  or memory that most shape this particular task. If this task departs from a standing
  preference (open a PR instead of merging, say), say so explicitly.
- **Practices.** Only what is true for this project and was settled here: the test
  command that actually works, the review step the user expects, a trap already hit.
- **No secrets.** Leave out tokens, passwords, keys and personal details, even if they
  came up. If the work needs a credential, say where the new session will find it, not
  what it is.
- **Start with plain text.** Claude Code treats a message that begins with `/` as a
  command and one that begins with `!` as a shell command, so the first line is the title
  in words. A slash command on a later line still works: the new session reads it and
  invokes that skill.
- **Fences inside.** If the prompt needs a code block, use three backticks; the outer
  block uses four.

## 4. Rewrite it in Simplified Technical English

The reader of the prompt is an agent, so write the prompt in ASD-STE100 Strict mode.
Use the `asd-ste100` skill on the draft, then run its linter on the prompt text only:

```bash
python3 ~/.claude/skills/asd-ste100/scripts/ste-lint.py <draft-file>
```

Fix every finding and run the linter again until it reports 0 violations. The usual
findings are semicolons, sentences over 25 words, passive voice ("the plan is committed"
becomes "I committed the plan"), present perfect, and two words for one action ("check"
and "confirm"). Keep code, paths, commands and quoted errors exactly as they are. A
finding inside them is not a violation. Keep every hedge ("may", "might") as strong as it
was. If a finding stays because a fix would lose meaning, it is acceptable, but a stylish
sentence is not a reason.

## 5. Give it to the user

Reply with exactly this shape:

~~~~~
<One sentence: what the prompt is for and where to paste it.>

````
<the prompt>
````

<Optional: one line on anything to check before using it, e.g. "Push branch `x` first.
The last commit of the plan is only on this machine.">
~~~~~

Keep the check line to one line even when there are several things to check. The
four-backtick fence keeps Markdown and inline code inside the prompt intact when the
user copies it. Put nothing else in the reply: no summary of the prompt, no offer of
alternatives, and never the prompt as a file only. The user should get it in one copy
from the chat.
