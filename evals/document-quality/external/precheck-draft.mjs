/**
 * Mechanical pre-check of an external case's frozen staging draft.
 *
 * Reproduces the deterministic gate's structural rules independently so a
 * rejection cause is visible before the Gatekeeper runs. It never edits the
 * draft. Reports the gate's own whole-document citation count next to a
 * line-by-line count, because fenced code blocks desynchronize the gate's scan
 * (see external-ts-prisma-rest/FINDING-gate-citation-undercount.md).
 *
 * Usage: node precheck-draft.mjs <case-id> <clone-directory-name>
 */
import { existsSync, readFileSync } from "node:fs";

const [caseId, cloneName] = process.argv.slice(2);
if (!caseId || !cloneName) {
  console.error("usage: node precheck-draft.mjs <case-id> <clone-dir>");
  process.exit(2);
}

const REPO = new URL("../../../", import.meta.url).pathname.replace(/\/$/, "");
const SOURCE_ROOT = `${REPO}/.external-sources/${cloneName}`;
const CASE_DIR = `${REPO}/evals/document-quality/external/${caseId}`;
const STAGING = `${CASE_DIR}/staging`;

const REQUIRED_SECTIONS = {
  "SPEC.md": ["System purpose and boundary", "Actors and entrypoints", "Core use cases", "Business rules", "Validation and error behavior", "State transitions", "Configuration", "Persistence and side effects", "Operational behavior", "Known limitations", "Unverified / Needs-review"],
  "ARCHITECTURE.md": ["System context", "Component inventory", "Runtime and deployment", "Module dependency", "External systems and data stores", "Major execution flows", "Trust boundaries", "Analysis limitations"],
  "INTERFACES.md": ["Interfaces"], "DATA_MODEL.md": ["Data model"], "ONBOARDING.md": ["Onboarding"],
  "TESTCASES.md": ["Existing automated tests", "Source-derived characterization scenarios", "External-contract test candidates"],
  "RISKS.md": ["Confirmed behavior", "Defect candidates", "Unverified gaps"],
};
const FILES = Object.keys(REQUIRED_SECTIONS);
const CITATION_RE = /^([\w./\\-]+\.(?:py|ts|js|jsx|tsx|md|json|jsonl|sh|mjs|cjs|java|cs|go)):(\d+)(?:-(\d+))?$/;
const parse = (s) => {
  const m = CITATION_RE.exec(s.trim());
  if (!m) return undefined;
  const start = Number(m[2]);
  const end = m[3] ? Number(m[3]) : start;
  return start >= 1 && end >= start ? { path: m[1], start, end } : undefined;
};

const manifest = JSON.parse(readFileSync(`${CASE_DIR}/scope-manifest.json`, "utf8"));
const problems = [];
const lineCounts = new Map();
const sourceLines = (p) => {
  if (!lineCounts.has(p)) {
    const full = `${SOURCE_ROOT}/${p}`;
    lineCounts.set(p, existsSync(full) ? readFileSync(full, "utf8").split(/\r?\n/).length : -1);
  }
  return lineCounts.get(p);
};

let perLineCitations = 0, gateCitations = 0;
const clmIds = [];
const bodies = new Map();

