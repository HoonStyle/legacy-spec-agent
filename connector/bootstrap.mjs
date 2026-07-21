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
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "dist/src/index.js");
const installLock = join(here, "node_modules/.package-lock.json");
const packageLock = join(here, "package-lock.json");
const setupLock = join(here, ".bootstrap.lock");
const waitBuffer = new Int32Array(new SharedArrayBuffer(4));

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

function setupState() {
  const missing = !existsSync(join(here, "node_modules")) || !existsSync(entry);
  const dependenciesStale =
    !existsSync(installLock) ||
    (existsSync(packageLock) && statSync(packageLock).mtimeMs > statSync(installLock).mtimeMs);
  const stale = !missing && newestSourceMtime() > statSync(entry).mtimeMs;
  return { missing, dependenciesStale, stale, needed: missing || dependenciesStale || stale };
}

function acquireSetupLock() {
  const deadline = Date.now() + 180_000;
  while (true) {
    try {
      mkdirSync(setupLock);
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(setupLock).mtimeMs > 600_000) {
          rmSync(setupLock, { recursive: true, force: true });
          continue;
        }
      } catch (statError) {
        if (statError?.code !== "ENOENT") throw statError;
        continue;
      }
      if (Date.now() >= deadline) throw new Error("timed out waiting for another connector bootstrap");
      Atomics.wait(waitBuffer, 0, 0, 250);
    }
  }
}

if (setupState().needed) {
  acquireSetupLock();
  let setupFailed = false;
  try {
    const state = setupState();
    if (state.needed) {
      console.error(
        `legacy-spec-connector: ${state.missing || state.dependenciesStale ? "installing dependencies and building (needs network)" : "sources changed — rebuilding"}…`,
      );
      if (state.missing || state.dependenciesStale) {
        execSync("npm ci --loglevel=error", { cwd: here, stdio: ["ignore", 2, 2] });
      }
      execSync("npm run build", { cwd: here, stdio: ["ignore", 2, 2] });
      console.error("legacy-spec-connector: build complete");
    }
  } catch (e) {
    console.error(
      `legacy-spec-connector: setup FAILED (${e.message.split("\n")[0]}).\n` +
        `The skill will run LLM-only until this is fixed. To repair manually:\n` +
        `  cd "${here}" && npm ci && npm run build`,
    );
    setupFailed = true;
  } finally {
    rmSync(setupLock, { recursive: true, force: true });
  }
  if (setupFailed) process.exit(1);
}

await import(pathToFileURL(entry).href); // reads the root dir from process.argv[2], shared with this process
