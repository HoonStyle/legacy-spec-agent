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

An end-to-end claim requires replaying the same reconstruction task, model, prompt, repository revision, and token accounting with and without the connector. The first bounded pilot now exists, but it did not expose provider token counters. It therefore does not support a billing-token or cost-savings claim; only the fixture numbers above should be quoted as token measurements.

## First bounded replay result

The preserved pilot record is in `evals/end-to-end-replay/fermass-pilot/`. It paired five tasks against FerMass revision `1984b4e324b9e4bec7fa2c7f48fc1b105737fbee`, once without and once with the connector. Both conditions passed all five tasks without citation errors. Direct source reads decreased in four of five connector runs, with a median paired change of -1, but most decreases were a one-for-one replacement of a source read with a connector call.

The provider exposed no per-run input, cached-input, output, reasoning, or tool token counters, and elapsed time was not measured. Consequently, read counts are diagnostic trace data rather than the protocol's primary metered token or cost measure. The decision is **Inconclusive**: it neither establishes end-to-end savings nor justifies resuming resolver or semantic-backend work. A follow-up may repeat or expand the comparison only in an environment that exposes provider usage and permits connector overhead to be included.

## Next decision: counter-enabled bounded replay

Feature expansion remains paused while the current connector is evaluated as an MVP. The initial five-pair pilot was genuinely inconclusive because provider usage was unavailable. Repeat those pairs, or expand to at most 10–20 tasks, only in a counter-enabled environment. For every pair, keep the prompt, model and model settings, available non-connector tools, completion criteria, and repository revision identical. Alternate which condition runs first, avoid sharing warmed connector state across only one condition, and retain the raw run records.

Capture, when the provider exposes them:

- the provider's token counters exactly as reported, including input, cached-input, output, reasoning, and tool-related counters when separately exposed;
- pricing or billing units and the provider/model version when known;
- connector calls and their response bytes;
- unique and repeated source-file reads;
- elapsed time and task success;
- citation coverage and citation accuracy.

Choose one primary metered token or cost measure supported by the provider data, and publish every raw counter alongside it. Token categories may overlap—for example, tool responses may already be included in input tokens—so never sum counters without confirming that they are disjoint. Include connector responses and follow-up source reads rather than silently excluding overhead.

After five pairs, write a short decision record. Continue only when the connector improves the primary measure in at least four pairs and improves its median without a task-quality or citation-accuracy regression. Narrow or stop when it increases the median, agents routinely reopen most indexed source, or the apparent benefit requires excluding connector overhead. These are pilot decision rules, not a general performance claim.

Do not implement another language resolver or semantic backend merely to improve the benchmark. A replay must first show that the missing resolution or semantic information materially causes wasted reads or failed tasks.

Follow `END_TO_END_REPLAY.md` to prepare the task manifest and record each paired run without changing the protocol after results are visible.

## Recommended workflow

1. Start with `granularity: "package"` to select relevant packages.
2. Request file-level symbols only for selected packages.
3. Open only the cited line ranges needed to support claims.
4. Reuse `analysis_metrics` to check cache reuse and response size.
5. Treat semantic gaps as targeted follow-up reads rather than reopening the entire repository.
