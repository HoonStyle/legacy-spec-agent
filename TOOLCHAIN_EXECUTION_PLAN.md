# Language toolchain execution plan

This plan turns the language-toolchain workflow into an executable, reviewable contract. Work is ordered so that no download path is exposed before containment and consent are enforced.

## Phase 1 — trustworthy assessment

- Detect Python, JavaScript/TypeScript, Java, C#, and Go while excluding only generated/worktree paths.
- Resolve `subdir` through real paths and reject symlink escapes.
- Read repository version pins, including Python/Node manifests and Java Maven/Gradle toolchains.
- Resolve SDK executables to absolute paths and reject candidates inside the target repository.
- Report toolchain, syntax-parser, and semantic-backend readiness separately; never infer semantic readiness from an SDK version command or claim a parser exists when it does not.
- Apply language-specific compatibility rules.

**Exit gate:** assessment tests cover path traversal, malicious `PATH`, same-major incompatible Python, Java pins, and parser availability.

Bundled syntax parsing is complete for the five language families and does not depend on these optional SDK artifacts. SDK preparation is only for later compiler-resolved semantic backends.

## Phase 2 — consent-gated artifact download

- Bind explicit approval to the exact language, version, URL, and SHA-256 in a short-lived one-use token; downloads accept only that token.
- Accept only HTTPS artifact URLs matching language-specific official host/path rules, validate every redirect, and require a 64-character SHA-256 digest.
- Write only beneath an isolated cache, using a temporary file followed by atomic rename after checksum verification.
- Never restore dependencies, build the repository, run install hooks, extract archives, or execute downloaded content.
- Keep approval, artifact download, installation, and target-code execution as separate permissions.

**Exit gate:** tests prove absent/expired/reused consent, untrusted paths and redirects, size limits, and checksum mismatch all fail closed.

## Phase 3 — observable and cancellable jobs

- Return a job ID immediately.
- Expose `queued`, `downloading`, `verifying`, `complete`, `failed`, and `cancelled` states.
- Report downloaded bytes, total bytes when supplied by the server, percentage, and error text.
- Allow cancellation through a separate MCP tool.

**Exit gate:** a local fixture server verifies progress, completion, checksum failure, and cancellation without external network access.

## Phase 4 — integration and documentation

- Register assessment, caller-attested approval-token, start-download, status, and cancellation MCP tools.
- Keep the agent responsible for presenting the consent question; the connector never interprets an analysis request as consent.
- Update English, Korean, connector, wiki, and skill documentation to describe only implemented behavior.
- Keep the packaged skill copy synchronized.

**Verification:** `node scripts/sync-plugin-skill.mjs`, `git diff --check`, and `cd connector && npm test`.

## Deferred boundary

Artifact extraction and SDK installation remain deliberately separate. Archive extraction has format-specific traversal and executable-permission risks; it must not be hidden inside a download permission. Until a separately reviewed installer exists, a completed job means **downloaded and checksum-verified artifact**, not an installed SDK.
