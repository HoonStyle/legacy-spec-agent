/**
 * Deterministic chart emission — same data in, same bytes out.
 *
 * Emitted SVGs are standalone artifacts embedded in markdown reports, so they
 * are deliberately single-theme (light surface) and carry their own background.
 * Colors come from a validated reference palette; meaning is never carried by
 * color alone — every mark is direct-labeled, and each chart returns an `alt`
 * text equivalent for the report body.
 */

// Reference palette (validated): status roles + categorical slot 1 + neutrals,
// with a light "track" tint per role and shared surface/ink/grid neutrals.
const C = {
  surface: "#ffffff",
  ink: "#0f172a",
  inkSecondary: "#64748b",
  grid: "#eef1f6",
  track: "#eef1f6",
  good: "#16a34a", // verified / intact
  warning: "#f59e0b", // unverified / moved
  critical: "#e11d48", // drifted
  neutral: "#64748b", // orphaned (cited code deleted)
  series1: "#2563eb", // with-skill
  baseline: "#94a3b8", // de-emphasized comparison series
};

const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export interface Chart {
  format: "svg" | "mermaid";
  content: string;
  alt: string;
}

/** Deterministic FNV-1a hash → base36; namespaces gradient ids so multiple
 *  inline SVGs on one page never collide (same data → same id, by design). */
function hashId(seed: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Mix a #rrggbb color toward white by `amt` (0..1). */
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(c + (255 - c) * amt).toString(16).padStart(2, "0"),
  );
  return `#${ch.join("")}`;
}

/** A soft top-lighter vertical gradient per color, plus a url() resolver. */
function gradients(hash: string, colors: Record<string, string>): { defs: string; url: (k: string) => string } {
  const stops = Object.entries(colors)
    .map(
      ([k, hex]) =>
        `<linearGradient id="g${hash}-${k}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${lighten(hex, 0.2)}"/><stop offset="1" stop-color="${hex}"/></linearGradient>`,
    )
    .join("");
  return { defs: `<defs>${stops}</defs>`, url: (k) => `url(#g${hash}-${k})` };
}

function svgDoc(width: number, height: number, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">` +
    `<rect width="${width}" height="${height}" rx="14" fill="${C.surface}"/>` +
    body +
    `</svg>`
  );
}

function text(
  x: number,
  y: number,
  s: string,
  opts: { size?: number; color?: string; weight?: number; anchor?: string; mono?: boolean; spacing?: number } = {},
): string {
  const { size = 13, color = C.ink, weight = 400, anchor = "start", mono = false, spacing } = opts;
  const ls = spacing ? ` letter-spacing="${spacing}"` : "";
  const num = mono ? ` font-variant-numeric="tabular-nums"` : "";
  return `<text x="${x}" y="${y}" font-family="${mono ? MONO : FONT}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}"${ls}${num}>${s}</text>`;
}

/** A fully-rounded light track showing a bar's full extent. */
function track(x: number, y: number, w: number, h: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${C.track}"/>`;
}

/** Horizontal bar anchored at the baseline; rounded data-end, zero → a soft tick. */
function bar(x: number, y: number, w: number, h: number, fill: string, tickColor?: string): string {
  if (w <= 0) {
    return `<rect x="${x - 1}" y="${y}" width="3" height="${h}" rx="1.5" fill="${tickColor ?? fill}"/>`;
  }
  const r = Math.min(h / 2, w);
  return `<path d="M${x},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - r} z" fill="${fill}"/>`;
}

// ---------------------------------------------------------------------------
// coverage — verified vs unverified donut with hero percentage
// ---------------------------------------------------------------------------

