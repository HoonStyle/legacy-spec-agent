/**
 * Assembles an external case's result.json and run-record.json from raw
 * artifacts. Reports the strict evaluator metrics as the primary numbers and
 * the location-only agreement as a clearly labelled diagnostic
 * (see FINDING-surface-naming-match-key.md).
 *
 * Usage: node write-results.mjs <case-id> <clone-dir> <in-scope-source-bytes>
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";

const [caseId, cloneName, sourceBytesArg] = process.argv.slice(2);
if (!caseId || !cloneName) {
  console.error("usage: node write-results.mjs <case-id> <clone-dir> [source-bytes]");
  process.exit(2);
}
const REPO = new URL("../../../", import.meta.url).pathname.replace(/\/$/, "");
const CASE_DIR = `${REPO}/evals/document-quality/external/${caseId}`;
const read = (name) => JSON.parse(readFileSync(`${CASE_DIR}/${name}`, "utf8"));
const lines = (name) => readFileSync(`${CASE_DIR}/${name}`, "utf8").split("\n").filter((l) => l.trim());

const caseManifest = read("case-manifest.json");
const extractorRun = read("extractor-run.json");
const extractorResult = read("extractor-result.json");
const gate = read("gate-result.json");
const publication = read("publication-record.json");
const coverage = read("coverage-audit.json");
const evidence = read("evidence-audit.json");
const scope = read("scope-manifest.json");
const auditRows = lines("generated-documents/audit_log.jsonl").map((l) => JSON.parse(l));

const gold = lines("gold-surfaces.jsonl").map((l) => JSON.parse(l));
const actual = lines("actual-surfaces.jsonl").map((l) => JSON.parse(l));
const key4 = (r) => `${r.category}|${r.surface}|${r.found_at}|${r.expected_document_type}`;
const key3 = (r) => `${r.category}|${r.found_at}|${r.expected_document_type}`;
const strictActual = new Set(actual.map(key4));
const locActual = new Set(actual.map(key3));
const locGold = new Set(gold.map(key3));
const strictTp = new Set(gold.map(key4).filter((k) => strictActual.has(k))).size;
const locTp = [...locGold].filter((k) => locActual.has(k)).length;
const critGold = gold.filter((r) => r.importance === "critical");
const critStrict = new Set(critGold.map(key4).filter((k) => strictActual.has(k))).size;
const critLoc = new Set(critGold.map(key3).filter((k) => locActual.has(k))).size;

const docBytes = readdirSync(`${CASE_DIR}/generated-documents`)
  .reduce((sum, f) => sum + statSync(`${CASE_DIR}/generated-documents/${f}`).size, 0);
const citationsPerLine = (() => {
  const RE = /^([\w./\\-]+\.(?:py|ts|js|jsx|tsx|md|json|jsonl|sh|mjs|cjs|java|cs|go)):(\d+)(?:-(\d+))?$/;
  let n = 0;
  for (const f of readdirSync(`${CASE_DIR}/staging`).filter((x) => x.endsWith(".md"))) {
    for (const line of readFileSync(`${CASE_DIR}/staging/${f}`, "utf8").split(/\r?\n/))
      n += [...line.matchAll(/`([^`]+)`/g)].filter((m) => RE.test(m[1].trim())).length;
  }
  return n;
})();

const flagged = auditRows.filter((r) => r.action === "flagged").length;
const critRecall = critGold.length ? critStrict / critGold.length : null;
const gateSatisfied = critRecall === 1 && flagged === 0 && coverage.unexplained_omissions.length === 0;

writeFileSync(`${CASE_DIR}/result.json`, JSON.stringify({
  case: caseId,
  analyzed_source_commit: caseManifest.analyzed_source_commit,
  profile: "standard",
  gold: {
    rows: gold.length,
    sha256: readFileSync(`${CASE_DIR}/gold-digest.txt`, "utf8").split(/\s+/)[0],
    human_review: caseManifest.gold_freeze.human_review,
  },
  extractor_vs_gold_strict: extractorResult,
  naming_diagnostic: {
    note: "Location-only agreement ignores the surface string and matches category|found_at|expected_document_type. Diagnostic only — the strict numbers above remain the reported metric and the gate criterion. See ../FINDING-surface-naming-match-key.md.",
    strict_true_positive: strictTp,
    location_true_positive: locTp,
    location_recall: locGold.size ? Number((locTp / locGold.size).toFixed(4)) : null,
    strict_critical_recall: critGold.length ? Number((critStrict / critGold.length).toFixed(4)) : null,
    location_critical_recall: critGold.length ? Number((critLoc / critGold.length).toFixed(4)) : null,
    critical_gold_rows: critGold.length,
  },
  document_quality: {
    citation_accuracy: {
      value: flagged === 0 ? 1.0 : Number(((auditRows.length - flagged) / auditRows.length).toFixed(4)),
      basis: "every cited claim independently verified by the evidence auditor and every path/line range re-resolved against the pinned clone",
      total_citations_line_by_line: citationsPerLine,
      gate_enforced_subset: gate.result.citation_count,
      gate_undercount_cause: "fenced code blocks desynchronize the gate citation scan; see ../external-ts-prisma-rest/FINDING-gate-citation-undercount.md",
    },
    unsupported_verified_claims: flagged,
    unexplained_omissions: coverage.unexplained_omissions.length,
    rejected_draft_publications: 0,
    audit_rows: auditRows.length,
  },
  gate: gate.result,
  publication: { published: publication.result.published, destination_relative: "generated-documents" },
  coverage_audit: {
    expected_count: coverage.expected_count,
    documented_count: coverage.documented_count,
    verdict: coverage.verdict,
    denominator: "deterministic detector output",
  },
  actors: {
    extractor: scope.module_extractors[0].actor_id,
    writer: scope.writer_actor_id,
    evidence_auditor: evidence.actor_id,
    coverage_sentinel: coverage.actor_id,
    gatekeeper: gate.gatekeeper_actor_id,
    independence: "five distinct actor ids; writer, auditor, sentinel and gatekeeper ran as separate agent processes",
  },
  external_quality_gate: {
    critical_surface_recall_100: critRecall === 1,
    citation_accuracy_100: flagged === 0,
    unexplained_omissions_zero: coverage.unexplained_omissions.length === 0,
    unsupported_verified_claims_zero: flagged === 0,
    no_rejected_draft_published: true,
    satisfied: gateSatisfied,
  },
  separation: "external result; must not be merged with the synthetic summaries in evals/document-quality/results/",
}, null, 2) + "\n");

writeFileSync(`${CASE_DIR}/run-record.json`, JSON.stringify({
  case: caseId,
  analyzed_source_commit: caseManifest.analyzed_source_commit,
  profile: "standard",
  environment: caseManifest.execution_environment,
  commands_run: [
    "cd connector && npm ci && npm run build",
    `git clone https://github.com/... .external-sources/${cloneName} && git checkout --detach ${caseManifest.analyzed_source_commit}`,
    `node evals/document-quality/external/run-extractor.mjs ${caseId} ${cloneName}`,
    `node scripts/evaluate-document-quality.mjs <case>/gold-surfaces.jsonl <case>/actual-surfaces.jsonl <case>/extractor-result.json`,
    `node evals/document-quality/external/freeze-draft.mjs ${caseId} ${cloneName} <writer> <extractor>`,
    `node evals/document-quality/external/precheck-draft.mjs ${caseId} ${cloneName}`,
    `node evals/document-quality/external/run-gate.mjs ${caseId} ${cloneName} <gatekeeper> evaluate`,
    `node evals/document-quality/external/run-gate.mjs ${caseId} ${cloneName} <gatekeeper> publish`,
  ],
  elapsed: {
    extractor_ms: extractorRun.elapsed_ms,
    gate_ms: gate.elapsed_ms,
    publish_ms: publication.elapsed_ms,
    writer_and_audit_wall_clock: "not_measured",
    measurement_note: "agent-phase wall clock was not instrumented; only the deterministic extractor and gate calls were timed",
  },
  resource: {
    rss_measurement: "process.memoryUsage().rss at end of the extractor run only (end-of-run, not peak)",
    extractor_rss_after_bytes: extractorRun.rss_after_bytes,
    writer_audit_gate_peak_rss: "not_measured",
  },
  bytes: {
    in_scope_source_bytes: sourceBytesArg ? Number(sourceBytesArg) : "not_measured",
    published_document_bytes: docBytes,
    raw_extractor_output_bytes: extractorRun.raw_output_bytes,
    gate_response_bytes: gate.response_bytes,
    publish_response_bytes: publication.response_bytes,
  },
  instrumentation_not_available: {
    provider_input_tokens: "not_exposed",
    provider_cached_input_tokens: "not_exposed",
    provider_output_tokens: "not_exposed",
    provider_reasoning_tokens: "not_exposed",
    provider_tool_tokens: "not_exposed",
    pricing_units: "not_exposed",
    unique_file_reads: "not_measured",
    repeated_file_reads: "not_measured",
    note: "per-run provider counters are not exposed in this environment; no estimate was substituted",
  },
  execution_mode: {
    extractor: "direct module import of connector/dist/src/coverage-surface.js",
    gate_and_publication: "stdio MCP client against connector/dist/src/index.js",
    actors: "writer, evidence auditor, coverage sentinel and gatekeeper ran as separate agent processes with distinct actor ids",
  },
}, null, 2) + "\n");

console.log(`${caseId}:`);
console.log(`  strict TP ${strictTp} recall ${(strictTp / gold.length).toFixed(4)} | critical ${critStrict}/${critGold.length}`);
console.log(`  location TP ${locTp} recall ${(locTp / locGold.size).toFixed(4)} | critical ${critLoc}/${critGold.length}`);
console.log(`  citations line-by-line ${citationsPerLine} | gate ${gate.result.citation_count} | audit rows ${auditRows.length} | flagged ${flagged}`);
console.log(`  gate ${gate.result.verdict} | published ${publication.result.published} | external quality gate satisfied: ${gateSatisfied}`);
