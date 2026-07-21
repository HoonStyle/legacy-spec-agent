#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["--test", "dist/test/installed-plugin.test.js"],
  { encoding: "utf8", env: { ...process.env, PLUGIN_INSTALL_SMOKE: "1" } },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  const diagnostic = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    .trim()
    .slice(-20_000)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
  console.error(`::error title=Installed plugin smoke failed::${diagnostic || `test process exited with ${result.status ?? "no status"}`}`);
}

process.exit(result.status ?? 1);
