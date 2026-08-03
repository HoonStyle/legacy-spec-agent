# Gold review notes — EXT1 (prisma-examples / deployment-platforms/rest-express-docker-aws-ec2)

Author: independent gold-annotation pass, 2026-07-30. Source read directly; no detector, connector, or MCP tool output was consulted.

## Human review decision (2026-07-30)

The repository owner reviewed the 44-row draft and approved it with one change: the npm-script entrypoint rows EXT1-021 (`package.json:9`, `start`) and EXT1-022 (`package.json:8`, `dev`) are removed, keeping the stricter entrypoint reading (server bootstrap, Dockerfile CMD, compose command). All other rows, category decisions, and judgment calls below were approved as drafted. IDs are kept stable, so the frozen file contains 42 rows EXT1-001..EXT1-044 with EXT1-021/022 intentionally absent. Entrypoint rows remaining: EXT1-018/019/020.

## Files read (all in-scope files were readable)

- deployment-platforms/rest-express-docker-aws-ec2/src/index.ts (15 lines)
- deployment-platforms/rest-express-docker-aws-ec2/src/lib/prisma.ts (10 lines)
- deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts (114 lines)
- deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts (33 lines)
- deployment-platforms/rest-express-docker-aws-ec2/prisma/schema.prisma (24 lines)
- deployment-platforms/rest-express-docker-aws-ec2/prisma/migrations/20240101000000_init/migration.sql (28 lines)
- deployment-platforms/rest-express-docker-aws-ec2/prisma/migrations/migration_lock.toml (3 lines)
- deployment-platforms/rest-express-docker-aws-ec2/package.json (26 lines)
- deployment-platforms/rest-express-docker-aws-ec2/tsconfig.json (15 lines)
- deployment-platforms/rest-express-docker-aws-ec2/.env.example (1 line)
- deployment-platforms/rest-express-docker-aws-ec2/Dockerfile (35 lines)
- deployment-platforms/rest-express-docker-aws-ec2/docker-compose.yml (27 lines)
- deployment-platforms/rest-express-docker-aws-ec2/README.md (documentation only; no code surfaces annotated from it)

No file in scope was unreadable. Out-of-scope files present but deliberately NOT read for annotation content: `.github/workflows/deploy.yml`, `prisma.config.ts`, `.dockerignore`, `.gitignore` (excluded by the scope manifest; they only appear in the directory listing).

## Absent categories

### test_file — ABSENT
Searched: full recursive listing of the example directory; every in-scope file read end to end. Patterns looked for: `*test*`, `*spec*`, `__tests__`, `*.test.ts`, `*.spec.ts`, any `test`/`jest`/`vitest`/`mocha`/`node --test` script in `package.json` (scripts are only `build`, `typecheck`, `dev`, `start`). Judgment: the project contains no tests of any kind. A correct generated document must report this category as **Not found** with the search scope, not omit it silently.

All other eight categories have at least one instance; none besides test_file is absent.

## Category counts (44 rows total)

| category | rows | ids |
|---|---|---|
| registered_api | 6 | EXT1-001..006 |
| data_contract | 4 | EXT1-007..010 |
| environment | 7 | EXT1-011..017 |
| entrypoint | 5 | EXT1-018..022 |
| status_value | 1 | EXT1-023 |
| test_file | 0 | — |
| external_side_effect | 6 | EXT1-024..029 |
| external_integration | 6 | EXT1-030..035 |
| business_rule | 9 | EXT1-036..044 |

## Judgment calls for human review

1. **Request-body contracts named by their destructuring pattern (EXT1-009, EXT1-010).** The request bodies of `POST /post` and `POST /user` have no named TS type/interface in source; I used the literal destructured shape (`{ title, authorEmail, content }`, `{ email, name }`) as the identifier, cited at the `req.body` destructuring lines (post.routes.ts:49, user.routes.ts:9). A reviewer may prefer route-based names or may drop these rows as already covered by the API rows. There are no other TS types/interfaces defined in scope (only imports from generated Prisma client and express).

