# Token usage measurement

Token reduction is a primary connector objective, so it is measured separately from parser correctness. Every multi-language symbol, dependency, and data-model response reports supported files, source bytes considered, WASM parse-cache hits and misses, files served through the WASM parser, and serialized structured-response bytes.

These byte metrics are deterministic and tokenizer-independent. They do not claim to be model billing tokens.

## Synthetic tokenizer benchmark

`connector/test/token-benchmark.test.ts` creates 25 source files across Python, JavaScript/TypeScript, Java, C#, and Go. It compares concatenated raw source with file- and package-granularity symbol-index JSON using the `o200k_base` tokenizer.

| Input | Tokens | Reduction from raw |
| --- | ---: | ---: |
| Concatenated raw source | 3,056 | — |
| File symbol index | 1,741 | 43.0% |
| Package symbol index | 145 | 95.3% |

Run it with:

```bash
cd connector
npm run build
node --test dist/test/token-benchmark.test.js
```

The test enforces a conservative floor of 35% reduction for file granularity and 90% for package granularity.

## Large mixed-repository resource benchmark

`connector/test/large-corpus.test.ts` creates 2,001 supported files across Python, JavaScript/TypeScript, Java, C#, and Go. It also includes generated/worktree directories, binaries, unsupported sources, a symlink, malformed syntax, and an unreadable generated file. The test reports elapsed time, process peak RSS, source bytes, structured-response bytes, and cache hits/misses as a Node test diagnostic.

Run it with:

```bash
cd connector
npm run build
node --test dist/test/large-corpus.test.js
```

The corpus is generated in the system temporary directory and removed after the test. Measurements are regression diagnostics rather than fixed performance thresholds because CI operating systems and runners have different resource profiles. Deterministic assertions enforce the supported-file count, generated/worktree exclusion, cache reuse, and a response size below 100,000 bytes when the symbol limit is 50.

## Interpretation limits

This is a deterministic synthetic fixture, not an end-to-end agent-session benchmark. It measures the context required to transmit source versus a structural index; it does not include prompts, reasoning, tool-call envelopes, citations opened after indexing, output tokens, or provider-side cache accounting. Results also vary by repository shape and tokenizer.

An end-to-end claim requires replaying the same reconstruction task, model, prompt, repository revision, and token accounting with and without the connector. That comparison has now been run twice: the first pilot exposed no provider counters and was Inconclusive, and the counter-enabled 2026-08-04 replay (below) measured the opposite of a savings claim — connector runs increased the primary input-token measure. Quote the fixture numbers above only as fixture measurements; never quote an end-to-end token or cost saving, because the measured end-to-end result is a net increase.

## First bounded replay result

The preserved pilot record is in `evals/end-to-end-replay/pilot/`. It paired five tasks against InternalRepo revision `1984b4e324b9e4bec7fa2c7f48fc1b105737fbee`, once without and once with the connector. Both conditions passed all five tasks without citation errors. Direct source reads decreased in four of five connector runs, with a median paired change of -1, but most decreases were a one-for-one replacement of a source read with a connector call.

The provider exposed no per-run input, cached-input, output, reasoning, or tool token counters, and elapsed time was not measured. Consequently, read counts are diagnostic trace data rather than the protocol's primary metered token or cost measure. The decision is **Inconclusive**: it neither establishes end-to-end savings nor justifies resuming resolver or semantic-backend work. A follow-up may repeat or expand the comparison only in an environment that exposes provider usage and permits connector overhead to be included.

## Counter-enabled replay result (2026-08-04): Stop

The counter-enabled repeat of the five InternalRepo pairs is preserved in `evals/end-to-end-replay/counter-replay/`. It followed the capture rules this section previously prescribed: Codex CLI `0.146.0` exposed per-run input, cached-input, cache-write, output, and reasoning counters; tool tokens are not separately exposed, so connector response bytes were recorded separately and never added to input tokens; treatment compliance (at least one relevant connector call per connector run) was enforced with zero-call runs rejected. The runner model `gpt-5.6-sol` (medium reasoning effort) is an explicit recorded deviation from the preserved pilot's model; conditions inside each new pair were identical and the alternating order was preserved.

The connector improved the primary input-token measure in 1 of 5 pairs, worsened the paired median by +42,303 input tokens, and increased aggregate input tokens by 31.3% (1,484,043 control versus 1,948,577 connector). Elapsed time improved in 3 of 5 pairs but worsened 7.3% in total. All ten runs passed the fixed completion criteria and the cited locations support the claims, so the failure is resource efficiency, not quality. The dominant overhead is structural: every connector run called `index_symbols` once, rescanning 192 supported files / 1,509 symbols and returning about 398 KB, for roughly 2.0 MB of connector response bytes across five runs.

The recorded decision is **Stop**: the continue condition (at least 4/5 pairs improving with an improving median) failed and the protocol's narrow-or-stop conditions matched. Efficiency-motivated expansion — language resolvers, cache/concurrency growth, semantic backends, SDK installation — is not resumed on the basis of this work. Any future reconsideration must be a separately approved, narrowly scoped experiment around compact or persistent index results, not a repeat of this replay as roadmap expansion. The full gate table and failure-mode analysis are in that directory's `DECISION.md`.

## Recommended workflow

1. Start with `granularity: "package"` to select relevant packages.
2. Request file-level symbols only for selected packages.
3. Open only the cited line ranges needed to support claims.
4. Reuse `analysis_metrics` to check cache reuse and response size.
5. Treat semantic gaps as targeted follow-up reads rather than reopening the entire repository.

The 2026-08-04 replay is a caution about this workflow rather than a validation of it: agent runs requested the full file-level index on every run instead of starting at package granularity, and the recorded decision treats that observed behavior — not the idealized sequence above — as the measured result.
