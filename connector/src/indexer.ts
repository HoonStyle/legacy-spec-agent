import { readdirSync, readFileSync, statSync } from "node:fs";
import { existsSync } from "node:fs";
import { basename, join, relative, resolve, sep, posix } from "node:path";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";

// ---------------------------------------------------------------------------
// Shared walking / parsing
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "__pycache__", ".venv", "venv", ".tox"]);
const SUPPORTED = new Map<string, "python">([[".py", "python"]]);

const parser = new Parser();
parser.setLanguage(Python as Parser.Language);

/** Top-level package a root-relative posix path belongs to. */
export function packageOf(path: string): string {
  const i = path.indexOf("/");
  return i > 0 ? path.slice(0, i) : "(root)";
}

/** Clamp a bound like extractChangelog's max: default `def`, floor 1, ceiling `ceil`. */
function clampLimit(v: number | undefined, def: number, ceil: number): number {
  return Math.min(Math.max(v ?? def, 1), ceil);
}

interface WalkResult {
  files: string[]; // root-relative, posix-separated
  unsupported: number;
}

function walk(rootAbs: string, subdir?: string): WalkResult {
  const start = subdir ? resolve(rootAbs, subdir) : rootAbs;
  if (start !== rootAbs && !start.startsWith(rootAbs + sep)) {
    throw new Error(`subdir escapes connector root: ${subdir}`);
  }
  const files: string[] = [];
  let unsupported = 0;
  const stack = [start];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(join(dir, entry.name));
      } else if (entry.isFile()) {
        const ext = entry.name.slice(entry.name.lastIndexOf("."));
        if (SUPPORTED.has(ext)) {
          files.push(relative(rootAbs, join(dir, entry.name)).split(sep).join("/"));
        } else {
          unsupported++;
        }
      }
    }
  }
  files.sort();
  return { files, unsupported };
}

interface CacheEntry {
  mtimeMs: number;
  tree: Parser.Tree;
  source: string;
}
const parseCache = new Map<string, CacheEntry>();

function parseFile(rootAbs: string, relPath: string): CacheEntry {
  const abs = join(rootAbs, relPath);
  const mtimeMs = statSync(abs).mtimeMs;
  const cached = parseCache.get(abs);
  if (cached && cached.mtimeMs === mtimeMs) return cached;
  const source = readFileSync(abs, "utf8");
  const entry: CacheEntry = { mtimeMs, tree: parser.parse(source), source };
  parseCache.set(abs, entry);
  return entry;
}

/** Shared with extractors.ts: list Python files under the root (or a subdir). */
export function pythonFiles(root: string, opts: { subdir?: string } = {}): string[] {
  return walk(resolve(root), opts.subdir).files;
}

/** Shared with extractors.ts: parse one file, reusing the mtime-keyed cache. */
export function parsePython(root: string, relPath: string): { tree: Parser.Tree; source: string } {
  const { tree, source } = parseFile(resolve(root), relPath);
  return { tree, source };
}

// ---------------------------------------------------------------------------
// index_symbols
// ---------------------------------------------------------------------------

export interface Symbol {
  kind: "function" | "method" | "class";
  name: string;
  line: number;
  end_line: number;
  signature: string;
}

export interface ModuleIndex {
  path: string;
  symbols: Symbol[];
}

export interface PackageSummary {
  package: string;
  files: number;
  symbols: number;
}
export interface Truncation {
  returned: number;
  total: number;
  omitted: number;
}
export interface IndexResult {
  root: string;
  granularity: "file" | "package";
  files: number;
  unsupported_files: number;
  total_symbols: number;
  /** granularity "file" only */
  modules: ModuleIndex[];
  /** granularity "package" only — per-package counts, no symbol bodies */
  packages?: PackageSummary[];
  /** present only when a limit truncated the file-granularity modules */
  truncated?: Truncation;
}

