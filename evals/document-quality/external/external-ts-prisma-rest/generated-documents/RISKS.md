# RISKS — rest-express-docker-aws-ec2

Analyzed source commit: eb8f4328821c6746680a2ba02e0e5636a085a327
Generated at: 2026-07-30
Coverage: all in-scope files were read in full (src/**, prisma/**, package.json, tsconfig.json, .env.example, Dockerfile, docker-compose.yml, README.md); excluded by scope manifest: .github/**, prisma.config.ts, .dockerignore, .gitignore. No truncation occurred.

Triage values below are assessments, not measured facts.

## Confirmed behavior

- **RSK-001** — CLM-195: Every route, including destructive deletion, is reachable without authentication or authorization; the only registered middleware is the JSON body parser (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:8-10`).
  - Severity: high. Likelihood: high if exposed publicly. Impact: any client can create, publish, or delete data. Confidence: high.
  - Mitigation: add an authentication/authorization layer before the routers. Suggested action: treat as a hard requirement before any public deployment. Owner: unassigned. Status: open.
  - Related: API-005, API-006
- **RSK-002** — CLM-196: Handler catch blocks discard the caught error and return a generic 500, so failure causes are never logged (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:24-26`).
  - Severity: medium. Likelihood: high on any database failure. Impact: production incidents are hard to diagnose. Confidence: high.
  - Mitigation: log the error with context before responding. Suggested action: add structured error logging. Owner: unassigned. Status: open.
  - Related: API-001
- **RSK-003** — CLM-197: Single-post reads do not filter on the published flag, so unpublished posts are readable by ID even though the feed hides them (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:33-36`).
  - Severity: medium. Likelihood: high via ID enumeration. Impact: draft content disclosure. Confidence: high that the behavior exists; whether it is intended is unknown.
  - Mitigation: decide and enforce a visibility rule for unpublished posts. Suggested action: confirm intent with the owners. Owner: unassigned. Status: open.
  - Related: API-002, BR-001
- **RSK-004** — CLM-198: The feed query is unbounded — no pagination, limit, or ordering (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:19-22`).
  - Severity: medium. Likelihood: grows with data volume. Impact: memory and latency degradation on large tables. Confidence: high.
  - Mitigation: add pagination parameters and a maximum page size. Suggested action: bound the query. Owner: unassigned. Status: open.
  - Related: API-001

## Defect candidates

- **RSK-005** — CLM-199: The content field is passed to the database without any type or length validation, so a non-string value surfaces as a generic 500 instead of a 400 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:63`).
  - Severity: low. Likelihood: medium. Impact: misleading error class for a client mistake. Confidence: medium (candidate, not confirmed by execution).
  - Mitigation: validate body field types before the create call. Suggested action: add input validation. Owner: unassigned. Status: open.
  - Related: API-003
- **RSK-006** — CLM-200: PORT is used without numeric validation, so a non-numeric environment value would be passed straight to the listener (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:12`).
  - Severity: low. Likelihood: low. Impact: startup failure or listening on an unintended port. Confidence: medium (candidate, not confirmed by execution).
  - Mitigation: parse and validate PORT at startup. Suggested action: add a numeric check with a clear error. Owner: unassigned. Status: open.
  - Related: DM-ENV-PORT

## Unverified gaps

- **UV-004** — Dockerfile behavior (multi-stage build, non-root runtime user, exposed port, container start command) cannot be verified because Dockerfile is not a citable file type in this workflow. Searched: repository root.
- **UV-005** — Compose behavior (bundled Postgres service, hardcoded development credentials, automatic migrate-deploy on startup, port mappings) cannot be verified because compose files are not citable. Searched: repository root.
- **UV-006** — The AWS ECR/EC2 deployment automation lives in a workflow file excluded from scope; its behavior is known only from README prose and is unverified. Searched: scope manifest exclusions.
- **UV-007** — The initial SQL migration's table definitions cannot be verified because SQL files are not citable. Searched: prisma migrations directory.
- See also UV-001, UV-002, and UV-003 in SPEC.md for schema, env-example, and build-output gaps.
