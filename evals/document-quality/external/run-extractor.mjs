/**
 * Reproducible extractor runner for external evaluation cases.
 *
 * Reads the frozen case-manifest.json for its scope, runs the deterministic
 * coverage-surface detector over the pinned clone, and preserves the raw array,
 * a JSONL serialization for the evaluator, and run diagnostics.
 *
 * Usage: node run-extractor.mjs <case-id> <clone-directory-name>
 *   e.g. node run-extractor.mjs external-py-flask-tutorial flask
 */
import { readFileSync, writeFileSync } from "node:fs";
import { extractCoverageSurface, includedSourceFiles } from "../../../connector/dist/src/coverage-surface.js";

const [caseId, cloneName] = process.argv.slice(2);
if (!caseId || !cloneName) {
  console.error("usage: node run-extractor.mjs <case-id> <clone-directory-name>");
  process.exit(2);
}

const REPO = new URL("../../../", import.meta.url).pathname.replace(/\/$/, "");
const SOURCE_ROOT = `${REPO}/.external-sources/${cloneName}`;
const CASE_DIR = `${REPO}/evals/document-quality/external/${caseId}`;

const manifest = JSON.parse(readFileSync(`${CASE_DIR}/case-manifest.json`, "utf8"));
const included = manifest.included_paths;
const excluded = manifest.excluded_paths;

const startedAt = new Date().toISOString();
const t0 = process.hrtime.bigint();
const supported = includedSourceFiles(SOURCE_ROOT, included, excluded);
const surfaces = extractCoverageSurface(SOURCE_ROOT, included, excluded);
const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;

const rawJson = JSON.stringify(surfaces, null, 2) + "\n";
writeFileSync(`${CASE_DIR}/raw-extractor-output.json`, rawJson);
writeFileSync(`${CASE_DIR}/actual-surfaces.jsonl`, surfaces.map((s) => JSON.stringify(s)).join("\n") + "\n");

writeFileSync(`${CASE_DIR}/extractor-run.json`, JSON.stringify({
  case: caseId,
  analyzed_source_commit: manifest.analyzed_source_commit,
  command: `node evals/document-quality/external/run-extractor.mjs ${caseId} ${cloneName}`,
  connector_revision: manifest.execution_environment.connector_revision,
  node_version: process.version,
  started_at: startedAt,
  elapsed_ms: Math.round(elapsedMs * 1000) / 1000,
  rss_after_bytes: process.memoryUsage().rss,
  rss_measurement: "process.memoryUsage().rss immediately after extraction (end-of-run, not peak)",
  included_paths: included,
  excluded_paths: excluded,
  supported_file_count: supported.length,
  supported_files: supported.map((f) => f.replace(`${SOURCE_ROOT}/`, "")),
  surface_count: surfaces.length,
  raw_output_bytes: Buffer.byteLength(rawJson),
  provider_counters: "not_exposed",
}, null, 2) + "\n");

const byCategory = {};
for (const s of surfaces) byCategory[s.category] = (byCategory[s.category] ?? 0) + 1;
console.log(`${caseId}: ${supported.length} supported files, ${surfaces.length} surfaces`);
console.log("  by category:", JSON.stringify(byCategory));
for (const s of surfaces) console.log(`  ${s.category} | ${s.surface} | ${s.found_at}`);
