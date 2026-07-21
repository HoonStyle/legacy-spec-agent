import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ToolchainApprovalStore, ToolchainDownloadManager } from "../src/toolchain-downloads.js";

const body = Buffer.from("verified toolchain artifact");
const sha256 = createHash("sha256").update(body).digest("hex");
function response(chunks = [body]): typeof fetch {
  return (async () => new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  }), { status: 200, headers: { "content-length": String(chunks.reduce((n, x) => n + x.length, 0)) } })) as typeof fetch;
}

async function terminal(manager: ToolchainDownloadManager, id: string) {
  for (let i = 0; i < 100; i++) {
    const job = manager.get(id);
    if (["complete", "failed", "cancelled"].includes(job.state)) return job;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("download did not reach a terminal state");
}

test("approval is exact, short-lived, and one-use", () => {
  const approvals = new ToolchainApprovalStore();
  const plan = { language: "csharp", version: "8.0.407", url: "https://builds.dotnet.microsoft.com/sdk.tgz", sha256 };
  assert.throws(() => approvals.issue(plan, false), /approval/);
  assert.throws(() => approvals.issue({ ...plan, url: "https://evil.test/sdk.tgz" }, true), /untrusted/);
  const token = approvals.issue(plan, true).consent_token;
  assert.deepEqual(approvals.consume(token), plan);
  assert.throws(() => approvals.consume(token), /invalid or expired/);
});

test("download manager reports byte progress and atomically publishes a verified artifact", async () => {
  const cache = mkdtempSync(join(tmpdir(), "lsc-download-"));
  const approvals = new ToolchainApprovalStore();
  const manager = new ToolchainDownloadManager(cache, approvals, response([body.subarray(0, 5), body.subarray(5)]));
  try {
    const started = manager.start(approvals.issue({ language: "csharp", version: "8.0.407", url: "https://builds.dotnet.microsoft.com/sdk.tgz?signature=secret", sha256 }, true).consent_token);
    assert.equal(started.url, "https://builds.dotnet.microsoft.com/sdk.tgz");
    const done = await terminal(manager, started.id);
    assert.equal(done.state, "complete");
    assert.equal(done.downloaded_bytes, body.length);
    assert.equal(done.total_bytes, body.length);
    assert.equal(done.percent, 100);
    assert.equal(done.url, "https://builds.dotnet.microsoft.com/sdk.tgz");
    assert.ok(done.artifact_path && existsSync(done.artifact_path));
    assert.deepEqual(readFileSync(done.artifact_path!), body);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test("download manager deletes checksum failures and reports the error", async () => {
  const cache = mkdtempSync(join(tmpdir(), "lsc-download-bad-"));
  const approvals = new ToolchainApprovalStore();
  const manager = new ToolchainDownloadManager(cache, approvals, response());
  try {
    const started = manager.start(approvals.issue({ language: "csharp", version: "8", url: "https://builds.dotnet.microsoft.com/sdk.tgz", sha256: "0".repeat(64) }, true).consent_token);
    const done = await terminal(manager, started.id);
    assert.equal(done.state, "failed");
    assert.match(done.error!, /checksum mismatch/);
    assert.equal(done.artifact_path, undefined);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test("download manager exposes cancellation", async () => {
  const cache = mkdtempSync(join(tmpdir(), "lsc-download-cancel-"));
  const approvals = new ToolchainApprovalStore();
  let release!: () => void;
  const fetcher = (async () => new Response(new ReadableStream({
    async start(controller) {
      controller.enqueue(body.subarray(0, 2));
      await new Promise<void>((resolve) => { release = resolve; });
      controller.enqueue(body.subarray(2));
      controller.close();
    },
  }))) as typeof fetch;
  const manager = new ToolchainDownloadManager(cache, approvals, fetcher);
  try {
    const started = manager.start(approvals.issue({ language: "csharp", version: "8", url: "https://builds.dotnet.microsoft.com/sdk.tgz", sha256 }, true).consent_token);
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(manager.cancel(started.id).state, "cancelled");
    release();
    assert.equal((await terminal(manager, started.id)).state, "cancelled");
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test("download manager validates and follows a bounded official redirect", async () => {
  const cache = mkdtempSync(join(tmpdir(), "lsc-download-redirect-"));
  const approvals = new ToolchainApprovalStore();
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    return calls === 1
      ? new Response(null, { status: 302, headers: { location: "https://download.visualstudio.microsoft.com/sdk.tgz" } })
      : new Response(body, { status: 200, headers: { "content-length": String(body.length) } });
  }) as typeof fetch;
  const manager = new ToolchainDownloadManager(cache, approvals, fetcher);
  try {
    const token = approvals.issue({ language: "csharp", version: "8", url: "https://builds.dotnet.microsoft.com/sdk.tgz", sha256 }, true).consent_token;
    assert.equal((await terminal(manager, manager.start(token).id)).state, "complete");
    assert.equal(calls, 2);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test("download manager fails closed when the declared artifact exceeds its size limit", async () => {
  const cache = mkdtempSync(join(tmpdir(), "lsc-download-limit-"));
  const approvals = new ToolchainApprovalStore();
  const manager = new ToolchainDownloadManager(cache, approvals, response(), { maxBytes: 2, maxConcurrent: 1, timeoutMs: 1000, terminalTtlMs: 1000 });
  try {
    const token = approvals.issue({ language: "csharp", version: "8", url: "https://builds.dotnet.microsoft.com/sdk.tgz", sha256 }, true).consent_token;
    const done = await terminal(manager, manager.start(token).id);
    assert.equal(done.state, "failed");
    assert.match(done.error!, /maximum download size/);
  } finally { rmSync(cache, { recursive: true, force: true }); }
});

test("download manager rejects a managed-cache symlink escape before writing outside", () => {
  const cache = mkdtempSync(join(tmpdir(), "lsc-download-symlink-"));
  const outside = mkdtempSync(join(tmpdir(), "lsc-download-outside-"));
  symlinkSync(outside, join(cache, "csharp"), "dir");
  const approvals = new ToolchainApprovalStore();
  const manager = new ToolchainDownloadManager(cache, approvals, response());
  try {
    const token = approvals.issue({ language: "csharp", version: "8", url: "https://builds.dotnet.microsoft.com/sdk.tgz", sha256 }, true).consent_token;
    assert.throws(() => manager.start(token), /real directory|symlink/);
  } finally {
    rmSync(cache, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
