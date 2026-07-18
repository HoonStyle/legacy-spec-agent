# FAQ

## Is this just an LLM repository summary?

No. The model still performs reasoning and synthesis, but factual claims are expected to carry source citations. The connector handles deterministic checks such as citation validation, symbol indexing, drift detection, and report rendering.

## Why require `path:line` citations?

A reconstructed spec is useful only if maintainers can audit it. A line citation lets reviewers open the exact source that supports a claim. If the code does not support the claim, the item belongs in an unverified or needs-review section.

## Can the tool prove business intent?

No. Source code can show current behavior, interfaces, data movement, and constraints. It usually cannot prove why a design decision was made or what the business originally intended.

## Why not generate ADRs, PRDs, or user manuals automatically?

Those documents describe intent, product decisions, or user-facing expectations. Legacy Spec Agent intentionally avoids fabricating them from code-only evidence.

## What happens when the repository is too large?

The connector supports limits and package-level granularity. If output is truncated or scoped down, the generated documentation should state what was covered and what was omitted.

## What happens when code changes after the spec is generated?

Run drift-check mode. Existing citations are classified as intact, moved, drifted, orphaned, or unresolved, and the tool emits a drift report instead of silently rewriting the spec.

## Can I use the skill without the connector?

Yes, but with weaker guarantees. Without the connector, deterministic citation checks, drift matching, metadata extraction, chart rendering, and report assembly are not available as code-backed operations.

## Can these pages be copied to GitHub Wiki?

Yes. The files in `wiki/` are plain Markdown and are organized so they can be copied or pushed into a GitHub Wiki repository.
