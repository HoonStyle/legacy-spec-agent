# Finding: the evaluator's exact 4-tuple match key conflates naming convention with detection

Surfaced by scoring the frozen external gold sets for cases 2 and 3. Recorded as evidence; **no evaluator, detector, or gold change was made** — the gold sets are frozen and the work queue forbids changing measurement machinery to improve a number.

## Symptom

For `external-py-flask-tutorial`, the deterministic detector and the frozen gold independently identified **the same eight HTTP routes and the same five test files, at identical file-and-line locations**, yet the reported result was 0 true positives, precision 0.0000, recall 0.0000 and critical-surface recall 0.0000.

## Cause

`scripts/evaluate-document-quality.mjs` matches a gold row to a detector row on the exact 4-tuple `category|surface|found_at|expected_document_type`. `found_at` agreed exactly. Only the free-text `surface` string differed, because gold authors and the detector use different naming conventions and no shared convention is documented:

| surface kind | frozen gold writes | detector emits |
| --- | --- | --- |
| Flask route | `registered_api:GET,POST /auth/register (register)` | `registered_api:/register` |
| test file | `test_file:tests/conftest.py` | `test_file:examples/tutorial/tests/conftest.py` |

Gold names a route by method set, full URL and view function; the detector emits only the literal route-decorator string. Gold paths for test files are relative to the analyzed project directory; the detector's are relative to the clone root.

## Measured effect

Both measures below are computed from the same frozen gold and the same raw detector output. "Strict" is the 4-tuple key the evaluator and the external quality gate use. "Location-only" ignores the `surface` string and matches on `category|found_at|expected_document_type`.

| case | gold | detected | strict TP | strict recall | location TP | location recall | rows agreeing on location but not on surface string |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `external-ts-prisma-rest` | 42 | 5 | 2 | 0.0476 | 2 | 0.0476 | 0 |
| `external-py-flask-tutorial` | 57 | 19 | 0 | 0.0000 | 14 | 0.2456 | 14 |
| `external-mixed-online-boutique` | 101 | 25 | 10 | 0.0990 | 12 | 0.1200 | 2 |

Critical-surface recall, strict versus location-only: case 1 `1/12` vs `1/12`, case 2 `0/31` vs `6/31`, case 3 `0/31` vs `2/31`.

Case 1 is unaffected because its gold happened to adopt the detector's own naming for the rows that overlapped. Case 2 is affected most because every one of its overlapping rows is a route or a test file — exactly the two kinds where the conventions diverge.

## Interpretation

The strict numbers remain the reported metric and the external quality gate is still evaluated against them. They are not wrong, but on their own they overstate how little the detector found for case 2: a strict recall of 0.0000 describes a run that in fact located 14 of the gold surfaces, 6 of them critical, at the correct file and line.

The gap is a defect in the measurement contract, not evidence that the detector found those routes. Two separate problems are hidden inside one number:

1. **naming divergence** — the same surface described differently by a human and by the detector, which is what the 14 case-2 rows are; and
2. **genuine non-detection** — surfaces the detector never emitted at any location, which is what the remaining 43 case-2 gold rows are (business rules, integrations, config, entrypoints, states, data contracts).

Only the second is a detector capability gap. `GOLD_DATASET.md` specifies the row fields but never fixes a surface-naming convention, so gold authors cannot write rows that are guaranteed to match, and a reader of the summary cannot tell the two problems apart.

## Not fixed here

Candidate fixes — publishing a canonical surface-naming convention in `GOLD_DATASET.md`, or reporting location-agreement alongside the strict key, or normalizing paths before comparison — each change what the published numbers mean. Doing any of them while the evidence work is in flight would amount to adjusting the measuring instrument after seeing the result. Recorded here, in each case's `result.json` as a clearly labelled diagnostic, and in `IMPLEMENTATION_ROADMAP.md`, so the next session can decide deliberately.
