# Coverage Sentinel notes — external-ts-prisma-rest

actor_id: sentinel-ext1
draft_digest: 9d288ff7b5c6ba41d8e2cad91b959e9025b5cd9b48238c49881c656771c93d32

## Method

1. Read `raw-extractor-output.json` verbatim (5 entries) — did not assume the expected mapping given in the task prompt; independently matched each `surface`/`found_at` pair.
2. Read every staging document (SPEC.md, ARCHITECTURE.md, INTERFACES.md, DATA_MODEL.md, ONBOARDING.md, TESTCASES.md, RISKS.md) in full.
3. For each detector surface, located the typed heading whose section body (from that heading to the next heading of any level) contains the exact `found_at` string wrapped in backticks. No script was needed — sections were short enough to check by inspection; grep-equivalent visual scan confirmed exact byte-for-byte string match (path + `:` + line number).
4. Independently read every in-scope source file (`src/index.ts`, `src/lib/prisma.ts`, `src/routes/post.routes.ts`, `src/routes/user.routes.ts`, `prisma/schema.prisma`, `prisma/migrations/20240101000000_init/migration.sql`, `docker-compose.yml`, `.env.example`, `Dockerfile`, `package.json`, `README.md`) to enumerate documentable surfaces without reference to the detector or gold files, then checked whether the draft documents each one anyway (Part B).
5. Did not open any `gold-*` file. Did not invoke any MCP tool.

## Part A — per-surface verification (all 5 pass)

| # | surface | found_at | heading | verbatim backticked found_at present in section body? | document_id |
|---|---|---|---|---|---|
| 1 | `registered_api:prisma` | `.../src/lib/prisma.ts:10` | `#### API-PRISMA` (INTERFACES.md) | Yes — CLM-091 cites `deployment-platforms/rest-express-docker-aws-ec2/src/lib/prisma.ts:10` | API-PRISMA |
| 2 | `registered_api:postRouter` | `.../src/routes/post.routes.ts:5` | `#### API-POSTROUTER` (INTERFACES.md) | Yes — CLM-094 cites `.../src/routes/post.routes.ts:5` | API-POSTROUTER |
| 3 | `registered_api:userRouter` | `.../src/routes/user.routes.ts:5` | `#### API-USERROUTER` (INTERFACES.md) | Yes — CLM-096 cites `.../src/routes/user.routes.ts:5` | API-USERROUTER |
| 4 | `environment:PORT` | `.../src/index.ts:12` | `#### DM-ENV-PORT` (DATA_MODEL.md) | Yes — CLM-146 cites `.../src/index.ts:12` | DM-ENV-PORT |
| 5 | `environment:DATABASE_URL` | `.../src/lib/prisma.ts:4` | `#### DM-ENV-DATABASE-URL` (DATA_MODEL.md) | Yes — CLM-148 cites `.../src/lib/prisma.ts:4` | DM-ENV-DATABASE-URL |

Result: 5/5 pass. Document-type prefixes (API-*, DM-*) match the detector's `expected_document_type`. Verdict: **passed**. No explained or unexplained omissions in the machine-checked set.

## Part B — real reverse audit (detector-missed surfaces)

The detector's `line-syntax` pass only fires on three category patterns (a router/client export line, and two `process.env.X` reads). It does **not** look at HTTP verb+path registrations, Prisma model fields, persistence mutations, non-`src/**` environment variables, error-code branches, or migration constraints. Below is what I found walking the code myself, and whether the draft documents it regardless of the detector's blind spot.

### Detector-missed surfaces found documented in the draft

