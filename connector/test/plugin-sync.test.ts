import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// dist/test/ → dist/ → connector/ → repo root
const repo = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * The plugin layout (skills/legacy-spec-agent/) is a copy of the canonical
 * root files. This project's whole premise is that copies drift — so its own
 * copies are drift-checked. Fix a failure with: node scripts/sync-plugin-skill.mjs
 */
test("plugin skill copy matches the canonical root files", () => {
  for (const rel of ["SKILL.md", "references/agent-roles.md"]) {
    const canonical = readFileSync(join(repo, rel), "utf8");
    const copy = readFileSync(join(repo, "skills/legacy-spec-agent", rel), "utf8");
    assert.equal(copy, canonical, `${rel} drifted — run: node scripts/sync-plugin-skill.mjs`);
  }
});
