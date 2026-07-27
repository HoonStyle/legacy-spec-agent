# Agent Roles & Schemas — legacy-spec-agent

Detailed contracts for Mode A. `SKILL.md` controls profile selection: `standard` is the default and `core` is an explicit reduced-output request. Every role preserves the same evidence, stable-ID, absence, and cross-reference rules.

## Shared contract

- Ground every factual claim in a `path:line` citation. Otherwise assign a stable `UV-*` ID and isolate it under Unverified.
- Assign stable IDs by type: `BR-*` business rules, `API-*` interfaces, `DM-*` entities/contracts, `TC-*` tests/scenarios, `RSK-*` risks, and `UV-*` unverified items. Preserve IDs for unchanged items; never reuse an ID for a different item.
- Express cross-document links as exact IDs and require each link to resolve to exactly one item of the expected type.
- If a required concept is absent, report the searched paths/file types/symbols and **Not found**. Do not emit an empty section or invent content.

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

## Phase 2 — Architect (inline)

**Role:** Assemble extractor results into `ARCHITECTURE.md` and the architectural portions of the other documents.

Include system context, component inventory, runtime/deployment view, module dependency view, external systems/data stores, major execution flows, trust boundaries, and analysis limitations. Confirm each node, flow, store, deployment statement, and trust boundary against source; otherwise use `UV-*` or **Not found** with search scope.

When using `build_call_graph`, display `graph_type: module_dependency` and `resolution: syntax`. It represents syntax-level import/module dependency edges, not actual method calls, compiler-resolved calls, runtime dispatch, or dynamic dispatch. Never relabel it as a call graph merely because of the tool's compatibility-preserving name.

## Phase 3 — Critic / Validator (inline, mandatory)

**Role:** Adversarially validate the complete selected-profile document set.

1. Open every cited `path:line` and verify that it supports the factual claim as written. Move unsupported or missing claims to a stable `UV-*` item rather than deleting them.
2. Emit one `audit_log.jsonl` entry for every citation in every markdown deliverable. Mechanical line validity is not semantic proof; note that distinction.
3. Build an ID index across all documents. Verify uniqueness, required prefixes, target existence, correct target type, and the semantic validity of every `Related` reference.
4. Check required sections and fields, profile membership, **Not found** search scopes, separation of external contracts, and prohibited inferences (including keys/cardinality/cascades and method-call semantics).
5. Reject emission if any factual markdown claim lacks audit coverage, any ID reference is invalid, or any unsupported claim remains in a verified section.

Bias toward flagging ambiguity. A smaller grounded specification is better than plausible fiction.

## Phase 4 — Emitter (inline)

Emit the explicit `core` profile (`SPEC.md`, `ARCHITECTURE.md`, `audit_log.jsonl`) or the default `standard` profile (core plus `INTERFACES.md`, `DATA_MODEL.md`, `ONBOARDING.md`, `TESTCASES.md`, `RISKS.md`, charts, and `REPORT.html`). Connector availability is the generation condition for charts and `REPORT.html`; disclose an unavailable tool rather than hand-authoring substitutes.

Use separate `Analyzed source commit`, `Generated at`, and coverage/search-scope lines. Ensure:

- `SPEC.md` contains boundary, actors/entrypoints, use cases, `BR-*` rules, validation/errors, transitions, configuration, persistence/side effects, operations, limitations, and `UV-*` items.
- `ARCHITECTURE.md` contains every view and syntax-only limitation in the Architect contract.
- Every `API-*`, `DM-*`, `TC-*`, and `RSK-*` contains all fields required by `SKILL.md` and links to relevant IDs.
- `TESTCASES.md` separates existing automated tests, source-derived characterization scenarios, and external-contract test candidates.
- `RISKS.md` separates confirmed behavior, defect candidates, and unverified gaps.

Report modules covered/total, verified and unverified counts, top three risks/unknowns, profile, omitted connector-dependent artifacts, and Quality-tab results.

## Drift-Check (Mode B) classifier

For each existing identified claim and citation, classify it as intact, moved, drifted, orphaned, or unresolved. Preserve stable IDs, validate references after proposed moves, append audit findings, and never auto-edit `SPEC.md`. Unresolved checks are not drift.
