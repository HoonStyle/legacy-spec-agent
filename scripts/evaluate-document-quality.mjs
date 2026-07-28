#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function readJsonl(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line, index) => {
    let row;
    try { row = JSON.parse(line); } catch (error) { throw new Error(`${path}:${index + 1}: ${error.message}`); }
    for (const field of ["category", "surface", "found_at", "expected_document_type"])
      if (typeof row[field] !== "string" || !row[field]) throw new Error(`${path}:${index + 1}: missing ${field}`);
    return row;
  });
}
function key(item) { return `${item.category}|${item.surface}|${item.found_at}|${item.expected_document_type}`; }
function unique(rows, label) {
  const map = new Map();
  for (const row of rows) {
    if (label === "gold" && (typeof row.id !== "string" || !row.id || !["critical", "normal"].includes(row.importance) || row.source_citation !== row.found_at))
      throw new Error("gold rows require id, importance, and a source_citation matching found_at");
    const itemKey = key(row);
    if (map.has(itemKey)) throw new Error(`${label} contains duplicate row: ${itemKey}`);
    map.set(itemKey, row);
  }
  return map;
}
function ratio(n, d) { return d === 0 ? null : Math.round((n / d) * 10000) / 10000; }

export function evaluate(gold, actual) {
  const goldMap = unique(gold, "gold");
  const actualMap = unique(actual, "actual");
  const goldRows = [...goldMap.values()];
  const actualRows = [...actualMap.values()];
  const truePositive = actualRows.filter((item) => goldMap.has(key(item))).length;
  const critical = goldRows.filter((item) => item.importance === "critical");
  const criticalFound = critical.filter((item) => actualMap.has(key(item))).length;
  const categories = [...new Set([...goldRows, ...actualRows].map((item) => item.category))].sort();
  return {
    counts: { gold: goldMap.size, actual: actualMap.size, true_positive: truePositive, false_positive: actualMap.size - truePositive, false_negative: goldMap.size - truePositive },
    precision: ratio(truePositive, actualMap.size), recall: ratio(truePositive, goldMap.size),
    critical_recall: ratio(criticalFound, critical.length),
    categories: Object.fromEntries(categories.map((category) => {
      const expected = goldRows.filter((item) => item.category === category);
      const observed = actualRows.filter((item) => item.category === category);
      const tp = observed.filter((item) => goldMap.has(key(item))).length;
      return [category, { precision: ratio(tp, observed.length), recall: ratio(tp, expected.length), gold: expected.length, actual: observed.length }];
    })),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [goldPath, actualPath, outputPath] = process.argv.slice(2);
  if (!goldPath || !actualPath) throw new Error("usage: evaluate-document-quality.mjs GOLD.jsonl ACTUAL.jsonl [OUTPUT.json]");
  const result = evaluate(readJsonl(goldPath), readJsonl(actualPath));
  const body = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) writeFileSync(outputPath, body); else process.stdout.write(body);
}
