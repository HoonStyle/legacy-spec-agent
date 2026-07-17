import { resolve } from "node:path";

export type RootSource =
  | "arg"
  | "LEGACY_SPEC_ROOT"
  | "CLAUDE_PROJECT_DIR"
  | "CODEX_PROJECT_DIR"
  | "cwd";

export interface RootResolution {
  root: string;
  source: RootSource;
}

/**
 * Resolve the project root the connector should serve. Precedence: explicit
 * CLI argument (unless it is an unsubstituted `${...}` placeholder), then the
 * env overrides, then the process working directory as a last resort.
 */
export function resolveRoot(
  argv2: string | undefined,
  env: Record<string, string | undefined>,
  cwd: string,
): RootResolution {
  if (argv2 && !argv2.startsWith("${")) return { root: resolve(argv2), source: "arg" };
  for (const name of ["LEGACY_SPEC_ROOT", "CLAUDE_PROJECT_DIR", "CODEX_PROJECT_DIR"] as const) {
    const value = env[name];
    if (value) return { root: resolve(value), source: name };
  }
  return { root: resolve(cwd), source: "cwd" };
}

/**
 * True when the resolved root is the connector package itself or the plugin
 * checkout that contains it. That is the silent-failure shape of a cwd
 * fallback: a launcher that provides neither a CLI argument nor a project-dir
 * env var (e.g. a Codex manifest with `cwd: "."`) leaves the connector
 * analyzing its own sources instead of the user's project.
 */
export function isSelfServing(root: string, connectorDir: string): boolean {
  const packageDir = resolve(connectorDir);
  return root === packageDir || root === resolve(packageDir, "..");
}
