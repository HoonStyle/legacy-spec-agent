import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Syntactic TypeScript/JavaScript module resolution: baseUrl, paths, project
// references (via nearest-ancestor tsconfig), local package.json exports, and
// missing extensions. It never guesses from a filename — a specifier resolves
// only when the candidate is an actually-indexed source file. Anything the
// config does not map stays unresolved so the caller records it as external.

interface SourceLike { path: string }
interface TsConfig { baseUrl?: string; paths?: Record<string, string[]>; pathsBase?: string }
interface LocalPackage { dir: string; pkg: Record<string, unknown> }

// Candidate extensions in TypeScript's own resolution order (source before
// declaration before JavaScript), used both for extensionless specifiers and
// for `index.*` directory entrypoints.
const EXTS = [".ts", ".tsx", ".d.ts", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const JS_LIKE = /\.(js|jsx|mjs|cjs)$/;
const CONDITION_ORDER = ["import", "module", "default", "require", "types"];

// Strip comments and trailing commas so a JSONC tsconfig/package manifest parses.
function parseJsonc(text: string): Record<string, unknown> | undefined {
  const withoutComments = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'])\/\/.*$/gm, "$1");
  const withoutTrailingCommas = withoutComments.replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(withoutTrailingCommas) as Record<string, unknown>; } catch { return undefined; }
}

