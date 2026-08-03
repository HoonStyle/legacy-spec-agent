import assert from "node:assert/strict";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { calculateDraftDigest, evaluateDocumentGate, type DocumentGateParams } from "../src/document-gate.js";
import { extractCoverageSurface, includedSourceFiles } from "../src/coverage-surface.js";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureRoot = join(repositoryRoot, "connector/test/fixtures/document-coverage");

function fixture(name: string): DocumentGateParams {
  const base = join(fixtureRoot, name);
  const input = JSON.parse(readFileSync(join(base, "gate-input.json"), "utf8"));
  return { root: repositoryRoot, source_root: base, dir: join(base, "output"), profile: "core", ...input };
}

function isolatedComplete(): { params: DocumentGateParams; cleanup: () => void } {
  const temp = mkdtempSync(join(tmpdir(), "document-gate-"));
  cpSync(join(fixtureRoot, "complete-or-explained", "output"), join(temp, "output"), { recursive: true });
  const params = fixture("complete-or-explained");
  params.dir = join(temp, "output");
  return { params, cleanup: () => rmSync(temp, { recursive: true, force: true }) };
}

function refreshDigest(params: DocumentGateParams): void {
  const digest = calculateDraftDigest(params.dir, params.profile);
  params.scope_manifest.draft_digest = digest;
  params.evidence_audit.draft_digest = digest;
  params.coverage_audit.draft_digest = digest;
}

test("accurate citations cannot hide an undocumented registered interface", () => {
  const result = evaluateDocumentGate(fixture("incomplete"));
  assert.equal(result.audited_citation_count, result.citation_count);
  assert.equal(result.verdict, "rejected");
  assert.ok(result.reasons.some((reason) => reason.code === "coverage_failed"));
});

test("complete documentation or a frozen, explained exclusion is approved", () => {
  const result = evaluateDocumentGate(fixture("complete-or-explained"));
  assert.deepEqual(result, { verdict: "approved", citation_count: 8, audited_citation_count: 8, reasons: [] });
});

test("fenced code citations are ignored and parsing resumes for LF and CRLF documents", () => {
  const fixtureMarkdown = readFileSync(join(fixtureRoot, "fenced-citations.md"), "utf8");
  const expected = { verdict: "approved", citation_count: 13, audited_citation_count: 13, reasons: [] };
  for (const lineEnding of ["\n", "\r\n"]) {
    const { params, cleanup } = isolatedComplete();
    try {
      const architecture = join(params.dir, "ARCHITECTURE.md");
      const normalized = fixtureMarkdown.replace(/\r?\n/g, lineEnding);
      appendFileSync(architecture, `${lineEnding}${normalized}`);
      appendFileSync(join(params.dir, "audit_log.jsonl"), [
        { action: "verified", claim_id: "CLM-101", evidence: "src/server.ts:1", document: "ARCHITECTURE.md" },
        { action: "verified", claim_id: "CLM-102", evidence: "src/server.ts:2", document: "ARCHITECTURE.md" },
        { action: "verified", claim_id: "CLM-103", evidence: "src/server.ts:1-2", document: "ARCHITECTURE.md" },
        { action: "verified", claim_id: "CLM-104", evidence: "src/server.ts:2", document: "ARCHITECTURE.md" },
        { action: "verified", claim_id: "CLM-105", evidence: "src/server.ts:1", document: "ARCHITECTURE.md" },
      ].map((row) => JSON.stringify(row)).join(lineEnding) + lineEnding);
      refreshDigest(params);
      assert.deepEqual(evaluateDocumentGate(params), expected);
    } finally { cleanup(); }
  }
});

test("Gatekeeper rejects stale/self audits and undisclosed truncation", () => {
  const params = fixture("complete-or-explained");
  params.evidence_audit.actor_id = params.scope_manifest.writer_actor_id;
  params.coverage_audit.draft_digest = "old-draft";
  params.coverage_audit.truncated_inputs = [{ source: "surface-enumeration", returned: 1, total: 2, omitted: 1 }];
  const result = evaluateDocumentGate(params);
  assert.equal(result.verdict, "rejected");
  assert.ok(result.reasons.some((reason) => reason.code === "invalid_provenance"));
  assert.ok(result.reasons.some((reason) => reason.code === "undisclosed_truncation"));
});

