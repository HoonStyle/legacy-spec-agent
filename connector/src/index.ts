#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./server.js";
import { isSelfServing, resolveRoot } from "./root.js";

const { root, source } = resolveRoot(process.argv[2], process.env, process.cwd());

if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`legacy-spec-connector: root is not a directory: ${root}`);
  process.exit(1);
}

// dist/src/index.js → connector/. Guard against the silent cwd-fallback trap.
const connectorDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
if (source === "cwd" && isSelfServing(root, connectorDir)) {
  console.error(
    `legacy-spec-connector: WARNING — no project root was provided, so the cwd fallback ` +
      `resolved to the plugin's own checkout (${root}). Tools will analyze the plugin ` +
      `itself, not your project. Set LEGACY_SPEC_ROOT to the target repository ` +
      `(or pass its path as the first CLI argument).`,
  );
}

const server = createServer(root);
const transport = new StdioServerTransport();
await server.connect(transport);
// stdout is the MCP protocol channel — human-facing output goes to stderr.
console.error(`legacy-spec-connector: serving ${root} over stdio`);
