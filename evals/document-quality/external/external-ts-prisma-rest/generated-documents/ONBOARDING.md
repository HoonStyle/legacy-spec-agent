# ONBOARDING — rest-express-docker-aws-ec2

Analyzed source commit: eb8f4328821c6746680a2ba02e0e5636a085a327
Generated at: 2026-07-30
Coverage: all in-scope files were read in full (src/**, prisma/**, package.json, tsconfig.json, .env.example, Dockerfile, docker-compose.yml, README.md); excluded by scope manifest: .github/**, prisma.config.ts, .dockerignore, .gitignore. No truncation occurred.

## Onboarding

### Prerequisites

- CLM-152: Docker and Docker Compose are required for the Docker path (`deployment-platforms/rest-express-docker-aws-ec2/README.md:7`).
- CLM-153: Node.js 20+ and a local PostgreSQL instance are required for the non-Docker path (`deployment-platforms/rest-express-docker-aws-ec2/README.md:8`).

### Getting the code

- CLM-154: Clone the prisma-examples repository and change into this example's directory (`deployment-platforms/rest-express-docker-aws-ec2/README.md:16`).

### Run with Docker Compose

- CLM-155: Copy the example environment file to .env (`deployment-platforms/rest-express-docker-aws-ec2/README.md:31`).
- CLM-156: The README states Docker Compose sets DATABASE_URL automatically, so no edits are needed on this path (`deployment-platforms/rest-express-docker-aws-ec2/README.md:28`).
- CLM-157: Start the app and a local Postgres database with the documented compose command (`deployment-platforms/rest-express-docker-aws-ec2/README.md:34-38`).
- CLM-158: The README states the server then runs on localhost port 3000 and migrations are applied automatically on startup (`deployment-platforms/rest-express-docker-aws-ec2/README.md:40`).
- The compose file itself is not citable in this workflow; its behavior is recorded as UV-005 in RISKS.md.

### Run with local Node.js and PostgreSQL

- CLM-159: Set DATABASE_URL in .env to a local postgresql connection string in the documented format (`deployment-platforms/rest-express-docker-aws-ec2/README.md:51`).
- CLM-160: Install dependencies with npm install (`deployment-platforms/rest-express-docker-aws-ec2/README.md:57`).
- CLM-161: Create the database schema with the documented prisma migrate command (`deployment-platforms/rest-express-docker-aws-ec2/README.md:58`).
- CLM-162: Start the development server with npm run dev (`deployment-platforms/rest-express-docker-aws-ec2/README.md:64`).

### Package scripts

- CLM-163: build — generates the Prisma client and compiles TypeScript (`deployment-platforms/rest-express-docker-aws-ec2/package.json:6`).
- CLM-164: typecheck — runs the TypeScript compiler without emitting (`deployment-platforms/rest-express-docker-aws-ec2/package.json:7`).
- CLM-165: dev — generates the Prisma client, typechecks, then runs the server from source (`deployment-platforms/rest-express-docker-aws-ec2/package.json:8`).
- CLM-166: start — runs the compiled server with Node (`deployment-platforms/rest-express-docker-aws-ec2/package.json:9`).

### Key dependencies

- CLM-167: express 5.1.0 is the HTTP framework (`deployment-platforms/rest-express-docker-aws-ec2/package.json:15`).
- CLM-168: prisma 7.5.0 is the ORM toolkit (`deployment-platforms/rest-express-docker-aws-ec2/package.json:17`).
- CLM-169: The Prisma pg adapter connects the client to PostgreSQL (`deployment-platforms/rest-express-docker-aws-ec2/package.json:12`).
- CLM-170: dotenv loads environment variables from a .env file (`deployment-platforms/rest-express-docker-aws-ec2/package.json:14`).
- CLM-171: tsx is the development-time TypeScript runner (`deployment-platforms/rest-express-docker-aws-ec2/package.json:23`).
- CLM-172: The project is MIT licensed (`deployment-platforms/rest-express-docker-aws-ec2/package.json:4`).

### TypeScript configuration

- CLM-173: Compilation targets ES2022 (`deployment-platforms/rest-express-docker-aws-ec2/tsconfig.json:3`).
- CLM-174: Modules are emitted as CommonJS (`deployment-platforms/rest-express-docker-aws-ec2/tsconfig.json:8`).
- CLM-175: Strict type checking is enabled (`deployment-platforms/rest-express-docker-aws-ec2/tsconfig.json:5`).
- CLM-176: Compiled output goes to the dist directory (`deployment-platforms/rest-express-docker-aws-ec2/tsconfig.json:4`).
- CLM-177: Only the src directory is compiled (`deployment-platforms/rest-express-docker-aws-ec2/tsconfig.json:14`).

### Smoke test and troubleshooting

- CLM-178: Verify the running server by creating a user with the documented curl command (`deployment-platforms/rest-express-docker-aws-ec2/README.md:76`).
- CLM-179: If startup fails immediately with "Missing DATABASE_URL environment variable", the required variable is absent from the environment or .env file (`deployment-platforms/rest-express-docker-aws-ec2/src/lib/prisma.ts:6`).
- Related: DM-ENV-DATABASE-URL, DM-ENV-PORT
- Test commands: **Not found** — no test runner or test script exists in scope; see TESTCASES.md.
