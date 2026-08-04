import { existsSync, readFileSync, statSync } from "node:fs";
import { resolveWithinRoot, splitLines } from "./matching.js";

const CITATION_RE = /^([\w./\\-]+\.(?:py|ts|js|jsx|tsx|md|json|jsonl|sh|mjs|cjs|java|cs|go)):(\d+)(?:-(\d+))?$/;

export interface CitationRange {
  path: string;
  start: number;
  end: number;
}

export interface MarkdownCitation {
  citation: CitationRange;
  line: string;
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

/** Extract inline source citations while ignoring Markdown fenced code blocks. */
export function citationsInMarkdown(markdown: string): MarkdownCitation[] {
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
