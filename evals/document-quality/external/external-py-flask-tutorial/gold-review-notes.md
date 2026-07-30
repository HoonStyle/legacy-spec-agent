# Gold annotation review notes — external-py-flask-tutorial

Author: independent gold-annotation pass over pinned source only. No extractor,
connector, MCP tool, other evaluation case's gold, or generated document was consulted
while authoring the annotations.

## Scope read

Every file in the included scope was readable and was read:

- `examples/tutorial/flaskr/__init__.py`
- `examples/tutorial/flaskr/auth.py`
- `examples/tutorial/flaskr/blog.py`
- `examples/tutorial/flaskr/db.py`
- `examples/tutorial/flaskr/schema.sql`
- `examples/tutorial/flaskr/static/style.css`
- `examples/tutorial/flaskr/templates/base.html`
- `examples/tutorial/flaskr/templates/auth/login.html`
- `examples/tutorial/flaskr/templates/auth/register.html`
- `examples/tutorial/flaskr/templates/blog/create.html`
- `examples/tutorial/flaskr/templates/blog/index.html`
- `examples/tutorial/flaskr/templates/blog/update.html`
- `examples/tutorial/tests/conftest.py`
- `examples/tutorial/tests/data.sql`
- `examples/tutorial/tests/test_auth.py`
- `examples/tutorial/tests/test_blog.py`
- `examples/tutorial/tests/test_db.py`
- `examples/tutorial/tests/test_factory.py`
- `examples/tutorial/pyproject.toml`
- `examples/tutorial/README.rst`

## Files that could not be read

None.

## Searched-but-absent patterns

No coverage category was completely absent. Each of `registered_api`,
`data_contract`, `environment`, `entrypoint`, `status_value`, `test_file`,
`external_side_effect`, `external_integration`, and `business_rule` had at least one
in-scope instance in the original draft. Narrower absent patterns were:

- **Console-script or packaging entrypoints.** `pyproject.toml` has no
  `[project.scripts]` or `entry_points`. The Flask application factory and registered
  `init-db` Click command are the only code-owned entrypoints. Commands shown in the
  README use the standard Flask CLI and are not additional registrations by this code.
- **Non-SQLite external services.** The Python files contain no HTTP client, queue,
  email, cache, socket, or cloud-service integration. The scoped integrations are
  Flask, Werkzeug security, built-in SQLite, Jinja rendering, Click, and pytest.
- **Additional tables.** `schema.sql` defines exactly `user` and `post`.
  `tests/data.sql` contains fixture inserts but no additional schema.
- **Additional configuration keys.** No keys beyond `SECRET_KEY`, `DATABASE`, and
  test-only `TESTING` are set or read in scope. In particular, no `DEBUG`,
  `SESSION_COOKIE_*`, or `SQLALCHEMY_*` setting is present.
- **Static asset surfaces.** `flaskr/static/style.css` is purely presentational and
  contributes no API, data, configuration, or business-rule row.
- **Independent `tests/data.sql` surface.** The file supports the fixture-loading
  side effect represented by `EXT2-052`; it is fixture data, not a test module or a
  separate data contract.

## Original judgment calls

The original source-only draft contained 73 rows and raised these points for review:

1. `EXT2-002` represented `app.add_url_rule("/", endpoint="index")` as a registered
   API even though it only aliases the endpoint name for the existing blog index URL.
2. `EXT2-023`, `EXT2-024`, `EXT2-025`, `EXT2-026`, `EXT2-030`, `EXT2-031`, and
   `EXT2-032` represented recurring request-method and local error branches as separate
   status values.
3. `EXT2-061` used one representative decorator application for the conceptual rule
   that all three write routes require login.
4. `EXT2-033` treated the never-overridden `check_author=True` default as a critical
   status value rather than part of the author-only rule.
5. `EXT2-072` and `EXT2-073` treated template visibility conditions as normal
   business rules even though they do not enforce authorization server-side.
6. `EXT2-016` treated the joined post-with-author query result as a derived data
   contract distinct from the underlying `post` table.
7. Some source lines intentionally supported different categories. For example,
   password hashing is both a Werkzeug integration and a password-storage rule. Such
   rows are not duplicates when they represent distinct documentation surfaces.

No row was promoted from detector or extractor output. Every original `found_at` was
checked by reading the pinned source.

## Integrated review decisions (2026-07-30)

The integrated review in `docs/external-gold-review-summary.md` was applied to the
draft. Sixteen rows were removed from the original 73, leaving **57 rows**. Existing
IDs were not renumbered.

### Removed rows

- `EXT2-002`: `add_url_rule("/", endpoint="index")` is an endpoint-name alias, not a
  new behavior in addition to `GET /`.
- `EXT2-003`–`EXT2-006`: Blueprint construction and registration are evidence of route
  wiring, not independent endpoints.
- `EXT2-023`–`EXT2-026` and `EXT2-029`–`EXT2-032`: request method, local error, and
  `test_config` branches are control flow, not stable status values.
- `EXT2-033`: `check_author=True` is part of the author-only rule represented by
  `EXT2-062`, not a separate status value.
- `EXT2-034`: the missing-post branch duplicates the 404 business rule in `EXT2-068`.
- `EXT2-060`: `werkzeug.exceptions.abort` is a framework helper, not an independent
  runtime external integration.

### Corrected retained rows

- `EXT2-016`: `post_with_author` is explicitly described as a **blog index row
  projection**, not a class.
- `EXT2-017`–`EXT2-020`: `SECRET_KEY`, `DATABASE`, optional `config.py`, and `TESTING`
  are labeled Flask application/test configuration rather than OS environment
  variables.
- `EXT2-027` and `EXT2-028`: the surfaces name anonymous-request and absent-session-user
  authentication states instead of merely repeating their conditional expressions.
- `EXT2-050`–`EXT2-052`: temporary database creation, deletion, and fixture loading are
  labeled test-only side effects so they are not confused with production behavior.
- `EXT2-072` and `EXT2-073`: the template conditions are labeled UI visibility rules,
  not server-side authorization enforcement.

### Evidence retained in these notes

- `EXT2-061` remains one business rule rather than three route-specific rows. The
  decorator implementation is at `examples/tutorial/flaskr/auth.py:19-29`; its
  applications are create at `examples/tutorial/flaskr/blog.py:61`, update at line
  87, and delete at line 114.
- `EXT2-062` combines the default `check_author=True` at
  `examples/tutorial/flaskr/blog.py:28`, the 403 guard at line 54, and the update and
  delete calls to `get_post` at lines 90 and 121.
- Shared source lines may continue to support two rows only when the rows express
  different categories and documentation obligations, such as a security-library
  integration and the business rule it implements.

## Freeze status

`human_review_pending`. The corrected 57-row draft is preserved as
`gold-surfaces.jsonl`, but it is **not frozen or approved**. It must not be used for
extractor or Mode A execution until an independent human approves it from source and
its SHA-256 is recorded in `gold-digest.txt`.
