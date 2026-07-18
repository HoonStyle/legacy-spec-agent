import { existsSync, readFileSync, statSync } from "node:fs";
import { resolveWithinRoot, splitLines } from "./matching.js";

const CITATION_RE = /^([\w./\\-]+\.(?:py|ts|js|jsx|tsx|md|json|jsonl|sh|mjs)):(\d+)(?:-(\d+))?$/;

export interface CitationRange {
  path: string;
  start: number;
  end: number;
}

export type CitationCheck =
  | { verdict: "valid"; line_count: number }
  | { verdict: "file_missing" }
  | { verdict: "line_mismatch"; line_count: number };

export function parseCitation(input: string): CitationRange | undefined {
  const m = CITATION_RE.exec(input.trim());
  if (!m) return undefined;
  const start = Number(m[2]);
  const end = m[3] ? Number(m[3]) : start;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) return undefined;
  return { path: normalizeCitationPath(m[1]), start, end };
}

export function isCitation(input: string): boolean {
  return parseCitation(input) !== undefined;
}

export function formatCitation(citation: CitationRange): string {
  const path = normalizeCitationPath(citation.path);
  return citation.start === citation.end
    ? `${path}:${citation.start}`
    : `${path}:${citation.start}-${citation.end}`;
}

export function normalizeCitationPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
}

export function citationsOverlap(a: CitationRange, b: CitationRange): boolean {
  return normalizeCitationPath(a.path) === normalizeCitationPath(b.path)
    && a.start <= b.end
    && b.start <= a.end;
}

export class CitationLineCache {
  private counts = new Map<string, CitationCheck>();

  check(root: string, citation: CitationRange): CitationCheck {
    const key = `${root}\0${normalizeCitationPath(citation.path)}`;
    let cached = this.counts.get(key);
    if (!cached) {
      cached = this.readLineCount(root, citation.path);
      this.counts.set(key, cached);
    }
    if (cached.verdict !== "valid") return cached;
    return citation.start <= cached.line_count && citation.end <= cached.line_count
      ? cached
      : { verdict: "line_mismatch", line_count: cached.line_count };
  }

  private readLineCount(root: string, path: string): CitationCheck {
    try {
      const file = resolveWithinRoot(root, path);
      if (!existsSync(file) || !statSync(file).isFile()) return { verdict: "file_missing" };
      return { verdict: "valid", line_count: splitLines(readFileSync(file, "utf8")).length };
    } catch {
      return { verdict: "file_missing" };
    }
  }
}
