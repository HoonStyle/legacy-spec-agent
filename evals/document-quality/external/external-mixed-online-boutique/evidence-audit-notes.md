# Independent Evidence Audit Notes — external-mixed-online-boutique

- **Actor:** auditor-ext3 (Independent Evidence Auditor; did not write the draft)
- **Round 1 frozen draft digest:** `f358873e7ec8dcf8c115c7e7cc4f056a691dfbac2c6ac5998a6276e2659977c3` (135 claims, CLM-001..CLM-135) — **verdict: failed**, 10 of 135 flagged
- **Round 2 frozen draft digest:** `155ac67a50743a6fd3e8e0d1c5c231bc564442ba1efbe66c449a42cdd9d9f1f8` (146 claims, CLM-001..CLM-146) — **verdict: failed**, 1 of 146 flagged (CLM-131, new defect surfaced by full-line re-check)
- **Round 3 (this re-check) frozen draft digest:** `14d5e487b6cbfb680aeb7255c51b6316447cf4cd7e8f8012e166a6d153202d38` (146 claims, CLM-001..CLM-146) — **verdict: passed**, 0 of 146 flagged
- **Source of truth:** `/home/user/legacy-spec-agent/.external-sources/microservices-demo/` (cartservice C#, checkoutservice Go, shippingservice Go)

The draft was rejected twice before this round. That history is preserved in full below; nothing from round 1 or round 2 has been erased.

## Round 1 — method and result (preserved, not erased)

1. Read all in-scope hand-written source files once, in full (`Program.cs`, `Startup.cs`, `CartService.cs`, `HealthCheckService.cs`, `ICartStore.cs`, `RedisCartStore.cs`, `SpannerCartStore.cs`, `AlloyDBCartStore.cs`, `CartServiceTests.cs`; `main.go`, `money.go`, `money_test.go` for checkoutservice; `main.go`, `quote.go`, `tracker.go`, `shippingservice_test.go` for shippingservice), plus `appsettings.json` on demand.
2. Extracted every `(line, CLM id, citation, markdown line)` tuple from all seven staged Markdown files and resolved each citation against the pinned source tree.
3. Judged each of the 135 claims, watching especially for compound claims ("all three", "both X and Y") cited to a range that proves only one branch/instance.
4. Structural checks were clean: 135 unique CLM ids, no gaps/duplicates, one CLM + one citation per line, no citation into `genproto/` or other non-citable extensions, no out-of-range citation.

**Round 1 flagged claims (10):**

| CLM | Document | Cited evidence | Why it failed |
|---|---|---|---|
| CLM-025 | SPEC.md | `RedisCartStore.cs:62-65` | "All three" cart-store exception-mapping claim rested on only Redis's catch block; Spanner's and AlloyDB's own catch blocks were never cited anywhere. |
| CLM-034 | SPEC.md | `SpannerCartStore.cs:80-89` | Claimed the insert-or-update runs "inside a retriable transaction," but the cited range was only the parameterized-command construction; `RunWithRetriableTransactionAsync` (line 60) was outside the range and uncited elsewhere. |
| CLM-044 | SPEC.md | `checkoutservice/main.go:143-144` | Claimed **both** checkoutservice and shippingservice register the stock `health.NewServer()`; citation covered only checkoutservice. |
| CLM-069 | INTERFACES.md | `checkoutservice/main.go:230` | Asserted the `PlaceOrder` response composition (ID, tracking ID, shipping cost/address, items) but cited only the bare function signature; the `OrderResult{...}` construction (`main.go:265-271`) was uncited. |
| CLM-073 | INTERFACES.md | `shippingservice/main.go:110` | "Dead code" claim depended on the stock-health-server registration fact (`main.go:93-94`), never cited anywhere. |
| CLM-085 | DATA_MODEL.md | `shippingservice/main.go:57` | Characterized `initTracing` as "(currently no-op)" but cited only the `DISABLE_TRACING` condition; the no-op body (`main.go:159-161`) was uncited. |
| CLM-087 | DATA_MODEL.md | `shippingservice/main.go:84` | Claimed "both branches currently construct the server identically" but cited only the `DISABLE_STATS` condition; the two branch bodies (`main.go:85-90`) were uncited. |
| CLM-089 | DATA_MODEL.md | `RedisCartStore.cs:43-45` | "Constructed identically by all three store backends" rested on only Redis's construction site; Spanner's and AlloyDB's equivalent sites were uncited. |
| CLM-125 | TESTCASES.md | `checkoutservice/main.go:230` | Same `OrderResult` return-composition defect as CLM-069, restated in TESTCASES.md. |
| CLM-131 | RISKS.md | `shippingservice/main.go:110-112` | Same "registered instead" defect as CLM-073, restated in RISKS.md. |

## What the Writer changed (round 2 input)

- **CLM-025** narrowed to assert only RedisCartStore; two new claims split out the Spanner/AlloyDB halves: **CLM-136** (`SpannerCartStore.cs:99-100`), **CLM-137** (`AlloyDBCartStore.cs:98-99`).
- **CLM-034** widened to `SpannerCartStore.cs:60-89`, now including the `RunWithRetriableTransactionAsync` call at line 60.
- **CLM-044** narrowed to checkoutservice only; new **CLM-138** (`shippingservice/main.go:93-94`) carries the shippingservice half.
- **CLM-069** narrowed to signature/request/error-mapping only; new **CLM-139** (`checkoutservice/main.go:265-271`) carries the response-composition fact.
- **CLM-073** narrowed to the bare "defines a Check method" fact; new **CLM-140** (`shippingservice/main.go:93-94`) carries the "registered instead" fact.
- **CLM-085** narrowed, dropping the no-op characterization; new **CLM-141** (`shippingservice/main.go:159-161`) carries it.
- **CLM-087** now cites only `shippingservice/main.go:84` (the branching fact alone); new **CLM-146** carries the "both branches identical" claim on `main.go:84-90`.
- **CLM-089** narrowed to RedisCartStore only; new **CLM-142** (`SpannerCartStore.cs:125-131`), **CLM-143** (`AlloyDBCartStore.cs:119-125`).
- **CLM-125** narrowed, dropping the return-composition clause; new **CLM-144** (`checkoutservice/main.go:265-271`) carries it.
- **CLM-131** narrowed, dropping the "registered instead" clause; new **CLM-145** (`shippingservice/main.go:93-94`) carries it.

11 new claims total: CLM-136..CLM-146. 146 claims overall.

## Round 2 — per-correction judgment

Each corrected claim was re-checked against the printed source for **every** clause remaining on its line, not only the clause that was originally flagged.

| CLM | Verdict | Basis |
|---|---|---|
| CLM-025 | Verified | `RedisCartStore.cs:62-65` is exactly the generic `catch (Exception ex) { throw new RpcException(new Status(StatusCode.FailedPrecondition, ...)); }` block; claim is now scoped to Redis only. |
| CLM-136 | Verified | `SpannerCartStore.cs:99-100` is `AddItemAsync`'s own catch block, same `RpcException`/`FailedPrecondition` pattern. |
| CLM-137 | Verified | `AlloyDBCartStore.cs:98-99` is `AddItemAsync`'s own catch block, same pattern. |
| CLM-034 | Verified | `SpannerCartStore.cs:60-89` now opens with `RunWithRetriableTransactionAsync(async transaction => {...}` (line 60) and closes with the parameterized `CreateInsertOrUpdateCommand` (lines 80-89) inside that same transaction lambda — both "retriable transaction" and "parameterized command into `CartItems`" are now supported by one range. |
| CLM-044 | Verified | `checkoutservice/main.go:143-144` is exactly `healthcheck := health.NewServer(); healthpb.RegisterHealthServer(srv, healthcheck)`; claim narrowed to checkoutservice only. |
| CLM-138 | Verified | `shippingservice/main.go:93-94` is the identical registration pattern for shippingservice. |
| CLM-069 | Verified | `main.go:230` is exactly the `PlaceOrder` signature; the line no longer asserts the response composition (moved to CLM-139). |
| CLM-139 | Verified | `main.go:265-271` is the `orderResult := &pb.OrderResult{OrderId, ShippingTrackingId, ShippingCost, ShippingAddress, Items}` literal — all five listed fields present. |
| CLM-073 | Verified | `main.go:110` is exactly `func (s *server) Check(...)`; claim now asserts only that the method exists, not the dead-code conclusion. |
| CLM-140 | Verified | `main.go:93-94` is the stock `health.NewServer()` registration — supports "a separate stock health.NewServer() instance is registered instead." |
| CLM-085 | Verified | `main.go:57` is exactly `if os.Getenv("DISABLE_TRACING") == "" {`; the no-op characterization was dropped from this line. |
| CLM-141 | Verified | `main.go:159-161` is `func initTracing() { // TODO(arbrown) Implement OpenTelemetry tracing }` — a true no-op body with a TODO placeholder. |
| CLM-087 | Verified | `main.go:84` is exactly `if os.Getenv("DISABLE_STATS") == "" {` — the line now asserts only the branching fact, nothing about the branch bodies, as required. |
| CLM-146 | Verified | `main.go:84-90` contains both branches (`srv = grpc.NewServer()` in the `if` body at line 86 and again in the `else` body at line 89) — genuinely identical construction, confirmed by direct reading. |
| CLM-089 | Verified | `RedisCartStore.cs:43-45` is exactly the `Cart`/`CartItem` construction with `UserId`, `ProductId`, `Quantity`; claim narrowed to Redis only. |
| CLM-142 | Verified | `SpannerCartStore.cs:125-131` covers `cart.UserId = userId;` (125) through the `CartItem { ProductId, Quantity }` construction (127-131) inside `GetCartAsync` — full `{UserId, Items[{ProductId, Quantity}]}` shape supported. |
| CLM-143 | Verified | `AlloyDBCartStore.cs:119-125` covers the `CartItem { ProductId = reader.GetString(0), Quantity = reader.GetInt32(1) }` construction (119-123) plus `cart.Items.Add(item)` (124) — correctly scoped to only the `CartItem` sub-shape, no overreach. |
| CLM-125 | Verified | `main.go:230` is the `PlaceOrder` signature; the previously-uncited return-composition clause was removed from this line. |
| CLM-144 | Verified | `main.go:265-271` — same `OrderResult` literal as CLM-139; the four fields asserted here are all present in the literal. |
| CLM-131 | **Flagged (still)** | See below — new defect surfaced by the full-line re-check. |
| CLM-145 | Verified | `main.go:93-94` is the stock `health.NewServer()` registration for shippingservice — supports "a separate stock health.NewServer() instance is registered instead." |

### CLM-131 — round 2's new finding

CLM-131's round-1 defect (the "registered instead" clause depending on an uncited `main.go:93-94`) was fixed: that clause moved to new CLM-145, correctly cited.

However, re-checking the *entire* remaining sentence turned up a second, previously unnoticed defect on the same line: it still read *"shippingservice's `server` struct likewise defines `Check`/`Watch` methods satisfying the gRPC Health interface"* — a **plural** claim about two methods — cited only to `shippingservice/main.go:110-112`. That range was exactly the `Check` method's signature and three-line body; the `Watch` method is a separate block at `main.go:114-116` and was **not included** in the cited range.

Grep of every citation touching `shippingservice/main.go` across all 146 claims confirmed `Watch` was cited nowhere else. This was unlike the parallel checkoutservice claim (CLM-130, same "Check`/`Watch`" wording, citing `main.go:222-224` which is likewise only `Check`) — checkoutservice's `Watch` method genuinely *is* independently verified elsewhere, by CLM-029 (`checkoutservice/main.go:227`). No equivalent claim existed anywhere for shippingservice's `Watch` method, so **CLM-131 was flagged again** at the end of round 2, keeping the draft's verdict **failed** for a second time.

## Round 3 (this re-check) — verifying the fix

**The fix applied by the Writer:** CLM-131's citation in RISKS.md was widened from `src/shippingservice/main.go:110-112` to `src/shippingservice/main.go:110-116`, with the claim text on that line left unchanged.

**Full-line re-verification (not just the previously flagged clause).** I re-read `main.go:110-116` in the pinned source directly:

```
110  func (s *server) Check(ctx context.Context, req *healthpb.HealthCheckRequest) (*healthpb.HealthCheckResponse, error) {
111      return &healthpb.HealthCheckResponse{Status: healthpb.HealthCheckResponse_SERVING}, nil
112  }
113  (blank)
114  func (s *server) Watch(req *healthpb.HealthCheckRequest, ws healthpb.Health_WatchServer) error {
115      return status.Errorf(codes.Unimplemented, "health check via Watch not implemented")
116  }
```

Lines 110-112 are the `Check` method; lines 114-116 are the `Watch` method (113 is blank). The widened range now spans both method definitions in full. I then judged every assertion carried on RISKS.md's CLM-131 line, not only the previously flagged clause:

- *"shippingservice's `server` struct likewise defines `Check`/`Watch` methods satisfying the gRPC Health interface"* — **supported.** Both methods are now inside the cited range, and their signatures (`Check(ctx, *HealthCheckRequest) (*HealthCheckResponse, error)` and `Watch(*HealthCheckRequest, Health_WatchServer) error`) genuinely match the standard gRPC Health interface's method shapes.
- *"the same structural pattern as `RSK-CHECKOUT-HEALTH-DEADCODE`"* — a cross-reference to a sibling risk entry, not an independent factual assertion requiring its own citation (same treatment given to this clause type throughout the document, e.g. CLM-130's line).
- *"Severity: low. Likelihood: certain. Impact: identical to the checkout case. Confidence: high. Mitigation: same as above. Owner: unassigned. Status: open."* — qualitative risk metadata, consistent with every other risk entry's uncited fields (CLM-127 through CLM-133 all follow this pattern); not treated as claims requiring separate citation.
- *"Related: `RSK-CHECKOUT-HEALTH-DEADCODE`, `API-SHIPPING-HEALTHCHECK`"* — both cross-document IDs confirmed present: `RSK-CHECKOUT-HEALTH-DEADCODE` at RISKS.md:20, `API-SHIPPING-HEALTHCHECK` at INTERFACES.md:61. No drift in this entry's structure.

**Verdict: CLM-131 is now genuinely supported.** The widened range covers both halves of the plural claim directly, rather than relying on the round-1/round-2 standard of "supported elsewhere in the draft." This is a straightforward citation-widening fix, not a rubber stamp — I re-derived the line-number boundaries of both methods from the source file myself before accepting the range.

I also re-confirmed CLM-145 (`main.go:93-94`, the following line in RISKS.md, touched only structurally by the round-2 edit and not re-flagged) — citation and claim both unchanged from round 2, still verified.

## Drift check (all 145 previously-verified claims)

Programmatically compared every CLM id's exact citation string as it now appears in the draft against this round's inputs (the round-2 audit log, 146 rows). Extracted every `` `CLM-XXX`: `path:range` `` (and the one differently-ordered CLM-001 line) tuple from the seven current Markdown files and diffed against the prior recorded evidence field for every previously-verified claim (145 of them, all except CLM-131).

**Result: zero mismatches.** Every one of the 145 claims verified in round 2 carries an identical citation string in the current draft. No unexpected change surfaced anywhere outside the one line the Writer was asked to fix.

## Structural re-checks (all clean, re-run on the full 146)

- 146 unique CLM ids, CLM-001..CLM-146, no gaps, no duplicates.
- Every tagged line carries exactly one CLM id and exactly one citation (verified programmatically — no line matched more than one CLM tag or more than one citation path).
- Every citation resolves inside its cited file's actual line count, checked against the pinned source tree file-by-file; no out-of-range citation, no missing file.
- No citation targets `genproto/` or any other non-citable extension.
- The legitimate repeated-range citations (`shippingservice/main.go:93-94` under CLM-138/140/145; `checkoutservice/main.go:265-271` under CLM-139/144) are each on distinct CLM ids and distinct markdown lines, consistent with "one citation per line, not one line per range."
- Both `Related:` cross-document IDs on CLM-131's line (`RSK-CHECKOUT-HEALTH-DEADCODE`, `API-SHIPPING-HEALTHCHECK`) resolve to exactly one entry each elsewhere in the document set.

## Final verdict

**passed** — all 146 claims verified, 0 flagged. Round 1's original 10 defects and round 2's newly surfaced CLM-131 defect are all genuinely resolved; the 11 split-out claims from round 2 remain correctly supported; no drift on the 145 previously-verified claims. The draft was rejected twice (round 1: 10 flagged; round 2: 1 flagged) before reaching this state — that rejection history is not erased by this pass.
