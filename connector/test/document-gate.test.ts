import assert from "node:assert/strict";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { calculateDraftDigest, evaluateDocumentGate, type DocumentGateParams } from "../src/document-gate.js";
import { extractCoverageSurface } from "../src/coverage-surface.js";

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
  assert.deepEqual(result, { verdict: "approved", citation_count: 6, audited_citation_count: 6, reasons: [] });
});

test("Gatekeeper rejects stale/self audits and undisclosed truncation", () => {
  const params = fixture("complete-or-explained");
  params.evidence_audit.actor_id = params.scope_manifest.writer_actor_id;
  params.coverage_audit.draft_digest = "old-draft";
  params.scope_manifest.truncated = true;
  const result = evaluateDocumentGate(params);
  assert.equal(result.verdict, "rejected");
  assert.ok(result.reasons.some((reason) => reason.code === "invalid_provenance"));
  assert.ok(result.reasons.some((reason) => reason.code === "undisclosed_truncation"));
});

test("every deterministic publication rejection condition has a focused regression", async (t) => {
  const cases: Array<{ name: string; code: string; mutate: (params: DocumentGateParams) => void }> = [
    { name: "required document", code: "missing_document", mutate: (p) => unlinkSync(join(p.dir, "ARCHITECTURE.md")) },
    { name: "required section", code: "missing_section", mutate: (p) => { const path = join(p.dir, "SPEC.md"); writeFileSync(path, readFileSync(path, "utf8").replace("## Configuration", "## Settings")); refreshDigest(p); } },
    { name: "citation line validity", code: "invalid_citation", mutate: (p) => { const path = join(p.dir, "SPEC.md"); writeFileSync(path, readFileSync(path, "utf8").replace("src/server.ts:1-2", "src/server.ts:999")); refreshDigest(p); } },
    { name: "citation audit coverage", code: "citation_audit_incomplete", mutate: (p) => writeFileSync(join(p.dir, "audit_log.jsonl"), "") },
    { name: "unsupported verified claim", code: "unsupported_verified_claim", mutate: (p) => appendFileSync(join(p.dir, "audit_log.jsonl"), "{\"action\":\"flagged\",\"evidence\":\"connector/test/fixtures/document-coverage/complete-or-explained/src/server.ts:1\"}\n") },
    { name: "duplicate ID", code: "invalid_id", mutate: (p) => { const path = join(p.dir, "SPEC.md"); writeFileSync(path, `${readFileSync(path, "utf8")}\n### BR-001 duplicate\n`); refreshDigest(p); } },
    { name: "dangling ID", code: "invalid_id", mutate: (p) => { const path = join(p.dir, "SPEC.md"); writeFileSync(path, `${readFileSync(path, "utf8")}\nRelated: API-999\n`); refreshDigest(p); } },
    { name: "typed ID mismatch", code: "invalid_id", mutate: (p) => { const path = join(p.dir, "SPEC.md"); writeFileSync(path, `${readFileSync(path, "utf8")}\nRelated API: BR-001\n`); refreshDigest(p); } },
    { name: "coverage count mismatch", code: "coverage_failed", mutate: (p) => { p.coverage_audit.expected_count = 99; } },
    { name: "duplicate coverage classification", code: "coverage_failed", mutate: (p) => { p.coverage_audit.explained_omissions.push({ ...p.coverage_audit.covered_items[0], reason: "duplicate" }); } },
    { name: "empty omission explanation", code: "coverage_failed", mutate: (p) => { p.coverage_audit.explained_omissions[0].reason = ""; } },
    { name: "scope-unrelated omission", code: "coverage_failed", mutate: (p) => { p.scope_manifest.excluded_paths[0].path = "src/other.ts:2"; } },
    { name: "syntax dependency call graph", code: "syntax_dependency_as_call_graph", mutate: (p) => { const path = join(p.dir, "ARCHITECTURE.md"); writeFileSync(path, `${readFileSync(path, "utf8")}\ncall graph graph_type: module_dependency resolution: syntax\n`); refreshDigest(p); } },
    { name: "invalid truncation accounting", code: "invalid_manifest", mutate: (p) => { p.scope_manifest.truncated = true; p.scope_manifest.truncated_inputs = [{ source: "index", returned: 1, total: 5, omitted: 1 }]; } },
    { name: "source file count mismatch", code: "invalid_manifest", mutate: (p) => { p.scope_manifest.file_counts.supported = 2; } },
    { name: "Writer/Coverage actor collision", code: "invalid_provenance", mutate: (p) => { p.coverage_audit.actor_id = p.scope_manifest.writer_actor_id; } },
    { name: "Gatekeeper/Evidence actor collision", code: "invalid_provenance", mutate: (p) => { p.gatekeeper_actor_id = p.evidence_audit.actor_id; } },
    { name: "modified frozen draft", code: "invalid_provenance", mutate: (p) => appendFileSync(join(p.dir, "SPEC.md"), "\npost-freeze mutation\n") },
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
    mkdirSync(join(root, "tests"));
    writeFileSync(join(root, "tests", "main.test.ts"), "export const scenario = true;\n");
    const surface = extractCoverageSurface(root, ["src", "tests"]);
    for (const expected of ["data_contract:RequestBody", "environment:API_URL", "registered_api:/users", "status_value:ready", "entrypoint:src/main.ts", "test_file:tests/main.test.ts", "external_side_effect:function main() { writeFile('out', 'x'); }"])
      assert.ok(surface.some((item) => item.surface === expected), expected);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
