# Finding: fenced code blocks desynchronize gate citation extraction

Discovered while running the real Mode A `standard` workflow on external case `external-ts-prisma-rest`. This is an observation recorded as evidence; **no connector code was changed**, per the work-queue rule that forbids speculative expansion during evidence work.

## Symptom

`evaluate_document_gate` reported `citation_count: 179` for a draft whose seven Markdown documents contain **200** backtick citation spans when counted line by line. The gate approved the draft with an empty `reasons` array.

## Cause

`citationsIn()` in `connector/src/document-gate.ts:126-128` scans each whole document with `/`([^`]+)`/g`. Because `[^`]` also matches newlines, a fenced code block desynchronizes backtick pairing for the remainder of the document.

`ARCHITECTURE.md` opens a mermaid fence at line 38 and closes it at line 50. The opening ` ``` ` leaves one backtick that pairs with the first backtick of the closing fence, so the entire fenced block is consumed as a single span. The two leftover backticks of the closing fence then pair with following content, and every citation after line 50 is offset: the citation text lands *outside* the captured span instead of inside it.

Measured effect, per document:

| document | citations counted line by line | citations the gate sees | invisible |
| --- | --- | --- | --- |
| SPEC.md | 55 | 55 | 0 |
| ARCHITECTURE.md | 33 | 12 | 21 |
| INTERFACES.md | 46 | 46 | 0 |
| DATA_MODEL.md | 17 | 17 | 0 |
| ONBOARDING.md | 28 | 28 | 0 |
| TESTCASES.md | 15 | 15 | 0 |
| RISKS.md | 6 | 6 | 0 |
| **total** | **200** | **179** | **21** |

All 21 invisible instances (20 distinct claim lines, CLM-068 through CLM-088) sit after the closing fence in `ARCHITECTURE.md`. ARCHITECTURE.md is the only document in this draft containing a fenced block, and it accounts for the entire discrepancy.

## Consequence

The gate validates only the citations it can see. For the invisible ones it performs none of its checks: no `invalid_citation` line-range check, no `citation_audit_incomplete` coverage requirement, and no `claim_audit_incomplete` one-to-one `CLM-*` matching. A document could therefore carry an unaudited or out-of-range citation after a code fence and still be approved. The synthetic fixtures in `evals/document-quality/cases/` contain no fenced blocks, which is why the existing suite never exposed this.

## Why this draft is nonetheless sound

The undercount weakened the *gate*, not the documents. Independently of the gate:

- the Independent Evidence Auditor (`auditor-ext1`) verified all **200** claims against the pinned source across two rounds, flagging one in round 1 (CLM-034) that the Writer then corrected;
- `audit_log.jsonl` contains exactly 200 `verified` rows with unique `claim_id` values, one per cited line, including all 21 gate-invisible instances;
- an independent check re-resolved all 200 citation paths and line ranges against the pinned clone: 200/200 valid, 0 missing files, 0 out-of-range.

So citation accuracy for this case is 100% on the full 200, established by the auditor and the range check rather than by the gate's 179.

## Not fixed here

A fix belongs to a separate, focused change with its own regression — the natural approach is to strip fenced blocks before scanning, or to scan line by line so a fence cannot leak across lines. Doing that now would violate the work-queue constraint against unrelated connector changes during evidence collection, and it is not one of the per-file isolation failures that the evidence-triggered exception permits. Recorded here and in `IMPLEMENTATION_ROADMAP.md` so it is not lost.
