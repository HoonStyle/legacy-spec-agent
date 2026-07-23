import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "web-tree-sitter";
import type { ModuleIndex, Symbol, IndexResult, PackageSummary, Edge, CallGraphResult } from "./indexer.js";
import { buildCallGraph, packageOf } from "./indexer.js";
import { extractDataModel } from "./extractors.js";
import type { DataModelResult, Entity, Field, Relation } from "./extractors.js";
import { buildTypeScriptResolver } from "./ts-resolve.js";

export type SupportedLanguage = "python" | "typescript" | "java" | "csharp" | "go";
type Grammar = "python" | "javascript" | "typescript" | "tsx" | "java" | "c_sharp" | "go";
const EXTENSIONS = new Map<string, SupportedLanguage>([
  [".py", "python"], [".js", "typescript"], [".jsx", "typescript"], [".mjs", "typescript"], [".cjs", "typescript"],
  [".ts", "typescript"], [".tsx", "typescript"], [".java", "java"], [".cs", "csharp"], [".go", "go"],
]);
const SKIP = new Set([".git", "node_modules", "dist", "bin", "obj", "__pycache__", ".venv", "venv", ".tox"]);
const OTHER_SOURCE_EXTENSIONS = new Set([
  ".bash", ".c", ".cc", ".clj", ".cljs", ".cpp", ".dart", ".ex", ".exs", ".erl", ".fs", ".fsx",
  ".groovy", ".hrl", ".hs", ".kt", ".kts", ".lhs", ".lua", ".php", ".pl", ".pm", ".r", ".rb",
  ".rs", ".scala", ".sh", ".sol", ".svelte", ".swift", ".vb", ".vue", ".zsh",
]);
const GRAMMAR_BY_EXTENSION = new Map<string, Grammar>([
  [".py", "python"], [".js", "javascript"], [".mjs", "javascript"], [".cjs", "javascript"],
  [".jsx", "tsx"], [".ts", "typescript"], [".tsx", "tsx"], [".java", "java"], [".cs", "c_sharp"], [".go", "go"],
]);
const TYPES: Record<SupportedLanguage, Record<string, "class" | "function" | "method">> = {
  python: { class_definition: "class", function_definition: "function" },
  typescript: { class_declaration: "class", interface_declaration: "class", type_alias_declaration: "class", function_declaration: "function", method_definition: "method" },
  java: { class_declaration: "class", interface_declaration: "class", enum_declaration: "class", record_declaration: "class", method_declaration: "method", constructor_declaration: "method" },
  csharp: { class_declaration: "class", interface_declaration: "class", struct_declaration: "class", record_declaration: "class", enum_declaration: "class", method_declaration: "method", constructor_declaration: "method" },
  go: { type_spec: "class", function_declaration: "function", method_declaration: "method" },
};
let initialized: Promise<void> | undefined;
const languages = new Map<Grammar, Parser.Language>();
async function languageFor(grammar: Grammar) {
  initialized ??= Parser.init(); await initialized;
  let loaded = languages.get(grammar);
  if (!loaded) {
    const here = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    loaded = await Parser.Language.load(join(here, "node_modules", "tree-sitter-wasms", "out", `tree-sitter-${grammar}.wasm`));
    languages.set(grammar, loaded);
  }
  return loaded;
}
interface SourceFile { path: string; language: SupportedLanguage; grammar: Grammar }
interface ParsedSource {
  source: string;
  tree: Parser.Tree;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
}
interface ParsedAccess extends ParsedSource { cacheHit: boolean }
export interface AnalysisMetrics {
  supported_files: number;
  source_bytes: number;
  wasm_parsed_files: number;
  wasm_cache_hits: number;
  wasm_cache_misses: number;
  structured_response_bytes: number;
}
type Measured<T> = T & { analysis_metrics: AnalysisMetrics };
const MAX_PARSED_FILES = 512;
const parsedSources = new Map<string, ParsedSource>();

export function clearMultiLanguageCache() {
  for (const cached of parsedSources.values()) cached.tree.delete();
  parsedSources.clear();
}

