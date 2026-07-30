# DATA_MODEL.md — Online Boutique: cartservice, checkoutservice, shippingservice

Analyzed source commit: 9a4616e77f0f9cbcbecaf27d711c38890dda1404
Generated at: 2026-07-30 (Mode A standard, actor writer-ext3)
Coverage: `src/cartservice/**`, `src/checkoutservice/**` (excluding `genproto/**`), `src/shippingservice/**` (excluding `genproto/**`). No truncation.

## Data model

### Persistent entities

#### DM-CART-ENTITY
A cart is `{UserId: string, Items: [{ProductId: string, Quantity: int32}]}` as constructed by `RedisCartStore`, from the generated `Hipstershop.Cart`/`Hipstershop.CartItem` types (defined in the excluded/non-citable `Cart.proto`; only the C# construction sites are cited). `CLM-089`: `src/cartservice/src/cartstore/RedisCartStore.cs:43-45`
`SpannerCartStore` constructs the same `{UserId, Items[{ProductId, Quantity}]}` shape when reading a cart back from Spanner. `CLM-142`: `src/cartservice/src/cartstore/SpannerCartStore.cs:125-131`
`AlloyDBCartStore` constructs the same `CartItem` sub-shape (`ProductId`, `Quantity`) when reading a cart back from AlloyDB/Postgres. `CLM-143`: `src/cartservice/src/cartstore/AlloyDBCartStore.cs:119-125`
Lifecycle: created on first `AddItem`, updated by subsequent `AddItem` calls (`BR-CART-QUANTITY-MERGE`), replaced by an empty instance on `EmptyCart`. No cardinality/foreign-key claim is made beyond one cart per `userId` key.

#### DM-SPANNER-CARTITEMS-TABLE
Cloud Spanner persists cart rows in a table named `CartItems` (a compile-time constant, not user input). `CLM-090`: `src/cartservice/src/cartstore/SpannerCartStore.cs:25`

#### DM-ALLOYDB-CARTITEMS-COLUMNS
The AlloyDB/Postgres cart table (name taken from `ALLOYDB_TABLE_NAME`) has at least `userID`, `productID` and `quantity` columns, inferred from the constructed SQL text; field types are not declared in citable source (no committed schema/migration file in scope). `CLM-091`: `src/cartservice/src/cartstore/AlloyDBCartStore.cs:69`

Not found: no separate order, product, or shipment persistent entity is defined anywhere in this scope — checkoutservice and shippingservice hold order/shipment data only in-memory for the duration of a single RPC. Searched: all `.go` files under `src/checkoutservice/`, `src/shippingservice/` for a database/ORM/file-write call. **Not found.**

### Configuration / interface contracts

#### DM-ICARTSTORE-CONTRACT
`ICartStore` is the data-contract abstraction all three cart backends implement (`AddItemAsync`, `EmptyCartAsync`, `GetCartAsync`, `Ping`). `CLM-074`: `src/cartservice/src/cartstore/ICartStore.cs:19`

#### DM-CHECKOUTSERVICE-STRUCT
`checkoutService` is checkoutservice's top-level struct holding the embedded unimplemented server plus per-downstream address/connection field pairs. `CLM-076`: `src/checkoutservice/main.go:66`

#### DM-ORDERPREP
`orderPrep` is an internal, non-persisted struct assembled during `PlaceOrder` holding priced order items, raw cart items and the localized shipping cost. `CLM-075`: `src/checkoutservice/main.go:282`

#### DM-SHIPPING-SERVER
`server` is shippingservice's struct implementing the ShippingService and Health RPCs; it embeds `UnimplementedShippingServiceServer` and carries no other fields. `CLM-084`: `src/shippingservice/main.go:105`

#### DM-QUOTE
`Quote{Dollars uint32, Cents uint32}` is the in-memory shipping-cost value type produced by `CreateQuoteFromCount`/`CreateQuoteFromFloat` (`BR-SHIPPING-QUOTE-FLAT-RATE`). `CLM-088`: `src/shippingservice/quote.go:23`

#### DM-MONEY-CONST
The `money` package's validity bounds are `nanosMin = -999999999`, `nanosMax = 999999999`, `nanosMod = 1000000000` (`BR-MONEY-NANOS-RANGE` in `SPEC.md`). `CLM-110`: `src/checkoutservice/money/money.go:24-26`

#### DM-MONEYTEST-ARGS-1
An anonymous `args{l, r pb.Money}` struct type used as the table-driven input for `TestAreSameCurrency`. `CLM-081`: `src/checkoutservice/money/money_test.go:116`

#### DM-MONEYTEST-ARGS-2
A second, separately declared anonymous `args{l, r pb.Money}` struct type used as the table-driven input for `TestAreEquals`. `CLM-082`: `src/checkoutservice/money/money_test.go:141`

#### DM-MONEYTEST-ARGS-3
A third, separately declared anonymous `args{l, r pb.Money}` struct type used as the table-driven input for `TestSum`. `CLM-083`: `src/checkoutservice/money/money_test.go:203`

#### DM-ENV-PORT-CHECKOUT-A
checkoutservice reads the `PORT` environment variable to override its default gRPC listen port `5050`. `CLM-077`: `src/checkoutservice/main.go:106`

#### DM-ENV-PORT-CHECKOUT-B
The overriding assignment of `PORT`'s value into the local `port` variable, immediately following the check above. `CLM-078`: `src/checkoutservice/main.go:107`

#### DM-ENV-ENABLE-TRACING
`ENABLE_TRACING=1` turns on OpenTelemetry tracing in checkoutservice (`SPEC.md` Operational behavior). Default: disabled. `CLM-079`: `src/checkoutservice/main.go:90`

#### DM-ENV-ENABLE-PROFILER
`ENABLE_PROFILER=1` turns on Stackdriver profiling in checkoutservice. Default: disabled. `CLM-080`: `src/checkoutservice/main.go:98`

#### DM-ENV-REDIS-ADDR
`REDIS_ADDR` selects the Redis cart store when non-empty (`BR-CARTSTORE-SELECTION`). `CLM-092`: `src/cartservice/src/Startup.cs:29`

#### DM-ENV-SPANNER-PROJECT
`SPANNER_PROJECT` (with `SPANNER_CONNECTION_STRING`) selects the Spanner cart store when Redis is not configured. `CLM-093`: `src/cartservice/src/Startup.cs:30`

#### DM-ENV-SPANNER-CONNECTION-STRING
`SPANNER_CONNECTION_STRING`, when set, is used directly as the Spanner data source, bypassing project/instance/database composition. `CLM-094`: `src/cartservice/src/Startup.cs:31`

#### DM-ENV-ALLOYDB-PRIMARY-IP
`ALLOYDB_PRIMARY_IP` selects the AlloyDB cart store as the last configured fallback before the in-memory default. `CLM-095`: `src/cartservice/src/Startup.cs:32`

#### DM-ENV-SPANNER-INSTANCE
`SPANNER_INSTANCE`, defaulting to `onlineboutique` when unset (`BR-SPANNER-DEFAULT-INSTANCE`). `CLM-096`: `src/cartservice/src/cartstore/SpannerCartStore.cs:33`

#### DM-ENV-SPANNER-DATABASE
`SPANNER_DATABASE`, defaulting to `carts` when unset (`BR-SPANNER-DEFAULT-INSTANCE`). `CLM-097`: `src/cartservice/src/cartstore/SpannerCartStore.cs:34`

#### DM-ENV-PROJECT-ID
`PROJECT_ID`, used to build the AlloyDB store's Secret Manager secret version name. `CLM-098`: `src/cartservice/src/cartstore/AlloyDBCartStore.cs:34`

#### DM-ENV-ALLOYDB-SECRET-NAME
`ALLOYDB_SECRET_NAME`, the Secret Manager secret ID holding the AlloyDB password. `CLM-099`: `src/cartservice/src/cartstore/AlloyDBCartStore.cs:35`

#### DM-ENV-ALLOYDB-DATABASE-NAME
`ALLOYDB_DATABASE_NAME`, the target database name in the AlloyDB connection string. `CLM-100`: `src/cartservice/src/cartstore/AlloyDBCartStore.cs:45`

#### DM-ENV-ALLOYDB-TABLE-NAME
`ALLOYDB_TABLE_NAME`, the configurable cart table name used by all AlloyDB queries (`DM-ALLOYDB-CARTITEMS-COLUMNS`). `CLM-101`: `src/cartservice/src/cartstore/AlloyDBCartStore.cs:58`

#### DM-ENV-SHIPPING-SVC-ADDR
`SHIPPING_SERVICE_ADDR`, required at checkoutservice startup (`mustMapEnv` panics if empty). `CLM-102`: `src/checkoutservice/main.go:111`

#### DM-ENV-PRODUCT-CATALOG-SVC-ADDR
`PRODUCT_CATALOG_SERVICE_ADDR`, required at checkoutservice startup. `CLM-103`: `src/checkoutservice/main.go:112`

#### DM-ENV-CART-SVC-ADDR
`CART_SERVICE_ADDR`, required at checkoutservice startup. `CLM-104`: `src/checkoutservice/main.go:113`

#### DM-ENV-CURRENCY-SVC-ADDR
`CURRENCY_SERVICE_ADDR`, required at checkoutservice startup. `CLM-105`: `src/checkoutservice/main.go:114`

#### DM-ENV-EMAIL-SVC-ADDR
`EMAIL_SERVICE_ADDR`, required at checkoutservice startup. `CLM-106`: `src/checkoutservice/main.go:115`

#### DM-ENV-PAYMENT-SVC-ADDR
`PAYMENT_SERVICE_ADDR`, required at checkoutservice startup. `CLM-107`: `src/checkoutservice/main.go:116`

#### DM-ENV-COLLECTOR-SVC-ADDR
`COLLECTOR_SERVICE_ADDR`, required only when `ENABLE_TRACING=1`, addressing the OpenTelemetry collector. `CLM-108`: `src/checkoutservice/main.go:164`

#### DM-ENV-DISABLE-TRACING
shippingservice enables a tracing initializer unless `DISABLE_TRACING` is set to any non-empty value. `CLM-085`: `src/shippingservice/main.go:57`
That initializer's body is currently a no-op (a `TODO` placeholder). `CLM-141`: `src/shippingservice/main.go:159-161`

#### DM-ENV-DISABLE-PROFILER
shippingservice enables Stackdriver profiling unless `DISABLE_PROFILER` is set to any non-empty value. `CLM-086`: `src/shippingservice/main.go:65`

#### DM-ENV-DISABLE-STATS
shippingservice reads `DISABLE_STATS` to decide which branch constructs its gRPC server. `CLM-087`: `src/shippingservice/main.go:84`
Both branches currently construct the server identically. `CLM-146`: `src/shippingservice/main.go:84-90`

#### DM-ENV-SHIPPING-PORT
shippingservice reads `PORT` (not `APP_PORT`) to override its default listen port `50051` (see `UV-APP-PORT-MISMATCH` in `SPEC.md`). `CLM-109`: `src/shippingservice/main.go:73`
