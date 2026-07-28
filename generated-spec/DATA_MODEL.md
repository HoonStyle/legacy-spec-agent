# Data model

Analyzed source commit: `ecf88eda32182ccca352248c6dd0b20232309a31`
Generated at: `2026-07-28T04:57:25Z`
Coverage/search scope: connector type/interface declarations and extractor output across all 38 supported source files; no supported source deliberately skipped.

## Persistent entities

**Not found.** The connector type extraction and searches of source/manifests found no repository-defined database entity, primary key, foreign key, or persistence lifecycle.

## Configuration and interface contracts

### DM-001 — `RootResolution`

- **Fields:** `root: string` and `source: RootSource`, both required by the TypeScript interface. `connector/src/root.ts:3-13`
- **Default:** the resolver falls back to the resolved current directory when no argument or environment override exists. `connector/src/root.ts:20-30`
- **Validation:** directory validation occurs at process startup. `connector/src/index.ts:11-14`
- **Relations/lifecycle:** Not found; this is an in-memory return contract, not a persistent entity.
- **Related:** BR-001, API-001.

### DM-002 — `Chart`

- **Fields:** required `format` (`svg|mermaid`), `content` string, and `alt` string. `connector/src/charts.ts:30-34`
- **Default/validation/relations/lifecycle:** Not found in the interface declaration.
- **Persistence:** Not claimed; report rendering may inline chart assets supplied from a charts directory. `connector/src/report.ts:5-12`
- **Related:** API-001.

## Unverified

- **UV-003 — External MCP wire types.** Detailed SDK-owned envelope fields are not defined in this repository; searched server and entrypoint imports.
