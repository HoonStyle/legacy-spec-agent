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

## Main use cases

- Onboard onto a legacy or inherited codebase.
- Produce a starting specification before refactoring.
- Identify public interfaces, data contracts, and test coverage.
- Detect when source code has drifted away from a previously reconstructed specification.
