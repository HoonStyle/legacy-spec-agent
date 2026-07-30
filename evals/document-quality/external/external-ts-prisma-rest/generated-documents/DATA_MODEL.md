# DATA_MODEL — rest-express-docker-aws-ec2

Analyzed source commit: eb8f4328821c6746680a2ba02e0e5636a085a327
Generated at: 2026-07-30
Coverage: all in-scope files were read in full (src/**, prisma/**, package.json, tsconfig.json, .env.example, Dockerfile, docker-compose.yml, README.md); excluded by scope manifest: .github/**, prisma.config.ts, .dockerignore, .gitignore. No truncation occurred.

## Data model

### Persistent entities

Schema-level definitions (types, keys, uniqueness, defaults) live in a non-citable file type and are held under UV-001 in SPEC.md; the fields below are grounded in how the TypeScript code reads and writes each entity.

#### DM-001

User — persistent entity.

- CLM-135: Fields written at creation: email and name (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:20`).
- CLM-136: Of the two body fields, only email is validated — it must be present and be a string containing the @ character — while name passes through without validation (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:9-17`).
- CLM-137: The code treats Prisma error P2002 on creation as "email already in use", i.e. email behaves as a uniqueness key (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/user.routes.ts:24-29`).
- CLM-138: Users are looked up by email as a unique query key during post creation (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:55`).
- CLM-139: Users appear as the embedded author of posts in the feed (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:21`).
- Lifecycle: created via API-006; no update or delete path exists in scope. Primary-key and cascade semantics are schema-level and not inferred here.
- Related: API-006, BR-005, BR-006, BR-007, DM-002

#### DM-002

Post — persistent entity.

- CLM-140: Fields written at creation: title and content, taken from the request body (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:49`).
- CLM-141: Required-field validation covers title and authorEmail only, so content may be omitted (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:50`).
- CLM-142: published is a boolean field used as the feed visibility filter (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:20`).
- CLM-143: published is set to true by the publish route (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:80`).
- CLM-144: id is numeric in the route contract and must be a positive integer (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:8-13`).
- CLM-145: Relation: each post is connected to one author user, keyed by email at creation time (`deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:64`).
- Lifecycle: created via API-003, published via API-004, deleted via API-005. Cardinality and cascade behavior are schema-level and not inferred here.
- Related: API-001, API-003, API-004, API-005, BR-001, BR-004, DM-001

### Configuration and interface contracts

#### DM-ENV-PORT

Environment variable PORT — optional server port.

- CLM-146: Read from the environment with a default of 3000 (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:12`).
- CLM-147: Consumed by the HTTP listener at startup (`deployment-platforms/rest-express-docker-aws-ec2/src/index.ts:13`).
- Type: string when supplied by the environment, number when defaulted; no numeric validation is performed.
- Related: RSK-006

#### DM-ENV-DATABASE-URL

Environment variable DATABASE_URL — required database connection string.

- CLM-148: Read from the environment at module load (`deployment-platforms/rest-express-docker-aws-ec2/src/lib/prisma.ts:4`).
- CLM-149: Required: a missing value throws "Missing DATABASE_URL environment variable" (`deployment-platforms/rest-express-docker-aws-ec2/src/lib/prisma.ts:6`).
- CLM-150: Passed to the pg adapter as the connection string (`deployment-platforms/rest-express-docker-aws-ec2/src/lib/prisma.ts:9`).
- CLM-151: The README documents the expected postgresql URL format (`deployment-platforms/rest-express-docker-aws-ec2/README.md:51`).
- Related: API-PRISMA

### Search scope notes

- No other environment variables are read in src/** (searched for process.env usages). **Not found.**
- No other persistent entities are referenced by in-scope TypeScript code. **Not found** (searched src/** for Prisma model accesses).