| Surface | Documented? | Draft ID |
|---|---|---|
| GET /feed | Yes | API-001 |
| GET /post/:id | Yes | API-002 |
| POST /post | Yes | API-003 |
| PUT /publish/:id | Yes | API-004 |
| DELETE /post/:id | Yes | API-005 |
| POST /user | Yes | API-006 |
| User entity (persistent) | Yes | DM-001 |
| Post entity (persistent) | Yes | DM-002 |
| User.email (unique key, validated) | Yes | DM-001 |
| User.name (unvalidated passthrough) | Yes | DM-001 |
| Post.title / Post.content | Yes | DM-002 |
| Post.published (state field) | Yes | DM-002, SPEC.md State transitions |
| Post.id (numeric, positive-int contract) | Yes | DM-002 |
| Post→User author relation (by email) | Yes | DM-001, DM-002 |
| User.create mutation | Yes | DM-001 / API-006 / SPEC.md Persistence |
| Post.create mutation | Yes | DM-002 / API-003 / SPEC.md Persistence |
| Post.update (publish) mutation | Yes | DM-002 / API-004 / SPEC.md Persistence |
| Post.delete mutation | Yes | DM-002 / API-005 / SPEC.md Persistence |
| Post.findMany (feed read) | Yes | API-001 / SPEC.md Persistence |
| Post.findUnique (single read) | Yes | API-002 / SPEC.md Persistence |
| User.findUnique (author lookup) | Yes | API-003 / SPEC.md Persistence |
| HTTP network listener (`app.listen`) | Yes | SPEC.md CLM-006, DM-ENV-PORT |
| JSON body-parser middleware | Yes | SPEC.md CLM-048 |
| PostgreSQL external integration | Yes | ARCHITECTURE.md CLM-078 |
| AWS ECR external integration (deploy) | Yes | ARCHITECTURE.md CLM-080 |
| Prisma error P2025 (not-found → 404) | Yes | API-004, API-005, SPEC.md CLM-028/029 |
| Prisma error P2002 (duplicate → 409) | Yes | API-006, DM-001, SPEC.md CLM-032 |
| Shared `parsePostId` ID-format validator | Yes | BR-008 |
| Email `@`-contains validation | Yes | BR-006 |
| Required-field validation (post) | Yes | BR-002 |
| Required-field validation (user) | Yes | BR-005 |
| Process entrypoint (`npm start` → `node dist/index.js`) | Yes | SPEC.md CLM-005 |

That is 31 detector-missed surfaces, all documented. The Writer clearly did not just transcribe the 5 detector hits — the routes, mutations, error codes, and business rules are covered independently.

### Detector-missed surfaces NOT documented by name (schema/compose/Dockerfile/migration facts)

The draft applies a consistent, disclosed policy: `.env.example`, `docker-compose.yml`, `Dockerfile`, `prisma/schema.prisma`, and the migration `.sql` file are **not treated as citable file types** for verified (`CLM-*`) claims, even though they are in-scope per the manifest. Facts grounded only in those files are pushed into `UV-*` (Unverified/Needs-review) entries instead. This is disclosed in SPEC.md (UV-001, UV-002, UV-003), ARCHITECTURE.md ("Analysis limitations"), and RISKS.md (UV-004 through UV-007).

That policy produces a category-level disclosure but not an item-level one. Specifically:

| Surface | Category disclosed? | Individual name/value cited anywhere? |
|---|---|---|
| `POSTGRES_USER` (docker-compose.yml postgres service) | Yes, generically — UV-005 says "hardcoded development credentials" | No — the variable name is never written in any document |
| `POSTGRES_PASSWORD` (docker-compose.yml postgres service) | Yes, generically — UV-005 | No |
| `POSTGRES_DB` (docker-compose.yml postgres service) | Yes, generically — UV-005 | No |
| `DATABASE_URL` hardcoded value in docker-compose.yml app service (`postgresql://prisma:prisma@postgres:5432/prisma`) | Yes, generically — UV-005 ("hardcoded development credentials") | No — value not quoted |
| Port mappings `3000:3000`, `5432:5432` (docker-compose.yml) | Yes, generically — UV-005 ("port mappings") | No |
| Dockerfile: multi-stage build, non-root `appuser`, `EXPOSE 3000`, start command | Yes, generically — UV-004 | No |
| `User.id` autoincrement primary key (schema.prisma:11) | Yes — UV-001 | No |
| `User_email_key` unique index (migration.sql:22) | Yes, generically — UV-007 ("table definitions") | No |
| `Post_authorId_fkey` FK constraint, `ON DELETE RESTRICT ON UPDATE CASCADE` (migration.sql:25) | Yes, generically — UV-007 | No — the referential-action semantics (RESTRICT/CASCADE) are not named anywhere, including in RISKS.md or DATA_MODEL.md's "Lifecycle...cascade semantics are schema-level and not inferred here" line, which flags the *absence* of the fact but doesn't state what the constraint actually is |
| `Post_authorId_idx` index (migration.sql:28) | No — not mentioned even generically | No |
| `Post.published` schema-level default `false` (schema.prisma:21) | Yes — UV-001 | No |

