# SPEC.md — Flaskr (Flask Tutorial Application)

Analyzed source commit: 36e4a824f340fdee7ed50937ba8e7f6bc7d17f81
Generated at: 2026-07-30
Analyzed scope: examples/tutorial/flaskr/** (application package) and examples/tutorial/tests/** (pytest suite) in the pallets/flask repository. Excluded: everything else in the flask repository, plus examples/tutorial/.gitignore and examples/tutorial/LICENSE.txt.
Coverage: 9 Python files read in full and available for citation (flaskr/__init__.py, flaskr/auth.py, flaskr/blog.py, flaskr/db.py, tests/conftest.py, tests/test_auth.py, tests/test_blog.py, tests/test_db.py, tests/test_factory.py). flaskr/schema.sql, tests/data.sql, flaskr/templates/**/*.html, flaskr/static/style.css, pyproject.toml, and README.rst were read for context but are not citable extensions under this gate; facts grounded only in them appear under Unverified / Needs-review. Not truncated.

## System purpose and boundary
Flaskr is a small blog application built with Flask's application-factory pattern: create_app builds and configures a Flask instance, wires the database CLI command, and registers the auth and blog blueprints (CLM-001: `examples/tutorial/flaskr/__init__.py:6-40`).

The analyzed system boundary is the flaskr package and its tests suite; the surrounding Flask framework, the rest of the pallets/flask repository, and any WSGI host/deployment environment are outside scope.

## Actors and entrypoints
- Anonymous visitor — can view the blog index and the hello endpoint, and can register or log in.
- Authenticated user — additionally can create posts and edit/delete their own posts (CLM-002: `examples/tutorial/flaskr/blog.py:60-125`).
- CLI operator — runs the init-db Click command to (re)initialize the database (CLM-003: `examples/tutorial/flaskr/db.py:41-45`).

Entrypoints: the WSGI application factory create_app() (CLM-004: `examples/tutorial/flaskr/__init__.py:6`) and the eight registered HTTP routes documented under Core use cases and in INTERFACES.md.

## Core use cases
- View blog index — anyone can list all posts, most recent first (CLM-005: `examples/tutorial/flaskr/blog.py:16-25`).
- Say hello — a static greeting endpoint (CLM-006: `examples/tutorial/flaskr/__init__.py:26-28`).
- Register — create a new user account (CLM-007: `examples/tutorial/flaskr/auth.py:46-81`).
- Log in — authenticate and start a session (CLM-008: `examples/tutorial/flaskr/auth.py:84-109`).
- Log out — clear the session (CLM-009: `examples/tutorial/flaskr/auth.py:112-116`).
- Create post — an authenticated user publishes a new post (CLM-010: `examples/tutorial/flaskr/blog.py:60-83`).
- Update post — the author edits their own post (CLM-011: `examples/tutorial/flaskr/blog.py:86-110`).
- Delete post — the author deletes their own post (CLM-012: `examples/tutorial/flaskr/blog.py:113-125`).

## Business rules
- **BR-001** Registration requires a non-empty username and password (CLM-013: `examples/tutorial/flaskr/auth.py:59-62`).
- **BR-002** A duplicate username fails at the database insert and is reported as a validation error rather than a server error (CLM-014: `examples/tutorial/flaskr/auth.py:71-74`).
- **BR-003** Passwords are hashed before being stored; the plaintext password is never persisted (CLM-015: `examples/tutorial/flaskr/auth.py:68`).
- **BR-004** Login fails unless a user row exists for the username and its stored hash matches the submitted password (CLM-016: `examples/tutorial/flaskr/auth.py:96-99`).
- **BR-005** Views wrapped by login_required redirect an anonymous visitor to the login page instead of executing (CLM-017: `examples/tutorial/flaskr/auth.py:24-25`).
- **BR-006** A post's title is required on both create and update; the body has no such check (CLM-018: `examples/tutorial/flaskr/blog.py:69-70`).
- **BR-007** Only the post's author may update or delete it; any other authenticated user gets HTTP 403 (CLM-019: `examples/tutorial/flaskr/blog.py:54-55`).
- **BR-008** Requesting a post id that does not exist aborts with HTTP 404 before any author check (CLM-020: `examples/tutorial/flaskr/blog.py:51-52`).
- **BR-009** A successful login clears any prior session before storing the new user_id (CLM-021: `examples/tutorial/flaskr/auth.py:103-104`).
- **BR-010** The root path / is bound to the blog blueprint's index view so url_for('index') resolves to the blog listing (CLM-022: `examples/tutorial/flaskr/__init__.py:46`).

