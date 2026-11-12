---
name: asd-ste100
description: "Use when English text must be parsed without a human to resolve ambiguity — tool descriptions, error messages, inter-agent instructions, system prompts, status reports — and misreading has a real cost. Also use for Chas's work documentation (how-tos, runbooks). Triggers: disambiguate, STE100 rewrite, apply Simplified Technical English, controlled-language rewrite, rewrite so an agent cannot misread this. Not for creative or marketing copy, or for emails, messages and other prose that goes out in Chas's voice (use chas-voice)."
version: 0.5.0
---

# Simplified Technical English (ASD-STE100)

ASD-STE100 is a controlled-language standard from the aerospace and defense industry (ASD) that stops maintenance technicians from misreading English instructions. It removes the two biggest sources of misreading: words with more than one meaning, and sentences with more than one possible structure.

This skill applies the same discipline for a different reader: an **AI agent or downstream system** that parses an English string with no human in the loop to resolve ambiguity. If a technician can misread "close the valve" as "the valve that is near", so can a language model.

## When to Use This Skill

- Text will be read by another agent, a translation pipeline, or a non-native English reader, and a misreading has a real cost.
- You are writing a prompt, system message, tool description, error message or status report.
- Text reads as dense, jargon-heavy, or ambiguous.
- Chas's work documentation: how-tos and runbooks.

STE is deliberately flat and literal. Do not apply it where voice, nuance, or persuasion is the point.

## Two Modes

Pick a mode before rewriting. If the user does not say which, infer it from the text type. Keep the choice internal unless the user asks for the rule table.

**Strict** — procedures, runbooks, error messages, tool and function descriptions, inter-agent instructions, safety text. Apply every rule below, including the length caps and one-word-one-meaning discipline.

**STE-flavored** — READMEs, PR descriptions, changelogs, explanatory prose. Apply the structural rules in full and treat the lexical rules as advisory. Prose needs some range, and a strict rewrite of prose reads as a personality transplant rather than a clarification.

## Source and Scope

This skill encodes the rule categories of ASD-STE100 Issue 9 (Jan 2025): 53 writing rules in 9 sections, backed by a dictionary of ~900 approved words. It does **not** include that dictionary, which ASD does not allow this repo to redistribute. It applies the principle instead: pick the plainest, most common word and use it the same way every time. Never claim dictionary compliance. When exact ASD-approved wording matters (real aircraft maintenance documentation), check against the official standard. See `references/writing-rules.md` for the rule summary, citations, and how to get the standard.

## Core Rewrite Rules

**Structural rules** describe sentence shape. Apply them with confidence. **Lexical rules** are defined by the official dictionary, so without it they are a direction of travel, not a checkable standard.

### Structural rules — apply these

| Rule | Do | Don't |
|---|---|---|
| Active voice | "The agent deletes the file." | "The file is deleted (by the agent)." — unless the actor is genuinely unknown or irrelevant |
| No phrasal verbs (Rule 9.3) | "Remove the panel." / "Start the job." | "Take off the panel." / "Spin up the job." — a two-word verb has meanings the parts do not predict |
| One instruction per sentence | "Open the file. Read line 3." | "Open the file and read line 3, then check if it matches." |
| Sentence length | ≤20 words for instructions/procedures, ≤25 words for descriptions | Long compound/subordinate-clause sentences |
| No semicolons (Rule 8.1) | Split into separate sentences | Any semicolon at all. (The em dash is permitted, though it often signals a sentence that should be split.) |
| Noun clusters | ≤3 words stacked as a noun phrase ("fuel pump valve") | 4+ word noun stacks ("high pressure fuel pump inlet valve assembly") |
| No ellipsis | Keep the subject, verb, and article explicit even if it reads longer | Drop words to save space ("Files not backed up will be lost" → ambiguous which files) |
| Keep modality | "The request **may have** failed." stays "may have" | Promote a hedge to a fact, or invent a certainty the source did not state |
| Paragraph limits | One topic per paragraph, ≤6 sentences | Multi-topic paragraphs |
| Lists for sequences | Use a numbered or bulleted list for 3+ steps or conditions | Bury a sequence inside one prose sentence |

### Lexical rules — direction of travel only

