# INTERFACES.md — Online Boutique: cartservice, checkoutservice, shippingservice

Analyzed source commit: 9a4616e77f0f9cbcbecaf27d711c38890dda1404
Generated at: 2026-07-30 (Mode A standard, actor writer-ext3)
Coverage: `src/cartservice/**`, `src/checkoutservice/**` (excluding `genproto/**`), `src/shippingservice/**` (excluding `genproto/**`). No truncation.

## Interfaces

### cartservice (C#/.NET, gRPC over HTTP/2)

#### API-CARTSERVICE
`CartService` is the gRPC service class exposed by cartservice. Caller: any gRPC client (e.g. checkoutservice, frontend). Protocol: gRPC over HTTP/2. Side effects, validation and errors are per-method below. `CLM-060`: `src/cartservice/src/services/CartService.cs:24`

#### API-CART-ADDITEM
Signature: `Task<Empty> AddItem(AddItemRequest request, ServerCallContext context)`. Request: `{user_id, item{product_id, quantity}}`. Response: `Empty`. Side effect: `BR-CART-QUANTITY-MERGE`. Errors: `FailedPrecondition` on storage failure. Idempotency: not idempotent (repeated calls increment quantity further). Timeout/cancellation: none set explicitly by this method; inherits the gRPC call's deadline. `CLM-061`: `src/cartservice/src/services/CartService.cs:34`

#### API-CART-GETCART
Signature: `Task<Cart> GetCart(GetCartRequest request, ServerCallContext context)`. Request: `{user_id}`. Response: `Cart{user_id, items[]}`, empty when absent (`BR-CART-EMPTY-RETURNS-NEW`). Side effects: none (read-only). Errors: `FailedPrecondition` on storage failure. Idempotent. `CLM-062`: `src/cartservice/src/services/CartService.cs:40`

#### API-CART-EMPTYCART
Signature: `Task<Empty> EmptyCart(EmptyCartRequest request, ServerCallContext context)`. Request: `{user_id}`. Response: `Empty`. Side effect: `BR-CART-EMPTYCART-OVERWRITE`. Errors: `FailedPrecondition` on storage failure. Idempotent (repeated calls leave the cart empty). `CLM-063`: `src/cartservice/src/services/CartService.cs:45`

#### API-ICARTSTORE
`ICartStore` is the internal storage contract (`AddItemAsync`, `EmptyCartAsync`, `GetCartAsync`, `Ping`) implemented by the three store backends and consumed by `CartService`/`HealthCheckService`; it is not itself gRPC-exposed. `CLM-064`: `src/cartservice/src/cartstore/ICartStore.cs:19`

#### API-REDISCARTSTORE
`RedisCartStore` implements `ICartStore` over `IDistributedCache` (Redis or, absent a Redis address, an in-memory distributed cache). `CLM-065`: `src/cartservice/src/cartstore/RedisCartStore.cs:24`

#### API-SPANNERCARTSTORE
`SpannerCartStore` implements `ICartStore` over Cloud Spanner using parameterized commands (`RSK-SPANNER-PARAMETERIZED` in `RISKS.md`). `CLM-066`: `src/cartservice/src/cartstore/SpannerCartStore.cs:23`

#### API-ALLOYDBCARTSTORE
`AlloyDBCartStore` implements `ICartStore` over AlloyDB/Postgres using string-interpolated SQL (`RSK-ALLOYDB-SQL-INTERPOLATION` in `RISKS.md`). `CLM-067`: `src/cartservice/src/cartstore/AlloyDBCartStore.cs:25`

#### API-HEALTHCHECK
`HealthCheckService` implements the standard gRPC Health `Check` RPC by delegating to the active store's `Ping()` (`RSK-CART-HEALTHCHECK-WORKS` in `RISKS.md`, a contrast to the two Go services below). `CLM-068`: `src/cartservice/src/services/HealthCheckService.cs:33`

