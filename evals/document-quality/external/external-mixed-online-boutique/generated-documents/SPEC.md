# SPEC.md — Online Boutique: cartservice, checkoutservice, shippingservice

Analyzed source commit: 9a4616e77f0f9cbcbecaf27d711c38890dda1404
Generated at: 2026-07-30 (Mode A standard, actor writer-ext3)
Coverage: `src/cartservice/**` (C#/.NET), `src/checkoutservice/**` (Go, excluding `genproto/**`), `src/shippingservice/**` (Go, excluding `genproto/**`), including tests, Dockerfiles, project/solution files, `go.mod`/`go.sum` and `.proto` files in those trees. Excluded: every other Online Boutique service, `src/checkoutservice/genproto/**`, `src/shippingservice/genproto/**`, `bin/`, `obj/`. No truncation of any input in this run.

## System purpose and boundary

This scope covers three backend microservices of Google Cloud's Online Boutique demo. cartservice is an ASP.NET Core/.NET gRPC service that stores and serves a user's shopping cart behind a pluggable storage backend. checkoutservice is a Go gRPC service that orchestrates placing an order by calling cartservice, shippingservice and four other downstream services. shippingservice is a Go gRPC service that produces a shipping cost quote and a synthetic shipment tracking ID. Outside the boundary: the frontend and all other Online Boutique services (product catalog, currency, payment, email, ad, recommendation, load generator), and the generated protobuf bindings (`genproto/`) for these three services.

- `CLM-001`: cartservice's ASP.NET Core pipeline registers exactly two gRPC services and one plaintext informational HTTP GET route as its externally reachable surface. `src/cartservice/src/Startup.cs:72-81`

## Actors and entrypoints

#### BR-ENTRYPOINT-CARTSERVICE
cartservice's process entrypoint is a top-level-statement `Program.cs` that builds and runs the ASP.NET Core host with `Startup`. `CLM-002`: `src/cartservice/src/Program.cs:19`

#### BR-ENTRYPOINT-CHECKOUT
checkoutservice's process entrypoint. `CLM-003`: `src/checkoutservice/main.go:88`

#### BR-ENTRYPOINT-SHIPPING
shippingservice's process entrypoint. `CLM-004`: `src/shippingservice/main.go:56`

- The only actors evidenced in this scope are gRPC callers of these three services (e.g. the frontend or checkoutservice acting as a client) and the outbound gRPC clients checkoutservice itself opens toward six downstream addresses at startup. `CLM-005`: `src/checkoutservice/main.go:118-123`
- No browser session, human login, or authentication/authorization identity is defined anywhere in this scope. Searched: all `.cs` and `.go` files under `src/cartservice/`, `src/checkoutservice/`, `src/shippingservice/` for auth/session/user-identity handling. **Not found.**

## Core use cases

- Add an item to a cart. `CLM-006`: `src/cartservice/src/services/CartService.cs:34-37`
- Retrieve a cart. `CLM-007`: `src/cartservice/src/services/CartService.cs:40-43`
- Empty a cart. `CLM-008`: `src/cartservice/src/services/CartService.cs:45-48`
- Place an order: retrieve the cart, price it, quote shipping, charge the card, ship the order, clear the cart, and email a confirmation. `CLM-009`: `src/checkoutservice/main.go:230`
- Get a shipping cost quote for a set of cart items. `CLM-010`: `src/shippingservice/main.go:119`
- Ship an order and receive a tracking ID. `CLM-011`: `src/shippingservice/main.go:142`

## Business rules

- **BR-CARTSTORE-SELECTION** — the cart storage backend is selected at startup by environment-variable precedence: Redis first, then Spanner, then AlloyDB, else an in-memory-backed Redis store. `CLM-012`: `src/cartservice/src/Startup.cs:34-56`
- **BR-CART-QUANTITY-MERGE** — adding a product already present in the cart increments its stored quantity instead of adding a duplicate line item. `CLM-013`: `src/cartservice/src/cartstore/RedisCartStore.cs:50-58`
- **BR-CART-EMPTY-RETURNS-NEW** — `GetCartAsync` returns a freshly constructed empty cart, never an error, when no cart is cached for the user. `CLM-014`: `src/cartservice/src/cartstore/RedisCartStore.cs:97-98`
- **BR-CART-EMPTYCART-OVERWRITE** — `EmptyCartAsync` clears a cart by overwriting the cache entry with a new empty `Cart` object rather than deleting the key. `CLM-015`: `src/cartservice/src/cartstore/RedisCartStore.cs:74-75`
- **BR-SPANNER-DEFAULT-INSTANCE** — when `SPANNER_INSTANCE`/`SPANNER_DATABASE` are unset, the Spanner store defaults to instance `onlineboutique` and database `carts`. `CLM-016`: `src/cartservice/src/cartstore/SpannerCartStore.cs:43-46`
- **BR-MONEY-SIGN-MATCH** — a `Money` value is valid only if `nanos` is zero, `units` is zero, or both share the same sign. `CLM-017`: `src/checkoutservice/money/money.go:39-40`
- **BR-MONEY-NANOS-RANGE** — `validNanos` enforces that `nanos` falls within the `nanosMin`/`nanosMax` bounds. `CLM-018`: `src/checkoutservice/money/money.go:43`
- **BR-MONEY-NANOS-BOUNDS-VALUE** — those bounds are fixed at -999999999 and 999999999, with a modulus of 1000000000. `CLM-019`: `src/checkoutservice/money/money.go:24-26`
- **BR-MONEY-SUM-CURRENCY** — `Sum` refuses to add two `Money` values whose currency codes differ, returning `ErrMismatchingCurrency`. `CLM-020`: `src/checkoutservice/money/money.go:96-97`
- **BR-CHECKOUT-CHARGE-THEN-SHIP** — `PlaceOrder` charges the card before requesting shipment. `CLM-021`: `src/checkoutservice/main.go:252-258`
- **BR-CHECKOUT-CART-CLEAR-BEST-EFFORT** — the cart is emptied after payment and shipment succeed, and the call's returned error is explicitly discarded, so a cart-clear failure never fails the order. `CLM-022`: `src/checkoutservice/main.go:263`
- **BR-CHECKOUT-EMAIL-BEST-EFFORT** — a failed order-confirmation email is logged but does not fail `PlaceOrder`. `CLM-023`: `src/checkoutservice/main.go:273-277`
- **BR-SHIPPING-QUOTE-FLAT-RATE** — a shipping quote is $0.00 for zero items and a flat $8.99 for any non-zero item count, regardless of item weight, size or destination. `CLM-024`: `src/shippingservice/quote.go:34-39`

## Validation and error behavior

- RedisCartStore translates any storage exception into a gRPC `RpcException` with `StatusCode.FailedPrecondition`. `CLM-025`: `src/cartservice/src/cartstore/RedisCartStore.cs:62-65`
- SpannerCartStore's `AddItemAsync` maps a storage exception to the same `RpcException`/`FailedPrecondition` pattern. `CLM-136`: `src/cartservice/src/cartstore/SpannerCartStore.cs:99-100`
- AlloyDBCartStore's `AddItemAsync` maps a storage exception to the same `RpcException`/`FailedPrecondition` pattern. `CLM-137`: `src/cartservice/src/cartstore/AlloyDBCartStore.cs:98-99`
- checkoutservice maps a cart/order-preparation failure to `codes.Internal`. `CLM-026`: `src/checkoutservice/main.go:239-241`
- checkoutservice maps a shipping-quote/ship failure to `codes.Unavailable`. `CLM-027`: `src/checkoutservice/main.go:259-261`
- `mustMapEnv` panics at startup if a required downstream-address environment variable is empty, so checkoutservice fails fast rather than starting half-configured. `CLM-028`: `src/checkoutservice/main.go:203-206`
- checkoutservice's `Watch` health RPC explicitly returns `codes.Unimplemented` rather than streaming a status. `CLM-029`: `src/checkoutservice/main.go:227`

## State transitions

- Empty → (`AddItem`) → non-empty / updated quantity. `CLM-030`: `src/cartservice/src/services/CartService.cs:34-37`
- Non-empty → (`EmptyCart`) → empty. `CLM-031`: `src/cartservice/src/services/CartService.cs:45-48`
- Non-empty → (checkoutservice's `emptyUserCart`, invoked after a successful order) → empty, best-effort. `CLM-032`: `src/checkoutservice/main.go:263`

## Configuration

Configuration in this scope is dominated by environment variables read once at process startup; the full per-variable inventory with defaults and effects is recorded in `DATA_MODEL.md` under the `DM-ENV-*` items, and cart-store backend selection is BR-CARTSTORE-SELECTION above. Related: DM-ENV-REDIS-ADDR, DM-ENV-SPANNER-PROJECT, DM-ENV-ALLOYDB-PRIMARY-IP, DM-ENV-PORT-CHECKOUT-A, DM-ENV-ENABLE-TRACING, DM-ENV-ENABLE-PROFILER, DM-ENV-DISABLE-TRACING, DM-ENV-DISABLE-PROFILER, DM-ENV-DISABLE-STATS, DM-ENV-SHIPPING-PORT, BR-CARTSTORE-SELECTION.

## Persistence and side effects

- Redis: a cart is serialized to protobuf bytes and written to the distributed cache under the user ID key. `CLM-033`: `src/cartservice/src/cartstore/RedisCartStore.cs:60`
- Spanner: an insert-or-update into the `CartItems` table via a parameterized command inside a retriable transaction. `CLM-034`: `src/cartservice/src/cartstore/SpannerCartStore.cs:60-89`
- AlloyDB: an insert-or-update into a configurable table via a raw, string-interpolated SQL command (see `RSK-ALLOYDB-SQL-INTERPOLATION` in `RISKS.md`). `CLM-035`: `src/cartservice/src/cartstore/AlloyDBCartStore.cs:81-88`
- checkoutservice: an outbound payment-charge call. `CLM-036`: `src/checkoutservice/main.go:252`
- checkoutservice: an outbound shipment call. `CLM-037`: `src/checkoutservice/main.go:258`
- checkoutservice: an outbound order-confirmation email call. `CLM-038`: `src/checkoutservice/main.go:273`
- shippingservice: no durable persistence anywhere in scope; `ShipOrder` only computes a synthetic, non-persisted tracking ID. `CLM-039`: `src/shippingservice/tracker.go:23-31`

## Operational behavior

- cartservice logs which store branch it selected at startup (e.g. the in-memory fallback path). `CLM-040`: `src/cartservice/src/Startup.cs:53`
- checkoutservice toggles OpenTelemetry tracing and Stackdriver profiling independently via `ENABLE_TRACING`/`ENABLE_PROFILER`. `CLM-041`: `src/checkoutservice/main.go:90-103`
- checkoutservice retries Stackdriver profiler initialization up to three times with growing backoff before giving up. `CLM-042`: `src/checkoutservice/main.go:183-197`
- shippingservice registers gRPC server reflection unconditionally. `CLM-043`: `src/shippingservice/main.go:98`
- checkoutservice registers the stock `health.NewServer()` implementation as its gRPC Health service. `CLM-044`: `src/checkoutservice/main.go:143-144`
- shippingservice also registers the stock `health.NewServer()` implementation as its gRPC Health service. `CLM-138`: `src/shippingservice/main.go:93-94`

## Known limitations

- This document reflects syntax-level, per-file reading; it is not a compiler-resolved call graph — see `ARCHITECTURE.md`'s Module dependency and Analysis limitations sections.
- checkoutservice and shippingservice each also define `Check`/`Watch` methods on their own service struct that are never registered as the active gRPC Health implementation — see `RSK-CHECKOUT-HEALTH-DEADCODE` and `RSK-SHIPPING-HEALTH-DEADCODE` in `RISKS.md`.
- AlloyDB's cart store builds SQL by string interpolation rather than parameters — see `RSK-ALLOYDB-SQL-INTERPOLATION` in `RISKS.md`.
- checkoutservice's outbound gRPC connections use insecure (non-TLS) transport credentials — see `RSK-INSECURE-GRPC-TRANSPORT` in `RISKS.md`.
- checkoutservice's currency conversion call uses a detached context instead of the caller's — see `RSK-CHECKOUT-CURRENCY-CONTEXT-TODO` in `RISKS.md`.

## Unverified / Needs-review

- **UV-APP-PORT-MISMATCH**: shippingservice's Dockerfile sets a container environment variable whose name does not match the variable the Go entrypoint reads for its listen port at startup. `Dockerfile` is not a citable source under this gate's extension rules, so this inconsistency is recorded here rather than as a verified defect; the citable half of the observation (the Go code reading `PORT`) is documented as `DM-ENV-SHIPPING-PORT` in `DATA_MODEL.md`. Searched: `src/shippingservice/Dockerfile` (present, not citable), `src/shippingservice/main.go` (citable, see DM-ENV-SHIPPING-PORT).
- **UV-CART-PROTO-SCHEMA**: the wire-level field numbers and types of the CartService gRPC contract are declared in `src/cartservice/src/protos/Cart.proto`, whose `.proto` extension is not a citable type under this gate. Only C# usage sites of the generated `Hipstershop.*` types are presented as verified evidence elsewhere in this document set. Searched: `src/cartservice/src/protos/Cart.proto` (51 lines, present, not citable).
- **UV-CHECKOUT-SHIPPING-PROTO-SCHEMA**: no local `.proto` source file for the CheckoutService/ShippingService/Money contracts exists inside the assigned scope; their definitions live in a repository-root `protos/demo.proto` (out of scope) and are compiled into the excluded `genproto/` packages. Only in-scope Go usage of the generated `pb.*` types is presented as verified evidence. Searched: `src/checkoutservice/**`, `src/shippingservice/**` for a local `.proto` file (none found); `src/checkoutservice/genproto/**`, `src/shippingservice/genproto/**` (excluded by scope).
- **UV-BUILD-MANIFESTS**: `cartservice.csproj`, `cartservice.sln`, `cartservice.tests.csproj`, `go.mod` and `go.sum` define dependency and version pins, but none of these extensions are citable under this gate, so package/version claims from them are not presented as verified facts. Searched: `src/cartservice/src/cartservice.csproj`, `src/cartservice/cartservice.sln`, `src/cartservice/tests/cartservice.tests.csproj`, `src/checkoutservice/go.mod`, `src/shippingservice/go.mod` (all present, none citable).
- **UV-DOCKERFILE-RUNTIME**: base images, `EXPOSE` ports, and container `ENV` defaults declared in the three services' Dockerfiles are not citable and are reported for operational awareness in `ONBOARDING.md` rather than as verified spec facts. Searched: `src/cartservice/src/Dockerfile`, `src/checkoutservice/Dockerfile`, `src/shippingservice/Dockerfile` (all present, not citable).
