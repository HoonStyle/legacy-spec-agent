# Coverage Sentinel notes — external-py-flask-tutorial

actor_id: sentinel-ext2
Draft digest verified against: `12fb130a864069a0ca1619f44464db03160c7e542cdc0f7b380ea62234aa7da4`
Frozen draft (read-only): `staging/{SPEC,ARCHITECTURE,INTERFACES,DATA_MODEL,ONBOARDING,TESTCASES,RISKS}.md`
Source walked (read-only): `.external-sources/flask/examples/tutorial/{flaskr/**,tests/**,pyproject.toml,README.rst}`
Detector output: `raw-extractor-output.json` (19 surfaces: 8 `registered_api`, 6 `external_side_effect`, 5 `test_file`)

## Method

1. Read `raw-extractor-output.json` in full and extracted the exact `surface` and `found_at` strings verbatim (no paraphrase, no re-deriving line numbers).
2. Read every staging document in full.
3. For each of the 19 detector surfaces, located the candidate typed heading in the draft, read the section body (heading text to next `####`/`##` heading), and confirmed the literal `found_at` string appears wrapped in single backticks somewhere in that body. This was done by direct text inspection, not by assuming the mapping from claim numbering.
4. Independently re-read the five in-scope Python source files (`flaskr/__init__.py`, `flaskr/auth.py`, `flaskr/blog.py`, `flaskr/db.py`) and all five test files plus `schema.sql`, `pyproject.toml`, to build my own list of documentable surfaces (routes, tables/columns, config keys, decorators, hooks, CLI registrations, mutations, non-commit side effects), independent of the detector's vocabulary.
5. Cross-checked each of my independently-found surfaces against the draft (grep + manual read) to mark documented/not-documented.

## Part A — per-surface verification (all 19 detector surfaces)

| # | surface | found_at | expected_type | heading found | body contains found_at in backticks? |
|---|---|---|---|---|---|
| 1 | registered_api:/hello | examples/tutorial/flaskr/__init__.py:26 | API | API-HELLO | yes — "Signature: hello() (CLM-062: \`...__init__.py:26\`)." |
| 2 | registered_api:/logout | examples/tutorial/flaskr/auth.py:112 | API | API-AUTH-LOGOUT | yes — "Signature: logout() (CLM-073: \`...auth.py:112\`)." |
| 3 | registered_api:/register | examples/tutorial/flaskr/auth.py:46 | API | API-AUTH-REGISTER | yes — "Signature: register() (CLM-066: \`...auth.py:46\`)." |
| 4 | external_side_effect:db.commit() | examples/tutorial/flaskr/auth.py:70 | RSK | RSK-COMMIT-AUTH-REGISTER | yes — "Evidence: \`...auth.py:70\` (CLM-121)." |
| 5 | registered_api:/login | examples/tutorial/flaskr/auth.py:84 | API | API-AUTH-LOGIN | yes — "Signature: login() (CLM-070: \`...auth.py:84\`)." |
| 6 | external_side_effect:db.commit() | examples/tutorial/flaskr/blog.py:107 | RSK | RSK-COMMIT-BLOG-UPDATE | yes — "Evidence: \`...blog.py:107\` (CLM-123)." |
| 7 | registered_api:/<int:id>/delete | examples/tutorial/flaskr/blog.py:113 | API | API-BLOG-DELETE | yes — "Signature: delete(id) (CLM-085: \`...blog.py:113\`)." |
| 8 | external_side_effect:db.commit() | examples/tutorial/flaskr/blog.py:124 | RSK | RSK-COMMIT-BLOG-DELETE | yes — "Evidence: \`...blog.py:124\` (CLM-124)." |
| 9 | registered_api:/ | examples/tutorial/flaskr/blog.py:16 | API | API-BLOG-INDEX | yes — "Signature: index() (CLM-064: \`...blog.py:16\`)." |
| 10 | registered_api:/create | examples/tutorial/flaskr/blog.py:60 | API | API-BLOG-CREATE | yes — "Signature: create() (CLM-076: \`...blog.py:60\`)." |
| 11 | external_side_effect:db.commit() | examples/tutorial/flaskr/blog.py:80 | RSK | RSK-COMMIT-BLOG-CREATE | yes — "Evidence: \`...blog.py:80\` (CLM-122)." |
| 12 | registered_api:/<int:id>/update | examples/tutorial/flaskr/blog.py:86 | API | API-BLOG-UPDATE | yes — "Signature: update(id) (CLM-080: \`...blog.py:86\`)." |
| 13 | test_file:.../conftest.py | examples/tutorial/tests/conftest.py:1 | TC | TC-FILE-CONFTEST | yes — "(CLM-106: \`...conftest.py:1\`)." |
| 14 | external_side_effect:os.unlink(db_path) | examples/tutorial/tests/conftest.py:32 | RSK | RSK-TEST-DB-UNLINK | yes — "Evidence: \`...conftest.py:32\` (CLM-125)." |
| 15 | test_file:.../test_auth.py | examples/tutorial/tests/test_auth.py:1 | TC | TC-FILE-TEST-AUTH | yes — "(CLM-109: \`...test_auth.py:1\`)." |
| 16 | test_file:.../test_blog.py | examples/tutorial/tests/test_blog.py:1 | TC | TC-FILE-TEST-BLOG | yes — "(CLM-112: \`...test_blog.py:1\`)." |
| 17 | external_side_effect:db.commit() | examples/tutorial/tests/test_blog.py:30 | RSK | RSK-TEST-COMMIT-AUTHOR | yes — "Evidence: \`...test_blog.py:30\` (CLM-127)." |
| 18 | test_file:.../test_db.py | examples/tutorial/tests/test_db.py:1 | TC | TC-FILE-TEST-DB | yes — "(CLM-115: \`...test_db.py:1\`)." |
| 19 | test_file:.../test_factory.py | examples/tutorial/tests/test_factory.py:1 | TC | TC-FILE-TEST-FACTORY | yes — "(CLM-117: \`...test_factory.py:1\`)." |

