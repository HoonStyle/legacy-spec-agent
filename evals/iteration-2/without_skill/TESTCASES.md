# Test Cases — `session_state.py`

Recommended fixtures: `monkeypatch.setenv`, `tmp_path` for `SECURITY_WARNINGS_STATE_DIR`, and monkeypatching `_base.debug_log` to capture log calls. All tests should set `SECURITY_WARNINGS_STATE_DIR` to a temp dir to avoid touching `~/.claude`.

## `_state_key`

| ID | Setup | Input | Expected |
|---|---|---|---|
| SK-01 | No `CLAUDE_CODE_REMOTE_SESSION_ID` | `session_id="abc-123"` | Returns `"abc-123"` (UUID chars unchanged). |
| SK-02 | `CLAUDE_CODE_REMOTE_SESSION_ID="remote-9"` | `session_id="local-1"` | Returns `"remote-9"` (remote wins). |
| SK-03 | Empty `CLAUDE_CODE_REMOTE_SESSION_ID=""` | `session_id="local-1"` | Returns `"local-1"` (empty falls through to `or`). |
| SK-04 | — | `session_id="../../etc/passwd"` | Slashes/dots-that-escape replaced with `_`; result contains no `/`. |
| SK-05 | — | `session_id="a/b\\c d:e"` | Each disallowed char → `_` → `"a_b_c_d_e"`. |
| SK-06 | — | `session_id` = 200-char string | Result length == 128. |
| SK-07 | — | `session_id=12345` (int) | Coerced via `str()`, returns `"12345"`. |

## `get_state_file` / `get_lock_file`

| ID | Setup | Expected |
|---|---|---|
| GF-01 | `SECURITY_WARNINGS_STATE_DIR=/tmp/x` | State path == `/tmp/x/security_warnings_state_<key>.json`. |
| GF-02 | Env var unset | Path under `~/.claude/security/`. |
| GF-03 | Same session_id | State and lock paths share the same `<key>` and differ only by `.json` vs `.lock`. |
| GF-04 | — | Neither call creates any file or directory on disk. |

## `load_state`

| ID | File content | Expected |
|---|---|---|
| LS-01 | File absent | `{"shown_warnings": []}`. |
| LS-02 | `["w1","w2"]` (JSON list) | `{"shown_warnings": ["w1","w2"]}`. |
| LS-03 | `{"shown_warnings":["w1"],"touched_paths":["p"]}` | Returned unchanged (both keys present). |
| LS-04 | `{"touched_paths":["p"]}` (dict, no shown_warnings) | `shown_warnings` defaulted to `[]`, other keys kept. |
| LS-05 | `not valid json{` | `{"shown_warnings": []}` (JSONDecodeError swallowed). |
| LS-06 | `42` (JSON number, not list/dict) | Falls through both isinstance checks → `{"shown_warnings": []}`. |
| LS-07 | File exists but unreadable (perm denied) | `{"shown_warnings": []}` (IOError swallowed). |

## `save_state`

| ID | Setup | Expected |
|---|---|---|
| SV-01 | State dir does not yet exist | Dir is created; file written; `load_state` round-trips the dict. |
| SV-02 | `state={"shown_warnings":["a"],"n":1}` | On-disk JSON parses back to the identical dict. |
| SV-03 | Dir path unwritable | No raise; `debug_log` called once with a "Failed to save" message. |
| SV-04 | `state` contains non-serializable object | `json.dump` raises `TypeError` — NOTE: not in the caught tuple, so it propagates (see RISKS). Document actual behavior. |

## `with_locked_state`

| ID | Setup | Expected |
|---|---|---|
| WL-01 | Empty state, callback appends to `shown_warnings` and returns `"ok"` | Returns `"ok"`; reloading shows the appended value persisted. |
| WL-02 | `fcntl` monkeypatched to `None` | Runs load→callback→save without locking; still persists and returns callback value. |
| WL-03 | Callback raises inside lock | Exception propagates? No — only `OSError`/`IOError` are caught; a `ValueError` from callback propagates. Lock is still released/closed via `finally`. Verify lock fd closed. |
| WL-04 | `os.open` raises `OSError` | Returns `None`; `debug_log` called. |
| WL-05 | Two threads/processes call concurrently with increment callback | Final count == number of callers (no lost updates); serialized by lock. |
| WL-06 | Normal path | After return, lock file fd is closed and unlocked (no fd leak — inspect `finally`). |

## `cleanup_old_state_files`

| ID | Setup | Expected |
|---|---|---|
| CU-01 | State dir absent | Returns immediately, no error. |
| CU-02 | Fresh `.json` (mtime now) + old `.json` (mtime 31d ago) | Only the old file removed. |
| CU-03 | Old `.lock` (31d) in state dir | Removed. |
| CU-04 | Unrelated file `notes.txt` old | Not touched (prefix/suffix filter). |
| CU-05 | File matching prefix but ext `.tmp` | Not removed (only `.json`/`.lock`). |
| CU-06 | Old legacy `.lock` at `~/.claude/` root | Removed (scope-2 sweep). |
| CU-07 | Fresh legacy `.lock` (< 30d) at `~/.claude/` root | Kept (avoids racing active lock). |
| CU-08 | `~/.claude` dir absent | Inner `os.listdir` raises → swallowed by top-level `except Exception`; no crash. |
| CU-09 | A file removed by another process mid-loop (getmtime raises) | Per-file try/except swallows; loop continues. |

## Integration / Property

| ID | Scenario | Expected |
|---|---|---|
| INT-01 | `save_state` then `load_state` for arbitrary dict with `shown_warnings` | Round-trip equality. |
| INT-02 | `with_locked_state` used to mutate, then independent `load_state` | Sees the mutation. |
| INT-03 | Import module | No files created, no env var required (side-effect-free import). |
