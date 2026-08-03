import { writeFileSync } from "node:fs";
import { extractCoverageSurface, includedSourceFiles } from "/home/user/legacy-spec-agent/connector/dist/src/coverage-surface.js";

const SOURCE_ROOT = "/home/user/legacy-spec-agent/.external-sources/prisma-examples";
const CASE_DIR = "/home/user/legacy-spec-agent/evals/document-quality/external/external-ts-prisma-rest";
const BASE = "deployment-platforms/rest-express-docker-aws-ec2";
const INCLUDED = [
  `${BASE}/src`,
  `${BASE}/prisma`,
  `${BASE}/package.json`,
  `${BASE}/tsconfig.json`,
  `${BASE}/.env.example`,
  `${BASE}/Dockerfile`,
  `${BASE}/docker-compose.yml`,
  `${BASE}/README.md`,
];
const EXCLUDED = [
  { path: `${BASE}/.github`, reason: "CI deployment workflow out of documentation scope per EXTERNAL_EVALUATION_PLAN.md" },
  { path: `${BASE}/node_modules`, reason: "third-party dependencies are not documentation surface" },
  { path: `${BASE}/dist`, reason: "build output is not documentation surface" },
  { path: ".git", reason: "version-control metadata" },
];

const startedAt = new Date().toISOString();
const t0 = process.hrtime.bigint();
const supported = includedSourceFiles(SOURCE_ROOT, INCLUDED, EXCLUDED);
const surfaces = extractCoverageSurface(SOURCE_ROOT, INCLUDED, EXCLUDED);
const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;

const rawJson = JSON.stringify(surfaces, null, 2) + "\n";
writeFileSync(`${CASE_DIR}/raw-extractor-output.json`, rawJson);
const actualJsonl = surfaces.map((s) => JSON.stringify(s)).join("\n") + "\n";
writeFileSync(`${CASE_DIR}/actual-surfaces.jsonl`, actualJsonl);

writeFileSync(`${CASE_DIR}/extractor-run.json`, JSON.stringify({
  case: "external-ts-prisma-rest",
  analyzed_source_commit: "eb8f4328821c6746680a2ba02e0e5636a085a327",
  command: "node run-extractor.mjs (extractCoverageSurface via connector/dist/src/coverage-surface.js)",
  connector_revision: "9e832dd1165fbbceed7b2214f13f55085aabc71f",
  node_version: process.version,
  started_at: startedAt,
  elapsed_ms: Math.round(elapsedMs * 1000) / 1000,
  rss_after_bytes: process.memoryUsage().rss,
  rss_measurement: "process.memoryUsage().rss immediately after extraction (end-of-run, not peak)",
  included_paths: INCLUDED,
  excluded_paths: EXCLUDED,
  supported_file_count: supported.length,
  supported_files: supported.map((f) => f.replace(`${SOURCE_ROOT}/`, "")),
  surface_count: surfaces.length,
  raw_output_bytes: Buffer.byteLength(rawJson),
  provider_counters: "not_exposed",
}, null, 2) + "\n");

console.log(`supported files: ${supported.length}`);
console.log(`surfaces: ${surfaces.length}`);
for (const s of surfaces) console.log(`${s.category} | ${s.surface} | ${s.found_at}`);
