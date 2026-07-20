import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { delimiter, extname, join, relative, resolve, sep } from "node:path";

export type ToolchainDecision = "download" | "skip";

interface LanguageSpec {
  id: string;
  label: string;
  extensions: Set<string>;
  command: string;
  versionArgs: string[];
  purpose: string;
  source: string;
}

const SKIP_DIRS = new Set([
  ".git", "node_modules", "dist", "bin", "obj", "__pycache__", ".venv", "venv", ".tox",
]);

const LANGUAGES: LanguageSpec[] = [
  { id: "python", label: "Python", extensions: new Set([".py"]), command: "python3", versionArgs: ["--version"], purpose: "Optional compiler-level Python analysis beyond the bundled syntax parser", source: "https://www.python.org/downloads/" },
  { id: "typescript", label: "Node.js / TypeScript", extensions: new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]), command: "node", versionArgs: ["--version"], purpose: "Optional TypeScript type analysis beyond the bundled syntax parser", source: "https://nodejs.org/en/download" },
  { id: "java", label: "Java", extensions: new Set([".java"]), command: "java", versionArgs: ["-version"], purpose: "Optional Java type analysis beyond the bundled syntax parser", source: "https://adoptium.net/temurin/releases/" },
  { id: "csharp", label: ".NET SDK", extensions: new Set([".cs"]), command: "dotnet", versionArgs: ["--version"], purpose: "Optional Roslyn semantic analysis beyond the bundled C# syntax parser", source: "https://dotnet.microsoft.com/download" },
  { id: "go", label: "Go", extensions: new Set([".go"]), command: "go", versionArgs: ["version"], purpose: "Optional Go type analysis beyond the bundled syntax parser", source: "https://go.dev/dl/" },
];

export interface ToolchainAssessmentOptions {
  subdir?: string;
  decisions?: Record<string, ToolchainDecision>;
  interactive?: boolean;
  cache_dir?: string;
  trusted_tool_dirs?: string[];
}

function safeStart(root: string, subdir?: string): string {
  const rootReal = realpathSync(resolve(root));
  const candidate = subdir ? resolve(rootReal, subdir) : rootReal;
  if (candidate !== rootReal && !candidate.startsWith(rootReal + sep)) throw new Error(`subdir escapes connector root: ${subdir}`);
  const startReal = realpathSync(candidate);
  if (startReal !== rootReal && !startReal.startsWith(rootReal + sep)) throw new Error(`subdir escapes connector root through symlink: ${subdir}`);
  return startReal;
}

function detectLanguages(root: string, subdir?: string): Map<string, { files: number; examples: string[] }> {
  const rootAbs = realpathSync(resolve(root));
  const stack = [safeStart(root, subdir)];
  const found = new Map<string, { files: number; examples: string[] }>();
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        const rel = relative(rootAbs, path).split(sep).join("/");
        if (!SKIP_DIRS.has(entry.name) && rel !== ".claude/worktrees") stack.push(path);
        continue;
      }
      if (!entry.isFile()) continue;
      const spec = LANGUAGES.find((candidate) => candidate.extensions.has(extname(entry.name).toLowerCase()));
      if (!spec) continue;
      const item = found.get(spec.id) ?? { files: 0, examples: [] };
      item.files++;
      if (item.examples.length < 3) item.examples.push(relative(rootAbs, path).split(sep).join("/"));
      found.set(spec.id, item);
    }
  }
  return found;
}

function readText(path: string): string | undefined {
  try { return readFileSync(path, "utf8"); } catch { return undefined; }
}