async function parsedSource(root: string, file: SourceFile): Promise<ParsedAccess> {
  const absolute = join(root, file.path);
  const stat = statSync(absolute);
  const cached = parsedSources.get(absolute);
  if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs && cached.ctimeMs === stat.ctimeMs) {
    parsedSources.delete(absolute);
    parsedSources.set(absolute, cached);
    return { ...cached, cacheHit: true };
  }
  if (cached) {
    cached.tree.delete();
    parsedSources.delete(absolute);
  }
  const source = readFileSync(absolute, "utf8");
  const language = await languageFor(file.grammar);
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(source);
  parser.delete();
  const parsed = { source, tree, size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs };
  parsedSources.set(absolute, parsed);
  while (parsedSources.size > MAX_PARSED_FILES) {
    const oldest = parsedSources.entries().next().value as [string, ParsedSource] | undefined;
    if (!oldest) break;
    oldest[1].tree.delete();
    parsedSources.delete(oldest[0]);
  }
  return { ...parsed, cacheHit: false };
}

function metricAccumulator(root: string, sourceFiles: SourceFile[]) {
  return {
    supported_files: sourceFiles.length,
    source_bytes: sourceFiles.reduce((total, file) => total + statSync(join(root, file.path)).size, 0),
    wasm_parsed_files: 0,
    wasm_cache_hits: 0,
    wasm_cache_misses: 0,
    structured_response_bytes: 0,
  } satisfies AnalysisMetrics;
}

function recordAccess(metrics: AnalysisMetrics, access: ParsedAccess) {
  metrics.wasm_parsed_files++;
  if (access.cacheHit) metrics.wasm_cache_hits++; else metrics.wasm_cache_misses++;
}

function measured<T extends object>(result: T, metrics: AnalysisMetrics): Measured<T> {
  metrics.structured_response_bytes = Buffer.byteLength(JSON.stringify(result));
  return Object.assign(result, { analysis_metrics: metrics });
}

