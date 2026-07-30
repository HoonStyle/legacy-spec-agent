# Gold review notes — external-mixed-online-boutique

Authored independently from source only, under
`.external-sources/microservices-demo/src/{cartservice,checkoutservice,shippingservice}/`.
No connector/extractor output, no other case's gold, and no generated document was
consulted while authoring these annotations. The case manifest already existed in the
target directory when the source-only annotation session started; it was not opened
because that task's independence rule prohibited reading anything under `evals/`.

## Original per-service inventory

The counts in this section describe the original 111-row draft before the integrated
review removals recorded below.

### cartservice (C#, ASP.NET Core, gRPC) — 48 original rows

A gRPC service that stores and retrieves a per-user shopping cart. `Program.cs` boots
an ASP.NET Core host running `Startup`, which selects `RedisCartStore`,
`SpannerCartStore`, or `AlloyDBCartStore` according to connection configuration and
falls back to the in-memory implementation. It maps `CartService`,
`HealthCheckService`, and one informational HTTP GET.

Every in-scope file was read, including `Program.cs`, `Startup.cs`,
`appsettings.json`, the project and solution files, all files under `cartstore/` and
`services/`, `protos/Cart.proto`, `tests/CartServiceTests.cs`, both Dockerfiles, and
`.dockerignore`.

### checkoutservice (Go, gRPC) — 40 original rows

A gRPC service exposing `PlaceOrder`. It reads the user's cart, obtains product
prices and currency conversions, gets a shipping quote, charges the card, ships the
order, empties the cart, and requests an email confirmation through downstream gRPC
services.

The source-only review covered `main.go`, `money/money.go`,
`money/money_test.go`, `go.mod`, `go.sum`, `Dockerfile`, `.dockerignore`,
`README.md`, and `genproto.sh`. Generated `genproto/*.pb.go` files were excluded by
the frozen scope.

### shippingservice (Go, gRPC) — 23 original rows

A gRPC service exposing `GetQuote`, a flat-rate shipping cost calculator, and
`ShipOrder`, a mock fulfillment operation that returns a generated tracking ID. The
review covered `main.go`, `quote.go`, `tracker.go`, `shippingservice_test.go`,
`go.mod`, `Dockerfile`, `.dockerignore`, `README.md`, and `genproto.sh`. Generated
`genproto/*.pb.go` files were excluded by the frozen scope.

## Searched-but-absent surfaces

- **No HTTP/REST listener in checkoutservice or shippingservice.** Both are
  gRPC-only. Their `main.go` files were searched for `net/http`, `http.Handle`, and
  `ListenAndServe`; there were no matches. Cartservice's informational `GET /` is
  represented by `EXT3-005`.
- **No service environment variables in startup shell scripts.** The two in-scope
  `genproto.sh` files are developer-invoked code-generation helpers. They use local
  shell variables and `go env GOPATH`, not runtime service configuration.
- **No hard-coded password, API key, or token.** AlloyDB uses the literal username
  `postgres`, which is a credential-scoping risk but not a secret value. The risk is
  retained as context rather than a positive gold row.
- **No material C# solution or namespace-resolution surface.** The solution has the
  service and test projects with a normal project reference; no aliased `using` or
  additional cross-project graph warrants a data-contract row.
- **No checkout main-package tests or direct cart-store unit tests.** Checkout only
  has `money/money_test.go`. Cartservice's `CartServiceTests.cs` exercises the
  ASP.NET test server and Redis/in-memory path transitively, not Spanner or AlloyDB
  directly. This is a source test-coverage gap, not a gold omission.
- **No in-scope checkout/shipping wire-message definitions.** `pb.Money`,
  `pb.Address`, `pb.CartItem`, `pb.OrderResult`, and related messages are defined in
  the out-of-scope sibling `src/protos/demo.proto`. Generated `genproto/**` is also
  excluded. Cartservice's own `src/cartservice/src/protos/Cart.proto` is in scope.

## Integrated review decisions (2026-07-30)

