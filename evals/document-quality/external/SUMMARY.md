# External document-quality evaluation — combined summary

Three pinned external repositories, each run through the actual Mode A `standard` workflow with separate Writer, Independent Evidence Auditor, Coverage Sentinel and Gatekeeper actors. **These results are external and must not be merged with the repository-owned synthetic summaries in `../results/`.**

## Verdict

**The external quality gate is NOT satisfied.** Its five conditions are critical-surface recall 100%, citation accuracy 100%, zero unexplained omissions, zero unsupported verified claims, and no rejected draft published. Four of the five hold on all three cases. Critical-surface recall does not: it is **1 of 75 critical gold rows (0.0133)** across the three cases. No measured document-quality improvement may be claimed.

## Pinned cases

| case | repository | revision | scope | licenses |
| --- | --- | --- | --- | --- |
| `external-ts-prisma-rest` | `prisma/prisma-examples` | `eb8f4328821c6746680a2ba02e0e5636a085a327` | `deployment-platforms/rest-express-docker-aws-ec2` | Apache-2.0 repo, MIT package |
| `external-py-flask-tutorial` | `pallets/flask` | `36e4a824f340fdee7ed50937ba8e7f6bc7d17f81` | `examples/tutorial` | BSD-3-Clause |
| `external-mixed-online-boutique` | `GoogleCloudPlatform/microservices-demo` | `9a4616e77f0f9cbcbecaf27d711c38890dda1404` | `src/{cartservice,checkoutservice,shippingservice}` | Apache-2.0 |

Every revision was revalidated against remote HEAD and pinned by detached checkout before gold was written. Case 3 additionally excludes the two `genproto/` trees as machine-generated protobuf bindings; that decision, its justification and its effect on the denominator are recorded in that case's `case-manifest.json` under `scope_refinement`.

Gold was authored from the pinned source alone by an actor with no access to detector, connector or generated-document output, reviewed by the repository owner, corrected per `../../../docs/external-gold-review-summary.md` where applicable, and frozen with a SHA-256 digest before any extractor or Mode A run. One reviewer approved each set; `GOLD_DATASET.md` describes a two-reviewer resolution, so that remains a limitation.

## Extractor versus frozen gold — raw counts

Strict matching on the evaluator's exact `category|surface|found_at|expected_document_type` tuple. These are the reported metrics and the gate criterion.

| case | gold | detected | TP | FP | FN | precision | recall | critical recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `external-ts-prisma-rest` | 42 | 5 | 2 | 3 | 40 | 0.4000 | 0.0476 | 0.0833 (1/12) |
| `external-py-flask-tutorial` | 57 | 19 | 0 | 19 | 57 | 0.0000 | 0.0000 | 0.0000 (0/31) |
| `external-mixed-online-boutique` | 101 | 25 | 10 | 15 | 91 | 0.4000 | 0.0990 | 0.0000 (0/32) |
| **combined** | **200** | **49** | **12** | **37** | **188** | **0.2449** | **0.0600** | **0.0133 (1/75)** |

Category-level precision and recall per case are in each case's `result.json` under `extractor_vs_gold_strict.categories`.

### Two distinct causes are inside those numbers

The strict key conflates a naming disagreement with a genuine failure to detect. A location-only diagnostic — matching `category|found_at|expected_document_type` and ignoring the `surface` string — separates them:

| case | strict recall | location recall | strict critical | location critical |
| --- | ---: | ---: | ---: | ---: |
| `external-ts-prisma-rest` | 0.0476 | 0.0476 | 1/12 | 1/12 |
| `external-py-flask-tutorial` | 0.0000 | 0.2456 | 0/31 | 6/31 |
| `external-mixed-online-boutique` | 0.0990 | 0.1200 | 0/32 | 2/32 |
| **combined** | **0.0600** | — | **1/75** | **9/75** |

The Flask gap is the clearest: the detector and the gold independently identified the same eight HTTP routes and the same five test files at identical file-and-line positions, and the strict key scored 0 because gold writes `registered_api:GET,POST /auth/register (register)` where the detector emits `registered_api:/register`. `GOLD_DATASET.md` fixes the row fields but never fixes a surface-naming convention, so a gold author cannot write rows guaranteed to match. Cause, quantification and candidate fixes are in `FINDING-surface-naming-match-key.md`. Nothing was changed to improve the number — adjusting the evaluator, the gold or the detector after seeing the result would be adjusting the instrument.

Even under the location-only diagnostic, critical-surface recall is 9/75. The gate would fail on either measure.

### What the detector structurally cannot see

The Coverage Sentinels counted real documentable surfaces independently of the detector and found the denominator badly undercounted in every case. The root causes are vocabulary gaps, not tuning:

- the `registered_api` regex matches C# `public class` but never a Go `func`, so every Go RPC method, health method and `money` package function in case 3 is invisible to it;
- routes registered on a named router (`postRouter.get`) do not match the `app|router.<verb>` pattern, which is why case 1 detected no routes at all;
- there is no vocabulary for database tables, configuration keys, business rules, external integrations, or mutations expressed other than a literal `.commit()`;
- surfaces living in non-citable file types (`.prisma`, `.sql`, `.yml`, `Dockerfile`, `.proto`) are outside the scan entirely.

