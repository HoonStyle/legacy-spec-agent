import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

// Syntactic TypeScript/JavaScript module resolution: baseUrl, paths, project
// references (via nearest-ancestor tsconfig), local package.json exports, and
// missing extensions. It never guesses from a filename — a specifier resolves
// only when the candidate is an actually-indexed source file. Anything the
// config does not map stays unresolved so the caller records it as external.

interface SourceLike { path: string }
interface TsConfig { baseUrl?: string; paths?: Record<string, unknown>; pathsBase?: string }
interface LocalPackage { dir: string; pkg: Record<string, unknown> }
interface Workspace { baseDir: string; includes: RegExp[]; excludes: RegExp[] }

// Candidate extensions for extensionless specifiers and `index.*` entrypoints,
// in TypeScript's own resolution order (source before declaration before JS).
const EXTS = [".ts", ".tsx", ".d.ts", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
// A runtime JavaScript specifier maps back to the matching TypeScript source
// first, exactly as TypeScript's module resolution does for `./x.js` imports.
const JS_TO_TS: Record<string, string[]> = {
  ".js": [".ts", ".tsx", ".d.ts"], ".jsx": [".tsx"], ".mjs": [".mts", ".d.mts"], ".cjs": [".cts", ".d.cts"],
};
const JS_LIKE = /\.(js|jsx|mjs|cjs)$/;
const CONDITIONS = new Set(["import", "module", "require", "node", "browser", "development", "production", "default", "types"]);
const REGEX_SPECIAL = new Set([".", "+", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"]);

// Strip comments and trailing commas so a JSONC tsconfig/package manifest parses.
function parseJsonc(text: string): Record<string, unknown> | undefined {
  const withoutComments = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'])\/\/.*$/gm, "$1");
  const withoutTrailingCommas = withoutComments.replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(withoutTrailingCommas) as Record<string, unknown>; } catch { return undefined; }
}

// Expand top-level brace alternatives (`a/{x,y}/z` -> `a/x/z`, `a/y/z`) the way
// package-manager workspace globbing does, recursing for nested braces.
function expandBraces(glob: string): string[] {
  const open = glob.indexOf("{");
  if (open === -1) return [glob];
  let depth = 0; let close = -1;
  for (let i = open; i < glob.length; i++) {
    if (glob[i] === "{") depth++;
    else if (glob[i] === "}" && --depth === 0) { close = i; break; }
  }
  if (close === -1) return [glob];
  const prefix = glob.slice(0, open); const suffix = glob.slice(close + 1); const body = glob.slice(open + 1, close);
  const options: string[] = []; let segmentDepth = 0; let start = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "{") segmentDepth++;
    else if (body[i] === "}") segmentDepth--;
    else if (body[i] === "," && segmentDepth === 0) { options.push(body.slice(start, i)); start = i + 1; }
  }
  options.push(body.slice(start));
  return options.flatMap((option) => expandBraces(prefix + option + suffix));
}
// Convert an npm/pnpm workspace glob to an anchored regex over POSIX paths. `**`
// spans zero or more whole segments; `*`/`?` stay within a single segment. A
// leading `./` is stripped, matching how package managers normalise patterns.
function globToRegex(glob: string): RegExp {
  const cleaned = glob.replace(/^\.\//, "").replace(/\/+$/, "");
  let out = "";
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "*" && cleaned[i + 1] === "*") {
      i++;
      if (cleaned[i + 1] === "/") { out += "(?:[^/]*/)*"; i++; } else out += ".*";
    } else if (ch === "*") {
      out += "[^/]*";
    } else if (ch === "?") {
      out += "[^/]";
    } else {
      out += REGEX_SPECIAL.has(ch) ? `\\${ch}` : ch;
    }
  }
  return new RegExp(`^${out}$`);
}
// Known limitations, all in the safe "stays external" direction: a package
// reached only through an ordered exclude/re-include sequence, a bare terminal
// `/**` excluding the directory itself, or a root-package self-reference is left
// unresolved rather than risking a wrong edge.
function splitGlobs(globs: string[]): { includes: RegExp[]; excludes: RegExp[] } {
  const includes: RegExp[] = []; const excludes: RegExp[] = [];
  for (const raw of globs) {
    const negated = raw.startsWith("!");
    for (const glob of expandBraces(negated ? raw.slice(1) : raw)) {
      (negated ? excludes : includes).push(globToRegex(glob));
    }
  }
  return { includes, excludes };
}
function workspaceGlobs(pkg: Record<string, unknown>): string[] {
  const workspaces = pkg.workspaces;
  if (Array.isArray(workspaces)) return workspaces.filter((entry): entry is string => typeof entry === "string");
  if (workspaces && typeof workspaces === "object" && Array.isArray((workspaces as { packages?: unknown }).packages)) {
    return ((workspaces as { packages: unknown[] }).packages).filter((entry): entry is string => typeof entry === "string");
  }
  return [];
}
function pnpmWorkspaceGlobs(text: string): string[] {
  const out: string[] = []; let inPackages = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^packages:/.test(line)) { inPackages = true; continue; }
    if (!inPackages) continue;
    if (/^\S/.test(line)) break; // a new top-level key ends the packages block
    const item = line.match(/^\s*-\s*(.+?)\s*$/);
    if (!item) continue;
    let value = item[1];
    const quoted = value.match(/^(['"])(.*?)\1/); // quoted value: take its contents, ignore any trailing comment
    if (quoted) value = quoted[2];
    else { const hash = value.indexOf("#"); if (hash >= 0) value = value.slice(0, hash).trim(); }
    if (value) out.push(value);
  }
  return out;
}

export function buildTypeScriptResolver(rootAbs: string, sourceFiles: SourceLike[]): (fromPath: string, specifier: string) => string | undefined {
  const byAbs = new Map<string, string>(sourceFiles.map((file) => [resolve(rootAbs, file.path), file.path]));

  // tsconfig lookups are memoised per file path; a config file maps to its
  // merged options or null when absent, so repeated ancestor walks stay cheap.
  const configByFile = new Map<string, TsConfig | null>();
  function readConfigFile(filePath: string, seen = new Set<string>()): TsConfig | null {
    const cached = configByFile.get(filePath);
    if (cached !== undefined && seen.size === 0) return cached;
    if (!existsSync(filePath)) { if (seen.size === 0) configByFile.set(filePath, null); return null; }
    let raw: Record<string, unknown> | undefined;
    try { raw = parseJsonc(readFileSync(filePath, "utf8")); } catch { raw = undefined; }
    if (!raw) { if (seen.size === 0) configByFile.set(filePath, null); return null; }
    const dir = dirname(filePath);
    let inherited: TsConfig = {};
    const extendsField = raw.extends;
    // `extends` names an exact file (TS appends `.json` when omitted); read that
    // file so inherited baseUrl/paths are honoured, not a tsconfig.json guess.
    if (typeof extendsField === "string" && (extendsField.startsWith(".") || extendsField.startsWith("/")) && seen.size < 5) {
      const target = resolve(dir, extendsField.endsWith(".json") ? extendsField : `${extendsField}.json`);
      if (!seen.has(target)) inherited = readConfigFile(target, new Set([...seen, filePath])) ?? {};
    }
    const options = (raw.compilerOptions ?? {}) as Record<string, unknown>;
    const config: TsConfig = { ...inherited };
    if (typeof options.baseUrl === "string") config.baseUrl = resolve(dir, options.baseUrl);
    if (options.paths && typeof options.paths === "object") {
      config.paths = options.paths as Record<string, unknown>;
      // `paths` declared here resolve against this file's baseUrl when it sets
      // one, otherwise against this file's own directory — not an inherited base.
      config.pathsBase = typeof options.baseUrl === "string" ? config.baseUrl : dir;
    }
    if (seen.size === 0) configByFile.set(filePath, config);
    return config;
  }
  function nearestTsconfig(fromDir: string): TsConfig | undefined {
    let dir = fromDir;
    while (true) {
      const config = readConfigFile(join(dir, "tsconfig.json"));
      if (config) return config;
      if (dir === rootAbs) return undefined;
      const parent = dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  }

  // Local workspace packages: a package.json is a resolution candidate only when
  // it is an actual workspace member (matched by a root `workspaces`/pnpm glob,
  // and not excluded by a negative pattern). Registering every ancestor
  // package.json by name would let an unrelated in-repo fixture named e.g.
  // "react" shadow the real external dependency.
  const manifests: { name: string; dir: string; pkg: Record<string, unknown> }[] = [];
  const workspaces: Workspace[] = [];
  const scannedDirs = new Set<string>();
  for (const file of sourceFiles) {
    let dir = dirname(resolve(rootAbs, file.path));
    while (true) {
      if (!scannedDirs.has(dir)) {
        scannedDirs.add(dir);
        const manifestPath = join(dir, "package.json");
        if (existsSync(manifestPath)) {
          const pkg = parseJsonc(readFileSync(manifestPath, "utf8") || "");
          if (pkg) {
            if (typeof pkg.name === "string") manifests.push({ name: pkg.name, dir, pkg });
            const globs = workspaceGlobs(pkg);
            if (globs.length) workspaces.push({ baseDir: dir, ...splitGlobs(globs) });
          }
        }
        const pnpmPath = join(dir, "pnpm-workspace.yaml");
        if (existsSync(pnpmPath)) {
          const globs = pnpmWorkspaceGlobs(readFileSync(pnpmPath, "utf8"));
          if (globs.length) workspaces.push({ baseDir: dir, ...splitGlobs(globs) });
        }
      }
      if (dir === rootAbs) break;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  const localPackages = new Map<string, LocalPackage>();
  for (const manifest of manifests) {
    if (localPackages.has(manifest.name)) continue;
    const isMember = workspaces.some(({ baseDir, includes, excludes }) => {
      if (manifest.dir !== baseDir && !manifest.dir.startsWith(baseDir + sep)) return false;
      const rel = relative(baseDir, manifest.dir).split(sep).join("/");
      return rel !== "" && includes.some((regex) => regex.test(rel)) && !excludes.some((regex) => regex.test(rel));
    });
    if (isMember) localPackages.set(manifest.name, { dir: manifest.dir, pkg: manifest.pkg });
  }

  function fromExtensionless(baseAbs: string): string | undefined {
    const exact = byAbs.get(baseAbs); if (exact) return exact;
    for (const ext of EXTS) { const hit = byAbs.get(baseAbs + ext); if (hit) return hit; }
    for (const ext of EXTS) { const hit = byAbs.get(join(baseAbs, `index${ext}`)); if (hit) return hit; }
    return undefined;
  }
  // Resolve an absolute base path to an indexed source file. An explicit
  // JavaScript extension prefers its TypeScript counterpart before the literal
  // file; an extensionless base tries appended extensions and `index.*`.
  function tryPath(baseAbs: string): string | undefined {
    const match = baseAbs.match(JS_LIKE);
    if (match) {
      const stem = baseAbs.slice(0, -match[0].length);
      for (const ext of JS_TO_TS[match[0]]) { const hit = byAbs.get(stem + ext); if (hit) return hit; }
      return byAbs.get(baseAbs);
    }
    return fromExtensionless(baseAbs);
  }

  // Pick a target from a conditional-exports value. Conditions are matched in
  // declaration order (as Node does), so `{ default, import }` selects `default`.
  // `types` maps to a `.d.ts`, so it is only consulted as a last resort.
  function firstConditionString(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const conditions = value as Record<string, unknown>;
      const keys = Object.keys(conditions);
      for (const key of keys) { if (key === "types" || !CONDITIONS.has(key)) continue; const picked = firstConditionString(conditions[key]); if (picked) return picked; }
      for (const key of keys) { if (key !== "types") continue; const picked = firstConditionString(conditions[key]); if (picked) return picked; }
    }
    return undefined;
  }
  // The root ("." ) target of an `exports` field: an explicit "." subpath, or the
  // whole object when it is a bare condition map (no subpath keys) such as
  // `{ "import": "./index.ts", "default": "./index.js" }`.
  function rootExportEntry(exports: Record<string, unknown>): unknown {
    if (exports["."] !== undefined) return exports["."];
    return Object.keys(exports).every((key) => !key.startsWith(".")) ? exports : undefined;
  }
  function resolveLocalPackage(specifier: string): string | undefined {
    const segments = specifier.split("/");
    const name = specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
    const local = localPackages.get(name); if (!local) return undefined;
    const subpath = specifier.slice(name.length).replace(/^\//, "");
    const exports = local.pkg.exports;
    // An `exports` field fully governs what the package exposes: `null` blocks
    // everything, and a subpath the map does not declare stays unresolved rather
    // than reaching into the package directory.
    if (exports !== undefined) {
      if (exports === null) return undefined;
      const entry = typeof exports === "string"
        ? (subpath === "" ? exports : undefined)
        : (subpath === "" ? rootExportEntry(exports as Record<string, unknown>) : (exports as Record<string, unknown>)[`./${subpath}`]);
      const target = firstConditionString(entry);
      return target === undefined ? undefined : tryPath(resolve(local.dir, target));
    }
    // No `exports`: the root entry comes from module/main, subpaths map directly.
    const target = subpath === "" ? (firstConditionString(local.pkg.module) ?? firstConditionString(local.pkg.main)) : undefined;
    return tryPath(target !== undefined ? resolve(local.dir, target) : join(local.dir, subpath));
  }

  // Apply tsconfig `paths`: an exact key wins outright; otherwise only the single
  // wildcard with the longest literal prefix is used (no fall-through to broader
  // patterns), matching tsc.
  function resolveViaPaths(config: TsConfig, specifier: string): string | undefined {
    if (!config.paths || !config.pathsBase) return undefined;
    const base = config.pathsBase;
    let exact: string[] | undefined;
    let best: { prefixLen: number; targets: string[] } | undefined;
    for (const [pattern, rawTargets] of Object.entries(config.paths)) {
      if (!Array.isArray(rawTargets)) continue;
      const targets = rawTargets.filter((target): target is string => typeof target === "string");
      const star = pattern.indexOf("*");
      if (star === -1) { if (pattern === specifier) exact = targets; continue; }
      const prefix = pattern.slice(0, star); const suffix = pattern.slice(star + 1);
      if (specifier.startsWith(prefix) && specifier.endsWith(suffix) && specifier.length >= prefix.length + suffix.length) {
        const captured = specifier.slice(prefix.length, specifier.length - suffix.length);
        if (!best || prefix.length > best.prefixLen) best = { prefixLen: prefix.length, targets: targets.map((target) => target.replace("*", captured)) };
      }
    }
    const chosen = exact ?? best?.targets;
    if (chosen) for (const target of chosen) { const hit = tryPath(resolve(base, target)); if (hit) return hit; }
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
