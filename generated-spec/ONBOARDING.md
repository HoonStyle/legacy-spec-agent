# Onboarding

Analyzed source commit: `ecf88eda32182ccca352248c6dd0b20232309a31`
Generated at: `2026-07-28T04:57:25Z`
Coverage/search scope: connector package manifest, bootstrap, entrypoint, and plugin manifest; no supported source deliberately skipped.

## Prerequisites

Node.js 20 or newer is required. `connector/package.json:11-13`

## Install, build, test, and run

From `connector/`:

```bash
npm ci
npm run build
npm test
npm start
```

The build, test, and start scripts are defined in the package manifest. `connector/package.json:14-18` First-run plugin bootstrap performs `npm ci` only when dependencies are missing/stale and rebuilds when required. `connector/bootstrap.mjs:74-87`

## Configuration

Pass the target repository as the first CLI argument or set `LEGACY_SPEC_ROOT`, `CLAUDE_PROJECT_DIR`, or `CODEX_PROJECT_DIR`; the first available source wins in that order. `connector/src/root.ts:15-30`

## Troubleshooting

- If startup reports that the root is not a directory, correct the selected argument/environment path. `connector/src/index.ts:9-14`
- If no target root is provided and the connector points at its own checkout, startup emits a warning explaining the supported overrides. `connector/src/index.ts:16-24`

## Not found

Repository-defined deployment service units, container images, and production monitoring procedures were **Not found** in the searched runtime manifests and entrypoint.
