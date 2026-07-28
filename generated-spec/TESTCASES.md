# Test cases

Analyzed source commit: `ecf88eda32182ccca352248c6dd0b20232309a31`
Generated at: `2026-07-28T04:57:25Z`
Coverage/search scope: `connector/test/**/*.ts`, package scripts, and source-derived behavior across all supported files; no supported source deliberately skipped.

## Existing automated tests

### TC-001 — Full connector suite

- **Given:** connector dependencies are installed.
- **When:** run `npm test` from `connector/`.
- **Then:** TypeScript is built and the repository test runner executes.
- **Inputs/side effects:** working tree plus generated `dist/`; no target-repository mutation is asserted here.
- **Environment/configuration:** Node 20 or newer.
- **Evidence:** `connector/package.json:11-17`
- **Status/category:** existing automated suite.
- **Related:** BR-002, BR-004.

### TC-002 — Citation verifier behavior

- **Given:** fixtures for matching, mismatched, missing, and moved citations.
- **When:** the verifier tests invoke citation verification.
- **Then:** the registered interface can return the documented verdict categories and context.
- **Execution command:** `cd connector && npm test`.
- **Required environment:** Node 20 or newer.
- **Evidence:** `connector/src/server.ts:138-160`
- **Status/category:** existing behavior covered by the repository suite; exact individual assertions are in `connector/test/verify.test.ts`.
- **Related:** API-002.

## Source-derived characterization scenarios

### TC-003 — Reject invalid root

- **Given:** a target-root argument that is absent or not a directory.
- **When:** start the built entrypoint.
- **Then:** stderr receives a diagnostic and the process exits with status 1.
- **Inputs:** invalid filesystem path.
- **Side effects:** process termination.
- **Execution command:** `node connector/dist/src/index.js /missing/path`.
- **Required environment:** built connector and Node 20+.
- **Evidence:** `connector/src/index.ts:9-14`
- **Status/category:** source-derived characterization scenario, not claimed as a separately executed test.
- **Related:** BR-002, API-001.

## External-contract candidates

- **UV-004 / TC-004 — Host restart behavior:** Given abrupt connector termination, verify how the selected MCP host reports and restarts it. Expected behavior and command are **Not found** because host supervision is external (Related: UV-002).
