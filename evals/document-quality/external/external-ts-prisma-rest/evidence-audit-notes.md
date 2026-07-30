# Evidence audit notes — external-ts-prisma-rest

Actor: auditor-ext1 (Independent Evidence Auditor). Did not write the draft.
Frozen draft digest: `71131fd74d1dce960bb5cbbf6c1f21f8e650138e536eefe1a8a1d4f5f1804188`

## Method

1. Read the seven in-scope TypeScript/config/README source files in full from
   `/home/user/legacy-spec-agent/.external-sources/prisma-examples/deployment-platforms/rest-express-docker-aws-ec2/`:
   `src/index.ts`, `src/lib/prisma.ts`, `src/routes/post.routes.ts`,
   `src/routes/user.routes.ts`, `package.json`, `tsconfig.json`, `README.md`.
2. Wrote a Python script (`extract.py`) that scans all seven staging Markdown
   files (`SPEC.md`, `ARCHITECTURE.md`, `INTERFACES.md`, `DATA_MODEL.md`,
   `ONBOARDING.md`, `TESTCASES.md`, `RISKS.md`), extracts every backticked
   `path:line` / `path:start-end` span whose extension is one of
   `py ts js jsx tsx md json jsonl sh mjs cjs java cs go`, pairs it with the
   `CLM-###` id on the same line, and prints the claim line next to the
   actual text of the cited source line(s). Backticked `.prisma`, `.yml`,
   `.sql`, `Dockerfile`, and `.env.example` paths were correctly excluded as
   non-citations (none were found tagged with a CLM anyway — the draft
   consistently routes schema/Dockerfile/compose/SQL-grounded facts to the
   Unverified sections, as its own scope notes claim).
3. The script also checked for structural problems: a citation with no CLM
   id, a line with two CLM ids, two citations on one line, and any CLM id
   reused across lines.
4. I read the combined claim/evidence output for all 200 rows and judged
   each one against the actual source text and against the full files held
   in memory, watching specifically for overstatement, a wrong symbol, or a
   fact that is only true elsewhere in the file.
5. A second script (`gen_audit.py`) re-ran the same extraction and emitted
   `audit_log.jsonl` from my verdicts (default `verified`, with one
   `flagged` row).

## Citations checked

- Total CLM citations in the draft: **200** (SPEC.md 55, ARCHITECTURE.md 33,
  INTERFACES.md 46, DATA_MODEL.md 17, ONBOARDING.md 28, TESTCASES.md 15,
  RISKS.md 6).
- Structural check: **no** citation lacked a CLM id, **no** line carried two
  CLM ids or two citations, and **no** CLM id was reused. Every cited
  `path:line`/`path:start-end` range resolved to real lines inside the
  seven in-scope files — no out-of-bounds range and no missing source file.
- Independently confirmed `prisma/generated/client` is genuinely absent
  from the analyzed tree (only `prisma/schema.prisma` and
  `prisma/migrations/` exist), which supports CLM-088's claim that the
  generated client's API surface could not be inspected.
- Confirmed the negative/"Not found" statements in SPEC.md, INTERFACES.md,
  DATA_MODEL.md, and ONBOARDING.md (no state fields besides `published`, no
  other `process.env` reads, no other Prisma model accesses, no
  retry/timeout/health-check logic, no test runner) by re-scanning the four
  in-scope TypeScript files myself — all four files were short enough to
  verify exhaustively and I found no counter-example.

## Result: 199 verified, 1 flagged

### Flagged claim

- **CLM-034** (SPEC.md, "State transitions"): "Post.published transitions
  to true when PUT /publish/:id succeeds; **the guard is a valid
  positive-integer ID** and the side effect is a durable update." Cited
  evidence: `src/routes/post.routes.ts:78-81`, which is only
  ```
  const post = await prisma.post.update({
    where: { id: postId },
    data: { published: true },
  })
  ```
  This range shows the durable update (supports the main clause and the
  "side effect" clause) but says nothing about ID validation — it merely
  consumes an already-computed `postId` variable. The "guard is a valid
  positive-integer ID" sub-claim is only true because of
  `parsePostId(req.params.id, res)` and the `if (postId === null) return`
  guard on lines 75-76 of the same handler — lines that are outside the
  cited range and not cited anywhere on this line. Contrast this with the
  sibling claims CLM-104/CLM-116/CLM-122 in INTERFACES.md, which describe
  the identical guard pattern for the other ID-based routes and correctly
  cite the guard's own lines (e.g. `75-76`) while deferring the parsing
  *rule* itself to BR-008 ("See BR-008 for the parsing rule."). CLM-034
  instead asserts the guard's existence as fact under a citation that does
  not contain it. This is a fact that is true only elsewhere in the file,
  not a style issue, so it fails independent verification as written.

## Borderline claims accepted (with reasoning)

- **CLM-080** (ARCHITECTURE.md): "The README documents AWS ECR as the
  image registry for deployment," cited to `README.md:119`, which is only
  the section header line `**ECR repository** — create one if you haven't
  already:`. The header alone is thin, but it unambiguously identifies ECR
  as the deployment registry in context (the surrounding lines, which I
  read in full, are `aws ecr create-repository ...`), and the claim does
  not overstate anything beyond "the README documents AWS ECR as the image
  registry." Accepted.
- **CLM-142** (DATA_MODEL.md): "published is a boolean field... " cited to
  `post.routes.ts:20` (`where: { published: true }`). The field's type is
  formally schema-level (`prisma/schema.prisma`, non-citable, held under
  UV-001), but comparing the field to the literal `true` under this
  project's `strict: true` TypeScript configuration is itself sound
  evidence that the generated Prisma type is boolean; this does not
  contradict the draft's own disclaimer that schema-level constraints are
  unverified, since the inference here is drawn from the TypeScript usage
  site, not the schema file. Accepted.
- **CLM-034**'s sibling durable-update/effect clauses ("Post.published
  transitions to true... side effect is a durable update") are themselves
  well supported by the same citation and are not part of the flag above;
  only the guard sub-claim is unsupported.
- Several claims in different documents cite the same source line under
  different CLM ids (e.g. CLM-051/CLM-062/CLM-165 all cite
  `package.json:8` for the `dev` script; CLM-006/CLM-146 both cite
  `src/index.ts:12`/`:13` for PORT). This is expected/acceptable
  duplication across SPEC/ARCHITECTURE/ONBOARDING/DATA_MODEL — each CLM id
  is still used exactly once, and each restates the same true fact in a
  document-appropriate way.

## Other structural/scope observations (reported, not fixed)

- No claim rests only on a non-citable file type (`.prisma`, `.yml`,
  `.sql`, `Dockerfile`, `.env.example`) while being marked verified; all
  such facts are correctly routed to the Unverified sections (UV-001
  through UV-007) as the draft's own coverage notes claim.
- No cited range was absent from the source, out of bounds, or pointing at
  a non-existent file.
- No line carried a citation without a CLM id, two CLM ids, or two
  citations, and no CLM id was reused.

## Verdict

**failed** — one claim (CLM-034) is only partially supported by its cited
line range; the remaining 199 of 200 citations are genuinely supported by
their cited source text.
