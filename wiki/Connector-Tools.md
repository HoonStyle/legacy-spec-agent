# Connector Tools

The connector is a TypeScript MCP server that performs deterministic operations for Legacy Spec Agent. It is bundled with the plugin so both Claude Code and Codex workflows can use the same evidence engine.

## Tool overview

| Tool | Description |
| --- | --- |
| `assess_language_toolchains` | Detects Python, JavaScript/TypeScript, Java, C#, and Go source plus version pins and local SDK readiness; returns consent metadata without downloading. |
| `approve_toolchain_download` | Issues a short-lived, one-use token bound to the exact approved URL and checksum. |
| `download_language_toolchain` | Starts an explicitly approved download with official-host and SHA-256 enforcement. |
| `get_toolchain_download_status` | Returns queued/downloading/verifying/complete/failed/cancelled state and byte progress. |
| `cancel_toolchain_download` | Cancels an active download and removes its temporary artifact. |
| `verify_citation` | Checks a `path:line` citation against the actual source and returns a verdict with surrounding code. |
| `index_symbols` | Extracts declarations and line ranges for Python, JavaScript/TypeScript, Java, C#, and Go using bundled Lezer/Tree-sitter WASM parsers. |
| `build_call_graph` | Builds module edges from each supported language's import/using syntax and records unresolved imports as externals. |
| `detect_drift` | Compares existing spec citations against the current tree and classifies drift status. |
| `extract_data_model` | Turns dataclasses and model-like classes into entities, typed fields, and relations. |
| `extract_project_meta` | Collects package metadata, dependencies, run commands, environment variables, and tests. |
| `extract_changelog` | Groups Git history by conventional commit type. |
| `emit_charts` | Renders deterministic coverage, drift, benchmark, architecture, and ER chart artifacts. |
| `render_report` | Assembles deliverables, audit logs, and charts into a self-contained tabbed `REPORT.html`. |

## Shared guarantees

- Citation paths are constrained to the connector root.
- Item-level outputs can accept limits and must report truncation metadata when capped.
- Package-level granularity keeps large repositories readable.
- `verify_citation` and `detect_drift` share matching behavior so Mode A and Mode B do not contradict each other on the same citation.

## Example test command

```bash
cd connector
npm test
```

## When the connector is unavailable

The skill can still run in LLM-only mode, but guarantees are weaker because line validation, drift classification, and report rendering are no longer handled by deterministic code.

## Missing language toolchains

Language tooling is optional enhancement, not a prerequisite for completing a run. `assess_language_toolchains` performs detection and readiness checks but never downloads, restores, builds, or executes target code. When it reports a missing parser or SDK, the agent must ask before downloading it. The request identifies each tool's version, purpose, official source, approximate size when known, and isolated cache destination.

If the user declines, cannot be asked, or the download fails, analysis continues with direct source inspection or an available syntax-only parser. The resulting coverage statement records semantic limitations such as unresolved overloads, generated code, or external types. Toolchain approval never authorizes dependency restore, builds, install hooks, repository scripts, or target-code execution; those actions require separate consent.

An approved download is started separately and returns a job ID. Poll its status for a progress indicator or cancel it. Completion means the artifact was downloaded and checksum-verified; extraction and installation are intentionally outside this permission boundary.
