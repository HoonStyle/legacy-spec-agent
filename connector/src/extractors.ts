import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, join, resolve, sep } from "node:path";
import type Parser from "tree-sitter";
import { parsePython, pythonFiles } from "./indexer.js";

// ===========================================================================
// extract_data_model — Python dataclasses / annotated classes → entities + relations
// ===========================================================================

export interface Field {
  name: string;
  type: string;
  line: number;
  optional: boolean;
}
export interface Entity {
  name: string;
  path: string;
  line: number;
  bases: string[];
  fields: Field[];
}
export interface Relation {
  from: string;
  to: string;
  field: string;
  cardinality: "one" | "many";
}
export interface DataModelResult {
  root: string;
  entities: Entity[];
  relations: Relation[];
  total_entities: number;
  /** present only when a limit truncated the entity list */
  truncated?: { returned: number; total: number; omitted: number };
}

/** Read the class-level annotated fields (`name: Type` / `name: Type = default`). */
function classFields(body: Parser.SyntaxNode): Field[] {
  const fields: Field[] = [];
  for (const stmt of body.namedChildren) {
    const assign = stmt.type === "expression_statement" ? stmt.namedChildren[0] : undefined;
    if (!assign || assign.type !== "assignment") continue;
    const left = assign.childForFieldName("left");
    const typeNode = assign.childForFieldName("type");
    if (!left || left.type !== "identifier" || !typeNode) continue;
    const type = typeNode.text.trim();
    fields.push({
      name: left.text,
      type,
      line: stmt.startPosition.row + 1,
      optional: /^Optional\[|(\|\s*None$)|=None$/.test(type.replace(/\s/g, "")) || assign.childForFieldName("right") != null,
    });
  }
  return fields;
}

function collectEntities(node: Parser.SyntaxNode, path: string, out: Entity[]): void {
  for (const child of node.namedChildren) {
    const classNode =
      child.type === "class_definition"
        ? child
        : child.type === "decorated_definition"
          ? child.namedChildren.find((n) => n.type === "class_definition")
          : undefined;
    if (classNode) {
      const name = classNode.childForFieldName("name")?.text ?? "<anonymous>";
      const supers = classNode.childForFieldName("superclasses");
      const bases = supers
        ? supers.namedChildren.map((n) => n.text).filter((t) => t && t !== "object")
        : [];
      const body = classNode.childForFieldName("body");
      const fields = body ? classFields(body) : [];
      // Only record classes that actually declare data (fields or a model base).
      const looksLikeModel =
        fields.length > 0 || bases.some((b) => /Model|Base|Schema|Entity/.test(b));
      if (looksLikeModel) {
        out.push({ name, path, line: classNode.startPosition.row + 1, bases, fields });
      }
      continue;
    }
    if (child.namedChildCount > 0) collectEntities(child, path, out);
  }
}

/** Head token of a type reference used to spot cross-entity references. */
function referencedNames(type: string): string[] {
  return Array.from(type.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)).map((m) => m[0]);
}