Result: 19/19 pass, no unexplained omissions, no truncated inputs. `verdict: passed`.

## Part B — independent reverse audit against real code surfaces

### B1. Flask routes with methods (8/8 documented)

| Route | Methods | Documented? |
|---|---|---|
| `/hello` | GET | API-HELLO |
| `/` (blog index) | GET | API-BLOG-INDEX |
| `/auth/register` | GET, POST | API-AUTH-REGISTER |
| `/auth/login` | GET, POST | API-AUTH-LOGIN |
| `/auth/logout` | GET | API-AUTH-LOGOUT |
| `/create` | GET, POST | API-BLOG-CREATE |
| `/<int:id>/update` | GET, POST | API-BLOG-UPDATE |
| `/<int:id>/delete` | POST | API-BLOG-DELETE |

All 8 documented with methods correctly reflected in the "Registered route" line of each `INTERFACES.md` entry.

### B2. `user` table and columns

Columns in source: `id`, `username`, `password` (schema.sql:7-11, used in auth.py:42,67-68,93). All three documented in **DM-001** (DATA_MODEL.md). Constraint details (UNIQUE, NOT NULL, AUTOINCREMENT) are only in the non-citable `schema.sql`; the draft correctly defers them to **UV-001/UV-004** rather than fabricating them. Documented / honestly caveated.

### B3. `post` table and columns

Columns in source: `id`, `author_id`, `created`, `title`, `body` (schema.sql:13-20). All five documented in **DM-002**. Foreign key and default-value mechanism correctly deferred to UV-001/UV-004. Documented / honestly caveated.

### B4. Flask config keys

| Key | Source | Documented? |
|---|---|---|
| `SECRET_KEY` | `__init__.py:11` | SPEC.md Configuration, DATA_MODEL.md config contracts |
| `DATABASE` | `__init__.py:13` | SPEC.md Configuration, DATA_MODEL.md config contracts |
| `TESTING` | passed via `test_config` | SPEC.md Configuration, DATA_MODEL.md config contracts |
| instance `config.py` (silent load) | `__init__.py:17-18` | SPEC.md CLM-036; ONBOARDING.md UV-007 (absence honestly marked Not found since the file itself is not present in scope) |

