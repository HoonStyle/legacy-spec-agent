import test from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearMultiLanguageCache, indexSymbolsMulti } from "../src/multilang.js";

const FILES_PER_LANGUAGE = 400;
const LANGUAGES = [
  { directory: "python", extension: "py", source: (i: number) => `class Python${i}:\n    pass\n` },
  { directory: "typescript", extension: "ts", source: (i: number) => `export class TypeScript${i} {}\n` },
  { directory: "java", extension: "java", source: (i: number) => `class Java${i} {}\n` },
  { directory: "csharp", extension: "cs", source: (i: number) => `class CSharp${i} {}\n` },
  { directory: "go", extension: "go", source: (i: number) => `package corpus\ntype Go${i} struct{}\n` },
] as const;

function maxRssBytes(): number {
  return process.resourceUsage().maxRSS * 1024;
}

function createCorpus(root: string): { sourceBytes: number; symbols: number; supportedFiles: number } {
  let sourceBytes = 0;
  for (const language of LANGUAGES) {
    const directory = join(root, "src", language.directory);
    mkdirSync(directory, { recursive: true });
    for (let i = 0; i < FILES_PER_LANGUAGE; i++) {
      const source = language.source(i);
      writeFileSync(join(directory, `file-${i}.${language.extension}`), source);
      sourceBytes += Buffer.byteLength(source);
    }
  }

  for (const generated of [".claude/worktrees/stale", "bin", "obj", "node_modules/package"]) {
    const directory = join(root, generated);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "generated.ts"), "export class MustNotBeIndexed {}\n");
  }

  writeFileSync(join(root, "src", "unsupported.rb"), "class Unsupported; end\n");
  writeFileSync(join(root, "src", "binary.bin"), Buffer.from([0, 255, 0, 255]));
  const malformed = "export class Malformed {\n ???\n";
  writeFileSync(join(root, "src", "malformed.ts"), malformed);
  sourceBytes += Buffer.byteLength(malformed);
  symlinkSync(join(root, "src", "python", "file-0.py"), join(root, "src", "source-link.py"), "file");

  const unreadable = join(root, "obj", "unreadable.cs");
  writeFileSync(unreadable, "class UnreadableGenerated {}\n");
  if (process.platform !== "win32") chmodSync(unreadable, 0o000);

  return {
    sourceBytes,
    symbols: LANGUAGES.length * FILES_PER_LANGUAGE,
    supportedFiles: LANGUAGES.length * FILES_PER_LANGUAGE + 1,
  };
}

test("large mixed repository stays bounded and excludes generated content", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "lsc-large-corpus-"));
  try {
    const expected = createCorpus(root);
    const started = process.hrtime.bigint();
    const result = await indexSymbolsMulti(root, { limit: 50 });
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const peakRssBytes = maxRssBytes();

    assert.equal(result.files, expected.supportedFiles);
    assert.equal(result.unsupported_files, 1);
    assert.equal(result.total_symbols, expected.symbols);
    assert.deepEqual(result.truncated, {
      returned: 50,
      total: expected.symbols,
      omitted: expected.symbols - 50,
    });
    assert.equal(result.analysis_metrics.supported_files, result.files);
    assert.equal(result.analysis_metrics.wasm_parsed_files, result.files);
    assert.equal(result.analysis_metrics.wasm_cache_misses, result.files);
    // Exact bytes prove skipped generated, binary, unreadable, and symlink entries
    // were not silently substituted for one of the expected source files.
    assert.equal(result.analysis_metrics.source_bytes, expected.sourceBytes);
    assert.ok(result.analysis_metrics.structured_response_bytes < 100_000);
    assert.ok(!result.modules.some((module) => /(?:\.claude\/worktrees|bin|obj|node_modules)/.test(module.path)));
    assert.ok(!result.modules.some((module) => module.path === "src/source-link.py"));

    const warmStarted = process.hrtime.bigint();
    // This lexically-last language fits inside the 512-entry LRU after the full scan.
    const warm = await indexSymbolsMulti(root, { subdir: "src/typescript", granularity: "package" });
    const warmElapsedMs = Number(process.hrtime.bigint() - warmStarted) / 1_000_000;
    assert.equal(warm.files, FILES_PER_LANGUAGE);
    assert.equal(warm.analysis_metrics.wasm_cache_hits, FILES_PER_LANGUAGE);
    assert.equal(warm.analysis_metrics.wasm_cache_misses, 0);

    t.diagnostic(JSON.stringify({
      supported_files: result.files,
      elapsed_ms: Math.round(elapsedMs * 100) / 100,
      peak_rss_bytes: peakRssBytes,
      source_bytes: result.analysis_metrics.source_bytes,
      response_bytes: result.analysis_metrics.structured_response_bytes,
      cache_reuse: {
        files: warm.files,
        hits: warm.analysis_metrics.wasm_cache_hits,
        misses: warm.analysis_metrics.wasm_cache_misses,
        elapsed_ms: Math.round(warmElapsedMs * 100) / 100,
      },
    }));
  } finally {
    clearMultiLanguageCache();
    if (process.platform !== "win32") {
      try { chmodSync(join(root, "obj", "unreadable.cs"), 0o600); } catch { /* fixture may already be gone */ }
    }
    rmSync(root, { recursive: true, force: true });
  }
});
