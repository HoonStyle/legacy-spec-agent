import assert from "node:assert/strict";
import { evaluate } from "./evaluate-document-quality.mjs";
const api = { id: "G-1", category: "api", surface: "GET /users", found_at: "app.ts:1", source_citation: "app.ts:1", expected_document_type: "API", importance: "critical" };
const env = { id: "G-2", category: "env", surface: "API_URL", found_at: "app.ts:2", source_citation: "app.ts:2", expected_document_type: "DM", importance: "normal" };
const invented = { category: "api", surface: "invented", found_at: "app.ts:3", expected_document_type: "API" };
assert.deepEqual(evaluate([api, env], [api, invented]), {
  counts: { gold: 2, actual: 2, true_positive: 1, false_positive: 1, false_negative: 1 },
  precision: 0.5, recall: 0.5, critical_recall: 1,
  categories: { api: { precision: 0.5, recall: 1, gold: 1, actual: 2 }, env: { precision: null, recall: 0, gold: 1, actual: 0 } },
});
assert.throws(() => evaluate([api], [api, api]), /duplicate/);
assert.deepEqual(evaluate([], []), { counts: { gold: 0, actual: 0, true_positive: 0, false_positive: 0, false_negative: 0 }, precision: null, recall: null, critical_recall: null, categories: {} });
assert.equal(evaluate([api], [{ ...api, expected_document_type: "BR" }]).counts.true_positive, 0);
