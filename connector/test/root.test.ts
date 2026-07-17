import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { isSelfServing, resolveRoot } from "../src/root.js";

test("explicit CLI argument wins over every env var", () => {
  const r = resolveRoot("/proj", { LEGACY_SPEC_ROOT: "/other" }, "/cwd");
  assert.deepEqual(r, { root: resolve("/proj"), source: "arg" });
});

test("unsubstituted ${...} placeholder argument is ignored", () => {
  const r = resolveRoot("${CLAUDE_PROJECT_DIR}", { CLAUDE_PROJECT_DIR: "/proj" }, "/cwd");
  assert.deepEqual(r, { root: resolve("/proj"), source: "CLAUDE_PROJECT_DIR" });
});

test("env precedence: LEGACY_SPEC_ROOT > CLAUDE_PROJECT_DIR > CODEX_PROJECT_DIR", () => {
  const env = {
    LEGACY_SPEC_ROOT: "/a",
    CLAUDE_PROJECT_DIR: "/b",
    CODEX_PROJECT_DIR: "/c",
  };
  assert.equal(resolveRoot(undefined, env, "/cwd").source, "LEGACY_SPEC_ROOT");
  assert.equal(resolveRoot(undefined, { ...env, LEGACY_SPEC_ROOT: undefined }, "/cwd").source, "CLAUDE_PROJECT_DIR");
  assert.equal(resolveRoot(undefined, { CODEX_PROJECT_DIR: "/c" }, "/cwd").source, "CODEX_PROJECT_DIR");
});

test("empty env values are skipped, not resolved to cwd-relative paths", () => {
  const r = resolveRoot(undefined, { LEGACY_SPEC_ROOT: "", CODEX_PROJECT_DIR: "/c" }, "/cwd");
  assert.deepEqual(r, { root: resolve("/c"), source: "CODEX_PROJECT_DIR" });
});

test("cwd is the last-resort fallback", () => {
  const r = resolveRoot(undefined, {}, "/cwd");
  assert.deepEqual(r, { root: resolve("/cwd"), source: "cwd" });
});

test("isSelfServing flags the connector dir and the plugin checkout above it", () => {
  const connectorDir = resolve("/install/legacy-spec-agent/connector");
  assert.equal(isSelfServing(resolve("/install/legacy-spec-agent/connector"), connectorDir), true);
  assert.equal(isSelfServing(resolve("/install/legacy-spec-agent"), connectorDir), true);
  assert.equal(isSelfServing(resolve("/home/user/some-project"), connectorDir), false);
  assert.equal(isSelfServing(resolve("/install"), connectorDir), false);
});
