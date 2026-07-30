# Implementation roadmap

This roadmap separates release blockers from optional semantic enhancements. The five-pair pilot in item 4 is complete but inconclusive because the provider did not expose per-run token counters. Feature expansion remains paused until the same bounded comparison can be run in an environment that exposes the primary metered measure. Each implementation item should remain an independently buildable, tested commit or short commit series.

## Current usable scope

The connector can currently perform SDK-independent syntax analysis for Python, JavaScript/TypeScript, Java, C#, and Go. It provides symbol indexes, syntax-level module dependencies, basic typed data models, bounded responses, parse-cache metrics, and deterministic citation/report tools.

The current graph is a **module dependency graph**, not a compiler-resolved method call graph. Downloaded SDK artifacts are verified cache entries; they are not installed or used by a semantic backend.

## Next-session work queue

Start the next implementation session here. Do not add another connector feature, resolver, semantic backend, SDK installer, publication rule, or synthetic fixture before completing the evidence work below.

### A. External document-quality evaluation

Candidate repositories, proposed scopes, gold-freeze rules, required artifacts, and the execution sequence are documented in `EXTERNAL_EVALUATION_PLAN.md`. The candidates remain provisional until their immutable revisions and licenses are revalidated and recorded in per-case scope manifests.

1. Select at least three real external repositories: one small TypeScript service, one Python service, and one mixed or non-TypeScript service. Record the repository URL, license, immutable commit SHA, selected profile, included paths, excluded paths, and execution environment before generating results.
2. Freeze human-reviewed gold annotations independently of connector output. Gold must include registered APIs, data contracts, configuration/environment variables, entrypoints, states, tests, persistence/side effects, external integrations, and business rules when present. Do not promote current detector output into gold.
3. Run the actual Mode A `standard` workflow for every pinned repository: separate Writer, Independent Evidence Auditor, Coverage Sentinel, and Gatekeeper actors; generated Markdown rather than hand-authored fixture prose; frozen draft digest; and `evaluate_document_gate` before publication.
4. Preserve the generated documents, `audit_log.jsonl`, scope manifest, evidence audit, coverage audit, gate result, raw extractor output, gold rows, elapsed time, resource/byte diagnostics, and explicit `not_exposed`/`not_measured` values instead of estimates.
5. Report raw true positives, false positives, false negatives, category-level precision/recall, critical-surface recall, citation accuracy, unsupported verified claims, unexplained omissions, and rejected-draft publication count. Keep synthetic and external results in separate summaries.

**External quality gate:** critical-surface recall is 100%, citation accuracy is 100%, unexplained omissions and unsupported verified claims are zero, and no rejected draft is published. Do not claim measured document-quality improvement until this gate is evaluated on the pinned external cases.

### B. Counter-enabled bounded replay

1. Obtain an environment that exposes per-run provider input, cached-input, output, reasoning, and separately reported tool counters together with elapsed time. If those counters are unavailable, record the block and do not substitute source reads or bytes.
2. Repeat the existing five FerMass pairs at revision `1984b4e324b9e4bec7fa2c7f48fc1b105737fbee` using the unchanged prompts, completion criteria, model/settings, alternating order, and connector/control tool policy in `END_TO_END_REPLAY.md`.
3. Preserve raw provider counters, pricing/billing units when known, connector calls and response bytes, unique/repeated reads, elapsed time, task result, citation coverage, and citation accuracy. Do not double-count overlapping provider categories.
4. Write the paired differences and decision record. Continue only if at least four of five pairs improve the primary metered token or cost measure, its median improves, and task quality and citation accuracy do not regress.

**Replay gate:** select Continue, Narrow, Stop, or Inconclusive from metered evidence. Do not resume items 6, 8, 9, 10, 11, or SDK installation while the decision remains Inconclusive.

### C. Only evidence-triggered reliability fixes

If either external evaluation or bounded replay fails because one representative file is unreadable, changing, oversized, invalidly encoded, unparsable, or cannot load its grammar, make the minimum per-file isolation fix with a focused regression. Return structured `failed_files` separately from `unsupported_files`; do not perform speculative cache, concurrency, language-resolution, or semantic expansion.

### Next-session completion record

Before ending the next session, update this queue with pinned case identifiers, commands run, raw result locations, satisfied and unsatisfied gates, and the exact blocker when an external counter or environment is unavailable. Keep implementation and direct regression tests in independently buildable functional commits, then run the commit-policy checks at the end of this file.

