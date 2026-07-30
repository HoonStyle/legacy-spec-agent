# TESTCASES.md — Online Boutique: cartservice, checkoutservice, shippingservice

Analyzed source commit: 9a4616e77f0f9cbcbecaf27d711c38890dda1404
Generated at: 2026-07-30 (Mode A standard, actor writer-ext3)
Coverage: `src/cartservice/**`, `src/checkoutservice/**` (excluding `genproto/**`), `src/shippingservice/**` (excluding `genproto/**`). No truncation.

## Existing automated tests

#### TC-CARTSERVICETESTS-FILE
cartservice's xUnit test file. Category: existing automated test file. Execution: `dotnet test` against `cartservice.tests.csproj`. `CLM-115`: `src/cartservice/tests/CartServiceTests.cs:1`

#### TC-CARTSERVICETESTS-GETITEM
Given a fresh test host with no prior `AddItem` call, When `GetCart` is called, Then an empty `Cart` is returned. Related: `BR-CART-EMPTY-RETURNS-NEW`, `API-CART-GETCART`. Inputs: a new random user ID. Expected result: `Assert.Equal(new Cart(), cart)`. Side effects: none. Execution command: `dotnet test`. Required environment: an in-process `TestServer` host, no external store. Status: existing, passing at the analyzed commit (not re-executed by this workflow). `CLM-116`: `src/cartservice/tests/CartServiceTests.cs:42`

#### TC-CARTSERVICETESTS-ADDITEM-UPDATE
Given a cart with one item already added, When `AddItem` is called again with the same product, Then the cart still has a single line item whose quantity has doubled. Related: `BR-CART-QUANTITY-MERGE`, `API-CART-ADDITEM`. Inputs: two sequential `AddItemRequest` calls with quantity 1 each for product `"1"`. Expected result: `cart.Items[0].Quantity == 2`. Side effects: cart cleanup via `EmptyCart` at test end. Execution command: `dotnet test`. Status: existing, passing at the analyzed commit. `CLM-117`: `src/cartservice/tests/CartServiceTests.cs:71`

#### TC-CARTSERVICETESTS-ADDITEM-NEW
Given an empty cart, When a new product is added and the cart is then emptied, Then the cart contains one item after the add and zero items after the empty. Related: `API-CART-ADDITEM`, `API-CART-EMPTYCART`. Expected result: `Assert.Single(cart.Items)` then `Assert.Empty(cart.Items)`. Execution command: `dotnet test`. Status: existing, passing at the analyzed commit. `CLM-118`: `src/cartservice/tests/CartServiceTests.cs:117`

#### TC-MONEY-ISVALID
Table-driven Go test of `IsValid` across matching/mismatching unit-nanos sign combinations and overflow cases. Related: `BR-MONEY-SIGN-MATCH`, `BR-MONEY-NANOS-RANGE`. Execution command: `go test ./money/...`. Status: existing, passing at the analyzed commit. `CLM-119`: `src/checkoutservice/money/money_test.go:28`

#### TC-MONEY-SUM
Table-driven Go test of `Sum` covering zero sums, currency-code mismatches, invalid inputs, and carry/borrow arithmetic across sign combinations. Related: `BR-MONEY-SUM-CURRENCY`, `DM-MONEYTEST-ARGS-3`. Execution command: `go test ./money/...`. Status: existing, passing at the analyzed commit. `CLM-120`: `src/checkoutservice/money/money_test.go:202`

#### TC-SHIPPING-GETQUOTE
Go test asserting a non-empty cart yields a quote of exactly $8.99. Related: `API-SHIPPING-GETQUOTE`, `BR-SHIPPING-QUOTE-FLAT-RATE`. Execution command: `go test ./...`. Status: existing, passing at the analyzed commit. `CLM-121`: `src/shippingservice/shippingservice_test.go:27`

#### TC-SHIPPING-SHIPORDER
Go test asserting `ShipOrder` returns an 18-character tracking ID for a non-empty cart. Related: `API-SHIPPING-SHIPORDER`. Execution command: `go test ./...`. Status: existing, passing at the analyzed commit. `CLM-122`: `src/shippingservice/shippingservice_test.go:83`

#### TC-SHIPPING-TRACKINGID-FORMAT
Go test asserting 20 generated tracking IDs all match the pattern `^[A-Z]{2}-\d+-\d+$`. Execution command: `go test ./...`. Status: existing, passing at the analyzed commit. `CLM-123`: `src/shippingservice/shippingservice_test.go:116`

## Source-derived characterization scenarios

#### TC-CART-MERGE-QUANTITY-SCENARIO
Given a cart already containing product P with quantity 1, When `AddItemAsync(userId, P, 3)` runs against `RedisCartStore`, Then the stored cart has one line for P with quantity 4 (not two lines). This scenario is derived from the store's merge branch; it has not been additionally executed by this workflow beyond the existing `TC-CARTSERVICETESTS-ADDITEM-UPDATE` coverage above. Related: `BR-CART-QUANTITY-MERGE`. `CLM-124`: `src/cartservice/src/cartstore/RedisCartStore.cs:50-58`

#### TC-CHECKOUT-PLACEORDER-HAPPYPATH
Given a valid user cart, address, currency and credit card, When `PlaceOrder` runs, Then it returns an `OrderResult` with a new order ID, the shipping tracking ID from shippingservice, the localized shipping cost, and the priced items — charging the card before shipping and clearing the cart afterward. Related: `BR-CHECKOUT-CHARGE-THEN-SHIP`, `BR-CHECKOUT-CART-CLEAR-BEST-EFFORT`, `API-CHECKOUT-PLACEORDER`. This scenario is derived from reading the method; it is not asserted to already execute as an automated test in this scope (no `checkoutservice` Go test file exists in scope beyond `money_test.go`). `CLM-125`: `src/checkoutservice/main.go:230`

#### TC-SHIPPING-QUOTE-ZERO-ITEMS
Given zero cart items, When `GetQuote` runs, Then the returned quote is $0.00 rather than the flat $8.99 rate. Related: `BR-SHIPPING-QUOTE-FLAT-RATE`. This scenario is also covered by the existing `TestGetQuoteEmptyCart` test, but is listed here as a characterization of the underlying branch rather than a re-assertion that the test currently passes. `CLM-126`: `src/shippingservice/quote.go:35-36`

## External-contract test candidates

- **TC-CHECKOUT-CHARGE-DECLINED**: a scenario exercising `PlaceOrder` when the payment service declines or errors on `Charge` cannot be verified from this scope because the payment service's contract and behavior are external (`UV-PAYMENT-CONTRACT` in `INTERFACES.md`). Not presented as a verified test.
- **TC-CHECKOUT-EMAIL-FAILURE-NONFATAL**: a scenario exercising `PlaceOrder` when `SendOrderConfirmation` fails depends on the external email service's contract (`UV-EMAIL-CONTRACT`); the code-level best-effort handling is documented as `BR-CHECKOUT-EMAIL-BEST-EFFORT` in `SPEC.md`, but the downstream failure mode itself is unverified here.
- **TC-CHECKOUT-PRODUCT-NOT-FOUND**: a scenario exercising `PlaceOrder` when the product catalog service cannot find a requested product depends on that external service's error contract (`UV-PRODUCTCATALOG-CONTRACT`); not presented as a verified test.
