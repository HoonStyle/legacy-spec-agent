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


test("codex plugin manifests use portable local packaging", () => {
  const plugin = JSON.parse(readFileSync(join(repo, ".codex-plugin/plugin.json"), "utf8"));
  assert.equal(plugin.skills, "./skills/");
  assert.equal(plugin.mcpServers["legacy-spec"].command, "node");
  assert.deepEqual(plugin.mcpServers["legacy-spec"].args, ["connector/bootstrap.mjs"]);
  assert.equal(plugin.mcpServers["legacy-spec"].cwd, ".");

  const marketplace = JSON.parse(readFileSync(join(repo, ".agents/plugins/marketplace.json"), "utf8"));
  assert.equal(marketplace.plugins[0].source.source, "local");
  assert.equal(marketplace.plugins[0].source.path, "./");
});


test("claude code mcp config keeps claude path substitutions", () => {
  const mcp = JSON.parse(readFileSync(join(repo, ".mcp.json"), "utf8"));
  assert.deepEqual(Object.keys(mcp), ["mcpServers"]);
  assert.equal(mcp.mcpServers["legacy-spec"].command, "node");
  assert.deepEqual(mcp.mcpServers["legacy-spec"].args, [
    "${CLAUDE_PLUGIN_ROOT}/connector/bootstrap.mjs",
    "${CLAUDE_PROJECT_DIR}",
  ]);
});