**2026-07-30 review record.** Source-only gold drafts supplied for
`external-py-flask-tutorial` at `36e4a824f340fdee7ed50937ba8e7f6bc7d17f81`
and `external-mixed-online-boutique` at
`9a4616e77f0f9cbcbecaf27d711c38890dda1404` were checked against detached source
trees. The consolidated decisions are preserved in
`docs/external-gold-review-summary.md`. Both inputs contained a duplicated JSONL
copy and require the documented classification corrections. No gold digest,
extractor output, generated document, or Mode A result was produced. The external
quality gate therefore remains unevaluated; the immediate blocker is independent
human approval of the corrected positive annotations.

The documented removals and reclassifications have since been applied to the
drafts held outside the repository: case 2 goes from 73 rows to 57 (16 removed,
12 reclassified) and case 3 from 111 rows to 101 (10 removed, 3 reclassified),
both validating clean on ID uniqueness, category/type mapping,
`found_at == source_citation`, and source path/line ranges. Per-case
`gold-review-notes.md` records those decisions. The repository-held draft files
themselves contained no duplicated copy — each was already unique, sequential
and one JSON object per line — so that step was a confirmation rather than a
removal. Independent human approval, the gold digest, and every downstream step
remain outstanding.

#### Session record — 2026-07-30

**Item A, case 1 of 3 executed.** Case `external-ts-prisma-rest`: `prisma/prisma-examples` at revalidated revision `eb8f4328821c6746680a2ba02e0e5636a085a327`, scope `deployment-platforms/rest-express-docker-aws-ec2`, licenses Apache-2.0 (repository) and MIT (selected package, from its `package.json`), profile `standard`. Cases 2 (`external-py-flask-tutorial`) and 3 (`external-mixed-online-boutique`) are not started, so no combined external summary exists yet.

Raw results: `evals/document-quality/external/external-ts-prisma-rest/`. Commands are listed in that case's `run-record.json`; the reproducible runners are `run-extractor.mjs` and `run-gate.mjs` in the same directory. The pinned clone lives in the ignored `.external-sources/` and is not committed.

Gold was authored from the pinned source only, reviewed by the repository owner, and frozen at 42 rows with digest `1068766fe3cc89f97f04b833dfaf51a0615bbace7a3c2825af8205f599117300` before any extractor or Mode A run. Review removed the two npm-script entrypoint rows; `gold-review-notes.md` records that decision, the absent `test_file` category with its search patterns, and the judgment calls. One reviewer approved it, not the two-reviewer resolution `GOLD_DATASET.md` describes.

The Mode A run used separate agent processes for `writer-ext1`, `auditor-ext1`, `sentinel-ext1` and `gatekeeper-ext1` over `extractor-ext1` output. Round 1 was **rejected**: the evidence auditor flagged CLM-034, whose citation covered only the Prisma update and not the ID guard it asserted. The Writer widened the citation, the digest was re-frozen from `71131fd7…` to `9d288ff7…`, and round 2 verified all 200 claims. `evaluate_document_gate` then returned `approved` with 179/179 audited citations and no reason codes, and `publish_approved_documents` populated `generated-documents/` byte-identically.

**Satisfied:** citation accuracy 100% across all 200 claims, unsupported verified claims 0, unexplained omissions 0, rejected drafts published 0 (the round-1 rejection was corrected, never published).

**Not satisfied — external quality gate remains open.** Critical-surface recall is **0.0833** against frozen gold (overall extractor precision 0.400, recall 0.0476; 5 detected surfaces versus 42 gold rows). The deterministic detector misses routes registered on named routers such as `postRouter.get`, every surface in non-citable files (`.prisma`, `.yml`, `.sql`), Prisma create/update/delete mutations, external integrations and business rules. Per item A this is reported, not papered over: no detector vocabulary was added to improve the number.

**Item B remains blocked.** This environment does not expose per-run provider input, cached-input, output, reasoning or tool counters, and agent-phase elapsed time and peak RSS were not instrumented. Those fields are recorded as `not_exposed` / `not_measured` in `run-record.json` with no estimates substituted, so the counter-enabled replay was not attempted and the item-4 decision stays **Inconclusive**.

#### Session record — all three item-A cases executed

