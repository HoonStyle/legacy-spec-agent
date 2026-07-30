# INTERFACES.md — Flaskr

Analyzed source commit: 36e4a824f340fdee7ed50937ba8e7f6bc7d17f81
Generated at: 2026-07-30
Scope: same as SPEC.md. All 8 registered HTTP routes found in flaskr/__init__.py, flaskr/auth.py, and flaskr/blog.py are documented below. Not truncated.

## Interfaces

#### API-HELLO
Registered route GET /hello.
- Caller: any HTTP client, no authentication required.
- Protocol/transport: HTTP GET, no query or body parameters.
- Signature: hello() (CLM-062: `examples/tutorial/flaskr/__init__.py:26`).
- Request schema: none.
- Response schema: text/html body "Hello, World!" (CLM-063: `examples/tutorial/flaskr/__init__.py:28`).
- Validation: none.
- Errors: none defined.
- Side effects: none.
- Timeout/cancellation: not defined in source — Not found.
- Idempotency: idempotent (read-only, no state change).
- Related: none.

#### API-BLOG-INDEX
Registered route GET / (blog blueprint root, bound to endpoint index).
- Caller: any HTTP client.
- Protocol/transport: HTTP GET.
- Signature: index() (CLM-064: `examples/tutorial/flaskr/blog.py:16`).
- Request schema: none.
- Response schema: rendered index page with a list of joined post/username rows (CLM-065: `examples/tutorial/flaskr/blog.py:20-25`).
- Validation: none.
- Errors: none defined.
- Side effects: one read-only select query.
- Timeout/cancellation: not defined — Not found.
- Idempotency: idempotent.
- Related: BR-010, DM-002.

#### API-AUTH-REGISTER
Registered route GET, POST /auth/register.
- Caller: anonymous visitor.
- Protocol/transport: HTTP GET renders the form, POST submits it.
- Signature: register() (CLM-066: `examples/tutorial/flaskr/auth.py:46`).
- Request schema (POST): form fields username (string), password (string) (CLM-067: `examples/tutorial/flaskr/auth.py:54-55`).
- Response schema: redirect to the login page on success (CLM-068: `examples/tutorial/flaskr/auth.py:77`); rendered registration form otherwise.
- Validation: BR-001, BR-002.
- Errors: flashed validation messages, no HTTP error status; the form is re-rendered with 200.
- Side effects: one insert and one commit (CLM-069: `examples/tutorial/flaskr/auth.py:66-70`).
- Timeout/cancellation: not defined — Not found.
- Idempotency: not idempotent, each success inserts a row; a retried duplicate submission is rejected by BR-002.
- Related: BR-001, BR-002, BR-003, DM-001.

#### API-AUTH-LOGIN
Registered route GET, POST /auth/login.
- Caller: anonymous visitor.
- Protocol/transport: HTTP GET / POST.
- Signature: login() (CLM-070: `examples/tutorial/flaskr/auth.py:84`).
- Request schema (POST): form fields username (string), password (string) (CLM-071: `examples/tutorial/flaskr/auth.py:88-89`).
- Response schema: redirect to the index page on success (CLM-072: `examples/tutorial/flaskr/auth.py:105`); rendered login form otherwise.
- Validation: BR-004.
- Errors: flashed validation messages, HTTP 200 with the form re-rendered.
- Side effects: sets the session user id (BR-009); no database writes.
- Timeout/cancellation: not defined — Not found.
- Idempotency: idempotent at the data-store level (no writes); starts a new session each success.
- Related: BR-004, BR-009, DM-001.

#### API-AUTH-LOGOUT
Registered route GET /auth/logout.
- Caller: any client holding a session cookie.
- Protocol/transport: HTTP GET.
- Signature: logout() (CLM-073: `examples/tutorial/flaskr/auth.py:112`).
- Request schema: none.
- Response schema: redirect to the index page (CLM-074: `examples/tutorial/flaskr/auth.py:116`).
- Validation: none.
- Errors: none defined.
- Side effects: the session is cleared (CLM-075: `examples/tutorial/flaskr/auth.py:115`).
- Timeout/cancellation: not defined — Not found.
- Idempotency: idempotent.
- Related: BR-005.

#### API-BLOG-CREATE
Registered route GET, POST /create.
- Caller: authenticated user only (login_required).
- Protocol/transport: HTTP GET / POST.
- Signature: create() (CLM-076: `examples/tutorial/flaskr/blog.py:60`).
- Request schema (POST): form fields title (string), body (string) (CLM-077: `examples/tutorial/flaskr/blog.py:65-66`).
- Response schema: redirect to the index page on success (CLM-078: `examples/tutorial/flaskr/blog.py:81`); rendered create form otherwise.
- Validation: BR-005 (login required), BR-006 (title required).
- Errors: flashed validation message, HTTP 200 form re-render; anonymous access redirects to login per BR-005.
- Side effects: one insert and one commit (CLM-079: `examples/tutorial/flaskr/blog.py:76-80`).
- Timeout/cancellation: not defined — Not found.
- Idempotency: not idempotent, each success inserts a row.
- Related: BR-005, BR-006, DM-002.

#### API-BLOG-UPDATE
Registered route GET, POST /<int:id>/update.
- Caller: authenticated author of the post only.
- Protocol/transport: HTTP GET / POST, path parameter id (integer).
- Signature: update(id) (CLM-080: `examples/tutorial/flaskr/blog.py:86`).
- Request schema (POST): form fields title (string), body (string) (CLM-081: `examples/tutorial/flaskr/blog.py:93-94`).
- Response schema: redirect to the index page on success (CLM-082: `examples/tutorial/flaskr/blog.py:108`); rendered update form otherwise.
- Validation: BR-005, BR-006, BR-007, BR-008.
- Errors: HTTP 404 if the post id does not exist, HTTP 403 if not the author (CLM-083: `examples/tutorial/flaskr/blog.py:51-55`), else a flashed validation message.
- Side effects: one update and one commit (CLM-084: `examples/tutorial/flaskr/blog.py:104-107`).
- Timeout/cancellation: not defined — Not found.
- Idempotency: idempotent, repeating the same update produces the same row state.
- Related: BR-005, BR-006, BR-007, BR-008, DM-002.

#### API-BLOG-DELETE
Registered route POST /<int:id>/delete.
- Caller: authenticated author of the post only.
- Protocol/transport: HTTP POST, path parameter id (integer).
- Signature: delete(id) (CLM-085: `examples/tutorial/flaskr/blog.py:113`).
- Request schema: none beyond the path parameter.
- Response schema: redirect to the index page (CLM-086: `examples/tutorial/flaskr/blog.py:125`).
- Validation: BR-005, BR-007, BR-008.
- Errors: HTTP 404 if the post id does not exist, HTTP 403 if not the author (CLM-087: `examples/tutorial/flaskr/blog.py:51-55`).
- Side effects: one delete and one commit (CLM-088: `examples/tutorial/flaskr/blog.py:123-124`).
- Timeout/cancellation: not defined — Not found.
- Idempotency: idempotent, deleting an already-deleted id yields 404, not a duplicate error.
- Related: BR-005, BR-007, BR-008, DM-002.

## Unverified external contracts
No interface in the analyzed scope is owned by an external host or service; all 8 routes are defined and served by this application (searched: flaskr/__init__.py, flaskr/auth.py, flaskr/blog.py) — Not found.
