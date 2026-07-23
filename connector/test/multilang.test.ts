import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearMultiLanguageCache, indexSymbolsMulti, buildCallGraphMulti, extractDataModelMulti } from "../src/multilang.js";

test("multilang WASM parsers index Python, TypeScript, Java, C#, and Go", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-multilang-"));
  writeFileSync(join(root, "app.py"), "class PyThing:\n    def run(self):\n        pass\n");
  writeFileSync(join(root, "app.ts"), "export class TsThing { run(): void {} }\n");
  writeFileSync(join(root, "view.jsx"), "export class JsxThing { render() { return <section />; } }\n");
  writeFileSync(join(root, "App.java"), "class JavaThing { void run() {} }\n");
  writeFileSync(join(root, "App.cs"), "class CsThing { public string Name { get; set; } void Run() {} }\n");
  writeFileSync(join(root, "app.go"), "package app\ntype GoThing struct { Name string }\nfunc Run() {}\n");
  writeFileSync(join(root, "legacy.rb"), "class RubyThing; end\n");
  writeFileSync(join(root, "mobile.dart"), "class DartThing {}\n");
  writeFileSync(join(root, "component.vue"), "<template><div /></template>\n");
  writeFileSync(join(root, "library.dll"), "not source code\n");
  try {
    const result = await indexSymbolsMulti(root);
    assert.equal(result.files, 6); assert.equal(result.unsupported_files, 3);
    const names = result.modules.flatMap((module) => module.symbols.map((symbol) => symbol.name));
    for (const expected of ["PyThing", "TsThing", "JsxThing", "JavaThing", "CsThing", "GoThing", "Run"]) assert.ok(names.some((name) => name === expected || name.endsWith(`.${expected}`)), expected);
    assert.ok(!names.includes("CsThing.Name"), "C# properties must not be mislabeled as methods");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang dependency graph resolves relative TypeScript imports", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-multigraph-"));
  writeFileSync(join(root, "a.ts"), "import { b } from './b'; export const a = b;\n");
  writeFileSync(join(root, "b.ts"), "export const b = 1;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "a.ts" && edge.to === "b.ts"));
    assert.deepEqual(
      { graph_type: result.graph_type, resolution: result.resolution, resolved: result.resolved, unresolved: result.unresolved },
      { graph_type: "module_dependency", resolution: "syntax", resolved: 1, unresolved: 0 },
    );
  }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript resolves a baseUrl-relative bare import", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsbase-"));
  mkdirSync(join(root, "src", "utils"), { recursive: true });
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: "src" } }));
  writeFileSync(join(root, "src", "a.ts"), "import { b } from 'utils/b';\nexport const a = b;\n");
  writeFileSync(join(root, "src", "utils", "b.ts"), "export const b = 1;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "src/a.ts" && edge.to === "src/utils/b.ts"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript resolves a tsconfig paths alias", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tspaths-"));
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@app/*": ["src/*"] } } }));
  writeFileSync(join(root, "a.ts"), "import { b } from '@app/b';\nexport const a = b;\n");
  writeFileSync(join(root, "src", "b.ts"), "export const b = 1;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "a.ts" && edge.to === "src/b.ts"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript rewrites a .js specifier to its .ts source", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsjsext-"));
  writeFileSync(join(root, "a.ts"), "import { b } from './b.js';\nexport const a = b;\n");
  writeFileSync(join(root, "b.ts"), "export const b = 1;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "a.ts" && edge.to === "b.ts"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript honours the nearest project's tsconfig, not the root", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsnested-"));
  mkdirSync(join(root, "packages", "app", "src", "lib"), { recursive: true });
  // Root tsconfig has no baseUrl: if it governed, the bare import stays external.
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({}));
  writeFileSync(join(root, "packages", "app", "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: "src" } }));
  writeFileSync(join(root, "packages", "app", "src", "main.ts"), "import { helper } from 'lib/helper';\nexport const main = helper;\n");
  writeFileSync(join(root, "packages", "app", "src", "lib", "helper.ts"), "export const helper = 1;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "packages/app/src/main.ts" && edge.to === "packages/app/src/lib/helper.ts"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript resolves a local package export map", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsexports-"));
  mkdirSync(join(root, "packages", "ui"), { recursive: true });
  writeFileSync(join(root, "packages", "ui", "package.json"), JSON.stringify({ name: "@org/ui", exports: { ".": "./index.ts" } }));
  writeFileSync(join(root, "packages", "ui", "index.ts"), "export const Button = 1;\n");
  writeFileSync(join(root, "app.ts"), "import { Button } from '@org/ui';\nexport const app = Button;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "app.ts" && edge.to === "packages/ui/index.ts"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript leaves an unconfigured bare import unresolved", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsbare-"));
  // No tsconfig baseUrl/paths and no matching package: a bare specifier must not
  // be guessed onto a same-named file.
  writeFileSync(join(root, "a.ts"), "import { thing } from 'thing';\nexport const a = thing;\n");
  writeFileSync(join(root, "thing.ts"), "export const thing = 1;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.equal(result.edges.length, 0);
    assert.deepEqual(result.externals, [{ module: "thing", imported_by: ["a.ts"] }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript survives a malformed tsconfig paths entry", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsbadpaths-"));
  // `paths` value is a string, not the required array: the analysis must not
  // abort — the relative edge still resolves and the bad alias stays external.
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@x/*": "src/*" } } }));
  writeFileSync(join(root, "a.ts"), "import { b } from './b';\nimport { z } from '@x/z';\nexport const a = b + z;\n");
  writeFileSync(join(root, "b.ts"), "export const b = 1;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "a.ts" && edge.to === "b.ts"));
    assert.ok(result.externals.some((item) => item.module === "@x/z"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang dependency graph emits each grouped Go import once", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-multigo-"));
  for (const dir of ["a", "b", "c"]) mkdirSync(join(root, dir));
  writeFileSync(join(root, "go.mod"), "module example.com/acme\n");
  writeFileSync(join(root, "a", "a.go"), 'package a\nimport (\n "example.com/acme/b"\n "example.com/acme/c"\n)\n');
  writeFileSync(join(root, "b", "b.go"), "package b\n");
  writeFileSync(join(root, "c", "c.go"), "package c\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.deepEqual(result.edges.map((edge) => edge.import), ["example.com/acme/b", "example.com/acme/c"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang dependency graph does not resolve an external import by filename alone", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-multiexternal-"));
  mkdirSync(join(root, "log"));
  writeFileSync(join(root, "go.mod"), "module example.com/acme\n");
  writeFileSync(join(root, "app.go"), 'package app\nimport "github.com/other/log"\n');
  writeFileSync(join(root, "log", "log.go"), "package log\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.equal(result.edges.length, 0);
    assert.deepEqual(result.externals, [{ module: "github.com/other/log", imported_by: ["app.go"] }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang data model extracts typed C#, TypeScript, Java, and Go fields", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-multimodel-"));
  writeFileSync(join(root, "Models.cs"), "class Team { public List<User> Users { get; set; } }\nclass User { public string Name { get; set; } }\n");
  writeFileSync(join(root, "Model.ts"), "class Project { owner: User; }\n");
  writeFileSync(join(root, "Model.java"), "class Account { String id; }\n");
  writeFileSync(join(root, "model.go"), "package model\ntype Item struct { Name string }\n");
  try {
    const result = await extractDataModelMulti(root);
    assert.deepEqual(result.entities.map((entity) => entity.name).sort(), ["Account", "Item", "Project", "Team", "User"]);
    assert.deepEqual(result.entities.find((entity) => entity.name === "Item")!.fields.map((field) => field.name), ["Name"]);
    assert.ok(result.relations.some((relation) => relation.from === "Team" && relation.to === "User" && relation.cardinality === "many"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang parser rejects a subdirectory symlink that escapes the root", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-multiroot-"));
  const outside = mkdtempSync(join(tmpdir(), "lsc-multioutside-"));
  writeFileSync(join(outside, "hidden.cs"), "class Hidden {}\n");
  symlinkSync(outside, join(root, "escape"), "dir");
  try {
    await assert.rejects(indexSymbolsMulti(root, { subdir: "escape" }), /escapes connector root through symlink/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("multilang parse cache invalidates after a source file changes", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-multicache-"));
  const source = join(root, "Model.cs");
  try {
    writeFileSync(source, "class Before {}\n");
    const cold = await indexSymbolsMulti(root);
    assert.equal(cold.modules[0]?.symbols[0]?.name, "Before");
    assert.deepEqual([cold.analysis_metrics.wasm_cache_hits, cold.analysis_metrics.wasm_cache_misses], [0, 1]);
    assert.equal(cold.analysis_metrics.source_bytes, Buffer.byteLength("class Before {}\n"));
    assert.ok(cold.analysis_metrics.structured_response_bytes > 0);
    const warm = await indexSymbolsMulti(root);
    assert.deepEqual([warm.analysis_metrics.wasm_cache_hits, warm.analysis_metrics.wasm_cache_misses], [1, 0]);
    writeFileSync(source, "class LongerAfter {}\n");
    const changed = await indexSymbolsMulti(root);
    assert.equal(changed.modules[0]?.symbols[0]?.name, "LongerAfter");
    assert.deepEqual([changed.analysis_metrics.wasm_cache_hits, changed.analysis_metrics.wasm_cache_misses], [0, 1]);
  } finally {
    clearMultiLanguageCache();
    rmSync(root, { recursive: true, force: true });
  }
});
