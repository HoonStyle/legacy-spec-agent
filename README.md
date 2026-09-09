# Legacy Spec Agent

<p align="center">
  <a href="README.md"><img alt="Language: English" src="https://img.shields.io/badge/lang-English-blue"></a>
  <a href="README.ko.md"><img alt="Language: Korean" src="https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-blue"></a>
  <img alt="Version 0.3.0" src="https://img.shields.io/badge/version-0.3.0-informational">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green"></a>
  <a href="https://github.com/HoonStyle/legacy-spec-agent/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/HoonStyle/legacy-spec-agent/actions/workflows/ci.yml/badge.svg"></a>
  <br>
  <img alt="Node 20+" src="https://img.shields.io/badge/Node-20%2B-339933?logo=nodedotjs&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="MCP" src="https://img.shields.io/badge/MCP-16%20tools%20%C2%B7%20stdio-6E56CF">
  <img alt="tree-sitter WASM" src="https://img.shields.io/badge/parsers-tree--sitter%20WASM%20%C2%B7%20Lezer-4B8BBE">
  <br>
  <a href="https://claude.com/claude-code"><img alt="Claude Code plugin" src="https://img.shields.io/badge/Claude%20Code-plugin-D97757?logo=claude&logoColor=white"></a>
  <a href="https://openai.com/codex/"><img alt="Codex plugin" src="https://img.shields.io/badge/Codex-plugin-000000?logo=openai&logoColor=white"></a>
  <img alt="Analyzes" src="https://img.shields.io/badge/analyzes-Python%20%C2%B7%20JS%2FTS%20%C2%B7%20Java%20%C2%B7%20C%23%20%C2%B7%20Go-555">
  <img alt="CI: Ubuntu · Windows" src="https://img.shields.io/badge/CI-Ubuntu%20%C2%B7%20Windows-0078D4">
</p>

