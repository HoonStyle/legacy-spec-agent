#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { calculateDraftDigest, evaluateDocumentGate } from "../connector/dist/src/document-gate.js";
import { extractCoverageSurface, includedSourceFiles } from "../connector/dist/src/coverage-surface.js";

const casesRoot = resolve(process.argv[2] ?? "evals/document-quality/cases");
const caseNames = ["typescript-service", "python-worker", "multilang-service"];
const sections = ["System purpose and boundary", "Actors and entrypoints", "Core use cases", "Business rules", "Validation and error behavior", "State transitions", "Configuration", "Persistence and side effects", "Operational behavior", "Known limitations", "Unverified / Needs-review"];
const architectureSections = ["System context", "Component inventory", "Runtime and deployment", "Module dependency", "External systems and data stores", "Major execution flows", "Trust boundaries", "Analysis limitations"];
const standardDocuments = { "INTERFACES.md": ["Interfaces"], "DATA_MODEL.md": ["Data model"], "ONBOARDING.md": ["Onboarding"], "TESTCASES.md": ["Existing automated tests", "Source-derived characterization scenarios", "External-contract test candidates"], "RISKS.md": ["Confirmed behavior", "Defect candidates", "Unverified gaps"] };
const aggregate = { cases: 0, surfaces: 0, approved: 0 };

function sourceBytes(files) { return files.reduce((sum, file) => sum + Buffer.byteLength(readFileSync(file)), 0); }
function sourceDigest(root, files) { const hash = createHash("sha256"); for (const file of files) hash.update(file.slice(root.length)).update("\0").update(readFileSync(file)).update("\0"); return hash.digest("hex"); }
function artifactBody(title, commit, names, evidence) {
  return [`# ${title}`, "", `Source: ${commit}`, "", ...names.flatMap((name, index) => [
    `## ${name}`,
    index === 1 && title === "Architecture"
      ? `CLM-ARCH-001: This generated baseline records the frozen source surface. \`${evidence}\``
      : "**Not found** beyond the frozen synthetic evaluation scope.",
  ])].join("\n") + "\n";
}

for (const name of caseNames) {
  const started = performance.now();
  const root = join(casesRoot, name, "source");
  const output = join(casesRoot, name, "generated");
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const discovered = extractCoverageSurface(root, ["."]);
  if (discovered.length === 0) throw new Error(`${name}: no surfaces discovered`);
  const files = includedSourceFiles(root, ["."]);
  const commit = sourceDigest(root, files);
  const counters = new Map();
  const covered = discovered.map((item) => {
    const count = (counters.get(item.expected_document_type) ?? 0) + 1;
    counters.set(item.expected_document_type, count);
    return { surface: item.surface, found_at: item.found_at, expected_document_type: item.expected_document_type, document_id: `${item.expected_document_type}-${String(count).padStart(3, "0")}` };
  });
  const specItems = covered.map((item, index) => `### ${item.document_id} ${item.surface}\nCLM-SPEC-${String(index + 1).padStart(3, "0")}: Generated surface inventory entry. \`${item.found_at}\``).join("\n");
  const spec = [`# Specification`, "", `Source: ${commit}`, "", ...sections.flatMap((section) => [
    `## ${section}`,
    section === "Business rules" ? specItems : "**Not found** beyond the frozen synthetic evaluation scope.",
  ])].join("\n") + "\n";
  const evidence = discovered[0].found_at;
  writeFileSync(join(output, "SPEC.md"), spec);
  writeFileSync(join(output, "ARCHITECTURE.md"), artifactBody("Architecture", commit, architectureSections, evidence));
  for (const [file, required] of Object.entries(standardDocuments))
    writeFileSync(join(output, file), artifactBody(file.replace(".md", ""), commit, required, evidence).replace("CLM-ARCH-001", `CLM-${file.replace(".md", "")}-001`));
  const markdownBodies = ["SPEC.md", "ARCHITECTURE.md", ...Object.keys(standardDocuments)].map((file) => readFileSync(join(output, file), "utf8"));
  const claimRows = markdownBodies.flatMap((body) => body.split(/\r?\n/).flatMap((line) => {
    const claimId = /\b(CLM-[A-Za-z0-9_-]+)\b/.exec(line)?.[1];
    return Array.from(line.matchAll(/`([^`]+:\d+(?:-\d+)?)`/g), (match) => ({ action: "verified", claim_id: claimId, evidence: match[1], document: "generated-baseline" }));
  }));
  writeFileSync(join(output, "audit_log.jsonl"), claimRows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  const digest = calculateDraftDigest(output, "standard");
  const manifest = {
    analyzed_source_commit: commit, included_paths: ["."], excluded_paths: [],
    file_counts: { supported: files.length, unsupported: 0, failed: 0, skipped: 0 },
    truncated: false, truncated_inputs: [], module_extractors: [{ module: ".", actor_id: `extractor-${name}` }],
    writer_actor_id: `writer-${name}`, draft_digest: digest,
  };
  const result = evaluateDocumentGate({
    root, source_root: root, dir: output, profile: "standard", scope_manifest: manifest,
    evidence_audit: { verdict: "passed", actor_id: `auditor-${name}`, draft_digest: digest },
    coverage_audit: { expected_count: covered.length, documented_count: covered.length, covered_items: covered, explained_omissions: [], unexplained_omissions: [], truncated_inputs: [], verdict: "passed", actor_id: `sentinel-${name}`, draft_digest: digest },
    gatekeeper_actor_id: `gatekeeper-${name}`,
  });
  const record = {
    case: name, source_revision: commit, profile: "standard", gate: result,
    elapsed_ms: Math.round((performance.now() - started) * 100) / 100,
    rss_after_bytes: process.memoryUsage().rss, source_bytes: sourceBytes(files),
    gate_result_bytes: Buffer.byteLength(JSON.stringify(result)), execution_mode: "direct_module",
    connector_calls: 0, unique_file_reads: "not_measured", repeated_file_reads: "not_measured",
    provider_counters: "not_exposed",
  };
  writeFileSync(join(casesRoot, name, "run-record.json"), `${JSON.stringify(record, null, 2)}\n`);
  if (result.verdict !== "approved") throw new Error(`${basename(root)}: ${JSON.stringify(result.reasons)}`);
  aggregate.cases++; aggregate.surfaces += covered.length; aggregate.approved++;
  process.stdout.write(`${name}: approved (${covered.length} surfaces)\n`);
}
const summaryPath = join(casesRoot, "..", "results", "emission-summary.json");
mkdirSync(resolve(summaryPath, ".."), { recursive: true });
writeFileSync(summaryPath, `${JSON.stringify({
  evaluation_kind: "synthetic_standard_emission_smoke", ...aggregate,
  provider_counters: "not_exposed",
  limitations: ["Generated standard-profile drafts are deterministic synthetic inventory documents, not model-written production specifications.", "Actor IDs are distinct contract fixtures, not evidence of independently executed agents.", "RSS is a post-run snapshot and source read counts are not measured.", "This smoke validates orchestration and gate behavior, not semantic claim quality or billing-token savings."],
}, null, 2)}\n`);
