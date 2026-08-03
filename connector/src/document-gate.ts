import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { CitationLineCache, formatCitation, parseCitation, type CitationRange } from "./citations.js";
import { extractCoverageSurface, includedSourceFiles } from "./coverage-surface.js";

export type DocumentProfile = "core" | "standard";
export type DocumentGateReasonCode =
  | "missing_document" | "missing_section" | "citation_audit_incomplete"
  | "unsupported_verified_claim" | "invalid_id" | "coverage_failed"
  | "undisclosed_truncation" | "syntax_dependency_as_call_graph"
  | "invalid_provenance" | "invalid_citation" | "invalid_manifest" | "invalid_audit_log"
  | "claim_audit_incomplete";

export interface ScopeManifest {
  analyzed_source_commit: string;
  included_paths: string[];
  excluded_paths: Array<{ path: string; reason: string }>;
  file_counts: { supported: number; unsupported: number; failed: number; skipped: number };
  truncated: boolean;
  truncated_inputs: Array<{ source: string; returned: number; total: number; omitted: number }>;
  module_extractors: Array<{ module: string; actor_id: string }>;
  writer_actor_id: string;
  draft_digest: string;
}

export interface CoverageItem {
  surface: string;
  found_at: string;
  expected_document_type: "API" | "DM" | "BR" | "TC" | "RSK";
}

function coverageKey(item: CoverageItem): string {
  return `${item.surface}|${item.found_at}|${item.expected_document_type}`;
}

export interface CoverageAudit {
  expected_count: number;
  documented_count: number;
  covered_items: Array<CoverageItem & { document_id: string }>;
  explained_omissions: Array<CoverageItem & { reason: string }>;
  unexplained_omissions: CoverageItem[];
  truncated_inputs: Array<{ source: string; returned: number; total: number; omitted: number }>;
  verdict: "passed" | "failed";
  actor_id: string;
  draft_digest: string;
}

export interface EvidenceAudit {
  verdict: "passed" | "failed";
  actor_id: string;
  draft_digest: string;
}

export interface DocumentGateParams {
  root: string;
  source_root: string;
  dir: string;
  profile: DocumentProfile;
  scope_manifest: ScopeManifest;
  evidence_audit: EvidenceAudit;
  coverage_audit: CoverageAudit;
  gatekeeper_actor_id: string;
}

export interface DocumentGateReason { code: DocumentGateReasonCode; detail: string }
export interface DocumentGateResult {
  verdict: "approved" | "rejected";
  citation_count: number;
  audited_citation_count: number;
  reasons: DocumentGateReason[];
}

const truncationSchema = z.object({ source: z.string().min(1), returned: z.number().int().nonnegative(), total: z.number().int().nonnegative(), omitted: z.number().int().nonnegative() })
  .strict()
  .refine((item) => item.returned + item.omitted === item.total, "returned + omitted must equal total");
