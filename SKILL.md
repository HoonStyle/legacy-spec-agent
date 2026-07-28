---
name: legacy-spec-agent
description: Reverse-engineer a specification from undocumented legacy code, and track drift between the code and that spec. Use this whenever the user wants to understand what an unfamiliar or undocumented codebase actually does, onboard onto legacy code, generate the missing spec/documentation from source, reconstruct business rules or architecture from code, or detect when code has diverged from its documented intent — even if they never say the word "spec" (e.g. "what does this repo actually do", "document this legacy system", "I inherited this codebase and there are no docs", "did anything break the original design").
---

# Legacy Spec Agent

Reconstruct a **grounded specification** from code that has no usable documentation, then keep that spec honest by detecting **drift** when the code changes.

The premise is deliberate: in real legacy systems the spec is missing but **the code is always there.** So this skill never asks for a spec as input — it mines one out of the source, and every claim it emits must be backed by a `file:line` citation. Anything it cannot ground in code is quarantined as *unverified*, never presented as fact.

> Guiding rule — **no ungrounded sentence ships.** A reconstructed rule without a code citation is a guess, and a guess in a spec is worse than a blank. This mirrors "Fact First": evidence gates every line.

---

## Two modes

Decide which mode you are in before doing anything else.

- **Mode A — Reverse-Spec** (default, first run on a repo): produce a grounded artifact profile from scratch. The default `standard` profile emits the complete documentation set; use `core` only when the user explicitly requests it.
- **Mode B — Drift-Check** (a prior `SPEC.md` from this skill already exists): re-verify each existing claim's citation against the *current* code and emit `DRIFT_REPORT.md`, appending to `audit_log.jsonl`.

If a `SPEC.md` produced by this skill exists in the target output location, default to Mode B and say so; otherwise Mode A.

---

## Workflow (Mode A)

Run the phases in order. Each phase maps to a role documented in `references/agent-roles.md` — read that file for the detailed extraction/critic prompts before Phase 1. Select the output profile during scoping: `standard` is the default; `core` requires an explicit user request. Profile selection changes which documents are emitted, never the evidence standard or Critic gate.

The mandatory sequence is **Extract → Architect/Writer → draft freeze → independent Evidence Audit + Coverage Audit → correction → independent recheck → Gatekeeper → Emit**. Regardless of repository size, the Writer and the final Critic/Gatekeeper must be different subagents.

### Phase 0 — Scope & Ingest
1. Map the tree with Glob; identify the primary language and the top-level modules/packages.
2. If the codebase is large or multi-language, **confirm scope with the user** (one language / a subtree) rather than silently sampling. Never cap coverage silently — if you scope down, say what you left out.
3. Build a module list. This list drives the fan-out in Phase 1.
4. Before the Writer runs, freeze the scope fields of a manifest conforming to `references/scope-manifest.schema.json`: the analyzed source commit, included paths, excluded paths and reasons, `supported`/`unsupported`/`failed`/`skipped` file counts, truncation status (including returned/total/omitted when truncated), the Extractor assigned to every module, and the Writer's opaque `actor_id`. At draft freeze, add the SHA-256 `draft_digest` of the selected-profile Markdown files and do not mutate the manifest thereafter. Give the identical completed manifest to both auditors and Gatekeeper. Auditor results carry their own `actor_id` and the audited `draft_digest`. A scope or draft change requires a newly frozen manifest and fresh audits; do not record internal reasoning as provenance.

