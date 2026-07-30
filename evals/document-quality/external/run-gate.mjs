/**
 * Gatekeeper client for external evaluation cases: invokes the deterministic
 * Mode A gate over stdio MCP, then optionally the transactional publication.
 *
 * Usage:
 *   node run-gate.mjs <case-id> <clone-dir> <gatekeeper-actor-id> evaluate
 *   node run-gate.mjs <case-id> <clone-dir> <gatekeeper-actor-id> publish
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

const [caseId, cloneName, gatekeeperActor, mode = "evaluate"] = process.argv.slice(2);
if (!caseId || !cloneName || !gatekeeperActor) {
  console.error("usage: node run-gate.mjs <case-id> <clone-dir> <gatekeeper-actor-id> [evaluate|publish]");
  process.exit(2);
}

const REPO = new URL("../../../", import.meta.url).pathname.replace(/\/$/, "");
const CASE_DIR = `${REPO}/evals/document-quality/external/${caseId}`;
const REL = `evals/document-quality/external/${caseId}`;

const payload = {
  source_dir: `.external-sources/${cloneName}`,
  profile: "standard",
  scope_manifest: JSON.parse(readFileSync(`${CASE_DIR}/scope-manifest.json`, "utf8")),
  evidence_audit: JSON.parse(readFileSync(`${CASE_DIR}/evidence-audit.json`, "utf8")),
  coverage_audit: JSON.parse(readFileSync(`${CASE_DIR}/coverage-audit.json`, "utf8")),
  gatekeeper_actor_id: gatekeeperActor,
};
const call = mode === "publish"
  ? { name: "publish_approved_documents", arguments: { ...payload, staging_dir: `${REL}/staging`, destination_dir: `${REL}/generated-documents` } }
  : { name: "evaluate_document_gate", arguments: { ...payload, deliverables_dir: `${REL}/staging` } };

const server = spawn("node", [`${REPO}/connector/dist/src/index.js`, REPO], { stdio: ["pipe", "pipe", "inherit"] });
const send = (msg) => server.stdin.write(JSON.stringify(msg) + "\n");
let buffer = "";
const pending = new Map();
server.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let index;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});
const request = (method, params, id) => new Promise((resolve) => { pending.set(id, resolve); send({ jsonrpc: "2.0", id, method, params }); });

const started = process.hrtime.bigint();
await request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: gatekeeperActor, version: "1.0.0" } }, 1);
send({ jsonrpc: "2.0", method: "notifications/initialized" });
const response = await request("tools/call", call, 2);
const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
server.stdin.end();
server.kill();

if (response.error) {
  console.error("tool error:", JSON.stringify(response.error, null, 2));
  process.exit(1);
}
const text = response.result.content.map((part) => part.text).join("");
const result = JSON.parse(text);
const out = mode === "publish" ? `${CASE_DIR}/publication-record.json` : `${CASE_DIR}/gate-result.json`;
writeFileSync(out, JSON.stringify({
  tool: call.name,
  gatekeeper_actor_id: gatekeeperActor,
  execution_mode: "stdio MCP client against connector/dist/src/index.js",
  invoked_at_utc: process.env.GATE_TIMESTAMP ?? "not_recorded",
  elapsed_ms: Math.round(elapsedMs * 1000) / 1000,
  response_bytes: Buffer.byteLength(text),
  result,
}, null, 2) + "\n");
console.log(`${call.name} ->`, JSON.stringify(result, null, 2));
console.log(`written: ${out} (response ${Buffer.byteLength(text)} bytes, ${elapsedMs.toFixed(1)} ms)`);