| Rule | Do | Don't |
|---|---|---|
| One word, one meaning | Pick one verb for one action and reuse it every time (always "check", never mix "check"/"verify"/"confirm") | Rotate synonyms for the same idea across a document |
| One part of speech per word | "Apply oil to the valve" (oil = noun) | "Oil the valve" (oil = verb) |
| Verb, not noun (Rule 3.7) | "Analyze the log." | "Perform an analysis of the log." |
| Domain terms | Keep necessary technical terms, but define them once if not common English | Use jargon without ever defining it |

### Simple tenses — apply with one exception

STE permits infinitive, imperative, simple present, simple past, simple future, and past participle as adjective. It excludes present perfect and other compound forms: "we received the report", not "we have received the report".

Status text sometimes needs the compound form: "the job has completed" (output available now) is not "the job completed" (at some past point). **Where the compound form carries information the simple form cannot — current relevance, or a hedge as in "may have failed" — keep it and flag the departure.**

## Scan Checklist

Scan for all six before you rewrite anything. Each one points at an exact word or mark.

1. **Synonym rotation** — one thing gets several names ("the user", "the customer", "the client"). Fix: pick one name, use it every time.
2. **Hedge stacking** — qualifiers pile up until the sentence asserts nothing ("it is important to note that this may potentially help to improve"). Fix: state the claim with the one hedge the source needs, or delete it.
3. **Nominalization** — an action frozen into a noun ("perform an analysis of", "provides assistance to"). Fix: use the verb.
4. **Marketing adjectives** — seamless, robust, powerful, cutting-edge, effortless, blazing-fast. Fix: delete, or replace with the measurement that earns the claim.
5. **Run-on sentences** — several ideas joined by semicolons or em dashes. Fix: one idea per sentence.
6. **Soft phrasal verbs** — spin up, reach out, dive into, kick off. Fix: start, contact, read, begin.

## Process

1. Pick the mode.
2. Read the input once for meaning before rewriting.
3. Walk it sentence by sentence. Flag every violation from the rule tables and the Scan Checklist. In STE-flavored mode, flag the lexical rules but do not enforce them. For a mechanical first pass, run `scripts/ste-lint.py` (stdin or file args, `--json` for structured output, `--baseline N` to tolerate N hard violations, `--disable rule1,rule2` to silence rules). It never flags hedges or modality, by design.
4. Rewrite each flagged sentence and keep the original meaning exactly.
   - If a rewrite would drop necessary precision (a safety condition, a scope qualifier, a number), keep the longer phrasing and flag it.
   - **Check modality before you commit.** Hedges ("may", "could", "is likely to") carry the author's confidence, and confidence is content. A shorter sentence that upgrades a hedge to a fact is a different claim. This is the most common way an STE rewrite goes wrong.
   - Never add a fact the source did not state: no new cause, frequency, or mechanism.
5. If the input already complies, say so. Do not force changes onto compliant text.

## Output Format

**Default: the rewritten text, and nothing else.** No preamble, mode announcement, violation count, change summary, rule table, or closing offer.

The one permitted addition: if step 4 kept a longer phrasing on purpose, add one line after the text, prefixed `Kept as-is:`, naming the phrase and the precision that would have been lost.

**On request: the rule table.** When the user asks to see the reasoning ("show the diff", "which rules did it break", "before/after"), output this instead:

```markdown
| Rule violated | Original | Simplified |
|---|---|---|
| Present perfect tense | "We have received your request." | "We received your request." |
| Noun cluster (4+ words) | "the agent task queue priority handler" | "the handler that sets task-queue priority" |

Mode: Strict. 7 violations found.
```

Follow the table with a one-line note on anything you deliberately did **not** simplify, and why.

## Limits

- This is a clarity tool inspired by STE, not a certified STE authoring tool.
- STE fixes form, not substance. If the text has nothing to say, say so instead of polishing it.
- Stop when a sentence is unambiguous, not when it is shortest. Past that point, compression costs the reader time.

## Additional Resources

- `references/writing-rules.md` — the 9 rule sections, the dictionary's structure, citations, and why the dictionary is not here.
- `examples/before-after.md` — worked examples.
- `scripts/ste-lint.py` — stdlib-only linter for the structural rules. Exit 1 when hard violations exceed `--baseline` (default 0). Advisory findings (passive voice, compound tenses) never fail the run. `--selftest` asserts that "may have failed" passes clean.
