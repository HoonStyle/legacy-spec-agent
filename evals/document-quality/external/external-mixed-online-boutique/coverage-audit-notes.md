# Coverage Sentinel notes — external-mixed-online-boutique

actor_id: sentinel-ext3
Draft digest verified against: `14d5e487b6cbfb680aeb7255c51b6316447cf4cd7e8f8012e166a6d153202d38`
Frozen draft read from: `evals/document-quality/external/external-mixed-online-boutique/staging/` (SPEC.md, ARCHITECTURE.md, INTERFACES.md, DATA_MODEL.md, ONBOARDING.md, TESTCASES.md, RISKS.md)
Source read from: `.external-sources/microservices-demo/` at the pinned scope (`src/cartservice/**`, `src/checkoutservice/**` excl. `genproto/**`, `src/shippingservice/**` excl. `genproto/**`)
No MCP tools were invoked. This document was not modified in the draft.

## Method

1. Read `raw-extractor-output.json` and extracted the verbatim `surface` / `found_at` / `expected_document_type` triple for all 25 entries.
2. For each entry, searched the draft file matching its `expected_document_type` (API → INTERFACES.md, DM → DATA_MODEL.md, BR → SPEC.md, TC → TESTCASES.md) for a `####` heading whose body (from that heading to the next `####`/`##`) contains the exact `found_at` string wrapped in backticks.
3. Independently re-read every in-scope source file (all 30 non-excluded files under the three service trees) to build my own surface inventory, then checked whether the draft documents each one at a matching typed heading, regardless of whether the detector caught it.

## Part A — per-surface verification (all 25 PASS)

| # | surface | found_at | type | document_id | verified against |
|---|---|---|---|---|---|
| 1 | registered_api:AlloyDBCartStore | AlloyDBCartStore.cs:25 | API | API-ALLOYDBCARTSTORE | INTERFACES.md `CLM-067` |
| 2 | data_contract:ICartStore | ICartStore.cs:19 | DM | DM-ICARTSTORE-CONTRACT | DATA_MODEL.md `CLM-074` |
| 3 | registered_api:ICartStore | ICartStore.cs:19 | API | API-ICARTSTORE | INTERFACES.md `CLM-064` |
| 4 | registered_api:RedisCartStore | RedisCartStore.cs:24 | API | API-REDISCARTSTORE | INTERFACES.md `CLM-065` |
| 5 | registered_api:SpannerCartStore | SpannerCartStore.cs:23 | API | API-SPANNERCARTSTORE | INTERFACES.md `CLM-066` |
| 6 | registered_api:CartService | CartService.cs:24 | API | API-CARTSERVICE | INTERFACES.md `CLM-060` |
| 7 | registered_api:Startup | Startup.cs:16 | API | API-STARTUP | INTERFACES.md `CLM-134` |
| 8 | test_file:.../CartServiceTests.cs | CartServiceTests.cs:1 | TC | TC-CARTSERVICETESTS-FILE | TESTCASES.md `CLM-115` |
| 9 | registered_api:CartServiceTests | CartServiceTests.cs:27 | API | API-CARTSERVICETESTS | INTERFACES.md `CLM-135` |
| 10 | environment:PORT | main.go:106 (checkout) | DM | DM-ENV-PORT-CHECKOUT-A | DATA_MODEL.md `CLM-077` |
| 11 | environment:PORT | main.go:107 (checkout) | DM | DM-ENV-PORT-CHECKOUT-B | DATA_MODEL.md `CLM-078` |
| 12 | data_contract:orderPrep | main.go:282 (checkout) | DM | DM-ORDERPREP | DATA_MODEL.md `CLM-075` |
| 13 | data_contract:checkoutService | main.go:66 (checkout) | DM | DM-CHECKOUTSERVICE-STRUCT | DATA_MODEL.md `CLM-076` |
| 14 | entrypoint:.../checkoutservice/main.go | main.go:88 (checkout) | BR | BR-ENTRYPOINT-CHECKOUT | SPEC.md `CLM-003` |
| 15 | environment:ENABLE_TRACING | main.go:90 (checkout) | DM | DM-ENV-ENABLE-TRACING | DATA_MODEL.md `CLM-079` |
| 16 | environment:ENABLE_PROFILER | main.go:98 (checkout) | DM | DM-ENV-ENABLE-PROFILER | DATA_MODEL.md `CLM-080` |
| 17 | data_contract:args | money_test.go:116 | DM | DM-MONEYTEST-ARGS-1 | DATA_MODEL.md `CLM-081` |
| 18 | data_contract:args | money_test.go:141 | DM | DM-MONEYTEST-ARGS-2 | DATA_MODEL.md `CLM-082` |
| 19 | data_contract:args | money_test.go:203 | DM | DM-MONEYTEST-ARGS-3 | DATA_MODEL.md `CLM-083` |
| 20 | data_contract:server | main.go:105 (shipping) | DM | DM-SHIPPING-SERVER | DATA_MODEL.md `CLM-084` |
| 21 | entrypoint:.../shippingservice/main.go | main.go:56 (shipping) | BR | BR-ENTRYPOINT-SHIPPING | SPEC.md `CLM-004` |
| 22 | environment:DISABLE_TRACING | main.go:57 (shipping) | DM | DM-ENV-DISABLE-TRACING | DATA_MODEL.md `CLM-085` |
| 23 | environment:DISABLE_PROFILER | main.go:65 (shipping) | DM | DM-ENV-DISABLE-PROFILER | DATA_MODEL.md `CLM-086` |
| 24 | environment:DISABLE_STATS | main.go:84 (shipping) | DM | DM-ENV-DISABLE-STATS | DATA_MODEL.md `CLM-087` |
| 25 | data_contract:Quote | quote.go:23 | DM | DM-QUOTE | DATA_MODEL.md `CLM-088` |

