import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const connector = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const enabled = process.env.PLUGIN_INSTALL_SMOKE === "1";

function directoryDigest(root: string): string {
  const hash = createHash("sha256");
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop()!;
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      const rel = relative(root, path).split(/[\\/]/).join("/");
      hash.update(`${entry.isDirectory() ? "d" : "f"}:${rel}\0`);
      if (entry.isDirectory()) stack.push(path); else if (entry.isFile()) hash.update(readFileSync(path));
    }
  }
  return hash.digest("hex");
}

test("clean installed plugin bootstraps and parses all bundled languages", { skip: !enabled, timeout: 120_000 }, async () => {
  const workspace = mkdtempSync(join(tmpdir(), "legacy spec 설치 smoke "));
  const pluginRoot = join(workspace, "plugin Ω space");
  const installedConnector = join(pluginRoot, "connector");
  const target = join(workspace, "target repo 한글");
  cpSync(connector, installedConnector, {
    recursive: true,
    filter(source) {
      const first = relative(connector, source).split(/[\\/]/)[0];
      return first !== "node_modules" && first !== "dist";
    },
  });
  cpSync(resolve(connector, "..", ".codex-plugin"), join(pluginRoot, ".codex-plugin"), { recursive: true });
  cpSync(resolve(connector, "..", ".claude-plugin"), join(pluginRoot, ".claude-plugin"), { recursive: true });
  cpSync(resolve(connector, "..", "skills"), join(pluginRoot, "skills"), { recursive: true });
  cpSync(resolve(connector, "..", ".mcp.json"), join(pluginRoot, ".mcp.json"));
  const abandonedLock = join(installedConnector, ".bootstrap.lock");
  mkdirSync(abandonedLock);
  const staleTime = new Date(Date.now() - 11 * 60_000);
  utimesSync(abandonedLock, staleTime, staleTime);
  mkdirSync(target);
  writeFileSync(join(target, "app.py"), "class PythonApp:\n    pass\n");
  writeFileSync(join(target, "app.ts"), "export class TypeScriptApp {}\n");
  writeFileSync(join(target, "App.java"), "class JavaApp {}\n");
  writeFileSync(join(target, "App.cs"), "class CSharpApp {}\n");
  writeFileSync(join(target, "app.go"), "package app\ntype GoApp struct {}\n");
  const targetBefore = directoryDigest(target);
  const plugin = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  const launch = plugin.mcpServers["legacy-spec"];
  const claudeConfig = JSON.parse(readFileSync(join(pluginRoot, ".mcp.json"), "utf8"));
  const claudeLaunch = claudeConfig.mcpServers["legacy-spec"];
  const claudeArgs = claudeLaunch.args.map((argument: string) => argument
    .replaceAll("${CLAUDE_PLUGIN_ROOT}", pluginRoot)
    .replaceAll("${CLAUDE_PROJECT_DIR}", target));
  const makeTransport = () => new StdioClientTransport({ command: launch.command, args: launch.args, cwd: pluginRoot, env: { ...process.env, CODEX_PROJECT_DIR: target } as Record<string, string>, stderr: "pipe" });
  const transport = makeTransport();
  const secondTransport = makeTransport();
  const claudeTransport = new StdioClientTransport({ command: claudeLaunch.command, args: claudeArgs, cwd: pluginRoot, stderr: "pipe" });
  const client = new Client({ name: "installed-plugin-smoke", version: "0.0.0" });
  const secondClient = new Client({ name: "installed-plugin-smoke-concurrent", version: "0.0.0" });
  const claudeClient = new Client({ name: "installed-plugin-smoke-claude", version: "0.0.0" });
  try {
    assert.equal(existsSync(join(installedConnector, "node_modules")), false);
    assert.equal(existsSync(join(installedConnector, "dist")), false);
    await Promise.all([client.connect(transport), secondClient.connect(secondTransport), claudeClient.connect(claudeTransport)]);
    const [response, secondResponse, claudeResponse] = await Promise.all([
      client.callTool({ name: "index_symbols", arguments: {} }),
      secondClient.callTool({ name: "index_symbols", arguments: { granularity: "package" } }),
      claudeClient.callTool({ name: "index_symbols", arguments: { subdir: "." } }),
    ]);
    assert.notEqual(response.isError, true);
    assert.notEqual(secondResponse.isError, true);
    assert.notEqual(claudeResponse.isError, true);
    const result = JSON.parse((response.content as Array<{ type: string; text: string }>)[0].text);
    const names = result.modules.flatMap((module: { symbols: Array<{ name: string }> }) => module.symbols.map((symbol) => symbol.name));
    for (const expected of ["PythonApp", "TypeScriptApp", "JavaApp", "CSharpApp", "GoApp"]) assert.ok(names.includes(expected), expected);
    assert.equal(result.files, 5);
    assert.ok(existsSync(join(installedConnector, "dist", "src", "index.js")));
    assert.ok(existsSync(join(installedConnector, "node_modules", "tree-sitter-wasms", "out", "tree-sitter-c_sharp.wasm")));
    assert.equal(existsSync(abandonedLock), false);
    assert.equal(directoryDigest(target), targetBefore);
  } finally {
    await Promise.all([client.close(), secondClient.close(), claudeClient.close()]);
    rmSync(workspace, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
