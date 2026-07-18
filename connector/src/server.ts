import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { verifyCitation } from "./verify.js";
import { indexSymbols, buildCallGraph } from "./indexer.js";
import { detectDrift } from "./drift.js";
import { extractDataModel, extractProjectMeta, extractChangelog } from "./extractors.js";
import { emitChart } from "./charts.js";
import { renderReport } from "./report.js";

const count = z.number().int().min(0);
const emitChartsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("coverage"),
    verified: count,
    unverified: count,
    title: z.string().optional(),
  }),
  z.object({
    kind: z.literal("drift"),
    intact: count,
    moved: count,
    drifted: count,
    orphaned: count,
    title: z.string().optional(),
  }),
  z.object({
    kind: z.literal("benchmark"),
    groups: z
      .array(z.object({ label: z.string(), with_skill: z.number(), baseline: z.number() }))
      .min(1),
    title: z.string().optional(),
    unit: z.string().optional(),
  }),
  z.object({
    kind: z.literal("architecture"),
    edges: z.array(z.object({ from: z.string(), to: z.string(), weight: z.number().optional() })),
    externals: z.array(z.object({ module: z.string() })).optional(),
    direction: z.enum(["TD", "LR"]).optional(),
    cluster: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("erd"),
    entities: z.array(
      z.object({
        name: z.string(),
        fields: z.array(z.object({ name: z.string(), type: z.string() })).optional(),
      }),
    ),
    relations: z
      .array(
        z.object({
          from: z.string(),
          to: z.string(),
          field: z.string().optional(),
          cardinality: z.enum(["one", "many"]).optional(),
        }),
      )
      .optional(),
  }),
]);

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function createServer(root: string): McpServer {
  const server = new McpServer({
    name: "legacy-spec-connector",
    version: "0.1.0",
  });

  server.registerTool(
    "verify_citation",
    {
      description:
        "Deterministically verify a path:line citation against the actual source under the connector root. " +
        "Returns verdict match | line_mismatch | file_missing | content_mismatch, the actual source around the " +
        "cited line, and a suggested_line when the expected snippet is found elsewhere (moved candidate). " +
        "Mechanical guarantee: location validity + exact source retrieval (+ snippet check when expected_snippet " +
        "is given). Judging whether a natural-language claim is semantically supported by the returned source " +
        "remains the caller's (LLM critic's) job.",
      inputSchema: {
        path: z.string().describe("Cited file path, relative to the connector root"),
        line: z.number().int().describe("1-based cited line number"),
        expected_snippet: z
          .string()
          .optional()
          .describe("Code fragment the claim cites; enables content check + moved-candidate scan"),
        claim: z.string().optional().describe("The natural-language claim (audit logging only)"),
        context_lines: z.number().int().min(0).max(50).optional().describe("Context lines around the citation (default 3)"),
      },
    },
    async (params) => json(verifyCitation(root, params)),
  );

  server.registerTool(
    "index_symbols",
    {
      description:
        "Parse the codebase once (tree-sitter, Python for now) into a symbol index: functions, methods, classes " +
        "with exact line ranges and signatures per module. Use this instead of re-reading files to locate code. " +
        "Files in unsupported languages are counted in unsupported_files, never silently dropped.",
      inputSchema: {
        subdir: z.string().optional().describe("Restrict indexing to a subdirectory of the connector root"),
        granularity: z
          .enum(["file", "package"])
          .optional()
          .describe("'file' (default) returns per-module symbols; 'package' returns per-package counts only (zoom out)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100000)
          .optional()
          .describe("file granularity: max symbols before truncation (default 2000); reports `truncated`"),
      },
    },
    async (params) => json(indexSymbols(root, params)),
  );

  server.registerTool(
    "build_call_graph",
    {
      description:
        "Build the module-to-module edge list from import statements (tree-sitter, Python for now) for " +
        "ARCHITECTURE.md. Package-qualified and relative imports are resolved to files inside the root; " +
        "everything else is reported under externals with its importers.",
      inputSchema: {
        subdir: z.string().optional().describe("Restrict analysis to a subdirectory of the connector root"),
        granularity: z
          .enum(["file", "package"])
          .optional()
          .describe("'file' (default) is file→file edges; 'package' collapses to package→package edges with weight (zoom out)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20000)
          .optional()
          .describe("file granularity: max edges before truncation (default 500); reports `truncated`"),
      },
    },
    async (params) => json(buildCallGraph(root, params)),
  );

  server.registerTool(
    "detect_drift",
    {
      description:
        "Mode B: re-check baseline SPEC citations against the current working tree and classify each as " +
        "intact | moved | drifted | orphaned. baseline_ref is the git ref the SPEC was generated at (recorded " +
        "in its Source line); the cited line's content AT that ref is the drift probe, so no stored snippets " +
        "are needed. Deterministic — the human still owns the SPEC.md merge (Hard rule 3).",
      inputSchema: {
        baseline_ref: z.string().describe("Git ref the SPEC was generated at, e.g. the commit in its Source line"),
        citations: z
          .array(
            z.object({
              id: z.string().optional().describe("Claim id from audit_log.jsonl"),
              path: z.string().describe("Cited file, relative to the connector root"),
              line: z.number().int().describe("1-based cited line"),
            }),
          )
          .describe("Citations from the existing SPEC/audit log"),
      },
    },
    async (params) => json(detectDrift(root, params)),
  );

  server.registerTool(
    "extract_data_model",
    {
      description:
        "Reverse-engineer the data model (tree-sitter, Python): dataclasses and annotated/model classes become " +
        "entities with typed fields and line citations; typed fields referencing another entity become relations " +
        "(List[X] → many, else one). Feed the result to emit_charts kind 'erd' for a Mermaid ER diagram, and to " +
        "DATA_MODEL.md. Grounded — no relation is invented that a field type doesn't state.",
      inputSchema: {
        subdir: z.string().optional().describe("Restrict extraction to a subdirectory of the connector root"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(5000)
          .optional()
          .describe("max entities before truncation (default 200); reports `truncated`"),
      },
    },
    async (params) => json(extractDataModel(root, params)),
  );

  server.registerTool(
    "extract_project_meta",
    {
      description:
        "Extract onboarding facts from manifests and code: name/version/description (package.json, pyproject, " +
        ".claude-plugin/plugin.json), dependencies, run commands (npm scripts, plugin hooks, Dockerfile), the " +
        "env/config var surface (os.environ/getenv, process.env — each with path:line), test inventory " +
        "(test files, test case names, framework, and test-scoped env vars), and which of README/Dockerfile/CI/tests " +
        "exist. Basis for README.md / ONBOARDING.md / TESTCASES.md.",
      inputSchema: {},
    },
    async () => json(extractProjectMeta(root)),
  );

  server.registerTool(
    "extract_changelog",
    {
      description:
        "Build a CHANGELOG from git history scoped to the connector root (git log -- .). Conventional-commit " +
        "subjects (type(scope): msg) are grouped by type; the rest fall under 'other'. Input is git history, not " +
        "code state — this is the one deliverable sourced from the repo's log rather than its files.",
      inputSchema: {
        max: z.number().int().min(1).max(1000).optional().describe("Max commits to read (default 100)"),
      },
    },
    async (params) => json(extractChangelog(root, params)),
  );

  server.registerTool(
    "emit_charts",
    {
      description:
        "Render report charts deterministically from structured data — same data in, same bytes out. " +
        "Pass the chart fields flat alongside kind. kinds: coverage {verified, unverified} → SVG donut with " +
        "hero %; drift {intact, moved, drifted, orphaned} → SVG status bars; benchmark {groups: [{label, " +
        "with_skill, baseline}], unit?} → SVG grouped bars; architecture {edges: [{from, to}], externals?} → " +
        "Mermaid flowchart; erd {entities: [{name, fields?}], relations?} → Mermaid ER diagram. Every chart " +
        "returns {format, content, alt} — embed content in the report and use alt as its caption.",
      inputSchema: emitChartsSchema,
    },
    async (params) => json(emitChart(params)),
  );

  server.registerTool(
    "render_report",
    {
      description:
        "Assemble the deliverables in a directory into one self-contained tabbed HTML page (REPORT.html), " +
        "written next to them. Reads the known markdown deliverables, audit_log.jsonl, and charts/ (SVG " +
        "inlined, PNG as data URIs). A mermaid fence in DOC.md is replaced by charts/DOC.<n>.svg|png when " +
        "present, else kept as source. Returns a summary {path, bytes, tabs, charts_embedded, " +
        "mermaid_fallbacks}, not the page itself. Deterministic: same inputs, same bytes.",
      inputSchema: {
        dir: z.string().optional().describe("Deliverables directory relative to the connector root (default '.')"),
        title: z.string().optional().describe("Page title (default 'Reconstructed spec — report')"),
      },
    },
    async (params) => json(renderReport(root, params)),
  );

  return server;
}
