# RISKS.md — `session_state.py`

> Risk / defect-**candidate** register. Each row is a reconstruction-time judgment, not a confirmed defect and not a measured metric.
> Severity labels (**triage-level, reconstruction-time judgment**) are hints for a maintainer decision, not facts. Every row carries `session_state.py:LINE` evidence.
> Nothing here is asserted as a bug; each item is a candidate for maintainer review.

---

### R-01 — Silent state-save loss under I/O failure
- **Severity (triage judgment)**: High
- **Evidence**: `save_state` catches `(IOError, OSError)` and only `debug_log`s; it returns normally.  `session_state.py:114`
- **Finding**: In `with_locked_state`, a failed `save_state` still lets the function return the callback's value as if the write succeeded, so a mutation the callback "committed" (e.g. marking a warning shown) can be silently dropped. `session_state.py:147` `session_state.py:148`
- **Suggested action**: Have `save_state` signal failure (return bool / re-raise) and let `with_locked_state` surface it, or at minimum have callers not trust a persisted result after a logged write failure.

### R-02 — Non-atomic state write can corrupt the file on crash
- **Severity (triage judgment)**: Medium
- **Evidence**: `save_state` writes directly with `open(state_file, "w")` + `json.dump`, no temp-file-and-rename.  `session_state.py:112`
- **Finding**: A crash or disk-full mid-`json.dump` leaves a truncated/partial JSON file. This is partially mitigated downstream because `load_state` catches `json.JSONDecodeError` and returns the empty default (`session_state.py:99`) — but that mitigation means the *entire* prior state (all `shown_warnings`) is silently discarded on the next load.
- **Suggested action**: Write to a temp file in the same dir and `os.replace()` into place for atomic durability.

### R-03 — `with_locked_state` returns `None` both for "locking failed" and "callback returned None"
- **Severity (triage judgment)**: Medium
- **Evidence**: error path returns `None` (`session_state.py:152`); success path returns `callback(state)` which can itself be `None` (`session_state.py:148`).
- **Finding**: A caller cannot distinguish "the locked operation failed / did not run" from "the operation ran and legitimately returned None." Any caller that branches on a falsy/None result may treat a lock failure as a valid empty outcome.
- **Suggested action**: Use a sentinel or raise on the failure path so callers can tell the two apart.

### R-04 — Blanket `except Exception: pass` hides all GC errors
- **Severity (triage judgment)**: Medium
- **Evidence**: the whole `cleanup_old_state_files` body is wrapped in `except Exception: pass`, on top of the inner per-file `except (OSError, IOError): pass`.  `session_state.py:84` `session_state.py:68`
- **Finding**: Any unexpected error (permission changes, `os.listdir` failures, programming errors) is swallowed with no log, so a GC that silently stops running (leaking old state/lock files indefinitely) is undiagnosable.
- **Suggested action**: Narrow the outer catch and/or `debug_log` the swallowed exception, mirroring the logging done in `save_state`/`with_locked_state`.

### R-05 — 128-char truncation of the session key can collide
- **Severity (triage judgment)**: Low
- **Evidence**: `_state_key` truncates the sanitized key to 128 chars.  `session_state.py:34`
- **Finding**: Two distinct session/remote ids that share a ≥128-char sanitized prefix map to the **same** state and lock files, cross-contaminating state and defeating per-session isolation. Realistically rare (CC ids are UUIDs, per the comment `session_state.py:31`) but the code explicitly does not guarantee the id format.
- **Suggested action**: If long/opaque ids are possible, hash the key (e.g. include a short digest) instead of a raw prefix truncation.

### R-06 — Env var read per call; state/lock paths can desync mid-session
- **Severity (triage judgment)**: Low
- **Evidence**: `get_state_file` and `get_lock_file` each re-read `SECURITY_WARNINGS_STATE_DIR` and re-invoke `_state_key` (which re-reads `CLAUDE_CODE_REMOTE_SESSION_ID`) at call time.  `session_state.py:39` `session_state.py:45` `session_state.py:29`
- **Finding**: If either env var is mutated between calls within a single `with_locked_state` cycle, the lock could be taken on one path while state is read/written on another, weakening the exclusion guarantee. Low likelihood (env rarely changes mid-process).
- **Suggested action**: Resolve the key/dir once per operation and pass it through, rather than re-reading env in each accessor.

### R-07 — Legacy sweep is intentionally partial (`.lock` only)
- **Severity (triage judgment)**: Informational
- **Evidence**: the legacy `~/.claude`-root loop matches only `.endswith(".lock")`, unlike the primary loop which also handles `.json`.  `session_state.py:77`
- **Finding**: Legacy `.json` state files ever written to the `~/.claude` root by old versions would never be GC'd here. The comment frames the sweep as targeting stray lock files from versions `<1.1.66` (`session_state.py:71`), so this is likely by design, not a defect — flagged only so a maintainer can confirm no legacy `.json` files exist at that path.
- **Suggested action**: Confirm intent; if legacy `.json` files were possible at the root, extend the filter.

---

## Notes
- All rows above are grounded in a re-opened cited line (Critic gate applied). No ungroundable item was promoted into this register.
- The runtime hook/CLI I/O behavior and `debug_log` semantics are external to this file and were **not** used as evidence for any severity above.
