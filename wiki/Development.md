# Development

## Repository layout

| Path | Purpose |
| --- | --- |
| `SKILL.md` | Skill workflow, templates, and hard rules. |
| `references/` | Detailed extraction, architecture, and critic contracts. |
| `SPEC.md` | Original project design document. |
| `CONNECTOR_DESIGN.md` | Connector design and milestone notes. |
| `connector/` | TypeScript MCP server, source, and tests. |
| `demo-hookify/` | Example reverse-spec run against a third-party package. |
| `evals/` | Benchmark data comparing skill and non-skill outputs. |
| `skills/` | Plugin-layout copy of the skill. |
| `scripts/` | Utility scripts, including plugin skill synchronization. |
| `wiki/` | Human-maintained project wiki pages. |

## Test workflow

Before submitting changes, run:

```bash
cd connector
npm test
```

This builds the connector and runs the Node.js test suite.

## Skill synchronization

If you edit `SKILL.md` or files under `references/`, sync the plugin copy:

```bash
node scripts/sync-plugin-skill.mjs
```

A test fails if the canonical skill files and plugin-layout copies diverge.

## Documentation workflow

When updating documentation:

1. Prefer facts already grounded in README, connector docs, or implementation.
2. Keep generated-output claims aligned with the actual artifact names.
3. Avoid promising intent-heavy documents such as ADRs or PRDs unless they are human-authored.
4. Keep Wiki pages concise enough to be copied into GitHub Wiki without transformation.

## Publishing to the GitHub Wiki tab

GitHub does not render the repository's `wiki/` directory in the visible Wiki tab automatically. The Wiki tab is backed by a separate git repository named `<owner>/<repo>.wiki.git`.

After reviewing local Wiki changes, publish them with:

```bash
scripts/publish-github-wiki.sh --remote git@github.com:OWNER/REPO.wiki.git
```

You can also set `WIKI_REMOTE` instead of passing `--remote`. The script copies the contents of `wiki/` into the separate Wiki repository, commits only when there are actual Wiki changes, and pushes the result.

## Pull request checklist

- Tests or relevant checks were run.
- New docs are linked from `wiki/Home.md` when appropriate.
- Changes to skill contracts are mirrored into plugin copies.
- Any skipped or environment-gated checks are called out in the PR body.
