# INTERFACES — rest-express-docker-aws-ec2

Analyzed source commit: eb8f4328821c6746680a2ba02e0e5636a085a327
Generated at: 2026-07-30
Coverage: all in-scope files were read in full (src/**, prisma/**, package.json, tsconfig.json, .env.example, Dockerfile, docker-compose.yml, README.md); excluded by scope manifest: .github/**, prisma.config.ts, .dockerignore, .gitignore. No truncation occurred.

## Interfaces

Common notes for every HTTP interface below:

- CLM-089: Callers are external HTTP clients, as demonstrated by the README curl examples (`deployment-platforms/rest-express-docker-aws-ec2/README.md:76`).
- CLM-090: Protocol is HTTP with JSON request bodies parsed by a global middleware (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:8`).
- Timeout/cancellation behavior: **Not found** for every route (searched src/** for timeout, abort, and cancellation handling).
- Idempotency handling: **Not found** for every route (searched src/** for idempotency keys or deduplication).

#### API-PRISMA

In-process data-access interface, not an HTTP route.

- CLM-091: The shared Prisma client instance is exported for use by the routers (`deployment-platforms/rest-express-docker-aws-ec2/src/lib/prisma.ts:10`).
- CLM-092: Caller: the post router imports it (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:3`).
- CLM-093: Caller: the user router imports it (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:3`).
- Request/response schema: the generated client's API surface is not present in the analyzed tree; see UV-001 and the analysis limitations in ARCHITECTURE.md.
- Related: DM-ENV-DATABASE-URL

#### API-POSTROUTER

Express router aggregating the post-related routes.

- CLM-094: The router object is created and exported here (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:5`).
- CLM-095: It is mounted on the application root without a path prefix (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:9`).
- Related: API-001, API-002, API-003, API-004, API-005

#### API-USERROUTER

Express router aggregating the user-related routes.

- CLM-096: The router object is created and exported here (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:5`).
- CLM-097: It is mounted on the application root without a path prefix (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:10`).
- Related: API-006

#### API-001

GET /feed — list published posts.

- CLM-098: Signature: GET handler registered on the /feed path (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:17`).
- Request: no parameters or body are read by the handler.
- CLM-099: Response 200: JSON array of posts filtered to published only (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:20`).
- CLM-100: Each returned post embeds its author record (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:21`).
- CLM-101: The result set is returned as JSON (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:23`).
- CLM-102: Error 500: generic internal-server-error body on any failure (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:25`).
- Side effects: database read only. Validation: none defined.
- Related: BR-001, DM-002

#### API-002

GET /post/:id — fetch one post.

- CLM-103: Signature: GET handler registered on the /post/:id path (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:30`).
- CLM-104: Validation: the id parameter is checked by the shared ID parser and the handler returns early on failure (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:31-32`). See BR-008 for the parsing rule.
- CLM-105: Error 404: returned when no post has the requested ID (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:38`).
- CLM-106: Response 200: the post as JSON (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:41`).
- CLM-107: Error 500: generic internal-server-error body on any other failure (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:43`).
- Side effects: database read only.
- Related: BR-008, DM-002

#### API-003

POST /post — create a post.

- CLM-108: Signature: POST handler registered on the /post path (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:48`).
- CLM-109: Request body: title, authorEmail, and content are read from the JSON body (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:49`).
- CLM-110: Error 400: missing title or authorEmail (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:51`).
- CLM-111: Error 404: no user exists for the given authorEmail (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:57`).
- CLM-112: Side effect: one post row is created and connected to the author by email (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:60-66`).
- CLM-113: Response 201: the created post as JSON (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:67`).
- CLM-114: Error 500: generic internal-server-error body on any other failure (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:69`).
- Related: BR-002, BR-003, DM-002

#### API-004

PUT /publish/:id — publish a post.

- CLM-115: Signature: PUT handler registered on the /publish/:id path (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:74`).
- CLM-116: Validation: the id parameter is checked by the shared ID parser and the handler returns early on failure (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:75-76`). See BR-008 for the parsing rule.
- CLM-117: Side effect: the post's published flag is set to true (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:78-81`).
- CLM-118: Response 200: the updated post as JSON (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:82`).
- CLM-119: Error 404: Prisma error P2025 (record not found) is mapped to 404 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:86-89`).
- CLM-120: Error 500: generic internal-server-error body on any other failure (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:91`).
- Related: BR-004, BR-008, DM-002

#### API-005

DELETE /post/:id — delete a post.

- CLM-121: Signature: DELETE handler registered on the /post/:id path (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:96`).
- CLM-122: Validation: the id parameter is checked by the shared ID parser and the handler returns early on failure (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:97-98`). See BR-008 for the parsing rule.
- CLM-123: Side effect: the post row is deleted (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:100-102`).
- CLM-124: Response 200: the deleted post is returned as JSON (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:103`).
- CLM-125: Error 404: Prisma error P2025 (record not found) is mapped to 404 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:107-110`).
- CLM-126: Error 500: generic internal-server-error body on any other failure (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:112`).
- Related: BR-008, DM-002

#### API-006

POST /user — create a user.

- CLM-127: Signature: POST handler registered on the /user path (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:8`).
- CLM-128: Request body: email and name are read from the JSON body (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:9`).
- CLM-129: Error 400: missing email (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:11`).
- CLM-130: Error 400: email is not a string containing the @ character (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:15`).
- CLM-131: Side effect: one user row is created with email and name (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:19-21`).
- CLM-132: Response 201: the created user as JSON (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:22`).
- CLM-133: Error 409: duplicate email mapped from Prisma error P2002 (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:28`).
- CLM-134: Error 500: generic internal-server-error body on any other failure (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:31`).
- Related: BR-005, BR-006, BR-007, DM-001

### Unverified external contracts

- External deployment contracts (AWS ECR, AWS EC2, and the GitHub Actions workflow) are not defined by in-scope code; they are recorded as unverified gaps UV-005 and UV-006 in RISKS.md.
- The generated Prisma client contract is absent from the analyzed tree and the schema file type is not citable; see UV-001 in SPEC.md.
