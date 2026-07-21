import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { indexSymbols, buildCallGraph } from "../src/indexer.js";

function withProject(fn: (root: string) => void) {
  const tmp = mkdtempSync(join(tmpdir(), "lsc-index-"));
  // The project root needs a python-identifier basename: the fixture writes a
  // package-qualified self-import (`from <rootname>.core... import`), and a
  // hyphenated name would be a syntax error the Python grammar refuses to parse.
  const root = join(tmp, "myproj");
  try {
    mkdirSync(join(root, "core"), { recursive: true });
    mkdirSync(join(root, "hooks"));
    writeFileSync(
      join(root, "core", "config_loader.py"),
      [
        "import os",
        "from typing import List",
        "",
        "class Rule:",
        "    def check(self, value):",
        "        return True",
        "",
        "def load_rules():",
        "    return []",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(root, "core", "rule_engine.py"),
      [
        // package-qualified self-import: the root's own package name must be stripped
        `from ${basename(root)}.core.config_loader import Rule`,
        "import collections.abc",                    // stdlib — must stay external even though abc.py exists locally
        "",
        "@lru_cache(maxsize=8)",
        "def evaluate(rules):",
        "    if rules:",
        "        def inner():",
        "            pass",
        "    return None",
        "",
      ].join("\n"),
    );
    writeFileSync(join(root, "abc.py"), "def decoy():\n    pass\n"); // bait for stdlib misresolution
    writeFileSync(join(root, "hooks", "util.py"), "def go():\n    pass\n");
    writeFileSync(
      join(root, "hooks", "stop.py"),
      ["import json", "from .util import go", "", "def main():", "    go()", ""].join("\n"),
    );
    writeFileSync(join(root, "README.md"), "# not python\n");
    fn(root);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

test("indexSymbols: functions, methods, classes with lines and signatures", () => {
  withProject((root) => {
    const idx = indexSymbols(root);
    assert.equal(idx.files, 5);
    assert.equal(idx.unsupported_files, 1); // README.md counted, not silently dropped

    const loader = idx.modules.find((m) => m.path === "core/config_loader.py")!;
    const byName = Object.fromEntries(loader.symbols.map((s) => [s.name, s]));
    assert.equal(byName["Rule"].kind, "class");
    assert.equal(byName["Rule.check"].kind, "method");
    assert.equal(byName["Rule.check"].signature, "def check(self, value)");
    assert.equal(byName["load_rules"].kind, "function");
    assert.equal(byName["load_rules"].line, 8);

    // decorated + nested functions are still found
    const engine = idx.modules.find((m) => m.path === "core/rule_engine.py")!;
    const names = engine.symbols.map((s) => s.name);
    assert.ok(names.includes("evaluate"));
    assert.ok(names.includes("inner"));
  });
});

test("indexSymbols: subdir restriction and escape guard", () => {
  withProject((root) => {
    const idx = indexSymbols(root, { subdir: "hooks" });
    assert.deepEqual(idx.modules.map((m) => m.path).sort(), ["hooks/stop.py", "hooks/util.py"]);
    assert.throws(() => indexSymbols(root, { subdir: "../.." }), /escapes/);
  });
});

test("indexSymbols: limit truncates whole modules and reports it (no silent cap)", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-idx-lim-"));
  try {
    writeFileSync(join(root, "a.py"), "def a1():\n    pass\ndef a2():\n    pass\n");
    writeFileSync(join(root, "b.py"), "def b1():\n    pass\ndef b2():\n    pass\n");
    writeFileSync(join(root, "c.py"), "def c1():\n    pass\ndef c2():\n    pass\n");
    const idx = indexSymbols(root, { limit: 2 });
    assert.equal(idx.total_symbols, 6);
    assert.equal(idx.modules.length, 1); // a.py only (2 symbols hits the cap)
    assert.deepEqual(idx.truncated, { returned: 2, total: 6, omitted: 4 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("indexSymbols: package granularity returns counts, not symbol bodies", () => {
  withProject((root) => {
    const idx = indexSymbols(root, { granularity: "package" });
    assert.equal(idx.granularity, "package");
    assert.deepEqual(idx.modules, []);
    const pkgs = Object.fromEntries(idx.packages!.map((p) => [p.package, p]));
    assert.ok(pkgs["core"].symbols > 0);
    assert.ok(pkgs["hooks"].files >= 2);
    assert.equal(idx.total_symbols, idx.packages!.reduce((n, p) => n + p.symbols, 0));
  });
});

test("buildCallGraph: package granularity collapses file edges with weight", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-pkg-"));
  try {
    mkdirSync(join(root, "a"));
    mkdirSync(join(root, "b"));
    writeFileSync(join(root, "b", "y.py"), "Z = 1\nW = 2\n");
    writeFileSync(join(root, "a", "x1.py"), "from b.y import Z\n");
    writeFileSync(join(root, "a", "x2.py"), "from b.y import W\n"); // 2nd a→b file edge
    const g = buildCallGraph(root, { granularity: "package" });
    assert.equal(g.graph_type, "module_dependency");
    assert.equal(g.resolution, "syntax");
    assert.equal(g.resolved, 2);
    assert.equal(g.unresolved, 0);
    assert.equal(g.granularity, "package");
    assert.deepEqual(g.edges, [{ from: "a", to: "b", weight: 2 }]);
    assert.ok(g.packages!.includes("a") && g.packages!.includes("b"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("buildCallGraph: contract counts unresolved relationships per importer", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-contract-"));
  try {
    writeFileSync(join(root, "target.py"), "VALUE = 1\n");
    writeFileSync(join(root, "a.py"), "from target import VALUE\nimport external_lib\n");
    writeFileSync(join(root, "b.py"), "import external_lib\n");
    const graph = buildCallGraph(root);
    assert.deepEqual(
      { graph_type: graph.graph_type, resolution: graph.resolution, resolved: graph.resolved, unresolved: graph.unresolved },
      { graph_type: "module_dependency", resolution: "syntax", resolved: 1, unresolved: 2 },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("buildCallGraph: limit truncates file edges and reports it", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-cg-lim-"));
  try {
    writeFileSync(join(root, "t.py"), "T = 1\n");
    for (const n of ["a", "b", "c"]) writeFileSync(join(root, `${n}.py`), "from t import T\n");
    const g = buildCallGraph(root, { limit: 2 });
    assert.equal(g.edges.length, 2);
    assert.deepEqual(g.truncated, { returned: 2, total: 3, omitted: 1 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("buildCallGraph: from package import submodule resolves the imported file", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-cg-submodule-"));
  try {
    mkdirSync(join(root, "pkg"));
    writeFileSync(join(root, "pkg", "util.py"), "VALUE = 1\n");
    writeFileSync(join(root, "pkg", "extra.py"), "VALUE = 2\n");
    writeFileSync(join(root, "pkg", "__init__.py"), "ROOT = 1\n");
    writeFileSync(join(root, "main.py"), "from pkg import (util, extra as renamed)\n");

    const g = buildCallGraph(root);
    assert.deepEqual(g.edges, [
      { from: "main.py", to: "pkg/extra.py", import: "pkg.extra", line: 1 },
      { from: "main.py", to: "pkg/util.py", import: "pkg.util", line: 1 },
    ]);
    assert.ok(!g.externals.some((e) => e.module === "pkg"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("buildCallGraph: comments inside multiline imports do not hide submodules", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-cg-comments-"));
  try {
    mkdirSync(join(root, "pkg"));
    writeFileSync(join(root, "pkg", "util.py"), "VALUE = 1\n");
    writeFileSync(join(root, "pkg", "extra.py"), "VALUE = 2\n");
    writeFileSync(
      join(root, "main.py"),
      ["from pkg import (", "    util,  # primary helper", "    extra as renamed,", ")", ""].join("\n"),
    );

    const g = buildCallGraph(root);
    assert.deepEqual(g.edges, [
      { from: "main.py", to: "pkg/extra.py", import: "pkg.extra", line: 1 },
      { from: "main.py", to: "pkg/util.py", import: "pkg.util", line: 1 },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("buildCallGraph: namespace package submodule imports are internal", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-cg-namespace-"));
  try {
    mkdirSync(join(root, "pkg"));
    writeFileSync(join(root, "pkg", "util.py"), "VALUE = 1\n");
    writeFileSync(join(root, "main.py"), "from pkg import util\n");

    const g = buildCallGraph(root);
    assert.deepEqual(g.edges, [{ from: "main.py", to: "pkg/util.py", import: "pkg.util", line: 1 }]);
    assert.deepEqual(g.externals, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("buildCallGraph: package-qualified, relative, and external imports", () => {
  withProject((root) => {
    const graph = buildCallGraph(root);

    const edgeKeys = graph.edges.map((e) => `${e.from}→${e.to}`);
    // <rootname>.core.config_loader resolved by stripping the root's own package name
    assert.ok(edgeKeys.includes("core/rule_engine.py→core/config_loader.py"), edgeKeys.join(", "));
    // relative import
    assert.ok(edgeKeys.includes("hooks/stop.py→hooks/util.py"));
    // stdlib `import collections.abc` must NOT resolve to the local abc.py decoy
    assert.ok(!edgeKeys.includes("core/rule_engine.py→abc.py"), edgeKeys.join(", "));

    const externalNames = graph.externals.map((e) => e.module);
    assert.ok(externalNames.includes("json"));
    assert.ok(externalNames.includes("os"));
    assert.ok(externalNames.includes("typing"));
    assert.ok(externalNames.includes("collections")); // kept external despite the decoy
    // internal modules never appear as externals
    assert.ok(!externalNames.includes(basename(root)));

    const json = graph.externals.find((e) => e.module === "json")!;
    assert.deepEqual(json.imported_by, ["hooks/stop.py"]);
  });
});

// ---------------------------------------------------------------------------
// C2 acceptance against the real hookify demo target (HOOKIFY_ROOT-gated)
// ---------------------------------------------------------------------------

const HOOKIFY_ROOT = process.env.HOOKIFY_ROOT;
const gated = { skip: !HOOKIFY_ROOT || !existsSync(HOOKIFY_ROOT) ? "HOOKIFY_ROOT not set" : false };

test("hookify: symbol index locates the audit-log symbols", gated, () => {
  const idx = indexSymbols(HOOKIFY_ROOT!);
  const engine = idx.modules.find((m) => m.path === "core/rule_engine.py")!;
  const compileRegex = engine.symbols.find((s) => s.name === "compile_regex")!;
  // audit entry re-ignorecase cites core/rule_engine.py:14 — the decorated def
  // starts at the decorator (13) or def line; the symbol must span line 14.
  assert.ok(compileRegex.line <= 15 && compileRegex.end_line >= 14, `line=${compileRegex.line}`);
  assert.ok(engine.symbols.some((s) => s.kind === "class" && s.name === "RuleEngine"));

  const loader = idx.modules.find((m) => m.path === "core/config_loader.py")!;
  assert.ok(loader.symbols.some((s) => s.name === "load_rules"));
  console.error(
    `hookify index: ${idx.files} files, ${idx.modules.reduce((n, m) => n + m.symbols.length, 0)} symbols`,
  );
});

test("hookify: call graph resolves package-qualified internal imports", gated, () => {
  const graph = buildCallGraph(HOOKIFY_ROOT!);
  const edgeKeys = graph.edges.map((e) => `${e.from}→${e.to}`);
  // rule_engine does `from hookify.core.config_loader import Rule, Condition`
  assert.ok(edgeKeys.includes("core/rule_engine.py→core/config_loader.py"), edgeKeys.join(", "));
  // every hook imports both core modules (inside main(), package-qualified)
  assert.ok(edgeKeys.includes("hooks/stop.py→core/config_loader.py"));
  assert.ok(edgeKeys.includes("hooks/stop.py→core/rule_engine.py"));

  const externalNames = graph.externals.map((e) => e.module);
  assert.ok(externalNames.includes("re"));
  assert.ok(!externalNames.includes("hookify"));
  console.error(`hookify graph: ${graph.edges.length} internal edges, ${graph.externals.length} externals`);
});

test("hookify: package-granularity call graph collapses to hooks → core", gated, () => {
  const g = buildCallGraph(HOOKIFY_ROOT!, { granularity: "package" });
  assert.equal(g.granularity, "package");
  // 4 hook files each import 2 core modules → one hooks→core edge, weight 8
  assert.deepEqual(g.edges, [{ from: "hooks", to: "core", weight: 8 }]);
  assert.ok(g.packages!.includes("core") && g.packages!.includes("hooks"));
  console.error(`hookify package graph: ${g.edges.map((e) => `${e.from}→${e.to}(w${e.weight})`).join(", ")}`);
});
