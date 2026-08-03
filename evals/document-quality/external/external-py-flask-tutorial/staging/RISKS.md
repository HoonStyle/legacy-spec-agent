# RISKS.md — Flaskr

Analyzed source commit: 36e4a824f340fdee7ed50937ba8e7f6bc7d17f81
Generated at: 2026-07-30
Scope: same as SPEC.md. Not truncated.

## Confirmed behavior

#### RSK-COMMIT-AUTH-REGISTER
- Severity: low. Likelihood: certain, executes on every successful registration. Impact: a new user row becomes durable.
- Confidence: high.
- Evidence: `examples/tutorial/flaskr/auth.py:70` (CLM-121).
- Mitigation: none needed, this is the intended persistence write, guarded by BR-001 and BR-002.
- Suggested action: none.
- Owner: unassigned. Status: confirmed.
- Related: BR-001, BR-002, API-AUTH-REGISTER.

#### RSK-COMMIT-BLOG-CREATE
- Severity: low. Likelihood: certain. Impact: a new post row becomes durable.
- Confidence: high.
- Evidence: `examples/tutorial/flaskr/blog.py:80` (CLM-122).
- Mitigation: none needed.
- Suggested action: none.
- Owner: unassigned. Status: confirmed.
- Related: BR-006, API-BLOG-CREATE, DM-002.

#### RSK-COMMIT-BLOG-UPDATE
- Severity: low. Likelihood: certain. Impact: a post row's title and body become durably changed.
- Confidence: high.
- Evidence: `examples/tutorial/flaskr/blog.py:107` (CLM-123).
- Mitigation: none needed, guarded by BR-006, BR-007, and BR-008.
- Suggested action: none.
- Owner: unassigned. Status: confirmed.
- Related: BR-006, BR-007, BR-008, API-BLOG-UPDATE, DM-002.

#### RSK-COMMIT-BLOG-DELETE
- Severity: medium, irreversible data loss. Likelihood: certain when invoked. Impact: a post row is permanently removed.
- Confidence: high.
- Evidence: `examples/tutorial/flaskr/blog.py:124` (CLM-124).
- Mitigation: guarded by BR-007 and BR-008, author-only and must exist; no soft-delete or confirmation step exists in source.
- Suggested action: none identified in scope.
- Owner: unassigned. Status: confirmed.
- Related: BR-007, BR-008, API-BLOG-DELETE, DM-002.

#### RSK-TEST-DB-UNLINK
- Severity: low. Likelihood: certain, runs once per test. Impact: deletes the temporary per-test SQLite file from disk.
- Confidence: high.
- Evidence: `examples/tutorial/tests/conftest.py:32` (CLM-125).
- Mitigation: none needed, scoped to a per-test temporary file path (CLM-126: `examples/tutorial/tests/conftest.py:19`).
- Suggested action: none.
- Owner: unassigned. Status: confirmed.
- Related: TC-FILE-CONFTEST.

#### RSK-TEST-COMMIT-AUTHOR
- Severity: low. Likelihood: certain, runs once in the author-required test. Impact: mutates the seeded post row's author for that test's database.
- Confidence: high.
- Evidence: `examples/tutorial/tests/test_blog.py:30` (CLM-127).
- Mitigation: none needed, isolated to the temporary per-test database.
- Suggested action: none.
- Owner: unassigned. Status: confirmed.
- Related: BR-007, TC-FILE-TEST-BLOG.

#### RSK-DB-CONNECT
- Severity: low. Likelihood: certain, once per request that touches the database. Impact: opens a live SQLite connection stored on the request context.
- Confidence: high.
- Evidence: `examples/tutorial/flaskr/db.py:15-16` (CLM-128).
- Mitigation: closed by RSK-DB-CLOSE at teardown.
- Suggested action: none.
- Owner: unassigned. Status: confirmed.
- Related: DM-001, DM-002.

#### RSK-DB-CLOSE
- Severity: low. Likelihood: certain, every app context teardown. Impact: releases the SQLite connection.
- Confidence: high.
- Evidence: `examples/tutorial/flaskr/db.py:29-30` (CLM-129).
- Mitigation: registered as a teardown callback, so it runs even after an exception (CLM-130: `examples/tutorial/flaskr/db.py:55`).
- Suggested action: none.
- Owner: unassigned. Status: confirmed.
- Related: RSK-DB-CONNECT.

#### RSK-DB-INIT-SCRIPT
- Severity: high, destructive. Likelihood: only when an operator explicitly runs init-db. Impact: drops and recreates the user and post tables, discarding all existing rows.
- Confidence: high for the drop/recreate behavior in .py source; the exact DDL is in the non-citable flaskr/schema.sql, see UV-001 in SPEC.md.
- Evidence: `examples/tutorial/flaskr/db.py:37-38` (CLM-131).
- Mitigation: none in source, no confirmation prompt or backup step is defined (searched: flaskr/db.py) — Not found.
- Suggested action: an operator should back up the SQLite file before running init-db.
- Owner: unassigned. Status: confirmed as a capability; the risk framing itself is an assessment.
- Related: DM-001, DM-002.

## Defect candidates

#### RSK-INTEGRITY-ASSUMPTION
- Severity: low. Likelihood: low, requires an additional constraint on the user table to exist. Impact: if a future schema change added another constraint to the user table, an unrelated integrity error would still be reported to the visitor as a duplicate-username message.
- Confidence: medium — the assumption is visible in the exception handling (CLM-132: `examples/tutorial/flaskr/auth.py:71-74`), but whether username is the only unique constraint is defined only in the non-citable flaskr/schema.sql.
- Mitigation: none in source.
- Suggested action: inspect the constraint set before broadening the user table schema.
- Owner: unassigned. Status: candidate, not confirmed.
- Related: BR-002, UV-001.

## Unverified gaps
- **UV-008** Whether the SQLite file or its directory has any filesystem permission or encryption hardening is not defined in the analyzed .py sources (searched: flaskr/db.py, flaskr/__init__.py) — Not found.
- **UV-009** External integrations such as email verification, third-party authentication, or monitoring are not present anywhere in the analyzed scope (searched: flaskr/auth.py, flaskr/blog.py, flaskr/__init__.py) — Not found.
