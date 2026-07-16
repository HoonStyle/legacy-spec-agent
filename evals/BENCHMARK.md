# Benchmark — legacy-spec-agent vs baseline (iteration-1)

**Question**: does the skill actually change the output, or would a plain LLM do the same?
**Method**: same task prompt, two arms — *with-skill* (subagent Reads `SKILL.md` + `references/agent-roles.md` and follows Mode A) vs *baseline* (identical prompt, no skill). Two undocumented targets from `anthropics/claude-code @15a21e1`, distinct from the hookify demo. Eval B is TypeScript to test cross-language generality.

## Results

| Metric | A · with-skill | A · baseline | B · with-skill | B · baseline |
|---|---|---|---|---|
| Claim bullets | 42 | 31 | 52 | 19 |
| **Citation coverage** | **0.86** | **0.00** | **0.87** | **0.00** |
| Total `path:line` citations | 79 | 0 | 62 | 0 |
| Unverified section (isolates unknowns) | ✅ | ❌ | ✅ | ❌ |
| Structured spec | ✅ | partial | ✅ | ❌ |
| Fabricated metrics | none | none | none | none |
| Tokens | 48.7k | 42.7k | 46.1k | 36.0k |
| Wall time (s) | 78.0 | 68.9 | 100.7 | 45.9 |

### Citation accuracy (spot-check, with-skill)
Sampled citations were re-opened against source and matched the claim exactly:
- `diffstate.py:260` → `if len(sha) == 40 and all(c in "0123456789abcdef" for c in sha)` — "40 lowercase-hex" ✓
- `diffstate.py:296` → `merged = merged[:_REVIEWED_SHAS_CAP][::-1]` — "cap to last 500" ✓
- `diffstate.py:426` → `review_set = (dirty_now & changed_since) if changed_since is not None else dirty_now` — captured the "don't intersect with ∅" fallback ✓
- `sweep.ts:100` → `for (let page = 1; page <= 10; page++)` — "paginates up to 10 pages" ✓

Sample accuracy: **6/6 correct**. No hallucinated line numbers found in the sample.

## Interpretation

- **The skill's value is not "structure" — it's groundedness.** Baseline A produced a readable, sectioned spec, but with **zero verifiable citations** and **no isolation of unknowns**. It reads well and cannot be checked. The with-skill arm ties ~86–87% of claims to a line a reviewer can open, and quarantines what it can't ground.
- **Cross-language holds.** TypeScript (Eval B) behaves like Python: same coverage, same accuracy, correct cross-file grounding (it cited the imported `issue-lifecycle.ts` config source).
- **Cost is modest.** With-skill spends ~14–28% more tokens and more wall time — the price of re-opening lines in the Critic gate. That overhead *is* the verification.
- **Baseline's failure mode is the dangerous one**: confident, fluent, unfalsifiable documentation. For a spec used to *refactor safely*, an uncheckable claim is a liability, not a convenience.

## Honest limits of this benchmark
- n=2 targets, single-file each; fan-out path not stress-tested here (covered by the hookify demo).
- Coverage counts a claim as cited if a `path:line` appears on its bullet — it does not weight importance.
- Accuracy is a 6-citation sample, not a full audit.
- One iteration, one model. A larger test set (skill-creator step: "expand and re-run at scale") is the next rigor step.
