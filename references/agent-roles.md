# Agent Roles & Schemas — legacy-spec-agent

Detailed contracts for Mode A. `SKILL.md` controls profile selection: `standard` is the default and `core` is an explicit reduced-output request. Every role preserves the same evidence, stable-ID, absence, and cross-reference rules.

## Shared contract

- Ground every factual claim in a `path:line` citation. Otherwise assign a stable `UV-*` ID and isolate it under Unverified.
- Assign stable IDs by type: `BR-*` business rules, `API-*` interfaces, `DM-*` entities/contracts, `TC-*` tests/scenarios, `RSK-*` risks, and `UV-*` unverified items. Preserve IDs for unchanged items; never reuse an ID for a different item.
- Express cross-document links as exact IDs and require each link to resolve to exactly one item of the expected type.
- If a required concept is absent, report the searched paths/file types/symbols and **Not found**. Do not emit an empty section or invent content.

### Frozen scope manifest

The machine-readable contract is `references/scope-manifest.schema.json`; the deterministic runtime validator additionally enforces truncation arithmetic, unique module assignments, source inventory counts, and the frozen draft digest.

Before the Writer runs, freeze a scope manifest containing the analyzed source commit, included and excluded paths (with reasons), counts of `supported`, `unsupported`, `failed`, and `skipped` files, whether any input was truncated, and the Extractor assigned to each module. All later roles receive the same manifest. A truncated input must identify its returned, total, and omitted counts; it cannot be treated as complete coverage. Any correction that changes scope requires a new frozen manifest and fresh audits.

The pre-Writer scope freeze records the Writer `actor_id`; the draft-freeze step completes the manifest with the SHA-256 `draft_digest` of the selected-profile Markdown files. Evidence Auditor, Coverage Sentinel, and Gatekeeper records include their own `actor_id` and the audited `draft_digest`; the deterministic document gate rejects any identity collision between these four roles, a digest that differs from the actual Markdown, or an audit of a stale draft. Actor IDs are opaque provenance identifiers, not internal reasoning transcripts.

## Phase 1 — Extractor (per-module subagent)

**Role:** Reverse-engineer what one module actually does. Read every source file in scope and report grounded boundaries, actors/entrypoints, use cases, business rules, validation/errors, state transitions, configuration, persistence/side effects, operational behavior, known limitations, interfaces, data contracts, existing tests, and potential risks.

For interfaces capture caller, protocol, exact signature, request/response schema, validation, errors, side effects, timeout/cancellation, and idempotency. For data, distinguish persistent entities from configuration/interface contracts and capture field type, requiredness, default, validation, explicit relations, lifecycle, and evidence. Never infer external contracts, keys, cardinality, cascade behavior, or runtime semantics.

**Output schema:**
```json
{
  "module": "<path>",
  "search_scope": ["<paths/globs/symbol sources>"],
  "items": [
    {
      "id": "BR-*|API-*|DM-*|TC-*|RSK-*",
      "kind": "rule|interface|data_model|test|risk|entrypoint|behavior",
      "claim": "<short statement>",
      "evidence": ["path:line"],
      "related_ids": ["<stable ID>"],
      "details": {},
      "confidence": "high|medium"
    }
  ],
  "not_found": [{"concept": "<required concept>", "searched": "<scope>"}],
  "unverified": [{"id": "UV-*", "claim": "<claim>", "reason": "<why>", "searched": "<scope>"}]
}
```

Prefer precise behavior over guessed purpose. Do not round, invent metrics, introduce unsupported domain terms, or silently inspect outside the assigned module; cross-module wiring belongs to the Architect.

## Phase 2 — Architect / Writer

**Role:** Assemble extractor results into `ARCHITECTURE.md` and the architectural portions of the other documents.

Include system context, component inventory, runtime/deployment view, module dependency view, external systems/data stores, major execution flows, trust boundaries, and analysis limitations. Confirm each node, flow, store, deployment statement, and trust boundary against source; otherwise use `UV-*` or **Not found** with search scope.

When using `build_call_graph`, display `graph_type: module_dependency` and `resolution: syntax`. It represents syntax-level import/module dependency edges, not actual method calls, compiler-resolved calls, runtime dispatch, or dynamic dispatch. Never relabel it as a call graph merely because of the tool's compatibility-preserving name.

The Writer produces the complete selected-profile draft from the frozen scope manifest and then freezes it for audit. The Writer may correct a rejected draft, but may not audit, approve, or emit its own work.

## Phase 3 — Independent Evidence Auditor (separate subagent, mandatory)

**Role:** Adversarially validate the complete, frozen selected-profile draft. This role must be a different subagent from the Writer/Architect, receives only the completed draft, frozen scope manifest, and source evidence needed to audit it, and must not use the Writer's internal reasoning or self-verification results as audit evidence.

1. Open every cited `path:line` and verify that it supports the factual claim as written. Move unsupported or missing claims to a stable `UV-*` item rather than deleting them.
2. Emit one `audit_log.jsonl` entry for every citation in every markdown deliverable. Mechanical line validity is not semantic proof; note that distinction. Every cited factual line must declare a stable `CLM-*` claim ID and have exactly one corresponding `verified` row with the same `claim_id`; never invent audit-only claim IDs.
3. Build an ID index across all documents. Verify uniqueness, required prefixes, target existence, correct target type, and the semantic validity of every `Related` reference.
4. Check required sections and fields, profile membership, **Not found** search scopes, separation of external contracts, and prohibited inferences (including keys/cardinality/cascades and method-call semantics).
5. Reject emission if any factual markdown claim lacks audit coverage, any ID reference is invalid, or any unsupported claim remains in a verified section.

