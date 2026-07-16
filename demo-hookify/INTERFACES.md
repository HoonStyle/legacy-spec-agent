# hookify — Interface Definition (reconstructed)
> Public API surface reverse-generated from source. Signatures and behavior cite code. Private helpers (`_`-prefixed) are listed as internal, not contract.
- Source: `plugins/hookify/` @ `15a21e1`

## Public functions & entrypoints

| Symbol | Signature | Inputs | Output | Evidence |
|---|---|---|---|---|
| `RuleEngine.evaluate_rules` | `(self, rules: List[Rule], input_data: Dict[str, Any]) -> Dict[str, Any]` | rule list + hook payload | block/warn/allow response dict (`{}` = allow) | `rule_engine.py:35` |
| `compile_regex` | `(pattern: str) -> re.Pattern` | regex string | compiled pattern, `re.IGNORECASE`, `lru_cache(128)` | `rule_engine.py:15` |
| `load_rules` | `(event: Optional[str] = None) -> List[Rule]` | event filter (`bash`/`file`/`stop`/`prompt`/None) | enabled rules matching event | `config_loader.py:198` |
| `load_rule_file` | `(file_path: str) -> Optional[Rule]` | path to one `.local.md` | one Rule, or `None` on error/invalid | `config_loader.py:244` |
| `extract_frontmatter` | `(content: str) -> tuple[Dict[str, Any], str]` | file text | (frontmatter dict, body); `({}, content)` if no valid `---` | `config_loader.py:87` |
| `Rule.from_dict` | `(cls, frontmatter: Dict[str, Any], message: str) -> Rule` | parsed frontmatter + body | Rule dataclass | `config_loader.py:45` |
| `Condition.from_dict` | `(cls, data: Dict[str, Any]) -> Condition` | condition dict | Condition dataclass (op defaults `regex_match`) | `config_loader.py:23` |
| `main` (×4 hooks) | `() -> None` (exits 0) | stdin JSON payload | prints JSON decision to stdout | `hooks/pretooluse.py:35` · `hooks/posttooluse.py` · `hooks/stop.py:30` · `hooks/userpromptsubmit.py:30` |

## Hook I/O contract (all four entrypoints)
- **In**: a JSON object on **stdin** exposing at least `tool_name` (PreToolUse/PostToolUse) and any fields rules inspect (`transcript_path`, `reason`, `user_prompt`, `tool_input`).  `hooks/pretooluse.py:39`
- **Out**: a JSON decision on **stdout**, always printed even when empty.  `hooks/pretooluse.py:59`
- **Exit**: always `0` (fail-open).  `hooks/pretooluse.py:70`
- **Env**: `CLAUDE_PLUGIN_ROOT` required to resolve the `hookify` package on `sys.path`.  `hooks/pretooluse.py:14`

## Internal (not public contract)
`RuleEngine._rule_matches` `rule_engine.py:96` · `._matches_tool` `rule_engine.py:127` · `._check_condition` `rule_engine.py:144` · `._extract_field` `rule_engine.py:182` · `._regex_match` `rule_engine.py:256`. These are implementation detail — a refactor may change them without breaking the public surface above.

## ⚠️ Unverified
- The exact JSON **decision schema** consumed by Claude Code (which keys actually gate a tool call) is defined by the host hook contract, not this package — treated as external. See `SPEC.md`.
