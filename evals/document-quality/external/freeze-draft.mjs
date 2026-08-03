/**
 * Freezes an external case's staging draft: computes the standard-profile draft
 * digest and writes the strict gate-input scope manifest from the frozen
 * case-manifest scope.
 *
 * Usage: node freeze-draft.mjs <case-id> <clone-directory-name> <writer-actor-id> <extractor-actor-id>
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { calculateDraftDigest } from "../../../connector/dist/src/document-gate.js";
import { includedSourceFiles } from "../../../connector/dist/src/coverage-surface.js";

const [caseId, cloneName, writerActor, extractorActor] = process.argv.slice(2);
if (!caseId || !cloneName || !writerActor || !extractorActor) {
  console.error("usage: node freeze-draft.mjs <case-id> <clone-dir> <writer-actor-id> <extractor-actor-id>");
  process.exit(2);
}

const REPO = new URL("../../../", import.meta.url).pathname.replace(/\/$/, "");
const SOURCE_ROOT = `${REPO}/.external-sources/${cloneName}`;
const CASE_DIR = `${REPO}/evals/document-quality/external/${caseId}`;
const STAGING = `${CASE_DIR}/staging`;

const caseManifest = JSON.parse(readFileSync(`${CASE_DIR}/case-manifest.json`, "utf8"));
const included = caseManifest.included_paths;
const excluded = caseManifest.excluded_paths;

const digest = calculateDraftDigest(STAGING, "standard");
writeFileSync(`${CASE_DIR}/draft-digest.txt`, `${digest}  standard-profile-markdown\n`);

const supported = includedSourceFiles(SOURCE_ROOT, included, excluded);

/** Files inside the frozen scope that the detector does not treat as source. */
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".java", ".cs", ".go"]);
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(`${dir}/${e.name}`) : e.isFile() ? [`${dir}/${e.name}`] : []);
const excludedDirs = excluded.map((e) => `${SOURCE_ROOT}/${e.path}`);
let unsupported = 0;
for (const entry of included) {
  const target = `${SOURCE_ROOT}/${entry}`;
  const files = statSync(target).isDirectory() ? walk(target) : [target];
  for (const f of files) {
    if (excludedDirs.some((d) => f === d || f.startsWith(`${d}/`))) continue;
    const ext = f.slice(f.lastIndexOf("."));
    if (!SOURCE_EXT.has(ext)) unsupported++;
  }
}

const manifest = {
  analyzed_source_commit: caseManifest.analyzed_source_commit,
  included_paths: included,
  excluded_paths: excluded,
  file_counts: { supported: supported.length, unsupported, failed: 0, skipped: 0 },
  truncated: false,
  truncated_inputs: [],
  module_extractors: included.map((module) => ({ module, actor_id: extractorActor })),
  writer_actor_id: writerActor,
  draft_digest: digest,
};
writeFileSync(`${CASE_DIR}/scope-manifest.json`, JSON.stringify(manifest, null, 2) + "\n");

let bytes = 0;
for (const f of readdirSync(STAGING)) bytes += statSync(`${STAGING}/${f}`).size;
console.log(`${caseId} draft_digest: ${digest}`);
console.log(`  supported ${supported.length} | unsupported ${unsupported} | staging files ${readdirSync(STAGING).length} | staging bytes ${bytes}`);
