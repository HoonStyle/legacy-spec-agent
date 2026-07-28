# Risks

Analyzed source commit: `ecf88eda32182ccca352248c6dd0b20232309a31`
Generated at: `2026-07-28T04:57:25Z`
Coverage/search scope: connector startup, bootstrap, server registrations, manifests, and supported source analysis; no supported source deliberately skipped.

## Confirmed behavior

### RSK-001 — CWD fallback can select the plugin itself

- **Severity / likelihood:** medium / unknown (assessment, not measured).
- **Impact:** analysis may target the connector checkout instead of the intended repository.
- **Confidence:** high.
- **Evidence:** self-serving fallback is detected and warned about. `connector/src/index.ts:16-24`
- **Mitigation:** pass an explicit root or a supported project-root environment variable. `connector/src/root.ts:15-30`
- **Suggested action:** keep launcher metadata explicit.
- **Owner / status:** unassigned / mitigated by warning.
- **Related:** BR-001, API-001.

## Defect candidates

### RSK-002 — Bootstrap performs network-capable dependency restore

- **Severity / likelihood:** medium / unknown (assessment, not measured).
- **Impact:** first run can depend on npm/network availability.
- **Confidence:** high for behavior; impact frequency unknown.
- **Evidence:** missing/stale dependencies trigger `npm ci`. `connector/bootstrap.mjs:74-86`
- **Mitigation:** distribute or prewarm dependencies where policy permits.
- **Suggested action:** preserve clear first-run diagnostics.
- **Owner / status:** unassigned / candidate operational risk, not a confirmed defect.
- **Related:** API-001.

## Unverified gaps

### RSK-003 — External host lifecycle

- **Severity / likelihood:** unknown / unknown.
- **Impact:** restart and cancellation behavior cannot be specified from this repository.
- **Confidence:** low.
- **Evidence:** **Not found** after searching the plugin manifest and stdio entrypoint.
- **Mitigation / suggested action:** validate against the selected host.
- **Owner / status:** unassigned / unverified.
- **Related:** UV-002, UV-004.
