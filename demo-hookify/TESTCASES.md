# hookify — Characterization Test Cases (reconstructed)
> **These are characterization tests, not requirement tests.** They lock in the *current* behavior of the code so a refactor can prove it changed nothing. Each case derives from a verified rule in `SPEC.md` and cites the line that defines it. They assert "what the code does today", not "what it should do".
- Source: `plugins/hookify/` @ `15a21e1`

| # | Given | When | Then (current behavior) | Locks rule at |
|---|---|---|---|---|
| TC-01 | one matching `action:'block'` rule and one matching warning rule | `evaluate_rules` runs | returns the **block** response; the warning message is **dropped** | `rule_engine.py:61` |
| TC-02 | a rule with an empty `conditions` list | evaluated against any payload | rule **does not match** (never fires) | `rule_engine.py:117` |
| TC-03 | `tool_matcher = "Edit|Write"`, `tool_name = "Read"` | rule evaluated | **no match** (exact OR membership, not substring/regex) | `rule_engine.py:137` |
| TC-04 | `tool_matcher = "Edit|Write"`, `tool_name = "Edit"` | rule evaluated | **match** | `rule_engine.py:137` |
| TC-05 | a `regex_match` condition with pattern `"ERROR"` and field value `"internal error"` | condition checked | **matches** (case-insensitive by `re.IGNORECASE`) | `rule_engine.py:14` |
| TC-06 | a condition with an operator not in the supported set (e.g. `"gt"`) | condition checked | returns **no match** (unknown operator → False) | `rule_engine.py:166` |
| TC-07 | working directory has **no** `.claude/hookify.*.local.md` | `load_rules()` called | returns **`[]`** (CWD-relative discovery) | `config_loader.py:210` |
| TC-08 | frontmatter with legacy `pattern` and **no** `conditions`, `event: bash` | `Rule.from_dict` | produces one `regex_match` condition on field `command` | `config_loader.py:57` |
| TC-09 | malformed / non-JSON stdin | hook `main()` runs | prints a `Hookify error` systemMessage and **exits 0** (never blocks) | `hooks/pretooluse.py:70` |
| TC-10 | an invalid regex pattern in a condition | `_regex_match` runs | error is caught, warns to stderr, returns **False** (no match) | `rule_engine.py:269` |

## Notes
- **Coverage is behavior-driven, not exhaustive.** These trace the verified rules; they do not claim branch coverage.
- Cases derived only from **verified** claims. Nothing here rests on a `flagged`/`unverified` item — those live in `RISKS.md`, not as passing tests.
- A TC that would depend on the external host hook contract (e.g. "a `stop` rule actually halts the agent") is intentionally **omitted** — it can't be asserted from this package alone.
