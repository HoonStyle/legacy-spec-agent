# Evidence audit notes — external-py-flask-tutorial

Actor: `auditor-ext2` (Independent Evidence Auditor). Two rounds recorded below.

## Round 1 — draft digest `1fe477e7e82d03cd27de041d127684f04e96f0a32e663f0854e9b56b0d5c289d` — verdict: failed

### Method

1. Read all nine in-scope Python sources in full from the pinned clone at `/home/user/legacy-spec-agent/.external-sources/flask/examples/tutorial/`: `flaskr/__init__.py` (48 lines), `flaskr/auth.py` (116), `flaskr/blog.py` (125), `flaskr/db.py` (56), `tests/conftest.py` (62), `tests/test_auth.py` (69), `tests/test_blog.py` (83), `tests/test_db.py` (29), `tests/test_factory.py` (12).
2. Wrote a Python extraction script (regex over backtick spans matching `path:line` / `path:start-end` with a citable extension) that scanned all seven staged Markdown files line by line, pulled out every `(CLM id, citation text, full markdown line)` tuple, and resolved each citation against the actual source file content so the asserted line range and its real text sat side by side for direct comparison.
3. Judged every one of the 132 tuples by hand against the source I had already read, checking whether the cited range fully substantiates everything asserted on that line — not just the general topic, but each specific sub-fact (a named behavior, a second location, an enumerated outcome).
4. Wrote a second script that emitted `staging/audit_log.jsonl` from my per-claim decisions, defaulting to `verified` and marking 14 rows `flagged`.

### Structural checks (all clean)

- Exactly 132 lines carried a CLM tag across the 7 files; every line had exactly one CLM tag and exactly one citation (no untagged citations, no double-tagged lines, no two citations sharing one CLM).
- CLM IDs 001–132 were each used exactly once; none skipped, none duplicated.
- Every cited path resolved inside the pinned clone and every cited line/range existed within the file's real line count.
- No claim presented as verified rested only on a non-citable file; every schema-only/config-only fact was routed to a `UV-00x` Unverified entry instead.

### Flagged claims (14) — the round-1 rejection reason

All 14 followed one of two patterns: (a) a compound claim naming two or more specific facts/locations where the single citation demonstrably covered only one, with the other fact's real code at a distinct, never-cited line elsewhere in the same file; or (b) a citation pointing at the wrong function/line entirely.

