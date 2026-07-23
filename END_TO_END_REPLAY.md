# End-to-end replay pilot

This is the operating checklist for the bounded replay in roadmap item 4. Its purpose is to make a cheap continue, narrow, or stop decision—not to produce a general performance claim.

## Scope

- Select one or two repositories and pin a commit SHA for each.
- Define five representative tasks with objectively reviewable completion criteria.
- Include a mix of code navigation, impact analysis, and a small change when practical.
- Run every task once without the connector and once with it, for 10 runs total.
- Do not add connector features during the pilot.

## Paired-run controls

Keep these identical within each pair:

- repository revision and clean starting state;
- prompt and completion criteria;
- model, model version, and model settings;
- available non-connector tools;
- environment and time limits.

Alternate condition order (`control → connector`, then `connector → control`). Do not give only one condition a warmed connector or provider cache. Preserve the prompt, transcript, tool events, final result, and provider usage record for every run. Record unavoidable differences rather than silently normalizing them.

## Task manifest

Create one row before running each task:

| Field | Value |
| --- | --- |
| Task ID | Stable identifier |
| Repository | Repository name or URL |
| Revision | Full commit SHA |
| Task type | Navigation, impact analysis, or change |
| Prompt | Exact prompt or path to it |
| Completion criteria | Observable pass conditions |
| Condition order | Control first or connector first |

Do not rewrite a prompt after seeing one condition's result. If a task is invalid, discard both runs and document why.

## Run record

Record one row per run. Use `not exposed` rather than estimating unavailable provider counters.

| Field | Value |
| --- | --- |
| Task ID / condition | Task ID and control or connector |
| Model | Provider model name/version and settings |
| Input / cached-input tokens | Exact provider counters |
| Output / reasoning tokens | Exact provider counters |
| Tool-related counters | Exact provider counters, if separate |
| Primary metered measure | Selected provider token or cost measure |
| Connector calls / response bytes | Zero for control |
| Unique / repeated source reads | Counts from the run trace |
| Elapsed time | Wall-clock duration |
| Task result | Pass, partial, or fail, with reason |
| Citation result | Correct/checked and total citations |
| Raw evidence | Paths or IDs for transcript and usage record |

Provider categories can overlap. In particular, do not add tool-response tokens to input tokens unless the provider documents them as disjoint. Publish raw counters alongside the selected primary measure.

## Pair review

For each task, calculate the connector-minus-control difference for the primary measure, repeated reads, and elapsed time. Review task correctness and citations without using token results to excuse a quality regression.

After all five pairs, record:

- number of pairs where the primary measure improved;
- median paired change in the primary measure;
- median paired change in repeated reads and elapsed time;
- pass/partial/fail counts by condition;
- citation errors by condition;
- how often connector runs reopened most indexed source;
- any result that depends on excluding connector overhead.

## Decision record

Choose exactly one outcome:

- **Continue:** at least four of five pairs improve the primary measure, its median improves, and task quality and citation accuracy do not regress.
- **Narrow or stop:** the median worsens, most indexed source is routinely reopened, or improvement exists only when connector overhead is excluded.
- **Inconclusive:** explain the specific source of uncertainty before approving an expansion to at most 10–20 tasks.

The decision record must identify observed failure modes before proposing work. Resume a language resolver or semantic backend only when the replay shows that its absence materially caused wasted reads or failed tasks.