All four documented.

### B5. `create_app` factory and `init-db` CLI command

- `create_app` — documented as the WSGI entrypoint in SPEC.md ("Entrypoints"), ARCHITECTURE.md component inventory, and cross-referenced throughout. Documented.
- `init_db_command` (`init-db`) — documented in SPEC.md "Operational behavior" (CLM-042) and ONBOARDING.md "Grounded operational command" (CLM-105), and exercised by **TC-FILE-TEST-DB**. Documented.

### B6. Session state transitions and `g.user` loading

- Anonymous → authenticated / authenticated → anonymous transitions: documented in SPEC.md "State transitions" (CLM-028, CLM-029).
- `load_logged_in_user` (`@bp.before_app_request` hook, auth.py:32-43) populating `g.user`: documented in ARCHITECTURE.md "Major execution flows" (CLM-056) and referenced from BR-005/`login_required`. Documented.

### B7. Every database mutation and commit

| Site | Type | Documented? |
|---|---|---|
| auth.py:66-70 INSERT + commit (register) | mutation | API-AUTH-REGISTER, RSK-COMMIT-AUTH-REGISTER |
| blog.py:76-80 INSERT + commit (create) | mutation | API-BLOG-CREATE, RSK-COMMIT-BLOG-CREATE |
| blog.py:104-107 UPDATE + commit | mutation | API-BLOG-UPDATE, RSK-COMMIT-BLOG-UPDATE |
| blog.py:123-124 DELETE + commit | mutation | API-BLOG-DELETE, RSK-COMMIT-BLOG-DELETE |
| db.py:37-38 `executescript` (init_db, drop+recreate tables) | mutation, no literal `.commit()` | RSK-DB-INIT-SCRIPT (SPEC.md CLM-039) — detector missed this because it has no `db.commit()` token, but the draft documents it anyway, correctly flagged high-severity/destructive |
| conftest.py:26 `executescript` (seed test data) | mutation, no literal `.commit()` | TC-FILE-CONFTEST ("seed test rows") — documented generically, no dedicated RSK id, acceptable for a test fixture |
| test_blog.py:29 UPDATE + commit (author swap) | mutation | RSK-TEST-COMMIT-AUTHOR |

All real mutation/commit sites are documented, including two the detector's `db.commit()` literal-string match missed (`executescript` calls in `init_db` and in `conftest.py`).

### B8. `login_required` decorator and author-only authorization

- `login_required` (auth.py:19-29): documented as **BR-005** and named explicitly in ARCHITECTURE.md's component inventory (CLM-045).
- Author-only check in `get_post` (blog.py:54-55): documented as **BR-007**, referenced in every mutating blog `INTERFACES.md` entry's Errors field and in RISKS.md.

### B9. Password hashing/verification

- Hashing at registration (`generate_password_hash`, auth.py:68): **BR-003**.
- Verification at login (`check_password_hash`, auth.py:98): **BR-004**.
- The Werkzeug helpers themselves: ONBOARDING.md CLM-102.

### B10. Unique-username integrity handling

`db.IntegrityError` catch around the register insert (auth.py:71-74): documented as **BR-002** and additionally as a defect candidate, **RSK-INTEGRITY-ASSUMPTION**, which correctly notes the assumption that username is the only unique constraint cannot be fully confirmed without the non-citable `schema.sql`.

### B11. 403/404 aborts

