import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { gateAndPublish } from "../src/document-emission.js";
import type { DocumentGateParams } from "../src/document-gate.js";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureRoot = join(repositoryRoot, "connector/test/fixtures/document-coverage/complete-or-explained");
function setup(): { root: string; params: DocumentGateParams; destination: string } {
  const root = mkdtempSync(join(tmpdir(), "document-emission-"));
  cpSync(fixtureRoot, join(root, "fixture"), { recursive: true });
  const input = JSON.parse(readFileSync(join(root, "fixture/gate-input.json"), "utf8"));
  return { root, params: { root, source_root: join(root, "fixture"), dir: join(root, "fixture/output"), profile: "core", ...input }, destination: join(root, "published") };
}

test("approved frozen drafts publish transactionally", () => {
  const item = setup();
  try {
    const result = gateAndPublish(item.params, item.destination);
    assert.equal(result.gate.verdict, "approved");
    assert.equal(result.published, true);
    assert.ok(existsSync(join(item.destination, "SPEC.md")));
  } finally { rmSync(item.root, { recursive: true, force: true }); }
});

test("rejected drafts never replace a prior publication", () => {
  const item = setup();
  try {
    cpSync(item.params.dir, item.destination, { recursive: true });
    writeFileSync(join(item.destination, "marker"), "old");
    rmSync(join(item.params.dir, "SPEC.md"));
    const result = gateAndPublish(item.params, item.destination);
    assert.equal(result.published, false);
    assert.equal(readFileSync(join(item.destination, "marker"), "utf8"), "old");
  } finally { rmSync(item.root, { recursive: true, force: true }); }
});

test("a concurrent publication lock fails closed", () => {
  const item = setup();
  try {
    writeFileSync(`${item.destination}.publish.lock`, "another-run");
    const result = gateAndPublish(item.params, item.destination);
    assert.equal(result.published, false);
    assert.equal(result.gate.verdict, "rejected");
    assert.match(result.gate.reasons[0].detail, /already in progress/);
  } finally { rmSync(item.root, { recursive: true, force: true }); }
});

test("a stale publication lock is recovered", () => {
  const item = setup();
  try {
    const lock = `${item.destination}.publish.lock`;
    writeFileSync(lock, "dead-run");
    const stale = new Date(Date.now() - 11 * 60_000);
    utimesSync(lock, stale, stale);
    assert.equal(gateAndPublish(item.params, item.destination).published, true);
  } finally { rmSync(item.root, { recursive: true, force: true }); }
});

test("an old lock owned by a live process is not stolen", () => {
  const item = setup();
  try {
    const lock = `${item.destination}.publish.lock`;
    writeFileSync(lock, String(process.pid));
    const old = new Date(Date.now() - 11 * 60_000);
    utimesSync(lock, old, old);
    assert.equal(gateAndPublish(item.params, item.destination).published, false);
  } finally { rmSync(item.root, { recursive: true, force: true }); }
});

test("an interrupted previous generation is recovered before publishing", () => {
  const item = setup();
  try {
    cpSync(item.params.dir, `${item.destination}.previous-crashed`, { recursive: true });
    const result = gateAndPublish(item.params, item.destination);
    assert.equal(result.published, true);
    assert.ok(existsSync(join(item.destination, "SPEC.md")));
  } finally { rmSync(item.root, { recursive: true, force: true }); }
});

test("root, overlapping, and symlink destinations are rejected", () => {
  const item = setup();
  const outside = mkdtempSync(join(tmpdir(), "document-emission-outside-"));
  try {
    assert.throws(() => gateAndPublish(item.params, item.root), /distinct descendants/);
    assert.throws(() => gateAndPublish(item.params, item.params.dir), /overlap/);
    symlinkSync(outside, join(item.root, "escaped"), "dir");
    assert.throws(() => gateAndPublish(item.params, join(item.root, "escaped", "published")), /outside/);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("post-freeze staging mutations are rejected before replacement", () => {
  const item = setup();
  try {
    writeFileSync(join(item.params.dir, "SPEC.md"), `${readFileSync(join(item.params.dir, "SPEC.md"), "utf8")}\nmutation\n`);
    const result = gateAndPublish(item.params, item.destination);
    assert.equal(result.published, false);
    assert.equal(result.gate.verdict, "rejected");
  } finally { rmSync(item.root, { recursive: true, force: true }); }
});
