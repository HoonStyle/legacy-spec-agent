# Quick Start

## Requirements

- Node.js 20 or newer for the bundled TypeScript connector.
- npm for installing connector dependencies and running tests.
- A Claude Code or Codex / ChatGPT Work mode environment if using the plugin workflow.

## Local Codex plugin setup

From the repository root:

```bash
codex plugin marketplace add "$(pwd)"
```

Then install **Legacy Spec Agent** from the Plugins Directory.

## Claude Code setup

Claude Code uses the repository's `.claude-plugin/` manifest and root `.mcp.json` configuration. No separate Codex marketplace registration is needed for Claude Code usage.

## Prepare a fresh workspace

For cloud or ephemeral Linux workspaces, run:

```bash
scripts/setup-cloud-test.sh
```

The setup script checks Node.js, installs connector dependencies with `npm ci`, builds the connector, and runs the connector test suite. Set `RUN_TESTS=0` to install and build without running tests.

## Run connector tests manually

```bash
cd connector
npm test
```

Some acceptance tests are skipped unless `HOOKIFY_ROOT` points to a Claude Code checkout's `plugins/hookify` directory.

## Typical first run

Ask the agent to document a target repository. When no prior generated `SPEC.md` exists in the output location, the skill defaults to reverse-spec mode and the `standard` output profile. That profile writes `SPEC.md`, `ARCHITECTURE.md`, `audit_log.jsonl`, `INTERFACES.md`, `DATA_MODEL.md`, `ONBOARDING.md`, `TESTCASES.md`, `RISKS.md`, charts, and `REPORT.html`. Explicitly request the reduced `core` profile when only `SPEC.md`, `ARCHITECTURE.md`, and `audit_log.jsonl` are needed.

Review the result for audit coverage and resolvable stable IDs. A required concept that is absent from the repository should say what was searched and **Not found**; it should not produce an empty document or a guessed claim.

## Typical drift check

Run the skill again against an existing generated spec. When a prior generated `SPEC.md` exists, the skill defaults to drift-check mode and reports whether cited behavior is intact, moved, drifted, orphaned, or unresolved.
