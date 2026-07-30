# TESTCASES.md — Flaskr

Analyzed source commit: 36e4a824f340fdee7ed50937ba8e7f6bc7d17f81
Generated at: 2026-07-30
Scope: same as SPEC.md. All 5 test modules under examples/tutorial/tests/ were read in full. Not truncated.

## Existing automated tests

#### TC-FILE-CONFTEST
- Given/When/Then: given no app instance exists, when a test requests the app/client/runner/auth fixtures, then a temporary SQLite database is initialized with seed test rows and torn down after the test (CLM-106: `examples/tutorial/tests/conftest.py:1`).
- Related: BR-001, DM-001, DM-002.
- Inputs: none, fixture setup only.
- Expected result: a working app, client, runner, and auth fixture available to every test in the suite.
- Side effects: creates and deletes a temporary file-backed SQLite database per test (CLM-107: `examples/tutorial/tests/conftest.py:32`).
- Execution command: run via pytest fixture injection — see UV-006 in ONBOARDING.md for the exact invocation.
- Required environment/configuration: TESTING is set true and DATABASE points at a temp file (CLM-108: `examples/tutorial/tests/conftest.py:21`).
- Evidence: examples/tutorial/tests/conftest.py:1.
- Status/category: existing automated test fixture, high confidence.

#### TC-FILE-TEST-AUTH
- Given/When/Then: given the client/auth fixtures, when registration, login, and logout requests are sent, then the responses and session state match BR-001 through BR-005 and BR-009 (CLM-109: `examples/tutorial/tests/test_auth.py:1`).
- Related: BR-001, BR-002, BR-003, BR-004, BR-005, BR-009, API-AUTH-REGISTER, API-AUTH-LOGIN, API-AUTH-LOGOUT.
- Inputs: form data with username and password submitted via a POST request (CLM-110: `examples/tutorial/tests/test_auth.py:13`).
- Expected result: register redirects to login, login redirects to the index and sets the session user id, logout clears the session (CLM-111: `examples/tutorial/tests/test_auth.py:44-45`).
- Side effects: inserts a user row on successful registration.
- Execution command: pytest against this file (name only; invocation source is Unverified per UV-006).
- Required environment/configuration: the app/client/auth fixtures from conftest.py.
- Evidence: examples/tutorial/tests/test_auth.py:1.
- Status/category: existing automated test file, high confidence.

#### TC-FILE-TEST-BLOG
- Given/When/Then: given a logged-in and an anonymous client, when index/create/update/delete requests are sent, then responses match BR-005 through BR-008 (CLM-112: `examples/tutorial/tests/test_blog.py:1`).
- Related: BR-005, BR-006, BR-007, BR-008, API-BLOG-INDEX, API-BLOG-CREATE, API-BLOG-UPDATE, API-BLOG-DELETE.
- Inputs: path parameters identifying a post and form data with title and body (CLM-113: `examples/tutorial/tests/test_blog.py:19`).
- Expected result: 403 for a non-author, 404 for a non-existent post, redirect to the index on success (CLM-114: `examples/tutorial/tests/test_blog.py:34-35`).
- Side effects: mutates the post table for the create/update/delete cases.
- Execution command: pytest against this file (name only; see UV-006).
- Required environment/configuration: the app/client/auth fixtures from conftest.py.
- Evidence: examples/tutorial/tests/test_blog.py:1.
- Status/category: existing automated test file, high confidence.

#### TC-FILE-TEST-DB
- Given/When/Then: given an app context, when get_db is called twice and the context ends, then the same connection is reused and then closed; when the init-db CLI command runs, then it invokes init_db and prints a confirmation (CLM-115: `examples/tutorial/tests/test_db.py:1`).
- Related: none (persistence-lifecycle coverage only, no business rule).
- Inputs: none beyond the app/runner fixtures.
- Expected result: the same connection object is returned within one context, and a programming error mentioning "closed" is raised after the context ends (CLM-116: `examples/tutorial/tests/test_db.py:13-16`).
- Side effects: none persisted, connection lifecycle only.
- Execution command: pytest against this file (name only; see UV-006).
- Required environment/configuration: the app/runner fixtures.
- Evidence: examples/tutorial/tests/test_db.py:1.
- Status/category: existing automated test file, high confidence.

#### TC-FILE-TEST-FACTORY
- Given/When/Then: given no test config, when create_app() is called, then testing is falsy; given a config with TESTING true, then testing is true; when /hello is requested, then the body is the fixed greeting (CLM-117: `examples/tutorial/tests/test_factory.py:1`).
- Related: API-HELLO.
- Inputs: an optional test_config mapping.
- Expected result: testing is falsy by default and true when explicitly overridden (CLM-118: `examples/tutorial/tests/test_factory.py:6-7`).
- Side effects: none.
- Execution command: pytest against this file (name only; see UV-006).
- Required environment/configuration: none beyond the client fixture.
- Evidence: examples/tutorial/tests/test_factory.py:1.
- Status/category: existing automated test file, high confidence.

## Source-derived characterization scenarios

#### TC-CHAR-INSTANCE-FOLDER
- Given/When/Then: given the instance folder does not yet exist, when create_app() runs, then the folder is created rather than the app failing (CLM-119: `examples/tutorial/flaskr/__init__.py:24`).
- Related: none.
- Inputs: none, startup behavior.
- Expected result: the directory-creation call succeeds whether or not the folder already exists.
- Side effects: creates a directory on disk.
- Execution command: this scenario is derived from flaskr/__init__.py only; no test file in examples/tutorial/tests/ exercises it (searched: tests/test_factory.py, tests/conftest.py) — Not found as an existing test.
- Required environment/configuration: filesystem write access to the instance path.
- Evidence: examples/tutorial/flaskr/__init__.py:24.
- Status/category: source-derived characterization, not confirmed to execute in the existing suite.

#### TC-CHAR-INSTANCE-CONFIG-SILENT
- Given/When/Then: given no test_config is passed, when create_app() runs, then it silently loads an instance config file if present and does nothing if absent (CLM-120: `examples/tutorial/flaskr/__init__.py:17-18`).
- Related: none.
- Inputs: presence or absence of an instance config file.
- Expected result: no exception is raised when the instance config file is missing.
- Side effects: none observable beyond configuration values.
- Execution command: this scenario is derived from flaskr/__init__.py only; no test file exercises the silent-load path directly (searched: tests/test_factory.py) — Not found as an existing test.
- Required environment/configuration: none.
- Evidence: examples/tutorial/flaskr/__init__.py:17-18.
- Status/category: source-derived characterization, not confirmed to execute in the existing suite.

## External-contract test candidates
No interface in the analyzed scope depends on an external host or service contract (searched: flaskr/__init__.py, flaskr/auth.py, flaskr/blog.py, flaskr/db.py) — Not found.