test("fully disclosed truncation does not block publication", () => {
  const params = fixture("complete-or-explained");
  const truncation = { source: "surface-enumeration", returned: 1, total: 2, omitted: 1 };
  params.scope_manifest.truncated = true;
  params.scope_manifest.truncated_inputs = [truncation];
  params.coverage_audit.truncated_inputs = [{ ...truncation }];
  const result = evaluateDocumentGate(params);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.verdict, "approved");
});

test("the required negative call-graph disclaimer is not treated as a mislabeled graph", () => {
  const { params, cleanup } = isolatedComplete();
  try {
    const path = join(params.dir, "ARCHITECTURE.md");
    writeFileSync(path, `${readFileSync(path, "utf8")}\nThis module dependency view (graph_type: module_dependency; resolution: syntax) is not a method call graph.\n`);
    refreshDigest(params);
    const result = evaluateDocumentGate(params);
    assert.deepEqual(result.reasons, []);
    assert.equal(result.verdict, "approved");
  } finally { cleanup(); }
});

test("every deterministic publication rejection condition has a focused regression", async (t) => {
  const cases: Array<{ name: string; code: string; mutate: (params: DocumentGateParams) => void }> = [
    { name: "required document", code: "missing_document", mutate: (p) => unlinkSync(join(p.dir, "ARCHITECTURE.md")) },
    { name: "required section", code: "missing_section", mutate: (p) => { const path = join(p.dir, "SPEC.md"); writeFileSync(path, readFileSync(path, "utf8").replace("## Configuration", "## Settings")); refreshDigest(p); } },
    { name: "citation line validity", code: "invalid_citation", mutate: (p) => { const path = join(p.dir, "SPEC.md"); writeFileSync(path, readFileSync(path, "utf8").replace("src/server.ts:1-2", "src/server.ts:999")); refreshDigest(p); } },
    { name: "citation audit coverage", code: "citation_audit_incomplete", mutate: (p) => writeFileSync(join(p.dir, "audit_log.jsonl"), "") },
    { name: "unsupported verified claim", code: "unsupported_verified_claim", mutate: (p) => appendFileSync(join(p.dir, "audit_log.jsonl"), "{\"action\":\"flagged\",\"evidence\":\"src/server.ts:1\"}\n") },
    { name: "audit rows without a verified action", code: "citation_audit_incomplete", mutate: (p) => { const path = join(p.dir, "audit_log.jsonl"); writeFileSync(path, readFileSync(path, "utf8").replaceAll("\"verified\"", "\"recorded\"")); } },
    { name: "malformed audit log line", code: "invalid_audit_log", mutate: (p) => appendFileSync(join(p.dir, "audit_log.jsonl"), "{\"action\":\"verified\",\"evidence\":\n") },
    { name: "invalid audit row schema", code: "invalid_audit_log", mutate: (p) => appendFileSync(join(p.dir, "audit_log.jsonl"), "{\"action\":\"verified\"}\n") },
    { name: "coverage ID missing from the draft", code: "coverage_failed", mutate: (p) => { p.coverage_audit.covered_items[0].document_id = "API-999"; } },
    { name: "undisclosed coverage truncation", code: "undisclosed_truncation", mutate: (p) => { p.coverage_audit.truncated_inputs = [{ source: "surface-enumeration", returned: 1, total: 2, omitted: 1 }]; } },
    { name: "missing provenance declaration", code: "invalid_provenance", mutate: (p) => { const path = join(p.dir, "SPEC.md"); writeFileSync(path, readFileSync(path, "utf8").replace(/Source: fixture-commit\r?\n/, "")); refreshDigest(p); } },
    { name: "module extractor path collapse", code: "invalid_manifest", mutate: (p) => { p.scope_manifest.module_extractors = [{ module: "src", actor_id: "extractor-1" }]; } },
    { name: "duplicate ID", code: "invalid_id", mutate: (p) => { const path = join(p.dir, "SPEC.md"); writeFileSync(path, `${readFileSync(path, "utf8")}\n### BR-001 duplicate\n`); refreshDigest(p); } },
    { name: "dangling ID", code: "invalid_id", mutate: (p) => { const path = join(p.dir, "SPEC.md"); writeFileSync(path, `${readFileSync(path, "utf8")}\nRelated: API-999\n`); refreshDigest(p); } },
    { name: "typed ID mismatch", code: "invalid_id", mutate: (p) => { const path = join(p.dir, "SPEC.md"); writeFileSync(path, `${readFileSync(path, "utf8")}\nRelated API: BR-001\n`); refreshDigest(p); } },
    { name: "coverage count mismatch", code: "coverage_failed", mutate: (p) => { p.coverage_audit.expected_count = 99; } },
    { name: "phantom coverage item", code: "coverage_failed", mutate: (p) => { p.coverage_audit.covered_items[0].surface = "registered_api:invented"; } },
    { name: "covered ID lacks matching source evidence", code: "coverage_failed", mutate: (p) => { const path = join(p.dir, "ARCHITECTURE.md"); writeFileSync(path, readFileSync(path, "utf8").replace("The lookup operation is exported. `src/server.ts:1`", "The lookup operation is exported. `src/server.ts:2`")); refreshDigest(p); } },
    { name: "duplicate coverage classification", code: "coverage_failed", mutate: (p) => { p.coverage_audit.explained_omissions.push({ ...p.coverage_audit.covered_items[0], reason: "duplicate" }); } },
    { name: "empty omission explanation", code: "coverage_failed", mutate: (p) => { p.coverage_audit.explained_omissions[0].reason = ""; } },
    { name: "scope-unrelated omission", code: "coverage_failed", mutate: (p) => { p.scope_manifest.excluded_paths[0].path = "src/other.ts:2"; } },
    { name: "syntax dependency call graph", code: "syntax_dependency_as_call_graph", mutate: (p) => { const path = join(p.dir, "ARCHITECTURE.md"); writeFileSync(path, `${readFileSync(path, "utf8")}\ncall graph graph_type: module_dependency resolution: syntax\n`); refreshDigest(p); } },
    { name: "invalid truncation accounting", code: "invalid_manifest", mutate: (p) => { p.scope_manifest.truncated = true; p.scope_manifest.truncated_inputs = [{ source: "index", returned: 1, total: 5, omitted: 1 }]; } },
    { name: "source file count mismatch", code: "invalid_manifest", mutate: (p) => { p.scope_manifest.file_counts.supported = 2; } },
    { name: "Writer/Coverage actor collision", code: "invalid_provenance", mutate: (p) => { p.coverage_audit.actor_id = p.scope_manifest.writer_actor_id; } },
    { name: "Gatekeeper/Evidence actor collision", code: "invalid_provenance", mutate: (p) => { p.gatekeeper_actor_id = p.evidence_audit.actor_id; } },
    { name: "modified frozen draft", code: "invalid_provenance", mutate: (p) => appendFileSync(join(p.dir, "SPEC.md"), "\npost-freeze mutation\n") },
    { name: "unaudited claim ID", code: "claim_audit_incomplete", mutate: (p) => { const path = join(p.dir, "SPEC.md"); writeFileSync(path, `${readFileSync(path, "utf8")}\nCLM-999: factual claim \`src/server.ts:1\`\n`); refreshDigest(p); } },
    { name: "swapped claim evidence", code: "claim_audit_incomplete", mutate: (p) => { const path = join(p.dir, "audit_log.jsonl"); const lines = readFileSync(path, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line)); [lines[0].evidence, lines[2].evidence] = [lines[2].evidence, lines[0].evidence]; writeFileSync(path, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`); } },
    { name: "multiple claim IDs on one cited line", code: "claim_audit_incomplete", mutate: (p) => { const path = join(p.dir, "SPEC.md"); writeFileSync(path, readFileSync(path, "utf8").replace("CLM-001:", "CLM-001 CLM-999:")); const audit = join(p.dir, "audit_log.jsonl"); appendFileSync(audit, '{"action":"verified","claim_id":"CLM-999","evidence":"src/server.ts:1"}\n'); refreshDigest(p); } },
  ];
  for (const item of cases) await t.test(item.name, () => {
    const { params, cleanup } = isolatedComplete();
    try {
      item.mutate(params);
      const result = evaluateDocumentGate(params);
      assert.equal(result.verdict, "rejected");
      assert.ok(result.reasons.some((reason) => reason.code === item.code), JSON.stringify(result.reasons));
    } finally { cleanup(); }
  });
});

test("coverage surface includes registrations, contracts, env, entrypoints, states, tests, and side effects", () => {
  const root = mkdtempSync(join(tmpdir(), "coverage-surface-"));
  try {
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "main.ts"), [
      "interface RequestBody { value: string }",
      "const url = process.env.API_URL;",
      "app.post('/users', handler);",
      "const state = 'ready';",
      "function main() { writeFile('out', 'x'); }",
    ].join("\n"));
    writeFileSync(join(root, "src", "worker.py"), "import os\ntoken = os.getenv('PY_TOKEN')\n");
    writeFileSync(join(root, "src", "worker.go"), "package main\n\nvar region = os.Getenv(\"GO_REGION\")\n");
    writeFileSync(join(root, "src", "Worker.java"), "class Worker { String home = System.getenv(\"JAVA_HOME_DIR\"); }\n");
    writeFileSync(join(root, "src", "loader.mjs"), "export const loadModule = () => true;\n");
    mkdirSync(join(root, "tests"));
    writeFileSync(join(root, "tests", "main.test.ts"), "export const scenario = true;\n");
    const surface = extractCoverageSurface(root, ["src", "tests"]);
    for (const expected of ["data_contract:RequestBody", "environment:API_URL", "environment:PY_TOKEN", "environment:GO_REGION", "environment:JAVA_HOME_DIR", "registered_api:/users", "registered_api:loadModule", "status_value:ready", "entrypoint:src/main.ts", "test_file:tests/main.test.ts", "external_side_effect:function main() { writeFile('out', 'x'); }"])
      assert.ok(surface.some((item) => item.surface === expected), expected);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("coverage surface honors frozen exclusions and never follows symlinks outside the root", () => {
  const root = mkdtempSync(join(tmpdir(), "coverage-surface-"));
  const outside = mkdtempSync(join(tmpdir(), "coverage-outside-"));
  try {
    mkdirSync(join(root, "src", "node_modules", "dep"), { recursive: true });
    writeFileSync(join(root, "src", "main.ts"), "export const keepMe = 1;\n");
    writeFileSync(join(root, "src", "node_modules", "dep", "index.ts"), "export const vendored = 1;\n");
    writeFileSync(join(outside, "secret.ts"), "export const escaped = 1;\n");
    symlinkSync(outside, join(root, "src", "external"), "dir");
    const excluded = [{ path: "src/node_modules", reason: "generated dependencies excluded by the frozen scope" }];
    const files = includedSourceFiles(root, ["src"], excluded);
    assert.deepEqual(files.map((file) => file.slice(root.length + 1).replaceAll("\\", "/")), ["src/main.ts"]);
    const surface = extractCoverageSurface(root, ["src"], excluded);
    assert.ok(surface.some((item) => item.surface === "registered_api:keepMe"));
    assert.ok(!surface.some((item) => item.surface.includes("vendored") || item.surface.includes("escaped")));
    assert.deepEqual(includedSourceFiles(root, ["src/external"]), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("coverage surface preserves Unicode and spaced source paths", () => {
  const root = mkdtempSync(join(tmpdir(), "coverage-한글-"));
  try {
    mkdirSync(join(root, "κώδικας space"));
    writeFileSync(join(root, "κώδικας space", "서비스.ts"), "export interface 요청 { value: string }\nexport const endpoint = process.env.API_URL;\n");
    const surface = extractCoverageSurface(root, ["κώδικας space"]);
    assert.ok(surface.some((item) => item.surface === "environment:API_URL" && item.found_at === "κώδικας space/서비스.ts:2"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
