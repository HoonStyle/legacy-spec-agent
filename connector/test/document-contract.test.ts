import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

async function readRepositoryFile(path: string): Promise<string> {
  return readFile(join(repositoryRoot, path), "utf8");
}

test("Mode A defines explicit core and default standard artifact profiles", async () => {
  const skill = await readRepositoryFile("SKILL.md");
  assert.match(skill, /\*\*`core` \(explicit opt-in\):\*\* `SPEC\.md`, `ARCHITECTURE\.md`, and `audit_log\.jsonl`/);
  assert.match(skill, /\*\*`standard` \(default\):\*\*/);
  for (const artifact of [
    "INTERFACES.md", "DATA_MODEL.md", "ONBOARDING.md", "TESTCASES.md", "RISKS.md", "REPORT.html",
  ]) {
    assert.ok(skill.includes("`" + artifact + "`"), `missing ${artifact}`);
  }
  assert.match(skill, /search scope and \*\*Not found\*\*/);
});

test("document contracts require stable IDs, sections, and syntax-only graph disclosure", async () => {
  const skill = await readRepositoryFile("SKILL.md");
  for (const prefix of ["BR-*", "API-*", "DM-*", "TC-*", "RSK-*", "UV-*"]) {
    assert.ok(skill.includes(`\`${prefix}\``), `missing ${prefix} ID contract`);
  }
  for (const section of [
    "System purpose and boundary", "Actors and entrypoints", "Core use cases", "Validation and error behavior",
    "Business rules", "State transitions", "Configuration", "Persistence and side effects", "Operational behavior", "Known limitations", "Unverified / Needs-review",
  ]) {
    assert.ok(skill.includes(section), `missing SPEC section: ${section}`);
  }
  assert.match(skill, /graph_type: module_dependency; resolution: syntax/);
  assert.match(skill, /not an actual method call graph/);
});

test("role and README contracts stay aligned with standard profile", async () => {
  const [roles, english, korean, roadmap] = await Promise.all([
    readRepositoryFile("references/agent-roles.md"),
    readRepositoryFile("README.md"),
    readRepositoryFile("README.ko.md"),
    readRepositoryFile("IMPLEMENTATION_ROADMAP.md"),
  ]);
  assert.match(roles, /ID index across all documents/);
  assert.match(roles, /every citation in every markdown deliverable/);
  assert.match(english, /`standard` \(default\)/);
  assert.match(korean, /`standard` \(기본값\)/);
  assert.match(roadmap, /Artifact quality and documentation contracts/);
  assert.match(roadmap, /independent of bounded end-to-end token replay/);
});

test("independent audit, reverse coverage, and Gatekeeper contracts stay synchronized", async () => {
  const paths = [
    "SKILL.md",
    "references/agent-roles.md",
    "skills/legacy-spec-agent/SKILL.md",
    "skills/legacy-spec-agent/references/agent-roles.md",
  ];
  const documents = await Promise.all(paths.map(readRepositoryFile));
  for (const [index, document] of documents.entries()) {
    const path = paths[index];
    for (const contract of [
      /Independent Evidence Auditor/,
      /Coverage Sentinel/,
      /Gatekeeper/,
      /citation audit coverage below 100%/,
      /unexplained code-surface omission/,
      /duplicate, dangling, or type-mismatched ID|duplicate\/dangling\/type-mismatched IDs/,
      /truncation that is not disclosed|undisclosed truncation/,
      /required document or required section|missing required documents or sections/,
      /syntax module dependenc(?:y|ies).*call graph/,
      /cannot (?:generate the final audit verdict|issue the audit verdict)/,
      /cannot .*approve (?:its own|publication)/,
      /re-verify every changed claim, citation, and ID/,
    ]) {
      assert.match(document, contract, `${path} is missing ${contract}`);
    }
  }
});

test("scope manifest and Coverage Sentinel schema are explicit", async () => {
  const [skill, roles] = await Promise.all([
    readRepositoryFile("SKILL.md"),
    readRepositoryFile("references/agent-roles.md"),
  ]);
  for (const document of [skill, roles]) {
    for (const field of ["analyzed source commit", "included", "excluded", "supported", "unsupported", "failed", "skipped", "truncat", "Extractor assigned"]) {
      assert.ok(document.includes(field), `scope manifest is missing ${field}`);
    }
  }
  for (const field of [
    "expected_count", "documented_count", "covered_items", "explained_omissions",
    "unexplained_omissions", "truncated_inputs", "verdict", "found_at", "expected_document_type",
  ]) {
    assert.ok(roles.includes(`\"${field}\"`), `Coverage Sentinel schema is missing ${field}`);
  }
});

test("pre-Writer scope schema defers draft_digest while the runtime gate requires it", async () => {
  const schema = JSON.parse(await readRepositoryFile("references/scope-manifest.schema.json"));
  assert.ok(!schema.required.includes("draft_digest"));
  assert.match(schema.properties.draft_digest.description, /after the Writer completes the draft/);
});
