# Demo run: legacy-spec-agent on `hookify`

This directory contains a real Mode A (reverse-spec) run against an undocumented third-party codebase: `plugins/hookify/` from `anthropics/claude-code`, pinned at commit `15a21e1`. Nothing here was written by hand as showcase copy. The files are the skill's actual output, verified afterward.

## What was produced

| File | Contents |
|---|---|
| `SPEC.md` | Reconstructed spec: business rules, I/O, constraints, each claim with a `path:line` citation |
| `ARCHITECTURE.md` | Dependency graph plus a cited control-flow flowchart |
| `INTERFACES.md` | Public API surface with real signatures |
| `DATA_MODEL.md` | Entities, fields, and relations, with a Mermaid ER diagram |
| `ONBOARDING.md` | Run commands, dependencies, and environment variables from the manifests |
| `TESTCASES.md` | Characterization tests derived from verified rules |
| `RISKS.md` | Defect candidates promoted from flagged audit entries |
| `CHANGELOG.md` | Git history grouped by commit type |
| `audit_log.jsonl` | 12 verification decisions: 9 verified, 3 flagged and moved to Unverified |

## How the run went

1. **Scope and ingest.** Mapped `hookify/`; six code modules, the rest empty stubs.
2. **Extract.** Two parallel subagents (one for `core/`, one for `hooks/`) returned citation-tagged findings per module.
3. **Architect.** Synthesized the call graph into the Mermaid diagram.
4. **Critic gate.** Reopened every cited line to confirm each claim. Inferences that could not be grounded were quarantined, not deleted.
5. **Emit.** Wrote the artifacts above.

## The finding that made the run worth it

The reconstruction surfaced an inconsistency hiding in the original docstrings. `config_loader.py:40` labels `action:'block'` as "(future)", but `rule_engine.py:55-61` already implements blocking in full. Rather than state "block is unsupported" as fact, the Critic gate flagged the contradiction for a maintainer decision. That is the "no ungrounded sentence ships" rule doing its job.
