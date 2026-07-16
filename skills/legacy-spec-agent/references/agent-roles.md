# Agent Roles & Schemas — legacy-spec-agent

Detailed prompts for each phase. The main SKILL.md orchestrates; this file holds the contracts you hand to subagents (Phase 1 fan-out) and the checklists for the inline phases.

---

## Phase 1 — Extractor (per-module subagent)

Hand each subagent exactly one module path plus this contract.

**Role**: You reverse-engineer what one module *actually does* from its source. You report only what the code shows. You never infer intent that the code does not support; when you must infer, you mark it clearly and it will be quarantined downstream.

**Task**:
1. Read every source file in the assigned module path.
2. For each meaningful unit (entry point, public function, class, handler, job), record:
   - **Responsibility** — one line, what it does
   - **Business rules** — conditionals, thresholds, validations, state transitions that encode domain logic
   - **Inputs / Outputs** — parameters, return shapes, emitted events
   - **Side effects / External calls** — DB writes, network calls, file/queue I/O
   - **Constraints** — assumptions the code depends on (ordering, non-null, config keys)
3. Attach a `path:line` citation to **every** item. If you cannot cite it, put it under `unverified` with the reason.

**Output schema** (return this exact JSON, nothing else):
```json
{
  "module": "<path>",
  "responsibility": "<one line>",
  "items": [
    {"kind": "rule|io|side_effect|constraint|entrypoint",
     "claim": "<short statement>",
     "evidence": "path:line",
     "confidence": "high|medium"}
  ],
  "unverified": [
    {"claim": "<inference the code does not fully support>", "reason": "<why>"}
  ]
}
```

**Rules for the extractor**:
- Prefer quoting behavior over guessing purpose. "Rejects orders where qty <= 0 (`orders.py:88`)" beats "validates business constraints."
- Do not read other modules. Cross-module wiring is the Architect's job.
- Round nothing, invent no metrics, add no domain terms the code doesn't use.

---

## Phase 2 — Architect (inline)

**Role**: Assemble the per-module JSON into a system picture.

**Task**:
1. Build the module→module edge list from imports, calls, and shared stores found in the extractor outputs (open code to confirm an edge if unsure).
2. Identify external dependencies (DBs, queues, third-party APIs).
3. Emit a Mermaid `flowchart TD` into `ARCHITECTURE.md`: nodes = modules + external systems, edges = calls/data flow. Keep labels short.
4. Write a short data/control-flow narrative for `SPEC.md` — no diagram duplication.

**Guardrail**: an edge in the diagram must trace to real code. If you drew it from a guess, drop it or mark the narrative as unverified.

---

## Phase 3 — Critic / Validator (inline, mandatory)

**Role**: Adversarial checker. Assume each claim is wrong until the cited code proves it.

**Task** — for every item across all modules:
1. Open the `path:line`.
2. Decision:
   - **verified** — code substantiates the claim as written.
   - **flagged** — citation missing / points to the wrong place / code doesn't support the claim → move to *Unverified* in `SPEC.md` with the reason.
3. Emit one `audit_log.jsonl` line per decision (`action: "verified"` or `"flagged"`).

**Bias**: when the code is ambiguous, flag rather than pass. A smaller spec you can trust beats a fuller one you can't. Do not let a plausible-sounding claim through just because it reads well.

---

## Phase 4 — Emitter (inline)

Assemble verified items into `SPEC.md` (template in SKILL.md), write `ARCHITECTURE.md`, finalize `audit_log.jsonl`. Report to the user: modules covered / total, verified count, unverified count, top 3 risks or unknowns.

---

## Drift-Check (Mode B) classifier

For each existing claim, open its citation in current code and classify:
- **intact** — code still supports the claim at the cited (or trivially shifted) location.
- **moved** — same behavior, different location → propose updated citation.
- **drifted** — behavior at/around the citation changed so the stated rule is no longer true → this is the finding that matters most.
- **orphaned** — cited code no longer exists.

Emit `DRIFT_REPORT.md` and append findings to `audit_log.jsonl`. Never auto-edit `SPEC.md`; present proposed diffs for the human to merge.

---

## Optional deliverable emitters (run after the Critic gate)

Only build these from **verified** items. Each row still needs a `path:line`.

**INTERFACES.md** — enumerate public functions/classes/entrypoints. For each: exact signature (read it, don't paraphrase), inputs, output shape, and the I/O contract (stdin/stdout/exit/env for CLI-style entrypoints). List `_`-prefixed helpers separately as *internal, not contract*. Anything about an external/host schema the package doesn't define goes to Unverified.

**TESTCASES.md** — characterization tests, one per verified business rule. Format each as `Given / When / Then (current behavior)` plus the `path:line` it locks. Frame the whole file as behavior-locking for refactoring, NOT requirement conformance. Rules: derive only from verified claims; never from flagged/unverified; omit cases that depend on an external contract; do not claim branch/exhaustive coverage.

**RISKS.md** — one row per `flagged` audit entry and per `Unverified` spec item: finding, evidence `path:line`, suggested action, and a triage-level severity explicitly labeled as a reconstruction-time judgment (not a measured metric). Never present a candidate as a confirmed defect.

## Notes on the "RAG" question
Claude Code reads real files on demand, so for demo-to-mid-size repos this on-demand exploration *is* the retrieval layer, and citations come for free because you're reading actual lines. A persistent vector index (Chroma / AnythingLLM) only becomes necessary when the codebase exceeds what fan-out subagents can cover in context — that is the Phase-2 productization trigger noted in `SPEC.md`, not an MVP requirement.

That Phase-2 design is now specified: an MCP connector with a tree-sitter symbol index (not a vector store) plus deterministic citation verification and drift detection — see `CONNECTOR_DESIGN.md`.