None of these are "unexplained" in the strict Part A sense (that rubric only applies to the detector's 5 surfaces, all of which pass). But they are real specificity gaps: the reader is told "schema/compose/Dockerfile facts are unverified" as a category, yet is never told *which* named variables or constraints those categories actually contain, except for `User.id` and `Post.published` which UV-001 attributes by field name. `Post_authorId_idx` is not mentioned even at the category level — UV-007 says "table definitions" which could be read to cover it, but no document lists indexes specifically. This is a minor documentation-completeness observation for the Writer, not a gate failure.

## Real surface count vs. detector's 5

I counted, from source only (excluding the non-citable-file items listed above, which are policy-excluded from `CLM-*` citation and thus not commensurable with the detector's citation-line design):

- 6 HTTP routes (method+path)
- 2 persistent entities, each with 3-6 code-visible fields/relations
- 2 application-level environment variables (PORT, DATABASE_URL) — the only ones the detector's `environment:*` category and DATA_MODEL.md's search scope cover
- 7 persistence operations (4 writes, 3 reads)
- 1 network listener + 1 body-parser middleware registration
- 2 external integrations (PostgreSQL, AWS ECR)
- 2 distinct Prisma error-code branches (P2025, P2002)
- 8 business rules (BR-001..BR-008)
- 1 process entrypoint
- 3 registered-component surfaces (the shared Prisma client, postRouter, userRouter — these are exactly the detector's 3 `registered_api:*` hits)

That is roughly **35 code-derived documentable surfaces** I could independently verify against `src/**`, `package.json`, `tsconfig.json`, and README.md (the citable file set), versus the detector's flat count of **5**. The detector is a narrow line-pattern matcher (one router/client-export pattern, one `process.env.*` pattern) — it is not a proxy for total documentation surface area, and its 5-item denominator should not be read as "the whole system has 5 things to document." Adding the non-citable-file surfaces (docker-compose env vars, Dockerfile facts, migration constraints — at least 11 more distinct named facts, per the table above) pushes the total code+config surface count to roughly 46, of which the draft explicitly discloses the *category* for all but one (`Post_authorId_idx`) but names the specific fact for only 2 of the 11 (`User.id`, `Post.published`).

## Genuine documentation omissions found

1. **Individually unnamed docker-compose environment variables.** `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` (docker-compose.yml, postgres service) are never named in any document, only gestured at collectively via RISKS.md UV-005's "hardcoded development credentials" phrase. Given RISKS.md otherwise itemizes specific low-severity findings (e.g. RSK-005, RSK-006), the absence of a named entry for hardcoded Postgres credentials in a compose file that a real operator might copy toward production is a real gap, though a low-severity one consistent with the file's declared non-citable status.
2. **Migration referential-action semantics not named.** The `ON DELETE RESTRICT ON UPDATE CASCADE` behavior on `Post.authorId → User.id` is real, security/data-integrity-relevant behavior (it determines whether a User can be deleted while Posts reference it) that is not stated anywhere, even generically — DATA_MODEL.md DM-001's lifecycle note only says "no update or delete path exists in scope" for User via the API, which is a different claim from what the DB-level constraint would actually do if a User row were deleted through some other path.
3. **`Post_authorId_idx` index is not mentioned at all**, not even at the category level, unlike the unique index and FK which are covered by the generic UV-007 "table definitions" language.

None of these three rise to a Part A "unexplained omission" — Part A's rubric is scoped strictly to the detector's 5 surfaces, which are all fully covered at a matching typed heading with the exact `found_at` citation. These are Part B findings only, appropriate for a Writer follow-up pass rather than a gate rejection.