A plugin for [Claude Code](https://claude.com/claude-code) and Codex / ChatGPT Work mode: a skill plus a bundled MCP connector.

Legacy Spec Agent writes the spec that undocumented code never had. It reads the source, works out what the code actually does, and produces spec documents in which every claim points at a `path:line`. Anything it cannot back with a line of code stays out of the main text and is listed under **Unverified** instead.

The citations are not decoration. When the code changes later, the agent re-checks each one and reports whether it still holds, moved, drifted, or lost its target.

## Table of contents

- [Why not just ask an LLM to summarize the repo?](#why-not-just-ask-an-llm-to-summarize-the-repo)
- [Outputs](#outputs)
- [Modes](#modes)
- [Connector tools](#connector-tools)
- [Large repository support](#large-repository-support)
- [Installation](#installation)
- [Repository layout](#repository-layout)
- [Evidence](#evidence)
- [Wiki](#wiki)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Why not just ask an LLM to summarize the repo?

That works, and the summary is often useful. The problem is checking it. Two mechanisms make the output auditable:

1. **Critic gate.** Before artifacts are written, a review pass reopens every cited line and checks that the code really supports the claim.
2. **MCP connector.** Citation checks, symbol indexing, drift detection, manifest extraction, and chart rendering run in a TypeScript server, not as model output. The same input gives the same result every time.

The model does the reasoning. The connector checks the evidence.

## Outputs

Mode A has two profiles. **`standard` is the default.** Use the reduced **`core` only when explicitly requested**.

| Profile | Artifacts |
| --- | --- |
| `core` | `SPEC.md`, `ARCHITECTURE.md`, `audit_log.jsonl` |
| `standard` (default) | Everything in `core`, plus `INTERFACES.md`, `DATA_MODEL.md`, `ONBOARDING.md`, `TESTCASES.md`, `RISKS.md`, charts, and `REPORT.html` |

`SPEC.md` covers the system boundary, actors and entrypoints, use cases, identified business rules, validation and errors, state transitions, configuration, persistence and side effects, operations, known limitations, and unverified items. The other standard documents define architecture views, exact interface contracts, persistent entities versus configuration or interface contracts, grounded setup, test inventories, scenarios and candidates, and categorized risks. Stable `BR-*`, `API-*`, `DM-*`, `TC-*`, `RSK-*`, and `UV-*` IDs provide validated cross-document links.

Rules that apply to every document:

- A required document or section is never left empty and never padded with guesses. If the concept does not exist in the repository, the output states the search scope and **Not found**. Contracts the repository does not define stay in **Unverified**.
- Charts and `REPORT.html` are generated when the connector's chart and report tools are available. Their absence must be disclosed otherwise.
- Architecture output from `build_call_graph` is labeled `graph_type: module_dependency` and `resolution: syntax`. It is syntax-only module and import analysis, not a method call graph and not compiler, runtime, or dynamic-dispatch resolution.
- `CHANGELOG.md` is optional on request when Git history is available. There is deliberately no ADR, PRD, or user manual, because source code cannot prove design or business intent.

## Modes

### Mode A: reverse-spec

The full reconstruction pipeline:

1. Scope the codebase.
2. Extract behavior module by module.
3. Assemble the architecture and interface documents.
4. Run the critic gate over every citation.
5. Write the artifacts.

### Mode B: drift check

Takes an existing spec and the commit it was recorded against, compares every cited line with the current tree, and classifies what changed. Updates are proposed, not silently applied.

## Connector tools

The bundled connector exposes eighteen tools. Without the connector the skill still runs, LLM-only, with weaker guarantees.

| Group | Tools | Purpose |
| --- | --- | --- |
| Evidence | `verify_citation`, `detect_drift` | Re-open cited lines; classify what changed since a recorded commit |
| Structure | `index_symbols`, `build_call_graph` | Syntax-level symbol index and module dependency graph |
| Extraction | `extract_data_model`, `extract_project_meta`, `extract_changelog` | Typed models, manifests, Git-derived changelog |
| Rendering | `emit_charts`, `render_report` | Charts and `REPORT.html` |
| Provenance | `snapshot_source_scope`, `snapshot_document_claims` | Freeze raw source bytes and cited-claim bindings without making semantic judgments |
| Publication | `evaluate_document_gate`, `publish_approved_documents` | Final gate for Mode A and transactional publish |
| Toolchains | `assess_language_toolchains`, `approve_toolchain_download`, `download_language_toolchain`, `get_toolchain_download_status`, `cancel_toolchain_download` | Detect missing SDKs and download them only after explicit consent |

### Publication gate

`evaluate_document_gate` is the read-only final gate for Mode A. The scope manifest is frozen before the Writer runs, the Independent Evidence Auditor and Coverage Sentinel audit the frozen draft, and only the Gatekeeper submits those records to the gate. It independently re-enumerates the frozen code surface and validates required documents and sections, citation lines and 100% audit coverage, IDs, omissions, truncation disclosure, syntax graph labels, role identifiers, and the actual draft/source/claim bindings. It returns `approved` or `rejected` with deterministic reason codes and never edits deliverables. Its assurance result keeps deterministic `structural_validation`, caller-judged `semantic_audit`, `execution_provenance`, and `source_provenance` separate. Distinct actor strings and `caller_attested` records are not reported as host-verified execution.

`publish_approved_documents` applies the same gate to a staging draft and transactionally replaces the destination only after approval. A rejected draft leaves the prior publication untouched.

### About `build_call_graph`

Despite its compatibility-preserving name, `build_call_graph` returns a syntax-level **module dependency graph**, not a method call graph. Its response labels this contract as `graph_type: "module_dependency"` and `resolution: "syntax"` and reports `resolved` and `unresolved` import-relationship counts. It does not resolve symbols, method calls, runtime dispatch, or dynamic dispatch. Unresolved imports remain in `externals` rather than being guessed.

### Missing language SDKs

The machine running the connector does not have to match the repository's development environment.

- `assess_language_toolchains` detects Python, JavaScript/TypeScript, Java, C#, and Go source, reads common version pins, checks local SDK commands, and returns structured consent metadata without downloading or executing anything.
- Bundled pure-JavaScript/WASM parsers provide syntax-level symbol indexing, import graphs, and typed model extraction for those five languages without a local SDK. SDK availability and semantic-backend availability are reported separately. Finding or downloading an SDK does not by itself claim compiler-resolved semantic extraction.
- If enhanced analysis needs a missing parser or SDK, the agent shows the exact language, version, official artifact URL, SHA-256, purpose, approximate size when known, and isolated cache location, then asks. Declining does not stop reconstruction. The agent continues with direct source reading or syntax-only analysis and reports the semantic checks it could not perform.
- After explicit approval, `approve_toolchain_download` issues a short-lived one-use token bound to that plan. `download_language_toolchain` consumes the token and downloads into the connector-managed cache with official host and path rules, bounded redirects, size, concurrency and time limits, and checksum verification. `get_toolchain_download_status` reports bytes, percentage, and state (queued, downloading, verifying, complete, failed, cancelled). `cancel_toolchain_download` cancels.
- The approval source is reported as `caller_attestation`: the agent host attests that it showed the plan and received approval. The connector does not claim protocol-level MCP elicitation.
- Download completion means a verified artifact, not an installed SDK. Approval never implies extraction, dependency restore, build, install hooks, repository scripts, or target-code execution. Non-interactive runs default to no download unless the caller explicitly opts in.

## Large repository support

Reports on big codebases would get unwieldy without limits, so:

- Item-level outputs accept a `limit` and say what was omitted when truncated.
- Graphs can be rendered at `package` granularity, which keeps large dependency diagrams readable.

Multi-language responses also report source bytes, serialized response bytes, and WASM parse-cache hits and misses. A deterministic synthetic benchmark measures 43.0% fewer tokens for file-level symbols and 95.3% fewer for package summaries than concatenated raw source. These are fixture results, not end-to-end session or billing-token claims. See [`TOKEN_USAGE.md`](TOKEN_USAGE.md).

The end-to-end question has been measured directly. A counter-enabled paired replay (five task pairs, per-run provider token counters, 2026-08-04) found that connector runs **increased** aggregate provider input tokens by 31.3% and improved only one of five pairs, with no regression in task quality or citation accuracy. Every run re-emitted the repository-wide symbol index. The recorded decision is **Stop** for efficiency-motivated expansion. See [`evals/end-to-end-replay/counter-replay/DECISION.md`](evals/end-to-end-replay/counter-replay/DECISION.md). Treat the connector as a verification and grounding engine, not a context-cost optimization.

Release blockers, resolver work, semantic backends, and the deliberately last SDK-installer phase are ordered in [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md).

## Installation

**Claude Code.** Nothing to do. The `.claude-plugin/` manifest and root `.mcp.json` work as-is.

**Codex / ChatGPT Work mode.** Register this checkout as a local plugin marketplace, then install **Legacy Spec Agent** from the Plugins Directory:

```bash
codex plugin marketplace add "$(pwd)"
```

Both runtimes run the same connector and differ only in launch metadata, because each handles paths its own way. Without the connector, the skill still works in LLM-only mode.

**Windows.** The Python parser is pure JavaScript, so `node-gyp`, Visual Studio, and the VC++ toolset are not required. If a previous version left a broken install behind, run once from the plugin's `connector` directory:

```bat
rmdir /s /q node_modules 2>nul
npm ci
npm run build
node bootstrap.mjs "C:\path\to\project"
```

If the last command stays up as a stdio MCP server instead of exiting, the install is repaired. Stop it with Ctrl+C, then restart Claude Code or reconnect the MCP server.

## Repository layout

```text
SKILL.md             Skill workflow, templates, and hard rules
references/          Extraction, architecture, and critic contracts
SPEC.md              Original design document (v0.1)
CONNECTOR_DESIGN.md  Connector design and milestone record (C0-C7)
connector/           TypeScript MCP server with sixteen tools and tests
demo-hookify/        Example Mode A run against a third-party package
evals/               With-skill vs. baseline benchmark results
wiki/                Human-maintained wiki pages
skills/              Plugin-layout copy of the skill
scripts/             Utilities, including plugin skill synchronization
.codex-plugin/       Codex plugin manifest
.agents/plugins/     Repo-local Codex marketplace for local installation
.claude-plugin/      Claude Code plugin and marketplace manifests
.mcp.json            Claude Code MCP config for the bundled connector
showcase.html        Tabbed viewer for demo artifacts
```

## Evidence

- `demo-hookify/` is an unedited run against a third-party package. It produced the full artifact set and caught a stale comment that described an already-implemented feature as future work.
- `evals/BENCHMARK.md` compares runs with and without the skill on the same prompts: 86-87% citation coverage with the skill against 0% without, and 6 of 6 sampled citations accurate.
- The connector test suite replays all 12 citations from the demo audit log against the pinned commit and verifies them mechanically, plus regression tests for plugin packaging and issues found in review.
- `evals/end-to-end-replay/` preserves two bounded replays against a pinned InternalRepo revision. The 2026-08-04 counter-enabled replay measured provider tokens directly: quality and citations held in all ten runs, but connector runs cost 31.3% more input tokens, and the recorded decision is **Stop**. Negative measurements are evidence too, so it stays.

## Wiki

Human-maintained wiki pages live in [`wiki/`](wiki/Home.md). They summarize setup, workflow, outputs, connector tools, and development practices in Markdown files that can also be copied into a GitHub Wiki.

## Development

To prepare a fresh cloud or ephemeral Linux workspace:

```bash
scripts/setup-cloud-test.sh
```

The script verifies Node.js 20+, installs connector dependencies with `npm ci`, builds the TypeScript connector, and runs the test suite. Set `RUN_TESTS=0` to install and build without tests, or `REGISTER_CODEX_MARKETPLACE=1` to also register this checkout as a local Codex plugin marketplace and install **Legacy Spec Agent**. When `codex` is not installed, the script falls back to `npx -y @openai/codex`. Pin a CLI version with `CODEX_NPM_PACKAGE=@openai/codex@<version>`.

Run the connector tests before submitting changes:

```bash
cd connector
npm test
```

CI runs the same suite on Ubuntu and Windows with Node 20 and 22. The optional acceptance tests need `HOOKIFY_ROOT` pointing at a Claude Code checkout's `plugins/hookify` directory.

If you edit `SKILL.md` or anything in `references/`, sync the plugin copy. A test fails if the two copies diverge.

```bash
node scripts/sync-plugin-skill.mjs
```

## Contributing

Issues and pull requests welcome. When you document behavior, hold it to the same standard the tool does: cite the line that proves it.

## License

[MIT](LICENSE)
