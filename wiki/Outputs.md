# Outputs

Legacy Spec Agent writes documents that describe the code as it exists today. Outputs should distinguish verified facts from unverified candidates.

## Mode A output profiles

Mode A uses the **`standard` profile by default**. The smaller **`core` profile is used only when the user explicitly requests it**.

| Profile | Required artifacts |
| --- | --- |
| `core` | `SPEC.md`, `ARCHITECTURE.md`, `audit_log.jsonl` |
| `standard` (default) | Everything in `core`, plus `INTERFACES.md`, `DATA_MODEL.md`, `ONBOARDING.md`, `TESTCASES.md`, `RISKS.md`, charts, and `REPORT.html` |

`CHANGELOG.md` is an additional history artifact when requested or applicable. Mode B emits `DRIFT_REPORT.md` for an existing specification rather than using the Mode A profile list.

## Artifact contracts

| Artifact | Purpose |
| --- | --- |
| `SPEC.md` | Reconstructed purpose, modules, rules, inputs, outputs, constraints, and unverified items. |
| `ARCHITECTURE.md` | Dependency graph, control flow, and system structure traced to code. |
| `audit_log.jsonl` | Append-only record of created, verified, flagged, moved, drifted, and orphaned claims. |
| `INTERFACES.md` | Public APIs, signatures, entry points, and code-defined request/response examples. |
| `DATA_MODEL.md` | Entities, fields, relationships, and ER diagrams when the code defines a model. |
| `ONBOARDING.md` | Build commands, run commands, dependencies, configuration, and environment variables. |
| `TESTCASES.md` | Characterization test ideas and test inventory for current behavior. |
| `RISKS.md` | Reviewable risk or defect candidates with evidence and suggested actions. |
| `CHANGELOG.md` | Git history grouped by conventional commit type. |
| `REPORT.html` | Self-contained tabbed report assembled from generated documents, audit logs, and charts. |
| `DRIFT_REPORT.md` | Per-citation drift results for an existing spec. |

Required documents and sections are never empty or padded with guesses. When a required concept does not exist, the artifact records the search scope and **Not found**. External behavior that the repository does not define is labeled **Unverified**.

Cross-document references use stable typed IDs: `BR-*`, `API-*`, `DM-*`, `TC-*`, `RSK-*`, and `UV-*`. Every reference must resolve to exactly one item of the expected type, and every citation in emitted Markdown must have a matching entry in `audit_log.jsonl`.

## Charts

The connector can render deterministic visualizations such as coverage, drift, benchmark, architecture, and ER diagrams. Generated chart files can be embedded into `REPORT.html`.

## What the tool intentionally avoids

Legacy Spec Agent does not fabricate ADRs, PRDs, or user manuals from code alone. Those document human intent, decisions, or user-facing expectations that source code often cannot prove.

## Output quality checklist

Before considering generated documentation ready to share, check that:

- important claims cite code;
- every citation is audit-covered;
- every cross-document ID resolves exactly once to the expected item type;
- unverified items are isolated;
- absent concepts state the search scope and **Not found**;
- skipped scope is declared;
- generated diagrams correspond to structured connector output or cited source analysis;
- drift results separate unresolved checks from real behavior drift.