export const scopeManifestSchema = z.object({
  analyzed_source_commit: z.string().min(1), included_paths: z.array(z.string().min(1)).min(1),
  excluded_paths: z.array(z.object({ path: z.string().min(1), reason: z.string().trim().min(1) }).strict()),
  file_counts: z.object({ supported: z.number().int().nonnegative(), unsupported: z.number().int().nonnegative(), failed: z.number().int().nonnegative(), skipped: z.number().int().nonnegative() }).strict(),
  truncated: z.boolean(), truncated_inputs: z.array(truncationSchema),
  module_extractors: z.array(z.object({ module: z.string().min(1), actor_id: z.string().min(1) }).strict()).min(1),
  writer_actor_id: z.string().min(1), draft_digest: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().superRefine((value, ctx) => {
  if (value.truncated !== (value.truncated_inputs.length > 0)) ctx.addIssue({ code: "custom", message: "truncated must match truncated_inputs" });
  const modules = value.module_extractors.map((item) => item.module.replaceAll("\\", "/"));
  if (new Set(modules).size !== modules.length) ctx.addIssue({ code: "custom", message: "module extractor assignments must be unique" });
  const includedModules = new Set(value.included_paths.map((path) => path.replace(/:\d+(?:-\d+)?$/, "").replaceAll("\\", "/")));
  for (const module of includedModules) if (!modules.includes(module)) ctx.addIssue({ code: "custom", message: `included module lacks Extractor assignment: ${module}` });
  for (const module of modules) if (!includedModules.has(module)) ctx.addIssue({ code: "custom", message: `Extractor assignment does not match a frozen included path: ${module}` });
});
const coverageItemSchema = z.object({ surface: z.string().min(1), found_at: z.string().min(1), expected_document_type: z.enum(["API", "DM", "BR", "TC", "RSK"]) }).strict();
export const coverageAuditSchema = z.object({
  expected_count: z.number().int().nonnegative(), documented_count: z.number().int().nonnegative(),
  covered_items: z.array(coverageItemSchema.extend({ document_id: z.string().min(1) })),
  explained_omissions: z.array(coverageItemSchema.extend({ reason: z.string() })),
  unexplained_omissions: z.array(coverageItemSchema), truncated_inputs: z.array(truncationSchema),
  verdict: z.enum(["passed", "failed"]), actor_id: z.string().min(1), draft_digest: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const evidenceAuditSchema = z.object({ verdict: z.enum(["passed", "failed"]), actor_id: z.string().min(1), draft_digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

const REQUIRED: Record<DocumentProfile, string[]> = {
  core: ["SPEC.md", "ARCHITECTURE.md", "audit_log.jsonl"],
  standard: ["SPEC.md", "ARCHITECTURE.md", "INTERFACES.md", "DATA_MODEL.md", "ONBOARDING.md", "TESTCASES.md", "RISKS.md", "audit_log.jsonl"],
};
const REQUIRED_SECTIONS: Record<string, string[]> = {
  "SPEC.md": ["System purpose and boundary", "Actors and entrypoints", "Core use cases", "Business rules", "Validation and error behavior", "State transitions", "Configuration", "Persistence and side effects", "Operational behavior", "Known limitations", "Unverified / Needs-review"],
  "ARCHITECTURE.md": ["System context", "Component inventory", "Runtime and deployment", "Module dependency", "External systems and data stores", "Major execution flows", "Trust boundaries", "Analysis limitations"],
  "INTERFACES.md": ["Interfaces"], "DATA_MODEL.md": ["Data model"], "ONBOARDING.md": ["Onboarding"],
  "TESTCASES.md": ["Existing automated tests", "Source-derived characterization scenarios", "External-contract test candidates"],
  "RISKS.md": ["Confirmed behavior", "Defect candidates", "Unverified gaps"],
};

export function calculateDraftDigest(dir: string, profile: DocumentProfile): string {
  const hash = createHash("sha256");
  for (const file of REQUIRED[profile].filter((name) => name.endsWith(".md")).sort()) {
    hash.update(file).update("\0");
    const content = existsSync(join(dir, file)) ? readFileSync(join(dir, file), "utf8").replace(/\r\n/g, "\n") : "<missing>";
    hash.update(content);
    hash.update("\0");
  }
  return hash.digest("hex");
}

interface MarkdownCitation {
  citation: CitationRange;
  line: string;
}

function citationsIn(markdown: string): MarkdownCitation[] {
  const citations: MarkdownCitation[] = [];
  let fence: { delimiter: "`" | "~"; length: number } | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    if (fence) {
      const closing = /^ {0,3}([`~]+)[ \t]*$/.exec(line);
      if (closing && closing[1][0] === fence.delimiter && closing[1].length >= fence.length) fence = undefined;
      continue;
    }

    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (opening && (opening[1][0] === "~" || !opening[2].includes("`"))) {
      fence = { delimiter: opening[1][0] as "`" | "~", length: opening[1].length };
      continue;
    }

    for (const match of line.matchAll(/`([^`\r\n]+)`/g)) {
      const citation = parseCitation(match[1]);
      if (citation) citations.push({ citation, line });
    }
  }
  return citations;
}

interface AuditLog {
  rows: Array<{ evidence?: string; action?: string; claim?: string; claim_id?: string; document?: string }>;
  malformed_lines: number[];
}

function readJsonLines(path: string): AuditLog {
  const log: AuditLog = { rows: [], malformed_lines: [] };
  if (!existsSync(path)) return log;
  readFileSync(path, "utf8").split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const row = JSON.parse(line);
      if (!row || typeof row !== "object" || typeof row.action !== "string" || ((row.action === "verified" || row.action === "flagged") && typeof row.evidence !== "string"))
        throw new Error("invalid audit row schema");
      log.rows.push(row);
    } catch {
      log.malformed_lines.push(index + 1);
    }
  });
  return log;
}

function resolveGitHead(sourceRoot: string): string | undefined {
  try {
    const headPath = join(sourceRoot, ".git", "HEAD");
    if (!existsSync(headPath)) return undefined;
    const head = readFileSync(headPath, "utf8").trim();
    const refMatch = /^ref:\s*(.+)$/.exec(head);
    if (!refMatch) return /^[0-9a-f]{40,64}$/i.test(head) ? head.toLowerCase() : undefined;
    const ref = refMatch[1].trim();
    if (ref.includes("..")) return undefined;
    const refPath = join(sourceRoot, ".git", ...ref.split("/"));
    if (existsSync(refPath)) return readFileSync(refPath, "utf8").trim().toLowerCase();
    const packedPath = join(sourceRoot, ".git", "packed-refs");
    if (!existsSync(packedPath)) return undefined;
    for (const line of readFileSync(packedPath, "utf8").split(/\r?\n/)) {
      const packed = /^([0-9a-f]{40,64})\s+(.+)$/.exec(line.trim());
      if (packed && packed[2] === ref) return packed[1].toLowerCase();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function evaluateDocumentGate(params: DocumentGateParams): DocumentGateResult {
  const reasons: DocumentGateReason[] = [];
  const markdown = new Map<string, string>();
  for (const file of REQUIRED[params.profile]) {
    const path = join(params.dir, file);
    if (!existsSync(path)) reasons.push({ code: "missing_document", detail: file });
    else if (file.endsWith(".md")) markdown.set(file, readFileSync(path, "utf8"));
  }
  for (const [file, sections] of Object.entries(REQUIRED_SECTIONS)) {
    const body = markdown.get(file);
    if (!body) continue;
    for (const section of sections) if (!new RegExp(`^#+\\s+${section}\\s*$`, "im").test(body))
      reasons.push({ code: "missing_section", detail: `${file}: ${section}` });
  }

  const markdownCitations = [...markdown.values()].flatMap(citationsIn);
  const citations = markdownCitations.map(({ citation }) => citation);
  const lineCache = new CitationLineCache();
  for (const citation of citations) {
    const check = lineCache.check(params.source_root, citation);
    if (check.verdict !== "valid") reasons.push({ code: "invalid_citation", detail: `${citation.path}:${citation.start}-${citation.end} ${check.verdict}` });
  }
  const audit = readJsonLines(join(params.dir, "audit_log.jsonl"));
  if (audit.malformed_lines.length > 0)
    reasons.push({ code: "invalid_audit_log", detail: `malformed audit_log.jsonl line(s): ${audit.malformed_lines.join(", ")}` });
  const remainingAudit = new Map<string, number>();
  for (const row of audit.rows) {
    if (row.action !== "verified") continue;
    const parsed = row.evidence && parseCitation(row.evidence);
    if (parsed) remainingAudit.set(formatCitation(parsed), (remainingAudit.get(formatCitation(parsed)) ?? 0) + 1);
  }
  let audited = 0;
  for (const citation of citations) {
    const key = formatCitation(citation);
    const remaining = remainingAudit.get(key) ?? 0;
    if (remaining > 0) { audited++; remainingAudit.set(key, remaining - 1); }
  }
  if (citations.length === 0 || audited !== citations.length)
    reasons.push({ code: "citation_audit_incomplete", detail: `${audited}/${citations.length}` });
  if (audit.rows.some((row) => row.action === "flagged"))
    reasons.push({ code: "unsupported_verified_claim", detail: "audit contains a flagged claim" });

  const allMarkdown = [...markdown.values()].join("\n");
  const citedClaimLines = markdownCitations.map(({ line }) => line).filter((line, index, lines) => lines.indexOf(line) === index);
  const claimDefinitions = citedClaimLines.flatMap((line) => Array.from(line.matchAll(/\b(CLM-[A-Za-z0-9_-]+)\b/g), (match) => match[1]));
  const auditedClaims = audit.rows.filter((row) => row.action === "verified" && row.claim_id).map((row) => row.claim_id!);
  if (citedClaimLines.some((line) => Array.from(line.matchAll(/\bCLM-[A-Za-z0-9_-]+\b/g)).length !== 1)) {
    reasons.push({ code: "claim_audit_incomplete", detail: "every cited factual line must declare exactly one CLM-* ID" });
  } else if (claimDefinitions.length > 0) {
    const claimCounts = new Map<string, number>();
    for (const id of claimDefinitions) claimCounts.set(id, (claimCounts.get(id) ?? 0) + 1);
    const auditCounts = new Map<string, number>();
    for (const id of auditedClaims) auditCounts.set(id, (auditCounts.get(id) ?? 0) + 1);
    const invalid = [...claimCounts].some(([id, count]) => count !== 1 || auditCounts.get(id) !== 1)
      || [...auditCounts].some(([id]) => !claimCounts.has(id));
    if (invalid) reasons.push({ code: "claim_audit_incomplete", detail: "claim IDs and verified audit rows must match one-to-one" });
    const mismatchedEvidence = citedClaimLines.some((line) => {
      const claimId = /\b(CLM-[A-Za-z0-9_-]+)\b/.exec(line)?.[1];
      if (!claimId) return false;
      const expected = citationsIn(line).map(({ citation }) => formatCitation(citation)).sort();
      const recorded = audit.rows.filter((row) => row.action === "verified" && row.claim_id === claimId)
        .flatMap((row) => row.evidence && parseCitation(row.evidence) ? [formatCitation(parseCitation(row.evidence)!)] : []).sort();
      return expected.length !== recorded.length || expected.some((value, index) => value !== recorded[index]);
    });
    if (mismatchedEvidence) reasons.push({ code: "claim_audit_incomplete", detail: "claim audit evidence must match the citations on that claim line" });
  } else if (auditedClaims.length > 0) {
    reasons.push({ code: "claim_audit_incomplete", detail: "audit references claim IDs absent from the draft" });
  }
  const definitions = Array.from(allMarkdown.matchAll(/^\s*(?:#{1,6}\s+|[-*]\s+(?:\*\*)?)((?:BR|API|DM|TC|RSK|UV)-[A-Za-z0-9_-]+)\b/gm), (m) => m[1]);
  const counts = new Map<string, number>();
  for (const id of definitions) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, count] of counts) if (count !== 1) reasons.push({ code: "invalid_id", detail: `duplicate ${id}` });
  for (const match of allMarkdown.matchAll(/Related:\s*([^\n]+)/g)) {
    for (const id of match[1].match(/(?:BR|API|DM|TC|RSK|UV)-[A-Za-z0-9_-]+/g) ?? []) {
      if (!counts.has(id)) reasons.push({ code: "invalid_id", detail: `dangling ${id}` });
    }
  }
  for (const match of allMarkdown.matchAll(/Related\s+(API|DM|BR|TC|RSK|UV):\s*((?:BR|API|DM|TC|RSK|UV)-[A-Za-z0-9_-]+)/g))
    if (!match[2].startsWith(`${match[1]}-`)) reasons.push({ code: "invalid_id", detail: `type mismatch ${match[1]} -> ${match[2]}` });

  const coverage = params.coverage_audit;
  const discovered = extractCoverageSurface(params.source_root, params.scope_manifest.included_paths, params.scope_manifest.excluded_paths);
  const discoveredSurface = new Set(discovered.map(coverageKey));
  const auditedSurface = new Set([...coverage.covered_items, ...coverage.explained_omissions, ...coverage.unexplained_omissions].map(coverageKey));
  const missingFromAudit = discovered.filter((item) => !auditedSurface.has(coverageKey(item)));
  const allCoverageItems = [...coverage.covered_items, ...coverage.explained_omissions, ...coverage.unexplained_omissions];
  const itemKeys = allCoverageItems.map(coverageKey);
  const uniqueSurfaces = new Set(itemKeys);
  const phantomAuditItems = allCoverageItems.filter((item) => !discoveredSurface.has(coverageKey(item)));
  const invalidCoveredType = coverage.covered_items.some((item) => !item.document_id.startsWith(`${item.expected_document_type}-`));
  const invalidExplanation = coverage.explained_omissions.some((item) =>
    !item.reason.trim() || !params.scope_manifest.excluded_paths.some((excluded) => excluded.path === item.found_at && excluded.reason.trim()),
  );
  if (coverage.verdict !== "passed" || coverage.unexplained_omissions.length > 0 || coverage.expected_count !== uniqueSurfaces.size || uniqueSurfaces.size !== itemKeys.length || coverage.documented_count !== coverage.covered_items.length || invalidCoveredType || invalidExplanation || missingFromAudit.length > 0 || phantomAuditItems.length > 0)
    reasons.push({ code: "coverage_failed", detail: "coverage audit is failed or internally inconsistent" });
  const danglingCoverageIds = coverage.covered_items.filter((item) => !counts.has(item.document_id));
  if (danglingCoverageIds.length > 0)
    reasons.push({ code: "coverage_failed", detail: `covered surface cites nonexistent document ID(s): ${danglingCoverageIds.map((item) => item.document_id).join(", ")}` });
  const mismatchedCoverageEvidence = coverage.covered_items.filter((item) => {
    const escapedId = item.document_id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const section = new RegExp(`^#{1,6}\\s+${escapedId}\\b([\\s\\S]*?)(?=^#{1,6}\\s+|(?![\\s\\S]))`, "m").exec(allMarkdown)?.[1] ?? "";
    return !section.includes(`\`${item.found_at}\``);
  });
  if (mismatchedCoverageEvidence.length > 0)
    reasons.push({ code: "coverage_failed", detail: `covered surface lacks matching evidence at its document ID: ${mismatchedCoverageEvidence.map((item) => item.document_id).join(", ")}` });

  const declaredTruncationSources = new Set(params.scope_manifest.truncated_inputs.map((item) => item.source));
  const undisclosedCoverageTruncation = coverage.truncated_inputs.filter((item) => !declaredTruncationSources.has(item.source));
  if (undisclosedCoverageTruncation.length > 0)
    reasons.push({ code: "undisclosed_truncation", detail: `coverage truncation source(s) missing from the frozen manifest: ${undisclosedCoverageTruncation.map((item) => item.source).join(", ")}` });
  const syntaxLabelled = /graph_type:\s*module_dependency|resolution:\s*syntax/i.test(allMarkdown);
  const undisclaimedCallGraphLine = allMarkdown.split(/\r?\n/).some((line) => /\bcall[- ]graph\b/i.test(line) && !/\bnot\b/i.test(line));
  if (syntaxLabelled && undisclaimedCallGraphLine)
    reasons.push({ code: "syntax_dependency_as_call_graph", detail: "syntax module dependency is labelled as a call graph without the required negative disclaimer" });

  const { scope_manifest: scope, evidence_audit: evidence } = params;
  const parsedManifest = scopeManifestSchema.safeParse(scope);
  if (!parsedManifest.success || scope.file_counts.supported !== includedSourceFiles(params.source_root, scope.included_paths, scope.excluded_paths).length)
    reasons.push({ code: "invalid_manifest", detail: parsedManifest.success ? "supported file count differs from included source inventory" : parsedManifest.error.issues.map((issue) => issue.message).join("; ") });
  for (const [file, body] of markdown) {
    const declaresAnalyzedCommit = body.split(/\r?\n/).some((line) =>
      /^(?:>\s*)?(?:[*_-]{0,2})(?:Source|Analyzed source|analyzed_source_commit)\b/i.test(line.trim()) && line.includes(scope.analyzed_source_commit),
    );
    if (!declaresAnalyzedCommit)
      reasons.push({ code: "invalid_provenance", detail: `${file} does not declare analyzed_source_commit ${scope.analyzed_source_commit}` });
  }
  const headCommit = resolveGitHead(params.source_root);
  if (headCommit !== undefined && headCommit !== scope.analyzed_source_commit.toLowerCase())
    reasons.push({ code: "invalid_provenance", detail: "analyzed_source_commit does not match the source tree HEAD" });
  const actors = [scope.writer_actor_id, evidence.actor_id, coverage.actor_id, params.gatekeeper_actor_id];
  if (evidence.verdict !== "passed" || actors.some((actor) => !actor) || new Set(actors).size !== actors.length || evidence.draft_digest !== scope.draft_digest || coverage.draft_digest !== scope.draft_digest || calculateDraftDigest(params.dir, params.profile) !== scope.draft_digest)
    reasons.push({ code: "invalid_provenance", detail: "audits are not independent or do not address the frozen draft" });

  return { verdict: reasons.length === 0 ? "approved" : "rejected", citation_count: citations.length, audited_citation_count: audited, reasons };
}
