# RISKS.md — Online Boutique: cartservice, checkoutservice, shippingservice

Analyzed source commit: 9a4616e77f0f9cbcbecaf27d711c38890dda1404
Generated at: 2026-07-30 (Mode A standard, actor writer-ext3)
Coverage: `src/cartservice/**`, `src/checkoutservice/**` (excluding `genproto/**`), `src/shippingservice/**` (excluding `genproto/**`). No truncation.

## Confirmed behavior

#### RSK-CART-HEALTHCHECK-WORKS
cartservice's `HealthCheckService.Check` genuinely delegates to the active store's `Ping()` and reports Serving/NotServing accordingly — it is a working health check, unlike the two Go services' dead-code health methods below. Severity: n/a (positive finding). Confidence: high. Related: `API-HEALTHCHECK`. `CLM-127`: `src/cartservice/src/services/HealthCheckService.cs:33-38`

#### RSK-SPANNER-PARAMETERIZED
`SpannerCartStore`'s lookup query binds `userId`/`productId` as named parameters (`@userId`, `@productId`) rather than interpolating caller-supplied values into the SQL text — the safer pattern, contrasted with `RSK-ALLOYDB-SQL-INTERPOLATION` below. Confidence: high. Related: `API-SPANNERCARTSTORE`. `CLM-128`: `src/cartservice/src/cartstore/SpannerCartStore.cs:63-72`

## Defect candidates

#### RSK-ALLOYDB-SQL-INTERPOLATION
`AlloyDBCartStore` builds its `SELECT`/`INSERT`/`DELETE` statements by directly interpolating the caller-supplied `userId`/`productId` strings into the SQL text, unlike the parameterized Spanner path. Severity: high. Likelihood: unknown (depends on upstream input validation outside this scope; see `UV-ALLOYDB-EXPLOIT-CONFIRMATION` below). Impact: potential SQL injection or data corruption if a caller can supply arbitrary `productId`/`userId` values. Confidence: high (code pattern verified; exploitability not verified). Mitigation: use parameterized commands as `SpannerCartStore` does. Suggested action: replace string interpolation with `NpgsqlParameter` bindings. Owner: unassigned. Status: open. Related: `RSK-SPANNER-PARAMETERIZED`, `API-ALLOYDBCARTSTORE`. `CLM-129`: `src/cartservice/src/cartstore/AlloyDBCartStore.cs:69`

#### RSK-CHECKOUT-HEALTH-DEADCODE
`checkoutService` defines `Check`/`Watch` methods satisfying the gRPC Health interface, but the server registers a separate, freshly constructed `health.NewServer()` instance as the actual Health implementation — the custom methods can never be invoked by a client. Severity: low. Likelihood: certain (structural, not conditional). Impact: any intent to customize checkout-specific health logic is silently ineffective. Confidence: high. Mitigation: register `cs` itself as the Health server, or remove the unused methods. Suggested action: wire `healthpb.RegisterHealthServer(srv, cs)` or delete `Check`/`Watch` from `checkoutService`. Owner: unassigned. Status: open. Related: `API-CHECKOUT-HEALTHCHECK`. `CLM-130`: `src/checkoutservice/main.go:222-224`

#### RSK-SHIPPING-HEALTH-DEADCODE
shippingservice's `server` struct likewise defines `Check`/`Watch` methods satisfying the gRPC Health interface — the same structural pattern as `RSK-CHECKOUT-HEALTH-DEADCODE`. Severity: low. Likelihood: certain. Impact: identical to the checkout case. Confidence: high. Mitigation: same as above. Owner: unassigned. Status: open. Related: `RSK-CHECKOUT-HEALTH-DEADCODE`, `API-SHIPPING-HEALTHCHECK`. `CLM-131`: `src/shippingservice/main.go:110-116`
Those methods are never registered as the active Health implementation; a separate stock `health.NewServer()` instance is registered instead. `CLM-145`: `src/shippingservice/main.go:93-94`

#### RSK-INSECURE-GRPC-TRANSPORT
checkoutservice opens all six outbound gRPC connections (to cartservice, shippingservice, and four external services) with `insecure.NewCredentials()` — no TLS/mTLS at the application layer. Severity: medium. Likelihood: certain (structural). Impact: any network path between checkoutservice and its downstreams that is not otherwise secured (e.g. a service mesh sidecar) carries plaintext gRPC traffic including a `CreditCardInfo` payload en route to the payment service. Confidence: high (code pattern verified; whether an external mesh/mTLS layer compensates is out of scope and unverified). Mitigation: use transport credentials backed by TLS or rely on and document an enforced mesh-level mTLS layer. Owner: unassigned. Status: open. Related: `API-CHECKOUT-PLACEORDER`. `CLM-132`: `src/checkoutservice/main.go:214-216`

#### RSK-CHECKOUT-CURRENCY-CONTEXT-TODO
`convertCurrency` calls the external currency service with `context.TODO()` instead of propagating the incoming request's `ctx`, unlike every other downstream call in `PlaceOrder` (cart, shipping, payment, shipment, email), which all forward `ctx`. Severity: low. Likelihood: certain (structural). Impact: a caller-initiated cancellation or deadline on `PlaceOrder` will not be honored by the currency conversion sub-call, which can then outlive or ignore the parent request's timeout. Confidence: high. Mitigation: pass `ctx` instead of `context.TODO()`. Owner: unassigned. Status: open. Related: `API-CHECKOUT-PLACEORDER`, `UV-CURRENCY-CONTRACT`. `CLM-133`: `src/checkoutservice/main.go:360`

## Unverified gaps

- The shippingservice Dockerfile/`PORT` naming mismatch described as `UV-APP-PORT-MISMATCH` in `SPEC.md` is a configuration-inconsistency candidate rather than a confirmed defect, because the Dockerfile side of the claim is not citable under this gate.
- **UV-ALLOYDB-EXPLOIT-CONFIRMATION**: whether `RSK-ALLOYDB-SQL-INTERPOLATION` is actually exploitable end-to-end depends on input validation performed by callers outside this scope (e.g. an upstream frontend); this analysis can confirm the code pattern but not real-world exploitability. Searched: `src/cartservice/**` for input validation on `userId`/`productId` before they reach `AddItemAsync`. **Not found** within this scope.
- **UV-CHECKOUT-CONTEXT-TODO-IMPACT**: whether `RSK-CHECKOUT-CURRENCY-CONTEXT-TODO` causes an observable production issue (e.g. orphaned calls after client cancellation) cannot be confirmed without the currency service's own server-side behavior, which is out of scope.
