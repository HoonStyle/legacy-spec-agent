/**
 * render_report — assemble the deliverables in a directory into one
 * self-contained tabbed HTML page, deterministically.
 *
 * Inputs are the files the skill already emits: the known markdown
 * deliverables, audit_log.jsonl, and a charts/ directory. SVG charts are
 * inlined; PNG diagrams become data URIs. A mermaid fence inside DOC.md is
 * replaced by charts/DOC.<n>.(svg|png) when that asset exists (n = 1-based
 * fence order); otherwise the mermaid source is shown as a code block, so a
 * missing render never breaks the page. The result is written next to the
 * deliverables as REPORT.html, and the tool returns a small summary instead
 * of the page itself.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveWithinRoot } from "./matching.js";

const DOCS: Array<{ file: string; label: string }> = [
  { file: "SPEC.md", label: "SPEC" },
  { file: "ARCHITECTURE.md", label: "Architecture" },
  { file: "DRIFT_REPORT.md", label: "Drift" },
  { file: "INTERFACES.md", label: "Interfaces" },
  { file: "DATA_MODEL.md", label: "Data model" },
  { file: "ONBOARDING.md", label: "Onboarding" },
  { file: "TESTCASES.md", label: "Tests" },
  { file: "RISKS.md", label: "Risks" },
  { file: "CHANGELOG.md", label: "Changelog" },
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CITE_RE = /^[\w./\\-]+\.(py|ts|js|jsx|tsx|md|json|jsonl|sh|mjs):\d+(-\d+)?$/;

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, (_, c: string) =>
      CITE_RE.test(c) ? `<code class="cite">${c}</code>` : `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2">$1</a>`);
}

/** Minimal deterministic markdown → HTML (headings, tables, fences, lists, quotes). */
export function mdToHtml(md: string, diagrams: string[] = []): { html: string; mermaidFallbacks: number } {
  const queue = [...diagrams];
  let mermaidFallbacks = 0;
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      if (lang === "mermaid" && queue.length > 0) {
        out.push(`<div class="diagram">${queue.shift()}</div>`);
      } else {
        if (lang === "mermaid") mermaidFallbacks++;
        out.push(`<pre class="block"><code>${esc(buf.join("\n"))}</code></pre>`);
      }
      continue;
    }
    if (/^\|/.test(line) && /^\|[\s:-]+\|/.test(lines[i + 1] ?? "")) {
      const rows: string[] = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r: string) => r.replace(/^\||\|$/g, "").split("|").map((c) => inline(esc(c.trim())));
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(
        `<div class="tablewrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>` +
          `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
      );
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      out.push(`<h${h[1].length + 1}>${inline(esc(h[2]))}</h${h[1].length + 1}>`);
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${inline(esc(buf.join(" ")))}</blockquote>`);
      continue;
    }
    if (/^---+\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) buf.push(esc(lines[i++].replace(/^\s*[-*]\s+/, "")));
      out.push(`<ul>${buf.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) buf.push(esc(lines[i++].replace(/^\s*\d+\.\s+/, "")));
      out.push(`<ol>${buf.map((b) => `<li>${inline(b)}</li>`).join("")}</ol>`);
      continue;
    }
    if (line.trim() === "") { i++; continue; }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#|>|```|\||---|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]))
      buf.push(esc(lines[i++]));
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return { html: out.join("\n"), mermaidFallbacks };
}

/** charts/DOC.<n>.(svg|png) → embeddable HTML, or undefined when absent. */
function diagramAsset(chartsDir: string, docBase: string, n: number): string | undefined {
  const svg = join(chartsDir, `${docBase}.${n}.svg`);
  if (existsSync(svg)) return readFileSync(svg, "utf8").replace(/<\?xml[^>]*\?>/, "");
  const png = join(chartsDir, `${docBase}.${n}.png`);
  if (existsSync(png)) {
    return `<img alt="${docBase} diagram ${n}" src="data:image/png;base64,${readFileSync(png).toString("base64")}">`;
  }
  return undefined;
}

