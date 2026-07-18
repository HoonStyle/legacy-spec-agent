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

- **Mode A — Reverse-Spec** (default, first run on a repo): produce `SPEC.md`, `ARCHITECTURE.md`, and `audit_log.jsonl` from scratch.
- **Mode B — Drift-Check** (a prior `SPEC.md` from this skill already exists): re-verify each existing claim's citation against the *current* code and emit `DRIFT_REPORT.md`, appending to `audit_log.jsonl`.

If a `SPEC.md` produced by this skill exists in the target output location, default to Mode B and say so; otherwise Mode A.

---

## Workflow (Mode A)

Run the phases in order. Each phase maps to a role documented in `references/agent-roles.md` — read that file for the detailed extraction/critic prompts before Phase 1.

### Phase 0 — Scope & Ingest
1. Map the tree with Glob; identify the primary language and the top-level modules/packages.
2. If the codebase is large or multi-language, **confirm scope with the user** (one language / a subtree) rather than silently sampling. Never cap coverage silently — if you scope down, say what you left out.
3. Build a module list. This list drives the fan-out in Phase 1.

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

### Phase 3 — Critic gate (mandatory)
If the `verify_citation` connector tool is available in the session, use it for every citation check below (it is deterministic and returns the exact source); fall back to inline Read/Grep only when the connector is absent.

Re-check every claim from Phase 1–2 against the code:
- Open the cited `path:line`. If the code substantiates the claim → **verified**.
- If the citation is missing, wrong, or the code doesn't support it → move the item to an **Unverified / Needs-review** section. Do **not** delete it silently and do **not** promote it to the main spec.
- Record each verified/flagged decision as an `audit_log.jsonl` entry.
- Audit coverage must match the emitted markdown: every `path:line` citation that appears in a generated markdown deliverable gets an audit entry. If a citation is only mechanically line-valid but the natural-language claim still needs human judgment, say that in the entry `note` instead of inflating it into semantic proof.

This gate is what separates this skill from "ask an LLM to summarize a repo." Do not skip it.

### Phase 4 — Emit
Write the three artifacts using the templates below. Report a one-paragraph summary to the user: module count, verified-claim count, unverified count, and the top 3 risks/unknowns.

Before writing files, normalize provenance and quality metadata:
- Use separate provenance lines, not one ambiguous source line: `Analyzed source commit: <git ref or date>` and `Generated at: <runtime timestamp/date>`.
- Coverage lines must name both what was covered and what was deliberately skipped. If connector results are truncated, include `returned`, `total`, and `omitted`.
- Split product/business rules from implementation/runtime rules. Do not label build scripts, package metadata, or launch behavior as business rules unless the domain code actually makes them business rules.

If the `render_report` connector tool is available, finish by calling it on the deliverables directory. It assembles everything (the markdown deliverables, `audit_log.jsonl`, and `charts/`) into a single self-contained `REPORT.html` with one tab per document plus an automatically generated **Quality** tab. The Quality tab verifies cited files/line ranges and reports audit coverage; it is a mechanical quality gate, not a replacement for semantic critic review. Save chart SVGs from `emit_charts` into `charts/`; to have a diagram replace a mermaid fence inside a document, save it as `charts/<DOC>.<n>.svg` (or `.png`), where n is the fence's order within that document.

Quality floor for generated output:
- `audit_log.jsonl` entries should cover every emitted markdown citation, not just a small sample.
- `INTERFACES.md` should include request/response examples for high-value entrypoints and MCP tools when the code schema is available.
- `TESTCASES.md` should include a file-by-file or feature-by-feature coverage matrix when tests exist. Prefer `extract_project_meta.tests`, which reports test files, framework, test case names, and test-scoped environment variables; list skipped/gated acceptance tests and their enabling environment variables.
- `RISKS.md` should include at least severity, likelihood, impact, evidence, suggested action, and status/owner when the code or repo metadata supports those fields. If owner/status cannot be grounded, mark them unassigned/unknown rather than guessing.
- `DATA_MODEL.md` should separate persistent domain entities from configuration/interface data contracts. If no domain model exists, say so and document the code-defined contracts instead of emitting an empty ERD alone.
- `CHANGELOG.md` should group conventional commits by type and include commit hash plus any available date/author metadata from `extract_changelog`; do not output only a flat recent-commit list unless grouping data is unavailable.

---

## Workflow (Mode B — Drift-Check)
If the `detect_drift` connector tool is available, prefer it. Pass the SPEC's generation commit as `baseline_ref` (the commit in its `Source:` line — this must be a git ref; if the line only records a date, resolve the commit first or fall back to the manual steps) along with the citation list. The tool returns the intact/moved/drifted/orphaned classification deterministically; write the report from that. Entries that come back as `error` (non-git root, unreadable ref, malformed path) are unresolved, not drift: report them in their own section and never count them toward drift. Use the manual steps below only when the connector is absent.

1. Load the existing `SPEC.md` and its citations.
2. For each claim, open the cited `path:line` in the *current* code.
3. Classify: **intact** (code still supports the claim), **moved** (same behavior, new location — update citation), **drifted** (behavior changed — code no longer matches the stated rule), or **orphaned** (cited code deleted).
4. Emit `DRIFT_REPORT.md` (template below) and append every drift/moved/orphaned finding to `audit_log.jsonl`. Do not rewrite `SPEC.md` automatically — propose the diffs and let the user confirm.

---

## Output formats

### `SPEC.md`
ALWAYS use this structure:

