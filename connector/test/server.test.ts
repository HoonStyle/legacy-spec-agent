import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { createHash } from "node:crypto";

const SERVER_JS = resolve(dirname(fileURLToPath(import.meta.url)), "../src/index.js");

const EXPECTED_TOOLS = [
  "assess_language_toolchains",
  "approve_toolchain_download",
  "download_language_toolchain",
  "get_toolchain_download_status",
  "cancel_toolchain_download",
  "verify_citation",
  "index_symbols",
  "build_call_graph",
  "detect_drift",
  "extract_data_model",
  "extract_project_meta",
  "extract_changelog",
  "emit_charts",
  "render_report",
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

    const untrustedApproval = await client.callTool({
      name: "approve_toolchain_download",
      arguments: { language: "csharp", version: "8", url: "https://evil.test/sdk.tgz", sha256: "0".repeat(64), user_approved: true },
    });
    assert.equal(untrustedApproval.isError, true);

    const invalidToken = await client.callTool({ name: "download_language_toolchain", arguments: { consent_token: "x".repeat(32) } });
    assert.equal(invalidToken.isError, true);
  } finally {
    await client.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("in-memory MCP: approval, download, polling, and shared manager succeed", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-server-download-"));
  const cache = mkdtempSync(join(tmpdir(), "lsc-server-cache-"));
  const artifact = Buffer.from("mcp artifact");
  writeFileSync(join(root, "App.cs"), "class App {}\n");
  const sha256 = createHash("sha256").update(artifact).digest("hex");
  const server = createServer(root, { cacheRoot: cache, fetchImpl: async () => new Response(artifact, { headers: { "content-length": String(artifact.length) } }) });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "download-test", version: "0.0.0" });
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const assessment = await client.callTool({ name: "assess_language_toolchains", arguments: { interactive: true } });
    const assessmentJson = JSON.parse((assessment.content as Array<{ text: string }>)[0].text);
    assert.equal(assessmentJson.toolchains[0].cache_dir, cache);
    assert.equal(assessmentJson.consent_required.length, 0);
    const symbols = await client.callTool({ name: "index_symbols", arguments: {} });
    const symbolsJson = JSON.parse((symbols.content as Array<{ text: string }>)[0].text);
    assert.equal(symbolsJson.modules[0].symbols[0].name, "App");
    const approval = await client.callTool({ name: "approve_toolchain_download", arguments: { language: "csharp", version: "8", url: "https://builds.dotnet.microsoft.com/sdk.tgz", sha256, user_approved: true } });
    const approvalJson = JSON.parse((approval.content as Array<{ text: string }>)[0].text);
    assert.equal(approvalJson.approval_source, "caller_attestation");
    const started = await client.callTool({ name: "download_language_toolchain", arguments: { consent_token: approvalJson.consent_token } });
    const id = JSON.parse((started.content as Array<{ text: string }>)[0].text).id;
    let status: { state: string; percent?: number } = { state: "queued" };
    for (let i = 0; i < 50 && !["complete", "failed"].includes(status.state); i++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const result = await client.callTool({ name: "get_toolchain_download_status", arguments: { id } });
      status = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    }
    assert.equal(status.state, "complete"); assert.equal(status.percent, 100);
  } finally {
    await client.close(); await server.close();
    rmSync(root, { recursive: true, force: true }); rmSync(cache, { recursive: true, force: true });
  }
});
