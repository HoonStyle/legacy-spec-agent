import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectDrift } from "../src/drift.js";

function git(root: string, ...args: string[]): string {
  return execFileSync(
    "git",
    ["-C", root, "-c", "user.email=t@example.com", "-c", "user.name=t", ...args],
    { encoding: "utf8" },
  ).trim();
}

/**
 * SPEC.md §9 scenario 3 as a self-contained demo: build a baseline commit,
 * then change the code on purpose and watch each drift class get flagged.
 */
test("detectDrift: intact / moved / drifted / orphaned in one run", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-drift-"));
  try {
    git(root, "init", "-q");
    writeFileSync(
      join(root, "engine.py"),
      [
        "import re",                                   // 1
        "",                                            // 2
        "def evaluate(rules):",                        // 3
        "    if not isinstance(rules, list):",         // 4
        "        raise TypeError('rules')",            // 5
        "    threshold = 10",                          // 6
        "    return [r for r in rules if r.weight > threshold]", // 7
      ].join("\n"),
    );
    writeFileSync(join(root, "legacy.py"), "def old_path():\n    return 'v1'\n");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "baseline");
    const baseline = git(root, "rev-parse", "HEAD");

    // Intentional changes:
    // - insert two lines above evaluate()      → citation engine.py:4 MOVES
    // - change the threshold business rule     → citation engine.py:6 DRIFTS
    // - delete legacy.py                       → citation legacy.py:1 ORPHANS
    // - leave line 1 untouched                 → citation engine.py:1 INTACT
    writeFileSync(
      join(root, "engine.py"),
      [
        "import re",                                   // 1  (intact)
        "",                                            // 2
        "LOG = True",                                  // 3  (inserted)
        "",                                            // 4  (inserted)
        "def evaluate(rules):",                        // 5
        "    if not isinstance(rules, list):",         // 6  (was 4 → moved)
        "        raise TypeError('rules')",            // 7
        "    threshold = 50",                          // 8  (rule changed → drifted)
        "    return [r for r in rules if r.weight > threshold]", // 9
      ].join("\n"),
    );
    unlinkSync(join(root, "legacy.py"));

    const report = detectDrift(root, {
      baseline_ref: baseline,
      citations: [
        { id: "c-intact", path: "engine.py", line: 1 },
        { id: "c-moved", path: "engine.py", line: 4 },
        { id: "c-drifted", path: "engine.py", line: 6 },
        { id: "c-orphaned", path: "legacy.py", line: 1 },
      ],
    });

    const byId = Object.fromEntries(report.results.map((r) => [r.id, r]));
    assert.equal(byId["c-intact"].verdict, "intact");
    assert.equal(byId["c-moved"].verdict, "moved");
    assert.equal(byId["c-moved"].new_line, 6);
    assert.equal(byId["c-drifted"].verdict, "drifted");
    assert.ok(byId["c-drifted"].baseline_source?.includes("threshold = 10"));
    assert.ok(byId["c-drifted"].current_source?.includes("isinstance"));
    assert.equal(byId["c-orphaned"].verdict, "orphaned");
    assert.deepEqual(report.summary, { intact: 1, moved: 1, drifted: 1, orphaned: 1, error: 0 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("detectDrift: unreadable baseline reported as error, never guessed", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-drift-err-"));
  try {
    git(root, "init", "-q");
    writeFileSync(join(root, "a.py"), "x = 1\n");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "baseline");
    const baseline = git(root, "rev-parse", "HEAD");

    const report = detectDrift(root, {
      baseline_ref: baseline,
      citations: [{ id: "never-existed", path: "ghost.py", line: 3 }],
    });
    assert.equal(report.results[0].verdict, "error");
    assert.equal(report.results[0].error !== undefined, true);
    assert.equal(report.summary.error, 1);
    assert.equal(report.summary.drifted, 0); // errors are NOT drift
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("detectDrift: non-git root reports errors, never fake 100% drift", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-drift-nogit-"));
  try {
    writeFileSync(join(root, "a.py"), "x = 1\n");
    const report = detectDrift(root, {
      baseline_ref: "HEAD",
      citations: [
        { id: "a", path: "a.py", line: 1 },
        { id: "b", path: "a.py", line: 1 },
      ],
    });
    assert.deepEqual(report.summary, { intact: 0, moved: 0, drifted: 0, orphaned: 0, error: 2 });
    assert.match(report.results[0].error!, /not inside a git repository/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("detectDrift: one malformed citation path degrades to an error entry, not a batch abort", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-drift-escape-"));
  try {
    git(root, "init", "-q");
    writeFileSync(join(root, "a.py"), "x = 1\n");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "baseline");
    const baseline = git(root, "rev-parse", "HEAD");

    const report = detectDrift(root, {
      baseline_ref: baseline,
      citations: [
        { id: "bad", path: "../outside.py", line: 1 },
        { id: "good", path: "a.py", line: 1 },
      ],
    });
    assert.equal(report.results.length, 2);
    assert.equal(report.results[0].verdict, "error");
    assert.match(report.results[0].error!, /escapes/);
    assert.equal(report.results[1].verdict, "intact"); // the batch survived
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("detectDrift: probe matching regressions from the 2026-07 review", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-drift-probe-"));
  try {
    git(root, "init", "-q");
    writeFileSync(
      join(root, "m.py"),
      [
        "import os",                  // 1
        "def f():",                   // 2
        "    count += 1",             // 3  (substring bait)
        "    x = compute()",          // 4
        "",                           // 5  (blank directly above a short line)
        "    pass",                   // 6
        "def g():",                   // 7
        "    return None",            // 8  (non-unique target)
        "def h():",                   // 9
        "    return None",            // 10
        "",                           // 11
        "    pass",                   // 12 (makes line 6's `pass` non-unique → forces widening across the blank line 5)
      ].join("\n"),
    );
    git(root, "add", "-A");
    git(root, "commit", "-qm", "baseline");
    const baseline = git(root, "rev-parse", "HEAD");

    // (a) unchanged file: short line with blank above must be intact, not drifted
    let report = detectDrift(root, {
      baseline_ref: baseline,
      citations: [{ id: "blank-above", path: "m.py", line: 6 }],
    });
    assert.equal(report.results[0].verdict, "intact");

    // (b) substring rewrite: `count += 1` -> `total_count += 1` must be drifted, not intact
    // (c) deleting one of two `return None`s must be drifted, not moved/intact
    writeFileSync(
      join(root, "m.py"),
      [
        "import os",
        "def f():",
        "    total_count += 1",       // 3: rewritten (superstring of the old line)
        "    x = compute()",
        "",
        "    pass",
        "def g():",
        "    return 0",               // 8: g's return None deleted
        "def h():",
        "    return None",
        "",
        "    pass",
      ].join("\n"),
    );
    report = detectDrift(root, {
      baseline_ref: baseline,
      citations: [
        { id: "substring", path: "m.py", line: 3 },
        { id: "nonunique-deleted", path: "m.py", line: 8 },
      ],
    });
    const byId = Object.fromEntries(report.results.map((r) => [r.id, r]));
    assert.equal(byId["substring"].verdict, "drifted");
    assert.equal(byId["nonunique-deleted"].verdict, "drifted");

    // (d) a 1-line shift must be moved (stale citation), never intact
    writeFileSync(
      join(root, "m.py"),
      [
        "# new header",               // inserted line
        "import os",
        "def f():",
        "    count += 1",
        "    x = compute()",
        "",
        "    pass",
        "def g():",
        "    return None",
        "def h():",
        "    return None",
        "",
        "    pass",
      ].join("\n"),
    );
    report = detectDrift(root, {
      baseline_ref: baseline,
      citations: [{ id: "shifted", path: "m.py", line: 6 }],
    });
    assert.equal(report.results[0].verdict, "moved");
    assert.equal(report.results[0].new_line, 7);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// C3 acceptance on real data: hookify citations vs their own baseline commit
// ---------------------------------------------------------------------------

const HOOKIFY_ROOT = process.env.HOOKIFY_ROOT;
const gated = { skip: !HOOKIFY_ROOT || !existsSync(HOOKIFY_ROOT) ? "HOOKIFY_ROOT not set" : false };

test("hookify: all 12 audit citations are intact vs baseline 15a21e1", gated, () => {
  const auditLog = join(HOOKIFY_ROOT!, "../../..", "legacy-spec-agent/demo-hookify/audit_log.jsonl");
  // audit log lives in this repo, not in the target repo — resolve from here instead
  const auditPath = existsSync(auditLog)
    ? auditLog
    : join(import.meta.dirname ?? ".", "../../..", "demo-hookify/audit_log.jsonl");

  const citations = readFileSync(auditPath, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as { id: string; evidence: string })
    .map((e) => {
      const m = /^(.+):(\d+)$/.exec(e.evidence)!;
      return { id: e.id, path: m[1], line: Number(m[2]) };
    });

  const report = detectDrift(HOOKIFY_ROOT!, { baseline_ref: "15a21e1", citations });
  assert.equal(report.summary.error, 0);
  assert.equal(report.summary.intact, 12, JSON.stringify(report.summary));
  console.error(`hookify drift vs 15a21e1: ${JSON.stringify(report.summary)}`);
});
