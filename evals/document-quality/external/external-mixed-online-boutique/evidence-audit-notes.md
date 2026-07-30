# Independent Evidence Audit Notes — external-mixed-online-boutique

- **Actor:** auditor-ext3 (Independent Evidence Auditor; did not write the draft)
- **Round 1 frozen draft digest:** `f358873e7ec8dcf8c115c7e7cc4f056a691dfbac2c6ac5998a6276e2659977c3` (135 claims, CLM-001..CLM-135) — **verdict: failed**, 10 of 135 flagged
- **Round 2 (this re-check) frozen draft digest:** `155ac67a50743a6fd3e8e0d1c5c231bc564442ba1efbe66c449a42cdd9d9f1f8` (146 claims, CLM-001..CLM-146) — **verdict: failed**, 1 of 146 flagged
- **Source of truth:** `/home/user/legacy-spec-agent/.external-sources/microservices-demo/` (cartservice C#, checkoutservice Go, shippingservice Go)

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
| CLM-025 | **Verified** | `RedisCartStore.cs:62-65` is exactly the generic `catch (Exception ex) { throw new RpcException(new Status(StatusCode.FailedPrecondition, ...)); }` block; claim is now scoped to Redis only. |
| CLM-136 | **Verified** | `SpannerCartStore.cs:99-100` is `AddItemAsync`'s own catch block, same `RpcException`/`FailedPrecondition` pattern. |
| CLM-137 | **Verified** | `AlloyDBCartStore.cs:98-99` is `AddItemAsync`'s own catch block, same pattern. |
| CLM-034 | **Verified** | `SpannerCartStore.cs:60-89` now opens with `RunWithRetriableTransactionAsync(async transaction => {...}`(line 60) and closes with the parameterized `CreateInsertOrUpdateCommand` (lines 80-89) inside that same transaction lambda — both "retriable transaction" and "parameterized command into `CartItems`" are now supported by one range. |
| CLM-044 | **Verified** | `checkoutservice/main.go:143-144` is exactly `healthcheck := health.NewServer(); healthpb.RegisterHealthServer(srv, healthcheck)`; claim narrowed to checkoutservice only. |
| CLM-138 | **Verified** | `shippingservice/main.go:93-94` is the identical registration pattern for shippingservice. |
| CLM-069 | **Verified** | `main.go:230` is exactly the `PlaceOrder` signature; the line no longer asserts the response composition (moved to CLM-139). |
| CLM-139 | **Verified** | `main.go:265-271` is the `orderResult := &pb.OrderResult{OrderId, ShippingTrackingId, ShippingCost, ShippingAddress, Items}` literal — all five listed fields present. |
| CLM-073 | **Verified** | `main.go:110` is exactly `func (s *server) Check(...)`; claim now asserts only that the method exists, not the dead-code conclusion. |
| CLM-140 | **Verified** | `main.go:93-94` is the stock `health.NewServer()` registration — supports "a separate stock health.NewServer() instance is registered instead." |
| CLM-085 | **Verified** | `main.go:57` is exactly `if os.Getenv("DISABLE_TRACING") == "" {`; the no-op characterization was dropped from this line. |
| CLM-141 | **Verified** | `main.go:159-161` is `func initTracing() { // TODO(arbrown) Implement OpenTelemetry tracing }` — a true no-op body with a TODO placeholder. |
| CLM-087 | **Verified** | `main.go:84` is exactly `if os.Getenv("DISABLE_STATS") == "" {` — the line now asserts only the branching fact, nothing about the branch bodies, as required. |
| CLM-146 | **Verified** | `main.go:84-90` contains both branches (`srv = grpc.NewServer()` in the `if` body at line 86 and again in the `else` body at line 89) — genuinely identical construction, confirmed by direct reading. |
| CLM-089 | **Verified** | `RedisCartStore.cs:43-45` is exactly the `Cart`/`CartItem` construction with `UserId`, `ProductId`, `Quantity`; claim narrowed to Redis only. |
| CLM-142 | **Verified** | `SpannerCartStore.cs:125-131` covers `cart.UserId = userId;` (125) through the `CartItem { ProductId, Quantity }` construction (127-131) inside `GetCartAsync` — full `{UserId, Items[{ProductId, Quantity}]}` shape supported. |
| CLM-143 | **Verified** | `AlloyDBCartStore.cs:119-125` covers the `CartItem { ProductId = reader.GetString(0), Quantity = reader.GetInt32(1) }` construction (119-123) plus `cart.Items.Add(item)` (124) — the claim is correctly scoped to only the `CartItem` sub-shape (not the outer cart's `UserId`, which sits outside this range at line 108 and is not asserted here), so there is no overreach. |
| CLM-125 | **Verified** | `main.go:230` is the `PlaceOrder` signature; the "charges the card before shipping and clears the cart afterward" clauses remain independently supported elsewhere in the draft (CLM-021, CLM-022/032, same reasoning accepted in round 1); the previously-uncited return-composition clause was removed from this line. |
| CLM-144 | **Verified** | `main.go:265-271` — same `OrderResult` literal as CLM-139; the four fields asserted here (order ID, tracking ID, shipping cost, items) are all present in the literal. |
| CLM-131 | **FLAGGED (still)** — see below | |
| CLM-145 | **Verified** | `main.go:93-94` is the stock `health.NewServer()` registration for shippingservice — supports "a separate stock health.NewServer() instance is registered instead." |

### CLM-131 — still flagged, new defect surfaced by the full-line re-check

CLM-131's round-1 defect (the "registered instead" clause depending on an uncited `main.go:93-94`) is fixed: that clause was moved to new CLM-145, correctly cited.

However, re-checking the *entire* remaining sentence turned up a second, previously unnoticed defect in the same line: it still reads *"shippingservice's `server` struct likewise defines `Check`/`Watch` methods satisfying the gRPC Health interface"* — a **plural** claim about two methods — cited only to `shippingservice/main.go:110-112`. That range is exactly the `Check` method's signature and three-line body; the `Watch` method is a separate block at `main.go:114-116` and is **not included** in the cited range.

I checked whether shippingservice's `Watch` method is cited anywhere else across all 146 claims (grep of every citation touching `shippingservice/main.go`): it is not. This is unlike the parallel checkoutservice claim (CLM-130, same "Check`/`Watch`" wording, citing `main.go:222-224` which is likewise only `Check`) — checkoutservice's `Watch` method genuinely *is* independently verified elsewhere, by CLM-029 (`checkoutservice/main.go:227`, "checkoutservice's `Watch` health RPC explicitly returns `codes.Unimplemented`"). No equivalent claim exists anywhere for shippingservice's `Watch` method.

Applying the same standard used throughout this audit (a compound claim is accepted only if every sub-fact it depends on has a genuine citation *somewhere* in the draft): the "Watch" half of CLM-131's sentence has zero citation support anywhere in the 146 claims. This is a citation-scope defect of the same kind as the original 10, not a newly invented standard, and it was not part of what the Writer was asked to fix in this round, so it survived uncorrected. **CLM-131 is flagged again** in `audit_log.jsonl`.

## Drift check (round-1-verified claims the Writer did not touch)

Compared all 125 round-1-verified citations (every CLM outside {25, 34, 44, 69, 73, 85, 87, 89, 125, 131}) against their current text in the draft, programmatically, line by line. **Result: zero mismatches.** Every one of the 125 untouched claims carries an identical citation string to round 1. No unexpected drift.

## Structural re-checks (all clean, re-run on the full 146)

- 146 unique CLM ids, CLM-001..CLM-146, no gaps, no duplicates.
- Every tagged line carries exactly one CLM id and exactly one citation.
- Every citation resolves inside its cited file's actual line count (programmatically verified against the pinned source tree); no out-of-range citation, no missing file.
- No citation targets `genproto/` or any other non-citable extension.
- The three legitimate repeated-range citations (`shippingservice/main.go:93-94` under CLM-138/140/145; `checkoutservice/main.go:265-271` under CLM-139/144) are each on distinct CLM ids and distinct markdown lines, consistent with the "one citation per line, not one line per range" rule.

## Final verdict

**failed** — 145 of 146 claims verified; 1 flagged (CLM-131, "Watch" method claim uncited). Round 1's original 10 defects are all genuinely resolved; the 11 new split-out claims are all correctly supported; no drift on the 125 untouched claims; but CLM-131 carries a second, distinct citation-scope defect that survived this round's correction and must be fixed before the gate can pass.