**Missing language toolchains.** The analysis environment may not match the source repository's development environment. When a parser, SDK, or semantic-analysis tool required for a detected language is absent:
- If `assess_language_toolchains` is available, call it before choosing language-specific analysis tools. It detects the five supported language families, repository version pins, local SDK availability, and returns a structured `consent_required` list without downloading or executing anything.
- First look for a compatible local toolchain, using repository pins such as `global.json`, `.python-version`, `.node-version`, `go.mod`, Maven/Gradle configuration, and manifest engine constraints to determine the required version.
- Before downloading anything, ask the user once. Name the tool and version, why it improves the analysis, its official source, approximate download size when known, and the isolated cache destination. Never treat a request to analyze the repository as download consent.
- After displaying the exact official HTTPS artifact URL and published SHA-256 and receiving explicit approval, call `approve_toolchain_download`; pass its short-lived one-use token to `download_language_toolchain`. Poll `get_toolchain_download_status` and report byte/percentage plus state as the progress indicator; offer `cancel_toolchain_download` while active. A completed download is only a verified artifact—do not extract or install it without separate consent.
- Offer two explicit paths: **download and verify the artifact for a separately approved installation step**, or **continue without downloading**. Pass the resulting per-language `download`/`skip` decisions back to `assess_language_toolchains` so declines are not requested again. A decline, unavailable interaction channel, timeout, or download failure must not stop the run; continue with direct source reading when no parser exists, or an available syntax-only parser when one does, and disclose which semantic results could not be verified.
- Remember the decision for that toolchain for the rest of the run; do not ask repeatedly. Multiple missing toolchains may be consolidated into one request as long as each download is listed separately.
- Download consent covers only the named analysis toolchain. It does not authorize dependency restore, project build, install hooks, repository scripts, or executing target code; obtain separate explicit consent before any of those actions.
- Use only an official distribution, pin the resolved version, require its published checksum, and download into the connector-managed cache rather than modifying the system toolchain. In non-interactive environments, default to no download unless the user supplied an explicit opt-in policy.

**Scaling a large repo (connector present).** Deliverables grow with the codebase, so keep them bounded and honest:
- Before pulling file-level detail, get a size read by calling `index_symbols` and `build_call_graph` with `granularity: "package"`. They return per-package counts and collapsed package-to-package edges.
- A `truncated` field in a connector result means the output was capped. State the omitted count in the coverage line (no silent caps), then raise `limit` or narrow `subdir` deliberately.
- When the module count is large, split `SPEC.md` and `INTERFACES.md` per package instead of emitting one unreadable file, and render the architecture at package granularity (or pass `cluster: true` to `emit_charts` so file nodes are grouped into subgraphs).

### Phase 1 — Extract (fan-out)
If the `index_symbols` connector tool is available, call it first and hand each subagent its module's symbol list (names, line ranges, signatures) so subagents don't re-read files from scratch. Likewise, prefer `build_call_graph` over manual import-tracing in Phase 2.

For each module, extract what it *actually does*: entry points, business rules, inputs/outputs, side effects, external calls, and constraints. **Every extracted item carries a `path:line` citation.**

- For a repo with more than a handful of modules, spawn one `general-purpose` subagent per module (or per cluster) via the Task tool and run them in parallel. Give each subagent the module path, the extraction contract from `references/agent-roles.md`, and the output schema.
- For a small repo, extract inline with Read/Grep.

### Phase 2 — Architect
Synthesize the per-module findings into system structure: module boundaries, call/data-flow edges, and external dependencies. Emit a Mermaid diagram (`flowchart` or `graph`) into `ARCHITECTURE.md`. On a large repo, prefer a **package-granularity** graph (or `cluster: true`) so the diagram stays legible instead of rendering hundreds of nodes.

### Phase 3 — Draft freeze and independent audits (mandatory)
If the `verify_citation` connector tool is available in the session, use it for every citation check below (it is deterministic and returns the exact source); fall back to inline Read/Grep only when the connector is absent.

Freeze the complete selected-profile draft before auditing it. Assign an **Independent Evidence Auditor** that is a different subagent from the Writer/Architect. It receives the completed draft and frozen scope manifest; the Writer's internal reasoning and self-verification are not admissible audit evidence.

