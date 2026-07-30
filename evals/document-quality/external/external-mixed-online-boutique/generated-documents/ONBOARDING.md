# ONBOARDING.md — Online Boutique: cartservice, checkoutservice, shippingservice

Analyzed source commit: 9a4616e77f0f9cbcbecaf27d711c38890dda1404
Generated at: 2026-07-30 (Mode A standard, actor writer-ext3)
Coverage: `src/cartservice/**`, `src/checkoutservice/**` (excluding `genproto/**`), `src/shippingservice/**` (excluding `genproto/**`). No truncation.

## Onboarding

**Prerequisites.** cartservice targets a .NET SDK matching `cartservice.csproj`'s target framework; checkoutservice and shippingservice target the Go toolchain version pinned in their respective `go.mod`. `.csproj` and `go.mod` are not citable source under this gate, so exact version numbers are not presented as verified facts here (see `UV-BUILD-MANIFESTS` in `SPEC.md`).

**Dependencies.** NuGet restore for cartservice and `go mod download` for checkoutservice/shippingservice are the standard mechanisms for these ecosystems; no citable in-scope automation script names the exact restore command (see `UV-BUILD-MANIFESTS`).

**Build.** Not found — no citable build script (`.sh`/`.mjs`/`.cjs`) exists in scope; the only build instructions are inside the three services' Dockerfiles, which are not citable. Searched: `src/cartservice/**`, `src/checkoutservice/**`, `src/shippingservice/**` for shell/JS automation. **Not found.**

**Test.**
- cartservice's xUnit suite is exercised through `dotnet test` against a project containing `[Fact]`-attributed tests. `CLM-111`: `src/cartservice/tests/CartServiceTests.cs:41`
- checkoutservice's `money` package is exercised through `go test ./money/...` against table-driven `Test*` functions. `CLM-112`: `src/checkoutservice/money/money_test.go:28`
- shippingservice is exercised through `go test ./...` against its own `Test*` functions. `CLM-113`: `src/shippingservice/shippingservice_test.go:27`

**Run.** Each service's process entrypoint is documented as `BR-ENTRYPOINT-CARTSERVICE`, `BR-ENTRYPOINT-CHECKOUT` and `BR-ENTRYPOINT-SHIPPING` in `SPEC.md`. checkoutservice and shippingservice have in-code default listen ports of `5050` (`DM-ENV-PORT-CHECKOUT-A`) and `50051` (`DM-ENV-SHIPPING-PORT`) respectively, both overridable by `PORT`. cartservice has no in-code port default; its listen port comes only from the non-citable Dockerfile's `ASPNETCORE_HTTP_PORTS` setting. Exact container launch commands are only specified in the non-citable Dockerfiles (`UV-DOCKERFILE-RUNTIME` in `SPEC.md`).

**Configuration.** See `DATA_MODEL.md`'s `DM-ENV-*` items for the full environment-variable inventory required to run each service (cart store selection, downstream service addresses, tracing/profiling toggles).

**Troubleshooting.** If checkoutservice panics at startup with `environment variable "..." not set`, one of its six required downstream `*_SERVICE_ADDR` variables (`DM-ENV-SHIPPING-SVC-ADDR`, `DM-ENV-PRODUCT-CATALOG-SVC-ADDR`, `DM-ENV-CART-SVC-ADDR`, `DM-ENV-CURRENCY-SVC-ADDR`, `DM-ENV-EMAIL-SVC-ADDR`, `DM-ENV-PAYMENT-SVC-ADDR`) is unset. `CLM-114`: `src/checkoutservice/main.go:203-206`
