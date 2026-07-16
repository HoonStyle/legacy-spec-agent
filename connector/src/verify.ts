import { existsSync, readFileSync, statSync } from "node:fs";
import { findOccurrences, nearestOccurrence, resolveWithinRoot, splitLines } from "./matching.js";

export interface VerifyParams {
  /** Path of the cited file, relative to the connector root. */
  path: string;
  /** 1-based cited line number. */
  line: number;
  /**
   * The code fragment the claim cites. When present, the connector checks it
   * against the cited line and scans for it elsewhere on mismatch (moved
   * candidate). When absent, the mechanical guarantee stops at "location is
   * valid + exact source returned" — semantic claim-vs-code judgment stays
   * with the LLM critic.
   */
  expected_snippet?: string;
  /** The natural-language claim, accepted for audit logging only. */
  claim?: string;
  /** Lines of context around the cited line in actual_source (default 3). */
  context_lines?: number;
}

export type Verdict = "match" | "line_mismatch" | "file_missing" | "content_mismatch";

export interface VerifyResult {
  verdict: Verdict;
  /** Cited line ± context_lines, each line prefixed with its 1-based number. */
  actual_source?: string;
  /** Where the snippet was actually found, when it wasn't at the cited line. */
  suggested_line?: number;
  /** Total lines in the file — returned on line_mismatch so callers see the valid range. */
  line_count?: number;
}

function sliceWithNumbers(lines: string[], line: number, ctx: number): string {
  const start = Math.max(0, line - 1 - ctx);
  const end = Math.min(lines.length, line + ctx);
  const width = String(end).length;
  return lines
    .slice(start, end)
    .map((text, i) => `${String(start + i + 1).padStart(width)} | ${text}`)
    .join("\n");
}

export function verifyCitation(root: string, params: VerifyParams): VerifyResult {
  const fileAbs = resolveWithinRoot(root, params.path);

  if (!existsSync(fileAbs) || !statSync(fileAbs).isFile()) {
    return { verdict: "file_missing" };
  }

  const ctx = params.context_lines ?? 3;
  const lines = splitLines(readFileSync(fileAbs, "utf8"));
  const occurrences = params.expected_snippet
    ? findOccurrences(lines, params.expected_snippet, "contains")
    : undefined;

  if (!Number.isInteger(params.line) || params.line < 1 || params.line > lines.length) {
    const result: VerifyResult = { verdict: "line_mismatch", line_count: lines.length };
    if (occurrences && occurrences.length > 0) {
      const found = nearestOccurrence(occurrences, params.line);
      result.suggested_line = found.start;
      result.actual_source = sliceWithNumbers(lines, found.start, ctx);
    }
    return result;
  }

  const actual_source = sliceWithNumbers(lines, params.line, ctx);

  if (!occurrences) {
    return { verdict: "match", actual_source };
  }

  if (occurrences.some((o) => params.line >= o.start && params.line <= o.end)) {
    return { verdict: "match", actual_source };
  }
  if (occurrences.length > 0) {
    return {
      verdict: "content_mismatch",
      actual_source,
      suggested_line: nearestOccurrence(occurrences, params.line).start,
    };
  }
  return { verdict: "content_mismatch", actual_source };
}
