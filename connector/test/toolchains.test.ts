import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assessLanguageToolchains } from "../src/toolchains.js";

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "lsc-toolchains-"));
  writeFileSync(join(root, "app.cs"), "class App {}\n");
  writeFileSync(join(root, "main.go"), "package main\n");
  writeFileSync(join(root, "global.json"), JSON.stringify({ sdk: { version: "8.0.407" } }));
  writeFileSync(join(root, "go.mod"), "module example.test/app\n\ngo 1.23\ntoolchain go1.24.1\n");
  mkdirSync(join(root, "bin"));
  writeFileSync(join(root, "bin", "generated.java"), "class Generated {}\n");
  return root;
}

function withoutPath<T>(fn: () => T): T {
  const previous = process.env.PATH;
  process.env.PATH = "";
  try { return fn(); } finally { process.env.PATH = previous; }
}

function writeVersionShim(bin: string, command: string, output: string): string {
  if (process.platform === "win32") {
    const path = join(bin, `${command}.EXE`);
    copyFileSync(process.execPath, path);
    return path;
  }
  const path = join(bin, command);
  writeFileSync(path, `#!/bin/sh\necho '${output}'\n`);
  chmodSync(path, 0o755);
  return path;
}

test("assessLanguageToolchains: detects source, ignores build output, and reads version pins", () => {
  const root = fixture();
  try {
    const result = withoutPath(() => assessLanguageToolchains(root));
    assert.deepEqual(result.detected_languages, ["csharp", "go"]);
    assert.equal(result.toolchains[0].requested_version, "8.0.407");
    assert.equal(result.toolchains[0].version_evidence, "global.json");
    assert.equal(result.toolchains[1].requested_version, "1.24.1");
    assert.equal(result.toolchains[1].version_evidence, "go.mod");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("assessLanguageToolchains: bundled parsers avoid unnecessary SDK download consent", () => {
  const root = fixture();
  try {
    const result = withoutPath(() => assessLanguageToolchains(root, { cache_dir: "/safe/cache" }));
    assert.equal(result.consent_required.length, 0);
    assert.ok(result.toolchains.every((item) => item.parser_available && !item.sdk_download_recommended));
    assert.ok(result.toolchains.every((item) => item.cache_dir === "/safe/cache"));
    assert.ok(result.fallback);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("assessLanguageToolchains: decline is remembered and does not ask again", () => {
  const root = fixture();
  try {
    const result = withoutPath(() => assessLanguageToolchains(root, { decisions: { csharp: "skip", go: "skip" } }));
    assert.equal(result.consent_required.length, 0);
    assert.ok(result.toolchains.every((item) => item.status === "syntax_available" && item.decision === "skip"));
    assert.ok(result.fallback);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("assessLanguageToolchains: non-interactive mode defaults to no download", () => {
  const root = fixture();
  try {
    const result = withoutPath(() => assessLanguageToolchains(root, { interactive: false }));
    assert.equal(result.consent_required.length, 0);
    assert.ok(result.toolchains.every((item) => item.decision === "skip"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("assessLanguageToolchains: download selection is only a request until the SDK is available", () => {
  const root = fixture();
  try {
    const result = withoutPath(() => assessLanguageToolchains(root, { decisions: { csharp: "download", go: "skip" } }));
    const dotnet = result.toolchains.find((item) => item.language === "csharp")!;
    assert.equal(dotnet.status, "download_requested");
    assert.equal(dotnet.semantic_analysis, false);
    assert.ok(result.fallback, "failed or not-yet-completed downloads retain the safe fallback");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("assessLanguageToolchains: an installed SDK is available but does not invent a semantic backend", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-toolchains-local-"));
  const bin = mkdtempSync(join(tmpdir(), "lsc-tool-bin-"));
  writeFileSync(join(root, "app.py"), "print('ok')\n");
  writeVersionShim(bin, "python3", "Python 3.12.4");
  const previous = process.env.PATH;
  process.env.PATH = bin;
  try {
    const result = assessLanguageToolchains(root, { trusted_tool_dirs: [bin] });
    assert.equal(result.consent_required.length, 0);
    assert.equal(result.toolchains[0].status, "toolchain_available");
    assert.equal(result.toolchains[0].semantic_analysis, false);
    assert.match(result.toolchains[0].local_version!, process.platform === "win32" ? /^v\d+/ : /^Python 3\.12\.4$/);
  } finally {
    process.env.PATH = previous;
    rmSync(root, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test("assessLanguageToolchains: falls back to the Windows-style python command", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-toolchains-python-fallback-"));
  const bin = mkdtempSync(join(tmpdir(), "lsc-tool-bin-"));
  writeFileSync(join(root, "app.py"), "print('ok')\n");
  const shim = writeVersionShim(bin, "python", "Python 3.12.4");
  const previous = process.env.PATH;
  process.env.PATH = bin;
  try {
    const result = assessLanguageToolchains(root, { trusted_tool_dirs: [bin] });
    assert.equal(result.toolchains[0].status, "toolchain_available");
    assert.equal(result.toolchains[0].executable, realpathSync(shim));
  } finally {
    process.env.PATH = previous;
    rmSync(root, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test("assessLanguageToolchains: an incompatible local SDK still requires consent", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-toolchains-version-"));
  const bin = mkdtempSync(join(tmpdir(), "lsc-tool-bin-"));
  writeFileSync(join(root, "app.py"), "print('ok')\n");
  writeFileSync(join(root, ".python-version"), "3.12.4\n");
  writeVersionShim(bin, "python3", "Python 2.7.18");
  const previous = process.env.PATH;
  process.env.PATH = bin;
  try {
    const result = assessLanguageToolchains(root, { trusted_tool_dirs: [bin] });
    assert.equal(result.toolchains[0].compatibility, "incompatible");
    assert.equal(result.toolchains[0].status, "syntax_available");
    assert.equal(result.consent_required.length, 0);
  } finally {
    process.env.PATH = previous;
    rmSync(root, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test("assessLanguageToolchains: rejects subdirectories outside the connector root", () => {
  const root = fixture();
  try {
    assert.throws(() => assessLanguageToolchains(root, { subdir: "../outside" }), /escapes connector root/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("assessLanguageToolchains: rejects a subdir symlink that escapes the root", () => {
  const root = fixture();
  const outside = mkdtempSync(join(tmpdir(), "lsc-outside-"));
  symlinkSync(outside, join(root, "linked"), "dir");
  try {
    assert.throws(() => assessLanguageToolchains(root, { subdir: "linked" }), /symlink/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("assessLanguageToolchains: never executes an SDK shim from the target repository", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-malicious-path-"));
  writeFileSync(join(root, "app.py"), "print('ok')\n");
  writeFileSync(join(root, "python3"), "#!/bin/sh\necho 'Python 3.12.4'\n");
  chmodSync(join(root, "python3"), 0o755);
  const previous = process.env.PATH;
  process.env.PATH = root;
  try {
    const result = assessLanguageToolchains(root);
    assert.equal(result.toolchains[0].executable, undefined);
    assert.equal(result.toolchains[0].semantic_analysis, false);
  } finally {
    process.env.PATH = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test("assessLanguageToolchains: ignores an untrusted SDK shim outside the repository", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-untrusted-sdk-root-"));
  const attacker = mkdtempSync(join(tmpdir(), "lsc-untrusted-sdk-bin-"));
  writeFileSync(join(root, "app.py"), "print('ok')\n");
  writeFileSync(join(attacker, "python3"), "#!/bin/sh\necho 'Python 3.12.4'\n"); chmodSync(join(attacker, "python3"), 0o755);
  const previous = process.env.PATH; process.env.PATH = attacker;
  try {
    const result = assessLanguageToolchains(root);
    assert.equal(result.toolchains[0].executable, undefined);
  } finally {
    process.env.PATH = previous; rmSync(root, { recursive: true, force: true }); rmSync(attacker, { recursive: true, force: true });
  }
});

test("assessLanguageToolchains: honors every component of an exact Node pin", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-node-exact-")); const bin = mkdtempSync(join(tmpdir(), "lsc-node-bin-"));
  writeFileSync(join(root, "app.ts"), "export const x = 1;\n"); writeFileSync(join(root, ".node-version"), "20.1.0\n");
  writeVersionShim(bin, "node", "v20.19.0");
  const previous = process.env.PATH; process.env.PATH = bin;
  try {
    const result = assessLanguageToolchains(root, { trusted_tool_dirs: [bin] });
    assert.equal(result.toolchains[0].compatibility, "incompatible");
  } finally {
    process.env.PATH = previous; rmSync(root, { recursive: true, force: true }); rmSync(bin, { recursive: true, force: true });
  }
});

test("assessLanguageToolchains: reads a Maven Java version pin", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-java-pin-"));
  writeFileSync(join(root, "App.java"), "class App {}\n");
  writeFileSync(join(root, "pom.xml"), "<project><properties><maven.compiler.release>21</maven.compiler.release></properties></project>\n");
  try {
    const result = withoutPath(() => assessLanguageToolchains(root));
    assert.equal(result.toolchains[0].requested_version, "21");
    assert.equal(result.toolchains[0].version_evidence, "pom.xml");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("assessLanguageToolchains: reports unsupported Python ranges as unknown instead of guessing", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-python-range-"));
  const bin = mkdtempSync(join(tmpdir(), "lsc-tool-bin-"));
  writeFileSync(join(root, "app.py"), "print('ok')\n");
  writeFileSync(join(root, "pyproject.toml"), "[project]\nrequires-python = \">=3.9,<4\"\n");
  writeVersionShim(bin, "python3", "Python 3.12.4");
  const previous = process.env.PATH; process.env.PATH = bin;
  try {
    const result = assessLanguageToolchains(root, { trusted_tool_dirs: [bin] });
    assert.equal(result.toolchains[0].requested_version, ">=3.9,<4");
    assert.equal(result.toolchains[0].compatibility, "unknown");
    assert.equal(result.toolchains[0].toolchain_available, true);
  } finally {
    process.env.PATH = previous;
    rmSync(root, { recursive: true, force: true }); rmSync(bin, { recursive: true, force: true });
  }
});

test("assessLanguageToolchains: keeps a range unknown when no local SDK is installed", () => {
  const root = mkdtempSync(join(tmpdir(), "lsc-python-range-missing-"));
  writeFileSync(join(root, "app.py"), "print('ok')\n");
  writeFileSync(join(root, "pyproject.toml"), "[project]\nrequires-python = \">=3.9,<4\"\n");
  try {
    const result = withoutPath(() => assessLanguageToolchains(root));
    assert.equal(result.toolchains[0].compatibility, "unknown");
    assert.equal(result.toolchains[0].toolchain_available, false);
    assert.equal(result.toolchains[0].status, "syntax_available");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
