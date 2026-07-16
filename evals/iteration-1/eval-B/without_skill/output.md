# `scripts/sweep.ts` — Business Rules & Maintenance Guide

## What this script does

`sweep.ts` is a scheduled maintenance job that automatically ages out inactive GitHub issues in the `anthropics/claude-code` repository. It runs in two phases on every execution:

1. **Mark stale** — labels long-inactive, unattended issues as `stale`.
2. **Close expired** — closes issues that have carried a lifecycle label (`invalid`, `needs-repro`, `needs-info`, `stale`, `autoclose`) past its timeout without human follow-up.

It is a [Bun](https://bun.sh) script (`#!/usr/bin/env bun`) using top-level `await`. All issue lifecycle configuration lives in the sibling file `scripts/issue-lifecycle.ts`, which is the single source of truth for labels, timeouts, and messages.

---

## Configuration (from `issue-lifecycle.ts`)

The `lifecycle` array defines each managed label, its timeout in days, the human-readable close reason, and a nudge message. Current values:

| Label         | Timeout (days) | Close reason                                          |
|---------------|---------------:|-------------------------------------------------------|
| `invalid`     | 3              | this doesn't appear to be about Claude Code           |
| `needs-repro` | 7              | we still need reproduction steps to investigate       |
| `needs-info`  | 7              | we still need a bit more information to move forward   |
| `stale`       | 14             | inactive for too long                                 |
| `autoclose`   | 14             | inactive for too long                                 |

- **`STALE_UPVOTE_THRESHOLD = 10`** — the community-interest cutoff. Issues with **10 or more** 👍 (`+1`) reactions are exempt from both marking stale and being closed.

To change a timeout, a label, or a close reason, edit `issue-lifecycle.ts` — not `sweep.ts`.

---

## Required environment

The script exits (throws) immediately if any of these are missing:

| Variable                   | Purpose                                             |
|----------------------------|-----------------------------------------------------|
| `GITHUB_TOKEN`             | Bearer token for the GitHub REST API                |
| `GITHUB_REPOSITORY_OWNER`  | Repo owner (e.g. `anthropics`)                       |
| `GITHUB_REPOSITORY_NAME`   | Repo name (e.g. `claude-code`)                       |

## Modes

- **Normal run** — performs the labeling, commenting, and closing.
- **Dry run** (`--dry-run` flag) — logs every action it *would* take but makes no API writes. Use this when validating rule changes.

---

## Phase 1 — Mark Stale (`markStale`)

Scans open issues (up to 10 pages × 100 = 1000 issues), ordered by **least-recently-updated first**.

An issue is labeled **`stale`** only if **all** of these hold:

1. It is a genuine issue — **pull requests are skipped** (`issue.pull_request`).
2. It is **not locked**.
3. It has **no assignees** — someone actively owning it is left alone.
4. It was **last updated more than 14 days ago** (the `stale` timeout).
5. It does **not already** carry the `stale` **or** `autoclose` label.
6. It has **fewer than 10** 👍 reactions (below `STALE_UPVOTE_THRESHOLD`).

**Important control-flow rule:** because issues are sorted oldest-update-first, the moment the loop hits an issue updated *within* the 14-day window it **returns from the whole function** (`return labeled`) rather than just skipping that issue. Everything after that point is newer, so there is nothing left to mark. This is an intentional early-exit optimization — but note it stops pagination entirely, so the assignee/PR/lock skips above only apply to issues older than the cutoff.

Action taken: `POST /issues/{n}/labels` adding `stale`.

---

## Phase 2 — Close Expired (`closeExpired`)

Iterates over **every** lifecycle label (`invalid`, `needs-repro`, `needs-info`, `stale`, `autoclose`) and, for each, scans open issues carrying that label (again up to 10 pages × 100), oldest-update-first.

An issue is **closed** only if **all** of these hold:

1. Not a pull request.
2. Not locked.
3. Fewer than 10 👍 reactions (below threshold).
4. The label was **actually applied more than its timeout ago.** The script reads the issue's event history, finds the most recent `labeled` event for *that specific label*, and uses that timestamp — not the issue's `updated_at`. If the label was never found in events, or was applied more recently than the cutoff, the issue is skipped.
5. **No human commented after the label was applied.** It fetches comments since the label timestamp and skips the issue if any commenter's `user.type` is not `"Bot"`. (Per the inline comment, the triage workflow is supposed to strip lifecycle labels on human activity; this is a safety net in case it didn't.)

When all conditions pass, it:
1. Posts a closing comment: *"Closing for now — {reason}. Please [open a new issue](…) if this is still relevant."* (`NEW_ISSUE` points at the issue chooser.)
2. `PATCH`es the issue to `state: "closed"` with `state_reason: "not_planned"`.

---

## Cross-cutting behaviors to know when maintaining

- **404s are swallowed.** `githubRequest` returns an empty object/array on HTTP 404 instead of throwing. This keeps the sweep resilient to just-deleted issues, but means a mistyped endpoint fails silently rather than loudly — watch for this when adding new API calls.
- **Non-404 errors abort the run.** Any other non-OK response throws with the status and body text, halting the entire script.
- **Pagination cap of 10 pages.** Both phases process at most 1000 matching issues per run. On a very large backlog, the remainder is handled on subsequent runs.
- **The upvote exemption (≥10 👍) is checked in both phases**, so a popular issue is never auto-labeled *and* never auto-closed even if it somehow acquired a lifecycle label.
- **Ordering matters.** Phase 1 relies on the ascending `updated` sort for its early-exit; do not change the sort direction without revisiting that `return`.
- **Idempotent-ish.** Re-running is safe: Phase 1 skips already-`stale`/`autoclose` issues, and Phase 2 re-evaluates the label timestamp each time.

## Where to make common changes

| Change | File / location |
|--------|-----------------|
| Timeout days, label names, close/nudge wording | `issue-lifecycle.ts` (`lifecycle` array) |
| Upvote exemption threshold | `issue-lifecycle.ts` (`STALE_UPVOTE_THRESHOLD`) |
| Closing comment template | `sweep.ts` → `CLOSE_MESSAGE` |
| "New issue" link | `sweep.ts` → `NEW_ISSUE` |
| Stale eligibility rules (assignees, locks, etc.) | `sweep.ts` → `markStale` |
| Close eligibility rules (human-activity guard, etc.) | `sweep.ts` → `closeExpired` |
