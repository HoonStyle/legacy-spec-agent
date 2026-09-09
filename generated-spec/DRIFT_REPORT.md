# Drift report

- Checked: 2026-09-09
- Specification baseline: `ecf88eda32182ccca352248c6dd0b20232309a31`
- Compared source: `242f1d5`
- Scope: the 25 source citations recorded in `SPEC.md` and `audit_log.jsonl`
- Result: 15 intact, 9 moved, 1 drifted, 0 orphaned, 0 unresolved after local verification

The installed drift connector was bound to its plugin-cache checkout and could
not resolve the baseline from this repository. Its per-citation errors were not
classified as drift. The table below is the repository-local Git fallback,
verified against the baseline blob and current source.

| Claim | Previous citation | Verdict | Current citation | Note |
|---|---|---|---|---|
| DOC-SPEC-001 | `.codex-plugin/plugin.json:2` | intact | same | Plugin identity remains present. |
| DOC-SPEC-002 | `connector/src/server.ts:70-74` | drifted | `connector/src/server.ts:73-80` | Connector version changed from 0.2.1 to 0.3.0. |
| DOC-SPEC-003 | `.codex-plugin/plugin.json:15-17` | intact | same | Configuration remains present. |
| DOC-SPEC-004 | `connector/src/index.ts:9-14` | intact | same | Entry behavior remains present. |
| DOC-SPEC-005 | `connector/package.json:14-17` | intact | same | Runtime dependency remains present. |
| DOC-SPEC-006 | `connector/src/server.ts:162-181` | moved | `connector/src/server.ts:165-184` | Same tool behavior after line movement. |
| DOC-SPEC-007 | `connector/src/server.ts:187-194` | moved | `connector/src/server.ts:190-197` | Same tool behavior after line movement. |
| DOC-SPEC-008 | `connector/src/server.ts:138-160` | moved | `connector/src/server.ts:141-163` | Same tool behavior after line movement. |
| DOC-SPEC-009 | `connector/src/server.ts:213-234` | moved | `connector/src/server.ts:216-237` | Same tool behavior after line movement. |
| BR-001 | `connector/src/root.ts:15-30` | intact | same | Root validation remains present. |
| BR-002 | `connector/src/index.ts:9-14` | intact | same | Startup behavior remains present. |
| BR-003 | `connector/src/server.ts:96-117` | moved | `connector/src/server.ts:99-120` | Same validation behavior after line movement. |
| BR-004 | `connector/src/server.ts:187-194` | moved | `connector/src/server.ts:190-197` | Same failure behavior after line movement. |
| BR-005 | `connector/bootstrap.mjs:51-71` | intact | same | Bootstrap lock behavior remains present. |
| BR-002 | `connector/src/index.ts:11-14` | intact | same | Startup behavior remains present. |
| BR-002 | `connector/src/server.ts:14-64` | moved | `connector/src/server.ts:17-67` | Same cache behavior after line movement. |
| BR-002 | `connector/bootstrap.mjs:74-87` | intact | same | Bootstrap behavior remains present. |
| BR-001 | `connector/src/root.ts:20-30` | intact | same | Root validation remains present. |
| BR-001 | `connector/src/server.ts:70-74` | moved | `connector/src/server.ts:73-77` | Same server identity behavior after line movement. |
| BR-001 | `connector/src/root.ts:25-30` | intact | same | Root validation remains present. |
| BR-001 | `connector/bootstrap.mjs:74-87` | intact | same | Bootstrap behavior remains present. |
| BR-001 | `connector/src/report.ts:1-12` | intact | same | Report limiting remains present. |
| BR-001 | `connector/src/index.ts:27-31` | intact | same | Error reporting remains present. |
| BR-001 | `connector/package.json:11-17` | intact | same | Supported scripts/runtime remain present. |
| BR-004 | `connector/src/server.ts:187-194` | moved | `connector/src/server.ts:190-197` | Same failure behavior after line movement. |

## Required follow-up

`generated-spec/SPEC.md` still states connector version 0.2.1. Mode B records
the discrepancy without editing the specification automatically. A maintainer
should decide whether to regenerate the specification or update and re-audit
that claim against version 0.3.0.
