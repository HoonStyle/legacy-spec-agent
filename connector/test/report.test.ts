import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderReport } from "../src/report.js";

function withDeliverables(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "lsc-report-"));
  try {
    writeFileSync(
      join(root, "SPEC.md"),
      [
        "# demo — Reconstructed Specification",
        "",
        "- **Responsibility**: parses rules  `core/loader.py:12`",
        "",
        "| a | b |",
        "|---|---|",
        "| 1 | 2 |",
        "",
        "```mermaid",
        "flowchart TD",
        "  A --> B",
        "```",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(root, "ARCHITECTURE.md"),
      "# arch\n\n```mermaid\nflowchart TD\n  X --> Y\n```\n",
    );
    writeFileSync(
      join(root, "audit_log.jsonl"),
      [
        `{"id":"a","action":"verified","claim":"c1","evidence":"core/loader.py:12","note":""}`,
        `{"id":"b","action":"flagged","claim":"c2","evidence":"core/loader.py:40","note":"quarantined"}`,
      ].join("\n") + "\n",
    );
    mkdirSync(join(root, "charts"));
    writeFileSync(join(root, "charts", "coverage.svg"), `<svg xmlns="http://www.w3.org/2000/svg"><text>COV</text></svg>`);
    // asset for SPEC.md's first mermaid fence; ARCHITECTURE.md's fence has no asset
    writeFileSync(join(root, "charts", "SPEC.1.svg"), `<svg xmlns="http://www.w3.org/2000/svg"><text>DIAG1</text></svg>`);
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("renderReport: writes a tabbed page with stats, charts, and doc-bound diagrams", () => {
  withDeliverables((root) => {
    const r = renderReport(root, { title: "demo report" });
    assert.ok(r.path.endsWith("REPORT.html"));
    assert.deepEqual(r.tabs, ["Overview", "SPEC", "Architecture", "Quality", "Audit log"]);
    assert.equal(r.charts_embedded, 2); // coverage.svg + SPEC.1.svg
    assert.equal(r.mermaid_fallbacks, 1); // ARCHITECTURE.md fence had no asset

    const html = readFileSync(r.path, "utf8");
    assert.ok(html.includes("<title>demo report</title>"));
    assert.ok(html.includes(">COV<")); // overview chart inlined
    assert.ok(html.includes(">DIAG1<")); // fence replaced by SPEC.1.svg
    assert.ok(html.includes("flowchart TD\n  X --&gt; Y")); // fallback keeps mermaid source
    assert.ok(html.includes(`class="cite"`)); // citation styling applied
    assert.ok(html.includes(`badge verified`) && html.includes(`badge flagged`));
    assert.ok(html.includes("Generated documentation quality"));
    assert.ok(html.includes("audit coverage"));
    // doc-bound asset must not also appear as an overview card
    const diagCount = html.split(">DIAG1<").length - 1;
    assert.equal(diagCount, 1);
  });
});

test("renderReport: deterministic — same inputs, same bytes", () => {
  withDeliverables((root) => {
    renderReport(root);
    const first = readFileSync(join(root, "REPORT.html"), "utf8");
    renderReport(root);
    const second = readFileSync(join(root, "REPORT.html"), "utf8");
    assert.equal(first, second);
  });
});

test("renderReport: empty directory and escaping dir are rejected", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-report-empty-"));
  try {
    assert.throws(() => renderReport(root), /nothing to report/);
    assert.throws(() => renderReport(root, { dir: "../.." }), /escapes/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
