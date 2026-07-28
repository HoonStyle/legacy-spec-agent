# Gold annotation contract

Every JSONL row has `id`, `category`, `surface`, `found_at`, `expected_document_type`, `importance`, and a human-reviewed source citation. Categories are registered API, data contract, configuration/environment, entrypoint, status/state, test behavior, persistence/side effect, external integration, and business rule. Critical annotations include public interfaces, security boundaries, destructive side effects, and required configuration.

Gold annotations are frozen before evaluating a generated draft. Two reviewers resolve disagreements; generated document text is never copied into the gold set. Reports publish raw true-positive, false-positive, and false-negative counts with precision and recall. Approval status alone is not a quality metric.