export interface CoverageParams {
  verified: number;
  unverified: number;
  title?: string;
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

export function coverageChart(params: CoverageParams): Chart {
  const { verified, unverified } = params;
  const total = verified + unverified;
  const title = params.title ?? "Citation coverage";
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;

  const W = 440;
  const H = 210;
  const cx = 118;
  const cy = 116;
  const r = 66;
  const stroke = 22;

  const { defs, url } = gradients(hashId(`cov${title}${verified}/${unverified}`), {
    good: C.good,
    warning: C.warning,
  });

  // Background track ring is always a <circle> (keeps degenerate cases valid).
  let ring = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.track}" stroke-width="${stroke}"/>`;
  if (total > 0 && (verified === 0 || unverified === 0)) {
    ring += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${url(verified > 0 ? "good" : "warning")}" stroke-width="${stroke}"/>`;
  } else if (total > 0) {
    // half-gap wide enough that round caps clear each other (~3px visible gap)
    const halfGap = (stroke / 2 + 1.5) / r;
    const start = -Math.PI / 2;
    const split = start + (verified / total) * 2 * Math.PI;
    ring +=
      `<path d="${arcPath(cx, cy, r, start + halfGap, split - halfGap)}" fill="none" stroke="${url("good")}" stroke-width="${stroke}" stroke-linecap="round"/>` +
      `<path d="${arcPath(cx, cy, r, split + halfGap, start + 2 * Math.PI - halfGap)}" fill="none" stroke="${url("warning")}" stroke-width="${stroke}" stroke-linecap="round"/>`;
  }

  const lx = 248;
  const dot = (y: number, k: string) =>
    `<rect x="${lx}" y="${y - 10}" width="12" height="12" rx="4" fill="${url(k)}"/>`;
  const body =
    defs +
    text(22, 32, title, { size: 15, weight: 650, spacing: 0.2 }) +
    ring +
    text(cx, cy + 6, `${pct}%`, { size: 32, weight: 750, anchor: "middle", mono: true }) +
    text(cx, cy + 26, "verified", { size: 12, color: C.inkSecondary, anchor: "middle", spacing: 0.4 }) +
    dot(96, "good") +
    text(lx + 20, 96, "verified", { size: 13, color: C.inkSecondary }) +
    text(W - 22, 96, String(verified), { size: 14, weight: 700, anchor: "end", mono: true }) +
    dot(124, "warning") +
    text(lx + 20, 124, "unverified", { size: 13, color: C.inkSecondary }) +
    text(W - 22, 124, String(unverified), { size: 14, weight: 700, anchor: "end", mono: true }) +
    `<line x1="${lx}" y1="140" x2="${W - 22}" y2="140" stroke="${C.grid}" stroke-width="1"/>` +
    text(lx, 162, `${total} claims total`, { size: 12, color: C.inkSecondary }) +
    // machine-readable legend text kept for assertions/screen readers
    `<desc>verified · ${verified}; unverified · ${unverified}</desc>`;

  return {
    format: "svg",
    content: svgDoc(W, H, body),
    alt: `${title}: ${verified} of ${total} claims verified (${pct}%), ${unverified} unverified.`,
  };
}

// ---------------------------------------------------------------------------
// drift — intact/moved/drifted/orphaned status bars
// ---------------------------------------------------------------------------

export interface DriftParams {
  intact: number;
  moved: number;
  drifted: number;
  orphaned: number;
  title?: string;
}

export function driftChart(params: DriftParams): Chart {
  const title = params.title ?? "Drift check";
  const rows = [
    { label: "intact", value: params.intact, color: C.good },
    { label: "moved", value: params.moved, color: C.warning },
    { label: "drifted", value: params.drifted, color: C.critical },
    { label: "orphaned", value: params.orphaned, color: C.neutral },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));

  const W = 440;
  const rowH = 24;
  const gap = 12;
  const top = 56;
  const labelW = 92;
  const barMax = W - labelW - 54;
  const H = top + rows.length * (rowH + gap) - gap + 22;

  const { defs, url } = gradients(hashId(`drift${title}${rows.map((r) => r.value).join(",")}`), {
    good: C.good,
    warning: C.warning,
    critical: C.critical,
    neutral: C.neutral,
  });
  const key = ["good", "warning", "critical", "neutral"];

  let body = defs + text(22, 32, title, { size: 15, weight: 650, spacing: 0.2 });
  rows.forEach((row, i) => {
    const y = top + i * (rowH + gap);
    const w = Math.round((row.value / max) * barMax);
    body += text(labelW - 12, y + rowH / 2 + 4.5, row.label, { size: 13, anchor: "end", color: C.inkSecondary });
    body += track(labelW, y, barMax, rowH);
    body += bar(labelW, y, w, rowH, url(key[i]), row.color);
    const inside = w > 34;
    body += text(inside ? labelW + w - 10 : labelW + w + 10, y + rowH / 2 + 4.5, String(row.value), {
      size: 13.5,
      weight: 700,
      anchor: inside ? "end" : "start",
      color: inside ? "#ffffff" : C.ink,
      mono: true,
    });
  });

  const total = rows.reduce((n, r) => n + r.value, 0);
  return {
    format: "svg",
    content: svgDoc(W, H, body),
    alt: `${title}: ${rows.map((r) => `${r.label} ${r.value}`).join(", ")} (of ${total} citations).`,
  };
}

