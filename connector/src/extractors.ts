import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
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

export function extractProjectMeta(root: string): ProjectMeta {
  const rootAbs = resolve(root);
  const has = (p: string) => existsSync(join(rootAbs, p));
  const meta: ProjectMeta = {
    root: rootAbs,
    language: [],
    dependencies: [],
    run_commands: [],
    env_vars: [],
    has: {
      readme: has("README.md") || has("readme.md"),
      dockerfile: has("Dockerfile"),
      ci: existsSync(join(rootAbs, ".github/workflows")),
      tests: has("tests") || has("test"),
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

  meta.env_vars = scanEnvVars(rootAbs, pyFiles);
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
