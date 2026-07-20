#!/usr/bin/env node
/**
 * Plugin launcher. A git-installed plugin ships no node_modules/ or dist/
 * so the first run installs and builds in place, then hands over to the real
 * stdio server. All runtime dependencies are JavaScript-only; no native C++
 * toolchain is required. A plugin UPDATE ships
 * new sources next to a stale dist/, so the build is also refreshed whenever
 * any source/manifest file is newer than the built entrypoint. stdout stays
 * clean for the MCP protocol — installer output is redirected to stderr.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "dist/src/index.js");
const installLock = join(here, "node_modules/.package-lock.json");
const packageLock = join(here, "package-lock.json");

function newestSourceMtime() {
  let newest = 0;
  const stack = [join(here, "src")];
  for (const manifest of ["package.json", "package-lock.json", "tsconfig.json"]) {
    const p = join(here, manifest);
    if (existsSync(p)) newest = Math.max(newest, statSync(p).mtimeMs);
  }
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) newest = Math.max(newest, statSync(p).mtimeMs);
    }
  }
  return newest;
}

const missing = !existsSync(join(here, "node_modules")) || !existsSync(entry);
const dependenciesStale =
  !existsSync(installLock) ||
  (existsSync(packageLock) && statSync(packageLock).mtimeMs > statSync(installLock).mtimeMs);
const stale = !missing && newestSourceMtime() > statSync(entry).mtimeMs;

if (missing || dependenciesStale || stale) {
  console.error(
    `legacy-spec-connector: ${missing || dependenciesStale ? "installing dependencies and building (needs network)" : "sources changed — rebuilding"}…`,
  );
  try {
    if (missing || dependenciesStale) {
      execSync("npm ci --loglevel=error", { cwd: here, stdio: ["ignore", 2, 2] });
    }
    execSync("npm run build", { cwd: here, stdio: ["ignore", 2, 2] });
    console.error("legacy-spec-connector: build complete");
  } catch (e) {
    console.error(
      `legacy-spec-connector: setup FAILED (${e.message.split("\n")[0]}).\n` +
        `The skill will run LLM-only until this is fixed. To repair manually:\n` +
        `  cd "${here}" && npm ci && npm run build`,
    );
    process.exit(1);
  }
}

await import(entry); // reads the root dir from process.argv[2], shared with this process