1. **CLM-018** (SPEC.md, `BR-006`) — "required on both create and update" cited only `blog.py:69-70` (create's check); update's identical check at `blog.py:97-98` was never cited.
2. **CLM-023** (SPEC.md) — "flashes an error message and re-renders the form" cited `auth.py:59-62`, which only sets the error string; `flash(error)` (79) and `render_template` (81) were outside the range.
3. **CLM-024** (SPEC.md) — "flashed as an error" cited `auth.py:71-74` (sets the string only); `flash(error)` (79) was outside the range.
4. **CLM-025** (SPEC.md) — "flashed as a distinct error message" cited `auth.py:96-99` (sets the strings only); `flash(error)` (107) was outside the range.
5. **CLM-030** (SPEC.md) — "guarded by a non-empty title" cited `blog.py:76-80` (insert+commit only); the title guard (`69-70`) was outside the range.
6. **CLM-031** (SPEC.md) — "guarded by author match and a non-empty title" cited `blog.py:103-107` (update+commit only); the author-match call (`90`) and title guard (`97-98`) were outside the range.
7. **CLM-032** (SPEC.md) — "guarded by author match" cited `blog.py:122-124` (db-open/delete/commit only); the author-match check inside `get_post(id)` (`121`) was one line above the cited range.
8. **CLM-043** (ARCHITECTURE.md) — "reads and writes a local SQLite database file" cited only `blog.py:25` (the render_template return); the SELECT (`20-24`) was excluded and no write was shown by this line at all.
9. **CLM-054** (ARCHITECTURE.md) — named flask, werkzeug, click, sqlite3, and pytest as unresolved edges but cited only `auth.py:1-12` (flask/werkzeug only); click/sqlite3 (`db.py:1-4`) and pytest (test files) were uncited.
10. **CLM-056** (ARCHITECTURE.md) — "populating g.user from the session" cited `auth.py:32-33` (decorator + signature only); the body that reads `session.get` and sets `g.user` (`36-43`) was outside the range.
11. **CLM-058** (ARCHITECTURE.md) — described a flow for "update/delete" but cited `blog.py:86-110`, which is `update()` only; `delete()` (`113-125`) was never in range, and the described validate-input step is factually wrong for `delete()`.
12. **CLM-096** (DATA_MODEL.md) — "never set from a request field" cited `blog.py:21-23` (index's SELECT, shows `created` read/displayed only); the INSERT that omits `created` (`76-78`) was outside the range.
13. **CLM-113** (TESTCASES.md) — "form data with title and body" cited `test_blog.py:19`, the parametrize decorator for `test_login_required`, whose body sends no form data at all; the real form-data case is `test_create`/`test_update` (e.g. line 49), never cited.
14. **CLM-114** (TESTCASES.md) — "403 ..., 404 ..., redirect to the index on success" cited `test_blog.py:34-35`, only the two 403 assertions; the 404 case (`43`) and the redirect-on-success case (e.g. `78`) were never cited.

### Additional round-1 observations

- No cited range was absent from the source, and no line had zero/multiple CLM tags or zero/multiple citations — the draft was clean on citation mechanics; the 14 defects were citation-scope/accuracy problems, not formatting problems.
- The recurring shape (a citation proving the "primary" clause of a compound sentence but omitting a named second clause/location) concentrated in SPEC.md's "Validation and error behavior"/"State transitions" blocks and compound "X/Y" claims in ARCHITECTURE.md and TESTCASES.md — a correctable citation-widening fix, not fabrication.

## Round 2 (re-check) — draft digest `12fb130a864069a0ca1619f44464db03160c7e542cdc0f7b380ea62234aa7da4` — verdict: passed

### What the Writer changed

The Writer corrected all 14 flagged claims and added 8 new split-continuation claims (CLM-133..CLM-140), for 140 total claims. Ten of the fourteen corrections widened or moved the citation range; four (CLM-018, CLM-054, CLM-058, CLM-096, CLM-113, CLM-114 — the narrowed set) kept the original citation but narrowed the asserted text, moving the dropped fact to a new sibling claim with its own citation.

### Per-correction re-verification (against source, not the Writer's report)

1. **CLM-018** — text narrowed to "required on create" only, citation unchanged `blog.py:69-70` (`if not title: error = "Title is required."` — create's guard). Matches. **Verified.**
   **CLM-133 (new)** — "same title requirement applies on update" cites `blog.py:97-98`, which is update()'s identical `if not title: error = "Title is required."`. Matches. **Verified.**
2. **CLM-023** — widened to `auth.py:59-81`. Range now contains the missing-field checks (59-62), `flash(error)` (79), and the `render_template` return (81), and the redirect-on-success path is a distinct `else` branch so "without redirecting" for this case still holds. **Verified.**
3. **CLM-024** — widened to `auth.py:71-79`. Range now contains the `except db.IntegrityError` block (71-74) and `flash(error)` (79). **Verified.**
4. **CLM-025** — widened to `auth.py:96-107`. Range now contains both error strings (97, 99) and `flash(error)` (107). **Verified.**
5. **CLM-030** — widened to `blog.py:69-80`. Range now contains the title guard (69-70), the INSERT (76-79) and the commit (80). **Verified.**
6. **CLM-031** — widened to `blog.py:90-107`. Range now contains `get_post(id)` (90, the author-match guard under the default `check_author=True`), the title guard (97-98), the UPDATE statement (104-106) and commit (107). **Verified.**
7. **CLM-032** — widened to `blog.py:121-124`. Range now contains `get_post(id)` (121, author-match guard), the DELETE (123) and commit (124). **Verified.**
8. **CLM-043** — narrowed (dropped "writes"), citation moved to `blog.py:19-25`. Range now contains the SELECT (20-24) and the `render_template` return (25); the sentence no longer claims a write inside this citation, and a "separate write paths ... in SPEC.md" pointer was added. **Verified.**
9. **CLM-054** — narrowed to flask/werkzeug only, citation unchanged `auth.py:1-12` (imports flask.* and werkzeug.security.*). **Verified.**
   **CLM-134 (new)** — click/sqlite3 cites `db.py:1-4` (`import sqlite3` / `import click`). **Verified.**
   **CLM-135 (new)** — pytest cites `tests/test_auth.py:1` (`import pytest`). **Verified.**
10. **CLM-056** — widened to `auth.py:32-43`. Range now contains the `@bp.before_app_request` decorator (32) and the full body that reads `session.get("user_id")` and sets `g.user` (36-43). **Verified.**
11. **CLM-058** — narrowed to "(update)" only, citation unchanged `blog.py:86-110`, which is exactly the `update()` function (resolve/authorize via `get_post`, validate title, write+commit, redirect). No longer claims anything about `delete()`. **Verified.**
    **CLM-136 (new)** — delete flow cites `blog.py:113-125`, exactly `delete()` (resolve/authorize via `get_post`, no validation step, delete+commit, redirect). Matches the "no input-validation step" claim — `delete()` reads no form fields. **Verified.**
12. **CLM-096** — narrowed to "read and displayed", citation unchanged `blog.py:21-23` (the SELECT listing `created` and the `ORDER BY created DESC` clause). Consistent with the round-1 judgment that this citation supports the read/display fact (round 1 did not flag this half of the sentence, only the "never set" half). **Verified.**
    **CLM-137 (new)** — "not among the columns the create-post insert accepts ... populated by the database itself" cites `blog.py:76-78`, the INSERT's column list `(title, body, author_id)` — `created` is absent, confirming the assertion; the default-value mechanism is correctly hedged to the non-citable `schema.sql` via UV-001. **Verified.**
13. **CLM-113** — narrowed to "without form data", citation unchanged `test_blog.py:19` (the `@pytest.mark.parametrize` line for `test_login_required`, whose body `client.post(path)` has no `data=` kwarg). **Verified.**
    **CLM-138 (new)** — form-data case cites `test_blog.py:49` (`client.post("/create", data={"title": "created", "body": ""})`). **Verified.**
14. **CLM-114** — narrowed to the 403 case only, citation unchanged `test_blog.py:34-35` (the two `status_code == 403` assertions in `test_author_required`). **Verified.**
    **CLM-139 (new)** — 404 case cites `test_blog.py:43` (`assert client.post(path).status_code == 404` in `test_exists_required`). **Verified.**
    **CLM-140 (new)** — redirect case cites `test_blog.py:78` (`assert response.headers["Location"] == "/"` in `test_delete`). **Verified.**

No correction still overreaches; none were re-flagged.

### Drift check

Re-extracted all (CLM id, citation, document) tuples from the round-2 draft with the same script-based method and diffed every one of the 118 claims the Writer did not touch (all IDs except the 14 corrected and 8 new) against my round-1 audit log. Result: **zero differences** — every untouched claim carries the exact same citation string it had in round 1 (document and path:line/range identical). No unexpected drift anywhere in the draft.

### Structural re-checks (round 2, all clean)

- 140 unique CLM tags used, IDs 001–140, sequential, none skipped, none duplicated.
- Every markdown line carries at most one CLM tag and one citation; no line has two CLM tags or two citations.
- All 22 touched claims (14 corrected + 8 new) resolve to real files inside the pinned clone, and every cited line/range exists within that file's real line count.
- No new claim relies on a non-citable file while presented as verified; the two new claims that touch schema-only facts (CLM-137) correctly retain the UV-001 hedge for the part that is not citable in `.py` source.

### Round 2 verdict

**140/140 verified, 0 flagged. Verdict: passed.**

Frozen draft digest for this round: `12fb130a864069a0ca1619f44464db03160c7e542cdc0f7b380ea62234aa7da4`.