function requestedVersion(root: string, id: string): { version?: string; evidence?: string; policy?: "exact" | "range" } {
  const rootAbs = resolve(root);
  const exact: Record<string, string[]> = {
    python: [".python-version"],
    typescript: [".node-version", ".nvmrc"],
  };
  for (const name of exact[id] ?? []) {
    const path = join(rootAbs, name);
    const value = readText(path)?.trim();
    if (value) return { version: value, evidence: name, policy: "exact" };
  }
  if (id === "python") {
    const text = readText(join(rootAbs, "pyproject.toml"));
    const version = text?.match(/^requires-python\s*=\s*["']([^"']+)["']/m)?.[1].trim();
    if (version) return { version, evidence: "pyproject.toml", policy: "range" };
  }
  if (id === "typescript") {
    const text = readText(join(rootAbs, "package.json"));
    if (text) {
      try {
        const version = (JSON.parse(text) as { engines?: { node?: unknown } }).engines?.node;
        if (typeof version === "string") return { version, evidence: "package.json#engines.node", policy: /[<>=~^*|,]/.test(version) ? "range" : "exact" };
      } catch { /* malformed manifests are evidence gaps, not fatal */ }
    }
  }
  if (id === "java") {
    const pom = readText(join(rootAbs, "pom.xml"));
    const mavenVersion = pom?.match(/<(?:maven\.compiler\.release|java\.version)>\s*([^<\s]+)\s*</)?.[1];
    if (mavenVersion) return { version: mavenVersion, evidence: "pom.xml" };
    const gradle = readText(join(rootAbs, "build.gradle")) ?? readText(join(rootAbs, "build.gradle.kts"));
    const gradleVersion = gradle?.match(/JavaLanguageVersion\.of\((\d+)\)/)?.[1];
    if (gradleVersion) return { version: gradleVersion, evidence: existsSync(join(rootAbs, "build.gradle")) ? "build.gradle" : "build.gradle.kts" };
  }
  if (id === "csharp") {
    const text = readText(join(rootAbs, "global.json"));
    if (text) {
      try {
        const sdk = (JSON.parse(text) as { sdk?: { version?: unknown; rollForward?: unknown } }).sdk;
        if (typeof sdk?.version === "string") return { version: sdk.version, evidence: "global.json", policy: sdk.rollForward && sdk.rollForward !== "disable" ? "range" : "exact" };
      } catch { /* malformed manifests are evidence gaps, not fatal */ }
    }
  }
  if (id === "go") {
    const text = readText(join(rootAbs, "go.mod"));
    const toolchain = text?.match(/^toolchain\s+go([\w.-]+)/m);
    const directive = text?.match(/^go\s+([\w.-]+)/m);
    const version = toolchain?.[1] ?? directive?.[1];
    if (version) return { version, evidence: "go.mod" };
  }
  return {};
}

function defaultTrustedToolDirs(): string[] {
  if (process.platform === "win32") {
    const programFiles = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter((x): x is string => Boolean(x));
    const localPrograms = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Programs") : undefined;
    return [...programFiles, ...(localPrograms ? [join(localPrograms, "Python"), join(localPrograms, "dotnet")] : [])];
  }
  return ["/usr/bin", "/usr/local/bin", "/usr/lib", "/usr/lib64", "/usr/share/dotnet", "/opt/homebrew/bin", "/opt/local/bin"];
}

function executablePath(command: string, root: string, trustedToolDirs?: string[]): string | undefined {
  const rootReal = realpathSync(resolve(root));
  const trusted = (trustedToolDirs ?? defaultTrustedToolDirs()).flatMap((dir) => {
    try { return [realpathSync(resolve(dir))]; } catch { return []; }
  });
  const suffixes = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    for (const suffix of suffixes) {
      const candidate = resolve(dir, command + suffix.toLowerCase());
      if (!existsSync(candidate)) continue;
      let real: string;
      try { real = realpathSync(candidate); } catch { continue; }
      if (real === rootReal || real.startsWith(rootReal + sep)) continue;
      if (!trusted.some((dir) => real === dir || real.startsWith(dir + sep))) continue;
      return real;
    }
  }
  return undefined;
}

