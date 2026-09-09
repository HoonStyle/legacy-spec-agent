import test from "node:test";
import assert from "node:assert/strict";
import { coverageChart, driftChart, benchmarkChart, architectureChart, erdChart, emitChart } from "../src/charts.js";

test("coverageChart: hero %, both segments, counts in legend, alt text", () => {
  const c = coverageChart({ verified: 42, unverified: 7 });
  assert.equal(c.format, "svg");
  assert.ok(c.content.startsWith("<svg"));
  assert.ok(c.content.includes(">86%<")); // 42/49
  assert.ok(c.content.includes("verified · 42"));
  assert.ok(c.content.includes("unverified · 7"));
  assert.ok(c.alt.includes("42 of 49"));
});

test("coverageChart: degenerate cases don't emit broken arcs", () => {
  for (const [v, u] of [[0, 0], [5, 0], [0, 5]] as const) {
    const c = coverageChart({ verified: v, unverified: u });
    assert.ok(c.content.includes("<circle"), `v=${v},u=${u} should render a full ring`);
    assert.ok(!c.content.includes("NaN"));
  }
});

test("driftChart: all four statuses labeled with values", () => {
  const c = driftChart({ intact: 9, moved: 2, drifted: 1, orphaned: 0 });
  for (const label of ["intact", "moved", "drifted", "orphaned"]) {
    assert.ok(c.content.includes(`>${label}<`), label);
  }
  assert.ok(c.alt.includes("drifted 1"));
  assert.ok(!c.content.includes("NaN"));
});

test("benchmarkChart: percent formatting, legend, deterministic output", () => {
  const params = {
    unit: "citation coverage",
    groups: [
      { label: "Eval A", with_skill: 0.86, baseline: 0 },
      { label: "Eval B", with_skill: 0.87, baseline: 0 },
    ],
  };
  const a = benchmarkChart(params);
  const b = benchmarkChart(params);
  assert.equal(a.content, b.content); // same data in, same bytes out
  assert.ok(a.content.includes(">86%<"));
  assert.ok(a.content.includes(">with skill<"));
  assert.ok(a.content.includes(">baseline<"));
  assert.ok(a.alt.includes("Eval B — with skill 87%"));
});

test("architectureChart: mermaid edges and cylinder externals", () => {
  const c = architectureChart({
    edges: [
      { from: "hooks/stop.py", to: "core/config_loader.py" },
      { from: "core/rule_engine.py", to: "core/config_loader.py" },
    ],
    externals: [{ module: "re" }],
  });
  assert.equal(c.format, "mermaid");
  assert.ok(c.content.startsWith("flowchart TD"));
  assert.ok(c.content.includes(`hooks_stop_py["hooks/stop.py"]`));
  assert.ok(c.content.includes("hooks_stop_py --> core_config_loader_py"));
  assert.ok(c.content.includes(`re[("re")]`));
  assert.ok(c.alt.includes("2 internal edges"));
});

test("architectureChart: weight labels and package clustering", () => {
  // package-granularity edges carry weight → labeled arrow
  const pkg = architectureChart({ edges: [{ from: "hooks", to: "core", weight: 8 }] });
  assert.ok(pkg.content.includes("-->|8|"), pkg.content);

  // cluster:true wraps file nodes in subgraph blocks by top-level dir
  const clustered = architectureChart({
    edges: [
      { from: "hooks/stop.py", to: "core/config_loader.py" },
      { from: "core/rule_engine.py", to: "core/config_loader.py" },
    ],
    cluster: true,
  });
  assert.ok(clustered.content.includes('subgraph hooks["hooks"]'), clustered.content);
  assert.ok(clustered.content.includes('subgraph core["core"]'));
  assert.ok(clustered.content.includes("end"));
  // a node is declared once (inside its subgraph), not re-declared on the edge
  const decls = clustered.content.match(/core_config_loader_py\["core\/config_loader\.py"\]/g) ?? [];
  assert.equal(decls.length, 1);
});

test("Unicode architecture and ERD labels remain readable and receive collision-free IDs", () => {
  const architecture = architectureChart({
    edges: [
      { from: "서비스/사용자.ts", to: "서비스/주문.ts" },
      { from: "日本語/利用者.ts", to: "中文/订单.ts" },
    ],
    cluster: true,
  });
  for (const label of ["서비스", "사용자.ts", "주문.ts", "日本語", "利用者.ts", "中文", "订单.ts"])
    assert.ok(architecture.content.includes(label), label);
  const ids = [...architecture.content.matchAll(/\b((?:node|ts)_[a-z0-9]+)\[/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);

  const erd = erdChart({
    entities: [{ name: "사용자", fields: [{ name: "이름", type: "문자열" }] }, { name: "利用者" }],
    relations: [{ from: "사용자", to: "利用者", field: "연결" }],
  });
  assert.ok(erd.content.includes('["사용자"]'));
  assert.ok(erd.content.includes('["利用者"]'));
  assert.ok(erd.content.includes('"문자열 이름"'));
  assert.ok(erd.content.includes(': "연결"'));
  assert.ok(!erd.content.includes("unknown"));
});

test("SVG text preserves Unicode while escaping XML metacharacters", () => {
  const chart = coverageChart({ verified: 1, unverified: 0, title: "검증 & 확인 <완료>" });
  assert.ok(chart.content.includes("검증 &amp; 확인 &lt;완료&gt;"));
  assert.ok(chart.alt.includes("검증 & 확인 <완료>"));
});

test("emitChart dispatcher routes by kind", () => {
  assert.equal(emitChart({ kind: "coverage", verified: 1, unverified: 0 }).format, "svg");
  assert.equal(emitChart({ kind: "architecture", edges: [] }).format, "mermaid");
});
