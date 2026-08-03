# Gatekeeper decision record — external-mixed-online-boutique

**Actor:** gatekeeper-ext3 (read-only Gatekeeper; no deliverable was edited, added, or reworded)
**Case:** `external-mixed-online-boutique` (GoogleCloudPlatform/microservices-demo)
**Date:** 2026-07-30

## Commands run and raw tool output

### Step 1 — evaluate

```
cd /home/user/legacy-spec-agent/evals/document-quality/external && \
  GATE_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  node run-gate.mjs external-mixed-online-boutique microservices-demo gatekeeper-ext3 evaluate
```

Raw result from `evaluate_document_gate`:

```json
{
  "verdict": "approved",
  "citation_count": 131,
  "audited_citation_count": 131,
  "reasons": []
}
```

Written to `gate-result.json` (response 102 bytes, 371.6 ms).

### Step 2 — publish

Because the verdict was `approved`, publication was authorized and the publish command was run:

```
cd /home/user/legacy-spec-agent/evals/document-quality/external && \
  GATE_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  node run-gate.mjs external-mixed-online-boutique microservices-demo gatekeeper-ext3 publish
```

Raw result from `publish_approved_documents`:

```json
{
  "gate": {
    "verdict": "approved",
    "citation_count": 131,
    "audited_citation_count": 131,
    "reasons": []
  },
  "published": true,
  "destination": "/home/user/legacy-spec-agent/evals/document-quality/external/external-mixed-online-boutique/generated-documents"
}
```

Written to `publication-record.json` (response 279 bytes, 288.4 ms). `publish_approved_documents` re-gated a snapshot internally (the embedded `gate` block above shows that re-check) and only then populated `generated-documents/` atomically.

## Decision

**Publication authorized.** Authority: the tool's own verdict of `approved` with `citation_count == audited_citation_count` (131 == 131) and an empty `reasons` array, per the gate contract. This decision was made mechanically from the deterministic gate output — no deliverable content was inspected, edited, or judged by this actor beyond running the two gate commands.

## citation_count (131) versus the 146 line-by-line claims

The draft carries 146 cited claims counted line by line, but `evaluate_document_gate` reported `citation_count: 131` (and `audited_citation_count: 131`, matching it exactly). This is consistent with the known limitation recorded in `../external-ts-prisma-rest/FINDING-gate-citation-undercount.md`: fenced code blocks desynchronize the gate's `citationsIn()` scan in `connector/src/document-gate.ts`, causing it to under-count citations that follow a fence in the generated Markdown. This shortfall (146 line-by-line vs. 131 gate-counted) is a limitation of the gate's citation-counting enforcement, not a defect of this draft — the relevant acceptance condition is that `citation_count` equals `audited_citation_count` and `reasons` is empty, both of which hold here (131 == 131, `[]`).

## Three-round audit history

Per the task context, this draft reached the gate after three audit rounds:

- **Round 1:** the Independent Evidence Auditor flagged 10 claims.
- **Round 2:** those 10 corrections were accepted, but the audit flagged one new defect introduced by the correction.
- **Round 3:** all 146 claims (line-by-line count) were verified.

This actor did not re-run or second-guess that audit history; it is reported here as context for the decision, not re-derived.

## Publication confirmation — byte-identical check

All eight required files were confirmed present in `generated-documents/` and byte-identical to their `staging/` counterparts via `sha256sum`:

| File | SHA-256 (staging == generated-documents) | Result |
|---|---|---|
| SPEC.md | `12468f17...403eb` | MATCH |
| ARCHITECTURE.md | `a3bca9d2...b4a54` | MATCH |
| INTERFACES.md | `d2cf97c0...f5b8c` | MATCH |
| DATA_MODEL.md | `09d387d4...887f94` | MATCH |
| ONBOARDING.md | `d00590fd...27b2db` | MATCH |
| TESTCASES.md | `234b428b...63e9fc9f7c` | MATCH |
| RISKS.md | `ca5ca28d...254f96f` | MATCH |
| audit_log.jsonl | `66fa68be...93db538d0` | MATCH |

(Full 64-character digests are recorded in the terminal output of this session; all eight comparisons matched exactly.)

### Publication-record details

- **Destination:** `/home/user/legacy-spec-agent/evals/document-quality/external/external-mixed-online-boutique/generated-documents`
- **Previous publication replaced:** No. Before Step 2 ran, the case directory listing showed no `generated-documents/` subdirectory at all (only `actual-surfaces.jsonl`, `case-manifest.json`, `coverage-audit*.json`, `draft-digest.txt`, `evidence-audit*.json`, `extractor-result.json`, `extractor-run.json`, `gold-*`, `raw-extractor-output.json`, `scope-manifest.json`, `staging`). This publish call therefore created `generated-documents/` for the first time for this case; it did not overwrite or replace a prior publication.
- `publish_approved_documents` reported `published: true` with the embedded gate re-check matching the Step 1 evaluate result exactly (131/131, no reasons).

## Deliverable-modification statement

This actor (gatekeeper-ext3) made no edits to any `.md` file in `staging/`, `audit_log.jsonl`, `evidence-audit.json`, `coverage-audit.json`, `scope-manifest.json`, or `draft-digest.txt`. The only files this actor caused to be written are the tool-generated `gate-result.json`, `publication-record.json`, the atomically populated `generated-documents/` directory (a byte-identical copy produced by `publish_approved_documents`, not hand-edited), and this decision record.