function installedVersion(spec: LanguageSpec, root: string, trustedToolDirs?: string[]): { version?: string; executable?: string } {
  const executable = executablePath(spec.command, root, trustedToolDirs);
  if (!executable) return {};
  const result = spawnSync(executable, spec.versionArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 5000 });
  if (result.error || result.status !== 0) return {};
  const value = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  return { version: value ? value.split(/\r?\n/)[0] : undefined, executable };
}

function versionNumbers(value: string | undefined): number[] {
  return value?.match(/\d+(?:\.\d+)*/)?.[0].split(".").map(Number) ?? [];
}

type Compatibility = "compatible" | "incompatible" | "unknown";
function isCompatible(id: string, installed: string | undefined, requested: string | undefined, policy?: "exact" | "range"): Compatibility {
  if (!installed) return "incompatible";
  if (!requested) return "compatible";
  if (policy === "range" || /[<>=~^*|,]/.test(requested)) return "unknown";
  const have = versionNumbers(installed);
  const want = versionNumbers(requested);
  if (!have.length || !want.length) return "unknown";
  if (have[0] !== want[0]) return "incompatible";
  if (id === "python" || id === "typescript") return have.slice(0, want.length).join(".") === want.join(".") ? "compatible" : "incompatible";
  if (id === "csharp") return have.slice(0, 3).join(".") === want.slice(0, 3).join(".") ? "compatible" : "incompatible";
  if (id === "go") return have[1] === want[1] ? "compatible" : "incompatible";
  return "compatible";
}

export function assessLanguageToolchains(root: string, opts: ToolchainAssessmentOptions = {}) {
  const detected = detectLanguages(root, opts.subdir);
  const interactive = opts.interactive ?? true;
  const cacheDir = opts.cache_dir ?? "~/.cache/legacy-spec-agent/toolchains";
  const toolchains = LANGUAGES.filter((spec) => detected.has(spec.id)).map((spec) => {
    const local = installedVersion(spec, root, opts.trusted_tool_dirs);
    const localVersion = local?.version;
    const requested = requestedVersion(root, spec.id);
    const compatibility = isCompatible(spec.id, localVersion, requested.version, requested.policy);
    const decision = opts.decisions?.[spec.id];
    const parserAvailable = true;
    const toolchainAvailable = Boolean(localVersion) && compatibility !== "incompatible";
    const status = toolchainAvailable ? "toolchain_available" : decision === "download" ? "download_requested" : parserAvailable ? "syntax_available" : "direct_source_only";
    return {
      language: spec.id,
      label: spec.label,
      files: detected.get(spec.id)!.files,
      examples: detected.get(spec.id)!.examples,
      status,
      local_version: localVersion,
      executable: local?.executable,
      compatibility,
      parser_available: parserAvailable,
      semantic_backend_available: false,
      sdk_download_recommended: false,
      requested_version: requested.version,
      version_evidence: requested.evidence,
      version_policy: requested.policy,
      decision: decision ?? (interactive ? "pending" : "skip"),
      purpose: spec.purpose,
      official_source: spec.source,
      cache_dir: cacheDir,
      semantic_analysis: false,
      toolchain_available: toolchainAvailable,
    };
  });
  const consentRequired = toolchains.filter((item) => item.sdk_download_recommended && !item.toolchain_available && item.decision === "pending");
  return {
    detected_languages: toolchains.map((item) => item.language),
    toolchains,
    consent_required: consentRequired.map((item) => ({
      language: item.language,
      tool: item.label,
      version: item.requested_version ?? "compatible version (not pinned by repository)",
      purpose: item.purpose,
      official_source: item.official_source,
      approximate_size: "unknown; confirm from the official distribution before approval",
      cache_dir: item.cache_dir,
      choices: ["download", "skip"],
    })),
    fallback: consentRequired.length || toolchains.some((item) => !item.semantic_backend_available)
      ? "Continue with direct source inspection or an available syntax parser; report unresolved semantic facts."
      : undefined,
  };
}
