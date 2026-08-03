# Evidence audit notes — external-ts-prisma-rest

Actor: auditor-ext1 (Independent Evidence Auditor). Did not write the draft.

This file records **two rounds**. Round 1 rejected the draft over one
under-cited claim; round 2 re-checks the Writer's one-line correction
against a newly frozen digest. Round 1's findings are kept below verbatim
(not erased) so the history of the rejection remains visible.

---

## Round 1 — initial audit

Frozen draft digest: `71131fd74d1dce960bb5cbbf6c1f21f8e650138e536eefe1a8a1d4f5f1804188`

### Method

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

### Citations checked

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

### Result: 199 verified, 1 flagged

#### Flagged claim

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

### Borderline claims accepted (with reasoning)

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

### Other structural/scope observations (reported, not fixed)

- No claim rests only on a non-citable file type (`.prisma`, `.yml`,
  `.sql`, `Dockerfile`, `.env.example`) while being marked verified; all
  such facts are correctly routed to the Unverified sections (UV-001
  through UV-007) as the draft's own coverage notes claim.
- No cited range was absent from the source, out of bounds, or pointing at
  a non-existent file.
- No line carried a citation without a CLM id, two CLM ids, or two
  citations, and no CLM id was reused.

### Round 1 verdict

**failed** — one claim (CLM-034) is only partially supported by its cited
line range; the remaining 199 of 200 citations are genuinely supported by
their cited source text.

---

## Round 2 — re-check after correction

New frozen draft digest: `9d288ff7b5c6ba41d8e2cad91b959e9025b5cd9b48238c49881c656771c93d32`
(round 1's digest `71131fd74d1dce960bb5cbbf6c1f21f8e650138e536eefe1a8a1d4f5f1804188` is
now stale and superseded.)

### The correction

The Writer widened CLM-034's citation on SPEC.md line 70 from
`post.routes.ts:78-81` to `post.routes.ts:75-81`. The claim text itself is
unchanged:

> CLM-034: Post.published transitions to true when PUT /publish/:id
> succeeds; the guard is a valid positive-integer ID and the side effect is
> a durable update (`.../post.routes.ts:75-81`).

### Re-verification of CLM-034

Re-read `src/routes/post.routes.ts` lines 73-82 directly from the pinned
source clone:

```
73  // PUT /publish/:id — publish a post
74  postRouter.put('/publish/:id', async (req: Request, res: Response) => {
75    const postId = parsePostId(req.params.id, res)
76    if (postId === null) return
77    try {
78      const post = await prisma.post.update({
79        where: { id: postId },
80        data: { published: true },
81      })
82      res.json(post)
```

Judgment: the widened range **now genuinely supports both sub-clauses**.

- The guard sub-claim ("the guard is a valid positive-integer ID") is now
  inside the cited range: line 75 calls `parsePostId(req.params.id, res)`
  and line 76 returns early when it yields `null`, so the guard's presence
  and its gating effect on this handler are both visible in 75-81. The
  specific meaning of "positive-integer" (`Number.isInteger(postId) &&
  postId > 0`, source lines 7-13) is not re-derived inside 75-81 itself,
  but that parsing rule is not asserted fresh by CLM-034 — it is already
  independently established and cited by **BR-008 / CLM-023**
  (`post.routes.ts:8-13`, "Post IDs supplied in URLs must parse to a
  positive integer; anything else is rejected"), which round 1 verified
  clean. CLM-034 only needs to show that *this* handler invokes that
  already-proven guard before writing, and lines 75-76 show exactly that.
  This mirrors the accepted pattern already used by CLM-104/CLM-116/CLM-122
  in INTERFACES.md, which cite the guard's call-site lines for their own
  handlers and defer the parsing rule itself to BR-008.
- The durable-update sub-claim ("the side effect is a durable update") is
  unchanged from round 1 and remains supported by lines 78-81
  (`prisma.post.update` with `data: { published: true }`), which round 1
  already accepted.
- Nothing in the sentence is overstated: the claim says only that the
  guard exists and gates the request, and that the update is durable — both
  are literally what lines 75-81 show. No stronges/broader claim (e.g. about
  response codes or the 404-mapping path on lines 84-90, which is separately
  covered by CLM-028) is smuggled in.

**Verdict on CLM-034: supported.** Changed from `flagged` (round 1) to
`verified` (round 2).

### Drift check (script-based, not manual re-reading of all 200)

Ran a Python script (`drift_check.py`) that:

1. Re-extracted every `(document, CLM-id, citation)` triple from the
   current seven Markdown files with the same regex used in round 1.
2. Compared each extracted citation string against the corresponding
   `evidence` field in the round-1 `audit_log.jsonl` (200 rows).
3. Checked structural invariants: exactly one CLM id per citation line, no
   CLM id appearing on more than one line, no CLM id missing from either
   side, and that each claim's `document` field still matches the file it
   was found in.

Results:

- **200/200** CLM ids present in both round-1 audit log and the current
  drafts; no additions, no removals.
- **Exactly one** citation differs from round 1: **CLM-034**, changed from
  `post.routes.ts:78-81` to `post.routes.ts:75-81`, in `SPEC.md`. All other
  **199** rows have byte-identical citation strings to round 1.
- No `document` field mismatches (every CLM id still lives in the same
  file as in round 1).
- No line carries more than one `CLM-###` mention, and no CLM id has a
  citation on more than one line (checked across all 7 files).

Ran a second script (`resolve_check.py`) that re-resolved **all 200**
current citations (not just CLM-034) against the pinned source clone at
`/home/user/legacy-spec-agent/.external-sources/prisma-examples`: parsed
each `path:line` / `path:start-end`, confirmed the file exists under the
clone root, and confirmed the line/range falls within the file's actual
line count. **0 of 200** citations failed to resolve.

Conclusion: the draft's only change since round 1 is exactly the one
authorized correction to CLM-034's citation range. No other claim, wording,
citation, or document assignment drifted.

### Output rewrite

- `staging/audit_log.jsonl` was fully rewritten (all 200 rows, ascending
  CLM order) from the current draft's citations. All 200 rows use action
  `verified`, including CLM-034, whose `evidence` now reads
  `deployment-platforms/rest-express-docker-aws-ec2/src/routes/post.routes.ts:75-81`.
  No row was rubber-stamped without a direct re-check: CLM-034 was
  re-read against source (above) and the other 199 were confirmed
  unchanged byte-for-byte from a round that already verified them against
  source line by line.

### Round 2 verdict

**passed** — 200 verified, 0 flagged. CLM-034's correction holds up under
direct re-reading of the source, and the drift check confirms it is the
only change in the draft since the round-1 audit.
