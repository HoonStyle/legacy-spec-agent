import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createWriteStream, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync } from "node:fs";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export type DownloadState = "queued" | "downloading" | "verifying" | "complete" | "failed" | "cancelled";
export interface ArtifactPlan { language: string; version: string; url: string; sha256: string }
export interface DownloadJob extends ArtifactPlan {
  id: string; state: DownloadState; downloaded_bytes: number; total_bytes?: number; percent?: number;
  artifact_path?: string; error?: string; created_at: number; finished_at?: number;
}
interface Approval { plan: ArtifactPlan; expiresAt: number }
interface DownloadLimits { maxBytes: number; maxConcurrent: number; timeoutMs: number; idleTimeoutMs: number; terminalTtlMs: number; maxJobs: number }
function publicJob(job: DownloadJob): DownloadJob {
  const url = new URL(job.url); url.search = ""; url.hash = "";
  return { ...job, url: url.toString() };
}

const RULES: Record<string, (url: URL, redirected: boolean) => boolean> = {
  python: (u) => ["python.org", "www.python.org"].includes(u.hostname) && u.pathname.startsWith("/ftp/python/"),
  typescript: (u) => u.hostname === "nodejs.org" && u.pathname.startsWith("/dist/"),
  java: (u, redirected) =>
    (u.hostname === "api.adoptium.net" && u.pathname.startsWith("/v3/binary/")) ||
    (u.hostname === "github.com" && /^\/adoptium\/temurin\d+-binaries\/releases\/download\//.test(u.pathname)) ||
    (redirected && u.hostname === "objects.githubusercontent.com"),
  csharp: (u) => ["dotnetcli.azureedge.net", "builds.dotnet.microsoft.com", "download.visualstudio.microsoft.com"].includes(u.hostname),
  go: (u) => (u.hostname === "go.dev" && u.pathname.startsWith("/dl/")) || (u.hostname === "dl.google.com" && u.pathname.startsWith("/go/")),
};
function contained(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}
function assertSafeDirectory(path: string) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`toolchain cache component is not a real directory: ${path}`);
  if (process.platform !== "win32" && (stat.mode & 0o022) !== 0) throw new Error(`toolchain cache directory is group/world writable: ${path}`);
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new Error(`toolchain cache directory is not owned by the current user: ${path}`);
}
function validatePlan(plan: ArtifactPlan) {
  if (!/^[a-f0-9]{64}$/i.test(plan.sha256)) throw new Error("sha256 must be a 64-character hexadecimal digest");
  const url = new URL(plan.url);
  if (url.protocol !== "https:") throw new Error("toolchain artifacts must use HTTPS");
  if (!RULES[plan.language]?.(url, false)) throw new Error(`untrusted artifact URL for ${plan.language}: ${url.hostname}${url.pathname}`);
}

export class ToolchainApprovalStore {
  private readonly approvals = new Map<string, Approval>();
  constructor(private readonly ttlMs = 10 * 60_000, private readonly maxApprovals = 100) {}
  issue(plan: ArtifactPlan, userApproved: boolean): { consent_token: string; expires_at: number; approval_source: "caller_attestation" } {
    if (userApproved !== true) throw new Error("explicit user approval is required");
    validatePlan(plan);
    const now = Date.now();
    for (const [token, approval] of this.approvals) if (approval.expiresAt < now) this.approvals.delete(token);
    if (this.approvals.size >= this.maxApprovals) throw new Error("too many pending toolchain approvals");
    const consent_token = randomBytes(32).toString("base64url");
    const expires_at = Date.now() + this.ttlMs;
    this.approvals.set(consent_token, { plan: { ...plan, sha256: plan.sha256.toLowerCase() }, expiresAt: expires_at });
    return { consent_token, expires_at, approval_source: "caller_attestation" };
  }
  consume(token: string): ArtifactPlan {
    const approval = this.approvals.get(token);
    this.approvals.delete(token);
    if (!approval || approval.expiresAt < Date.now()) throw new Error("invalid or expired consent token");
    return approval.plan;
  }
}

export class ToolchainDownloadManager {
  private readonly jobs = new Map<string, DownloadJob>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly limits: DownloadLimits;
  constructor(
    private readonly cacheRoot: string,
    private readonly approvals: ToolchainApprovalStore,
    private readonly fetchImpl: typeof fetch = fetch,
    limits: Partial<DownloadLimits> = {},
  ) {
    this.limits = { maxBytes: 1_073_741_824, maxConcurrent: 2, timeoutMs: 15 * 60_000, idleTimeoutMs: 30_000, terminalTtlMs: 60 * 60_000, maxJobs: 1000, ...limits };
  }

