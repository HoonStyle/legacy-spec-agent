# TESTCASES.md — `session_state.py`

> Characterization tests: each case **locks CURRENT behavior** to make refactoring safe. These assert "what the code does today," not "what it should do."
> Every case derives from a **verified** rule and cites `session_state.py:LINE`. Cases that would depend on a cross-process/OS external contract (real `fcntl` inter-process exclusion) are omitted — noted at the end.
> No claim of branch/exhaustive coverage.

---

### TC-01 — State key prefers the remote session id
- **Given** env `CLAUDE_CODE_REMOTE_SESSION_ID="remote-abc"` and `session_id="local-xyz"`.
- **When** `_state_key(session_id)` is computed (via `get_state_file`).
- **Then** the key is derived from `"remote-abc"`, not `"local-xyz"`.
- Locks: `key = os.environ.get("CLAUDE_CODE_REMOTE_SESSION_ID") or session_id`  `session_state.py:29`

### TC-02 — State key sanitizes path-escaping characters
- **Given** a session id `"../../etc/passwd"`.
- **When** `_state_key` runs.
- **Then** every char outside `[A-Za-z0-9._-]` becomes `_` (e.g. `.._.._etc_passwd`), so the key cannot escape the state dir.
- Locks: `re.sub(r"[^A-Za-z0-9._-]", "_", str(key))`  `session_state.py:34`

### TC-03 — State key truncated to 128 characters
- **Given** a session id 300 chars long of legal characters.
- **When** `_state_key` runs.
- **Then** the returned key length is exactly 128.
- Locks: `...[:128]`  `session_state.py:34`

### TC-04 — State file path shape and default dir
- **Given** env `SECURITY_WARNINGS_STATE_DIR` unset and `session_id="s1"`.
- **When** `get_state_file("s1")` is called.
- **Then** it returns `~/.claude/security/security_warnings_state_s1.json` (with `~` expanded).
- Locks: default dir `os.path.expanduser("~/.claude/security")` and filename template.  `session_state.py:39` `session_state.py:40`

### TC-05 — Lock file path shares stem, uses `.lock`
- **Given** env `SECURITY_WARNINGS_STATE_DIR="/tmp/x"` and `session_id="s1"`.
- **When** `get_lock_file("s1")` is called.
- **Then** it returns `/tmp/x/security_warnings_state_s1.lock`.
- Locks: `.lock` filename template.  `session_state.py:46`

### TC-06 — `load_state` wraps a JSON list into `shown_warnings`
- **Given** the state file contains a JSON array `["w1", "w2"]`.
- **When** `load_state(session_id)` is called.
- **Then** it returns `{"shown_warnings": ["w1", "w2"]}`.
- Locks: `if isinstance(data, list): return {"shown_warnings": data}`  `session_state.py:94`

### TC-07 — `load_state` defaults `shown_warnings` on a dict missing it
- **Given** the state file contains `{"other": 1}`.
- **When** `load_state(session_id)` is called.
- **Then** it returns `{"other": 1, "shown_warnings": []}`.
- Locks: `data.setdefault("shown_warnings", [])`  `session_state.py:97`

### TC-08 — `load_state` returns empty default on missing/corrupt file
- **Given** the state file does not exist, OR contains invalid JSON.
- **When** `load_state(session_id)` is called.
- **Then** it returns `{"shown_warnings": []}` and does not raise.
- Locks: `except (json.JSONDecodeError, IOError, KeyError, TypeError): pass` → `return {"shown_warnings": []}`  `session_state.py:99` `session_state.py:101`

### TC-09 — `load_state` on a non-list/non-dict JSON returns the empty default
- **Given** the state file contains a bare JSON scalar (e.g. `42` or `"hi"`).
- **When** `load_state(session_id)` is called.
- **Then** neither `isinstance` branch matches, so it returns `{"shown_warnings": []}`.
- Locks: only `list`/`dict` branches return early; fallthrough returns default.  `session_state.py:94` `session_state.py:96` `session_state.py:101`

