import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { countTokens } from "gpt-tokenizer/encoding/o200k_base";
import { clearMultiLanguageCache, indexSymbolsMulti } from "../src/multilang.js";

const FIXTURES = {
  python: ["py", (n: number) => `class Service${n}:\n    def execute(self, value: int) -> int:\n        total = value\n${"        total = total + value\n".repeat(20)}        return total\n`],
  typescript: ["ts", (n: number) => `export class Service${n} { execute(value: number): number { let total = value; ${"total += value; ".repeat(20)} return total; } }\n`],
  java: ["java", (n: number) => `class Service${n} { int execute(int value) { int total = value; ${"total += value; ".repeat(20)} return total; } }\n`],
  csharp: ["cs", (n: number) => `class Service${n} { int Execute(int value) { int total = value; ${"total += value; ".repeat(20)} return total; } }\n`],
  go: ["go", (n: number) => `package services\ntype Service${n} struct {}\nfunc (s Service${n}) Execute(value int) int { total := value; ${"total += value; ".repeat(20)} return total }\n`],
} satisfies Record<string, [string, (n: number) => string]>;

test("token benchmark: structured indexes use fewer o200k tokens than raw source", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "lsc-token-benchmark-"));
  const paths: string[] = [];
  try {
    for (const [language, [extension, source]] of Object.entries(FIXTURES)) {
      const directory = join(root, language);
      mkdirSync(directory);
      for (let index = 0; index < 5; index++) {
        const path = join(directory, `service-${index}.${extension}`);
        writeFileSync(path, source(index));
        paths.push(path);
      }
    }
    const raw = paths.map((path) => `// ${path.slice(root.length + 1)}\n${readFileSync(path, "utf8")}`).join("\n");
    const fileIndex = await indexSymbolsMulti(root, { granularity: "file" });
    const packageIndex = await indexSymbolsMulti(root, { granularity: "package" });
    const rawTokens = countTokens(raw);
    const fileTokens = countTokens(JSON.stringify(fileIndex));
    const packageTokens = countTokens(JSON.stringify(packageIndex));
    const reduction = (tokens: number) => Math.round((1 - tokens / rawTokens) * 1000) / 10;
    t.diagnostic(JSON.stringify({ tokenizer: "o200k_base", fixture_files: paths.length, raw_tokens: rawTokens, file_index_tokens: fileTokens, package_index_tokens: packageTokens, file_reduction_percent: reduction(fileTokens), package_reduction_percent: reduction(packageTokens) }));
    assert.ok(fileTokens < rawTokens * 0.65, `file index should reduce fixture tokens by at least 35%: ${fileTokens}/${rawTokens}`);
    assert.ok(packageTokens < rawTokens * 0.1, `package index should reduce fixture tokens by at least 90%: ${packageTokens}/${rawTokens}`);
  } finally {
    clearMultiLanguageCache();
    rmSync(root, { recursive: true, force: true });
  }
});