2. **DATABASE_URL annotated at three locations (EXT1-011/012/013).** The coverage requirement says environment variables must be caught in code AND `.env.example` AND docker-compose, so the same variable appears once per location (src/lib/prisma.ts:4 where it is read and its absence throws; .env.example:1; docker-compose.yml:7). All three are marked critical because the variable is required with no default. If the scorer matches on (category|surface) only, these collapse to one; the three rows are intentional per-location evidence, not duplicates (tuples differ by found_at).

3. **npm scripts `start` and `dev` counted as entrypoints (EXT1-021, EXT1-022).** Both launch the server (package.json:9 `node dist/index.js`, package.json:8 `tsx src/index.ts`). A stricter reading of "entrypoint = server bootstrap + Docker CMD" would drop them. Note for reviewers: the `start` script runs `node dist/index.js` while the Dockerfile CMD and compose command run `node dist/src/index.js` — a real path inconsistency in the source worth flagging in generated docs, but not itself a gold surface. All entrypoints were marked `normal` because the importance rules reserve `critical` for HTTP routes, security boundaries, destructive effects, and required config; a reviewer could argue the production entrypoints are critical.

4. **`published` is the only status value; HTTP status codes and Prisma error codes excluded (EXT1-023).** The codebase's only domain state is the boolean `Post.published` flag (annotated at its schema definition, schema.prisma:21, where `@default(false)` also grounds business rule EXT1-040 — same line, two categories, intentional). I judged HTTP response codes (200/201/400/404/409/500) and Prisma error codes (`P2002` at user.routes.ts:26, `P2025` at post.routes.ts:86/106) to be protocol/error-handling details, not domain status values, so they are captured indirectly via the API and business-rule rows. A reviewer wanting error-code coverage could add status_value rows for `P2002`/`P2025`.

5. **`prisma migrate deploy` in the compose command annotated as a critical side effect (EXT1-029).** It mutates database schema automatically on every container start (docker-compose.yml:12), which I judged destructive-capable, hence critical. Similarly, `app.listen` (EXT1-024) is marked critical as the public network exposure point even though the rules only list HTTP routes explicitly. Prisma reads (`findMany` post.routes.ts:19, `findUnique` post.routes.ts:34 and 55) were NOT annotated: the coverage contract asks for create/update/delete and network listeners; reads are non-mutating.

6. **DB-level ON DELETE RESTRICT as a business rule (EXT1-044).** migration.sql:25 enforces that a User row referenced by Posts cannot be deleted. No application endpoint deletes users, so this rule is enforced only at the database layer; a reviewer might reclassify it as a data-contract detail. It is genuinely present in source, not invented.

7. **Migration SQL tables not double-annotated as data contracts.** `CREATE TABLE "User"` (migration.sql:2) and `CREATE TABLE "Post"` (migration.sql:11) restate the Prisma models EXT1-007/008; I annotated the models once at their schema.prisma definitions to keep one conceptual surface per contract. Exported symbols `postRouter`, `userRouter`, `prisma` were likewise not annotated as registered_api: the service's registered API is the HTTP surface, and the routers are internal wiring already represented by the six route rows.

8. **Integration citation lines.** Each external integration is cited at its most load-bearing use, not its package.json dependency line: Express at the import (src/index.ts:2), Prisma ORM at client construction (src/lib/prisma.ts:10), PostgreSQL at the datasource provider (schema.prisma:7), @prisma/adapter-pg at pool construction (src/lib/prisma.ts:9), dotenv at the side-effect import (src/index.ts:1), Docker at the base image (Dockerfile:2). Docker Compose was folded into the Docker integration rather than given a separate row; the `pg` driver is folded into @prisma/adapter-pg. Reviewers may prefer separate rows or package.json citations.
