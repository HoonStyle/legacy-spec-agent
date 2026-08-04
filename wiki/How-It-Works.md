# How It Works

Legacy Spec Agent combines LLM reasoning with deterministic connector checks. The model reads and explains behavior; the connector handles repeatable operations such as parsing, citation validation, drift detection, metadata extraction, and report rendering.

## Mode A: Reverse-Spec

Use reverse-spec mode for a first pass over an undocumented codebase.

1. **Scope and ingest** — map the repository, identify primary languages, and decide whether to cover the whole tree or a declared subset.
2. **Extract behavior** — inspect modules for entry points, rules, inputs, outputs, side effects, external calls, and constraints.
3. **Synthesize architecture** — combine module-level findings into dependency and control-flow views.
4. **Critic gate** — re-check every cited claim against the referenced source line.
5. **Emit artifacts** — use the default `standard` profile to write the spec, architecture, audit log, interfaces, data model, onboarding guide, test cases, risks, charts, and report. Use the reduced `core` profile only when the user explicitly requests it.
6. **Validate the document set** — confirm required sections exist, all citations are audit-covered, and every stable cross-document ID resolves exactly once. Missing concepts are reported with the searched scope and **Not found**, not an empty section or invented content.

## Mode B: Drift-Check

Use drift-check mode when a previous generated spec already exists.

1. Load the existing spec and collect its citations.
2. Compare each cited location against the current tree and, when possible, the baseline commit.
3. Classify each citation as:
   - **intact** — behavior still matches the spec;
   - **moved** — behavior remains but the citation location changed;
   - **drifted** — code behavior no longer matches the spec;
   - **orphaned** — cited code was deleted;
   - **unresolved** — the tool could not check the citation.
4. Emit `DRIFT_REPORT.md` and append audit entries.

The skill proposes spec updates in drift mode, but it does not silently rewrite the spec. The maintainer owns the merge.

## Why the connector matters

The connector makes the evidence layer reproducible. Instead of asking the model to guess whether a line exists or whether a chart is correct, the connector returns structured, deterministic results that the model can summarize and cite.

Its measured value is verifiability, not token savings. A counter-enabled paired replay (2026-08-04) found that connector runs cost 31.3% more provider input tokens than control runs, with unchanged task quality and citation accuracy, and the recorded decision was to stop efficiency-motivated expansion. Use the connector because the evidence layer is reproducible and auditable, not to reduce context cost.

## Quality expectations

- Every emitted Markdown citation should have a matching audit entry.
- Stable `BR-*`, `API-*`, `DM-*`, `TC-*`, `RSK-*`, and `UV-*` references should resolve to exactly one correctly typed item.
- Truncated connector output must include returned, total, and omitted counts.
- Repository-undefined external contracts stay in explicit **Unverified** sections; absent concepts state the search scope and **Not found**.
- Product or business rules are separated from implementation/runtime facts.
