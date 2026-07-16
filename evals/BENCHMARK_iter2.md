# Benchmark — expanded deliverables (iteration-2)

**Question**: on the *new* deliverables (interface def, test cases, risk register), does the skill still beat a plain LLM — or does an unprompted model already do this well?
**Method**: same task, two arms — *with-skill* (follows the "Optional deliverables" contracts) vs *baseline* (neutral ask: "produce an interface definition, test cases, and a risk list"). One fresh target, distinct from the demo and iteration-1: `plugins/security-guidance/hooks/session_state.py` (161 lines, undocumented public API + file-locking + GC).

## Results

| Metric | with-skill | baseline |
|---|---|---|
| `path:line` citations — INTERFACES | 51 | 0 |
| `path:line` citations — TESTCASES | 31 | 0 |
| line references — RISKS | 16 (`file:line`) | 6 (informal "(lines 112–113)") |
| Risks framed as **candidates** (not confirmed defects) | ✅ | ❌ (asserted as facts + mitigations) |
| Tests in characterization style (Given/When/Then, lock current behavior) | ✅ | ✅ (Setup/Input/Expected) |
| Signature accuracy (spot-check) | 3/3 exact | — (no line anchors to check) |
| Public functions documented | 6 (+1 internal) | 6 |
| Test cases | 17 | ~15 |
| Risks | 7 | 6 |
| Tokens | 50.0k | 39.0k |

### Signature spot-check (with-skill INTERFACES)
- `cleanup_old_state_files()` → real `session_state.py:49` ✓
- `load_state(session_id)` → real `session_state.py:88` ✓
- `with_locked_state(session_id, callback)` → real `session_state.py:118` ✓

## Interpretation — honest, the gap narrows here

- **Baseline is genuinely competent on these deliverables.** Unprompted, it produced detailed, characterization-style test cases and a real risk list that found actual issues (non-atomic `save_state`, silent `None`-on-failure ambiguity, missing `fsync`). This is *not* an iteration-1-style blowout where the baseline collapsed. A capable model writes decent interface/test/risk docs on its own.
- **Where the skill still wins, measurably:**
  1. **Verifiable citations everywhere.** with-skill attaches `path:line` to every item across all three docs (98 total). Baseline anchored lines only in the risk doc, and only informally ("(lines 112–113)") — its interface and test docs have **no line anchors at all**, so nothing there is checkable.
  2. **Honest framing on risks.** with-skill labels every risk a *candidate* needing a maintainer decision, "not a confirmed defect, not a measured metric." Baseline states risks as facts with confident mitigations — the same fluent-but-unfalsifiable failure mode, just better-hidden because the content is good.
  3. **Signature fidelity is checkable and correct** (3/3 sampled), because each carries an anchor to re-open.
- **Where the skill does NOT add much here:** test-case *framing*. Both arms landed on characterization-style tables. On this deliverable the skill's contribution is the citations and the "verified-items-only" discipline, not the format.

## Honest limits
- **n=1 target, single file, one iteration.** Weaker evidence than iteration-1's two targets.
- The coverage *ratio* is unreliable on table-heavy docs (separator/header rows dilute the denominator), so this report leans on **absolute citation counts and qualitative framing**, not a coverage percentage.
- Baseline quality varies run-to-run; a single strong baseline here may understate the average gap, just as a weak one would overstate it.
- Severity labels and "candidate" judgments are the skill's own framing — desirable for honesty, but not independently verified.

## Takeaway
For reverse-**spec** (iteration-1) the skill is decisively better. For these **secondary deliverables**, a good model is already close on content; the skill's durable, measurable edge is **checkability** (a line behind every claim) and **honest framing** (candidates, not verdicts) — exactly the properties that matter when the output feeds a refactor or an audit.
