import assert from "node:assert/strict";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { calculateDraftDigest, calculateSourceSnapshot, evaluateDocumentGate, resolveSourceGitHead, type DocumentGateParams } from "../src/document-gate.js";
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

function isolatedIndependentAddition(): { params: DocumentGateParams; cleanup: () => void } {
  const temp = mkdtempSync(join(tmpdir(), "document-gate-independent-"));
  cpSync(join(fixtureRoot, "complete-or-explained"), temp, { recursive: true });
  appendFileSync(join(temp, "src", "server.ts"), "postRouter.get('/posts', handler);\n");
  const params: DocumentGateParams = {
    root: repositoryRoot, source_root: temp, dir: join(temp, "output"), profile: "core",
    ...JSON.parse(readFileSync(join(temp, "gate-input.json"), "utf8")),
  };
  params.coverage_audit.contract_version = "2";
  params.coverage_audit.expected_count += 1;
  params.coverage_audit.documented_count += 1;
  params.coverage_audit.covered_items.push({
    discovery: "independent_audit", audit_note: "Named router registration found by direct source review.",
    category: "registered_api", surface: "registered_api:GET /posts", found_at: "src/server.ts:3",
    expected_document_type: "API", document_id: "API-002",
  });
  appendFileSync(join(params.dir, "ARCHITECTURE.md"), "\n### API-002 GET /posts\nCLM-009: A named router registers the posts route. `src/server.ts:3`\n");
  appendFileSync(join(params.dir, "audit_log.jsonl"), '{"action":"verified","claim_id":"CLM-009","evidence":"src/server.ts:3","document":"ARCHITECTURE.md"}\n');
  refreshDigest(params);
  return { params, cleanup: () => rmSync(temp, { recursive: true, force: true }) };
}

