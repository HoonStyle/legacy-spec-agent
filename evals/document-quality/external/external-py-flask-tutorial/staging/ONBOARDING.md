# ONBOARDING.md — Flaskr

Analyzed source commit: 36e4a824f340fdee7ed50937ba8e7f6bc7d17f81
Generated at: 2026-07-30
Scope: same as SPEC.md. Setup, build, run, and test commands are documented only in README.rst and pyproject.toml, neither of which is a citable extension in this workflow; they are reported below as Unverified. Only facts grounded in citable .py sources are presented as verified. Not truncated.

## Onboarding

### Prerequisites (verified)
- The application imports flask (CLM-101: `examples/tutorial/flaskr/__init__.py:3`).
- Authentication uses Werkzeug's password-hashing helpers (CLM-102: `examples/tutorial/flaskr/auth.py:11-12`).
- The db module imports the stdlib sqlite3 module and the click CLI library (CLM-103: `examples/tutorial/flaskr/db.py:1-4`).
- The test suite is written against pytest (CLM-104: `examples/tutorial/tests/test_auth.py:1`).

### Configuration
See DATA_MODEL.md's Configuration / interface contracts entries for SECRET_KEY, DATABASE, and TESTING (each cited there).

### Grounded operational command
- The init-db command is registered on the app's CLI group and can be invoked through Flask's CLI runner; its name and success message are grounded in source (CLM-105: `examples/tutorial/flaskr/db.py:41-45`).

### Build / install / run / test commands (Unverified)
- **UV-005** Creating a virtualenv, installing with pip, and running the app with the Flask CLI are documented only in README.rst, a non-citable extension. Searched: README.rst.
- **UV-006** Running the test suite with pytest, the coverage invocation, and the testpaths scope are documented only in README.rst and pyproject.toml, non-citable extensions. Searched: README.rst, pyproject.toml.
- **UV-007** The optional instance-relative config.py used to override defaults outside of testing is not present anywhere in the analyzed scope, and its expected contents are not defined in any citable source. Searched: flaskr/__init__.py and the repository tree under examples/tutorial/.

### Troubleshooting
No troubleshooting guidance, error-recovery steps, or FAQ content exists in the analyzed .py sources (searched: flaskr/**/*.py, tests/**/*.py) — Not found.
