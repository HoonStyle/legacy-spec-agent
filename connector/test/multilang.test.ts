import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
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

test("multilang TypeScript resolves a workspace package export map", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsexports-"));
  mkdirSync(join(root, "packages", "ui"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/*"] }));
  writeFileSync(join(root, "packages", "ui", "package.json"), JSON.stringify({ name: "@org/ui", exports: { ".": "./index.ts" } }));
  writeFileSync(join(root, "packages", "ui", "index.ts"), "export const Button = 1;\n");
  writeFileSync(join(root, "app.ts"), "import { Button } from '@org/ui';\nexport const app = Button;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "app.ts" && edge.to === "packages/ui/index.ts"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript keeps a non-workspace package.json external", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsfixture-"));
  // A fixture package named like a real dependency must not shadow it: with no
  // workspace config connecting it, `react` stays external, not an internal edge.
  mkdirSync(join(root, "fixtures", "react"), { recursive: true });
  writeFileSync(join(root, "fixtures", "react", "package.json"), JSON.stringify({ name: "react", main: "./index.ts" }));
  writeFileSync(join(root, "fixtures", "react", "index.ts"), "export const React = 1;\n");
  writeFileSync(join(root, "app.ts"), "import { React } from 'react';\nexport const app = React;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.equal(result.edges.length, 0);
    assert.ok(result.externals.some((item) => item.module === "react"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript inherits baseUrl from an extends target file", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsextends-"));
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "tsconfig.base.json"), JSON.stringify({ compilerOptions: { baseUrl: "src" } }));
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ extends: "./tsconfig.base.json" }));
  writeFileSync(join(root, "src", "a.ts"), "import { b } from 'b';\nexport const a = b;\n");
  writeFileSync(join(root, "src", "b.ts"), "export const b = 1;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "src/a.ts" && edge.to === "src/b.ts"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript survives a package with exports:null", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsnullexp-"));
  mkdirSync(join(root, "packages", "blocked"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/*"] }));
  writeFileSync(join(root, "packages", "blocked", "package.json"), JSON.stringify({ name: "@org/blocked", exports: null }));
  writeFileSync(join(root, "packages", "blocked", "index.ts"), "export const x = 1;\n");
  writeFileSync(join(root, "app.ts"), "import { x } from '@org/blocked';\nexport const a = x;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.equal(result.edges.length, 0);
    assert.ok(result.externals.some((item) => item.module === "@org/blocked"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript honours export encapsulation for undeclared subpaths", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsencap-"));
  mkdirSync(join(root, "packages", "ui"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/*"] }));
  // Only "." is exported; a deep import of an existing private file must stay external.
  writeFileSync(join(root, "packages", "ui", "package.json"), JSON.stringify({ name: "@org/ui", exports: { ".": "./index.ts" } }));
  writeFileSync(join(root, "packages", "ui", "index.ts"), "export const Button = 1;\n");
  writeFileSync(join(root, "packages", "ui", "private.ts"), "export const secret = 1;\n");
  writeFileSync(join(root, "app.ts"), "import { secret } from '@org/ui/private';\nexport const a = secret;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.equal(result.edges.length, 0);
    assert.ok(result.externals.some((item) => item.module === "@org/ui/private"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript prefers the .ts source over a sibling .js for a .js import", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsjsprefer-"));
  writeFileSync(join(root, "a.ts"), "import { b } from './mod.js';\nexport const a = b;\n");
  writeFileSync(join(root, "mod.ts"), "export const b = 1;\n");
  writeFileSync(join(root, "mod.js"), "export const b = 2;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "a.ts" && edge.to === "mod.ts"));
    assert.ok(!result.edges.some((edge) => edge.from === "a.ts" && edge.to === "mod.js"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript gives an exact paths key precedence over a wildcard", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsexact-"));
  mkdirSync(join(root, "exact"), { recursive: true });
  mkdirSync(join(root, "wild"), { recursive: true });
  // Both patterns match "foo/bar" and both targets exist; the exact key, though
  // declared after the wildcard, must win.
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "foo/*": ["wild/*.ts"], "foo/bar": ["exact/bar.ts"] } } }));
  writeFileSync(join(root, "a.ts"), "import { b } from 'foo/bar';\nexport const a = b;\n");
  writeFileSync(join(root, "exact", "bar.ts"), "export const b = 1;\n");
  writeFileSync(join(root, "wild", "bar.ts"), "export const b = 2;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "a.ts" && edge.to === "exact/bar.ts"));
    assert.ok(!result.edges.some((edge) => edge.to === "wild/bar.ts"));
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

test("multilang TypeScript resolves a package with a root conditional exports object", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tscondexp-"));
  mkdirSync(join(root, "packages", "ui"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/*"] }));
  // exports is a bare condition map with no subpath keys — the "." target is the object itself.
  writeFileSync(join(root, "packages", "ui", "package.json"), JSON.stringify({ name: "@org/ui", exports: { import: "./index.ts", default: "./index.js" } }));
  writeFileSync(join(root, "packages", "ui", "index.ts"), "export const Button = 1;\n");
  writeFileSync(join(root, "app.ts"), "import { Button } from '@org/ui';\nexport const app = Button;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "app.ts" && edge.to === "packages/ui/index.ts"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript excludes a negated workspace package", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsneg-"));
  mkdirSync(join(root, "packages", "ui"), { recursive: true });
  mkdirSync(join(root, "packages", "private"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/*", "!packages/private"] }));
  writeFileSync(join(root, "packages", "ui", "package.json"), JSON.stringify({ name: "@org/ui", main: "./index.ts" }));
  writeFileSync(join(root, "packages", "ui", "index.ts"), "export const Button = 1;\n");
  writeFileSync(join(root, "packages", "private", "package.json"), JSON.stringify({ name: "@org/private", main: "./index.ts" }));
  writeFileSync(join(root, "packages", "private", "index.ts"), "export const secret = 1;\n");
  writeFileSync(join(root, "app.ts"), "import { Button } from '@org/ui';\nimport { secret } from '@org/private';\nexport const a = Button + secret;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.to === "packages/ui/index.ts"));
    assert.ok(!result.edges.some((edge) => edge.to === "packages/private/index.ts"));
    assert.ok(result.externals.some((item) => item.module === "@org/private"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript reads pnpm workspace globs with inline comments and globstar", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tspnpm-"));
  mkdirSync(join(root, "packages", "ui"), { recursive: true });
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - 'packages/**/ui' # ui packages\n");
  writeFileSync(join(root, "packages", "ui", "package.json"), JSON.stringify({ name: "@org/ui", main: "./index.ts" }));
  writeFileSync(join(root, "packages", "ui", "index.ts"), "export const Button = 1;\n");
  writeFileSync(join(root, "app.ts"), "import { Button } from '@org/ui';\nexport const app = Button;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "app.ts" && edge.to === "packages/ui/index.ts"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript normalizes a leading ./ in workspace globs", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsdotslash-"));
  mkdirSync(join(root, "packages", "ui"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", workspaces: ["./packages/*"] }));
  writeFileSync(join(root, "packages", "ui", "package.json"), JSON.stringify({ name: "@org/ui", main: "./index.ts" }));
  writeFileSync(join(root, "packages", "ui", "index.ts"), "export const Button = 1;\n");
  writeFileSync(join(root, "app.ts"), "import { Button } from '@org/ui';\nexport const app = Button;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "app.ts" && edge.to === "packages/ui/index.ts"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript expands brace alternatives in workspace globs", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tsbrace-"));
  mkdirSync(join(root, "packages", "client", "ui"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/{client,server}/*"] }));
  writeFileSync(join(root, "packages", "client", "ui", "package.json"), JSON.stringify({ name: "@org/ui", main: "./index.ts" }));
  writeFileSync(join(root, "packages", "client", "ui", "index.ts"), "export const Button = 1;\n");
  writeFileSync(join(root, "app.ts"), "import { Button } from '@org/ui';\nexport const app = Button;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.from === "app.ts" && edge.to === "packages/client/ui/index.ts"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("multilang TypeScript picks conditional exports in declaration order", async () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-tscondorder-"));
  mkdirSync(join(root, "packages", "ui"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/*"] }));
  // "default" is declared before "import"; declaration order must select it.
  writeFileSync(join(root, "packages", "ui", "package.json"), JSON.stringify({ name: "@org/ui", exports: { default: "./default.ts", import: "./import.ts" } }));
  writeFileSync(join(root, "packages", "ui", "default.ts"), "export const Button = 1;\n");
  writeFileSync(join(root, "packages", "ui", "import.ts"), "export const Button = 2;\n");
  writeFileSync(join(root, "app.ts"), "import { Button } from '@org/ui';\nexport const app = Button;\n");
  try {
    const result = await buildCallGraphMulti(root);
    assert.ok(result.edges.some((edge) => edge.to === "packages/ui/default.ts"));
    assert.ok(!result.edges.some((edge) => edge.to === "packages/ui/import.ts"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("ts-resolve source is tracked as text (no NUL bytes)", () => {
  // A NUL byte makes git treat the whole resolver as binary, hiding it from
  // diffs and search; keep any glob/regex sentinel as an escaped literal.
  assert.equal(readFileSync("src/ts-resolve.ts").includes(0x00), false);
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