function isolatedSourceSnapshot(): { params: DocumentGateParams; cleanup: () => void } {
  const temp = mkdtempSync(join(tmpdir(), "document-gate-source-"));
  cpSync(join(fixtureRoot, "complete-or-explained"), temp, { recursive: true });
  const params: DocumentGateParams = {
    root: repositoryRoot, source_root: temp, dir: join(temp, "output"), profile: "core",
    ...JSON.parse(readFileSync(join(temp, "gate-input.json"), "utf8")),
  };
  params.scope_manifest.provenance_version = "2";
  params.scope_manifest.source_snapshot = calculateSourceSnapshot(
    params.source_root, params.scope_manifest.included_paths, params.scope_manifest.excluded_paths,
    { source_kind: "non_git" },
  );
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

test("coverage contract v2 accepts a source-valid independent-audit addition beyond deterministic discovery", () => {
  const { params, cleanup } = isolatedIndependentAddition();
  try {
    assert.ok(!extractCoverageSurface(params.source_root, params.scope_manifest.included_paths, params.scope_manifest.excluded_paths)
      .some((item) => item.surface === "registered_api:GET /posts"));
    assert.deepEqual(evaluateDocumentGate(params), { verdict: "approved", citation_count: 9, audited_citation_count: 9, reasons: [] });
  } finally { cleanup(); }
});

test("independent-audit additions must preserve their v2 attribution and source contract", async (t) => {
  const cases: Array<{ name: string; mutate: (params: DocumentGateParams) => void }> = [
    { name: "contract version", mutate: (p) => { delete p.coverage_audit.contract_version; } },
    { name: "audit note", mutate: (p) => { delete p.coverage_audit.covered_items.at(-1)!.audit_note; } },
    { name: "included source path", mutate: (p) => { p.coverage_audit.covered_items.at(-1)!.found_at = "outside.ts:1"; } },
    { name: "existing source line", mutate: (p) => { p.coverage_audit.covered_items.at(-1)!.found_at = "src/server.ts:999"; } },
    { name: "category/type mapping", mutate: (p) => { p.coverage_audit.covered_items.at(-1)!.expected_document_type = "DM"; } },
    { name: "surface/category mapping", mutate: (p) => { p.coverage_audit.covered_items.at(-1)!.category = "data_contract"; } },
    { name: "detector result cannot be relabelled", mutate: (p) => {
      const item = p.coverage_audit.covered_items[0];
      item.discovery = "independent_audit";
      item.audit_note = "mislabelled";
    } },
  ];
  for (const item of cases) await t.test(item.name, () => {
    const { params, cleanup } = isolatedIndependentAddition();
    try {
      item.mutate(params);
      const result = evaluateDocumentGate(params);
      assert.equal(result.verdict, "rejected");
      assert.ok(result.reasons.some((reason) => reason.code === "coverage_failed"), JSON.stringify(result.reasons));
    } finally { cleanup(); }
  });
});

test("source provenance v2 binds the gate to included raw bytes", () => {
  const { params, cleanup } = isolatedSourceSnapshot();
  try {
    assert.equal(evaluateDocumentGate(params).verdict, "approved");
    writeFileSync(join(params.source_root, "ignored.txt"), "outside the supported source inventory");
    assert.equal(evaluateDocumentGate(params).verdict, "approved");
    appendFileSync(join(params.source_root, "src", "server.ts"), "// dirty mutation\n");
    const rejected = evaluateDocumentGate(params);
    assert.equal(rejected.verdict, "rejected");
    assert.ok(rejected.reasons.some((reason) => reason.code === "invalid_provenance"));
  } finally { cleanup(); }
});

test("source provenance v2 fails closed on a dishonest or unreadable Git declaration", () => {
  const { params, cleanup } = isolatedSourceSnapshot();
  try {
    writeFileSync(join(params.source_root, ".git"), "not valid git metadata\n");
    const rejectedNonGit = evaluateDocumentGate(params);
    assert.equal(rejectedNonGit.verdict, "rejected");
    assert.ok(rejectedNonGit.reasons.some((reason) => reason.code === "invalid_provenance"));

    params.scope_manifest.source_snapshot = calculateSourceSnapshot(
      params.source_root, params.scope_manifest.included_paths, params.scope_manifest.excluded_paths,
      { source_kind: "git_worktree", base_commit: "a".repeat(40) },
    );
    params.scope_manifest.analyzed_source_commit = "a".repeat(40);
    const rejectedGit = evaluateDocumentGate(params);
    assert.equal(rejectedGit.verdict, "rejected");
    assert.ok(rejectedGit.reasons.some((reason) => reason.code === "invalid_provenance"));
  } finally { cleanup(); }
});

test("source snapshots detect included file additions and deletions and hash raw bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "source-snapshot-한글-"));
  try {
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "a.ts"), Buffer.from("export const café = 1;\r\n", "utf8"));
    writeFileSync(join(root, "src", "excluded.ts"), "export const ignored = 0;\n");
    const exclusions = [{ path: "src/excluded.ts", reason: "outside the frozen analysis scope" }];
    const first = calculateSourceSnapshot(root, ["src"], exclusions, { source_kind: "non_git" });
    assert.equal(first.files.length, 1);
    assert.equal(first.files[0].bytes, Buffer.byteLength("export const café = 1;\r\n", "utf8"));
    writeFileSync(join(root, "src", "excluded.ts"), "export const ignored = 999;\n");
    assert.equal(calculateSourceSnapshot(root, ["src"], exclusions, { source_kind: "non_git" }).digest, first.digest);
    writeFileSync(join(root, "src", "b.ts"), "export const added = 2;\n");
    const added = calculateSourceSnapshot(root, ["src"], exclusions, { source_kind: "non_git" });
    assert.notEqual(added.digest, first.digest);
    unlinkSync(join(root, "src", "a.ts"));
    const deleted = calculateSourceSnapshot(root, ["src"], exclusions, { source_kind: "non_git" });
    assert.notEqual(deleted.digest, added.digest);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Git HEAD resolution supports normal checkouts and linked worktree metadata", () => {
  const root = mkdtempSync(join(tmpdir(), "git-provenance-"));
  const commit = "a".repeat(40);
  const topic = "b".repeat(40);
  try {
    mkdirSync(join(root, "main", ".git", "refs", "heads"), { recursive: true });
    writeFileSync(join(root, "main", ".git", "HEAD"), "ref: refs/heads/main\n");
    writeFileSync(join(root, "main", ".git", "refs", "heads", "main"), `${commit}\n`);
    assert.equal(resolveSourceGitHead(join(root, "main")), commit);

    mkdirSync(join(root, "main", ".git", "worktrees", "linked"), { recursive: true });
    mkdirSync(join(root, "linked"));
    writeFileSync(join(root, "linked", ".git"), "gitdir: ../main/.git/worktrees/linked\n");
    writeFileSync(join(root, "main", ".git", "worktrees", "linked", "HEAD"), "ref: refs/heads/topic\n");
    writeFileSync(join(root, "main", ".git", "worktrees", "linked", "commondir"), "../..\n");
    writeFileSync(join(root, "main", ".git", "refs", "heads", "topic"), `${topic}\n`);
    assert.equal(resolveSourceGitHead(join(root, "linked")), topic);
  } finally { rmSync(root, { recursive: true, force: true }); }
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

test("coverage identity accepts only citations that contain the original surface location", async (t) => {
  const cases = JSON.parse(readFileSync(join(fixtureRoot, "citation-surface-linkage.json"), "utf8")) as Array<{
    name: string; found_at: string; claim_citations: string[]; expected_verdict: "approved" | "rejected";
  }>;
  for (const item of cases) await t.test(item.name, () => {
    const { params, cleanup } = isolatedComplete();
    try {
      assert.equal(params.coverage_audit.covered_items[0].found_at, item.found_at);
      const evidence = item.claim_citations[0];
      const renderedCitations = item.claim_citations.map((citation) => `\`${citation}\``).join(" ");
      const architecture = join(params.dir, "ARCHITECTURE.md");
      writeFileSync(architecture, readFileSync(architecture, "utf8").replace(
        "CLM-007: The lookup operation is exported. `src/server.ts:1`",
        `CLM-007: The lookup operation is exported as part of the service surface. ${renderedCitations}`,
      ));
      const auditPath = join(params.dir, "audit_log.jsonl");
      writeFileSync(auditPath, `${readFileSync(auditPath, "utf8").trim().split(/\r?\n/).map((line) => {
        const row = JSON.parse(line);
        if (row.claim_id === "CLM-007") row.evidence = item.claim_citations.length === 1 ? evidence : item.claim_citations;
        return JSON.stringify(row);
      }).join("\n")}\n`);
      refreshDigest(params);
      const result = evaluateDocumentGate(params);
      assert.equal(result.verdict, item.expected_verdict, JSON.stringify(result.reasons));
      if (item.expected_verdict === "rejected")
        assert.ok(result.reasons.some((reason) => reason.code === "coverage_failed"));
      assert.ok(!result.reasons.some((reason) => reason.code === "claim_audit_incomplete"));
    } finally { cleanup(); }
  });
});

test("surface paths the citation grammar cannot parse keep their literal coverage linkage", () => {
  const temp = mkdtempSync(join(tmpdir(), "document-gate-"));
  try {
    cpSync(join(fixtureRoot, "complete-or-explained"), temp, { recursive: true });
    const relativePath = "src/κώδικας space/서비스.ts";
    const foundAt = `${relativePath}:1`;
    mkdirSync(join(temp, "src", "κώδικας space"), { recursive: true });
    writeFileSync(join(temp, "src", "κώδικας space", "서비스.ts"), "export function lookupKo() {}\n");
    const params: DocumentGateParams = {
      root: repositoryRoot, source_root: temp, dir: join(temp, "output"), profile: "core",
      ...JSON.parse(readFileSync(join(temp, "gate-input.json"), "utf8")),
    };
    params.scope_manifest.included_paths.push(relativePath);
    params.scope_manifest.module_extractors.push({ module: relativePath, actor_id: "extractor-1" });
    params.scope_manifest.file_counts.supported += 1;
    params.coverage_audit.expected_count += 1;
    params.coverage_audit.documented_count += 1;
    params.coverage_audit.covered_items.push({
      category: "registered_api", surface: "registered_api:lookupKo", found_at: foundAt,
      expected_document_type: "API", document_id: "API-002",
    });
    const architecture = join(params.dir, "ARCHITECTURE.md");
    appendFileSync(architecture, `\n## API-002 — lookupKo\n\nExported from \`${foundAt}\`.\n`);
    refreshDigest(params);
    assert.deepEqual(evaluateDocumentGate(params), { verdict: "approved", citation_count: 8, audited_citation_count: 8, reasons: [] });

    writeFileSync(architecture, readFileSync(architecture, "utf8").replace(`\`${foundAt}\``, "the unicode service module"));
    refreshDigest(params);
    const rejected = evaluateDocumentGate(params);
    assert.equal(rejected.verdict, "rejected");
    assert.ok(rejected.reasons.some((reason) => reason.code === "coverage_failed"));
  } finally { rmSync(temp, { recursive: true, force: true }); }
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
    { name: "wrong coverage category", code: "coverage_failed", mutate: (p) => { p.coverage_audit.covered_items[0].category = "data_contract"; } },
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
