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

## Interpretation limits

This is a deterministic synthetic fixture, not an end-to-end agent-session benchmark. It measures the context required to transmit source versus a structural index; it does not include prompts, reasoning, tool-call envelopes, citations opened after indexing, output tokens, or provider-side cache accounting. Results also vary by repository shape and tokenizer.

An end-to-end claim requires replaying the same reconstruction task, model, prompt, repository revision, and token accounting with and without the connector. Until that eval exists, only the fixture numbers above should be quoted.

## Recommended workflow

1. Start with `granularity: "package"` to select relevant packages.
2. Request file-level symbols only for selected packages.
3. Open only the cited line ranges needed to support claims.
4. Reuse `analysis_metrics` to check cache reuse and response size.
5. Treat semantic gaps as targeted follow-up reads rather than reopening the entire repository.