The integrated review in `docs/external-gold-review-summary.md` was applied to the
draft. Ten rows were removed from the original 111, leaving **101 rows**. Existing
IDs were not renumbered.

### Removed rows

- `EXT3-007`–`EXT3-009`: `RedisCartStore`, `SpannerCartStore`, and
  `AlloyDBCartStore` are persistence implementations, not data contracts.
  `ICartStore` (`EXT3-006`) and the in-scope `Cart.proto` messages remain.
- `EXT3-045`, `EXT3-082`, and `EXT3-108`: multi-stage Docker builds are build and
  deployment evidence, not runtime external integrations. Docker entrypoint rows
  remain.
- `EXT3-051`: `checkoutService` is a service implementation holding downstream
  connections, not a data shape.
- `EXT3-092`: shipping's `server` is an RPC implementation, not a data contract.
- `EXT3-066` and `EXT3-102`: the `SERVING` literals occur in custom health methods
  that are not registered. The stock gRPC health server registrations remain.

### Corrected retained rows

- `EXT3-035`: Redis `EmptyCartAsync` does not delete its key; it serializes and
  stores an empty cart. This is distinguished from the SQL stores' deletes.
- `EXT3-087` and `EXT3-088`: these money rules are described as **monetary
  validation invariants**, not product policy.

### Retained judgment calls

1. **Custom Go health methods are not registered APIs.** Checkout and shipping
   register the stock object created by `health.NewServer()`, not their own service
   structs. Their custom `Check` and `Watch` methods therefore remain excluded.
   Cartservice's C# `HealthCheckService` is explicitly mapped and remains critical.
2. **`APP_PORT` and `PORT` are a real mismatch.** Shipping's Dockerfile sets
   `APP_PORT=50051`, while `main.go` reads `PORT`. Both configuration surfaces remain
   so generated documentation can identify that the Dockerfile value is not consumed
   by this code.
3. **Shipping tracing is a stub.** `initTracing()` contains only a TODO and no
   OpenTelemetry code, so shipping has no tracing integration row. Checkout's actual
   OTLP wiring (`EXT3-074`) remains.
4. **The informational cart `GET /` is normal.** It is externally reachable but
   returns static text and has no data or security consequence, so `EXT3-005` remains
   `normal`.
5. **Conditionally required configuration is normal.** Checkout's six downstream
   addresses remain critical because startup unconditionally calls `mustMapEnv` for
   them. `COLLECTOR_SERVICE_ADDR` and the AlloyDB-only settings remain normal because
   they are required only when their feature/backend branch is selected.
6. **EmptyCart operations remain critical.** Redis overwrites with an empty cart;
   Spanner and AlloyDB delete rows. Checkout also discards the error returned by its
   EmptyCart helper after successful payment and shipping.
7. **Money invariants remain business-rule evidence.** They constrain valid monetary
   calculations, but are explicitly labeled validation invariants rather than
   customer-facing policy.
8. **Interpolated AlloyDB SQL remains a review risk, not a new gold row.** The code
   interpolates `userId`, `productId`, and the table name, unlike Spanner's
   parameterized queries. No available gold category cleanly represents a
   vulnerability pattern, so the issue remains in this note and the existing AlloyDB
   side-effect evidence (`EXT3-038`, `EXT3-039`).

### Related-row distinction

`EXT3-069` records the CartService `EmptyCart` RPC call as an external side effect.
`EXT3-085` records the separate business risk that checkout ignores the helper's
error. They concern one execution path but measure different documented surfaces and
must not be treated as duplicate gold.

## Files that could not be read

None. Every file under the three included service directories, except the explicitly
excluded generated `genproto/` directories, was opened successfully during the
source-only annotation pass.

## Freeze status

`human_review_pending`. The corrected 101-row draft is preserved as
`gold-surfaces.jsonl`, but it is **not frozen or approved**. It must not be used for
extractor or Mode A execution until an independent human approves it from source and
its SHA-256 is recorded in `gold-digest.txt`.