Note on #2/#3 and the shared-line pair generally: `ICartStore.cs:19` legitimately carries two different-category surfaces (a `data_contract` and a `registered_api`), and the draft gives each its own heading with a correctly prefixed ID (`DM-ICARTSTORE-CONTRACT` vs `API-ICARTSTORE`) rather than collapsing them into one. Correct.

Result: 25/25 documented at a matching typed heading with the verbatim `found_at` in backticks in the section body. `unexplained_omissions: []`, `verdict: passed`.

## Part B — real reverse audit (detector-missed surfaces)

### B.1 gRPC RPC method implementations

| Method | Source | Documented? |
|---|---|---|
| `CartService.AddItem` | CartService.cs:34 | Yes — `API-CART-ADDITEM` |
| `CartService.GetCart` | CartService.cs:40 | Yes — `API-CART-GETCART` |
| `CartService.EmptyCart` | CartService.cs:45 | Yes — `API-CART-EMPTYCART` |
| `checkoutService.PlaceOrder` | main.go:230 | Yes — `API-CHECKOUT-PLACEORDER` |
| `server.GetQuote` | main.go:119 (shipping) | Yes — `API-SHIPPING-GETQUOTE` |
| `server.ShipOrder` | main.go:142 (shipping) | Yes — `API-SHIPPING-SHIPORDER` |

All 6 RPC methods are documented, but **none of the 6 appear in the detector's 25-surface list at all** — the detector only caught the enclosing C# `class`/`struct` declarations (`CartService`, `checkoutService`, `server` as `data_contract`), never the individual method implementations, Go or C#. The Writer documented these from direct reading, not from the detector.

### B.2 Health-check registrations

| Registration | Source | Documented? |
|---|---|---|
| cartservice custom `HealthCheckService.Check` → delegates to store `Ping()` | HealthCheckService.cs:33 | Yes — `API-HEALTHCHECK`, `RSK-CART-HEALTHCHECK-WORKS` |
| checkoutservice `checkoutService.Check`/`Watch` (dead code) | main.go:222,226 | Yes — `API-CHECKOUT-HEALTHCHECK`, `RSK-CHECKOUT-HEALTH-DEADCODE` |
| checkoutservice actual registered `health.NewServer()` | main.go:143-144 | Yes — SPEC.md `CLM-044` |
| shippingservice `server.Check`/`Watch` (dead code) | main.go:110,114 | Yes — `API-SHIPPING-HEALTHCHECK`, `RSK-SHIPPING-HEALTH-DEADCODE` |
| shippingservice actual registered `health.NewServer()` | main.go:93-94 | Yes — SPEC.md `CLM-138` |

All 5 health-check surfaces documented, none via the detector (none appear among the 25).

### B.3 Environment variables (independently re-enumerated)

