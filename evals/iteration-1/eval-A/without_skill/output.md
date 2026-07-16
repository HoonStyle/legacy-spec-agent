# Spec: `diffstate.py`

Reconstructed from source (`/workspace/claude-code/plugins/security-guidance/hooks/diffstate.py`). No original documentation existed; this describes observed behavior to enable safe refactoring.

## 1. Purpose & Role

`diffstate.py` is a helper module for the **security-guidance** Claude Code plugin. It provides the git-derived "what did Claude change this turn?" logic that the plugin's security-review hooks depend on. It was **extracted from `security_reminder_hook.py`** purely for readability and is **re-exported there**, so callers still resolve these names through the hook module's globals. This matters for tests: existing tests do `monkeypatch.setattr(hook, "<fn>", …)` and must keep working without retargeting — a refactor must preserve the re-export surface.

The module has no `main()` and is not an entry point; it is a library of pure-ish functions operating over (a) per-session state (via `session_state.with_locked_state`) and (b) the git working tree (via `subprocess` + helpers in `gitutil`).

## 2. Dependencies

- `_base`: `debug_log` (best-effort logging), `_PV` (a plugin/protocol version int, used only as an observability column).
- `gitutil`: `GIT_CMD` (git argv prefix), `_git_dir`, `_git_toplevel`, `_git_status_porcelain`, `_git_rev_parse_head`, `_is_ancestor`, `_git_name_only`. These wrap git and mostly return sets of repo-root-relative paths or `None` on error.
- `session_state.with_locked_state(session_id, fn)`: runs `fn(state_dict)` under a per-session lock and persists mutations; returns `fn`'s return value.
- stdlib: `os`, `subprocess`, and lazily-imported `time`, `fcntl`.

## 3. Configuration constants

| Name | Value | Meaning |
|------|-------|---------|
| `STOP_LOOP_STATE_TTL_SEC` | `120` | TTL for `stop_hook_fire_count`. Sized to contain the async-rewake vuln→exit(2)→fix→Stop loop (~30–60s/cycle) while letting the next user turn proceed. |
| `PREVIOUS_FINDINGS_TTL_SEC` | env `PREVIOUS_FINDINGS_TTL_SEC` else `3600` | TTL for `previous_findings` (content-based dedup of already-flagged findings). Longer than the loop TTL so exact-repeat re-flags are suppressed across turns without masking regressions. |
| `_REVIEWED_SHAS_BASENAME` | `"sg-reviewed-shas"` | Filename (under `.git/`) for the reviewed-commit log. |
| `_REVIEWED_SHAS_CAP` | `500` | Max retained lines in that log. |
| `UNTRACKED_BASELINE_CAP` | `2000` | Max untracked paths snapshotted at baseline. |

## 4. Function-by-function contract

### Session-state baseline & stop-state (state lives in the per-session dict)

- **`save_baseline_sha(session_id, sha)`** — writes `state["baseline_sha"] = sha`.
- **`load_baseline_sha(session_id)`** — returns `state.get("baseline_sha")` (or `None`).
- **`record_touched_path(session_id, file_path)`** — appends `file_path` to `state["touched_paths"]` if absent; dedup by membership; caps list at 200 (drops oldest). Called by PostToolUse. The Stop hook is the consumer/clearer.
- **`consume_stop_state(session_id)`** — the central atomic read-then-clear for the Stop hook. Under one lock it snapshots and returns a dict with keys: `touched_paths`, `baseline_sha`, `head_at_capture`, `untracked_at_baseline` (defensively copied dict), `fire_count` (0 if TTL-expired else `stop_hook_fire_count`), `fire_count_expired` (bool), `previous_findings` ([] if its TTL expired else the list). It then **clears `touched_paths` to `[]`**. Returns a fully-defaulted dict if `with_locked_state` yields falsy. TTL math uses `stop_hook_fire_count_ts` and `previous_findings_ts` (the latter defaulting to the fire ts). Purpose: close the race where the next turn's UserPromptSubmit (UPS) wipes `touched_paths` before the async Stop hook reads it.
- **`restore_unreviewed_stop_state(session_id, paths, baseline_sha)`** — inverse of consume when Stop exits early (transient failure like API unreachable). No-op if `paths` empty. Prepends `paths` ahead of any concurrently-appended `touched_paths`, dedups (order-preserving via `dict.fromkeys`), caps at 200 (keeps the **first** 200 — note asymmetry vs `record_touched_path` which keeps the last 200). Restores `baseline_sha` only if none currently set. Keeps the UPS re-baseline guard armed.

