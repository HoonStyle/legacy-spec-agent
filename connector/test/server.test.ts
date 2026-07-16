import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SERVER_JS = resolve(dirname(fileURLToPath(import.meta.url)), "../src/index.js");

const EXPECTED_TOOLS = [
  "verify_citation",
  "index_symbols",
  "build_call_graph",
  "detect_drift",
  "extract_data_model",
  "extract_project_meta",
  "extract_changelog",
  "emit_charts",
];

test("stdio smoke: lists all tools and answers verify_citation", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-server-"));
  writeFileSync(join(root, "app.py"), "x = 1\nif x:\n    print(x)\n");

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_JS, root],
  });
  const client = new Client({ name: "smoke-test", version: "0.0.0" });

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [...EXPECTED_TOOLS].sort());

    const result = await client.callTool({
      name: "verify_citation",
      arguments: { path: "app.py", line: 2, expected_snippet: "if x:" },
    });
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    assert.equal(parsed.verdict, "match");
    assert.ok(parsed.actual_source.includes("if x:"));

    const chart = await client.callTool({
      name: "emit_charts",
      arguments: { kind: "coverage", verified: 9, unverified: 3 },
    });
    const chartParsed = JSON.parse((chart.content as Array<{ text: string }>)[0].text);
    assert.equal(chartParsed.format, "svg");
    assert.ok(chartParsed.content.startsWith("<svg"));
    assert.ok(chartParsed.alt.includes("9 of 12"));

    // malformed chart input must be rejected at the schema boundary, not crash deep in chart code
    const bad = await client.callTool({ name: "emit_charts", arguments: { kind: "benchmark" } });
    assert.equal(bad.isError, true);
  } finally {
    await client.close();
    rmSync(root, { recursive: true, force: true });
  }
});