Cases 2 and 3 are now complete and the combined external summary is `evals/document-quality/external/SUMMARY.md`. Pinned identifiers: `external-py-flask-tutorial` at `pallets/flask` `36e4a824f340fdee7ed50937ba8e7f6bc7d17f81`, scope `examples/tutorial`, BSD-3-Clause, gold frozen at 57 rows digest `739d434e2b61d3b999e7eeff6f8a168d33c324ba499cac8f6d2674a46557c8a1`; `external-mixed-online-boutique` at `GoogleCloudPlatform/microservices-demo` `9a4616e77f0f9cbcbecaf27d711c38890dda1404`, scope `src/{cartservice,checkoutservice,shippingservice}`, Apache-2.0, gold frozen at 101 rows digest `f6875b3afa4729923e821414f0979ab83c1b0d9026491ea961f184b6ae7eb984`. Case 3 additionally excludes both `genproto/` trees as machine-generated protobuf bindings; that decision and its effect on the denominator are recorded in its `case-manifest.json` under `scope_refinement`.

Commands are the manifest-driven runners in `evals/document-quality/external/`: `run-extractor.mjs`, `freeze-draft.mjs`, `precheck-draft.mjs`, `run-gate.mjs` and `write-results.mjs`, plus the existing `scripts/evaluate-document-quality.mjs`. Raw results are in each case directory.

**Satisfied on all three cases:** citation accuracy 100% across 486 claims, unsupported verified claims 0, unexplained omissions 0, rejected drafts published 0. All three drafts were approved by `evaluate_document_gate` with empty reason arrays and published byte-identically.

**External quality gate NOT satisfied.** Combined strict critical-surface recall is **1 of 75 critical gold rows (0.0133)**; combined precision 0.2449 and recall 0.0600 over 200 gold rows against 49 detected surfaces. Under a location-only diagnostic that ignores the surface string, critical recall is still only 9/75, so the gate fails on either measure. No measured document-quality improvement is claimed.

**Every draft was rejected before approval:** case 1 flagged 1 of 200 claims, case 2 flagged 14 of 132, case 3 flagged 10 of 135 and then a further new defect in round 2, needing three rounds. The recurring defect is a compound claim whose citation proves only one part. The flag rate tracked Writer prompt wording rather than the connector, so document quality is not a function of tooling alone.

**Two further findings recorded, not fixed.** `FINDING-surface-naming-match-key.md`: the evaluator's exact 4-tuple key scores a gold/detector naming disagreement identically to a missed detection, and no surface-naming convention is published, which is why Flask scores strict 0 while locating 14 gold surfaces at exact positions. Second, two gate rules can contradict each other — widening a citation to satisfy the evidence auditor removed the literal `found_at` that the coverage rule requires inside a typed heading. The citation-undercount finding reproduced on all three cases (gate saw 179/200, 125/140, 131/146).

**New evidence-triggered finding, not fixed.** `FINDING-gate-citation-undercount.md` records that fenced code blocks desynchronize `citationsIn()` in `connector/src/document-gate.ts`, so the gate validated 179 of the draft's 200 citations; the 21 invisible instances all follow a mermaid fence in `ARCHITECTURE.md`. Citation soundness for this case was established by the independent auditor and a full re-resolution of all 200 ranges rather than by the gate. This is not one of the per-file isolation failures item C permits, so no connector change was made.

## Release-blocking priorities

### 1. Installed-plugin end-to-end smoke

**Status: complete.** `connector/test/installed-plugin.test.ts` copies a clean plugin without `node_modules` or `dist` into paths containing spaces, Korean, and Greek characters. It launches concurrent first-run servers through both the installed Codex manifest and the placeholder-expanded Claude MCP configuration. A bootstrap lock serializes dependency installation/build, while later processes re-check state and reuse the completed setup. The test indexes all five language fixtures, verifies the C# WASM grammar and built entrypoint exist, and compares a recursive SHA-256 snapshot to confirm that no target path or content changed. CI enables this network-dependent smoke with `PLUGIN_INSTALL_SMOKE=1` on Node 20 and 22 across Ubuntu and Windows.

Prove the distributed layout rather than only the checkout layout:

- copy the plugin without `node_modules` or `dist` into a clean path containing spaces and non-ASCII characters;
- run `connector/bootstrap.mjs` so it performs `npm ci` and a TypeScript build;
- connect over stdio MCP;
- invoke `index_symbols` against a mixed Python, JS/TS, Java, C#, and Go target;
- verify bundled WASM grammars load from the installed connector;
- verify the target repository remains unchanged.

**Exit gate:** the smoke passes on Ubuntu and Windows with supported CI Node versions from a clean plugin copy. Locally, run `cd connector && npm run build && PLUGIN_INSTALL_SMOKE=1 node --test dist/test/installed-plugin.test.js`; the ordinary suite skips this reinstall check unless explicitly enabled.

### 2. Large mixed-repository corpus