Re-check every claim from Phase 1–2 against the code:
- Open the cited `path:line`. If the code substantiates the claim → **verified**.
- If the citation is missing, wrong, or the code doesn't support it → move the item to an **Unverified / Needs-review** section. Do **not** delete it silently and do **not** promote it to the main spec.
- Record each verified/flagged decision as an `audit_log.jsonl` entry. Every cited factual line must declare a stable `CLM-*` claim ID, and the same `claim_id` must appear exactly once in its `verified` audit row; the deterministic gate rejects missing, duplicate, or invented claim-ID audits.
- Audit coverage must match the emitted markdown: every `path:line` citation that appears in a generated markdown deliverable gets an audit entry. If a citation is only mechanically line-valid but the natural-language claim still needs human judgment, say that in the entry `note` instead of inflating it into semantic proof.

This gate is what separates this skill from "ask an LLM to summarize a repo." Do not skip it.

In parallel, assign a **Coverage Sentinel** to reverse-check code → documentation. It enumerates registered APIs, extracted data contracts, environment variables, entrypoints, status/state values, test files, and external side effects from the frozen code scope, then matches them to correctly typed `API-*`, `DM-*`, `BR-*`, `TC-*`, and `RSK-*` entries. It must report the structured schema in `references/agent-roles.md`, including discovered locations and expected document types for every omission. Citation accuracy alone cannot make an incomplete draft pass.

### Phase 4 — Correction, independent recheck, and Gatekeeper

The Writer may correct audit findings but cannot generate the final audit verdict or approve its own documents. After a draft correction, independent auditors must re-verify every changed claim, citation, and ID, then rerun affected deterministic contract checks.

A separate **Gatekeeper** does not write or modify documents. It combines the Evidence Auditor, Coverage Sentinel, and deterministic contract-check results and returns only `approved` or `rejected`. Only its `approved` verdict authorizes emission. It must reject unsupported verified claims, citation audit coverage below 100%, unexplained code-surface omissions, duplicate/dangling/type-mismatched IDs, undisclosed truncation, missing required documents or sections, stale draft digests, Writer/auditor/Gatekeeper identity collisions, and syntax module dependencies represented as a call graph.

If `evaluate_document_gate` is available, the Gatekeeper must call it with the completed frozen manifest and both independent audit records; do not substitute the report Quality tab or the Writer's judgment. Its independently extracted code surface and SHA-256 comparison are the deterministic publication result. A `rejected` result returns the draft to correction and independent recheck; only `approved` proceeds to Emit. When `publish_approved_documents` is available, keep the frozen draft in a staging directory and use that tool for the final transactional publish; never copy a rejected staging draft into the destination.

### Phase 5 — Emit
Emit the selected profile and report a one-paragraph summary to the user: module count, verified-claim count, unverified count, and the top 3 risks/unknowns.

- **`core` (explicit opt-in):** `SPEC.md`, `ARCHITECTURE.md`, and `audit_log.jsonl`.
- **`standard` (default):** every `core` artifact plus `INTERFACES.md`, `DATA_MODEL.md`, `ONBOARDING.md`, `TESTCASES.md`, `RISKS.md`, charts, and `REPORT.html`.

A standard-profile document is required even when its subject is absent. Never leave it empty and never fill it with assumptions: state the searched paths/file types/symbols or connector scope and say **Not found**. Put claims blocked by missing source or an external contract in an `Unverified` section with stable `UV-*` IDs. Charts and `REPORT.html` require `emit_charts` and `render_report`; when either connector tool is unavailable, record the generation condition and the reason the artifact was not created rather than hand-authoring misleading substitutes.

Before writing files, normalize provenance and quality metadata:
- Use separate provenance lines, not one ambiguous source line: `Analyzed source commit: <git ref or date>` and `Generated at: <runtime timestamp/date>`.
- Coverage lines must name both what was covered and what was deliberately skipped. If connector results are truncated, include `returned`, `total`, and `omitted`.
- Split product/business rules from implementation/runtime rules. Do not label build scripts, package metadata, or launch behavior as business rules unless the domain code actually makes them business rules.
- Assign stable IDs within the analysis baseline: business rules `BR-*`, interfaces `API-*`, data models/contracts `DM-*`, test cases `TC-*`, risks `RSK-*`, and unverified items `UV-*`. Preserve an existing ID when the same item is regenerated. References use the exact ID (for example, `Related: BR-003, API-002`); every referenced ID must resolve to exactly one item in the emitted document set. Never reuse an ID for a different item.