// ---------------------------------------------------------------------------
// benchmark — with-skill vs baseline grouped bars
// ---------------------------------------------------------------------------

export interface BenchmarkParams {
  title?: string;
  /** e.g. "citation coverage" — appended to alt text and axis note */
  unit?: string;
  /** values in [0, 1] are rendered as percentages */
  groups: Array<{ label: string; with_skill: number; baseline: number }>;
}

export function benchmarkChart(params: BenchmarkParams): Chart {
  const title = params.title ?? "With skill vs baseline";
  const groups = params.groups;
  const asPct = groups.every((g) => g.with_skill <= 1 && g.baseline <= 1);
  const fmt = (v: number) => (asPct ? `${Math.round(v * 100)}%` : String(v));
  const max = Math.max(1e-9, ...groups.flatMap((g) => [g.with_skill, g.baseline]));

  const W = 460;
  const rowH = 20;
  const innerGap = 6;
  const groupGap = 22;
  const top = 82;
  const labelW = 96;
  const barMax = W - labelW - 66;
  const groupH = rowH * 2 + innerGap;
  const H = top + groups.length * (groupH + groupGap) - groupGap + 16;

  const { defs, url } = gradients(hashId(`bench${title}${groups.map((g) => `${g.with_skill}/${g.baseline}`).join(",")}`), {
    series1: C.series1,
    baseline: C.baseline,
  });

  let body = defs + text(22, 32, title, { size: 15, weight: 650, spacing: 0.2 });
  // legend (2 series → always present) on its own row below the title
  body += `<rect x="22" y="48" width="11" height="11" rx="3" fill="${url("series1")}"/>`;
  body += text(39, 57, "with skill", { size: 12, color: C.inkSecondary });
  body += `<rect x="120" y="48" width="11" height="11" rx="3" fill="${url("baseline")}"/>`;
  body += text(137, 57, "baseline", { size: 12, color: C.inkSecondary });

  const drawRow = (y: number, value: number, k: string) => {
    const w = Math.round((value / max) * barMax);
    let s = track(labelW, y, barMax, rowH) + bar(labelW, y, w, rowH, url(k), k === "series1" ? C.series1 : C.baseline);
    const inside = w > 42;
    s += text(inside ? labelW + w - 9 : labelW + w + 9, y + rowH / 2 + 4, fmt(value), {
      size: 12.5,
      weight: 700,
      anchor: inside ? "end" : "start",
      color: inside ? "#ffffff" : C.inkSecondary,
      mono: true,
    });
    return s;
  };
  groups.forEach((g, i) => {
    const y = top + i * (groupH + groupGap);
    body += text(labelW - 12, y + groupH / 2 + 4, g.label, { size: 13, anchor: "end", weight: 600, color: C.ink });
    body += drawRow(y, g.with_skill, "series1");
    body += drawRow(y + rowH + innerGap, g.baseline, "baseline");
  });

  const unit = params.unit ? ` (${params.unit})` : "";
  return {
    format: "svg",
    content: svgDoc(W, H, body),
    alt:
      `${title}${unit}: ` +
      groups.map((g) => `${g.label} — with skill ${fmt(g.with_skill)}, baseline ${fmt(g.baseline)}`).join("; ") +
      ".",
  };
}

// ---------------------------------------------------------------------------
// architecture — Mermaid flowchart from call-graph edges
// ---------------------------------------------------------------------------

export interface ArchitectureParams {
  edges: Array<{ from: string; to: string; weight?: number }>;
  externals?: Array<{ module: string }>;
  direction?: "TD" | "LR";
  /** Group internal file nodes into `subgraph <package>` blocks by top-level dir. */
  cluster?: boolean;
}

function mermaidId(path: string): string {
  return path.replace(/[^A-Za-z0-9_]/g, "_");
}

function pkgOf(path: string): string {
  const i = path.indexOf("/");
  return i > 0 ? path.slice(0, i) : "(root)";
}

