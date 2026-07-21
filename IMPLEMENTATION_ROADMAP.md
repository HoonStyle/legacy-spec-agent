# Implementation roadmap

This roadmap separates release blockers from optional semantic enhancements. Work proceeds in the listed order, and each numbered item should remain an independently buildable, tested commit or short commit series.

## Current usable scope

The connector can currently perform SDK-independent syntax analysis for Python, JavaScript/TypeScript, Java, C#, and Go. It provides symbol indexes, syntax-level module dependencies, basic typed data models, bounded responses, parse-cache metrics, and deterministic citation/report tools.

The current graph is a **module dependency graph**, not a compiler-resolved method call graph. Downloaded SDK artifacts are verified cache entries; they are not installed or used by a semantic backend.

## Release-blocking priorities

### 1. Installed-plugin end-to-end smoke

**Status: complete.** `connector/test/installed-plugin.test.ts` copies a clean plugin without `node_modules` or `dist` into paths containing spaces, Korean, and Greek characters. It launches concurrent first-run servers through both the installed Codex manifest and the placeholder-expanded Claude MCP configuration. A bootstrap lock serializes dependency installation/build, while later processes re-check state and reuse the completed setup. The test indexes all five language fixtures, verifies the C# WASM grammar and built entrypoint exist, and compares a recursive SHA-256 snapshot to confirm that no target path or content changed. CI enables this network-dependent smoke with `PLUGIN_INSTALL_SMOKE=1` on Node 20 and 22 across Ubuntu and Windows.

Prove the distributed layout rather than only the checkout layout:

- copy the plugin without `node_modules` or `dist` into a clean path containing spaces and non-ASCII characters;
- run `connector/bootstrap.mjs` so it performs `npm ci` and a TypeScript build;
- connect over stdio MCP;
- invoke `index_symbols` against a mixed Python, JS/TS, Java, C#, and Go target;
- verify bundled WASM grammars load from the installed connector;
- verify the target repository remains unchanged.

**Exit gate:** the smoke passes on Ubuntu and Windows with supported CI Node versions from a clean plugin copy. Locally, run `cd connector && npm run build && PLUGIN_INSTALL_SMOKE=1 node --test dist/test/installed-plugin.test.js`; the ordinary suite skips this reinstall check unless explicitly enabled.

### 2. Large mixed-repository corpus

**Status: implementation complete; Ubuntu/Windows CI is the merge gate.** `connector/test/large-corpus.test.ts` generates 2,001 supported files across all five languages together with generated directories, binaries, unsupported sources, a symlink, malformed syntax, and an unreadable generated file. It records elapsed time, peak RSS, source and response bytes, and warm-cache reuse. The assertions enforce generated/worktree exclusion and bounded file-granularity responses.

Exercise thousands of supported files plus `.claude/worktrees`, `bin`, `obj`, `node_modules`, binaries, unsupported sources, symlinks, malformed syntax, and unreadable files. Record elapsed time, peak RSS, response bytes, and cache reuse.

**Exit gate:** no OOM, generated/worktree files are excluded, and response limits remain effective.

### 3. Accurate tool contract

Label current graph output as `module_dependency` with `resolution: "syntax"`, resolved/unresolved counts, and documentation that it does not represent method calls or dynamic dispatch.

**Exit gate:** clients cannot mistake syntax imports for a semantic call graph.

### 4. Language-specific module resolution

Implement separately:

1. TypeScript `baseUrl`, `paths`, project references, package exports, and missing extensions.
2. C# solutions, project references, namespaces, global/aliased `using`, and namespace-to-project edges.
3. Go workspaces, nested modules, `replace`, vendor, and major-version suffixes.
4. Java Maven/Gradle source roots, modules, wildcard imports, and static imports.

Uncertain imports must remain external/unresolved instead of being guessed from a filename.

### 5. Per-file failure isolation

Continue after unreadable, changing, oversized, invalid-encoding, grammar-load, or parse-error files. Return structured `failed_files` diagnostics separately from `unsupported_files`.

**Exit gate:** one bad file cannot abort an otherwise useful repository analysis.

### 6. Cache lifecycle and concurrency

Cover simultaneous access, mutation during analysis, eviction beyond 512 entries, repository deletion, explicit cleanup, and server shutdown. Prevent duplicate parsing and tree use-after-delete.

**Exit gate:** bounded memory and deterministic results under concurrent MCP calls.

## Effect validation

### 7. End-to-end token replay

After output contracts stabilize, replay the same repository revision, task, prompt, and model with and without the connector. Record input, cached-input, tool-response, output, and reasoning tokens when provided, plus repeated file reads, elapsed time, citation coverage, and citation accuracy.

Suggested gate: at least 40% fewer input tokens and 70% fewer duplicate source reads, with no citation-accuracy loss and no more than a three-point citation-coverage drop.

The existing 25-file `o200k_base` benchmark remains a deterministic structural-index fixture, not an end-to-end billing-token claim.

## Optional semantic precision

### 8. TypeScript semantic backend

Discover projects, load the compiler API, resolve types/symbols/calls, and emit cited semantic edges. This is first because it can run inside the existing Node connector without an external SDK installer.

### 9. C# Roslyn backend

Discover solutions/projects, launch an isolated analyzer, resolve symbols and calls, and map every result back to source citations.

### 10. Go, Java, and Python semantic backends

Implement and gate each language independently. Set `semantic_backend_available: true` only when that backend is actually usable.

## Last: SDK installation

Only implement installation for a completed semantic backend that genuinely needs it. Keep download approval separate from archive extraction, installation, dependency restore, build, and execution approval. A safe installer must constrain traversal, links, expanded size/file count, permissions, platform/architecture selection, manifests, and cleanup.

## Commit policy

Every item is committed by functional boundary:

- implementation and its direct regression tests stay together when separating them would leave an unbuildable commit;
- benchmarks and their tokenizer dependency are separate from runtime code;
- documentation records only behavior already implemented or explicitly marks future work;
- every commit passes `git diff --check`, the relevant focused tests, and a TypeScript build;
- the final branch passes `node scripts/sync-plugin-skill.mjs` and `cd connector && npm test`.
