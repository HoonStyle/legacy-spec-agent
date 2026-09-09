# Connector first-run deployment decision

- Decision date: 2026-09-09
- Status: accepted design; implementation not started
- Scope: Legacy Spec Agent as a standalone project
- Decision: prepare and run the connector from a versioned user cache; do not
  install or build inside the plugin directory at MCP startup

## Context

The current plugin launches `connector/bootstrap.mjs`. A clean Git-installed
copy intentionally contains neither `dist/` nor `node_modules/`, so the first MCP
connection runs `npm ci` and TypeScript compilation in place. The bootstrap lock
prevents concurrent installers, but the installed-plugin test budgets up to 180
seconds for connection and notes that cold Windows Node 20 can exceed the MCP
SDK's ordinary 60-second request timeout.

This design has four product problems:

1. The first protocol connection is also a package installation and build, so a
   network or registry failure appears as an MCP startup failure.
2. The plugin installation must be writable even though ordinary execution only
   needs read access.
3. Updating source beside an old build triggers compilation during startup,
   making startup time dependent on file mtimes and local tool availability.
4. A clean offline machine cannot start the connector. The existing fallback is
   LLM-only operation after failure, not offline connector support.

Local size measurements on the decision baseline explain why prebuilt output is
attractive but insufficient on its own:

| Material | Files | Size |
|---|---:|---:|
| Compiled `connector/dist` | 39 | 383,044 bytes |
| Connector source/manifests excluding `dist` and `node_modules` | 57 | 476,268 bytes |
| Current development `node_modules` | 5,626 | 154,636,483 bytes |
| `tree-sitter-wasms` within that install | — | about 49.37 MiB |

The full development dependency directory is not the proposed runtime payload;
it includes development-only packages. The 383 KB build still imports runtime
packages and WASM, while vendoring the current install would include unneeded
development packages. There is also no release/publish workflow today and both
`dist/` and `node_modules/` are ignored. Therefore this decision does not create
a partially prebuilt distribution that still needs an opaque first-run install.

The connector currently has six production dependency roots and all parser
dependencies are JavaScript/WASM. This removes native compilation from the
runtime path, but does not remove the need to supply those dependencies.

## Decision

Adopt a versioned connector runtime cache. The source-only plugin payload remains
immutable and can be read-only.

The connector source and dependencies live in a user-writable cache keyed by
connector version, plugin content digest, platform/architecture, Node major, and
`package-lock.json` SHA-256. A separate preparation command copies the connector
source into a temporary sibling, runs locked dependency installation and build
there, prunes development-only dependencies, validates the expected entrypoint
and bundled WASM grammar, writes the integrity record, and atomically renames the
candidate into place. Concurrent preparation uses a per-key lock; incomplete
candidates are recoverable and never become the active runtime.

The default cache parent is `%LOCALAPPDATA%\LegacySpecAgent\Cache` on Windows
and `$XDG_CACHE_HOME/legacy-spec-agent` (falling back to
`~/.cache/legacy-spec-agent`) on Linux. A configured override must still resolve
within an explicitly user-approved managed-cache directory.

The MCP launcher performs only bounded validation and launch:

- locate the exact cache key;
- verify its integrity record, entrypoint, runtime version, and required grammar;
- start the connector entrypoint from that cache;
- if absent or invalid, exit quickly with one actionable preparation command and
  an explicit `connector_unavailable` state.

Installation logs and progress belong to the preparation command, not MCP
stdout. MCP stdout remains protocol-only. A host that supports install hooks may
run preparation during plugin installation, but the launcher must not pretend
that such a hook ran.

## Offline and security contract

Cold offline connector startup is **not promised** by this decision. A prepared
and integrity-valid cache works without network access; an unprepared offline
installation fails fast and the skill may continue LLM-only with that limitation
disclosed. True cold-offline support would require a separately approved vendored
runtime artifact with licenses, SBOM, checksums/signature, size limits, and an
update policy.

Preparation must call the platform executable directly (`npm.cmd` on Windows,
`npm` elsewhere), use the committed lockfile, disable lifecycle scripts unless a
reviewed dependency requires one, constrain the destination to the managed cache,
and never execute target-repository code. The release must triage the dependency
audit before shipping; the 2026-09-09 local `npm ci` reported three moderate and
two high findings, which this decision does not auto-fix or waive.

No SDK is downloaded in this path. Semantic backends and SDK installation remain
stopped by `IMPLEMENTATION_ROADMAP.md`.

## Rejected alternatives

### Keep in-place first-run install

Rejected as the target design because it couples network/build work to protocol
startup and requires mutation of the installed plugin. It remains the current
behavior until the migration is implemented.

### Ship prebuilt `dist/` in the plugin

Rejected for the current channel. The small build output is useful evidence, but
it still requires runtime packages and WASM, `dist/` is currently ignored, and no
release artifact/signing workflow exists. Reconsider only as a complete runtime
artifact rather than a partial build that retains cold-install ambiguity.

### Vendor the current dependency tree in every plugin

Rejected for now because the unreviewed development tree is roughly 155 MB and
contains packages not needed at runtime. A production-only offline bundle may be
reconsidered only with measured compressed size, license/SBOM review, and signed
artifact integrity.

## Migration plan

1. Add a standalone preparation command and cache-key/integrity library. Do not
   change the launcher in this step.
2. Test preparation success, registry failure, checksum/integrity failure,
   interrupted install, concurrent install, cache reuse, and cache invalidation.
3. Change the plugin launcher to bounded cache validation and direct launch.
   Retain a precise message for installations created before the new cache exists.
4. Update installed-plugin smoke tests to use a read-only plugin copy and explicit
   preparation. Keep a separate negative smoke for cold offline startup.
5. Add a distinct Unicode-path smoke; the existing Windows test deliberately uses
   ASCII paths because of a Node `cpSync` issue.
6. Remove the in-place `npm ci`/build fallback only after the cache preparation
   path and rollback instructions exist.

This migration does not authorize automatic deletion of older caches. Eviction
and retention are a separate policy decision; until then, report stale cache
paths and let the user or host remove them explicitly.

## Acceptance matrix

| Case | Required result |
|---|---|
| Windows and Ubuntu, Node 20 and 22 | prepare and start successfully in CI |
| Plugin path with spaces and non-ASCII | no path corruption; plugin remains unchanged |
| Read-only plugin directory | prepared runtime starts successfully |
| Three concurrent prepares for one key | one atomic winner; all callers reuse it |
| Network unavailable, valid cache exists | start without registry access |
| Network unavailable, cache absent | fail fast with preparation guidance; no partial cache |
| Interrupted or corrupt preparation | active cache unchanged; candidate recoverable |
| Lockfile/version/Node-major change | new cache key; never reuse incompatible runtime |
| Ordinary analysis | no SDK request or download |
| Target repository snapshot | byte-identical before and after preparation/start |

Release approval additionally requires the normal connector suite, the installed
plugin smoke on all four CI matrix entries, a production dependency audit record,
and measured cold-prepare and warm-start times. Passing this decision review is
not implementation or release approval.