export function architectureChart(params: ArchitectureParams): Chart {
  const dir = params.direction ?? "TD";
  const lines: string[] = [`flowchart ${dir}`];
  const declared = new Set<string>();
  const nodeDecl = (path: string, external: boolean) =>
    external ? `${mermaidId(path)}[("${path}")]` : `${mermaidId(path)}["${path}"]`;

  const internal = new Set<string>();
  for (const e of params.edges) {
    internal.add(e.from);
    internal.add(e.to);
  }

  if (params.cluster) {
    // Declare internal nodes grouped by package; edges & externals follow.
    const byPkg = new Map<string, string[]>();
    for (const p of [...internal].sort()) (byPkg.get(pkgOf(p)) ?? byPkg.set(pkgOf(p), []).get(pkgOf(p))!).push(p);
    for (const [pkg, paths] of [...byPkg.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`  subgraph ${mermaidId(pkg)}["${pkg}"]`);
      for (const p of paths) {
        lines.push(`    ${nodeDecl(p, false)}`);
        declared.add(mermaidId(p));
      }
      lines.push(`  end`);
    }
  }

  const declare = (path: string, external: boolean) => {
    const id = mermaidId(path);
    if (declared.has(id)) return id;
    declared.add(id);
    lines.push(`  ${nodeDecl(path, external)}`);
    return id;
  };
  for (const e of params.edges) {
    const arrow = e.weight && e.weight > 1 ? `-->|${e.weight}|` : "-->";
    lines.push(`  ${declare(e.from, false)} ${arrow} ${declare(e.to, false)}`);
  }
  for (const ext of params.externals ?? []) declare(ext.module, true);

  return {
    format: "mermaid",
    content: lines.join("\n"),
    alt: `Module dependency graph: ${params.edges.length} ${params.cluster ? "clustered " : ""}internal edges, ${params.externals?.length ?? 0} external dependencies.`,
  };
}

// ---------------------------------------------------------------------------
// erd — Mermaid entity-relationship diagram from a data model
// ---------------------------------------------------------------------------

export interface ErdParams {
  entities: Array<{ name: string; fields?: Array<{ name: string; type: string }> }>;
  relations?: Array<{ from: string; to: string; field?: string; cardinality?: "one" | "many" }>;
}

/** erDiagram identifiers/types must be single alnum/underscore tokens. */
function erdToken(s: string): string {
  const t = s.replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return t.length > 0 ? t : "unknown";
}

export function erdChart(params: ErdParams): Chart {
  const lines: string[] = ["erDiagram"];
  for (const e of params.entities) {
    const name = erdToken(e.name);
    if (e.fields && e.fields.length > 0) {
      lines.push(`  ${name} {`);
      for (const f of e.fields) lines.push(`    ${erdToken(f.type)} ${erdToken(f.name)}`);
      lines.push(`  }`);
    } else {
      lines.push(`  ${name} {`);
      lines.push(`  }`);
    }
  }
  for (const r of params.relations ?? []) {
    const card = r.cardinality === "many" ? "||--o{" : "||--o|";
    lines.push(`  ${erdToken(r.from)} ${card} ${erdToken(r.to)} : ${erdToken(r.field ?? "has")}`);
  }
  return {
    format: "mermaid",
    content: lines.join("\n"),
    alt: `Data model: ${params.entities.length} entities, ${params.relations?.length ?? 0} relationships.`,
  };
}

// ---------------------------------------------------------------------------
// dispatcher for the MCP tool
// ---------------------------------------------------------------------------

export type EmitChartsParams =
  | ({ kind: "coverage" } & CoverageParams)
  | ({ kind: "drift" } & DriftParams)
  | ({ kind: "benchmark" } & BenchmarkParams)
  | ({ kind: "architecture" } & ArchitectureParams)
  | ({ kind: "erd" } & ErdParams);

export function emitChart(params: EmitChartsParams): Chart {
  switch (params.kind) {
    case "coverage":
      return coverageChart(params);
    case "drift":
      return driftChart(params);
    case "benchmark":
      return benchmarkChart(params);
    case "architecture":
      return architectureChart(params);
    case "erd":
      return erdChart(params);
    default:
      // Unreachable through the MCP schema; guards direct library callers.
      throw new Error(`emit_charts: unknown kind ${JSON.stringify((params as { kind?: unknown }).kind)}`);
  }
}
