import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { calculateDraftDigest, evaluateDocumentGate, type DocumentGateParams, type DocumentGateResult } from "./document-gate.js";

export interface PublishResult { gate: DocumentGateResult; published: boolean; destination?: string }
const STALE_LOCK_MS = 10 * 60_000;

function inside(root: string, path: string): boolean { return path !== root && path.startsWith(root + sep); }
function overlaps(a: string, b: string): boolean { return a === b || a.startsWith(b + sep) || b.startsWith(a + sep); }
function rejectSymlinks(path: string): void {
  const stats = lstatSync(path);
  if (stats.isSymbolicLink()) throw new Error(`publication paths cannot contain symlinks: ${path}`);
  if (stats.isDirectory()) for (const entry of readdirSync(path)) rejectSymlinks(resolve(path, entry));
}
function existingAncestor(path: string): string {
  let current = path;
  while (!existsSync(current)) current = dirname(current);
  return realpathSync(current);
}
function safePaths(params: DocumentGateParams, destination: string): { root: string; staging: string; destination: string } {
  const root = realpathSync(params.root);
  const staging = realpathSync(params.dir);
  const target = resolve(destination);
  if (!inside(root, staging) || !inside(root, target)) throw new Error("staging and destination must be distinct descendants of the connector root");
  if (overlaps(staging, target) || overlaps(realpathSync(params.source_root), target)) throw new Error("destination must not overlap staging or source directories");
  const ancestor = existingAncestor(target);
  if (!inside(root, ancestor) && ancestor !== root) throw new Error("destination resolves outside the connector root");
  rejectSymlinks(staging);
  return { root, staging, destination: target };
}
function acquireLock(lock: string): boolean {
  if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs > STALE_LOCK_MS) {
    const owner = Number.parseInt(readFileSync(lock, "utf8"), 10);
    let alive = Number.isInteger(owner) && owner > 0;
    if (alive) try { process.kill(owner, 0); } catch { alive = false; }
    if (!alive) rmSync(lock, { force: true });
  }
  try { writeFileSync(lock, String(process.pid), { flag: "wx" }); return true; } catch { return false; }
}

function recoverInterruptedPublication(destination: string): void {
  if (existsSync(destination)) return;
  const parent = dirname(destination);
  const prefix = `${basename(destination)}.previous-`;
  const previous = readdirSync(parent).filter((entry) => entry.startsWith(prefix)).sort().at(-1);
  if (previous) renameSync(resolve(parent, previous), destination);
}

/** Snapshot, gate, and transactionally publish a staging draft; rejected drafts never replace prior output. */
export function gateAndPublish(params: DocumentGateParams, destination: string): PublishResult {
  const paths = safePaths(params, destination);
  mkdirSync(dirname(paths.destination), { recursive: true });
  const lock = `${paths.destination}.publish.lock`;
  const rejected = (detail: string): PublishResult => ({ gate: { verdict: "rejected", citation_count: 0, audited_citation_count: 0, reasons: [{ code: "invalid_provenance", detail }] }, published: false });
  if (!acquireLock(lock)) return rejected("publication is already in progress");

  const nonce = `${process.pid}-${Date.now()}`;
  const candidate = `${paths.destination}.candidate-${nonce}`;
  const previous = `${paths.destination}.previous-${nonce}`;
  try {
    recoverInterruptedPublication(paths.destination);
    cpSync(paths.staging, candidate, { recursive: true, errorOnExist: true });
    rejectSymlinks(candidate);
    const snapshotParams = { ...params, dir: candidate };
    const gate = evaluateDocumentGate(snapshotParams);
    if (gate.verdict !== "approved") return { gate, published: false };
    if (calculateDraftDigest(candidate, params.profile) !== params.scope_manifest.draft_digest)
      return rejected("published snapshot differs from the frozen draft digest");
    if (existsSync(paths.destination)) renameSync(paths.destination, previous);
    try { renameSync(candidate, paths.destination); }
    catch (error) { if (existsSync(previous)) renameSync(previous, paths.destination); throw error; }
    rmSync(previous, { recursive: true, force: true });
    return { gate, published: true, destination: paths.destination };
  } finally {
    rmSync(candidate, { recursive: true, force: true });
    rmSync(lock, { force: true });
  }
}
