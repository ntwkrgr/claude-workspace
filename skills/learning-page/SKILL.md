---
name: learning-page
description: Build Chas an interactive learning page that teaches one topic in stations, each with a hands-on lab and free-answer checks that Claude grades, with progress saved so the next page picks up where he left off. Use whenever he asks to learn, understand or be taught something, wants to know how code in a repo works ("teach me how the model in Aries works", "explain this codebase"), asks for a lesson, tutorial, explainer or "learning dashboard", or comes back to continue a topic he studied before. Use it even when he just says "I want to understand X" or "how does X actually work?" and a one-paragraph answer wouldn't do it justice.
---

# Learning page

A learning page is a hand-built HTML artifact that teaches one topic as a sequence of stations. Each station has a short explanation, one lab the learner can play with, the real details (constants and names from the code, or cited facts), and one or two free-answer checks graded on the page. Answers, verdicts and a "still fuzzy" note save to the page's own database, which you read back before building the next page.

The point is understanding Chas can use: explaining the system to someone else, debugging it, or deciding what to build next. Pages that only look impressive miss that.

## Two modes

- **Repo mode:** Chas names a repo or code ("how does X in my repo work"). The source of truth is the code. Attach and clone the repo if it isn't in the session, then read the actual path end to end before planning anything.
- **Subject mode:** Chas names a subject with no material. Research it with web search, prefer primary sources (docs, papers, standards, the original author), and keep a list of what you cite. Every page in this mode ends with a Sources list of real links.

## Workflow

1. **Quick check.** Before building, ask with AskUserQuestion, one question per call, recommended option first: what he already knows about this topic (offer concrete levels, not "beginner/expert"), what he wants to be able to do afterward, if the topic is broad which part matters most, and always last, how in-depth the page should go (see Depth). On a follow-up page, skip all but the depth question; the saved progress answers the rest. If he's away, take the most reasonable reading, default to Standard depth, and say which reading you took.
2. **Gather.** Repo mode: read the code that actually runs, in order, and note real constants, function names, file names and the reasons comments give. When behavior depends on a library, check that library's source at the version the repo pins, not memory (on the Aries page this caught that rtmlib 0.0.16 averages the two SimCC peaks rather than taking the minimum). Subject mode: research until every claim you plan to make has a source.
3. **Find the thesis.** Write the one sentence that reorganizes the topic for this learner, the thing they'd say if asked "so how does it work?" For Aries it was "two neural nets, then rules you can read." It becomes the page's headline and shapes which stations exist.
4. **Plan the stations.** Follow the topic's real order: the order the pipeline runs, the order a packet travels, the order a proof builds. Size the page to the chosen depth, and make each station earn its place: one idea, one lab, its checks. If the plan runs past the depth's station count, cut or offer to split it into a series.
5. **Build.** Load `artifact-design` and `artifact-capabilities`, then write one HTML page (details below). Write a `/*RUNTIME*/` placeholder where the runtime goes and have a script substitute `assets/runtime.js` into it, rather than retyping it. Publish with these capabilities:
   `{"db": {"rules": [{"path": "progress", "read": "view", "write": "owner"}]}, "user": {}, "sample": {}}`
6. **Verify.** Check every claim against its source one more time, take one render at phone width in light and dark and fix what it shows, then do the functional pass the capabilities skill describes (write a probe document under `progress`, read it, delete it).
7. **Hand over.** One sentence on what the page teaches, plus anything you couldn't verify. Don't recap the stations; he'll open the page.

## Depth

Ask it as its own card, Standard first and marked recommended. Depth sets length; it never lowers accuracy or drops the lab.

- **Quick:** 3 to 4 stations. One short paragraph per station (about 60 words), the lab, one check, and at most three entries under "The details." About 15 minutes.
- **Standard (default):** 4 to 6 stations. One or two short paragraphs (about 120 words), the lab, one check, at most four detail entries.
- **Deep dive:** up to 8 stations. Up to three paragraphs, the lab, two checks, a full details list. Offer a series beyond that.

Words are the usual excess. Cut any sentence the lab already shows, any second example for the same point, and any recap of an earlier station.

## Why a hand-built page, not the Dashboard type

The Dashboard artifact type only displays data from sources and gives the page no way to write anything back, so it can't save answers or notes. Saving progress is the core of this skill, so always hand-build.

