#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractCoverageSurface } from "../connector/dist/src/coverage-surface.js";

const [rootArg, outputArg] = process.argv.slice(2);
if (!rootArg || !outputArg) throw new Error("usage: extract-document-surfaces.mjs SOURCE_ROOT OUTPUT.jsonl");
const root = resolve(rootArg);
const rows = extractCoverageSurface(root, ["."]);
writeFileSync(resolve(outputArg), rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
