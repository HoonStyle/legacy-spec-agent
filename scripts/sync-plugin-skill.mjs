#!/usr/bin/env node
/**
 * The root SKILL.md / references/ are canonical; skills/legacy-spec-agent/
 * is the plugin-layout copy. Run this after editing the canonical files.
 * connector/test/plugin-sync.test.ts fails the suite when the copies drift.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(repo, "skills/legacy-spec-agent");

mkdirSync(join(dest, "references"), { recursive: true });
for (const rel of ["SKILL.md", "references/agent-roles.md"]) {
  copyFileSync(join(repo, rel), join(dest, rel));
  console.log(`synced ${rel} -> skills/legacy-spec-agent/${rel}`);
}
