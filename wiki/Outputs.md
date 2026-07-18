# Outputs

Legacy Spec Agent writes documents that describe the code as it exists today. Outputs should distinguish verified facts from unverified candidates.

## Core outputs

| Artifact | Purpose |
| --- | --- |
| `SPEC.md` | Reconstructed purpose, modules, rules, inputs, outputs, constraints, and unverified items. |
| `ARCHITECTURE.md` | Dependency graph, control flow, and system structure traced to code. |
| `audit_log.jsonl` | Append-only record of created, verified, flagged, moved, drifted, and orphaned claims. |
| `DRIFT_REPORT.md` | Per-citation drift results for an existing spec. |

## Optional supporting outputs

| Artifact | Purpose |
| --- | --- |
| `INTERFACES.md` | Public APIs, signatures, entry points, and code-defined request/response examples. |
| `DATA_MODEL.md` | Entities, fields, relationships, and ER diagrams when the code defines a model. |
| `ONBOARDING.md` | Build commands, run commands, dependencies, configuration, and environment variables. |
| `TESTCASES.md` | Characterization test ideas and test inventory for current behavior. |
| `RISKS.md` | Reviewable risk or defect candidates with evidence and suggested actions. |
| `CHANGELOG.md` | Git history grouped by conventional commit type. |
| `REPORT.html` | Self-contained tabbed report assembled from generated documents, audit logs, and charts. |

## Charts

The connector can render deterministic visualizations such as coverage, drift, benchmark, architecture, and ER diagrams. Generated chart files can be embedded into `REPORT.html`.

## What the tool intentionally avoids

Legacy Spec Agent does not fabricate ADRs, PRDs, or user manuals from code alone. Those document human intent, decisions, or user-facing expectations that source code often cannot prove.

## Output quality checklist

Before considering generated documentation ready to share, check that:

- important claims cite code;
- every citation is audit-covered;
- unverified items are isolated;
- skipped scope is declared;
- generated diagrams correspond to structured connector output or cited source analysis;
- drift results separate unresolved checks from real behavior drift.
