// Minimal reproduction for the Windows-only "installed plugin smoke" failure.
//
// Symptom (docs/pr-failures-root-cause.md):
//   cpSync(src, dst, { recursive: true, filter }) is supposed to exclude the
//   top-level `node_modules` and `dist` directories, but on the Windows CI
//   runner the copy still ends up containing `node_modules`, while the exact
//   same code excludes it correctly on Linux.
//
// This script reproduces that setup WITHOUT depending on the connector, and —
// crucially — logs every `source` path the filter actually receives plus the
// first path segment `relative()` computes for it. That log is the whole point:
// it is the only way to confirm or refute the doc's leading hypothesis (that on
// Windows the filter receives realpath-normalized paths through the `.bin`
// junction, so `relative(...).split(sep)[0]` is no longer "node_modules").
//
// Usage:  node scripts/repro-cpsync-win.mjs
// Exit code is always 0; read the VERDICT block at the end. Run it on the
// Windows CI leg (and on Linux for contrast) and compare the two reports.

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { tmpdir } from "node:os";

const DENY = new Set(["node_modules", "dist"]);

function log(...args) {
  console.log(...args);
}

// Build a source tree that mirrors the connector layout that failed:
//   src/index.ts, README.md            -> must be copied
//   dist/index.js                      -> must be EXCLUDED
//   node_modules/pkg/index.js          -> must be EXCLUDED
//   node_modules/.bin/tool -> junction -> the reparse point in the hypothesis
function buildSource(root) {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "index.ts"), "export const x = 1;\n");
  writeFileSync(join(root, "README.md"), "# repro\n");

  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(join(root, "dist", "index.js"), "module.exports = 1;\n");

  const pkg = join(root, "node_modules", "pkg");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, "index.js"), "module.exports = 2;\n");

  // Recreate npm's `.bin` layout: on Windows npm uses directory *junctions*
  // (a reparse point), NOT plain symlinks. Junctions do not require admin
  // rights, unlike 'dir' symlinks — so this matches what a real install has.
  const bin = join(root, "node_modules", ".bin");
  mkdirSync(bin, { recursive: true });
  const linkType = process.platform === "win32" ? "junction" : "dir";
  try {
    symlinkSync(pkg, join(bin, "tool"), linkType);
    log(`[setup] created .bin/tool -> pkg (${linkType})`);
  } catch (err) {
    log(`[setup] WARNING: could not create ${linkType} link: ${err.message}`);
    log("[setup] continuing without the junction (hypothesis untestable)");
  }
}

// Variant A — the approach that failed: one recursive cpSync + denylist filter.
function copyWithRecursiveFilter(source, dest) {
  const seen = [];
  cpSync(source, dest, {
    recursive: true,
    filter(src) {
      const rel = relative(source, src);
      const first = rel.split(/[\\/]/)[0];
      const keep = !DENY.has(first);
      // Record only the paths that touch the excluded trees, to keep it short.
      if (first === "node_modules" || first === "dist" || rel === "") {
        seen.push({ src, rel, first, keep });
      }
      return keep;
    },
  });
  return seen;
}

// Variant B — the fix that landed on #39: never hand the excluded dirs to
// cpSync at all; copy the allowlisted top-level entries individually.
function copyWithAllowlist(source, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(source)) {
    if (DENY.has(entry)) continue;
    cpSync(join(source, entry), join(dest, entry), { recursive: true });
  }
}

function leaks(dest) {
  return [...DENY].filter((d) => existsSync(join(dest, d)));
}

function run() {
  const work = mkdtempSync(join(tmpdir(), "cpsync-repro-"));
  const source = join(work, "connector");
  const destA = join(work, "installedA");
  const destB = join(work, "installedB");

  log(`platform=${process.platform}  node=${process.version}  sep=${JSON.stringify(sep)}`);
  log(`workdir=${work}\n`);

  buildSource(source);

  log("\n=== Variant A: cpSync(recursive:true, filter) — the FAILING approach ===");
  const seen = copyWithRecursiveFilter(source, destA);
  log("filter() calls touching the excluded trees (src | relative | firstSeg | keep):");
  for (const s of seen) {
    log(`  ${s.src}\n      rel=${JSON.stringify(s.rel)} first=${JSON.stringify(s.first)} keep=${s.keep}`);
  }
  const leakA = leaks(destA);
  log(`\nVariant A copy top-level: ${JSON.stringify(readdirSync(destA))}`);
  log(`Variant A leaked (should be []): ${JSON.stringify(leakA)}`);

  log("\n=== Variant B: allowlist per-entry copy — the FIX from #39 ===");
  copyWithAllowlist(source, destB);
  const leakB = leaks(destB);
  log(`Variant B copy top-level: ${JSON.stringify(readdirSync(destB))}`);
  log(`Variant B leaked (should be []): ${JSON.stringify(leakB)}`);

  log("\n==================== VERDICT ====================");
  if (leakA.length > 0) {
    log(`BUG REPRODUCED: recursive+filter leaked ${JSON.stringify(leakA)} on ${process.platform}.`);
    log("Inspect the filter() log above: if `first` for a node_modules path is");
    log("NOT \"node_modules\", the doc's realpath/junction hypothesis is confirmed.");
  } else {
    log(`No leak from Variant A on ${process.platform}: recursive+filter behaved correctly here.`);
    log("If this is Linux, that matches the report. Run on the Windows CI leg to reproduce.");
  }
  log(`Variant B leaked: ${JSON.stringify(leakB)} (expected []).`);
  log("================================================");

  rmSync(work, { recursive: true, force: true });
}

run();
