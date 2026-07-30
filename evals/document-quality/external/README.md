# External document-quality evaluations

This directory is reserved for pinned, human-reviewed external cases. External results must remain separate from the repository-owned synthetic baseline.

## First case

The next case is `external-ts-prisma-rest`, using `prisma/prisma-examples` at candidate revision `eb8f4328821c6746680a2ba02e0e5636a085a327` and the scoped project `deployment-platforms/rest-express-docker-aws-ec2`.

Do not create extractor output, generated documents, or a completion record until:

1. `case-manifest.json` records the revalidated repository and selected-package licenses, immutable revision, exact scope, and execution environment;
2. a source-only gold draft has been independently reviewed by a person;
3. `gold-review-notes.md` records searched-but-absent conceptual categories; and
4. the approved positive annotations have been frozen in `gold-surfaces.jsonl` with a SHA-256 digest.

An agent-authored draft may be preserved outside the repository for review, but `human_review_pending` is a blocker rather than an acceptable external-quality limitation. The corrected artifact and execution contracts are in `EXTERNAL_EVALUATION_PLAN.md`.
