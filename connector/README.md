# @legacy-spec/connector

The deterministic engine behind `legacy-spec-agent`, packaged as a stdio MCP server. The skill handles the reasoning; this server handles everything that must produce identical results on every run. The design is documented in `../CONNECTOR_DESIGN.md`.

## Tools

| Tool | What it does |
|------|--------------|
| `verify_citation` | Checks a `path:line` citation against the actual source and returns a verdict with the surrounding code |
| `index_symbols` | Indexes functions, methods, and classes with line ranges and signatures (Lezer, Python) |
| `build_call_graph` | Builds module-to-module edges from import statements; unresolved imports are listed as externals |
| `detect_drift` | Classifies each citation in an existing spec as intact, moved, drifted, orphaned, or unresolved, by comparing the cited line's content at the spec's baseline commit against the current tree |
| `extract_data_model` | Turns dataclasses and model classes into entities, typed fields, and relations |
| `extract_project_meta` | Collects name, version, dependencies, run commands, and environment variables from manifests and code |
| `extract_changelog` | Groups git history by conventional-commit type |
| `emit_charts` | Renders coverage, drift, and benchmark SVGs plus architecture and ER diagrams from structured data |
| `render_report` | Assembles a deliverables directory into one self-contained tabbed `REPORT.html` |

Two properties hold across all tools:

- **No silent truncation.** Item-level outputs accept a `limit`, and when they cap they return `truncated: {returned, total, omitted}`. A `granularity: "package"` option collapses file-level results to package-level summaries for large repositories.
- **One matching engine.** `verify_citation` and `detect_drift` share `src/matching.ts` (whitespace-normalized, blank-line- and reflow-tolerant), so Mode A and Mode B cannot contradict each other on the same citation.

## Install and run

```bash
cd connector
npm install
npm run build

# register with Claude Code; the last argument is the codebase to analyze
claude mcp add legacy-spec -- node /path/to/connector/dist/src/index.js /path/to/target
```

stdout carries the MCP protocol; diagnostics go to stderr. When installed as part of the plugin, `bootstrap.mjs` runs the install and build automatically on first launch and rebuilds after updates.

### Windows installation

The Python syntax engine is pure JavaScript and does not use `node-gyp`, Visual Studio,
or a native C++ toolset. An installation left broken by an older connector release can
be reset once from `cmd.exe`:

   ```bat
   cd /d "C:\path\to\plugin\connector"
   rmdir /s /q node_modules 2>nul
   npm ci
   npm run build
   node bootstrap.mjs "C:\path\to\project"
   ```

The last command should stay running as an MCP stdio server; stop it with Ctrl+C,
then reconnect or restart Claude Code.

## `verify_citation` contract

```
input : { path, line, expected_snippet?, claim?, context_lines? = 3 }
output: { verdict: match | line_mismatch | file_missing | content_mismatch,
          actual_source?,     // cited line with surrounding context, numbered
          suggested_line?,    // where the snippet was actually found
          line_count? }       // returned on line_mismatch
```

The tool guarantees that the location is valid and returns the exact source. Whether a natural-language claim is actually supported by that source is still judged by the LLM critic reading the returned text. Citation paths are confined to the connector root; anything that tries to escape is rejected.

## Tests

```bash
npm test
```

Set `HOOKIFY_ROOT` to a claude-code checkout's `plugins/hookify` directory to enable the acceptance tests, which replay the demo's 12 audit-log citations and check the package-level call graph against real code.