**Status: implementation complete; Ubuntu/Windows CI is the merge gate.** `connector/test/large-corpus.test.ts` generates 2,001 supported files across all five languages together with generated directories, binaries, unsupported sources, a symlink, malformed syntax, and an unreadable generated file. It records elapsed time, peak RSS, source and response bytes, and warm-cache reuse. The assertions enforce generated/worktree exclusion and bounded file-granularity responses.

Exercise thousands of supported files plus `.claude/worktrees`, `bin`, `obj`, `node_modules`, binaries, unsupported sources, symlinks, malformed syntax, and unreadable files. Record elapsed time, peak RSS, response bytes, and cache reuse.

**Exit gate:** no OOM, generated/worktree files are excluded, and response limits remain effective.

### 3. Accurate tool contract

**Status: complete.** Graph responses identify `graph_type: "module_dependency"` and `resolution: "syntax"`, report resolved and unresolved import-relationship counts before output collapsing or truncation, and the MCP/tool documentation explicitly distinguishes these syntax edges from method calls and dynamic dispatch.

Label current graph output as `module_dependency` with `resolution: "syntax"`, resolved/unresolved counts, and documentation that it does not represent method calls or dynamic dispatch.

**Exit gate:** clients cannot mistake syntax imports for a semantic call graph.

### 4. Bounded end-to-end token replay

**Status: pilot complete; decision inconclusive pending provider counters.** The first pilot ran five paired tasks (10 runs) against FerMass at pinned revision `1984b4e324b9e4bec7fa2c7f48fc1b105737fbee`. Both conditions passed all five tasks with no citation errors. Connector runs reduced direct source reads in four pairs with a median paired change of -1, but the provider did not expose per-run token counters and the apparent improvement mostly replaced one direct read with one connector call. The decision record therefore does not establish a metered token or cost reduction. Raw results are preserved in `evals/end-to-end-replay/fermass-pilot/`.

Keep the current syntax connector, including the implemented TypeScript resolver, as the MVP. The next permitted replay step is to repeat or extend the bounded comparison only in an environment that exposes the provider's per-run input, cached-input, output, reasoning, and separately reported tool counters. Preserve the same paired controls and include connector response bytes; do not substitute read counts for a metered token or cost measure.

Record the provider's non-overlapping token counters exactly as reported, their pricing or billing units when known, connector calls and response bytes, unique and repeated file reads, elapsed time, task success, citation coverage, and citation accuracy. Do not add tool-response tokens to input tokens when the provider already includes them there. Report both raw counters and the paired difference; do not present structural-index size as billing-token savings.

**Decision gate:** not yet satisfied. The required decision record exists and selects **Inconclusive**, specifically because provider counters and elapsed time were unavailable and connector overhead could not be included in a metered comparison. Continue only if a counter-enabled replay shows that the connector reduces the primary metered token or cost measure in at least four pairs, improves its median, and causes no task-quality or citation-accuracy regression. Narrow or stop if it increases the median, agents routinely reopen most indexed source, or benefits depend on excluding connector overhead. Do not build more connector features to make the pilot pass.

Use `END_TO_END_REPLAY.md` for the task manifest, paired-run controls, run-record fields, comparison, and decision template.

### 5. Artifact quality and documentation contracts

**Status: contract implementation complete; per-run output validation remains an emission gate.** This work is independent of bounded end-to-end token replay: it tightens the emitted-document contract without claiming or depending on token savings. Mode A defines explicit `core` and default `standard` profiles, required artifact sections, stable cross-document IDs, honest Not-found handling, and syntax-only architecture disclosures. Role contracts and bilingual user documentation are synchronized with those requirements, and contract tests prevent regressions.

**Preliminary strengthening — complete; merged with Ubuntu/Windows CI green on Node 20 and 22.** A scope manifest is frozen before writing, the Writer is separate from the Independent Evidence Auditor, a Coverage Sentinel reverse-audits code surfaces, and publication approval is reserved for a read-only Gatekeeper. The MCP-exposed deterministic `evaluate_document_gate` validates real Markdown/audit fixtures, independently extracts registered APIs, data contracts, environment variables, entrypoints, status values, tests, and side effects, checks citation lines, typed IDs, bidirectional coverage consistency, manifest schema/counts, role independence, provenance against the analyzed revision, and the actual line-ending-normalized draft digest, and rejects accurate-but-incomplete output. Only audit rows with a `verified` action count toward citation coverage, declared `CLM-*` IDs require a one-to-one verified audit row, fully disclosed truncation is accepted while undisclosed truncation rejects, and the required negative call-graph disclaimer is distinguished from a mislabeled graph. `publish_approved_documents` keeps rejected staging drafts from replacing an existing publication.