const CSS = `
*{box-sizing:border-box}body{margin:0;background:#eef1f5;color:#0f172a;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI','Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.65;-webkit-font-smoothing:antialiased}
.wrap{max-width:980px;margin:0 auto;padding:0 22px}header{padding:38px 0 14px}
h1{font-size:clamp(22px,4vw,32px);margin:0 0 6px;letter-spacing:-.01em}.sub{color:#64748b;font-size:14px;margin:0}
nav{position:sticky;top:0;background:#fffc;backdrop-filter:blur(8px);border-bottom:1px solid #dfe5ec;z-index:9;margin-top:14px}
.tabs{display:flex;gap:2px;max-width:980px;margin:0 auto;padding:0 14px;overflow-x:auto}
.tab{appearance:none;border:0;background:none;cursor:pointer;font:inherit;font-size:14px;font-weight:600;color:#64748b;padding:13px 11px;white-space:nowrap;position:relative}
.tab[aria-selected=true]{color:#0f172a}.tab[aria-selected=true]::after{content:"";position:absolute;left:8px;right:8px;bottom:-1px;height:2px;background:#2563eb;border-radius:2px}
.tab:focus-visible{outline:2px solid #2563eb;outline-offset:2px;border-radius:6px}
main{padding:22px 0 64px}section{display:none}section.on{display:block}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:6px 0 18px}
.stat{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px}
.stat .n{font-size:24px;font-weight:750;font-variant-numeric:tabular-nums}.stat .ok{color:#16a34a}.stat .warn{color:#b45309}.stat .l{font-size:12px;color:#64748b}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;overflow-x:auto}.card.wide{grid-column:1/-1}
.card svg,.card img,.diagram svg,.diagram img{display:block;margin:0 auto;max-width:100%;height:auto}
@media(max-width:720px){.grid{grid-template-columns:1fr}}
h2{font-size:19px;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}h3{font-size:16px;margin:20px 0 6px}
p{max-width:72ch}blockquote{border-left:3px solid #2563eb;background:#eff4ff;border-radius:0 8px 8px 0;padding:8px 14px;margin:12px 0;color:#334155}
code{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:.86em;background:#e8edf4;padding:1px 5px;border-radius:5px}
.cite{color:#1d4ed8;background:#e4ecfd;white-space:nowrap}
pre.block{background:#0f172a;color:#e2e8f0;border-radius:10px;padding:14px;overflow-x:auto}pre.block code{background:none;color:inherit;padding:0}
.tablewrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px;margin:12px 0;background:#fff}
table{border-collapse:collapse;width:100%;font-size:13.5px}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #eef2f7;vertical-align:top}
thead th{font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}tbody tr:last-child td{border-bottom:0}
.badge{font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px}.badge.verified{background:#dcfce7;color:#15803d}.badge.flagged{background:#fef3c7;color:#b45309}
.diagram{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin:12px 0;overflow-x:auto}
footer{color:#94a3b8;font-size:12.5px;padding:18px 0;border-top:1px solid #e2e8f0}
`;

const JS = `
const tabs=[...document.querySelectorAll('.tab')],secs=[...document.querySelectorAll('section')];
function go(id){tabs.forEach(t=>t.setAttribute('aria-selected',t.dataset.t===id));secs.forEach(s=>s.classList.toggle('on',s.id==='s-'+id));}
tabs.forEach(t=>t.addEventListener('click',()=>go(t.dataset.t)));
`;

export interface ReportParams {
  /** Directory (relative to the connector root) holding the deliverables. Default ".". */
  dir?: string;
  title?: string;
}

export interface ReportResult {
  path: string;
  bytes: number;
  tabs: string[];
  charts_embedded: number;
  mermaid_fallbacks: number;
}

interface AuditEntry {
  id?: string;
  action?: string;
  claim?: string;
  evidence?: string;
  note?: string;
}

interface DocTab {
  id: string;
  label: string;
  file: string;
  markdown: string;
  html: string;
}