export function buildTypeScriptResolver(rootAbs: string, sourceFiles: SourceLike[]): (fromPath: string, specifier: string) => string | undefined {
  const byAbs = new Map<string, string>(sourceFiles.map((file) => [resolve(rootAbs, file.path), file.path]));

  // tsconfig lookups are memoised per directory; a directory maps to its parsed
  // config or null when it has none, so repeated walks stay cheap and bounded.
  const tsconfigByDir = new Map<string, TsConfig | null>();
  function readTsconfig(dir: string, seen = new Set<string>()): TsConfig | null {
    const cached = tsconfigByDir.get(dir);
    if (cached !== undefined && seen.size === 0) return cached;
    const file = join(dir, "tsconfig.json");
    if (!existsSync(file)) { if (seen.size === 0) tsconfigByDir.set(dir, null); return null; }
    let raw: Record<string, unknown> | undefined;
    try { raw = parseJsonc(readFileSync(file, "utf8")); } catch { raw = undefined; }
    if (!raw) { if (seen.size === 0) tsconfigByDir.set(dir, null); return null; }
    let inherited: TsConfig = {};
    const extendsField = raw.extends;
    if (typeof extendsField === "string" && (extendsField.startsWith(".") || extendsField.startsWith("/")) && seen.size < 5) {
      const parentDir = dirname(resolve(dir, extendsField.endsWith(".json") ? extendsField : `${extendsField}.json`));
      if (!seen.has(parentDir)) inherited = readTsconfig(parentDir, new Set([...seen, dir])) ?? {};
    }
    const options = (raw.compilerOptions ?? {}) as Record<string, unknown>;
    const config: TsConfig = { ...inherited };
    if (typeof options.baseUrl === "string") config.baseUrl = resolve(dir, options.baseUrl);
    if (options.paths && typeof options.paths === "object") {
      config.paths = options.paths as Record<string, string[]>;
      // TS resolves `paths` against baseUrl when set, otherwise against the
      // directory of the tsconfig that declares them.
      config.pathsBase = config.baseUrl ?? dir;
    }
    if (seen.size === 0) tsconfigByDir.set(dir, config);
    return config;
  }
  function nearestTsconfig(fromDir: string): TsConfig | undefined {
    let dir = fromDir;
    while (true) {
      const config = readTsconfig(dir);
      if (config) return config;
      if (dir === rootAbs) return undefined;
      const parent = dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  }

  // Local workspace packages: any package.json (node_modules is already excluded
  // from sourceFiles) that sits on a source file's ancestor path and declares a
  // name. Lets bare specifiers like "@org/ui" resolve to an in-repo package.
  const localPackages = new Map<string, LocalPackage>();
  const scannedDirs = new Set<string>();
  for (const file of sourceFiles) {
    let dir = dirname(resolve(rootAbs, file.path));
    while (true) {
      if (!scannedDirs.has(dir)) {
        scannedDirs.add(dir);
        const manifest = join(dir, "package.json");
        if (existsSync(manifest)) {
          const pkg = parseJsonc(readFileSync(manifest, "utf8") || "");
          if (pkg && typeof pkg.name === "string" && !localPackages.has(pkg.name)) localPackages.set(pkg.name, { dir, pkg });
        }
      }
      if (dir === rootAbs) break;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  function fromExtensionless(baseAbs: string): string | undefined {
    const exact = byAbs.get(baseAbs); if (exact) return exact;
    for (const ext of EXTS) { const hit = byAbs.get(baseAbs + ext); if (hit) return hit; }
    for (const ext of EXTS) { const hit = byAbs.get(join(baseAbs, `index${ext}`)); if (hit) return hit; }
    return undefined;
  }
  // Resolve an absolute base path to an indexed source file, honouring both
  // extensionless specifiers and TypeScript's `./x.js` -> `x.ts` rewrite.
  function tryPath(baseAbs: string): string | undefined {
    const direct = fromExtensionless(baseAbs); if (direct) return direct;
    if (JS_LIKE.test(baseAbs)) return fromExtensionless(baseAbs.replace(JS_LIKE, ""));
    return undefined;
  }

  function firstConditionString(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const conditions = value as Record<string, unknown>;
      for (const key of CONDITION_ORDER) { const picked = firstConditionString(conditions[key]); if (picked) return picked; }
    }
    return undefined;
  }
  function resolveLocalPackage(specifier: string): string | undefined {
    const segments = specifier.split("/");
    const name = specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
    const local = localPackages.get(name); if (!local) return undefined;
    const subpath = specifier.slice(name.length).replace(/^\//, "");
    const exports = local.pkg.exports;
    let target: string | undefined;
    if (exports !== undefined) {
      const entry = subpath === ""
        ? (typeof exports === "string" ? exports : (exports as Record<string, unknown>)["."])
        : (exports as Record<string, unknown>)[`./${subpath}`];
      target = firstConditionString(entry);
    }
    if (target === undefined && subpath === "") target = firstConditionString(local.pkg.module) ?? firstConditionString(local.pkg.main);
    const baseAbs = target !== undefined ? resolve(local.dir, target) : join(local.dir, subpath);
    return tryPath(baseAbs);
  }

  // Apply tsconfig `paths`, trying the pattern with the longest literal prefix
  // first so a specific mapping wins over a broad wildcard, exactly as tsc does.
  function resolveViaPaths(config: TsConfig, specifier: string): string | undefined {
    if (!config.paths || !config.pathsBase) return undefined;
    const base = config.pathsBase;
    const matches: { prefixLen: number; targets: string[] }[] = [];
    for (const [pattern, targets] of Object.entries(config.paths)) {
      const star = pattern.indexOf("*");
      if (star === -1) { if (pattern === specifier) matches.push({ prefixLen: pattern.length, targets }); continue; }
      const prefix = pattern.slice(0, star); const suffix = pattern.slice(star + 1);
      if (specifier.startsWith(prefix) && specifier.endsWith(suffix) && specifier.length >= prefix.length + suffix.length) {
        const captured = specifier.slice(prefix.length, specifier.length - suffix.length);
        matches.push({ prefixLen: prefix.length, targets: targets.map((target) => target.replace("*", captured)) });
      }
    }
    matches.sort((a, b) => b.prefixLen - a.prefixLen);
    for (const match of matches) for (const target of match.targets) { const hit = tryPath(resolve(base, target)); if (hit) return hit; }
    return undefined;
  }

  return (fromPath: string, specifier: string): string | undefined => {
    const fromDir = dirname(resolve(rootAbs, fromPath));
    if (specifier.startsWith(".")) return tryPath(resolve(fromDir, specifier));
    const config = nearestTsconfig(fromDir);
    if (config) {
      const viaPaths = resolveViaPaths(config, specifier); if (viaPaths) return viaPaths;
      if (config.baseUrl) { const viaBase = tryPath(resolve(config.baseUrl, specifier)); if (viaBase) return viaBase; }
    }
    return resolveLocalPackage(specifier);
  };
}
