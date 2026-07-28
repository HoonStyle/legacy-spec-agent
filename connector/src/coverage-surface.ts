import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { resolveWithinRoot } from "./matching.js";

export interface DiscoveredCoverageSurface {
  surface: string;
  found_at: string;
  expected_document_type: "API" | "DM" | "BR" | "TC" | "RSK";
}

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".cs", ".go"]);

function filesAt(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? filesAt(child) : entry.isFile() ? [child] : [];
  });
}

export function includedSourceFiles(root: string, includedPaths: string[]): string[] {
  const files = new Set<string>();
  for (const included of includedPaths) {
    const path = resolveWithinRoot(root, included.replace(/:\d+(?:-\d+)?$/, ""));
    for (const file of filesAt(path)) if (SOURCE_EXTENSIONS.has(extname(file))) files.add(file);
  }
  return [...files].sort();
}

/** Deterministic syntax surface used as the code→documentation audit denominator. */
export function extractCoverageSurface(root: string, includedPaths: string[]): DiscoveredCoverageSurface[] {
  const found = new Map<string, DiscoveredCoverageSurface>();
  const add = (surface: string, file: string, line: number, expected_document_type: DiscoveredCoverageSurface["expected_document_type"]) => {
    const item = { surface, found_at: `${relative(root, file).replaceAll("\\", "/")}:${line}`, expected_document_type };
    found.set(`${expected_document_type}:${surface}:${item.found_at}`, item);
  };
  for (const file of includedSourceFiles(root, includedPaths)) {
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
        for (const match of line.matchAll(/(?:process\.env\.|os\.environ\[?["']?|Environment\.GetEnvironmentVariable\(["'])([A-Z][A-Z0-9_]*)/g))
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
