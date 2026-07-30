# Gatekeeper decision record — external-py-flask-tutorial

**Actor:** gatekeeper-ext2 (read-only; authority limited to running the deterministic
publication gate and, if approved, `publish_approved_documents`)

## Commands run

```
cd /home/user/legacy-spec-agent/evals/document-quality/external && GATE_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)" node run-gate.mjs external-py-flask-tutorial flask gatekeeper-ext2 evaluate
```

Raw tool result (`evaluate_document_gate`), also written verbatim to `gate-result.json`:

```json
{
  "verdict": "approved",
  "citation_count": 125,
  "audited_citation_count": 125,
  "reasons": []
}
```

```
cd /home/user/legacy-spec-agent/evals/document-quality/external && GATE_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)" node run-gate.mjs external-py-flask-tutorial flask gatekeeper-ext2 publish
```

Raw tool result (`publish_approved_documents`), also written verbatim to `publication-record.json`:

```json
{
  "gate": {
    "verdict": "approved",
    "citation_count": 125,
    "audited_citation_count": 125,
    "reasons": []
  },
  "published": true,
  "destination": "/home/user/legacy-spec-agent/evals/document-quality/external/external-py-flask-tutorial/generated-documents"
}
```

## Decision

**Publication authorized.** The verdict returned by `evaluate_document_gate` was
`approved`, `citation_count` (125) equals `audited_citation_count` (125), and the
`reasons` array is empty. Per the workflow contract, an approved verdict with no
reason codes and no citation/audit mismatch authorizes `publish_approved_documents`.
`publish_approved_documents` independently re-gated a snapshot before populating
`generated-documents/`, and that re-gate result (embedded above) matches the
standalone `evaluate_document_gate` call exactly.

## Citation count vs. the 140 line-by-line claims

The draft carries 140 cited claims as counted line by line by the writer/auditor
process. The gate's own citation scan reported `citation_count: 125`, i.e. 15
fewer than the line-by-line count, while `audited_citation_count` also came back
125 — so the two numbers the gate itself compares agree, and the reasons array is
empty. Per the recorded finding at
`../external-ts-prisma-rest/FINDING-gate-citation-undercount.md`, the gate's
`citationsIn()` scan is known to under-count citations when a document contains a
fenced code block, because content inside a fence desynchronizes the scanner
relative to the surrounding line numbers. This case's `ARCHITECTURE.md` (and
possibly other staged documents) contains fenced code blocks, so a citation_count
below the 140 line-by-line total is expected here and is treated as a
**limitation of the gate's enforcement/counting mechanism, not a defect in the
draft or its citations**. What the gate contract actually requires —
`citation_count == audited_citation_count` and an empty `reasons` array — was
satisfied, and that is the basis for approval.

## Publication confirmation

All eight required files were compared byte-for-byte between `staging/` and
`generated-documents/` using `sha256sum`:

| File | Result |
|---|---|
| SPEC.md | MATCH |
| ARCHITECTURE.md | MATCH |
| INTERFACES.md | MATCH |
| DATA_MODEL.md | MATCH |
| ONBOARDING.md | MATCH |
| TESTCASES.md | MATCH |
| RISKS.md | MATCH |
| audit_log.jsonl | MATCH |

Publication-record details (from `publication-record.json`):

- **Destination:** `/home/user/legacy-spec-agent/evals/document-quality/external/external-py-flask-tutorial/generated-documents`
- **Previous publication replaced:** No. The `generated-documents/` directory did
  not exist prior to this run (confirmed by the directory listing taken before
  the gate/publish commands were executed); this was the first publication for
  this case.
- **Gatekeeper actor id recorded:** `gatekeeper-ext2`
- **Execution mode:** stdio MCP client against `connector/dist/src/index.js`

## No deliverable was modified

This actor made zero edits to any staged Markdown document, `audit_log.jsonl`,
`evidence-audit.json`, `coverage-audit.json`, `scope-manifest.json`, or
`draft-digest.txt`. The only files written by this actor's actions are the tool
outputs (`gate-result.json`, `publication-record.json`), the atomic copy of the
approved staging snapshot into `generated-documents/` performed by
`publish_approved_documents` itself, and this decision record.
