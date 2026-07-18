# Connector Tools

The connector is a TypeScript MCP server that performs deterministic operations for Legacy Spec Agent. It is bundled with the plugin so both Claude Code and Codex workflows can use the same evidence engine.

## Tool overview

| Tool | Description |
| --- | --- |
| `verify_citation` | Checks a `path:line` citation against the actual source and returns a verdict with surrounding code. |
| `index_symbols` | Extracts functions, methods, classes, line ranges, and signatures using tree-sitter for Python. |
| `build_call_graph` | Builds module-to-module edges from imports and records unresolved imports as externals. |
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