Related: BR-001–BR-004 govern API-AUTH-REGISTER and API-AUTH-LOGIN; BR-005–BR-008 govern API-BLOG-CREATE, API-BLOG-UPDATE, API-BLOG-DELETE.

## Validation and error behavior
- Missing username/password on register flashes an error message and re-renders the form without redirecting (CLM-023: `examples/tutorial/flaskr/auth.py:59-62`).
- A username collision on register is caught from a database integrity error and flashed as an error (CLM-024: `examples/tutorial/flaskr/auth.py:71-74`).
- An unknown username or a wrong password on login is flashed as a distinct error message for each case (CLM-025: `examples/tutorial/flaskr/auth.py:96-99`).
- A missing post title on create/update flashes an error and does not write to the database (CLM-026: `examples/tutorial/flaskr/blog.py:69-73`).
- get_post raises HTTP 404 for a non-existent post id and HTTP 403 when the current user is not the author (CLM-027: `examples/tutorial/flaskr/blog.py:51-55`).

## State transitions
- Session anonymous → authenticated on successful login, guarded by the username/password check, side effect of clearing then repopulating the session (CLM-028: `examples/tutorial/flaskr/auth.py:103-104`).
- Session authenticated → anonymous on logout, unconditional, side effect of clearing the session (CLM-029: `examples/tutorial/flaskr/auth.py:115`).
- Post absent → persisted on create, guarded by a non-empty title, side effect of an insert followed by a commit (CLM-030: `examples/tutorial/flaskr/blog.py:76-80`).
- Post persisted → updated on update, guarded by author match and a non-empty title, side effect of an update followed by a commit (CLM-031: `examples/tutorial/flaskr/blog.py:103-107`).
- Post persisted → deleted on delete, guarded by author match, side effect of a delete followed by a commit (CLM-032: `examples/tutorial/flaskr/blog.py:122-124`).

## Configuration
- SECRET_KEY — default "dev", overridable by instance config or test config; used for session signing (CLM-033: `examples/tutorial/flaskr/__init__.py:9-11`).
- DATABASE — default path under the instance folder, overridable the same way; consumed to open the SQLite connection (CLM-034: `examples/tutorial/flaskr/__init__.py:12-13`).
- TESTING — set via the test_config mapping passed to create_app when testing (CLM-035: `examples/tutorial/flaskr/__init__.py:19-21`).
- An optional instance-relative config.py is loaded silently (no error if absent) when test_config is None (CLM-036: `examples/tutorial/flaskr/__init__.py:16-18`).

## Persistence and side effects
- A SQLite connection is opened lazily per request and reused within that request (CLM-037: `examples/tutorial/flaskr/db.py:14-18`).
- The connection is closed at the end of every application context (CLM-038: `examples/tutorial/flaskr/db.py:55`).
- init_db drops and recreates all tables by executing a schema script (CLM-039: `examples/tutorial/flaskr/db.py:37-38`); the DDL statements themselves live in flaskr/schema.sql, which is not a citable extension in this workflow (see Unverified).
- Register, create, update, and delete each commit a write to the database (CLM-040: `examples/tutorial/flaskr/auth.py:70`).

## Operational behavior
- create_app ensures the instance folder exists on every startup, creating it if missing (CLM-041: `examples/tutorial/flaskr/__init__.py:24`).
- The init-db CLI command is registered on the app's CLI group and prints a confirmation message on success (CLM-042: `examples/tutorial/flaskr/db.py:41-45`).
- No logging, retry, timeout, or scheduling behavior is implemented in the analyzed .py sources (searched: flaskr/__init__.py, flaskr/auth.py, flaskr/blog.py, flaskr/db.py) — Not found.

## Known limitations
- Password reset, account deletion, and post-listing pagination are not implemented anywhere in the analyzed scope (searched: flaskr/auth.py, flaskr/blog.py) — Not found.
- No rate limiting or CSRF-token verification code exists in the analyzed .py sources (searched: flaskr/auth.py, flaskr/__init__.py) — Not found.

## Unverified / Needs-review
- **UV-001** The exact column types and the NOT NULL / UNIQUE / FOREIGN KEY / AUTOINCREMENT constraints for the user and post tables are defined only in flaskr/schema.sql, which is outside this workflow's citable extensions. Searched: flaskr/schema.sql.
- **UV-002** The exact operator commands for installing, running, and initializing the app (virtualenv creation, pip install, flask run, flask init-db) are documented only in README.rst, a non-citable extension. Searched: README.rst.
- **UV-003** Packaging metadata (the declared runtime dependency on flask, pytest as an optional test extra, the flit_core build backend) is defined only in pyproject.toml, a non-citable extension. Searched: pyproject.toml.