function extractSymbols(node: Parser.SyntaxNode, classCtx: string | undefined, out: Symbol[]): void {
  for (const child of node.namedChildren) {
    if (child.type === "decorated_definition") {
      const def = child.namedChildren.find(
        (n) => n.type === "function_definition" || n.type === "class_definition",
      );
      if (def) extractSymbols({ namedChildren: [def] } as unknown as Parser.SyntaxNode, classCtx, out);
      continue;
    }
    if (child.type === "function_definition") {
      const name = child.childForFieldName("name")?.text ?? "<anonymous>";
      const params = child.childForFieldName("parameters")?.text ?? "()";
      out.push({
        kind: classCtx ? "method" : "function",
        name: classCtx ? `${classCtx}.${name}` : name,
        line: child.startPosition.row + 1,
        end_line: child.endPosition.row + 1,
        signature: `def ${name}${params}`,
      });
      const body = child.childForFieldName("body");
      if (body) extractSymbols(body, classCtx, out);
      continue;
    }
    if (child.type === "class_definition") {
      const name = child.childForFieldName("name")?.text ?? "<anonymous>";
      out.push({
        kind: "class",
        name,
        line: child.startPosition.row + 1,
        end_line: child.endPosition.row + 1,
        signature: `class ${name}`,
      });
      const body = child.childForFieldName("body");
      if (body) extractSymbols(body, name, out);
      continue;
    }
    // Recurse into blocks (if/try/with...) so conditionally-defined symbols are found.
    if (child.namedChildCount > 0) extractSymbols(child, classCtx, out);
  }
}