function files(root: string, subdir?: string): { supported: SourceFile[]; unsupported: number } {
  const rootAbs = realpathSync(resolve(root)); const requested = subdir ? resolve(rootAbs, subdir) : rootAbs;
  if (requested !== rootAbs && !requested.startsWith(rootAbs + sep)) throw new Error(`subdir escapes connector root: ${subdir}`);
  const start = realpathSync(requested);
  if (start !== rootAbs && !start.startsWith(rootAbs + sep)) throw new Error(`subdir escapes connector root through symlink: ${subdir}`);
  const out: SourceFile[] = []; let unsupported = 0; const stack = [start];
  while (stack.length) {
    const dir = stack.pop()!; let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const abs = join(dir, entry.name); const rel = relative(rootAbs, abs).split(sep).join("/");
      if (entry.isDirectory()) { if (!SKIP.has(entry.name) && rel !== ".claude/worktrees") stack.push(abs); continue; }
      const extension = extname(entry.name).toLowerCase(); const language = EXTENSIONS.get(extension);
      const grammar = GRAMMAR_BY_EXTENSION.get(extension);
      if (entry.isFile() && language && grammar) out.push({ path: rel, language, grammar }); else if (entry.isFile() && OTHER_SOURCE_EXTENSIONS.has(extension)) unsupported++;
    }
  }
  return { supported: out.sort((a, b) => a.path.localeCompare(b.path)), unsupported };
}
function signature(node: Parser.SyntaxNode, source: string): string {
  const text = source.slice(node.startIndex, node.endIndex); const cut = text.search(/[\n{]/); return (cut >= 0 ? text.slice(0, cut) : text).trim().replace(/\s+/g, " ").slice(0, 300);
}
function symbolName(node: Parser.SyntaxNode, source: string): string | undefined {
  const named = node.childForFieldName("name"); if (named) return source.slice(named.startIndex, named.endIndex);
  return node.namedChildren.find((child) => ["identifier", "type_identifier", "property_identifier"].includes(child.type))?.text;
}
function collect(node: Parser.SyntaxNode, source: string, language: SupportedLanguage, className: string | undefined, out: Symbol[]) {
  const kind = TYPES[language][node.type]; let nextClass = className;
  if (kind) {
    const name = symbolName(node, source);
    if (name) {
      const actualKind = kind === "function" && className ? "method" : kind;
      out.push({ name: actualKind === "method" && className ? `${className}.${name}` : name, kind: actualKind, line: node.startPosition.row + 1, end_line: node.endPosition.row + 1, signature: signature(node, source) });
      if (kind === "class") nextClass = name;
    }
  }
  for (const child of node.namedChildren) collect(child, source, language, nextClass, out);
}
export async function indexSymbolsMulti(root: string, opts: { subdir?: string; limit?: number; granularity?: "file" | "package" } = {}): Promise<Measured<IndexResult>> {
  const rootAbs = resolve(root); const walked = files(rootAbs, opts.subdir); const sourceFiles = walked.supported; const metrics = metricAccumulator(rootAbs, sourceFiles); const modules: ModuleIndex[] = [];
  for (const file of sourceFiles) {
    const access = await parsedSource(rootAbs, file); recordAccess(metrics, access); const { source, tree } = access;
    const symbols: Symbol[] = []; collect(tree.rootNode, source, file.language, undefined, symbols); modules.push({ path: file.path, symbols });
  }
  const total = modules.reduce((n, m) => n + m.symbols.length, 0); const granularity = opts.granularity ?? "file";
  const base = { root: rootAbs, granularity, files: modules.length, unsupported_files: walked.unsupported, total_symbols: total } as const;
  if (granularity === "package") {
    const map = new Map<string, PackageSummary>(); for (const module of modules) { const key = packageOf(module.path); const p = map.get(key) ?? { package: key, files: 0, symbols: 0 }; p.files++; p.symbols += module.symbols.length; map.set(key, p); }
    return measured({ ...base, modules: [], packages: [...map.values()].sort((a, b) => a.package.localeCompare(b.package)) }, metrics);
  }
  const limit = Math.min(Math.max(opts.limit ?? 2000, 1), 100000); const kept: ModuleIndex[] = []; let count = 0;
  for (const module of modules) { if (count > 0 && count + module.symbols.length > limit) break; kept.push(module); count += module.symbols.length; if (count >= limit) break; }
  const result: IndexResult = { ...base, modules: kept }; if (kept.length < modules.length) result.truncated = { returned: count, total, omitted: total - count }; return measured(result, metrics);
}

const IMPORT_NODES: Record<SupportedLanguage, Set<string>> = {
  python: new Set(["import_statement", "import_from_statement"]), typescript: new Set(["import_statement"]), java: new Set(["import_declaration"]), csharp: new Set(["using_directive"]), go: new Set(["import_spec"]),
};
function importTarget(text: string, language: SupportedLanguage): string | undefined {
  if (language === "csharp") return text.match(/^using\s+(?:static\s+)?([\w.]+)/)?.[1];
  if (language === "java") return text.match(/^import\s+(?:static\s+)?([\w.]+)/)?.[1];
  if (language === "go") return text.match(/["`]([^"`]+)["`]/)?.[1];
  if (language === "typescript") return text.match(/(?:from\s+|import\s*)["']([^"']+)/)?.[1];
  return text.match(/^(?:from|import)\s+([\w.]+)/)?.[1];
}
export async function buildCallGraphMulti(root: string, opts: { subdir?: string; limit?: number; granularity?: "file" | "package" } = {}): Promise<Measured<CallGraphResult>> {
  const rootAbs = resolve(root); const sourceFiles = files(rootAbs, opts.subdir).supported; const metrics = metricAccumulator(rootAbs, sourceFiles); const pythonGraph = buildCallGraph(rootAbs, { subdir: opts.subdir, granularity: "file", limit: 20000 }); const edges: Edge[] = [...pythonGraph.edges]; let nonPythonResolved = 0; const external = new Map<string, Set<string>>(pythonGraph.externals.map((item) => [item.module, new Set(item.imported_by)]));
  const goMod = join(rootAbs, "go.mod");
  const goModule = existsSync(goMod) ? readFileSync(goMod, "utf8").match(/^\s*module\s+(\S+)/m)?.[1] : undefined;
  const resolveTypeScript = buildTypeScriptResolver(rootAbs, sourceFiles);
  const resolveTarget = (from: SourceFile, target: string): string | undefined => {
    if (from.language === "typescript") return resolveTypeScript(from.path, target);
    if (from.language === "java") {
      const suffix = `${target.replace(/\./g, "/")}.java`;
      return sourceFiles.find((file) => file.language === "java" && (file.path === suffix || file.path.endsWith(`/${suffix}`)))?.path;
    }
    if (from.language === "go" && goModule && (target === goModule || target.startsWith(`${goModule}/`))) {
      const packagePath = target === goModule ? "." : target.slice(goModule.length + 1);
      return sourceFiles.find((file) => file.language === "go" && dirname(file.path).split(sep).join("/") === packagePath)?.path;
    }
    return undefined;
  };
  for (const file of sourceFiles) {
    if (file.language === "python") continue;
    const access = await parsedSource(rootAbs, file); recordAccess(metrics, access); const { source, tree } = access;
    const visit = (node: Parser.SyntaxNode) => { if (IMPORT_NODES[file.language].has(node.type)) { const target = importTarget(source.slice(node.startIndex, node.endIndex), file.language); if (target) { const internal = resolveTarget(file, target); if (internal) { edges.push({ from: file.path, to: internal, import: target, line: node.startPosition.row + 1 }); nonPythonResolved++; } else external.set(target, (external.get(target) ?? new Set()).add(file.path)); } } for (const child of node.namedChildren) visit(child); };
    visit(tree.rootNode);
  }
  const externals = [...external].map(([module, importers]) => ({ module, imported_by: [...importers].sort() })).sort((a, b) => a.module.localeCompare(b.module));
  // pythonGraph.edges may already be capped at the indexer's hard 20,000-edge
  // response limit. Its resolved count is deliberately pre-truncation, so use
  // that count rather than the number of Python edges copied into this output.
  const contract = { graph_type: "module_dependency" as const, resolution: "syntax" as const, resolved: pythonGraph.resolved + nonPythonResolved, unresolved: externals.reduce((count, item) => count + item.imported_by.length, 0) };
  // `edges` only holds the Python edges that survived the inner buildCallGraph's
  // hard 20,000-edge cap, so its length under-reports the true resolved-edge
  // total whenever Python alone exceeds that cap. Reconcile every downstream
  // count against the pre-truncation total (== contract.resolved) and carry the
  // Python-side omission forward so `resolved` and the returned graph stay
  // consistent instead of contradicting each other.
  const pythonOmitted = pythonGraph.truncated?.omitted ?? 0;
  const totalResolvedEdges = contract.resolved; // pythonGraph.resolved + nonPythonResolved, both pre-truncation
  const granularity = opts.granularity ?? "file";
  if (granularity === "package") {
    const weights = new Map<string, Edge>(); for (const edge of edges) { const from = packageOf(edge.from); const to = packageOf(edge.to); if (from === to) continue; const key = `${from}\0${to}`; const item = weights.get(key) ?? { from, to, weight: 0 }; item.weight = (item.weight ?? 0) + 1; weights.set(key, item); }
    // Package weights are collapsed from `edges`, so a Python cap silently drops
    // file edges before aggregation. Surface that rather than reporting nothing.
    const packageTruncated = pythonOmitted > 0 ? { truncated: { returned: totalResolvedEdges - pythonOmitted, total: totalResolvedEdges, omitted: pythonOmitted } } : {};
    return measured({ root: rootAbs, ...contract, granularity, files: sourceFiles.length, edges: [...weights.values()], externals, packages: [...new Set(sourceFiles.map((file) => packageOf(file.path)))].sort(), ...packageTruncated }, metrics);
  }
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 20000); const kept = edges.slice(0, limit); const result: CallGraphResult = { root: rootAbs, ...contract, granularity, files: sourceFiles.length, edges: kept, externals };
  if (kept.length < totalResolvedEdges) result.truncated = { returned: kept.length, total: totalResolvedEdges, omitted: totalResolvedEdges - kept.length }; return measured(result, metrics);
}

const FIELD_NODES: Record<SupportedLanguage, Set<string>> = {
  python: new Set(), typescript: new Set(["public_field_definition", "property_signature"]), java: new Set(["field_declaration"]), csharp: new Set(["property_declaration", "field_declaration"]), go: new Set(["field_declaration"]),
};
function fieldFrom(node: Parser.SyntaxNode, source: string): Field[] {
  const typeNode = node.childForFieldName("type") ?? node.namedChildren.find((child) => /type/.test(child.type));
  const directName = node.childForFieldName("name");
  if (directName && typeNode) {
    const type = source.slice(typeNode.startIndex, typeNode.endIndex).trim().replace(/^:\s*/, "");
    return [{ name: source.slice(directName.startIndex, directName.endIndex), type, line: node.startPosition.row + 1, optional: type.endsWith("?") }];
  }
  const declarators = node.type === "field_declaration" ? node.namedChildren.flatMap((child) => child.type === "variable_declaration" ? child.namedChildren : [child]).filter((child) => /declarator|identifier/.test(child.type)) : [node];
  const result: Field[] = [];
  for (const declarator of declarators) {
    const nameNode = declarator.childForFieldName("name") ?? node.childForFieldName("name") ?? declarator.namedChildren.find((child) => /identifier/.test(child.type));
    if (!nameNode || !typeNode) continue;
    const type = source.slice(typeNode.startIndex, typeNode.endIndex).trim().replace(/^:\s*/, "");
    result.push({ name: source.slice(nameNode.startIndex, nameNode.endIndex), type, line: node.startPosition.row + 1, optional: type.endsWith("?") });
  }
  return result;
}
export async function extractDataModelMulti(root: string, opts: { subdir?: string; limit?: number } = {}): Promise<Measured<DataModelResult>> {
  const rootAbs = resolve(root); const sourceFiles = files(rootAbs, opts.subdir).supported; const metrics = metricAccumulator(rootAbs, sourceFiles); const python = extractDataModel(rootAbs, { subdir: opts.subdir, limit: 5000 }); const entities: Entity[] = [...python.entities];
  for (const file of sourceFiles) {
    if (file.language === "python") continue;
    const access = await parsedSource(rootAbs, file); recordAccess(metrics, access); const { source, tree } = access;
    const visit = (node: Parser.SyntaxNode) => {
      if (TYPES[file.language][node.type] === "class") {
        const name = symbolName(node, source); const fields: Field[] = [];
        const scan = (child: Parser.SyntaxNode) => { if (FIELD_NODES[file.language].has(child.type)) fields.push(...fieldFrom(child, source)); else if (TYPES[file.language][child.type] !== "class") for (const nested of child.namedChildren) scan(nested); };
        for (const child of node.namedChildren) scan(child);
        if (name && fields.length) entities.push({ name, path: file.path, line: node.startPosition.row + 1, bases: [], fields });
      } else for (const child of node.namedChildren) visit(child);
    };
    visit(tree.rootNode);
  }
  const names = new Set(entities.map((entity) => entity.name)); const relations: Relation[] = [];
  for (const entity of entities) for (const field of entity.fields) for (const name of field.type.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) if (names.has(name) && name !== entity.name) relations.push({ from: entity.name, to: name, field: field.name, cardinality: /(?:List|Array|\[\]|\[\w+\])/.test(field.type) ? "many" : "one" });
  const total = entities.length; const limit = Math.min(Math.max(opts.limit ?? 200, 1), 5000); const kept = entities.slice(0, limit); const result: DataModelResult = { root: rootAbs, entities: kept, relations: relations.filter((r) => kept.some((e) => e.name === r.from) && kept.some((e) => e.name === r.to)), total_entities: total };
  if (kept.length < total) result.truncated = { returned: kept.length, total, omitted: total - kept.length }; return measured(result, metrics);
}