#### API-STARTUP
`Startup` is cartservice's ASP.NET Core startup class; it is not itself a gRPC endpoint but is the registration point that composes `ICartStore` selection and the `CartService`/`HealthCheckService` gRPC endpoints (see `BR-CARTSTORE-SELECTION` and the System purpose and boundary section in `SPEC.md`). `CLM-134`: `src/cartservice/src/Startup.cs:16`

#### API-CARTSERVICETESTS
`CartServiceTests` is cartservice's xUnit test-host class; it is not a production gRPC endpoint but hosts an in-process `TestServer` used by `TC-CARTSERVICETESTS-GETITEM`, `TC-CARTSERVICETESTS-ADDITEM-UPDATE` and `TC-CARTSERVICETESTS-ADDITEM-NEW` in `TESTCASES.md`. `CLM-135`: `src/cartservice/tests/CartServiceTests.cs:27`

### checkoutservice (Go, gRPC)

#### API-CHECKOUT-PLACEORDER
Signature: `PlaceOrder(ctx, *PlaceOrderRequest) (*PlaceOrderResponse, error)`. Request: user ID, currency, address, credit card, email. Side effects and error mapping: see `SPEC.md` Business rules and Validation and error behavior. Not idempotent (each call places a new order, charges a card and ships). `CLM-069`: `src/checkoutservice/main.go:230`
Response: an `OrderResult` containing the order ID, the shipping tracking ID, the localized shipping cost, the shipping address, and the priced items. `CLM-139`: `src/checkoutservice/main.go:265-271`

#### API-CHECKOUT-HEALTHCHECK
`checkoutService.Check`/`Watch` are defined as gRPC Health methods on the service struct, but the server instead registers a separate stock `health.NewServer()` implementation, so these methods are unreachable (`RSK-CHECKOUT-HEALTH-DEADCODE` in `RISKS.md`). `CLM-070`: `src/checkoutservice/main.go:222`

### shippingservice (Go, gRPC)

#### API-SHIPPING-GETQUOTE
Signature: `GetQuote(ctx, *GetQuoteRequest) (*GetQuoteResponse, error)`. Request: address, cart items. Response: `CostUsd` per `BR-SHIPPING-QUOTE-FLAT-RATE`. Side effects: none. Idempotent. `CLM-071`: `src/shippingservice/main.go:119`

#### API-SHIPPING-SHIPORDER
Signature: `ShipOrder(ctx, *ShipOrderRequest) (*ShipOrderResponse, error)`. Request: address, cart items. Response: a generated `TrackingId`. Side effects: none durable (see `SPEC.md` Persistence and side effects). Not idempotent in output (a new tracking ID is generated per call) though it has no observable side effect. `CLM-072`: `src/shippingservice/main.go:142`

#### API-SHIPPING-HEALTHCHECK
The `server` struct defines its own `Check` method satisfying the gRPC Health interface. `CLM-073`: `src/shippingservice/main.go:110`
That method is never registered as the active Health implementation; a separate stock `health.NewServer()` instance is registered instead (`RSK-SHIPPING-HEALTH-DEADCODE` in `RISKS.md`). `CLM-140`: `src/shippingservice/main.go:93-94`

### Unverified external contracts

- **UV-PRODUCTCATALOG-CONTRACT**: the product catalog service's `GetProduct` request/response contract is owned by an out-of-scope service; only checkoutservice's call site is verified (see Major execution flows in `ARCHITECTURE.md`), not the callee's own behavior or error contract.
- **UV-CURRENCY-CONTRACT**: the currency service's `Convert` contract is owned by an out-of-scope service; only checkoutservice's call site is verified.
- **UV-PAYMENT-CONTRACT**: the payment service's `Charge` contract, including declined-card behavior, is owned by an out-of-scope service; only checkoutservice's call site is verified.
- **UV-EMAIL-CONTRACT**: the email service's `SendOrderConfirmation` contract is owned by an out-of-scope service; only checkoutservice's call site is verified.