Bias toward flagging ambiguity. A smaller grounded specification is better than plausible fiction.

## Phase 4 — Coverage Sentinel (separate subagent, mandatory)

**Role:** Audit in the reverse direction from code to documentation. Starting from the frozen code surface—not merely citations already selected by the Writer—enumerate registered APIs, extracted data contracts, environment variables, entrypoints, status/state values, test files, and external side effects. Match each item to the corresponding `API-*`, `DM-*`, `BR-*`, `TC-*`, or `RSK-*` item. An omission is acceptable only when the manifest search boundary and a specific exclusion reason explain it.

**Output schema:**
```json
{
  "expected_count": 0,
  "documented_count": 0,
  "covered_items": [{"surface": "<item>", "found_at": "path:line", "document_id": "API-*|DM-*|BR-*|TC-*|RSK-*"}],
  "explained_omissions": [{"surface": "<item>", "found_at": "path:line", "expected_document_type": "API|DM|BR|TC|RSK", "reason": "<scope/exclusion reason>"}],
  "unexplained_omissions": [{"surface": "<item>", "found_at": "path:line", "expected_document_type": "API|DM|BR|TC|RSK"}],
  "truncated_inputs": [{"source": "<tool/scope>", "returned": 0, "total": 0, "omitted": 0}],
  "verdict": "passed|failed",
  "actor_id": "<opaque auditor identity>",
  "draft_digest": "<frozen draft digest>"
}
```

`expected_count` counts every enumerated surface item; `documented_count` counts items mapped to a correctly typed document ID. `verdict` is `failed` when any omission is unexplained or any truncation is absent from the manifest and deliverable coverage disclosures.

## Phase 5 — Correction and independent recheck

The Writer may correct a rejected frozen draft. After any correction, the independent auditors must re-verify every changed claim, citation, and ID and rerun affected deterministic contract checks. The Writer's change notes are navigation aids, not evidence, and the Writer cannot issue the audit verdict.

## Phase 6 — Gatekeeper (separate subagent, mandatory)

**Role:** Read but never write or modify the documents. Combine the Independent Evidence Auditor verdict, Coverage Sentinel verdict, and deterministic citation, ID, section/profile, provenance, and graph-label contract checks. Output exactly `approved` or `rejected`; only the Gatekeeper may approve publication.

When available, `evaluate_document_gate` is mandatory. Pass it the frozen manifest and both audit records, and use its verdict rather than recreating a weaker inline check. Its reason codes are correction diagnostics; they do not authorize the Gatekeeper to edit the draft.

The Gatekeeper must reject publication for any of the following:

- an unsupported claim in a verified section;
- citation audit coverage below 100%;
- any unexplained code-surface omission;
- a duplicate, dangling, or type-mismatched ID;
- truncation that is not disclosed in the scope manifest and document coverage;
- a required document or required section that is missing; or
- a syntax module dependency represented as a call graph.

The Writer and final Gatekeeper must be different subagents regardless of repository size. The Writer cannot approve its own documents; an approval is invalid if produced by the Writer or based on the Writer's self-validation.

## Phase 7 — Emitter (inline)

Emit the explicit `core` profile (`SPEC.md`, `ARCHITECTURE.md`, `audit_log.jsonl`) or the default `standard` profile (core plus `INTERFACES.md`, `DATA_MODEL.md`, `ONBOARDING.md`, `TESTCASES.md`, `RISKS.md`, charts, and `REPORT.html`). Connector availability is the generation condition for charts and `REPORT.html`; disclose an unavailable tool rather than hand-authoring substitutes. Keep the frozen draft in staging until approval; when `publish_approved_documents` is available, use it to transactionally replace the destination only after the gate approves.

Use separate `Analyzed source commit`, `Generated at`, and coverage/search-scope lines. Ensure:

- `SPEC.md` contains boundary, actors/entrypoints, use cases, `BR-*` rules, validation/errors, transitions, configuration, persistence/side effects, operations, limitations, and `UV-*` items.
- `ARCHITECTURE.md` contains every view and syntax-only limitation in the Architect contract.
- Every `API-*`, `DM-*`, `TC-*`, and `RSK-*` contains all fields required by `SKILL.md` and links to relevant IDs.
- `TESTCASES.md` separates existing automated tests, source-derived characterization scenarios, and external-contract test candidates.
- `RISKS.md` separates confirmed behavior, defect candidates, and unverified gaps.

Report modules covered/total, verified and unverified counts, top three risks/unknowns, profile, omitted connector-dependent artifacts, and Quality-tab results.

## Drift-Check (Mode B) classifier

For each existing identified claim and citation, classify it as intact, moved, drifted, orphaned, or unresolved. Preserve stable IDs, validate references after proposed moves, append audit findings, and never auto-edit `SPEC.md`. Unresolved checks are not drift.
