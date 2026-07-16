# Interface / API Definition — `session_state.py`

**Module:** `plugins/security-guidance/hooks/session_state.py`
**Purpose:** Per-session state-file plumbing for the security-guidance plugin. Provides the JSON state-file location, an `fcntl`-locked read-modify-write helper, and garbage collection of old state/lock files. Import is side-effect-free (no env-var reads at import time).

## Dependencies

- Standard library: `fcntl` (optional — absent on Windows, degrades gracefully), `json`, `os`, `re`, `datetime`.
- Local: `_base.debug_log` — logging sink for non-fatal errors.

## Environment Variables (read at call time, never at import)

| Variable | Used by | Default | Effect |
|---|---|---|---|
| `CLAUDE_CODE_REMOTE_SESSION_ID` | `_state_key` | `session_id` arg | Preferred key; stable across CCR process restarts so pending warnings survive. |
| `SECURITY_WARNINGS_STATE_DIR` | `get_state_file`, `get_lock_file`, `cleanup_old_state_files` | `~/.claude/security` | Directory where state/lock files live. |

## File Naming Convention

- State file: `security_warnings_state_<key>.json`
- Lock file:  `security_warnings_state_<key>.lock`
- `<key>` = sanitized session key (see `_state_key`).

---

## Public Functions

### `get_state_file(session_id) -> str`
Returns the absolute path to the session's JSON state file.
- **Params:** `session_id` (str) — Claude Code session id.
- **Returns:** `<state_dir>/security_warnings_state_<key>.json`.
- **Side effects:** None (does not create the file/dir).

### `get_lock_file(session_id) -> str`
Returns the absolute path to the session's lock file.
- **Params:** `session_id` (str).
- **Returns:** `<state_dir>/security_warnings_state_<key>.lock`.
- **Side effects:** None.

### `load_state(session_id) -> dict`
Loads the full state dict from disk.
- **Returns:** A dict that always contains key `shown_warnings` (list).
  - If the file holds a JSON list, it is wrapped as `{"shown_warnings": <list>}`.
  - If the file holds a JSON dict, `shown_warnings` is defaulted to `[]` if missing.
  - On any read/parse error (`json.JSONDecodeError`, `IOError`, `KeyError`, `TypeError`), returns `{"shown_warnings": []}`.
- **Side effects:** Reads the file. Never raises for the caught error classes.

### `save_state(session_id, state) -> None`
Writes `state` to the session's state file as JSON.
- **Params:** `state` (dict) — JSON-serializable state.
- **Side effects:** Creates the parent directory (`os.makedirs(..., exist_ok=True)`) then writes. Non-atomic (writes in place). On `IOError`/`OSError`, logs via `debug_log` and returns without raising.

### `with_locked_state(session_id, callback) -> Any`
Runs `callback(state)` under an exclusive advisory file lock, then persists the (possibly mutated) state.
- **Params:** `callback` — callable taking the state dict; may mutate in place and/or return a value.
- **Contract / sequence:**
  1. Ensure state dir exists.
  2. If `fcntl` is unavailable (Windows): load → callback → save, **without locking**. Returns callback result.
  3. Otherwise: open/create lock file, acquire `LOCK_EX`, load → callback → save, release lock and close fd in `finally`.
- **Returns:** The callback's return value; **`None` if a lock/state `OSError`/`IOError` occurs** (error swallowed and logged).
- **Concurrency:** Serializes concurrent callers sharing the same lock file. Read-modify-write is atomic within the lock only.

### `cleanup_old_state_files() -> None`
Garbage-collects state/lock files older than 30 days (by mtime).
- **Scope 1:** In `<state_dir>`, removes files matching `security_warnings_state_*` ending in `.json` or `.lock` with `mtime < now - 30d`.
- **Scope 2 (legacy):** In `~/.claude` (root), removes `security_warnings_state_*.lock` files left by versions < 1.1.66 that ignored `state_dir`. Same 30-day gate to avoid racing an active lock.
- **Side effects:** Deletes files. All errors swallowed (`OSError`/`IOError` per-file, plus a top-level `except Exception`).

---

## Internal Helpers

### `_state_key(session_id) -> str`
Computes the sanitized filename component.
- Prefers `CLAUDE_CODE_REMOTE_SESSION_ID` over `session_id`.
- Replaces every char not in `[A-Za-z0-9._-]` with `_` (path-traversal / separator defense).
- Truncates to 128 chars.

---

## Design Notes (from module docstring)

- The `atomic_check_*` helpers that build on `with_locked_state` intentionally live in `security_reminder_hook.py`, so tests that monkeypatch `hook.with_locked_state` still route through the patched binding via the handler → `atomic_check_*` → bare-name lookup chain.
- State schema is intentionally loose: the only guaranteed key is `shown_warnings`.