export function indexSymbols(
  root: string,
  opts: { subdir?: string; limit?: number; granularity?: "file" | "package" } = {},
): IndexResult {
  const rootAbs = resolve(root);
  const granularity = opts.granularity ?? "file";
  const { files, unsupported } = walk(rootAbs, opts.subdir);

  const allModules: ModuleIndex[] = files.map((path) => {
    const { tree } = parseFile(rootAbs, path);
    const symbols: Symbol[] = [];
    extractSymbols(tree.rootNode, undefined, symbols);
    return { path, symbols };
  });
  const totalSymbols = allModules.reduce((n, m) => n + m.symbols.length, 0);

  const base = {
    root: rootAbs,
    granularity,
    files: files.length,
    unsupported_files: unsupported,
    total_symbols: totalSymbols,
  } as const;

  if (granularity === "package") {
    const map = new Map<string, PackageSummary>();
    for (const m of allModules) {
      const key = packageOf(m.path);
      const p = map.get(key) ?? { package: key, files: 0, symbols: 0 };
      p.files += 1;
      p.symbols += m.symbols.length;
      map.set(key, p);
    }
    const packages = [...map.values()].sort((a, b) => a.package.localeCompare(b.package));
    return { ...base, modules: [], packages };
  }

  // file granularity — cap total symbols, truncating whole modules in sorted order
  const limit = clampLimit(opts.limit, 2000, 100_000);
  const modules: ModuleIndex[] = [];
  let kept = 0;
  for (const m of allModules) {
    if (kept > 0 && kept + m.symbols.length > limit) break;
    modules.push(m);
    kept += m.symbols.length;
    if (kept >= limit) break;
  }
  const result: IndexResult = { ...base, modules };
  if (modules.length < allModules.length) {
    result.truncated = {
      returned: kept,
      total: totalSymbols,
      omitted: totalSymbols - kept,
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// build_call_graph (import-based module edges)
// ---------------------------------------------------------------------------

export interface Edge {
  from: string;
  to: string;
  /** file granularity only */
  import?: string;
  line?: number;
  /** package granularity only — number of underlying file→file edges */
  weight?: number;
}

export interface CallGraphResult {
  root: string;
  granularity: "file" | "package";
  files: number;
  edges: Edge[];
  externals: Array<{ module: string; imported_by: string[] }>;
  /** granularity "package" only */
  packages?: string[];
  /** present only when a limit truncated the edge list */
  truncated?: Truncation;
}

/**
 * Resolve a dotted Python module name to a file inside the root. A leading
 * segment is stripped ONLY when it names the root package itself (the root
 * directory's basename), so `hookify.core.config_loader` with
 * root=plugins/hookify resolves to core/config_loader.py — but
 * `import collections.abc` never resolves to an unrelated local abc.py
 * (stdlib/external imports must stay external).
 */
function resolveModule(rootAbs: string, dotted: string): string | undefined {
  const segments = dotted.split(".").filter((s) => s.length > 0);
  const rootName = basename(rootAbs);
  const candidates: string[][] = [segments];
  let rest = segments;
  while (rest.length > 1 && rest[0] === rootName) {
    rest = rest.slice(1);
    candidates.push(rest);
  }
  for (const segs of candidates) {
    const rel = segs.join("/");
    for (const candidate of [`${rel}.py`, `${rel}/__init__.py`]) {
      if (existsSync(join(rootAbs, candidate))) return candidate;
    }
  }
  return undefined;
}

function resolveRelative(rootAbs: string, fromFile: string, dots: number, dotted: string): string | undefined {
  let dir = posix.dirname(fromFile);
  for (let i = 1; i < dots; i++) dir = posix.dirname(dir);
  const base = dir === "." ? "" : dir;
  const rel = dotted.length > 0 ? posix.join(base, ...dotted.split(".")) : base;
  for (const candidate of [`${rel}.py`, `${rel}/__init__.py`]) {
    if (existsSync(join(rootAbs, candidate))) return candidate;
  }
  return undefined;
}

export function buildCallGraph(
  root: string,
  opts: { subdir?: string; limit?: number; granularity?: "file" | "package" } = {},
): CallGraphResult {
  const rootAbs = resolve(root);
  const granularity = opts.granularity ?? "file";
  const { files } = walk(rootAbs, opts.subdir);
  const edges = new Map<string, Edge>();
  const externals = new Map<string, Set<string>>();

  const addEdge = (from: string, to: string, imp: string, line: number) => {
    if (to === from) return;
    const key = `${from}→${to}`;
    if (!edges.has(key)) edges.set(key, { from, to, import: imp, line });
  };
  const addExternal = (module: string, from: string) => {
    const top = module.split(".")[0];
    if (!externals.has(top)) externals.set(top, new Set());
    externals.get(top)!.add(from);
  };

  for (const file of files) {
    const { tree } = parseFile(rootAbs, file);
    const importNodes = tree.rootNode.descendantsOfType(["import_statement", "import_from_statement"]);
    for (const node of importNodes) {
      const line = node.startPosition.row + 1;
      if (node.type === "import_statement") {
        // import a.b, c.d as e
        for (const child of node.namedChildren) {
          const dotted = child.type === "aliased_import" ? child.childForFieldName("name")?.text : child.text;
          if (!dotted) continue;
          const resolved = resolveModule(rootAbs, dotted);
          if (resolved) addEdge(file, resolved, dotted, line);
          else addExternal(dotted, file);
        }
      } else {
        // from X import ... — X may be dotted_name or relative_import
        const moduleNode = node.childForFieldName("module_name");
        if (!moduleNode) continue;
        if (moduleNode.type === "relative_import") {
          const dots = (moduleNode.text.match(/^\.+/)?.[0] ?? ".").length;
          const dotted = moduleNode.text.replace(/^\.+/, "");
          const resolved = resolveRelative(rootAbs, file, dots, dotted);
          if (resolved) addEdge(file, resolved, moduleNode.text, line);
          // unresolvable relative imports stay silent-external-free: they can
          // only point inside the tree, so report as external "." for visibility
          else addExternal(".", file);
        } else {
          const dotted = moduleNode.text;
          const resolved = resolveModule(rootAbs, dotted);
          if (resolved) addEdge(file, resolved, dotted, line);
          else addExternal(dotted, file);
        }
      }
    }
  }

  const fileEdges = [...edges.values()].sort(
    (a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
  );
  const externalsOut = [...externals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([module, importedBy]) => ({ module, imported_by: [...importedBy].sort() }));

  if (granularity === "package") {
    // Collapse file→file edges into package→package edges with weight.
    const pkgEdges = new Map<string, Edge>();
    const pkgSet = new Set<string>();
    for (const e of fileEdges) {
      const from = packageOf(e.from);
      const to = packageOf(e.to);
      pkgSet.add(from);
      pkgSet.add(to);
      if (from === to) continue; // intra-package edges collapse away
      const key = `${from}→${to}`;
      const existing = pkgEdges.get(key);
      if (existing) existing.weight! += 1;
      else pkgEdges.set(key, { from, to, weight: 1 });
    }
    return {
      root: rootAbs,
      granularity,
      files: files.length,
      edges: [...pkgEdges.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
      externals: externalsOut,
      packages: [...pkgSet].sort(),
    };
  }

  const limit = clampLimit(opts.limit, 500, 20_000);
  const result: CallGraphResult = {
    root: rootAbs,
    granularity,
    files: files.length,
    edges: fileEdges.slice(0, limit),
    externals: externalsOut,
  };
  if (fileEdges.length > limit) {
    result.truncated = { returned: limit, total: fileEdges.length, omitted: fileEdges.length - limit };
  }
  return result;
}
