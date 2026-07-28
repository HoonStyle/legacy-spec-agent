# Reconstructed specification — Legacy Spec Agent

Analyzed source commit: `ecf88eda32182ccca352248c6dd0b20232309a31`
Generated at: `2026-07-28T04:57:25Z`
Coverage: standard profile; connector syntax analysis covered 38 supported Python/TypeScript files in `connector/`, `evals/`, and `scripts/`; two unsupported files were reported; no supported source was deliberately skipped.

## System purpose and boundary

The repository packages a Codex plugin named `legacy-spec-agent` whose declared purpose is reconstructing citation-grounded specifications and tracking drift, and whose bundled MCP server launches through `connector/bootstrap.mjs`. `.codex-plugin/plugin.json:2-22`

Inside the analyzed runtime boundary are plugin bootstrap, a stdio MCP server, deterministic analysis tools, charts, and report assembly. The server identifies itself as `legacy-spec-connector` version 0.2.1. `connector/src/server.ts:70-78`

## Actors and entrypoints

- **Plugin host:** starts Node with `connector/bootstrap.mjs` through the plugin manifest. `.codex-plugin/plugin.json:15-22`
- **MCP client:** sends requests over stdio after the executable resolves a target root, creates the server, and connects `StdioServerTransport`. `connector/src/index.ts:9-31`
- **Repository maintainer:** invokes the manifest-defined build, test, or start scripts. `connector/package.json:14-18`

## Core use cases

1. Analyze supported source into a symbol index: `index_symbols` exposes file or package granularity and a bounded symbol limit. `connector/src/server.ts:162-184`
2. Build a syntax-resolved module dependency graph while keeping unresolved imports external. `connector/src/server.ts:187-210`
3. Verify a source citation mechanically and return exact surrounding source for semantic review by the caller. `connector/src/server.ts:138-160`
4. Re-check baseline citations and classify drift without automatically merging changes into the specification. `connector/src/server.ts:213-234`

## Business rules

- **BR-001 — Explicit-root precedence.** Root selection uses a non-placeholder CLI argument first, then `LEGACY_SPEC_ROOT`, `CLAUDE_PROJECT_DIR`, `CODEX_PROJECT_DIR`, and finally the current directory. `connector/src/root.ts:15-30`
- **BR-002 — Invalid roots fail closed.** Startup writes an error and exits with status 1 when the resolved root is absent or not a directory. `connector/src/index.ts:9-14`
- **BR-003 — Downloads require a consent token.** The download tool accepts a minimum-32-character token issued by the approval tool and passes it to the download manager. `connector/src/server.ts:96-117`
- **BR-004 — Graph semantics stay syntax-only.** The graph contract explicitly excludes method calls, symbol resolution, runtime calls, and dynamic dispatch. `connector/src/server.ts:187-194`
- **BR-005 — First-run setup is serialized.** Bootstrap acquires a directory lock, removes locks older than ten minutes, and times out after three minutes of waiting. `connector/bootstrap.mjs:51-71`

## Validation and error behavior

Invalid startup roots terminate before the MCP connection (Related: BR-002). `connector/src/index.ts:11-14` Tool schemas constrain counts, graph granularity, URLs, checksums, and consent inputs before handlers execute. `connector/src/server.ts:14-64`

## State transitions

- **Bootstrap missing/stale → ready:** missing dependencies cause `npm ci`; missing or stale build output causes `npm run build`; successful setup logs completion. `connector/bootstrap.mjs:74-87`
- **Unconfigured root → resolved root:** root resolution applies the ordered sources in BR-001. `connector/src/root.ts:20-30`

## Configuration

- `LEGACY_SPEC_TOOLCHAIN_CACHE` overrides the default toolchain cache under the user's home directory. `connector/src/server.ts:70-74`
- `LEGACY_SPEC_ROOT`, `CLAUDE_PROJECT_DIR`, and `CODEX_PROJECT_DIR` are ordered target-root overrides (Related: BR-001). `connector/src/root.ts:25-30`

## Persistence and side effects

Bootstrap may install npm dependencies and build generated JavaScript in the connector directory. `connector/bootstrap.mjs:74-87` Report rendering writes `REPORT.html` next to the supplied deliverables. `connector/src/report.ts:1-12`

## Operational behavior

The connector reserves stdout for MCP and sends human-facing startup messages to stderr. `connector/src/index.ts:27-31` The npm package requires Node 20 or newer. `connector/package.json:11-17`

## Known limitations

The dependency graph is not a method-call graph and does not resolve runtime or dynamic dispatch (Related: BR-004). `connector/src/server.ts:187-194`

## Unverified / Needs-review

- **UV-001 — Product intent beyond declared metadata.** Human business intent cannot be derived from runtime code; searched plugin manifests, connector source, scripts, and tests.
