# Document-quality evaluation manifest

This evaluation separates deterministic publication-contract correctness from measured document quality. Cases must use pinned source revisions, generated drafts (not gold prose as input), independent evidence and coverage actors, and the read-only Gatekeeper before publication.

## Required cases

1. A small TypeScript service covering registered APIs, contracts, environment variables, state, entrypoints, tests, and side effects.
2. A Python service covering environment access, entrypoints, persistence-side-effect syntax, and tests.
3. A mixed TypeScript, Python, Java, C#, and Go service covering cross-language surface extraction.

Each case records a source-tree SHA-256 revision, profile, included/excluded paths, raw `gold-surfaces.jsonl`, extracted `actual-surfaces.jsonl`, generated Markdown, audit records, gate result, elapsed time, an end-of-run RSS snapshot, source bytes, gate-result bytes, execution mode, and whether connector calls or unique/repeated reads were measured. Provider counters are recorded exactly when exposed and otherwise use `not_exposed`; byte/read metrics are never presented as billing-token savings.

## Initial quality gate

- critical-surface recall: 100%;
- citation accuracy: 100%;
- unexplained omissions: zero;
- unsupported verified claims: zero;
- rejected drafts published: zero.

Precision/recall targets beyond critical recall are set only after the first three-case baseline, rather than tuning the extractor after results are visible.

## Recorded baseline

`cases/` contains the three reproducible synthetic cases and their frozen gold, extracted JSONL, and result JSON. `results/summary.json` aggregates 24/24 exact matches. This is deliberately labelled a synthetic extractor baseline: it proves that the measurement pipeline and current detector contract execute, but it is not evidence of real-world document quality, provider-token savings, or general extractor accuracy. Generated standard-profile drafts from external pinned repositories remain the emission gate before making those claims.
