import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { extractCoverageSurface, includedSourceFiles } from "../src/coverage-surface.js";

test("coverage inventory honors exclusions, casing, module formats, env accessors, and symlinks", () => {
  const root = mkdtempSync(join(tmpdir(), "coverage-inventory-"));
  const outside = mkdtempSync(join(tmpdir(), "coverage-outside-"));
  try {
    mkdirSync(join(root, "src"), { recursive: true });
    mkdirSync(join(root, "excluded", "nested"), { recursive: true });
    writeFileSync(join(root, "src", "node.MJS"), "const a = process.env.NODE_ENV;\n");
    writeFileSync(join(root, "src", "common.cjs"), "const b = process.env.CJS_ENV;\n");
    writeFileSync(join(root, "src", "python.py"), "value = os.getenv('PY_ENV')\n");
    writeFileSync(join(root, "src", "go.go"), "value := os.Getenv(\"GO_ENV\")\n");
    writeFileSync(join(root, "src", "App.java"), "var value = System.getenv(\"JAVA_ENV\");\n");
    writeFileSync(join(root, "excluded", "nested", "hidden.ts"), "export const hidden = true;\n");
    writeFileSync(join(outside, "escape.ts"), "export const escape = true;\n");
    symlinkSync(join(outside, "escape.ts"), join(root, "src", "escape.ts"));

    const exclusions = [{ path: "excluded", reason: "fixture exclusion" }, { path: "src/node.MJS:1", reason: "line exclusion" }];
    const files = includedSourceFiles(root, ["src", "excluded"], exclusions);
    assert.ok(files.some((file) => file.endsWith("node.MJS")), "line exclusions keep the file in the inventory");
    assert.ok(files.some((file) => file.endsWith("common.cjs")));
    assert.ok(!files.some((file) => file.includes("hidden.ts")));
    assert.ok(!files.some((file) => file.includes("escape.ts")));

    const surfaces = extractCoverageSurface(root, ["src", "excluded"], exclusions).map((item) => item.surface);
    for (const name of ["NODE_ENV", "CJS_ENV", "PY_ENV", "GO_ENV", "JAVA_ENV"])
      assert.ok(surfaces.includes(`environment:${name}`), name);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
