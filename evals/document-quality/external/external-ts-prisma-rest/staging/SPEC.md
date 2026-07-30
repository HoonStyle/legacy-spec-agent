# SPEC — rest-express-docker-aws-ec2

Analyzed source commit: eb8f4328821c6746680a2ba02e0e5636a085a327
Generated at: 2026-07-30
Coverage: all in-scope files were read in full (src/**, prisma/**, package.json, tsconfig.json, .env.example, Dockerfile, docker-compose.yml, README.md); excluded by scope manifest: .github/**, prisma.config.ts, .dockerignore, .gitignore. No truncation occurred.

## System purpose and boundary

The system is a small REST API for users and posts, packaged for containerized deployment.

- CLM-001: The README titles the project "REST API with Express, Docker & AWS EC2" (`deployment-platforms/rest-express-docker-aws-ec2/README.md:1`).
- CLM-002: The package manifest names the service rest-express-docker-aws-ec2 (`deployment-platforms/rest-express-docker-aws-ec2/package.json:2`).
- CLM-003: Inside the boundary: a single Express application constructed at startup (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:6`).
- CLM-004: Outside the boundary: a PostgreSQL database reached through a pg adapter pool built from a connection string (`deployment-platforms/rest-express-docker-aws-ec2/src/lib/prisma.ts:9`).
- The GitHub Actions deployment workflow and prisma.config.ts are excluded from this analysis by the scope manifest.

## Actors and entrypoints

- Human/system actor: external HTTP clients; no other actor is defined in code.
- CLM-005: Process entrypoint: the start script runs the compiled server with Node (`deployment-platforms/rest-express-docker-aws-ec2/package.json:9`).
- CLM-006: The server listens on PORT (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:13`).
- CLM-007: The post router is mounted on the application root (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:9`).
- CLM-008: The user router is mounted on the application root (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:10`).
- CLM-009: The README demonstrates clients driving the API with curl (`deployment-platforms/rest-express-docker-aws-ec2/README.md:76`).
- Six HTTP routes form the entry surface. Related: API-001, API-002, API-003, API-004, API-005, API-006

## Core use cases

- CLM-010: Create a user account with an email address (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:8`).
- CLM-011: Author a new post (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:48`).
- CLM-012: Publish a previously created post (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:74`).
- CLM-013: Read the feed of published posts (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:17`).
- CLM-014: Read a single post by numeric ID (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:30`).
- CLM-015: Delete a post by numeric ID (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:96`).

## Business rules

- **BR-001** — CLM-016: The feed returns only posts whose published flag is true (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:20`).
  - Related: API-001, DM-002
- **BR-002** — CLM-017: Creating a post requires both title and authorEmail; a missing value is rejected (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:50`).
  - Related: API-003, DM-002
- **BR-003** — CLM-018: A post's author must be an existing user located by email; an unknown authorEmail is rejected with 404 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:55-58`).
  - Related: API-003, DM-001
- **BR-004** — CLM-019: Publishing sets the post's published flag to true (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:80`).
  - Related: API-004, DM-002
- **BR-005** — CLM-020: Creating a user requires an email value (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:10-12`).
  - Related: API-006, DM-001
- **BR-006** — CLM-021: A user email must be a string containing the @ character (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:14-17`).
  - Related: API-006, DM-001
- **BR-007** — CLM-022: A duplicate email is rejected as a conflict when the database raises Prisma error P2002 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:24-29`).
  - Related: API-006, DM-001
- **BR-008** — CLM-023: Post IDs supplied in URLs must parse to a positive integer; anything else is rejected (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:8-13`).
  - Related: API-002, API-004, API-005

## Validation and error behavior

- CLM-024: Invalid post ID returns 400 with an "Invalid post ID" message (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:10`).
- CLM-025: Missing title or authorEmail returns 400 with "title and authorEmail are required" (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:51`).
- CLM-026: A missing post on read returns 404 with a "not found" message (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:38`).
- CLM-027: An unknown author email on post creation returns 404 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:57`).
- CLM-028: Publishing a nonexistent post maps Prisma error P2025 to 404 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:84-90`).
- CLM-029: Deleting a nonexistent post maps Prisma error P2025 to 404 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:105-111`).
- CLM-030: A missing user email returns 400 with "email is required" (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:11`).
- CLM-031: A non-string or @-less email returns 400 with "email must be a valid email address" (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:15`).
- CLM-032: A duplicate email returns 409 with an "already in use" message (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:28`).
- CLM-033: All other handler failures return a generic 500 "Internal server error" body (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:25`).

## State transitions

- CLM-034: Post.published transitions to true when PUT /publish/:id succeeds; the guard is a valid positive-integer ID and the side effect is a durable update (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:78-81`).
- CLM-035: Post creation passes only title, content, and the author connection, so the handler itself never sets published (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:60-66`).
- The initial default value of the published flag is defined at the schema level, which is not citable here; see UV-001.
- No other code-defined state transitions were found (searched src/** for state or status fields and transition logic). **Not found.**

## Configuration

- CLM-036: PORT is read from the environment and defaults to 3000 (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:12`).
- CLM-037: DATABASE_URL is required; when it is absent the module throws at load time (`deployment-platforms/rest-express-docker-aws-ec2/src/lib/prisma.ts:5-7`).
- CLM-038: Environment variables are loaded from a dotenv file at process start (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:1`).
- CLM-039: The README instructs copying the example environment file to .env before running (`deployment-platforms/rest-express-docker-aws-ec2/README.md:31`).
- Related: DM-ENV-PORT, DM-ENV-DATABASE-URL

## Persistence and side effects

- CLM-040: Persistence goes through the shared exported Prisma client configured with a pg adapter (`deployment-platforms/rest-express-docker-aws-ec2/src/lib/prisma.ts:10`).
- CLM-041: Durable write: user row creation (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:19`).
- CLM-042: Durable write: post row creation (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:60`).
- CLM-043: Durable write: post update on publish (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:78`).
- CLM-044: Durable write: post deletion (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:100`).
- CLM-045: Read: the feed queries many posts (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:19`).
- CLM-046: Read: a single post is fetched by ID (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:34`).
- CLM-047: Read: a user is fetched by email during post creation (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:55`).
- No file writes, message queues, spawned processes, or scheduled jobs were found in src/**. **Not found.**

## Operational behavior

- CLM-048: Startup registers a JSON body parser before the routers (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:8`).
- CLM-049: Startup logs a single "Server ready" line with the bound port (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:14`).
- CLM-050: The process fails fast at module load when DATABASE_URL is missing (`deployment-platforms/rest-express-docker-aws-ec2/src/lib/prisma.ts:6`).
- CLM-051: The dev script regenerates the Prisma client, typechecks, then runs the server from source (`deployment-platforms/rest-express-docker-aws-ec2/package.json:8`).
- CLM-052: The build script generates the Prisma client and compiles with the TypeScript compiler (`deployment-platforms/rest-express-docker-aws-ec2/package.json:6`).
- No retry, timeout, graceful-shutdown, or health-check logic was found in src/**. **Not found.**

## Known limitations

- CLM-053: No authentication or authorization exists; the only registered middleware is the JSON body parser followed by the two routers (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:8-10`).
- CLM-054: Handler catch blocks discard the caught error, so failure causes are not logged anywhere (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:24`).
- CLM-055: The feed query has no pagination or result limit (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:19-22`).

## Unverified / Needs-review

- **UV-001** — Schema-level data-model constraints (User and Post field types, autoincrement primary keys, the unique email constraint, and the published default of false) are defined in prisma/schema.prisma, a file type that is not citable in this workflow, so they are recorded as unverified rather than promoted to verified claims. Searched: prisma directory.
- **UV-002** — The example environment file appears to contain a placeholder DATABASE_URL value, but its file type is not citable, so its exact content is unverified. Searched: repository root.
- **UV-003** — The container start command defined in the Dockerfile and compose file references dist/src/index.js while the package start script references dist/index.js; because Dockerfile and compose files are not citable, this apparent output-path mismatch is recorded as needs-review. Searched: repository root build and deployment files.
