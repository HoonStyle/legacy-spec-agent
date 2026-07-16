import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyCitation } from "../src/verify.js";

const FIXTURE = [
  "import re",                          // 1
  "",                                   // 2
  "def compile_regex(pattern):",        // 3
  "    return re.compile(pattern)",     // 4
  "",                                   // 5
  "def evaluate(rules):",               // 6
  "    if blocking_rules:",             // 7
  "        return block(rules)",        // 8
  "    return warn(rules)",             // 9
  "# end",                              // 10
].join("\n");

function withFixture(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "lsc-verify-"));
  try {
    writeFileSync(join(root, "sample.py"), FIXTURE);
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("valid location without snippet → match + numbered source", () => {
  withFixture((root) => {
    const r = verifyCitation(root, { path: "sample.py", line: 7 });
    assert.equal(r.verdict, "match");
    assert.ok(r.actual_source?.includes("7 | "));
    assert.ok(r.actual_source?.includes("if blocking_rules:"));
  });
});

test("missing file → file_missing", () => {
  withFixture((root) => {
    const r = verifyCitation(root, { path: "nope.py", line: 1 });
    assert.equal(r.verdict, "file_missing");
  });
});

test("line out of range → line_mismatch with line_count", () => {
  withFixture((root) => {
    const r = verifyCitation(root, { path: "sample.py", line: 999 });
    assert.equal(r.verdict, "line_mismatch");
    assert.equal(r.line_count, 10);
  });
});

test("line out of range but snippet found → line_mismatch + suggested_line", () => {
  withFixture((root) => {
    const r = verifyCitation(root, {
      path: "sample.py",
      line: 999,
      expected_snippet: "if blocking_rules:",
    });
    assert.equal(r.verdict, "line_mismatch");
    assert.equal(r.suggested_line, 7);
  });
});

test("snippet at cited line → match (whitespace-insensitive)", () => {
  withFixture((root) => {
    const r = verifyCitation(root, {
      path: "sample.py",
      line: 7,
      expected_snippet: "if   blocking_rules :".replace(" :", ":"),
    });
    assert.equal(r.verdict, "match");
  });
});

test("snippet found elsewhere → content_mismatch + suggested_line (moved candidate)", () => {
  withFixture((root) => {
    const r = verifyCitation(root, {
      path: "sample.py",
      line: 3,
      expected_snippet: "if blocking_rules:",
    });
    assert.equal(r.verdict, "content_mismatch");
    assert.equal(r.suggested_line, 7);
  });
});

test("snippet nowhere in file → content_mismatch without suggested_line", () => {
  withFixture((root) => {
    const r = verifyCitation(root, {
      path: "sample.py",
      line: 3,
      expected_snippet: "this code does not exist anywhere",
    });
    assert.equal(r.verdict, "content_mismatch");
    assert.equal(r.suggested_line, undefined);
  });
});

test("multi-line snippet spanning the cited line → match", () => {
  withFixture((root) => {
    const r = verifyCitation(root, {
      path: "sample.py",
      line: 7,
      expected_snippet: "if blocking_rules:\n        return block(rules)",
    });
    assert.equal(r.verdict, "match");
  });
});

test("path escaping the root throws", () => {
  withFixture((root) => {
    assert.throws(() => verifyCitation(root, { path: "../../etc/passwd", line: 1 }), /escapes/);
  });
});

// --- regressions from the 2026-07 review ---

test("trailing newline does not create a phantom verifiable line", () => {
  withFixture((root) => {
    writeFileSync(join(root, "nl.py"), "a = 1\nb = 2\n");
    const phantom = verifyCitation(root, { path: "nl.py", line: 3 });
    assert.equal(phantom.verdict, "line_mismatch");
    assert.equal(phantom.line_count, 2);
  });
});

test("snippet spanning an interior blank line in the file still matches", () => {
  withFixture((root) => {
    writeFileSync(join(root, "blank.py"), "if x:\n\n        return None\n");
    const r = verifyCitation(root, {
      path: "blank.py",
      line: 1,
      expected_snippet: "if x:\n    return None",
    });
    assert.equal(r.verdict, "match");
  });
});

test("formatting-only reflow (two snippet lines joined in file) still matches", () => {
  withFixture((root) => {
    writeFileSync(join(root, "reflow.js"), "  if (ok) run();\n");
    const r = verifyCitation(root, {
      path: "reflow.js",
      line: 1,
      expected_snippet: "if (ok)\nrun();",
    });
    assert.equal(r.verdict, "match");
  });
});