  start(consentToken: string): DownloadJob {
    this.evict();
    if (this.jobs.size >= this.limits.maxJobs) throw new Error("too many retained toolchain download jobs");
    if (this.controllers.size >= this.limits.maxConcurrent) throw new Error("too many concurrent toolchain downloads");
    const plan = this.approvals.consume(consentToken);
    const cache = resolve(this.cacheRoot.replace(/^~(?=$|\/)/, process.env.HOME ?? ""));
    mkdirSync(cache, { recursive: true, mode: 0o700 });
    assertSafeDirectory(cache);
    const cacheReal = realpathSync(cache);
    const languageDir = resolve(cacheReal, plan.language);
    if (!contained(cacheReal, languageDir)) throw new Error("toolchain cache path escapes managed cache root");
    if (!existsSync(languageDir)) mkdirSync(languageDir, { mode: 0o700 });
    assertSafeDirectory(languageDir);
    const languageReal = realpathSync(languageDir);
    if (!contained(cacheReal, languageReal)) throw new Error("toolchain cache path escapes through symlink");
    const versionDir = resolve(languageReal, plan.version);
    if (!contained(languageReal, versionDir)) throw new Error("toolchain version path escapes managed cache root");
    if (!existsSync(versionDir)) mkdirSync(versionDir, { mode: 0o700 });
    assertSafeDirectory(versionDir);
    const versionReal = realpathSync(versionDir);
    if (!contained(languageReal, versionReal)) throw new Error("toolchain version path escapes through symlink");
    const digestDir = resolve(versionReal, plan.sha256);
    if (!existsSync(digestDir)) mkdirSync(digestDir, { mode: 0o700 });
    assertSafeDirectory(digestDir);
    const digestReal = realpathSync(digestDir);
    if (!contained(cacheReal, digestReal)) throw new Error("toolchain cache path escapes through symlink");
    const destination = resolve(digestReal, basename(new URL(plan.url).pathname) || "artifact");
    if (!contained(digestReal, destination)) throw new Error("artifact path escapes managed cache root");
    const job: DownloadJob = { ...plan, sha256: plan.sha256.toLowerCase(), id: randomUUID(), state: "queued", downloaded_bytes: 0, created_at: Date.now() };
    if (existsSync(destination)) {
      const actual = createHash("sha256").update(readFileSync(destination)).digest("hex");
      if (actual !== job.sha256) throw new Error("existing cached artifact failed checksum verification");
      job.state = "complete"; job.percent = 100; job.artifact_path = destination; job.finished_at = Date.now();
      this.jobs.set(job.id, job);
      return publicJob(job);
    }
    this.jobs.set(job.id, job);
    const controller = new AbortController();
    this.controllers.set(job.id, controller);
    void this.run(job, new URL(plan.url), destination, controller);
    return publicJob(job);
  }
  get(id: string): DownloadJob { this.evict(); const job = this.jobs.get(id); if (!job) throw new Error(`unknown or expired toolchain download job: ${id}`); return publicJob(job); }
  cancel(id: string): DownloadJob {
    const job = this.jobs.get(id); if (!job) throw new Error(`unknown toolchain download job: ${id}`);
    if (["queued", "downloading", "verifying"].includes(job.state)) { job.state = "cancelled"; job.finished_at = Date.now(); this.controllers.get(id)?.abort(); }
    return publicJob(job);
  }
  private evict() { const cutoff = Date.now() - this.limits.terminalTtlMs; for (const [id, job] of this.jobs) if (job.finished_at && job.finished_at < cutoff) this.jobs.delete(id); }
  private async fetchAllowed(language: string, url: URL, signal: AbortSignal): Promise<Response> {
    let current = url;
    for (let hop = 0; hop <= 5; hop++) {
      const response = await this.fetchImpl(current, { signal, redirect: "manual" });
      if (response.status < 300 || response.status >= 400) return response;
      const location = response.headers.get("location"); if (!location) throw new Error("redirect missing Location header");
      const next = new URL(location, current); if (next.protocol !== "https:" || !RULES[language]?.(next, true)) throw new Error(`untrusted redirect: ${next}`);
      await response.body?.cancel();
      current = next;
    }
    throw new Error("too many redirects");
  }
  private async run(job: DownloadJob, url: URL, destination: string, controller: AbortController) {
    const temporary = `${destination}.${job.id}.download`;
    const timer = setTimeout(() => controller.abort(), this.limits.timeoutMs);
    let idleTimer = setTimeout(() => controller.abort(), this.limits.idleTimeoutMs);
    try {
      job.state = "downloading";
      const response = await this.fetchAllowed(job.language, url, controller.signal);
      if (!response.ok || !response.body) throw new Error(`download failed: HTTP ${response.status}`);
      const lengthHeader = response.headers.get("content-length");
      const length = lengthHeader === null ? undefined : Number(lengthHeader);
      if (length !== undefined && Number.isFinite(length) && length >= 0) { if (length > this.limits.maxBytes) throw new Error("artifact exceeds maximum download size"); job.total_bytes = length; }
      const hash = createHash("sha256"); const source = Readable.fromWeb(response.body as never);
      source.on("data", (chunk: Buffer) => {
        clearTimeout(idleTimer); idleTimer = setTimeout(() => controller.abort(), this.limits.idleTimeoutMs);
        hash.update(chunk); job.downloaded_bytes += chunk.length;
        if (job.downloaded_bytes > this.limits.maxBytes) controller.abort();
        if (job.total_bytes) job.percent = Math.min(100, Math.round(job.downloaded_bytes / job.total_bytes * 1000) / 10);
      });
      await pipeline(source, createWriteStream(temporary, { flags: "wx", mode: 0o600 }), { signal: controller.signal });
      if (controller.signal.aborted) throw new Error(job.downloaded_bytes > this.limits.maxBytes ? "artifact exceeds maximum download size" : "download timed out or was cancelled");
      job.state = "verifying"; const actual = hash.digest("hex"); if (actual !== job.sha256) throw new Error(`checksum mismatch: expected ${job.sha256}, got ${actual}`);
      renameSync(temporary, destination); job.state = "complete"; job.percent = 100; job.artifact_path = destination; job.finished_at = Date.now();
    } catch (error) {
      rmSync(temporary, { force: true }); if (job.state !== "cancelled") { job.state = "failed"; job.error = error instanceof Error ? error.message : String(error); job.finished_at = Date.now(); }
    } finally { clearTimeout(timer); clearTimeout(idleTimer); this.controllers.delete(job.id); }
  }
}
