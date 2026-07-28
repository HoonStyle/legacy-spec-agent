import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { resolveWithinRoot } from "./matching.js";

export interface DiscoveredCoverageSurface {
  surface: string;
  found_at: string;
  expected_document_type: "API" | "DM" | "BR" | "TC" | "RSK";
}

export interface ExcludedPath {
  path: string;
  reason: string;
}

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".java", ".cs", ".go"]);

function filesAt(path: string): string[] {
  const stats = lstatSync(path);
  if (stats.isSymbolicLink()) return [];
  if (!stats.isDirectory()) return stats.isFile() ? [path] : [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? filesAt(child) : entry.isFile() ? [child] : [];
  });
}

/** File- and directory-level exclusions; line-suffixed exclusions stay line-scoped and do not remove files. */
function fileLevelExclusions(excludedPaths: ExcludedPath[]): string[] {
  return excludedPaths.filter((item) => !/:\d+(?:-\d+)?$/.test(item.path)).map((item) => item.path.replaceAll("\\", "/"));
}

function isExcluded(relativeFile: string, exclusions: string[]): boolean {
  return exclusions.some((excluded) => relativeFile === excluded || relativeFile.startsWith(`${excluded}/`));
}

export function includedSourceFiles(root: string, includedPaths: string[], excludedPaths: ExcludedPath[] = []): string[] {
  const realRoot = realpathSync(root);
  const exclusions = fileLevelExclusions(excludedPaths);
  const files = new Set<string>();
  for (const included of includedPaths) {
    const path = resolveWithinRoot(root, included.replace(/:\d+(?:-\d+)?$/, ""));
    if (lstatSync(path).isSymbolicLink()) continue;
    const real = realpathSync(path);
    if (real !== realRoot && !real.startsWith(realRoot + sep)) continue;
    for (const file of filesAt(path)) {
      if (!SOURCE_EXTENSIONS.has(extname(file).toLowerCase())) continue;
      if (isExcluded(relative(root, file).replaceAll("\\", "/"), exclusions)) continue;
      files.add(file);
    }
  }
  return [...files].sort();
}

/** Deterministic syntax surface used as the code→documentation audit denominator. */
export function extractCoverageSurface(root: string, includedPaths: string[], excludedPaths: ExcludedPath[] = []): DiscoveredCoverageSurface[] {
  const found = new Map<string, DiscoveredCoverageSurface>();
  const add = (surface: string, file: string, line: number, expected_document_type: DiscoveredCoverageSurface["expected_document_type"]) => {
    const item = { surface, found_at: `${relative(root, file).replaceAll("\\", "/")}:${line}`, expected_document_type };
    found.set(`${expected_document_type}:${surface}:${item.found_at}`, item);
  };
  for (const file of includedSourceFiles(root, includedPaths, excludedPaths)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      const relativeFile = relative(root, file).replaceAll("\\", "/");
      const isTest = /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|(?:\.test|\.spec)\.[^.]+$/.test(relativeFile);
      if (isTest) add(`test_file:${relative(root, file).replaceAll("\\", "/")}`, file, 1, "TC");
      lines.forEach((line, index) => {
        const lineNo = index + 1;
        for (const match of line.matchAll(/\b(?:export\s+(?:async\s+)?(?:function|const|class)|public\s+(?:static\s+)?(?:class|interface))\s+([A-Za-z_$][\w$]*)/g))
          add(`registered_api:${match[1]}`, file, lineNo, "API");
        for (const match of line.matchAll(/\b(?:registerTool|register|route|(?:app|router)\.(?:get|post|put|patch|delete))\s*\(\s*["']([^"']+)/g))
          add(`registered_api:${match[1]}`, file, lineNo, "API");
        for (const match of line.matchAll(/@(?:Get|Post|Put|Patch|Delete|Route)\s*\(\s*["']?([^"')\s]*)/g))
          add(`registered_api:${match[1] || "decorated-route"}`, file, lineNo, "API");
        for (const match of line.matchAll(/\b(?:interface|type|record|struct)\s+([A-Za-z_$][\w$]*)/g))
          add(`data_contract:${match[1]}`, file, lineNo, "DM");
        for (const match of line.matchAll(/(?:process\.env\.|os\.environ\[?["']?|os\.environ\.get\(\s*["']|os\.getenv\(\s*["']|os\.Getenv\(\s*["']|System\.getenv\(\s*["']|Environment\.GetEnvironmentVariable\(["'])([A-Z][A-Z0-9_]*)/g))
          add(`environment:${match[1]}`, file, lineNo, "DM");
        if (/\b(?:writeFile|writeFileSync|fetch|spawn|execFile|http\.(?:request|get))\s*\(/.test(line))
          add(`external_side_effect:${line.trim()}`, file, lineNo, "RSK");
        if (/\b(?:unlink|rm|rename|mkdir|appendFile|exec|publish|send|save|commit)\s*\(/.test(line))
          add(`external_side_effect:${line.trim()}`, file, lineNo, "RSK");
        for (const match of line.matchAll(/\b(?:status|state)\s*[:=]\s*["']([A-Za-z0-9_-]+)["']/gi))
          add(`status_value:${match[1]}`, file, lineNo, "BR");
        if (/\b(?:function\s+main|def\s+main|static\s+void\s+Main|func\s+main)\b|if\s+__name__\s*==\s*["']__main__["']/.test(line))
          add(`entrypoint:${relativeFile}`, file, lineNo, "BR");
      });
  }
  return [...found.values()].sort((a, b) => a.found_at.localeCompare(b.found_at) || a.surface.localeCompare(b.surface));
}