`abort(404, ...)` and `abort(403)` in `get_post` (blog.py:51-55): documented as **BR-007** (403) and **BR-008** (404), and repeated in the Errors field of API-BLOG-UPDATE/API-BLOG-DELETE and in TESTCASES.md (TC-FILE-TEST-BLOG's 403/404 expected results).

### B12. Flash messaging

`flash(error)` calls in auth.py and blog.py: not given a dedicated typed heading, but substantively documented — every affected API entry's "Errors" field says "flashed validation message(s)" and SPEC.md's "Validation and error behavior" section itemizes each flash case with citations (CLM-023 through CLM-026). This is coverage-by-content, not an omission; flash messaging is not one of the detector's or the schema's typed categories (API/RSK/TC), so there is no dedicated ID to assign, but the behavior is not missing from the draft.

### B13. Every test module with what it covers (5/5)

| Module | Covers | Documented? |
|---|---|---|
| conftest.py | app/client/runner/auth fixtures, temp DB lifecycle | TC-FILE-CONFTEST |
| test_auth.py | register/login/logout, session state | TC-FILE-TEST-AUTH |
| test_blog.py | index, login-required, author-required, exists-required, create/update/delete, validation | TC-FILE-TEST-BLOG |
| test_db.py | connection reuse/close, init-db CLI | TC-FILE-TEST-DB |
| test_factory.py | create_app TESTING flag, /hello | TC-FILE-TEST-FACTORY |

All five documented with an accurate description of what each covers.

## Genuine documentation omissions found (not part of the 19-item schema, real gaps)

1. **`sqlite3.register_converter("timestamp", ...)` (db.py:48)** — a module-level side effect that registers a custom converter so SQLite `TIMESTAMP` columns (i.e. `post.created`) round-trip as Python `datetime` objects via `detect_types=sqlite3.PARSE_DECLTYPES`. Grepped the full staging set for "register_converter", "timestamp", and "PARSE_DECLTYPES" — zero matches anywhere in the draft. This is a real, citable code surface the detector did not find (no `registered_api`/`external_side_effect` vocabulary match) and the Writer also did not document, even though DM-002 discusses the `created` column and RSK-DB-CONNECT cites the same line range (db.py:15-16) for connection setup without mentioning the type-conversion registration. **Unexplained omission relative to the real source, not relative to the detector's 19-surface set.**

2. **`g.db.row_factory = sqlite3.Row` (db.py:18)** — minor implementation detail enabling dict-style column access (`post["title"]`, `user["password"]`) used throughout auth.py/blog.py. Not mentioned anywhere in the draft. Lower severity than #1 (it doesn't change persisted data or observable behavior beyond attribute-style row access), but still an undocumented, citable line.

Both are secondary/mechanism-level omissions, not missing business rules, routes, tables, or tests — every category explicitly listed in this task's Part B checklist (routes, tables, config, factory/CLI, session/`g.user`, mutations/commits, `login_required`/authorization, password hashing, integrity handling, 403/404, flash, tests) is fully documented. I did not find any omission at the level of a route, table, config key, business rule, or test module.

## Detector-denominator vs. real-surface-count difference

The detector's denominator is **19** (8 `registered_api` + 6 `external_side_effect` + 5 `test_file`), restricted to two literal `db.commit()`/`os.unlink(...)`-style patterns and route decorators.

My independent walk of the same in-scope tree counts substantially more real documentable surfaces, for example:
- 8 routes (same as detector),
- 2 persistent tables × 3 and 5 columns respectively (8 columns total),
- 4 config keys,
- 1 application factory + 1 CLI command + 1 before-request hook + 1 teardown-context registration,
- 10 business rules (BR-001..BR-010),
- 7 mutation/side-effect sites (the detector's 6, plus the `executescript` init-db call it misses because that call has no `.commit()` literal),
- 2 additional undocumented mechanism-level surfaces (`register_converter`, `row_factory`),
- 5 test modules (same as detector), each with several distinct test functions (e.g. test_blog.py alone has 8 test functions covering different rules).

So the real surface count is roughly 35-45+ distinct documentable facts depending on granularity, versus the detector's 19 — the detector undercounts by roughly half because its vocabulary only matches route decorators, the literal string `db.commit()`, `os.unlink(...)`, and file-level test module presence. It has no vocabulary for tables/columns, config keys, business-rule-level validation, authorization checks, password handling, CLI/hook registrations, or non-`.commit()` mutations like `executescript`. Despite that narrow detector vocabulary, the Writer's draft covers almost all of the broader real surface set (all routes, tables, config, rules, mutations, tests) except the two narrow mechanism-level omissions noted above.