Grepped `os.Getenv`/`os.LookupEnv` (Go) and `Configuration["…"]` (C#) across all in-scope files. Found 24 distinct environment-variable read sites: `REDIS_ADDR`, `SPANNER_PROJECT`, `SPANNER_CONNECTION_STRING`, `ALLOYDB_PRIMARY_IP` (Startup.cs); `SPANNER_INSTANCE`, `SPANNER_DATABASE` (SpannerCartStore.cs, both also read via `Configuration[...]` inside the constructor in addition to the Startup.cs read); `PROJECT_ID`, `ALLOYDB_SECRET_NAME`, `ALLOYDB_DATABASE_NAME`, `ALLOYDB_TABLE_NAME` (AlloyDBCartStore.cs); `PORT`×2, `ENABLE_TRACING`, `ENABLE_PROFILER`, `SHIPPING_SERVICE_ADDR`, `PRODUCT_CATALOG_SERVICE_ADDR`, `CART_SERVICE_ADDR`, `CURRENCY_SERVICE_ADDR`, `EMAIL_SERVICE_ADDR`, `PAYMENT_SERVICE_ADDR`, `COLLECTOR_SERVICE_ADDR` (checkoutservice/main.go); `DISABLE_TRACING`, `DISABLE_PROFILER`, `DISABLE_STATS`, `PORT` (shippingservice/main.go). All 24 have a matching `DM-ENV-*` heading in DATA_MODEL.md citing their read site. No undocumented environment variable was found. Only 9 of these 24 (the checkoutservice/shippingservice `os.Getenv`/`os.LookupEnv` Go sites) are among the detector's 25 surfaces; the 15 C#-side `Configuration["…"]` reads were entirely missed by the detector but were still documented by the Writer.

### B.4 Process entrypoints

3 entrypoints exist: cartservice `Program.cs:19` (top-level statement), checkoutservice `main.go:88`, shippingservice `main.go:56`. All 3 documented (`BR-ENTRYPOINT-CARTSERVICE`, `BR-ENTRYPOINT-CHECKOUT`, `BR-ENTRYPOINT-SHIPPING`). Only the 2 Go entrypoints are in the detector's 25 — the C# entrypoint is invisible to the detector's `entrypoint` category, matching the finding below.

### B.5 Cart-store mutations across all three backends

Redis (`AddItemAsync`:33, `EmptyCartAsync`:68), Spanner (`AddItemAsync` insert-or-update, `EmptyCartAsync`), AlloyDB (`AddItemAsync`:62 string-interpolated INSERT/UPDATE, `EmptyCartAsync`) — 6 mutation sites total. All documented: `BR-CART-QUANTITY-MERGE`, `BR-CART-EMPTYCART-OVERWRITE`, and the Persistence-and-side-effects claims `CLM-033`/`CLM-034`/`CLM-035` in SPEC.md, cross-referenced by `RSK-ALLOYDB-SQL-INTERPOLATION`/`RSK-SPANNER-PARAMETERIZED` in RISKS.md. No undocumented mutation found.

### B.6 checkoutservice outbound downstream RPCs

8 outbound call sites in `main.go`: `getUserCart`→cartservice.GetCart:324, `emptyUserCart`→cartservice.EmptyCart:332, `quoteShipping`→shippingservice.GetQuote:313, `shipOrder`→shippingservice.ShipOrder:386, `prepOrderItems`→productcatalog.GetProduct:344, `convertCurrency`→currency.Convert:359 (called twice — once for shipping cost, once per line item price), `chargeCard`→payment.Charge:369, `sendOrderConfirmation`→email.SendOrderConfirmation:379. All 8 documented in ARCHITECTURE.md's "External systems and data stores" / "Major execution flows" sections and cross-referenced to `UV-PRODUCTCATALOG-CONTRACT`/`UV-CURRENCY-CONTRACT`/`UV-PAYMENT-CONTRACT`/`UV-EMAIL-CONTRACT` in INTERFACES.md for the parts genuinely out of scope. No omission found here.

### B.7 money package validation invariants

`money.go` defines: `IsValid`, `signMatches`, `validNanos`, `IsZero`, `IsPositive`, `IsNegative`, `AreSameCurrency`, `AreEquals`, `Negate`, `Must`, `Sum`, `MultiplySlow`.
Documented: `IsValid`/`signMatches` → `BR-MONEY-SIGN-MATCH`; `validNanos`/bounds → `BR-MONEY-NANOS-RANGE`, `BR-MONEY-NANOS-BOUNDS-VALUE`, `DM-MONEY-CONST`; `Sum`/currency mismatch → `BR-MONEY-SUM-CURRENCY`.
**Not documented as their own claim anywhere in the draft**: `IsZero`, `IsPositive`, `IsNegative`, `AreSameCurrency` (function itself — only its *test* is named in passing inside `DM-MONEYTEST-ARGS-1`'s prose), `AreEquals` (same — named only inside `DM-MONEYTEST-ARGS-2`'s prose), `Negate`, `Must`, and `MultiplySlow` (used directly in `PlaceOrder`'s per-item pricing loop at main.go:248 to multiply a unit price by quantity via repeated addition — this is a real, non-obvious performance/behavior detail of order pricing that is not called out anywhere, including in `API-CHECKOUT-PLACEORDER`, `BR-CHECKOUT-CHARGE-THEN-SHIP`, or ARCHITECTURE.md's "Major execution flows"). This is a genuine omission (see Findings below).

### B.8 Quote computation and tracking-ID generation

- Quote computation (`CreateQuoteFromCount`/`CreateQuoteFromFloat`, quote.go:34-47): documented via `BR-SHIPPING-QUOTE-FLAT-RATE` and `DM-QUOTE`.
- Tracking-ID generation (`CreateTrackingId`, `getRandomLetterCode`, `getRandomNumber`, tracker.go:23-47): the *existence and output format* is documented (`API-SHIPPING-SHIPORDER` says "a new tracking ID is generated per call"; `TC-SHIPPING-TRACKINGID-FORMAT` documents the `^[A-Z]{2}-\d+-\d+$` format test), but the generation *algorithm itself* — two random letter code points plus salt-length-derived and random numeric segments, and that it is not cryptographically random (`math/rand`, unseeded) — is not narrated as its own claim anywhere (no `BR-` or `DM-` heading cites `tracker.go`). This is a minor omission; the outward-observable contract (format) is covered but the mechanism/randomness-quality is not.

### B.9 OpenTelemetry / tracing wiring

Documented: the on/off toggle behavior (`ENABLE_TRACING`/`DISABLE_TRACING` env vars, `DM-ENV-ENABLE-TRACING`, `DM-ENV-DISABLE-TRACING`) and that shippingservice's tracing initializer is a no-op TODO (`CLM-141`).
**Not documented**: checkoutservice's actual (non-stub) OTel wiring is materially more than a toggle — `otel.SetTextMapPropagator` (main.go:135-137), `grpc.StatsHandler(otelgrpc.NewServerHandler())` attached to the server (main.go:138-140), `grpc.WithStatsHandler(otelgrpc.NewClientHandler())` on every outbound connection (main.go:216), and `initTracing`'s construction of an OTLP gRPC exporter plus an always-sampling `TracerProvider` (main.go:167-176, gated by `COLLECTOR_SERVICE_ADDR`, itself documented as `DM-ENV-COLLECTOR-SVC-ADDR`). None of this mechanism is narrated in ARCHITECTURE.md or SPEC.md; only the boolean toggle is. This is a genuine, if secondary, omission — see Findings.

### B.10 Every test file

| Test file | Test functions in source | Documented as TC- items |
|---|---|---|
| `src/cartservice/tests/CartServiceTests.cs` | 3 (`GetItemTest_ItemNotFound`-type Get, AddItem-update, AddItem-new-then-empty) | 3/3 — `TC-CARTSERVICETESTS-GETITEM`, `TC-CARTSERVICETESTS-ADDITEM-UPDATE`, `TC-CARTSERVICETESTS-ADDITEM-NEW`, plus the file itself as `TC-CARTSERVICETESTS-FILE` |
| `src/checkoutservice/money/money_test.go` | 10 (`TestIsValid`, `TestIsZero`, `TestIsPositive`, `TestIsNegative`, `TestAreSameCurrency`, `TestAreEquals`, `TestNegate`, `TestMust_pass`, `TestMust_panic`, `TestSum`) | **2/10** — only `TC-MONEY-ISVALID` (`TestIsValid`) and `TC-MONEY-SUM` (`TestSum`). The file itself has **no** `TC-*-FILE` heading citing `money_test.go:1`. |
| `src/shippingservice/shippingservice_test.go` | 10 (`TestGetQuote`, `TestGetQuoteEmptyCart`, `TestShipOrder`, `TestTrackingIdFormat`, `TestTrackingIdUniqueness`, `TestCreateQuoteFromFloat`, `TestCreateQuoteFromCount`, `TestGetRandomLetterCode`, `TestGetRandomNumber`, `TestQuoteString`) | **3/10** directly (`TC-SHIPPING-GETQUOTE`, `TC-SHIPPING-SHIPORDER`, `TC-SHIPPING-TRACKINGID-FORMAT`); `TestGetQuoteEmptyCart` is referenced only in passing prose under `TC-SHIPPING-QUOTE-ZERO-ITEMS` (a source-derived scenario, not a heading citing the test itself). No `TC-*-FILE` heading cites `shippingservice_test.go:1`. |

This is the most significant Part B finding: **money_test.go and shippingservice_test.go are real, in-scope, existing automated Go test files that are never documented as `test_file` entities at all** — no heading anywhere cites `money_test.go:1` or `shippingservice_test.go:1` the way `TC-CARTSERVICETESTS-FILE` cites `CartServiceTests.cs:1`. The detector's own `test_file` category shows the same blind spot: of the 25 detector surfaces, exactly one is `test_file`, and it is the C# file; the detector never emitted a `test_file` surface for either Go test file, so this gap could not have been caught by Part A's exact-match check — it is only visible from independently reading the source, which is what this reverse audit does.

## Denominator statement: detector 25 vs. real surface count

The detector's 25 surfaces are **not** a full inventory of documentable code surfaces in this scope. Independently walking the same 30 in-scope files, I count materially more real surfaces, including (non-exhaustively, counting only what is unambiguous):

- 6 gRPC RPC method implementations (0 in the detector's 25)
- 5 health-check registration/implementation sites (0 in the detector's 25)
- 8 checkoutservice outbound downstream call sites (0 in the detector's 25)
- 6 cart-store mutation methods across 3 backends beyond the class-level surfaces already counted (0 additional in the detector's 25)
- 12 money-package functions, of which 5 are undocumented as standalone claims (0 money.go functions in the detector's 25 — only the file's constants via `data_contract:args` in the *test* file)
- 20 Go test functions across `money_test.go`/`shippingservice_test.go` (0 in the detector's 25 `test_file`/`registered_api` categories — the detector caught only C# test surfaces)
- checkoutservice's live OTel wiring (stats handler, propagator, OTLP exporter) as a distinct operational surface (0 in the detector's 25)

**Root cause, stated plainly:** the detector's `registered_api` detector_id `line-syntax` regex matches C# `public class ...` declarations (`CartService`, `ICartStore`, `RedisCartStore`, `SpannerCartStore`, `AlloyDBCartStore`, `Startup`, `CartServiceTests`) but has no equivalent rule for a Go `func (receiver) MethodName(...)` declaration — so every gRPC method in checkoutservice and shippingservice (`PlaceOrder`, `GetQuote`, `ShipOrder`, `Check`, `Watch`, and all of `money.go`'s exported functions) is structurally invisible to it, regardless of how central those methods are to the services' actual behavior. The same asymmetry appears in `test_file`: it caught the one C# test file but neither Go test file, even though both are ordinary, well-formed `_test.go` files in scope. This is a category-level detector blind spot, not a Writer omission — the Writer in fact documented most of the Go-only surfaces (RPC methods, health checks, outbound calls, some test cases) from direct reading despite the detector never surfacing them, which is why Part A still passes 25/25: the detector's shallow C#-biased inventory happens to be a strict subset of what the Writer covered. The exceptions are the 3 items below.

## Genuine documentation omissions found (Part B only — do not affect the Part A machine-checked verdict)

1. **money_test.go and shippingservice_test.go have no `test_file` heading of their own.** 8/10 test functions in `money_test.go` and 6/10 in `shippingservice_test.go` (`TestGetQuoteEmptyCart` gets only prose, not a heading) are not documented as test cases at all. Only the C# test file (`TC-CARTSERVICETESTS-FILE`) and 5 of its 3 individual C# test methods... (3/3 methods, all documented) got full test-case treatment.
2. **`money.MultiplySlow` is used in the `PlaceOrder` pricing path (main.go:248) but never documented** — not in `API-CHECKOUT-PLACEORDER`, not as its own `BR-`/`DM-` item. This is the one exported `money` function actually exercised by production request handling (as opposed to only by its own unit test) that has zero narrative coverage.
3. **checkoutservice's functional OpenTelemetry wiring (propagator, gRPC stats handlers, OTLP exporter/TracerProvider construction) is not documented** beyond the boolean `ENABLE_TRACING` toggle — a materially different (and non-stub, unlike shippingservice's) piece of cross-cutting behavior with no citation anywhere in ARCHITECTURE.md or SPEC.md.

Minor/secondary observation, not counted as a full omission: the tracking-ID generation *mechanism* (letter codes + salt-derived/random digits, non-cryptographic `math/rand`) is under-narrated relative to its documented *format* — the outward contract is covered, the mechanism is not.

None of these three findings are among the detector's 25 surfaces, so none affect `coverage-audit.json`'s Part A verdict (which is machine-checked against the detector's exact set and correctly reports `passed`). They are reported here as the substantive reverse-audit result per the task's Part B requirement, for the Writer/Gatekeeper to weigh separately from the machine-checked gate.