**Measured baseline — synthetic only.** `evals/document-quality/` now contains a reproducible three-case TypeScript, Python, and mixed-language extractor baseline with frozen gold rows and category-level precision/recall. Its 24/24 result proves the measurement pipeline against repository-owned examples, not real-world document quality or token savings. Generated standard-profile drafts from external pinned repositories remain required before claiming a measured quality improvement.

**Synthetic emission smoke — complete.** The same three cases now generate every standard-profile Markdown artifact, claim-linked audit rows, distinct actor/digest contract records, and Gatekeeper results. All three synthetic drafts are approved and record elapsed time, an end-of-run RSS snapshot, source bytes, gate-result bytes, direct-module execution mode, and explicitly mark read counts as not measured. This validates the staging-to-gate orchestration only; actor IDs do not prove independently executed agents, the deterministic inventory prose and detector-aligned gold are not a real-world quality comparison, and provider counters remain unavailable.

**Strengthening completion condition: satisfied.** The writer and auditor are separate agents, the code-to-document reverse omission check runs, only the Gatekeeper approves publication, and the related contract tests pass in CI.

**Exit gate:** every required section is present; `audit_log.jsonl` covers every citation in all emitted markdown; every cross-document ID reference resolves to exactly one correctly typed item; and the verified document body contains zero unsupported claims. Absence must be reported with search scope and **Not found**, never an empty document or fabricated content.

### 6. Language-specific module resolution

**Status: paused pending item 4.** TypeScript `baseUrl`, `paths`, project references, package exports, and missing-extension support is implemented. Validate or add another language only when replay evidence identifies module resolution as a material source of wasted reads or failed tasks.

Implement separately:

1. C# solutions, project references, namespaces, global/aliased `using`, and namespace-to-project edges.
2. Go workspaces, nested modules, `replace`, vendor, and major-version suffixes.
3. Java Maven/Gradle source roots, modules, wildcard imports, and static imports.

Uncertain imports must remain external/unresolved instead of being guessed from a filename.

### 7. Per-file failure isolation

**Status: minimum reliability fixes only pending item 4.** Fix failures that prevent representative replay tasks from completing; defer exhaustive edge-case hardening until the effect gate justifies continued investment.

Continue after unreadable, changing, oversized, invalid-encoding, grammar-load, or parse-error files. Return structured `failed_files` diagnostics separately from `unsupported_files`.

**Exit gate:** one bad file cannot abort an otherwise useful repository analysis.

### 8. Cache lifecycle and concurrency

**Status: paused pending item 4.** Address demonstrated correctness or resource failures first; do not expand concurrency infrastructure speculatively.

Cover simultaneous access, mutation during analysis, eviction beyond 512 entries, repository deletion, explicit cleanup, and server shutdown. Prevent duplicate parsing and tree use-after-delete.

**Exit gate:** bounded memory and deterministic results under concurrent MCP calls.

## Optional semantic precision

### 9. TypeScript semantic backend

**Status: paused pending item 4 and a demonstrated semantic gap.**

Discover projects, load the compiler API, resolve types/symbols/calls, and emit cited semantic edges. This is first because it can run inside the existing Node connector without an external SDK installer.

### 10. C# Roslyn backend

**Status: paused pending item 4 and a demonstrated semantic gap.**

Discover solutions/projects, launch an isolated analyzer, resolve symbols and calls, and map every result back to source citations.

### 11. Go, Java, and Python semantic backends

**Status: paused pending item 4 and a demonstrated semantic gap.**

Implement and gate each language independently. Set `semantic_backend_available: true` only when that backend is actually usable.

## Last: SDK installation

Only implement installation for a completed semantic backend that genuinely needs it. Keep download approval separate from archive extraction, installation, dependency restore, build, and execution approval. A safe installer must constrain traversal, links, expanded size/file count, permissions, platform/architecture selection, manifests, and cleanup.

## Commit policy

Every item is committed by functional boundary:

- implementation and its direct regression tests stay together when separating them would leave an unbuildable commit;
- benchmarks and their tokenizer dependency are separate from runtime code;
- documentation records only behavior already implemented or explicitly marks future work;
- every commit passes `git diff --check`, the relevant focused tests, and a TypeScript build;
- the final branch passes `node scripts/sync-plugin-skill.mjs` and `cd connector && npm test`.
