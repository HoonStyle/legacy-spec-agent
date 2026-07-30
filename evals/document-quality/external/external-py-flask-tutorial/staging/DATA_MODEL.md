# DATA_MODEL.md — Flaskr

Analyzed source commit: 36e4a824f340fdee7ed50937ba8e7f6bc7d17f81
Generated at: 2026-07-30
Scope: same as SPEC.md. Persistent entities are grounded in the SQL literals executed by flaskr/auth.py, flaskr/blog.py, and flaskr/db.py; the authoritative DDL in flaskr/schema.sql is not a citable extension in this workflow and is discussed only under Unverified. Not truncated.

## Data model

### Persistent entities

#### DM-001 — User
- id — used as the session identity and join key; type and constraints are not citable in .py source (see UV-001) (CLM-089: `examples/tutorial/flaskr/auth.py:42`).
- username — read and written as a string form field and unique-checked at insert time (CLM-090: `examples/tutorial/flaskr/auth.py:93`).
- password — stores a hashed value, never the plaintext (CLM-091: `examples/tutorial/flaskr/auth.py:67-68`).
- Required/optional status, default values, and column types: not citable in .py source — see UV-001.
- Validation: username and password must be non-empty at registration (BR-001); username must be unique (BR-002).
- Relations: a User is referenced by Post.author_id (CLM-092: `examples/tutorial/flaskr/blog.py:21-22`).
- Lifecycle: created on register (BR-001, BR-002); no update or delete operation on User exists in the analyzed scope (searched: flaskr/auth.py, flaskr/blog.py) — Not found.
- Related: BR-001, BR-002, BR-003, API-AUTH-REGISTER, API-AUTH-LOGIN.

#### DM-002 — Post
- id — path parameter and join/lookup key for update and delete (CLM-093: `examples/tutorial/flaskr/blog.py:43-46`).
- title — required string field, read from the create/update form (CLM-094: `examples/tutorial/flaskr/blog.py:65-66`).
- body — string field with no non-empty validation applied (CLM-095: `examples/tutorial/flaskr/blog.py:66`).
- created — read and displayed on the index page; never set from a request field, so it is populated by the database itself (CLM-096: `examples/tutorial/flaskr/blog.py:21-23`); the default-value mechanism is declared only in flaskr/schema.sql, a non-citable extension — see UV-001.
- author_id — set from the logged-in user's id at create time, never accepted from the request body (CLM-097: `examples/tutorial/flaskr/blog.py:78`).
- Validation: title required on create/update (BR-006).
- Relations: Post.author_id references User.id; the foreign-key declaration itself lives only in the non-citable flaskr/schema.sql (see UV-001), while the join usage between the two entities is grounded in DM-001's Relations bullet above.
- Lifecycle: created on create (BR-006), mutated on update (BR-006, BR-007), removed on delete (BR-007, BR-008).
- Related: BR-006, BR-007, BR-008, API-BLOG-CREATE, API-BLOG-UPDATE, API-BLOG-DELETE.

### Configuration / interface contracts
- SECRET_KEY (string, default "dev") — session-signing key (CLM-098: `examples/tutorial/flaskr/__init__.py:11`).
- DATABASE (filesystem path, default under the instance folder) — SQLite file location (CLM-099: `examples/tutorial/flaskr/__init__.py:13`).
- TESTING (boolean, set via the test_config mapping, no in-flaskr-code default) — not branched on anywhere in the flaskr package itself (CLM-100: `examples/tutorial/flaskr/__init__.py:21`).

## Unverified
- **UV-004** Primary-key, AUTOINCREMENT, UNIQUE, NOT NULL, and FOREIGN KEY declarations for the user and post tables are defined only in flaskr/schema.sql, a non-citable extension in this workflow. Searched: flaskr/schema.sql.
