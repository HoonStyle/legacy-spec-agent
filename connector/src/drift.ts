import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { findOccurrences, nearestOccurrence, normalize, resolveWithinRoot, splitLines } from "./matching.js";

export interface Citation {
  id?: string;
  path: string; // relative to the connector root
  line: number; // 1-based, as cited in the baseline SPEC
}

/**
 * "error" is deliberately its own class: a citation whose baseline cannot be
 * read (not a git repo, bad ref, file absent at ref) is UNRESOLVED, not
 * drifted — conflating the two produced false 100%-drift reports.
 */
export type DriftVerdict = "intact" | "moved" | "drifted" | "orphaned" | "error";

export interface DriftEntry {
  id?: string;
  path: string;
  line: number;
  verdict: DriftVerdict;
  /** Where the baseline content lives now (moved only). */
  new_line?: number;
  /** The cited line's content at baseline_ref. */
  baseline_source?: string;
  /** The current content at the cited line (drifted only, for the report diff). */
  current_source?: string;
  /** Why the citation could not be resolved (error verdict only). */
  error?: string;
}

export interface DriftResult {
  baseline_ref: string;
  summary: { intact: number; moved: number; drifted: number; orphaned: number; error: number };
  results: DriftEntry[];
}

/** How far the probe may widen around the cited line hunting for uniqueness. */
const MAX_RADIUS = 5;

interface GitContext {
  prefix: string;
  /** baseline file cache — one `git show` per file per detectDrift call. */
  blobs: Map<string, string[] | { error: string }>;
}

function gitPrefix(rootAbs: string): string | { error: string } {
  try {
    return execFileSync("git", ["-C", rootAbs, "rev-parse", "--show-prefix"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return { error: "connector root is not inside a git repository" };
  }
}

function baselineLines(rootAbs: string, ref: string, relPath: string, ctx: GitContext): string[] | { error: string } {
  const cached = ctx.blobs.get(relPath);
  if (cached) return cached;
  const gitPath = ctx.prefix.length > 0 ? `${ctx.prefix}${relPath}` : relPath;
  let result: string[] | { error: string };
  try {
    const content = execFileSync("git", ["-C", rootAbs, "show", `${ref}:${gitPath}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
    result = splitLines(content);
  } catch (e) {
    result = { error: `cannot read ${gitPath} at ${ref}: ${(e as Error).message.split("\n")[0]}` };
  }
  ctx.blobs.set(relPath, result);
  return result;
}

/**
 * Build the drift probe for a citation: start from the cited line and widen
 * symmetrically until the probe is UNIQUE in the baseline file (or MAX_RADIUS
 * is reached). Uniqueness — not line length — is what makes a probe reliable:
 * `return None` needs context not because it is short but because it is
 * everywhere.
 *
 * Returns the probe text plus `delta`: the offset from the probe's first
 * non-blank line to the cited line, used to recover the cited line's position
 * from an occurrence in the current file.
 */
function buildProbe(baseline: string[], line: number): { probe: string; delta: number } | undefined {
  for (let radius = 0; radius <= MAX_RADIUS; radius++) {
    const start = Math.max(1, line - radius);
    const end = Math.min(baseline.length, line + radius);
    const window = baseline.slice(start - 1, end);
    const probe = window.join("\n");
    const firstNonBlankIdx = window.findIndex((l) => normalize(l).length > 0);
    if (firstNonBlankIdx === -1) continue; // all-blank window — widen
    const hits = findOccurrences(baseline, probe, "exact");
    if (hits.length === 1) {
      return { probe, delta: line - (start + firstNonBlankIdx) };
    }
    if (radius === MAX_RADIUS) {
      // Never became unique — proceed with the widest probe; the positional
      // intact check below still prevents wrong-position false intacts.
      return { probe, delta: line - (start + firstNonBlankIdx) };
    }
  }
  return undefined; // the whole neighborhood is blank
}

function classify(rootAbs: string, ref: string, citation: Citation, ctx: GitContext): DriftEntry {
  const base: DriftEntry = { id: citation.id, path: citation.path, line: citation.line, verdict: "error" };

  let fileAbs: string;
  try {
    fileAbs = resolveWithinRoot(rootAbs, citation.path);
  } catch (e) {
    // A malformed path is one bad citation, never a reason to lose the batch.
    return { ...base, error: (e as Error).message };
  }

  const baseline = baselineLines(rootAbs, ref, citation.path, ctx);
  if (!Array.isArray(baseline)) {
    return { ...base, error: baseline.error };
  }
  const baseLines = baseline;
  if (citation.line < 1 || citation.line > baseLines.length) {
    return { ...base, error: `cited line not in baseline file (1..${baseLines.length})` };
  }

  base.baseline_source = baseLines[citation.line - 1];

  if (!existsSync(fileAbs) || !statSync(fileAbs).isFile()) {
    return { ...base, verdict: "orphaned" };
  }
  const current = splitLines(readFileSync(fileAbs, "utf8"));

  const built = buildProbe(baseLines, citation.line);
  if (!built) {
    // Cited line and its whole neighborhood are blank — nothing to anchor on.
    const stillBlank = citation.line <= current.length && normalize(current[citation.line - 1]).length === 0;
    return { ...base, verdict: stillBlank ? "intact" : "drifted" };
  }

  const hits = findOccurrences(current, built.probe, "exact");
  if (hits.length === 0) {
    return {
      ...base,
      verdict: "drifted",
      current_source: citation.line <= current.length ? current[citation.line - 1] : undefined,
    };
  }

  // Intact requires the cited line to sit at its original position — a probe
  // found only elsewhere means the citation is stale even if the code lives on.
  const expectedStart = citation.line - built.delta;
  if (hits.some((o) => o.start === expectedStart)) {
    return { ...base, verdict: "intact" };
  }
  return { ...base, verdict: "moved", new_line: nearestOccurrence(hits, expectedStart).start + built.delta };
}

export function detectDrift(
  root: string,
  params: { baseline_ref: string; citations: Citation[] },
): DriftResult {
  const rootAbs = resolve(root);
  const prefix = gitPrefix(rootAbs);

  let results: DriftEntry[];
  if (typeof prefix !== "string") {
    // Not a git repo: every citation is unresolved — report errors, not drift.
    results = params.citations.map((c) => ({
      id: c.id,
      path: c.path,
      line: c.line,
      verdict: "error" as const,
      error: prefix.error,
    }));
  } else {
    const ctx: GitContext = { prefix, blobs: new Map() };
    results = params.citations.map((c) => classify(rootAbs, params.baseline_ref, c, ctx));
  }

  const summary = { intact: 0, moved: 0, drifted: 0, orphaned: 0, error: 0 };
  for (const r of results) summary[r.verdict]++;
  return { baseline_ref: params.baseline_ref, summary, results };
}
