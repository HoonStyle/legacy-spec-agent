# TESTCASES — rest-express-docker-aws-ec2

Analyzed source commit: eb8f4328821c6746680a2ba02e0e5636a085a327
Generated at: 2026-07-30
Coverage: all in-scope files were read in full (src/**, prisma/**, package.json, tsconfig.json, .env.example, Dockerfile, docker-compose.yml, README.md); excluded by scope manifest: .github/**, prisma.config.ts, .dockerignore, .gitignore. No truncation occurred.

## Existing automated tests

**Not found.** Searched patterns: `*test*`, `*spec*`, `__tests__` directories, and the package.json scripts block; no test files, test directories, or test runner configuration exist anywhere in scope.

- CLM-180: The manifest scripts define only build, typecheck, dev, and start — there is no test script (`deployment-platforms/rest-express-docker-aws-ec2/package.json:5-10`).

## Source-derived characterization scenarios

None of the scenarios below currently executes; each is derived from source behavior. Execution command: **Not found** for all (no test runner exists in scope). Required environment for all: a reachable PostgreSQL database via DM-ENV-DATABASE-URL.

- **TC-001** — CLM-181: Creating a user with a new valid email returns 201 with the created user JSON (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:22`).
  - Given a running server; When POST /user is sent with a JSON body containing an unused email; Then the response is 201 and one user row is created.
  - Related: API-006, BR-005
- **TC-002** — CLM-182: Creating a user without an email returns 400 "email is required" (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:11`).
  - Given a running server; When POST /user is sent with no email field; Then the response is 400 and no row is created.
  - Related: API-006, BR-005
- **TC-003** — CLM-183: Creating a user with a non-string or @-less email returns 400 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:15`).
  - Given a running server; When POST /user is sent with email "nope"; Then the response is 400 and no row is created.
  - Related: API-006, BR-006
- **TC-004** — CLM-184: Creating a user with an email already in use returns 409 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:28`).
  - Given an existing user; When POST /user is sent with the same email; Then the response is 409 and no second row is created.
  - Related: API-006, BR-007
- **TC-005** — CLM-185: Creating a post without title or authorEmail returns 400 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:51`).
  - Given a running server; When POST /post is sent missing title; Then the response is 400 and no row is created.
  - Related: API-003, BR-002
- **TC-006** — CLM-186: Creating a post for an unknown authorEmail returns 404 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:57`).
  - Given no user with the given email; When POST /post is sent; Then the response is 404 and no row is created.
  - Related: API-003, BR-003
- **TC-007** — CLM-187: Creating a post for an existing author returns 201 with the created post (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:67`).
  - Given an existing user; When POST /post is sent with title and that user's email; Then the response is 201 and one post row is created.
  - Related: API-003, DM-002
- **TC-008** — CLM-188: The feed returns only published posts (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:20`).
  - Given one published and one unpublished post; When GET /feed is called; Then only the published post appears, with its author embedded.
  - Related: API-001, BR-001
- **TC-009** — CLM-189: A non-integer or non-positive post ID returns 400 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:10`).
  - Given a running server; When GET /post/abc is called; Then the response is 400 with an invalid-ID message.
  - Related: API-002, BR-008
- **TC-010** — CLM-190: Fetching a nonexistent post ID returns 404 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:38`).
  - Given no post with ID 999; When GET /post/999 is called; Then the response is 404.
  - Related: API-002
- **TC-011** — CLM-191: Publishing a nonexistent post returns 404 via Prisma error P2025 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:84-90`).
  - Given no post with ID 999; When PUT /publish/999 is called; Then the response is 404 and nothing is updated.
  - Related: API-004, BR-004
- **TC-012** — CLM-192: Deleting a nonexistent post returns 404 via Prisma error P2025 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:105-111`).
  - Given no post with ID 999; When DELETE /post/999 is called; Then the response is 404 and nothing is deleted.
  - Related: API-005

## External-contract test candidates

These candidates depend on contracts outside the citable code scope; they are not verified tests and remain linked to unverified gaps.

- **TC-013** — CLM-193: Compose stack candidate: the README states the compose path starts the app with a database and applies migrations automatically, which could be characterized end to end (`deployment-platforms/rest-express-docker-aws-ec2/README.md:40`).
  - Given Docker; When the documented compose command runs; Then the server answers on port 3000 with the schema migrated. The compose file itself is not citable.
  - Related: UV-005
- **TC-014** — CLM-194: Deployment workflow candidate: the README states a push to main or latest triggers the EC2 deployment workflow, which could be exercised against a staging environment (`deployment-platforms/rest-express-docker-aws-ec2/README.md:170`).
  - Given AWS credentials and secrets configured; When a commit is pushed; Then a new container is running on EC2. The workflow file is out of scope.
  - Related: UV-006
