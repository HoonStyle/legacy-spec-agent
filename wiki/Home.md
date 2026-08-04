# Legacy Spec Agent Wiki

Legacy Spec Agent reconstructs a grounded specification from source code that does not have reliable documentation. The core rule is simple: a claim only ships when it can point to evidence in the code with a `path:line` citation.

## What this wiki covers

- [Quick Start](Quick-Start.md): install, run, and test the project locally.
- [How It Works](How-It-Works.md): the reverse-spec and drift-check workflows.
- [Outputs](Outputs.md): the generated Markdown, audit, chart, and HTML artifacts.
- [Connector Tools](Connector-Tools.md): the deterministic MCP tools bundled with the skill.
- [Development](Development.md): repository layout and contributor workflow.
- [FAQ](FAQ.md): scope, guarantees, and common limitations.

## Core principles

1. **Evidence first** — every emitted factual claim should be backed by source evidence.
2. **No silent gaps** — skipped scope, truncated connector output, and unverified inferences must be stated explicitly.
3. **Deterministic checks** — parsing, citation verification, drift detection, and report rendering are handled by the TypeScript connector when available.
4. **Human-owned intent** — the tool reconstructs what the code does, not why past design decisions were made.
5. **Validated document set** — Mode A defaults to the full `standard` profile, citations are audit-covered, stable IDs resolve across artifacts, and missing concepts are reported as **Not found** with their search scope.

## Current evaluation status

As of 2026-08-04:

- **Grounding quality.** Three pinned external repositories were run through the full Mode A gate pipeline; citation accuracy was 100% across 486 claims, with zero unsupported verified claims and no rejected draft published. The deterministic extractor's critical-surface recall gate remains open — the detector misses most gold surfaces — so no measured document-quality improvement is claimed.
- **Token efficiency.** A counter-enabled paired replay measured connector runs at +31.3% provider input tokens (one of five pairs improved) with no task-quality or citation regression, and the recorded decision is **Stop** for efficiency-motivated expansion (`evals/end-to-end-replay/fermass-counter-replay/DECISION.md` in the main repository). The connector earns its place as a verification engine, not as a context-cost optimization.

## Main use cases

- Onboard onto a legacy or inherited codebase.
- Produce a starting specification before refactoring.
- Identify public interfaces, data contracts, and test coverage.
- Detect when source code has drifted away from a previously reconstructed specification.