If `build_call_graph` contributes to `ARCHITECTURE.md`, label its output exactly as `graph_type: module_dependency` and `resolution: syntax`, and explicitly state that it is not a method call graph and does not resolve runtime or dynamic dispatch.

If the `render_report` connector tool is available for the standard profile, finish by calling it on the deliverables directory. It assembles the markdown deliverables, `audit_log.jsonl`, and `charts/` into a self-contained `REPORT.html` with a Quality tab. The Quality tab is a mechanical quality gate, not a replacement for semantic critic review. Save chart SVGs from `emit_charts` into `charts/`; to replace a Mermaid fence, use `charts/<DOC>.<n>.svg` (or `.png`).

Quality floor for generated output:
- Every factual claim in every markdown deliverable has a code/repository citation or is isolated under an identified `UV-*` item.
- `audit_log.jsonl` covers every emitted markdown citation.
- All cross-document ID references resolve and match the referenced item type.
- No unsupported factual claim is promoted into a verified section.
- When a required concept is absent, the document records the search scope and **Not found** instead of being blank.

---

## Workflow (Mode B — Drift-Check)
If the `detect_drift` connector tool is available, prefer it. Pass the SPEC's generation commit as `baseline_ref` (the commit in its `Source:` line — this must be a git ref; if the line only records a date, resolve the commit first or fall back to the manual steps) along with the citation list. The tool returns the intact/moved/drifted/orphaned classification deterministically; write the report from that. Entries that come back as `error` (non-git root, unreadable ref, malformed path) are unresolved, not drift: report them in their own section and never count them toward drift. Use the manual steps below only when the connector is absent.

1. Load the existing `SPEC.md` and its citations.
2. For each claim, open the cited `path:line` in the *current* code.
3. Classify: **intact** (code still supports the claim), **moved** (same behavior, new location — update citation), **drifted** (behavior changed — code no longer matches the stated rule), or **orphaned** (cited code deleted).
4. Emit `DRIFT_REPORT.md` (template below) and append every drift/moved/orphaned finding to `audit_log.jsonl`. Do not rewrite `SPEC.md` automatically — propose the diffs and let the user confirm.

---

## Output formats

All standard-profile markdown documents begin with analyzed-source, generation-time, and coverage/search-scope metadata. Every factual row or bullet carries evidence; absent concepts use **Not found** plus the search scope. All `Unverified` entries carry a `UV-*` ID and a reason.

### `SPEC.md`
ALWAYS include these sections:
1. **System purpose and boundary** — what is inside/outside the analyzed system.
2. **Actors and entrypoints** — human/system actors and code-defined entry surfaces.
3. **Core use cases** — grounded execution scenarios.
4. **Business rules** — stable `BR-*` IDs, behavior, evidence, and related IDs.
5. **Validation and error behavior** — rejection conditions, error types/messages/status when defined.
6. **State transitions** — source state, trigger, destination state, guards and side effects.
7. **Configuration** — keys, defaults and behavioral effects defined by code/manifests.
8. **Persistence and side effects** — durable writes, files, network, queues, processes and events.
9. **Operational behavior** — startup/shutdown, scheduling, concurrency, retry, timeout, logging and observability when present.
10. **Known limitations** — limitations explicitly demonstrated by source or repository metadata.
11. **Unverified / Needs-review** — `UV-*` items with searched scope and why verification failed.

When a section has no grounded concept, retain the heading and write **Not found**, including what was searched. Do not infer actors, rules, transitions, or operational guarantees.

### `ARCHITECTURE.md`
ALWAYS include system context, component inventory, runtime/deployment view, module dependency view, external systems/data stores, major execution flows, trust boundaries, and analysis limitations. Every node and asserted edge needs evidence. A `build_call_graph` result must be captioned `graph_type: module_dependency; resolution: syntax` and described as syntax-only import/module dependency analysis—not an actual method call graph, runtime dispatch graph, or compiler-resolved call graph.

