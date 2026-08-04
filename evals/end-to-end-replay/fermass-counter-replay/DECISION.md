# Counter-enabled bounded replay decision

## Decision

**Stop** the current connector rollout and the paused expansion roadmap.

The treatment-compliant replay completed all 10 runs with provider counters. Connector use improved the primary input-token measure in only **1/5** pairs, worsened the paired median by **42,303 input tokens**, and increased aggregate input tokens by **31.3%**. Task quality and citation accuracy did not regress.

- Evaluation revision: `1984b4e324b9e4bec7fa2c7f48fc1b105737fbee`
- Runner: `codex-cli 0.146.0`, `gpt-5.6-sol`, reasoning effort `medium`
- Execution date: 2026-08-04
- Results root: `C:\Users\Lenovo\Documents\FerMass_Replay_Compliant_1984b4e\results`

The five original task prompts, pinned revision, model, reasoning effort, and alternating condition order were preserved. The connector condition also received a documented compliance instruction requiring at least one relevant `replay_connector` call; zero-call runs were rejected.

## Paired measurements

Connector minus control; negative values favor connector.

| Task | Control input | Connector input | Input delta | Input delta % | Control elapsed | Connector elapsed | Elapsed delta | Calls | Response bytes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| task01 | 153,076 | 195,379 | +42,303 | +27.6% | 67,982 ms | 63,298 ms | -4,684 ms | 5 | 399,559 |
| task02 | 471,103 | 378,349 | -92,754 | -19.7% | 160,230 ms | 151,640 ms | -8,590 ms | 4 | 401,115 |
| task03 | 403,023 | 759,415 | +356,392 | +88.4% | 202,323 ms | 199,238 ms | -3,085 ms | 7 | 401,778 |
| task04 | 209,931 | 247,766 | +37,835 | +18.0% | 69,597 ms | 85,231 ms | +15,634 ms | 3 | 402,721 |
| task05 | 246,910 | 367,668 | +120,758 | +48.9% | 96,659 ms | 140,998 ms | +44,339 ms | 4 | 399,841 |
| **Total** | **1,484,043** | **1,948,577** | **+464,534** | **+31.3%** | **596,791 ms** | **640,405 ms** | **+43,614 ms** | **23** | **2,005,014** |

- Paired median input delta: **+42,303 tokens**.
- Paired median elapsed delta: **-3,085 ms**.
- Elapsed improved in 3/5 pairs, but total elapsed worsened **7.3%**.

## Other provider counters

| Counter | Control total | Connector total | Delta |
|---|---:|---:|---:|
| Cached input tokens | 1,218,304 | 1,702,400 | +484,096 |
| Cache-write input tokens | 0 | 0 | 0 |
| Output tokens | 15,064 | 16,288 | +1,224 |
| Reasoning output tokens | 3,756 | 3,368 | -388 |
| Separately reported tool tokens | Not exposed | Not exposed | N/A |

The CLI does not expose billed currency cost. Raw provider categories are reported without adding connector bytes to input tokens because the provider does not document them as disjoint.

## Quality and citation review

All ten results meet the fixed completion criteria, and the cited locations support the claims.

| Task | Control | Connector | Review |
|---|---|---|---|
| task01 | Pass | Pass | CRC init, polynomial, and low-byte-first are accurate |
| task02 | Pass | Pass | Mass/LoadCell/Offset formulas and locations are accurate |
| task03 | Pass | Pass | Includes config source, `MachineConfig.MassOffset`, MLC calculation, `BuildRecord`, and downstream paths |
| task04 | Pass | Pass | 1xxx/2xxx/3xxx bands and 11 registrations are accurate |
| task05 | Pass | Pass | Both worktrees contain one correct System Purpose change; UTF-8 content and `git diff --check` pass |

There is no observed quality or citation regression. The failure is resource efficiency.

## Observed failure mode

Every connector run called `index_symbols` once. Each call rescanned **192 supported files / 886,843 source bytes / 1,509 symbols** and returned about **398 KB** in the recorded MCP result. Across five runs this reopened the same indexed surface five times and dominated the 2,005,014 connector response bytes.

This directly matches the protocol's narrow-or-stop conditions:

- the primary median worsened;
- most indexed source was routinely reopened (5/5 connector runs);
- only 1/5 pairs improved after connector overhead was included.

Shell command events were control **33** versus connector **28**, but fewer shell commands did not translate into lower provider input.

## Source-read accounting limitation

Codex JSONL records shell commands, not the exact files opened by broad `rg` operations. Exact unique/repeated file-read counts therefore remain unavailable for control runs. Connector telemetry does provide the repeated full-index scope above, which is sufficient for the stop criterion. Command counts are not relabelled as file-read counts.

## Gate evaluation

- At least 4/5 primary pairs improve: **fail (1/5)**.
- Paired median improves: **fail (+42,303 tokens)**.
- Task quality does not regress: **pass**.
- Citation accuracy does not regress: **pass**.
- Connector treatment integrity: **pass (23 calls total; every connector run used it)**.
- Connector overhead included: **pass**.

## Roadmap consequence

Do not resume C#/Go/Java module resolvers, cache/concurrency expansion, semantic backends, or SDK installation to make this pilot pass. The replay did not show that missing language resolution caused wasted reads or failed tasks. It showed that the current connector repeatedly emits a repository-wide symbol index whose cost exceeds its navigation benefit.

Any future reconsideration should be a separately approved, narrowly scoped experiment based on compact or persistent index results, not an expansion of the paused roadmap.
