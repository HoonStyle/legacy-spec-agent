import { readdirSync, readFileSync, statSync } from "node:fs";
import { existsSync } from "node:fs";
import { basename, join, relative, resolve, sep, posix } from "node:path";
import type { SyntaxNode, Tree } from "@lezer/common";
import { parser } from "@lezer/python";

// ---------------------------------------------------------------------------
// Shared walking / parsing
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "__pycache__", ".venv", "venv", ".tox"]);
const SUPPORTED = new Map<string, "python">([[".py", "python"]]);

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
  tree: Tree;
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
export function parsePython(root: string, relPath: string): { tree: Tree; source: string } {
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

function children(node: SyntaxNode): SyntaxNode[] {
  const result: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) result.push(child);
  return result;
}

function textOf(node: SyntaxNode, source: string): string {
  return source.slice(node.from, node.to);
}

function lineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

function lineAt(starts: number[], offset: number): number {
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (starts[mid] <= offset) low = mid + 1;
    else high = mid;
  }
  return low;
}

function extractSymbols(node: SyntaxNode, source: string, starts: number[], classCtx: string | undefined, out: Symbol[]): void {
  for (const child of children(node)) {
    if (child.name === "FunctionDefinition") {
      const parts = children(child);
      const nameNode = parts.find((n) => n.name === "VariableName");
      const paramsNode = parts.find((n) => n.name === "ParamList");
      const name = nameNode ? textOf(nameNode, source) : "<anonymous>";
      const params = paramsNode ? textOf(paramsNode, source) : "()";
      out.push({
        kind: classCtx ? "method" : "function",
        name: classCtx ? `${classCtx}.${name}` : name,
        line: lineAt(starts, child.from),
        end_line: lineAt(starts, Math.max(child.from, child.to - 1)),
        signature: `def ${name}${params}`,
      });
      const body = parts.find((n) => n.name === "Body");
      if (body) extractSymbols(body, source, starts, classCtx, out);
      continue;
    }
    if (child.name === "ClassDefinition") {
      const parts = children(child);
      const nameNode = parts.find((n) => n.name === "VariableName");
      const name = nameNode ? textOf(nameNode, source) : "<anonymous>";
      out.push({
        kind: "class",
        name,
        line: lineAt(starts, child.from),
        end_line: lineAt(starts, Math.max(child.from, child.to - 1)),
        signature: `class ${name}`,
      });
      const body = parts.find((n) => n.name === "Body");
      if (body) extractSymbols(body, source, starts, name, out);
      continue;
    }
    // Recurse into blocks (if/try/with...) so conditionally-defined symbols are found.
    if (child.firstChild) extractSymbols(child, source, starts, classCtx, out);
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
    const { tree, source } = parseFile(rootAbs, path);
    const symbols: Symbol[] = [];
    extractSymbols(tree.topNode, source, lineStarts(source), undefined, symbols);
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

interface ParsedImport {
  kind: "import" | "from";
  module?: string;
  names: string[];
  line: number;
}

function importsFromTree(tree: Tree, source: string): ParsedImport[] {
  const result: ParsedImport[] = [];
  const starts = lineStarts(source);
  const cursor = tree.cursor();
  do {
    if (cursor.name !== "ImportStatement") continue;
    const line = lineAt(starts, cursor.from);
    const statement = source
      .slice(cursor.from, cursor.to)
      .replace(/\\\r?\n/g, " ")
      .replace(/#[^\r\n]*/g, " ")
      .replace(/[()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const fromMatch = /^from\s+([.A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*|\.+[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*|\.+)\s+import\s+(.+)$/.exec(statement);
    if (fromMatch) {
      const names = fromMatch[2]
        .split(",")
        .map((name) => name.trim().split(/\s+as\s+/)[0])
        .filter((name) => /^[A-Za-z_]\w*$/.test(name));
      result.push({ kind: "from", module: fromMatch[1], names, line });
      continue;
    }
    const importMatch = /^import\s+(.+)$/.exec(statement);
    if (importMatch) {
      const names = importMatch[1]
        .split(",")
        .map((name) => name.trim().split(/\s+as\s+/)[0])
        .filter((name) => /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(name));
      result.push({ kind: "import", names, line });
    }
  } while (cursor.next());
  return result;
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
    const { tree, source } = parseFile(rootAbs, file);
    for (const parsed of importsFromTree(tree, source)) {
      const line = parsed.line;
      if (parsed.kind === "import") {
        // import a.b, c.d as e
        for (const dotted of parsed.names) {
          const resolved = resolveModule(rootAbs, dotted);
          if (resolved) addEdge(file, resolved, dotted, line);
          else addExternal(dotted, file);
        }
      } else {
        // from X import ... — X may be dotted_name or relative_import.
        // Prefer concrete imported submodules when they exist, so
        // `from pkg import util` produces an edge to pkg/util.py instead of
        // stopping at pkg/__init__.py (or misclassifying pkg as external when
        // the package is namespace-style and has no __init__.py).
        const moduleName = parsed.module!;
        const importedNames = parsed.names;
        if (moduleName.startsWith(".")) {
          const dots = (moduleName.match(/^\.+/)?.[0] ?? ".").length;
          const dotted = moduleName.replace(/^\.+/, "");
          const baseResolved = resolveRelative(rootAbs, file, dots, dotted);
          let matched = false;
          for (const name of importedNames) {
            const submodule = resolveRelative(rootAbs, file, dots, [dotted, name].filter(Boolean).join("."));
            if (submodule) {
              addEdge(file, submodule, `${moduleName} import ${name}`, line);
              matched = true;
            } else if (baseResolved) {
              addEdge(file, baseResolved, moduleName, line);
              matched = true;
            }
          }
          if (!matched) {
            if (baseResolved) addEdge(file, baseResolved, moduleName, line);
            // unresolvable relative imports stay silent-external-free: they can
            // only point inside the tree, so report as external "." for visibility
            else addExternal(".", file);
          }
        } else {
          const dotted = moduleName;
          const baseResolved = resolveModule(rootAbs, dotted);
          let matched = false;
          for (const name of importedNames) {
            const submodule = resolveModule(rootAbs, `${dotted}.${name}`);
            if (submodule) {
              addEdge(file, submodule, `${dotted}.${name}`, line);
              matched = true;
            } else if (baseResolved) {
              addEdge(file, baseResolved, dotted, line);
              matched = true;
            }
          }
          if (!matched) {
            if (baseResolved) addEdge(file, baseResolved, dotted, line);
            else addExternal(dotted, file);
          }
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