### Baseline capture & file content

- **`get_baseline_file_content(session_id, file_path, cwd)`** — returns the file's content at `baseline_sha` via `git show <sha>:<relpath>`, or `None` if: no baseline, path is outside cwd (`relpath` raises `ValueError`), git returns nonzero, or a subprocess/OS error occurs. `rel_path` is computed relative to `cwd` (abs-normalized). 5s timeout.
- **`capture_git_baseline(cwd)`** — returns a SHA representing HEAD + uncommitted **tracked** changes using `git stash create` (creates a dangling commit object without touching the stash list or worktree). Returns `None` if the repo has no commits (guards by `rev-parse HEAD`, avoids creating commits in the user's repo). If the tree is clean (`stash create` prints nothing), falls back to `rev-parse HEAD`. Timeouts: 5s/15s/5s. **Known gap (documented in source): does NOT capture untracked files** — that is compensated by pairing with `_list_untracked()` in `untracked_at_baseline`.

### Reviewed-SHA log (repo-local, cross-session commit/push dedup)

Persisted at `<git-dir>/sg-reviewed-shas`, append-only, one line per sha: `<40-hex-sha>\t<unix-ts>\t<pv>\t<vulns_found>`. Only the sha column is consumed on read; trailing columns are observability only. Precedent: lives beside CC's `.git/claude-trailers`; survives sessions, per-clone.

- **`_reviewed_shas_path(repo_root)`** — `<_git_dir>/sg-reviewed-shas`, or `None` if `_git_dir` is falsy.
- **`_load_reviewed_shas(repo_root)`** — returns the `set` of valid full 40-hex shas from the file. Missing file / OS error → empty set. Validates length 40 and hex chars.
- **`_append_reviewed_shas(repo_root, shas, vulns_found=0)`** — records reviewed shas; best-effort, never raises. No-op if path falsy or `shas` empty. Under `fcntl.flock(LOCK_EX)` it reads existing lines, merges newest-first, dedups by sha, caps at `_REVIEWED_SHAS_CAP`, then rewrites (truncate + writelines) restoring chronological order. On `fcntl` unavailable (Windows) or any `OSError`/`ImportError`, degrades to a plain append (cap enforced on the next locked write); inner append swallows `OSError`.

### v2 review-set computation (Stop hook core)

- **`_list_untracked(cwd)`** — returns `{repo-root-relative untracked (non-ignored) path: st_mtime_ns}`, `{}` on error. Uses `git ls-files --others --exclude-standard -z` (with `core.quotePath=false`) from the repo toplevel — deliberately not `status`, since only the worktree-vs-gitignore walk is needed. mtime captured so a later in-place edit is still detectable. Caps at `UNTRACKED_BASELINE_CAP` (2000); unstattable files get mtime `0`.
- **`compute_v2_review_set(cwd, baseline_sha, head_at_capture, untracked_at_baseline=None)`** — the heart of the module. Derives the set of files to security-review "from git state alone."

  **Formula:** `review_set = dirty_now ∩ changed_since`, where
  - `dirty_now` = tracked-dirty-vs-HEAD (from `_git_status_porcelain`) ∪ new-untracked, **plus** files committed this turn when HEAD advanced linearly.
    - "new-untracked" = current untracked minus `preexisting_unchanged` (untracked at baseline whose mtime is unchanged → excluded; an in-place edit re-includes them).
    - Linear-advance detection: if `head_at_capture` and `current_head` exist, differ, and `head_at_capture` is an ancestor of `current_head`, then union `_git_name_only(repo, "<head_at_capture>..HEAD")` and set `diff_base = head_at_capture` (else `diff_base = "HEAD"`).
  - `changed_since` = `_git_name_only(repo, baseline_sha)` ∪ new-untracked, i.e. files differing from the pre-turn stash baseline. `None` when no baseline OR on git error (e.g. pruned dangling stash SHA).

  **Fallback:** if `changed_since is None`, `review_set = dirty_now` (do NOT intersect with ∅, which would silently zero the set). If `_git_status_porcelain` returns `(None, _)` (git failure), returns empty with metrics `dirty_now_count = changed_since_count = -1`.

  **Returns** `(review_paths, diff_base, repo, untracked_in_review, metrics)`:
  - `review_paths`: absolute paths (`repo`-joined), sorted.
  - `diff_base`: `"HEAD"` or `head_at_capture` (so committed files still diff).
  - `repo`: git toplevel (`_git_toplevel(cwd) or cwd`) — the caller's `git diff --name-only` MUST run from here, since porcelain/name-only paths are repo-root-relative.
  - `untracked_in_review`: sorted `new_untracked ∩ review_set`, so the caller can do a targeted `git add -N -- <files>` instead of a whole-tree scan.
  - `metrics`: `dirty_now_count`, `changed_since_count` (`-1` if None), `review_set_count`, and conditionally `preexisting_untracked_excluded` (only emitted when nonzero, to stay under a 10-key telemetry cap).

  **Design rationale (from source):** the `dirty_now` term is immune to checkout/pull "ballooning" (a pull touching thousands of files won't flood the review); the `changed_since` term filters out the user's untouched pre-turn WIP. **Known limitation:** a Bash-only turn interrupted before Stop fires leaves `touched_paths` empty, so the next UPS re-baselines past those edits (no worse than v1, which never reviews Bash-only turns).

## 5. State keys this module reads/writes (session state dict)

Written/cleared: `baseline_sha`, `touched_paths`. Read-only here (written elsewhere, e.g. UPS): `head_at_capture`, `untracked_at_baseline`, `stop_hook_fire_count`, `stop_hook_fire_count_ts`, `previous_findings`, `previous_findings_ts`.

## 6. Invariants a refactor must preserve

1. **Re-export surface**: every public name must remain reachable through `security_reminder_hook`'s globals so `monkeypatch.setattr(hook, ...)` in tests still binds. Renaming/removing without re-export will break tests.
2. **Atomicity**: `consume_stop_state` and `restore_unreviewed_stop_state` must do their read/modify/clear under a single `with_locked_state` call — splitting them reopens the async-Stop race.
3. **Never intersect with `None`/∅**: keep the `changed_since is None → fall back to dirty_now` guard, or the review set silently zeroes.
4. **Never raise from best-effort paths**: `_append_reviewed_shas`, `_list_untracked`, `get_baseline_file_content`, `capture_git_baseline` all swallow subprocess/OS errors by contract; callers assume no exceptions.
5. **`repo` is the toplevel, not cwd**: callers depend on the returned `repo` and on path-relativity to it.
6. **Cap directions differ intentionally**: `record_touched_path` keeps the newest 200; `restore_unreviewed_stop_state` keeps the first 200 (prepended = the restored unreviewed paths win).
7. **`capture_git_baseline` must not create commits in a fresh repo** (the `rev-parse HEAD` guard) and must not modify the stash list/worktree (`stash create`, not `stash push`).
8. **Metrics 10-key cap**: don't unconditionally add metric keys.

## 7. Open questions / things to verify against callers before refactoring

- Exact semantics of `_git_status_porcelain`'s return (`(tracked_dirty_set, untracked_set)`; `(None, _)` = git failure) and whether it already excludes ignored files.
- Who writes `head_at_capture`, `untracked_at_baseline`, `stop_hook_fire_count*`, `previous_findings*` (appears to be the UPS and Stop hooks in `security_reminder_hook.py`).
- The duplicated block comment (lines ~207–220 and ~227–240) is redundant and can be de-duplicated safely.
