# Interfaces

Analyzed source commit: `ecf88eda32182ccca352248c6dd0b20232309a31`
Generated at: `2026-07-28T04:57:25Z`
Coverage/search scope: MCP registrations in `connector/src/server.ts`, startup in `connector/src/index.ts`, and package/plugin manifests; no supported source deliberately skipped.

## API-001 — MCP stdio server

- **Caller / protocol:** MCP client over stdio. `connector/src/index.ts:27-31`
- **Signature:** process entry accepts an optional target-root argument. `connector/src/index.ts:9-10`
- **Request/response schema:** individual registered tools define Zod input schemas and JSON text responses. `connector/src/server.ts:66-68`
- **Validation/errors:** a nonexistent or non-directory root exits with status 1 (Related: BR-002). `connector/src/index.ts:11-14`
- **Side effects:** tool-dependent; bootstrap may restore/build before serving. `connector/bootstrap.mjs:74-87`
- **Timeout/cancellation:** Not found for the stdio server lifecycle; searched entrypoint and server construction.
- **Idempotency:** Not found; tool-dependent and not declared by the transport code.
- **Related:** BR-001, BR-002.

## API-002 — `verify_citation`

- **Caller / protocol:** MCP client through API-001.
- **Exact signature:** requires `path` and integer `line`; optionally accepts snippet, claim, and 0–50 context lines. `connector/src/server.ts:138-160`
- **Request/response:** JSON-text MCP content; returns a deterministic citation verdict and source context per the registered description. `connector/src/server.ts:141-159`
- **Validation/errors:** Zod validates the fields; file/verdict behavior is returned by the verifier.
- **Side effects:** none declared in the registration.
- **Timeout/cancellation:** Not found; searched the registration.
- **Idempotency:** same readable tree and inputs are expected to select the same deterministic verifier, but an explicit guarantee is **Not found**.
- **Related:** BR-002.

## API-003 — `build_call_graph`

- **Caller / protocol:** MCP client through API-001.
- **Exact signature:** optional `subdir`, `file|package` granularity, and integer limit from 1 through 20,000. `connector/src/server.ts:187-210`
- **Request/response:** JSON-text syntax module dependency graph, including resolved/unresolved relationships.
- **Validation/errors:** schema bounds the limit and granularity.
- **Side effects:** none declared in the registration.
- **Timeout/cancellation:** Not found; searched the registration.
- **Idempotency:** Not found as an explicit contract.
- **Related:** BR-004.

## Unverified external contracts

- **UV-002 — Host process supervision.** Restart, termination, and backpressure behavior are owned by the external MCP host and are not defined in the searched repository entrypoint or manifest.