export function extractDataModel(root: string, opts: { subdir?: string; limit?: number } = {}): DataModelResult {
  const rootAbs = resolve(root);
  const files = pythonFiles(rootAbs, opts);
  const all: Entity[] = [];
  for (const path of files) {
    const { tree } = parsePython(rootAbs, path);
    collectEntities(tree.rootNode, path, all);
  }

  // Bound the entity list; relations are computed only over the kept entities.
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 5000);
  const entities = all.slice(0, limit);
  const names = new Set(entities.map((e) => e.name));
  const relations: Relation[] = [];
  const seen = new Set<string>();
  for (const e of entities) {
    for (const f of e.fields) {
      for (const ref of referencedNames(f.type)) {
        if (ref === e.name || !names.has(ref)) continue;
        const many = /\b(List|list|Sequence|Set|Tuple|Iterable)\[/.test(f.type) || /\[\]$/.test(f.type);
        const key = `${e.name}->${ref}:${f.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        relations.push({ from: e.name, to: ref, field: f.name, cardinality: many ? "many" : "one" });
      }
    }
  }
  const result: DataModelResult = { root: rootAbs, entities, relations, total_entities: all.length };
  if (entities.length < all.length) {
    result.truncated = { returned: entities.length, total: all.length, omitted: all.length - entities.length };
  }
  return result;
}

// ===========================================================================
// extract_project_meta — manifests, run commands, deps, env/config surface
// ===========================================================================

export interface EnvVar {
  key: string;
  path: string;
  line: number;
}
export interface TestCaseMeta {
  name: string;
  line: number;
  skipped?: boolean;
  requires_env_vars?: string[];
}
export interface TestFileMeta {
  path: string;
  framework: "node:test" | "pytest" | "unittest" | "unknown";
  cases: TestCaseMeta[];
  env_vars: EnvVar[];
}
export interface TestInventory {
  files: TestFileMeta[];
  total_files: number;
  total_cases: number;
  skipped_cases: number;
}
export interface ProjectMeta {
  root: string;
  name?: string;
  version?: string;
  description?: string;
  language: string[];
  package_manager?: string;
  dependencies: string[];
  run_commands: string[];
  env_vars: EnvVar[];
  tests: TestInventory;
  has: { readme: boolean; dockerfile: boolean; ci: boolean; tests: boolean };
}

function readJson(p: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
}

const ENV_PATTERNS: Array<{ re: RegExp; lang: string }> = [
  { re: /os\.environ\.get\(\s*['"]([A-Z0-9_]+)['"]/g, lang: "python" },
  { re: /os\.getenv\(\s*['"]([A-Z0-9_]+)['"]/g, lang: "python" },
  { re: /os\.environ\[\s*['"]([A-Z0-9_]+)['"]\s*\]/g, lang: "python" },
  { re: /process\.env\.([A-Z0-9_]+)/g, lang: "js" },
  { re: /process\.env\[\s*['"]([A-Z0-9_]+)['"]\s*\]/g, lang: "js" },
];

function scanEnvVars(rootAbs: string, files: string[]): EnvVar[] {
  const out: EnvVar[] = [];
  const seen = new Set<string>();
  for (const rel of files) {
    let src: string;
    try {
      src = readFileSync(join(rootAbs, rel), "utf8");
    } catch {
      continue;
    }
    const lines = src.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const { re } of ENV_PATTERNS) {
        for (const m of line.matchAll(re)) {
          const key = m[1];
          const id = `${key}@${rel}:${i + 1}`;
          if (seen.has(id) || seen.has(key)) continue;
          seen.add(id);
          seen.add(key);
          out.push({ key, path: rel, line: i + 1 });
        }
      }
    });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

const SOURCE_EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py"]);
const TEST_EXTS = SOURCE_EXTS;
const WALK_SKIP_DIRS = new Set([".git", "node_modules", "dist", "__pycache__", ".venv", "venv", ".tox"]);

function walkTextFiles(rootAbs: string): string[] {
  const files: string[] = [];
  const stack = [rootAbs];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!WALK_SKIP_DIRS.has(entry.name)) stack.push(abs);
      } else if (entry.isFile()) {
        files.push(abs);
      }
    }
  }
  return files.sort().map((f) => f.slice(rootAbs.length + 1).split(sep).join("/"));
}

function looksLikeSourceFile(rel: string): boolean {
  return SOURCE_EXTS.has(extname(basename(rel)));
}

function looksLikeTestFile(rel: string): boolean {
  const base = basename(rel);
  const ext = extname(base);
  if (!TEST_EXTS.has(ext)) return false;
  return (
    rel.startsWith("test/") ||
    rel.startsWith("tests/") ||
    rel.includes("/test/") ||
    rel.includes("/tests/") ||
    /\.test\.[cm]?[jt]sx?$/.test(base) ||
    /\.spec\.[cm]?[jt]sx?$/.test(base) ||
    /^test_.*\.py$/.test(base) ||
    /_test\.py$/.test(base)
  );
}

function scanEnvVarsInSource(rel: string, src: string): EnvVar[] {
  const out: EnvVar[] = [];
  const seen = new Set<string>();
  src.split(/\r?\n/).forEach((line, i) => {
    for (const { re } of ENV_PATTERNS) {
      for (const m of line.matchAll(re)) {
        const key = m[1];
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ key, path: rel, line: i + 1 });
      }
    }
  });
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

function testFramework(src: string, rel: string): TestFileMeta["framework"] {
  if (src.includes("node:test")) return "node:test";
  if (/\bpytest\b/.test(src)) return "pytest";
  if (/\bunittest\b/.test(src)) return "unittest";
  if (rel.endsWith(".py")) return "unknown";
  return "unknown";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function envKeysInText(src: string): string[] {
  const keys = new Set<string>();
  for (const { re } of ENV_PATTERNS) {
    for (const m of src.matchAll(re)) keys.add(m[1]);
  }
  return [...keys].sort();
}

function skippedOptionVars(src: string): Map<string, string[]> {
  const vars = new Map<string, string[]>();
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{([\s\S]*?)\}/g;
  for (const m of src.matchAll(re)) {
    if (/\bskip\s*:/.test(m[2])) vars.set(m[1], envKeysInText(m[2]));
  }
  return vars;
}

function lineNumberAt(src: string, index: number): number {
  return src.slice(0, index).split(/\r?\n/).length;
}

function callExpressionEnd(src: string, openParen: number): number {
  let depth = 0;
  let quote = "";
  for (let i = openParen; i < src.length; i += 1) {
    const ch = src[i];
    const next = src[i + 1];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = "";
      continue;
    }
    if ((ch === "/" && next === "/") || (ch === "/" && next === "*")) {
      const end = next === "/" ? src.indexOf("\n", i + 2) : src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + (next === "*" ? 1 : 0);
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") quote = ch;
    else if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractTestCases(src: string, rel: string): TestCaseMeta[] {
  const cases: TestCaseMeta[] = [];
  const lines = src.split(/\r?\n/);
  const skippedVars = skippedOptionVars(src);
  const js = /\b(test|it)(\.skip|\.only)?\(\s*(["'`])([^"'`]+)\3/g;
  for (const m of src.matchAll(js)) {
    const openParen = (m.index ?? 0) + m[0].indexOf("(");
    const end = callExpressionEnd(src, openParen);
    const call = end === -1 ? m[0] : src.slice(openParen, end + 1);
    const usedSkippedVars = [...skippedVars.entries()].filter(([name]) => new RegExp(`,\\s*${escapeRegExp(name)}\\b`).test(call));
    const inlineSkip = /,\s*\{[\s\S]*?\bskip\s*:/.test(call);
    const requiresEnvVars = [...new Set([...envKeysInText(call), ...usedSkippedVars.flatMap(([, vars]) => vars)])].sort();
    cases.push({
      name: m[4],
      line: lineNumberAt(src, m.index ?? 0),
      skipped: m[2] === ".skip" || inlineSkip || usedSkippedVars.length > 0,
      ...(requiresEnvVars.length > 0 ? { requires_env_vars: requiresEnvVars } : {}),
    });
  }

  let pendingDecorators: string[] = [];
  lines.forEach((line, i) => {
    const py = /^\s*def\s+(test_[A-Za-z0-9_]+)\s*\(/.exec(line);
    if (/^\s*@/.test(line)) {
      pendingDecorators.push(line);
      return;
    }
    if (pendingDecorators.length > 0 && !py) {
      if (line.trim() === "") {
        pendingDecorators = [];
      } else if (/^\s/.test(line) || /^[)\]},]/.test(line.trim())) {
        pendingDecorators.push(line);
      } else {
        pendingDecorators = [];
      }
      return;
    }
    if (!py) {
      pendingDecorators = [];
      return;
    }

    const decoratorText = pendingDecorators.join("\n");
    pendingDecorators = [];
    const requiresEnvVars = envKeysInText(decoratorText);
    cases.push({
      name: py[1],
      line: i + 1,
      skipped: /\b(?:skip|skipif|xfail)\b/.test(decoratorText),
      ...(requiresEnvVars.length > 0 ? { requires_env_vars: requiresEnvVars } : {}),
    });
  });
  return cases.sort((a, b) => a.line - b.line || a.name.localeCompare(b.name));
}

function extractTestInventory(rootAbs: string): TestInventory {
  const files: TestFileMeta[] = [];
  for (const rel of walkTextFiles(rootAbs).filter(looksLikeTestFile)) {
    let src: string;
    try {
      src = readFileSync(join(rootAbs, rel), "utf8");
    } catch {
      continue;
    }
    const cases = extractTestCases(src, rel);
    files.push({
      path: rel,
      framework: testFramework(src, rel),
      cases,
      env_vars: scanEnvVarsInSource(rel, src),
    });
  }
  const totalCases = files.reduce((n, f) => n + f.cases.length, 0);
  const skippedCases = files.reduce((n, f) => n + f.cases.filter((c) => c.skipped).length, 0);
  return {
    files,
    total_files: files.length,
    total_cases: totalCases,
    skipped_cases: skippedCases,
  };
}

export function extractProjectMeta(root: string): ProjectMeta {
  const rootAbs = resolve(root);
  const has = (p: string) => existsSync(join(rootAbs, p));
  const meta: ProjectMeta = {
    root: rootAbs,
    language: [],
    dependencies: [],
    run_commands: [],
    env_vars: [],
    tests: { files: [], total_files: 0, total_cases: 0, skipped_cases: 0 },
    has: {
      readme: has("README.md") || has("readme.md"),
      dockerfile: has("Dockerfile"),
      ci: existsSync(join(rootAbs, ".github/workflows")),
      tests: false,
    },
  };

  const pyFiles = pythonFiles(rootAbs);
  if (pyFiles.length > 0) meta.language.push("python");

  // package.json (npm)
  const pkg = readJson(join(rootAbs, "package.json"));
  if (pkg) {
    meta.language.push("javascript/typescript");
    meta.package_manager = "npm";
    meta.name ??= pkg.name as string;
    meta.version ??= pkg.version as string;
    meta.description ??= pkg.description as string;
    meta.dependencies.push(...Object.keys((pkg.dependencies as object) ?? {}));
    for (const [k] of Object.entries((pkg.scripts as object) ?? {})) meta.run_commands.push(`npm run ${k}`);
  }

  // Python deps
  if (has("requirements.txt")) {
    meta.package_manager ??= "pip";
    const reqs = readFileSync(join(rootAbs, "requirements.txt"), "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split(/[<>=!~ ]/)[0]);
    meta.dependencies.push(...reqs);
  }
  if (has("pyproject.toml")) {
    meta.package_manager ??= "pip";
    const toml = readFileSync(join(rootAbs, "pyproject.toml"), "utf8");
    meta.name ??= /^name\s*=\s*["']([^"']+)["']/m.exec(toml)?.[1];
    meta.version ??= /^version\s*=\s*["']([^"']+)["']/m.exec(toml)?.[1];
  }

  // Claude Code plugin manifest
  const plugin = readJson(join(rootAbs, ".claude-plugin/plugin.json"));
  if (plugin) {
    meta.name ??= plugin.name as string;
    meta.version ??= plugin.version as string;
    meta.description ??= plugin.description as string;
  }

  // Run commands from a plugin hooks manifest, Dockerfile, Makefile
  const hooks = readJson(join(rootAbs, "hooks/hooks.json"));
  if (hooks && typeof hooks.hooks === "object" && hooks.hooks) {
    for (const evt of Object.keys(hooks.hooks as object)) meta.run_commands.push(`hook: ${evt}`);
  }
  if (meta.has.dockerfile) meta.run_commands.push("docker build .");

  meta.tests = extractTestInventory(rootAbs);
  meta.has.tests = meta.tests.total_files > 0;
  const sourceFiles = walkTextFiles(rootAbs).filter((rel) => looksLikeSourceFile(rel) && !looksLikeTestFile(rel));
  meta.env_vars = scanEnvVars(rootAbs, sourceFiles);
  meta.dependencies = [...new Set(meta.dependencies)].sort();
  meta.run_commands = [...new Set(meta.run_commands)];
  meta.language = [...new Set(meta.language)];
  return meta;
}

// ===========================================================================
// extract_changelog — git history → grouped release notes
// ===========================================================================

export interface CommitEntry {
  sha: string;
  subject: string;
  type: string;
  scope?: string;
  author: string;
  date: string;
}
export interface ChangelogResult {
  root: string;
  count: number;
  grouped: Record<string, string[]>;
  entries: CommitEntry[];
}

const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/;

export function extractChangelog(root: string, opts: { max?: number } = {}): ChangelogResult {
  const rootAbs = resolve(root);
  const max = Math.min(Math.max(opts.max ?? 100, 1), 1000);
  let raw: string;
  try {
    raw = execFileSync(
      "git",
      ["-C", rootAbs, "log", `-n`, String(max), "--date=short", "--format=%h%x1f%s%x1f%an%x1f%ad", "--", "."],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 },
    );
  } catch (e) {
    throw new Error(`cannot read git history: ${(e as Error).message.split("\n")[0]}`);
  }

  const entries: CommitEntry[] = [];
  const grouped: Record<string, string[]> = {};
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const [sha, subject, author, date] = line.split("\x1f");
    const m = CONVENTIONAL.exec(subject ?? "");
    const type = m ? m[1].toLowerCase() : "other";
    const scope = m?.[2];
    const clean = m ? m[3] : subject;
    entries.push({ sha, subject, type, scope, author, date });
    (grouped[type] ??= []).push(scope ? `**${scope}**: ${clean}` : clean);
  }
  return { root: rootAbs, count: entries.length, grouped, entries };
}
