# Legacy Spec Agent

<p align="center">
  <a href="README.md"><img alt="Language: English" src="https://img.shields.io/badge/lang-English-blue"></a>
  <a href="README.ko.md"><img alt="Language: Korean" src="https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-blue"></a>
  <img alt="Version 0.1.0" src="https://img.shields.io/badge/version-0.1.0-informational">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green"></a>
</p>

**A plugin for [Claude Code](https://claude.com/claude-code)** — a skill plus a bundled MCP connector.

Legacy Spec Agent reconstructs a specification from undocumented code. It reads the source, writes the spec that was never written, and attaches a `path:line` citation to every claim. When the code later changes, it re-checks each citation and reports what drifted.

It never asks for an existing spec as input. In real legacy systems the documentation is missing or wrong, but the code is always there, so the code is treated as the only source of truth. Anything the tool cannot back with a citation goes into a separate "Unverified" section instead of being presented as fact.

## How it differs from asking an LLM to summarize a repo

An LLM summary is fluent but unverifiable. This tool adds two checks on top of the model:

1. **Critic gate.** Before anything ships, a mandatory review pass reopens every cited line. Claims the code supports are marked verified; the rest are quarantined, not deleted and not promoted.
2. **Deterministic connector.** A TypeScript MCP server handles the parts that should never vary between runs: verifying citations against actual source, indexing symbols, classifying drift, extracting facts from manifests, and rendering charts. The model does the reasoning; the connector enforces the evidence.

## What it produces

| Deliverable | Contents |
|---|---|
| `SPEC.md` | Purpose, business rules, I/O, and constraints, with a citation on every rule |
| `ARCHITECTURE.md` | Dependency graph plus a control-flow flowchart, both traced to code |
| `INTERFACES.md` | Public API surface with real signatures |
| `DATA_MODEL.md` | Entities, fields, and relations, with a Mermaid ER diagram |
| `ONBOARDING.md` | Build and run commands, dependencies, and environment variables |
| `TESTCASES.md` | Characterization tests that lock in current behavior before a refactor |
| `RISKS.md` | Register of defect candidates flagged during verification |
| `CHANGELOG.md` | Git history grouped by conventional-commit type |
| `DRIFT_REPORT.md` | Per-citation drift classification: intact, moved, drifted, orphaned, or unresolved |
| `audit_log.jsonl` | Append-only record of every verify/flag decision |
| Charts | Coverage, drift, and benchmark charts, plus architecture and ER diagrams |
| `REPORT.html` | Everything above assembled into one self-contained tabbed page (connector-generated) |

The tool intentionally does not generate ADRs, PRDs, or user manuals. Code shows what a system does, not why a decision was made or what the business intended. Those documents cannot be grounded in a citation, so they are left to humans rather than fabricated.

## How it works

**Mode A (reverse-spec)** runs a five-phase pipeline: scope the codebase, extract behavior module by module (one subagent per module), synthesize the architecture, pass everything through the Critic gate, then emit the artifacts.

**Mode B (drift check)** takes the commit recorded in an existing spec, reads each cited line as it was at that commit, and looks for that content in the current tree. Every citation is classified deterministically, and the tool proposes diffs instead of rewriting the spec.

The connector exposes nine tools: `verify_citation`, `index_symbols`, `build_call_graph`, `detect_drift`, `extract_data_model`, `extract_project_meta`, `extract_changelog`, `emit_charts`, and `render_report`. The skill uses them when they are available and falls back to plain LLM operation when they are not.

Large repositories are handled with two mechanisms. Item-level outputs accept a `limit` and report exactly how much was omitted when they truncate, and a `package` granularity option collapses file-level graphs into package-level edges so a diagram with hundreds of nodes stays readable.

## Installation

As a plugin, which installs the skill and the connector together:

```bash
claude plugin marketplace add hoonstyle/legacy-spec-agent
claude plugin install legacy-spec-agent@legacy-spec-agent
```

The connector builds itself on first launch (network required once) and rebuilds when a plugin update ships newer sources. Without the connector, the skill still works in LLM-only mode.

Alternatively, copy this directory into a skills location Claude Code discovers, such as `.claude/skills/legacy-spec-agent/`, and ask Claude to reconstruct a spec for an undocumented file or directory.

## Repository layout

```
SKILL.md             Skill definition: workflow, output templates, hard rules
references/          Extraction, architect, and critic contracts used by the skill
SPEC.md              Original design document (v0.1)
CONNECTOR_DESIGN.md  Connector design and milestone record (C0–C7)
connector/           TypeScript MCP server: nine tools, 49 tests
demo-hookify/        A real Mode A run against a third-party package, full artifact set
evals/               With-skill vs. baseline benchmarks
skills/              Plugin-layout copy of the skill, kept in sync by a test
scripts/             Utility to re-sync the plugin copy after editing SKILL.md
.claude-plugin/      Plugin and marketplace manifests; .mcp.json wires the connector
showcase.html        Tabbed viewer for the demo artifacts
```

## Evidence

- `demo-hookify/` is an unmodified run against an unfamiliar third-party package. It produced the full artifact set and, along the way, caught a comment in the original code claiming a feature was "(future)" when the engine already implemented it.
- `evals/BENCHMARK.md` compares runs with and without the skill on the same prompts: 86–87% citation coverage versus 0% for the baseline, with 6 of 6 sampled citations accurate. The second iteration honestly documents where the gap narrows.
- The connector's test suite replays all 12 citations from the demo's audit log against the pinned commit and verifies each one mechanically. The suite has 49 tests, including regression cases for every finding from an adversarial code review.

## Contributing

Issues and pull requests are welcome.

- Run the tests before submitting: `cd connector && npm test`. Set `HOOKIFY_ROOT` to a claude-code checkout's `plugins/hookify` directory to enable the acceptance tests.
- If you edit `SKILL.md` or `references/`, run `node scripts/sync-plugin-skill.mjs` to update the plugin copy. A test fails if the copies diverge.
- When you claim something about behavior, cite the line. The review standard here is the same one the tool enforces.

## License

[MIT](LICENSE)