```markdown
# [System Name] — Reconstructed Specification
> Generated by legacy-spec-agent from source. Every rule cites code. Unverified items are isolated below.
- Analyzed source commit: <git ref or date>
- Generated at: <runtime timestamp/date>
- Coverage: <modules covered> / <modules total> (<language>)

## System Purpose
<2–4 sentences: what this system does, inferred from code, each with a citation>

## Modules
### <module name> — `<path>`
- **Responsibility**: <what it does>  `path:line`
- **Business rules**:
  - <rule>  `path:line`
- **Inputs / Outputs**: <...>  `path:line`
- **Side effects / External calls**: <...>  `path:line`

## Data & Control Flow
<narrative; defer the diagram to ARCHITECTURE.md>

## Constraints & Assumptions
- <constraint>  `path:line`

## ⚠️ Unverified / Needs-review
> Items that could NOT be grounded in code. Do not treat as fact.
- <claim> — reason it could not be verified
```

### `DRIFT_REPORT.md`
```markdown
# Drift Report — [System Name]
- Compared: SPEC.md (<prev date>) vs code (<current date/commit>)
- Summary: intact <n> · moved <n> · drifted <n> · orphaned <n> · unresolved <n>

## 🔴 Drifted (behavior changed)
- **<rule>** — spec said "<...>" (`old path:line`) but code now does "<...>" (`new path:line`)

## 🟡 Moved (citation stale, behavior same)
- **<rule>** — `old path:line` → `new path:line`

## ⚫ Orphaned (cited code deleted)
- **<rule>** — `old path:line` no longer exists

## ⚠️ Unresolved (could not check — NOT drift)
- **<rule>** — `path:line` — <reason: baseline unreadable / not a git repo / bad ref>
```

### `audit_log.jsonl`
Append-only. One JSON object per line. Timestamps are supplied by the runtime, not invented.

```
{"id":"<claim-id>","action":"created|verified|flagged|moved|drifted|orphaned","claim":"<short>","evidence":"path:line","document":"<artifact.md>","note":"<optional>","baseline_ref":"<git ref or date>"}
```

---

## Optional deliverables (on request)
Beyond the three core artifacts, this skill can emit additional SI/enterprise-style deliverables — but **only what the code substantiates**, under the same citation gate. Generate these when the user asks for the corresponding document, after the Critic gate has run (they are built from verified items).

- **`INTERFACES.md`** — interface/API definition. Public functions and entrypoints with real signatures, inputs/outputs, and the hook/CLI I/O contract, each cited. Include concrete request/response examples for code-defined schemas (for example MCP tool payloads) when the schema is present. Mark `_`-prefixed helpers as *internal, not contract*. Do not invent an external schema the code doesn't define — quarantine it as Unverified.
- **`TESTCASES.md`** — **characterization** test cases (given/when/then) that lock in *current* behavior for safe refactoring. Each case derives from a **verified** business rule and cites the line it locks. These assert "what the code does today", not "what it should do". Never build a case on a `flagged`/`unverified` item, and omit any case that would depend on an external contract the package can't assert. When tests are present, add a coverage matrix from `extract_project_meta.tests` by test file/framework/test case and state skipped/gated tests plus the env/config needed to enable them.
- **`RISKS.md`** — risk / defect-candidate register. Promote every `flagged` audit entry and per-deliverable `Unverified` item into a reviewable row. Include severity, likelihood, impact, evidence, suggested action, and owner/status when grounded; use `unknown` or `unassigned` rather than guessing. Severity is a triage hint, not a measured metric — say so. These are candidates for a maintainer decision, never asserted as confirmed defects.
- **`DATA_MODEL.md`** — the data model as an ER diagram. If the `extract_data_model` connector tool is available, use it to turn dataclasses and ORM models into entities, typed fields, and relations, then render the diagram via `emit_charts` kind `erd`. Otherwise read the model and schema files inline. Emit only the relations a field type actually states; never infer a foreign key. If no persistent domain model exists, say so and document configuration/interface data contracts separately instead of shipping only an empty ERD.
- **`ONBOARDING.md`** — build and run commands, dependencies, and the config surface. Prefer `extract_project_meta`, which reads the manifests and reports each environment variable with its `path:line`. State only what the manifests and code show; do not invent setup steps. Include a troubleshooting table for code-grounded setup failures, plugin/MCP launch problems, missing env vars, and skipped acceptance tests.
- **`CHANGELOG.md`** — release notes built from git history via `extract_changelog`, with conventional commits grouped by type. Include commit hash plus available date/author/scope metadata. This is the one deliverable sourced from the repo's log rather than its files; say so in the document, and do not editorialize beyond the commit subjects.
- **`REPORT.html`** — all of the above in one self-contained tabbed page, generated by the `render_report` connector tool (see Phase 4). Connector-only; without it, deliver the markdown files as they are. Expect the connector to add a Quality tab from the docs and audit log; do not hand-author a separate quality tab unless the user explicitly requests a standalone review document.

Honesty rules carry over verbatim: no row without a citation, nothing fabricated to fill a template, and anything ungroundable stays in an Unverified/candidate section rather than the body.

> This skill deliberately does not emit ADRs, PRDs, or user manuals. Code shows what a system does, not why one design was chosen over another or what the business intended, and none of that can be grounded in a `path:line`. Those documents are out of scope rather than fabricated. If asked, say so and point the user to the human-authored source.

---

## Hard rules
1. **Citation or it doesn't ship.** No claim in the main spec without a `path:line` that a reader can open and confirm.
2. **Isolate, don't fabricate.** Ungroundable inferences go to *Unverified* — never into the body, never deleted quietly.
3. **Don't auto-rewrite in Drift mode.** Propose diffs; the human owns the merge.
4. **Say what you skipped.** Any scoping-down (language, subtree, sampling) is stated in the coverage line, not hidden.

---

## References
- `references/agent-roles.md` — per-phase extraction / architect / critic prompts and the subagent output schema. Read before Phase 1.
