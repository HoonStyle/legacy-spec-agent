import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyCitation } from "../src/verify.js";

/**
 * C1 acceptance: mechanically replay every citation in the demo-hookify audit
 * log against the hookify source at the cited commit (15a21e1). All 12 entries
 * — the 9 verified AND the 3 flagged (they were quarantined for semantic
 * reasons, not location errors) — must resolve to a valid location.
 *
 * Requires HOOKIFY_ROOT to point at a checkout of anthropics/claude-code's
 * plugins/hookify directory at commit 15a21e1; skipped otherwise.
 */
const HOOKIFY_ROOT = process.env.HOOKIFY_ROOT;

// dist/test/ → dist/ → connector/ → repo root
const AUDIT_LOG = resolve(dirname(fileURLToPath(import.meta.url)), "../../..", "demo-hookify/audit_log.jsonl");

test("replay demo-hookify audit_log citations", { skip: !HOOKIFY_ROOT || !existsSync(HOOKIFY_ROOT) ? "HOOKIFY_ROOT not set" : false }, () => {
  const entries = readFileSync(AUDIT_LOG, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as { id: string; action: string; claim: string; evidence: string });

  assert.equal(entries.length, 12, "audit log should have 12 entries");

  const summary = { verified: 0, flagged: 0 };
  for (const entry of entries) {
    const m = /^(.+):(\d+)$/.exec(entry.evidence);
    assert.ok(m, `evidence should be path:line — ${entry.id}: ${entry.evidence}`);
    const result = verifyCitation(HOOKIFY_ROOT!, { path: m![1], line: Number(m![2]), claim: entry.claim });
    assert.equal(
      result.verdict,
      "match",
      `${entry.id} (${entry.action}): ${entry.evidence} → ${result.verdict}`,
    );
    summary[entry.action as "verified" | "flagged"]++;
  }

  assert.equal(summary.verified, 9);
  assert.equal(summary.flagged, 3);
  console.error(`replayed 12/12 citations OK (verified ${summary.verified}, flagged ${summary.flagged})`);
});
