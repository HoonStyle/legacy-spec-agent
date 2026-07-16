/**
 * The single matching engine shared by verify.ts (Mode A) and drift.ts
 * (Mode B). Both tools answer the same underlying question — "where does this
 * code live in this file?" — so they MUST share one implementation; the
 * review that prompted this file reproduced contradictory verdicts (match vs
 * drifted for one citation) from the two divergent engines it replaced.
 *
 * Matching model:
 * - lines are compared whitespace-normalized;
 * - blank lines never participate: the needle's blanks are dropped and the
 *   file is scanned over its non-blank lines, so an interior blank line in
 *   either the needle or the file cannot break a match;
 * - a match may span FEWER file lines than the needle has (window sizes
 *   1..needleLines), which tolerates formatting-only reflows that join lines;
 * - mode "contains": the needle is a fragment (verify's expected_snippet) —
 *   the joined window must contain the joined needle;
 * - mode "exact": the needle is exact source content (drift's baseline
 *   probe) — the joined window must EQUAL the joined needle, so a fragment
 *   of a longer line (`count += 1` inside `total_count += 1`) never matches.
 */

import { resolve, sep } from "node:path";

export function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Split file content into lines, dropping the phantom empty element that
 * String.split leaves after a trailing newline (git show output and virtually
 * every source file end with one). Without this, line = realLines+1 verifies
 * as a valid location.
 */
export function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Resolve a citation path, refusing anything that escapes the root. */
export function resolveWithinRoot(rootAbs: string, relPath: string): string {
  const fileAbs = resolve(rootAbs, relPath);
  if (fileAbs !== rootAbs && !fileAbs.startsWith(rootAbs + sep)) {
    throw new Error(`citation path escapes connector root: ${relPath}`);
  }
  return fileAbs;
}

export interface Occurrence {
  /** 1-based line of the first matched non-blank line. */
  start: number;
  /** 1-based line of the last matched non-blank line. */
  end: number;
}

export function findOccurrences(
  lines: string[],
  needle: string,
  mode: "exact" | "contains",
): Occurrence[] {
  const needleNorm = needle
    .split(/\r?\n/)
    .map(normalize)
    .filter((l) => l.length > 0);
  if (needleNorm.length === 0) return [];
  const target = needleNorm.join(" ");

  const nonBlank: Array<{ line: number; text: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const text = normalize(lines[i]);
    if (text.length > 0) nonBlank.push({ line: i + 1, text });
  }

  const out: Occurrence[] = [];
  const maxWindow = needleNorm.length;
  for (let i = 0; i < nonBlank.length; i++) {
    let joined = "";
    for (let w = 1; w <= maxWindow && i + w <= nonBlank.length; w++) {
      joined = joined.length > 0 ? `${joined} ${nonBlank[i + w - 1].text}` : nonBlank[i + w - 1].text;
      const hit = mode === "exact" ? joined === target : joined.includes(target);
      if (hit) {
        out.push({ start: nonBlank[i].line, end: nonBlank[i + w - 1].line });
        break;
      }
      if (mode === "exact" && joined.length > target.length) break;
    }
  }
  return out;
}

/** The occurrence whose start is closest to the given line. */
export function nearestOccurrence(occurrences: Occurrence[], line: number): Occurrence {
  return occurrences.reduce((best, o) =>
    Math.abs(o.start - line) < Math.abs(best.start - line) ? o : best,
  );
}