### TC-10 — `save_state` creates the parent directory then writes JSON
- **Given** a `state_dir` that does not yet exist and a writable parent.
- **When** `save_state(session_id, {"shown_warnings": ["a"]})` is called.
- **Then** the directory is created and the file contains `{"shown_warnings": ["a"]}`.
- Locks: `os.makedirs(state_dir, exist_ok=True)` then `json.dump(state, f)`.  `session_state.py:110` `session_state.py:113`

### TC-11 — `save_state` swallows write failure (no raise)
- **Given** a `state_dir` whose file cannot be written (e.g. read-only path) so `open`/`json.dump` raises `OSError`.
- **When** `save_state(session_id, state)` is called.
- **Then** no exception propagates; `debug_log` is invoked once with the failure message.
- Locks: `except (IOError, OSError) as e: debug_log(...)`  `session_state.py:114`

### TC-12 — `with_locked_state` returns the callback's value and persists mutations
- **Given** a working state dir and a `callback` that appends `"x"` to `state["shown_warnings"]` and returns `"done"`.
- **When** `with_locked_state(session_id, callback)` is called.
- **Then** it returns `"done"`, and a subsequent `load_state(session_id)` shows `"x"` in `shown_warnings`.
- Locks: `result = callback(state)` → `save_state(...)` → `return result`.  `session_state.py:146` `session_state.py:147` `session_state.py:148`

### TC-13 — `with_locked_state` runs without locking when `fcntl` is None
- **Given** `session_state.fcntl` is `None` (Windows path simulated).
- **When** `with_locked_state(session_id, callback)` is called.
- **Then** it still does load → callback → save → return result, without opening any lock fd.
- Locks: `if fcntl is None:` no-lock branch.  `session_state.py:133`

### TC-14 — `with_locked_state` returns None on a lock/state OSError
- **Given** `fcntl` present but `os.open(lock_file, ...)` raises `OSError`.
- **When** `with_locked_state(session_id, callback)` is called.
- **Then** it returns `None` (callback not run) and logs via `debug_log`.
- Locks: `except (OSError, IOError) as e: debug_log(...); return None`.  `session_state.py:150` `session_state.py:152`

### TC-15 — `cleanup_old_state_files` no-ops when state dir is absent
- **Given** `SECURITY_WARNINGS_STATE_DIR` points to a non-existent directory.
- **When** `cleanup_old_state_files()` is called.
- **Then** it returns early without error and deletes nothing.
- Locks: `if not os.path.exists(state_dir): return`.  `session_state.py:53`

### TC-16 — `cleanup_old_state_files` deletes only matching files older than 30 days
- **Given** in the state dir: (a) `security_warnings_state_x.json` with mtime 40 days ago, (b) `security_warnings_state_y.lock` with mtime 40 days ago, (c) `security_warnings_state_z.json` with mtime today, (d) `unrelated.txt` 40 days ago.
- **When** `cleanup_old_state_files()` is called.
- **Then** (a) and (b) are removed; (c) is kept (too recent); (d) is kept (name doesn't match prefix).
- Locks: name filter + 30-day mtime gate + `os.remove`.  `session_state.py:57` `session_state.py:60` `session_state.py:66` `session_state.py:67`

### TC-17 — Legacy sweep removes only `.lock` files at `~/.claude` root
- **Given** in `~/.claude`: `security_warnings_state_a.lock` (40 days old) and `security_warnings_state_a.json` (40 days old).
- **When** `cleanup_old_state_files()` is called.
- **Then** the `.lock` is removed but the `.json` at the legacy root is left untouched.
- Locks: legacy loop condition tests only `.endswith(".lock")`.  `session_state.py:77` `session_state.py:81`

---

## Omitted (depend on an external / OS contract — not asserted)
- True cross-**process** mutual exclusion of `fcntl.flock(LOCK_EX)` (`session_state.py:143`): the exclusion guarantee is an OS/kernel contract, not something this file can characterize deterministically in a single-process unit test. TC-12/13 only lock the observable in-process flow.
- The content/format emitted by `debug_log` (`session_state.py:22`): defined in `_base`, an external contract.