## Document quality — the four conditions that hold

| case | claims | citation accuracy | unsupported verified claims | unexplained omissions | rejected drafts published |
| --- | ---: | ---: | ---: | ---: | ---: |
| `external-ts-prisma-rest` | 200 | 100% | 0 | 0 | 0 |
| `external-py-flask-tutorial` | 140 | 100% | 0 | 0 | 0 |
| `external-mixed-online-boutique` | 146 | 100% | 0 | 0 | 0 |
| **combined** | **486** | **100%** | **0** | **0** | **0** |

All three drafts were approved by `evaluate_document_gate` with empty reason arrays and published transactionally, byte-identical to staging. Citation accuracy rests on the independent auditors' judgment of all 486 claims plus a re-resolution of every cited path and line range against the pinned clones — not on the gate, which enforced only 435 of the 486 (see the undercount finding below).

### Every draft was rejected before it was approved

| case | rounds | round-1 flags | later flags | final |
| --- | ---: | --- | --- | --- |
| `external-ts-prisma-rest` | 2 | 1 of 200 | — | 200/200 verified |
| `external-py-flask-tutorial` | 2 | 14 of 132 | — | 140/140 verified |
| `external-mixed-online-boutique` | 3 | 10 of 135 | 1 new in round 2 | 146/146 verified |

Not one draft passed on the first attempt. Nearly every flag is the same defect: a compound claim whose cited range proves only one part, with the remaining part's code at a different uncited line. Some were substantive rather than scope errors — a Flask claim cited a test's parametrize decorator while asserting form data the test never sends.

Two observations worth carrying forward:

1. **The defect rate tracked the Writer's instructions, not the tool.** Case 1 was flagged once in 200 claims; cases 2 and 3 were flagged 14 in 132 and 10 in 135. The case-1 prompt happened to stress that each claim line must be self-supporting; the later prompts stressed the mechanical one-citation-per-line rule instead. Document quality is therefore not a function of the connector alone, and a quality claim tied to tooling should account for prompt design.
2. **One audit pass does not surface every defect on a line.** Case 3's round 2 flagged a claim round 1 had already flagged for a *different* clause; the second defect only appeared once the corrected line was re-read in full. Correction rounds need whole-line re-verification, not a recheck of the flagged clause.

## Findings recorded, not fixed

Three defects in the measurement and gate machinery surfaced only by running real external repositories. None was fixed, because changing the instrument mid-evidence-collection would invalidate the evidence, and none is the per-file isolation failure that the work queue's evidence-triggered exception permits.

1. **`FINDING-gate-citation-undercount.md`** — fenced code blocks desynchronize `citationsIn()` in `connector/src/document-gate.ts`, because `[^\`]` also matches newlines. Reproduced on all three cases and both languages: the gate saw 179 of 200, 125 of 140, and 131 of 146 citations. For the invisible ones it performs no range check, no audit-coverage requirement and no `CLM-*` matching, so a document could carry an unaudited or out-of-range citation after a fence and still be approved.
2. **`FINDING-surface-naming-match-key.md`** — the evaluator's exact 4-tuple key scores a naming disagreement identically to a missed detection, and no shared surface-naming convention is published.
3. **Two gate rules can contradict each other.** In case 3, widening a citation to satisfy the evidence auditor removed the literal `found_at` string that the coverage rule requires inside the surface's typed heading, so satisfying one rule silently broke the other. The resolution was to split the claim into two lines — the narrow fact on the detector's exact `found_at`, the widened assertion on the wider range. Both rules are individually sound and their interaction is undocumented. Synthetic fixtures never exposed this because they contain no compound claim needing a widened citation.

## Instrumentation not available

Per-run provider input, cached-input, output, reasoning and tool counters are **not exposed** in this environment, and agent-phase wall-clock and peak RSS were **not measured**. Each case's `run-record.json` records those fields as the literal `not_exposed` / `not_measured` with no estimates substituted. Only the deterministic extractor and gate calls were timed. Work-queue item B therefore remains blocked and the item-4 replay decision stays **Inconclusive**.

## Reproducing

Shared, manifest-driven runners live in this directory and read each case's frozen `case-manifest.json`:

```
node run-extractor.mjs  <case-id> <clone-dir>
node freeze-draft.mjs   <case-id> <clone-dir> <writer-actor> <extractor-actor>
node precheck-draft.mjs <case-id> <clone-dir>
node run-gate.mjs       <case-id> <clone-dir> <gatekeeper-actor> evaluate|publish
node write-results.mjs  <case-id> <clone-dir> [source-bytes]
```

Scoring uses the repository's existing `scripts/evaluate-document-quality.mjs`. Pinned clones live in the ignored `.external-sources/` and are not committed. Per-case raw artifacts — scope manifest, gold rows and digest, raw extractor output, evidence and coverage audits with their notes, draft digest, gate result, publication record, generated documents and run record — are preserved in each case directory.