### `INTERFACES.md`
For each `API-*`, record interface ID, caller, protocol/transport, exact signature, request schema, response schema, validation, errors, side effects, timeout/cancellation behavior, idempotency, evidence, and related IDs. Use **Not found** for a code-undefined field and cite the search scope. Contracts owned by an external host/service but not defined in the repository belong in a separate `UV-*` **Unverified external contracts** section, never reconstructed from convention.

### `DATA_MODEL.md`
Separate **persistent entities** from **configuration/interface contracts**. Each `DM-*` records fields with type, required/optional status, default, validation, relations, lifecycle, evidence, and related IDs. Only claim persistence and relations that code defines. Never infer primary keys, foreign keys, cardinality, cascade behavior, or lifecycle semantics. If no persistent entity exists, say **Not found**, state the model/schema search scope, and still document code-defined configuration/interface contracts.

### `ONBOARDING.md`
Record grounded prerequisites, dependency/build/test/run commands, configuration, environment, and troubleshooting. Commands must come from manifests, automation, or source citations. Missing setup knowledge is **Not found** or `UV-*`, not an invented procedure.

### `TESTCASES.md`
Use three distinct sections: **existing automated tests**, **source-derived characterization scenarios**, and **test candidates unverified because of external contracts**. Every `TC-*` includes Given/When/Then, related `BR-*` (and other IDs where useful), inputs, expected result, side effects, execution command, required environment/configuration, evidence, and status/category. Do not claim that a source-derived scenario already executes. External-contract candidates remain linked to `UV-*` and are not presented as verified tests.

### `RISKS.md`
Separate **confirmed behavior**, **defect candidates**, and **unverified gaps**. Every `RSK-*` includes severity, likelihood, impact, confidence, evidence, mitigation, suggested action, owner, status, and related IDs. Triage values are assessments, not measured facts; use `unknown`/`unassigned` where the repository does not ground owner or status. Never label a candidate as a confirmed defect.

### `DRIFT_REPORT.md`
Classify cited claims as intact, moved, drifted, orphaned, or unresolved. Unresolved checks are not drift. Preserve stable IDs and propose changes without automatically rewriting `SPEC.md`.

### `audit_log.jsonl`
Append one JSON object per citation decision. Timestamps come from the runtime. Include the item ID, action, claim, evidence, document, optional note, and baseline reference. Audit coverage must include every citation in every emitted markdown document.

## Optional deliverables and generation conditions

`core` and `standard` are the only artifact profiles. `standard` includes the full set above and is the default; `core` is an explicit reduced-output request. The following additions remain optional even relative to those profiles:

- **`CHANGELOG.md`** — generate only when requested and Git history is available. Group conventional commits by type and include grounded hash/date/author/scope metadata.
- **Additional charts** — generate only when requested or when a standard document has supported chart data. Never draw an edge or relation that lacks evidence.

`REPORT.html` and charts are standard-profile deliverables when their connector tools are available. Without those tools, disclose that generation condition and omit them. Honesty rules apply to every profile and deliverable: no empty placeholder, no fabricated template filler, and no ungrounded row outside `Unverified`.

This skill does not emit ADRs, PRDs, or user manuals. Code shows behavior, not design intent or business intent; point requests for those documents to human-authored sources.

---

## Hard rules
1. **Citation or it doesn't ship.** No claim in the main spec without a `path:line` that a reader can open and confirm.
2. **Isolate, don't fabricate.** Ungroundable inferences go to *Unverified* — never into the body, never deleted quietly.
3. **Don't auto-rewrite in Drift mode.** Propose diffs; the human owns the merge.
4. **Say what you skipped.** Any scoping-down (language, subtree, sampling) is stated in the coverage line, not hidden.

---

## References
- `references/agent-roles.md` — per-phase extraction / architect / critic prompts and the subagent output schema. Read before Phase 1.
