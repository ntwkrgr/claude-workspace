# Out-of-sync Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `install.sh --pull` prints one warning line, which Claude relays to the user, when the clone is behind GitHub, has unpushed commits, or has uncommitted changes.

**Architecture:** A block at the end of `install.sh` (before `exit 0`), gated on `--pull`, reads ahead/behind counts from `git rev-list --left-right --count HEAD...@{u}` and dirtiness from `git status --porcelain`. SessionStart hook stdout already reaches Claude as context.

**Tech Stack:** bash 3.2, git.

**Spec:** docs/superpowers/specs/2026-11-26-sync-warning-design.md

## Global Constraints

- bash 3.2 compatible (no `mapfile`, no `${var,,}`).
- The block must never make `install.sh` exit non-zero; `exit 0` stays the last line.
- Prints nothing when in sync, and nothing without `--pull`.
- Warning line format, exactly (only the non-zero parts, joined with `, `, in this order: `N behind`, `N unpushed`, `uncommitted changes`):
  `warning: claude-workspace on this Mac is out of sync with GitHub (<parts>). Tell the user this at the start of your first reply, and that ~/Developer/claude-workspace needs a commit/push or pull.`

**User decisions (already made):**
- Notify through Claude (hook stdout to Claude context), not a macOS banner.
- Warn on behind, unpushed, and uncommitted changes, all three.
- No automatic fixing.

## Review Focus

1. No upstream configured (`@{u}` fails): must not print an error or a bogus count; still reports uncommitted changes.
2. Pull blocked by an uncommitted edit to a file the remote also changed: must report `1 behind, uncommitted changes`.
3. Plain `./install.sh` with no `--pull` on a dirty clone: must print no warning.
4. In-sync clean clone: must print no `out of sync` line.
5. Unpushed local commit: must report `1 unpushed`.

---

### Task 1: Out-of-sync warning in install.sh

**Goal:** `install.sh --pull` prints the exact warning line when the clone is behind, ahead, or dirty, and nothing otherwise.

**Files:**
- Modify: `install.sh` (new block just before the final `exit 0`)
- Modify: `README.md` ("Staying in sync" paragraph: one added sentence)
- Test (not committed): `$SCRATCH/sync-warning-test.sh`, where `$SCRATCH` is the session scratchpad

**Acceptance Criteria:**
- [ ] In-sync clean clone with `--pull`: output contains no `out of sync`.
- [ ] Remote 1 commit ahead and local uncommitted edit to the same file: output contains `(1 behind, uncommitted changes)`.
- [ ] Local unpushed commit: output contains `(1 unpushed)`.
- [ ] Dirty clone run without `--pull`: output contains no `out of sync`.
- [ ] Clone with no upstream and a dirty tree, with `--pull`: output contains `(uncommitted changes)` and no `fatal`.
- [ ] Every run exits 0.
- [ ] README "Staying in sync" says Claude warns at session start when the clone is out of sync.

**Verify:** `bash $SCRATCH/sync-warning-test.sh` → prints `PASS` for all 5 cases and exits 0.

**Steps:**

- [ ] **Step 1: Write the failing test** at `$SCRATCH/sync-warning-test.sh`

  Setup per case: `T=$(mktemp -d)`; `git init -q --bare $T/remote.git`; clone it to `$T/a`; copy `install.sh`, `AGENTS.md`, `CLAUDE.md`, `claude-code/`, `skills/` from the repo into `$T/a`; commit and push; clone to `$T/b`. Run `HOME=$T/home $T/b/install.sh [--pull]`, capturing output and exit code. Never touch the real `~/.claude`.

  Cases and assertions (each prints `PASS <name>` or `FAIL <name>: <output>`; script exits 1 on any FAIL):
  - `in-sync`: run `--pull` → no `out of sync`, exit 0.
  - `behind-dirty`: in `a` change `claude-code/settings.json`, commit, push; in `b` make a different uncommitted edit to the same file; run `--pull` → contains `(1 behind, uncommitted changes)`, exit 0.
  - `unpushed`: in `b` commit a new file, don't push; run `--pull` → contains `(1 unpushed)`, exit 0.
  - `no-pull-flag`: in `b` dirty a file; run with no args → no `out of sync`, exit 0.
  - `no-upstream`: in `b` run `git branch --unset-upstream`, dirty a file; run `--pull` → contains `(uncommitted changes)`, no `fatal`, exit 0.

- [ ] **Step 2: Run it and confirm it fails**

  Run: `bash $SCRATCH/sync-warning-test.sh`
  Expected: `FAIL behind-dirty`, `FAIL unpushed` and `FAIL no-upstream` (no warning line exists yet).

- [ ] **Step 3: Add the block to `install.sh`** just before `exit 0`, with a one-line comment saying what it does

  Gate on `"${1:-}" == "--pull"`. Read counts with `git -C "$repo" rev-list --left-right --count HEAD...@{u} 2>/dev/null` (left = unpushed, right = behind; default both to 0 when it fails). Dirty when `git -C "$repo" status --porcelain` is non-empty. Build the parts list in the order fixed in Global Constraints and print the exact line only when it's non-empty.

- [ ] **Step 4: Run the test and confirm it passes**

  Run: `bash $SCRATCH/sync-warning-test.sh`
  Expected: 5 × `PASS`, exit 0.

- [ ] **Step 5: Add the README sentence** after "...commit and push changes from wherever you make them." in "Staying in sync":

  `If this clone is behind GitHub, has unpushed commits, or has uncommitted changes, the hook tells Claude, and Claude warns you at the start of the session.`

- [ ] **Step 6: Commit**

  ```bash
  git add install.sh README.md docs/superpowers
  git commit -m "feat: warn when this clone is out of sync with GitHub"
  ```