function readAudit(path: string): AuditEntry[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function citationsIn(markdown: string): string[] {
  return Array.from(markdown.matchAll(/`([^`]+)`/g))
    .map((m) => m[1])
    .filter((c) => CITE_RE.test(c));
}

function citationPath(citation: string): { path: string; line: number } {
  const [path, line] = citation.replace(/-\d+$/, "").split(/:(?=\d+$)/);
  return { path, line: Number(line) };
}

function qualityTab(root: string, docs: DocTab[], audit: AuditEntry[]): string {
  const citations = docs.flatMap((doc) =>
    citationsIn(doc.markdown).map((citation) => ({ doc: doc.file, citation })),
  );
  const auditEvidence = new Set(audit.map((e) => e.evidence).filter((e): e is string => !!e));
  let missing = 0;
  let lineMismatch = 0;
  const byDoc = new Map<string, { citations: number; missing: number; lineMismatch: number; auditCovered: number }>();

  for (const item of citations) {
    const entry = byDoc.get(item.doc) ?? { citations: 0, missing: 0, lineMismatch: 0, auditCovered: 0 };
    entry.citations++;
    if (auditEvidence.has(item.citation)) entry.auditCovered++;
    const { path, line } = citationPath(item.citation);
    try {
      const file = resolveWithinRoot(root, path);
      if (!existsSync(file) || !statSync(file).isFile()) {
        missing++;
        entry.missing++;
      } else {
        const lines = readFileSync(file, "utf8").split(/\r?\n/);
        if (line < 1 || line > lines.length) {
          lineMismatch++;
          entry.lineMismatch++;
        }
      }
    } catch {
      missing++;
      entry.missing++;
    }
    byDoc.set(item.doc, entry);
  }

  const auditCovered = citations.filter((c) => auditEvidence.has(c.citation)).length;
  const verified = audit.filter((e) => e.action === "verified").length;
  const flagged = audit.filter((e) => e.action === "flagged").length;
  const score = citations.length === 0
    ? 0
    : Math.round(((citations.length - missing - lineMismatch) / citations.length) * 100);
  const coverage = citations.length === 0 ? 0 : Math.round((auditCovered / citations.length) * 100);
  const rows = [...byDoc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([file, r]) =>
        `<tr><td><code>${esc(file)}</code></td><td>${r.citations}</td><td>${r.auditCovered}</td>` +
        `<td>${r.missing}</td><td>${r.lineMismatch}</td></tr>`,
    )
    .join("");

  return (
    `<h2>Generated documentation quality</h2>` +
    `<p>This tab is produced by <code>render_report</code> from the markdown deliverables and <code>audit_log.jsonl</code>; it is not a hand-authored output file.</p>` +
    `<div class="stats"><div class="stat"><div class="n">${docs.length}</div><div class="l">markdown docs</div></div>` +
    `<div class="stat"><div class="n">${citations.length}</div><div class="l">citations</div></div>` +
    `<div class="stat"><div class="n ok">${score}%</div><div class="l">line-valid citations</div></div>` +
    `<div class="stat"><div class="n">${coverage}%</div><div class="l">audit coverage</div></div>` +
    `<div class="stat"><div class="n ok">${verified}</div><div class="l">verified audit rows</div></div>` +
    `<div class="stat"><div class="n warn">${flagged}</div><div class="l">flagged audit rows</div></div></div>` +
    `<h3>Per-document citation checks</h3>` +
    `<div class="tablewrap"><table><thead><tr><th>document</th><th>citations</th><th>audit-covered</th><th>missing files</th><th>line mismatches</th></tr></thead>` +
    `<tbody>${rows}</tbody></table></div>` +
    `<h3>Remaining review caveat</h3>` +
    `<p>Line-valid citations prove the target file and line exist. They do not prove that every natural-language claim is semantically supported; that remains a critic/reviewer responsibility.</p>`
  );
}

export function renderReport(root: string, params: ReportParams = {}): ReportResult {
  const base = resolveWithinRoot(root, params.dir ?? ".");
  if (!existsSync(base) || !statSync(base).isDirectory()) {
    throw new Error(`report dir not found: ${params.dir ?? "."}`);
  }
  const chartsDir = join(base, "charts");
  const title = params.title ?? "Reconstructed spec — report";

  let mermaidFallbacks = 0;
  const tabs: Array<{ id: string; label: string; html: string }> = [];

  // Overview: audit stats + every chart in charts/ (sorted, deterministic).
  let overview = "";
  const auditPath = join(base, "audit_log.jsonl");
  const audit = readAudit(auditPath);
  if (audit.length > 0) {
    const verified = audit.filter((e) => e.action === "verified").length;
    const flagged = audit.filter((e) => e.action === "flagged").length;
    overview +=
      `<div class="stats"><div class="stat"><div class="n">${audit.length}</div><div class="l">claims</div></div>` +
      `<div class="stat"><div class="n ok">${verified}</div><div class="l">verified</div></div>` +
      `<div class="stat"><div class="n warn">${flagged}</div><div class="l">flagged</div></div></div>`;
  }
  let chartsEmbedded = 0;
  if (existsSync(chartsDir)) {
    const files = readdirSync(chartsDir).sort();
    const cards: string[] = [];
    for (const f of files) {
      if (/^\w[\w-]*\.\d+\.(svg|png)$/.test(f)) continue; // doc-bound diagrams appear inside their tab
      if (f.endsWith(".svg")) {
        cards.push(`<div class="card">${readFileSync(join(chartsDir, f), "utf8").replace(/<\?xml[^>]*\?>/, "")}</div>`);
        chartsEmbedded++;
      } else if (f.endsWith(".png")) {
        cards.push(
          `<div class="card wide"><img alt="${esc(f)}" src="data:image/png;base64,${readFileSync(join(chartsDir, f)).toString("base64")}"></div>`,
        );
        chartsEmbedded++;
      }
    }
    if (cards.length > 0) overview += `<div class="grid">${cards.join("")}</div>`;
  }
  if (overview) tabs.push({ id: "overview", label: "Overview", html: overview });

  const docTabs: DocTab[] = [];
  for (const doc of DOCS) {
    const p = join(base, doc.file);
    if (!existsSync(p)) continue;
    const docBase = doc.file.replace(/\.md$/, "");
    const diagrams: string[] = [];
    for (let n = 1; ; n++) {
      const asset = diagramAsset(chartsDir, docBase, n);
      if (!asset) break;
      diagrams.push(asset);
      chartsEmbedded++;
    }
    const { html, mermaidFallbacks: mf } = mdToHtml(readFileSync(p, "utf8"), diagrams);
    const markdown = readFileSync(p, "utf8");
    mermaidFallbacks += mf;
    const tab = { id: docBase.toLowerCase(), label: doc.label, file: doc.file, markdown, html };
    docTabs.push(tab);
    tabs.push(tab);
  }

  if (docTabs.length > 0) {
    tabs.push({ id: "quality", label: "Quality", html: qualityTab(root, docTabs, audit) });
  }

  // Audit log as its own tab.
  if (audit.length > 0) {
    const rows = audit
      .map(
        (e) =>
          `<tr><td><code>${esc(e.id ?? "")}</code></td><td><span class="badge ${esc(e.action ?? "")}">${esc(e.action ?? "")}</span></td>` +
          `<td>${esc(e.claim ?? "")}</td><td><code class="cite">${esc(e.evidence ?? "")}</code></td><td>${esc(e.note || "—")}</td></tr>`,
      )
      .join("");
    tabs.push({
      id: "audit",
      label: "Audit log",
      html:
        `<div class="tablewrap"><table><thead><tr><th>id</th><th>action</th><th>claim</th><th>evidence</th><th>note</th></tr></thead>` +
        `<tbody>${rows}</tbody></table></div>`,
    });
  }

  if (tabs.length === 0) throw new Error("nothing to report: no known deliverables found in the directory");

  const page =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(title)}</title><style>${CSS}</style></head><body>` +
    `<header class="wrap"><h1>${esc(title)}</h1><p class="sub">Generated by legacy-spec-agent · every claim cites its source</p></header>` +
    `<nav><div class="tabs" role="tablist">${tabs
      .map((t, i) => `<button class="tab" role="tab" data-t="${t.id}" aria-selected="${i === 0}">${esc(t.label)}</button>`)
      .join("")}</div></nav>` +
    `<main class="wrap">${tabs
      .map((t, i) => `<section id="s-${t.id}"${i === 0 ? ' class="on"' : ""}>${t.html}</section>`)
      .join("")}</main>` +
    `<footer class="wrap">legacy-spec-agent · deterministic report</footer>` +
    `<script>${JS}</script></body></html>`;

  const outPath = join(base, "REPORT.html");
  writeFileSync(outPath, page);
  return {
    path: outPath,
    bytes: Buffer.byteLength(page),
    tabs: tabs.map((t) => t.label),
    charts_embedded: chartsEmbedded,
    mermaid_fallbacks: mermaidFallbacks,
  };
}
