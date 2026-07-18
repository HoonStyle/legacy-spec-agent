import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractDataModel, extractProjectMeta, extractChangelog } from "../src/extractors.js";
import { erdChart } from "../src/charts.js";

function git(root: string, ...args: string[]): string {
  return execFileSync(
    "git",
    ["-C", root, "-c", "user.email=t@example.com", "-c", "user.name=t", ...args],
    { encoding: "utf8" },
  ).trim();
}

// --- data model ---

test("extractDataModel: entities, typed fields, and a List[] relation", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-dm-"));
  try {
    writeFileSync(
      join(root, "models.py"),
      [
        "from dataclasses import dataclass, field",
        "from typing import List, Optional",
        "",
        "@dataclass",
        "class Condition:",
        "    field: str",
        "    operator: str",
        "",
        "@dataclass",
        "class Rule:",
        "    name: str",
        "    conditions: List[Condition] = field(default_factory=list)",
        "    parent: Optional['Rule'] = None",
        "",
        "def helper():",       // a function is not an entity
        "    x: int = 1",
        "    return x",
        "",
      ].join("\n"),
    );
    const dm = extractDataModel(root);
    const names = dm.entities.map((e) => e.name).sort();
    assert.deepEqual(names, ["Condition", "Rule"]);

    const rule = dm.entities.find((e) => e.name === "Rule")!;
    const byName = Object.fromEntries(rule.fields.map((f) => [f.name, f]));
    assert.equal(byName["name"].type, "str");
    assert.equal(byName["conditions"].type, "List[Condition]");
    assert.ok(byName["parent"].optional);

    // Rule has many Condition; self-reference (parent: Rule) is not emitted
    assert.equal(dm.relations.length, 1);
    assert.deepEqual(dm.relations[0], { from: "Rule", to: "Condition", field: "conditions", cardinality: "many" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("extractDataModel: limit truncates entities and reports it", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-dm-lim-"));
  try {
    writeFileSync(
      join(root, "m.py"),
      ["@dataclass", "class A:", "    x: int", "@dataclass", "class B:", "    y: int", "@dataclass", "class C:", "    z: int", ""].join("\n"),
    );
    const dm = extractDataModel(root, { limit: 2 });
    assert.equal(dm.total_entities, 3);
    assert.equal(dm.entities.length, 2);
    assert.deepEqual(dm.truncated, { returned: 2, total: 3, omitted: 1 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("erdChart: sanitizes bracketed types into valid erDiagram tokens", () => {
  const c = erdChart({
    entities: [{ name: "Rule", fields: [{ name: "conditions", type: "List[Condition]" }] }],
    relations: [{ from: "Rule", to: "Condition", field: "conditions", cardinality: "many" }],
  });
  assert.equal(c.format, "mermaid");
  assert.ok(c.content.startsWith("erDiagram"));
  assert.ok(c.content.includes("List_Condition conditions"));
  assert.ok(c.content.includes("Rule ||--o{ Condition : conditions"));
  assert.ok(!/\[|\]/.test(c.content)); // no raw brackets that would break the parser
});

// --- project meta ---

test("extractProjectMeta: manifest facts, run commands, env surface", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-pm-"));
  try {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "demo", version: "2.1.0", description: "d", dependencies: { zod: "^3" }, scripts: { build: "tsc", test: "node" } }),
    );
    writeFileSync(join(root, "app.py"), "import os\nKEY = os.environ.get('API_KEY')\nDB = os.getenv('DB_URL')\n");
    writeFileSync(join(root, "app.ts"), "export const token = process.env.API_TOKEN;\n");
    mkdirSync(join(root, "test"));
    writeFileSync(
      join(root, "test", "server.test.ts"),
      [
        'import test from "node:test";',
        "const gated = { skip: !process.env.HOOKIFY_ROOT ? 'HOOKIFY_ROOT not set' : false };",
        "const multilineGated = {",
        "  skip: !process.env.HOOKIFY_ROOT ? 'HOOKIFY_ROOT not set' : false,",
        "};",
        'test("lists tools", () => {});',
        "test(",
        '  "multi-line call",',
        "  () => {},",
        ");",
        'test.skip("disabled integration", () => {});',
        'test("hookify acceptance", gated, () => {});',
        'test("multiline gated", multilineGated, () => {});',
        'test("skip word in name is still active", () => {});',
        'test("body call without semicolon", () => {',
        "  helper();",
        "})",
        "",
      ].join("\n"),
    );
    writeFileSync(join(root, "test", "integration.ts"), 'import { it } from "node:test";\nit("root test directory file", () => {});\n');
    writeFileSync(
      join(root, "test", "test_models.py"),
      [
        "import os",
        "import pytest",
        "",
        "@pytest.mark.skipif(",
        "    not os.getenv('PY_FIXTURE_ROOT'),",
        "    reason='PY_FIXTURE_ROOT not set',",
        ")",
        "def test_extracts_model():",
        "    assert True",
        "def helper_with_skip_word():",
        "    return 'skip but not a decorator'",
        "def test_ungated_python_case():",
        "    assert True",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(root, "test", "test_units.py"),
      [
        "import unittest",
        "",
        "class DemoTest(unittest.TestCase):",
        "    def test_unittest_case(self):",
        "        self.assertTrue(True)",
        "",
      ].join("\n"),
    );
    writeFileSync(join(root, "README.md"), "# demo\n");
    const pm = extractProjectMeta(root);
    assert.equal(pm.name, "demo");
    assert.equal(pm.version, "2.1.0");
    assert.ok(pm.dependencies.includes("zod"));
    assert.ok(pm.run_commands.includes("npm run build"));
    assert.deepEqual(pm.env_vars.map((e) => e.key), ["API_KEY", "API_TOKEN", "DB_URL"]);
    assert.equal(pm.env_vars[0].path, "app.py");
    assert.ok(pm.has.readme);
    assert.ok(pm.has.tests);
    assert.equal(pm.tests.total_files, 4);
    assert.equal(pm.tests.total_cases, 11);
    assert.deepEqual(pm.tests.files.map((f) => f.path), ["test/integration.ts", "test/server.test.ts", "test/test_models.py", "test/test_units.py"]);
    assert.equal(pm.tests.files[0].framework, "node:test");
    assert.deepEqual(pm.tests.files[0].cases.map((c) => c.name), ["root test directory file"]);
    assert.equal(pm.tests.files[1].framework, "node:test");
    assert.deepEqual(pm.tests.files[1].cases.map((c) => c.name), [
      "lists tools",
      "multi-line call",
      "disabled integration",
      "hookify acceptance",
      "multiline gated",
      "skip word in name is still active",
      "body call without semicolon",
    ]);
    assert.equal(pm.tests.files[1].cases[2].skipped, true);
    assert.equal(pm.tests.files[1].cases[3].skipped, true);
    assert.deepEqual(pm.tests.files[1].cases[3].requires_env_vars, ["HOOKIFY_ROOT"]);
    assert.equal(pm.tests.files[1].cases[4].skipped, true);
    assert.deepEqual(pm.tests.files[1].cases[4].requires_env_vars, ["HOOKIFY_ROOT"]);
    assert.equal(pm.tests.files[1].cases[5].skipped, false);
    assert.equal(pm.tests.files[1].cases[6].skipped, false);
    assert.equal(pm.tests.skipped_cases, 4);
    assert.deepEqual(pm.tests.files[1].env_vars.map((e) => e.key), ["HOOKIFY_ROOT"]);
    assert.equal(pm.tests.files[2].framework, "pytest");
    assert.deepEqual(pm.tests.files[2].cases.map((c) => c.name), ["test_extracts_model", "test_ungated_python_case"]);
    assert.equal(pm.tests.files[2].cases[0].skipped, true);
    assert.deepEqual(pm.tests.files[2].cases[0].requires_env_vars, ["PY_FIXTURE_ROOT"]);
    assert.equal(pm.tests.files[2].cases[1].skipped, false);
    assert.deepEqual(pm.tests.files[2].env_vars.map((e) => e.key), ["PY_FIXTURE_ROOT"]);
    assert.equal(pm.tests.files[3].framework, "unittest");
    assert.ok(!pm.has.dockerfile);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- changelog ---

test("extractChangelog: groups conventional commits, scopes to the root", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-cl-"));
  try {
    git(root, "init", "-q");
    mkdirSync(join(root, "sub"));
    writeFileSync(join(root, "sub", "a.txt"), "1");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "feat(core): add a");
    writeFileSync(join(root, "sub", "a.txt"), "2");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "fix: correct a");
    writeFileSync(join(root, "sub", "a.txt"), "3");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "just a plain message");

    const cl = extractChangelog(root);
    assert.equal(cl.count, 3);
    assert.ok(cl.grouped["feat"][0].includes("**core**"));
    assert.ok(cl.grouped["fix"].includes("correct a"));
    assert.ok(cl.grouped["other"].includes("just a plain message"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("extractChangelog: non-git root throws a clear error", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-cl-nogit-"));
  try {
    assert.throws(() => extractChangelog(root), /cannot read git history/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- hookify acceptance (HOOKIFY_ROOT-gated) ---

const HOOKIFY_ROOT = process.env.HOOKIFY_ROOT;
const gated = { skip: !HOOKIFY_ROOT || !existsSync(HOOKIFY_ROOT) ? "HOOKIFY_ROOT not set" : false };

test("hookify: data model recovers Rule/Condition and their relation", gated, () => {
  const dm = extractDataModel(HOOKIFY_ROOT!);
  assert.ok(dm.entities.some((e) => e.name === "Rule"));
  assert.ok(dm.entities.some((e) => e.name === "Condition"));
  const rel = dm.relations.find((r) => r.from === "Rule" && r.to === "Condition");
  assert.ok(rel, "expected Rule → Condition relation");
  assert.equal(rel!.cardinality, "many");
  console.error(`hookify data model: ${dm.entities.length} entities, ${dm.relations.length} relations`);
});

test("hookify: project meta recovers plugin name + CLAUDE_PLUGIN_ROOT env", gated, () => {
  const pm = extractProjectMeta(HOOKIFY_ROOT!);
  assert.equal(pm.name, "hookify");
  assert.ok(pm.language.includes("python"));
  assert.ok(pm.env_vars.some((e) => e.key === "CLAUDE_PLUGIN_ROOT"));
  console.error(`hookify meta: ${pm.name}@${pm.version}, ${pm.env_vars.length} env var(s)`);
});
