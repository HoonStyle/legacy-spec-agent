#!/usr/bin/env node
// Cross-platform test entry point.
//
// The npm `test` script used `node --test dist/test/*.test.js`, which relies on
// the shell expanding the glob. Windows shells (cmd/PowerShell) do not expand
// it, and Node 20's test runner has no built-in glob support, so the literal
// pattern reached Node and it failed with "Could not find '…/*.test.js'".
//
// Enumerate the compiled test files explicitly instead — no shell or Node glob
// involved — and hand them to the test runner. cwd stays at connector/ so tests
// resolve their relative paths exactly as before.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const testDir = join("dist", "test");
const files = readdirSync(testDir)
  .filter((f) => f.endsWith(".test.js"))
  .map((f) => join(testDir, f));

if (files.length === 0) {
  console.error(`no compiled test files found in ${testDir} — did the build run?`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
