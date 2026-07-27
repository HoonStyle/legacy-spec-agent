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
    "State transitions", "Configuration", "Persistence and side effects", "Operational behavior", "Known limitations",
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
