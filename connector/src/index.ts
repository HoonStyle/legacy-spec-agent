#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "./server.js";

const rootArg = process.argv[2] && !process.argv[2].startsWith("${") ? process.argv[2] : undefined;
const root = resolve(
  rootArg ??
    process.env.LEGACY_SPEC_ROOT ??
    process.env.CLAUDE_PROJECT_DIR ??
    process.env.CODEX_PROJECT_DIR ??
    process.cwd(),
);

if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`legacy-spec-connector: root is not a directory: ${root}`);
  process.exit(1);
}

const server = createServer(root);
const transport = new StdioServerTransport();
await server.connect(transport);
// stdout is the MCP protocol channel — human-facing output goes to stderr.
console.error(`legacy-spec-connector: serving ${root} over stdio`);