## Station anatomy

- **Eyebrow** naming what kind of step it is (for repo pages, the file it lives in).
- **Explanation:** plain language, at the length the depth allows. Define a term the first time it appears. No jargon you wouldn't use out loud.
- **Lab:** one interactive figure (see below).
- **"In your code" or "The details":** the real constants and names with a one-line meaning each. In repo mode these are what make the page trustworthy, because he can find each one in the code. Keep code excerpts rare; concepts plus real constants is the default depth.
- **Check yourself:** free-answer questions mounted with `Learn.mountQuestion`, as many as the depth allows.

## Labs

A good lab lets the learner change one or two inputs and watch the real rule respond. The Aries IoU lab moved a detection box and showed link, miss or ambiguous using the actual thresholds; the gate lab showed exactly which bar each event failed.

- Compute what the lab shows with a simplified version of the real rule. Never place results by hand, or the lab teaches nothing.
- Label illustrative data as illustrative. Never put real private data (player data, credentials, network details, anyone's personal information) in a page; it's one share away from anyone. Synthesize plausible values instead.
- Sliders and toggles over drag gestures, since he often uses a phone. Size SVG viewBoxes around 320 to 360 wide so 10px labels stay readable on a phone; a 680-wide chart shrinks its text to nothing.
- Use the subject's real units and scales (torso lengths, frames at 15 fps, milliseconds, AUC).

## Writing the checks

Free-answer questions work best when they ask the learner to apply the idea: "what happens if…", "why does the code do X instead of Y", "a pitcher has 6 fastballs and 6 off-speed pitches; what does the report do?" Plain recall ("what is the threshold?") tests the page, not the understanding.

Each question needs three parts for `mountQuestion`:
- `question`: what he sees.
- `rubric`: what a right answer must contain, in plain words, for the grader. Name the one or two ideas that matter and what doesn't (exact numbers usually don't).
- `model`: a short model answer, shown after two misses or when grading is unavailable.

Aim at the misconception most likely for this learner. One good question per station beats two filler ones.

## The runtime (`assets/runtime.js`)

Paste it into the page's script before page code. It gives:

- `Learn.connect(statusFn)`: connects to the store and grader; call once at load.
- `Learn.mountQuestion(el, {station, qid, question, rubric, model})`: builds a free-answer question. The page styles `.q`, `.q-prompt`, `.q-input`, `.q-actions`, `.q-verdict` (with `.right`, `.partly`, `.not_yet`) and `.q-model`, plus `.btn` and `.btn.solid`.
- `Learn.onChange(fn)`, `Learn.stationDone(station, qids)`, `Learn.setNote(text)`, `Learn.state()`.

Grading runs on the viewer's own Claude usage through the `sample` capability, on the quick tier, and the first check asks for consent. When grading isn't available, the question shows the model answer and lets him self-grade, which still saves. Only the page's owner writes progress; anyone else he shares it with can read but not save.

Finish every page with a "What's still fuzzy?" note box wired to `Learn.setNote`, a line saying the note shapes the next lesson, and two or three concrete ideas for what could come next.

## Design

Match the subject. In repo mode, use the project's own design tokens when it has them (eephus colors for Aries). Otherwise choose a look that fits the topic. Use numbered stations only because the sequence is real. Show progress on a map of the stations at the top so he can see what's done.

## Follow-up pages

When he returns to a topic, or asks for "the next lesson":

1. Find the earlier page with `Artifact` `list` (match the title or description) and read its progress with `ArtifactData` `get`, collection `progress`, doc `main`.
2. Read it as evidence: questions that took several tries or ended `not_yet`, the answers he actually wrote (they show the misconception), and the note. First-try `right` answers mean that idea can be assumed.
3. Build a new page in the series that starts from there, opens with a one-line recap linking the previous page, and spends its stations on what didn't land plus the next ideas. Don't append stations to the old page; its record stays as it was.

## Before handing over, check

- Every station follows the real order and earns its place.
- Every lab result comes from a rule, and illustrative data is labeled.
- Every factual claim traces to the code or a cited source, and dependency behavior was checked at the pinned version.
- No private or sensitive data is on the page.
- The page reads at phone width, in both themes.
- The probe write, read and delete worked.
