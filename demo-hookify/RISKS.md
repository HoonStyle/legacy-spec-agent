# hookify — Risk & Defect-Candidate Register (reconstructed)
> Formalizes the `flagged` audit-log entries and the `Unverified` spec items into a review register. These are **candidates surfaced by reconstruction**, not confirmed defects — each needs a maintainer decision. Nothing here is stated as fact in the main spec.
- Source: `plugins/hookify/` @ `15a21e1`

| ID | Severity | Finding | Evidence | Suggested action |
|---|---|---|---|---|
| RK-01 | 🟠 Med | **Doc–code contradiction.** `action:'block'` is documented as `(future)` but the blocking branch is already fully implemented. Callers can't tell if `block` is supported. | `config_loader.py:40` vs `rule_engine.py:55-61` | Decide: mark `block` supported and fix the comment, or gate it. |
| RK-02 | 🟡 Low | **Bespoke YAML parser edge cases.** Not PyYAML; quoted values containing `:`/`,`, numeric types (kept as strings), and nesting beyond one list-of-dicts level are not handled. Malformed rule files may parse silently wrong. | `config_loader.py:98` | Add tests for these inputs, or adopt a real YAML lib. |
| RK-03 | 🟡 Low | **`posttooluse` duplicates `pretooluse`.** Functionally identical aside from docstrings; no distinct post-execution logic. Maintenance risk (two files drift). | `hooks/posttooluse.py:65` | Confirm intent; factor shared dispatcher if unintended. |
| RK-04 | ⚪ Info | **Silent no-op when run outside project root.** CWD-relative discovery means running from another directory loads zero rules with no warning — enforcement silently disabled. | `config_loader.py:210` | Consider a warning when `.claude/` is absent. |
| RK-05 | ⚪ Info | **Halting semantics unverifiable here.** Whether a `stop`/`prompt` rule can actually stop the agent depends on the host hook contract, outside this package. | `hooks/stop.py` | Verify against Claude Code hook docs. |

## How this register was built
- RK-01…03 are the three `audit_log.jsonl` entries with `action:"flagged"`, promoted to reviewable items.
- RK-04…05 come from the `SPEC.md` **Unverified / Needs-review** section.
- Severity is a **reconstruction-time judgment**, not a measured metric — treat as a triage hint, not a verdict.