for (const file of FILES) {
  const path = `${STAGING}/${file}`;
  if (!existsSync(path)) { problems.push(`missing_document: ${file}`); continue; }
  const body = readFileSync(path, "utf8");
  bodies.set(file, body);

  for (const section of REQUIRED_SECTIONS[file]) {
    if (!new RegExp(`^#+\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "im").test(body))
      problems.push(`missing_section: ${file} :: ${section}`);
  }
  if (!body.split(/\r?\n/).some((l) => /^(?:>\s*)?(?:[*_-]{0,2})(?:Source|Analyzed source|analyzed_source_commit)\b/i.test(l.trim()) && l.includes(manifest.analyzed_source_commit)))
    problems.push(`invalid_provenance: ${file} lacks ${manifest.analyzed_source_commit}`);

  gateCitations += [...body.matchAll(/`([^`]+)`/g)].filter((m) => parse(m[1])).length;

  body.split(/\r?\n/).forEach((line, index) => {
    const cits = [...line.matchAll(/`([^`]+)`/g)].map((m) => parse(m[1])).filter(Boolean);
    const ids = line.match(/\bCLM-[A-Za-z0-9_-]+\b/g) ?? [];
    if (cits.length === 0) {
      if (ids.length > 0) problems.push(`claim_without_citation: ${file}:${index + 1}`);
      return;
    }
    perLineCitations += cits.length;
    clmIds.push(...ids);
    if (cits.length !== 1) problems.push(`multiple_citations: ${file}:${index + 1} (${cits.length})`);
    if (ids.length !== 1) problems.push(`claim_id_count: ${file}:${index + 1} (${ids.length})`);
    for (const c of cits) {
      const n = sourceLines(c.path);
      if (n < 0) problems.push(`invalid_citation: ${file}:${index + 1} missing ${c.path}`);
      else if (c.end > n) problems.push(`invalid_citation: ${file}:${index + 1} ${c.path}:${c.start}-${c.end} > ${n} lines`);
      if (c.path.includes("genproto")) problems.push(`excluded_path_cited: ${file}:${index + 1} ${c.path}`);
    }
  });
}

const dupClm = [...new Set(clmIds.filter((id, i) => clmIds.indexOf(id) !== i))];
if (dupClm.length) problems.push(`duplicate_claim_ids: ${dupClm.join(", ")}`);

const all = [...bodies.values()].join("\n");
const defs = [...all.matchAll(/^\s*(?:#{1,6}\s+|[-*]\s+(?:\*\*)?)((?:BR|API|DM|TC|RSK|UV)-[A-Za-z0-9_-]+)\b/gm)].map((m) => m[1]);
const counts = new Map();
for (const id of defs) counts.set(id, (counts.get(id) ?? 0) + 1);
for (const [id, n] of counts) if (n !== 1) problems.push(`invalid_id: duplicate definition ${id} (${n})`);
for (const m of all.matchAll(/Related:\s*([^\n]+)/g))
  for (const id of m[1].match(/(?:BR|API|DM|TC|RSK|UV)-[A-Za-z0-9_-]+/g) ?? [])
    if (!counts.has(id)) problems.push(`invalid_id: dangling ${id}`);
for (const m of all.matchAll(/Related\s+(API|DM|BR|TC|RSK|UV):\s*((?:BR|API|DM|TC|RSK|UV)-[A-Za-z0-9_-]+)/g))
  if (!m[2].startsWith(`${m[1]}-`)) problems.push(`invalid_id: type mismatch ${m[1]} -> ${m[2]}`);

if (!/graph_type:\s*module_dependency/i.test(all)) problems.push("missing graph_type: module_dependency label");
if (!/resolution:\s*syntax/i.test(all)) problems.push("missing resolution: syntax label");
for (const line of all.split(/\r?\n/))
  if (/\bcall[- ]graph\b/i.test(line) && !/\bnot\b/i.test(line))
    problems.push(`syntax_dependency_as_call_graph: ${line.trim().slice(0, 80)}`);

const surfaces = JSON.parse(readFileSync(`${CASE_DIR}/raw-extractor-output.json`, "utf8"));
const covered = [];
for (const s of surfaces) {
  const heading = [...all.matchAll(/^#{1,6}\s+((?:API|DM|BR|TC|RSK)-[A-Za-z0-9_-]+)\b([\s\S]*?)(?=^#{1,6}\s+|(?![\s\S]))/gm)]
    .find((m) => m[1].startsWith(`${s.expected_document_type}-`) && m[2].includes(`\`${s.found_at}\``));
  if (heading) covered.push({ surface: s.surface, found_at: s.found_at, expected_document_type: s.expected_document_type, document_id: heading[1] });
  else problems.push(`uncovered_surface: ${s.category} ${s.surface} @ ${s.found_at}`);
}

console.log(`=== ${caseId} pre-check ===`);
console.log(`  citations line-by-line: ${perLineCitations} | as the gate counts them: ${gateCitations}${perLineCitations !== gateCitations ? "  <-- fenced-block undercount, see FINDING-gate-citation-undercount.md" : ""}`);
console.log(`  CLM ids: ${clmIds.length} (unique ${new Set(clmIds).size}) | typed ids defined: ${defs.length} (unique ${counts.size})`);
console.log(`  detector surfaces: ${surfaces.length} | matched to a typed heading: ${covered.length}`);
console.log(`  PROBLEMS: ${problems.length}`);
for (const p of problems) console.log(`   - ${p}`);
if (covered.length === surfaces.length) {
  console.log("  coverage mapping (for the Coverage Sentinel to verify independently):");
  for (const c of covered) console.log(`   ${c.document_id} <- ${c.surface} @ ${c.found_at}`);
}
process.exit(problems.length === 0 ? 0 : 1);
