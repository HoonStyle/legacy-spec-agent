# Gold review notes — external-mixed-online-boutique

Authored independently from source only, under
`.external-sources/microservices-demo/src/{cartservice,checkoutservice,shippingservice}/`.
No connector/extractor output, no other case's gold, and no generated document was
consulted while authoring these annotations. `evals/document-quality/external/external-mixed-online-boutique/case-manifest.json`
already existed in the target directory when this session started; it was not opened
(the independence rule for this task forbids reading anything under `evals/`, including
sibling files in this case's own output directory).

## Per-service inventory

### cartservice (C#, ASP.NET Core, gRPC) — 48 gold rows
A gRPC service that stores/retrieves a per-user shopping cart. `Program.cs` boots an
ASP.NET Core host running `Startup`, which picks one of three `ICartStore`
implementations (`RedisCartStore`, `SpannerCartStore`, `AlloyDBCartStore`) based on
which connection environment variables are set, and maps two gRPC services
(`CartService`, `HealthCheckService`) plus one trivial HTTP GET. All 9 in-scope
C# files were read and annotated: `Program.cs`, `Startup.cs`, `appsettings.json`,
`cartservice.csproj`, `cartstore/ICartStore.cs`, `cartstore/RedisCartStore.cs`,
`cartstore/SpannerCartStore.cs`, `cartstore/AlloyDBCartStore.cs`,
`services/CartService.cs`, `services/HealthCheckService.cs`,
`tests/CartServiceTests.cs`, plus `protos/Cart.proto`, `cartservice.sln`,
`tests/cartservice.tests.csproj`, `Dockerfile`, `Dockerfile.debug`, `.dockerignore`.

### checkoutservice (Go, gRPC) — 40 gold rows
A gRPC service exposing a single `PlaceOrder` RPC that orchestrates the checkout
flow: reads the user's cart from cartservice, prices items via productcatalogservice
and currencyservice, gets a shipping quote and ships via shippingservice, charges
the card via paymentservice, empties the cart, and emails a confirmation via
emailservice. Files read and annotated: `main.go`, `money/money.go`,
`money/money_test.go`, `go.mod`, `go.sum`, `Dockerfile`, `.dockerignore`,
`README.md`, `genproto.sh`. `genproto/*.pb.go` were excluded per scope
(generated protobuf/gRPC code).

### shippingservice (Go, gRPC) — 23 gold rows
A gRPC service with two RPCs: `GetQuote` (a flat-rate shipping cost calculator)
and `ShipOrder` (mocks fulfillment and returns a generated tracking ID). Files
read and annotated: `main.go`, `quote.go`, `tracker.go`, `shippingservice_test.go`,
`go.mod`, `Dockerfile`, `.dockerignore`, `README.md`, `genproto.sh`.
`genproto/*.pb.go` were excluded per scope.

## Absent categories / conceptual absences

- **No HTTP/REST listener in checkoutservice or shippingservice.** Both are
  gRPC-only (`grpc.NewServer`, `net.Listen("tcp", ...)`). Searched `main.go` in
  both services for `net/http`, `http.Handle`, `ListenAndServe` — no matches.
  (cartservice does have one trivial HTTP GET on `/`, annotated as EXT3-005.)
- **No environment variables read by startup shell scripts.** The only `.sh`
  files in scope are `checkoutservice/genproto.sh` and `shippingservice/genproto.sh`,
  which are protoc code-generation helpers invoked manually by a developer, not
  scripts the running service or container executes at startup. They reference
  only local shell variables (`protodir`, `outdir`) and `$(go env GOPATH)`, not
  service configuration. Searched for `os.Getenv`/`ENV` patterns in `*.sh` — none
  found beyond `PATH=$PATH:...`.
- **No secrets or credentials hard-coded in source** for any of the three
  services. Searched for literal password/API-key/token strings — none found.
  (`AlloyDBCartStore.cs` does hard-code the connecting *username* `"postgres"` at
  line 44 with a `// TODO: Create a separate user` comment; this is a superuser
  credential-scoping risk, not a hard-coded secret, and is not gold-worthy on its
  own since it names no secret value — flagged below as a review judgment call
  instead.)
- **No C# solution-level or namespace-resolution complexity to document.**
  `cartservice.sln` references exactly two projects (`cartservice`,
  `cartservice.tests`) with a normal `ProjectReference`; there are no additional
  namespaces, aliased `using`s, or cross-project graphs worth a data-contract row.
- **No unit tests for checkoutservice's `main` package or cartservice's
  cartstore implementations.** `checkoutservice` only has `money/money_test.go`;
  there is no `main_test.go` exercising `PlaceOrder` or the downstream-call
  helpers. `cartservice/tests/CartServiceTests.cs` is an integration-style test
  against the whole ASP.NET `TestServer` (exercises `RedisCartStore` transitively
  through the in-memory-cache fallback) — there are no unit tests that directly
  target `SpannerCartStore` or `AlloyDBCartStore`. This is a gap in the
  **source's own test coverage**, not a gold-annotation omission; it is recorded
  here for the human reviewer's awareness, not as a missing category.
- **Wire-message data contracts for checkoutservice/shippingservice are out of
  the frozen scope.** `pb.Money`, `pb.Address`, `pb.CartItem`, `pb.OrderResult`,
  `pb.ChargeRequest`, etc. are declared in `src/protos/demo.proto`, which sits
  outside the three included service directories (it is a sibling of
  `cartservice/`, `checkoutservice/`, `shippingservice/` under `src/`, not
  included by the scope's include list, and distinct from the excluded
  `genproto/` generated-code directories). Because I can only cite in-scope
  source, I did **not** create `data_contract` rows for those message types —
  the *implementing* domain structs I could ground in scope
  (`checkoutService`, `orderPrep`, shipping's `server`, `Quote`) are annotated
  instead. cartservice's own `Cart.proto` **is** in scope (it lives at
  `cartservice/src/protos/Cart.proto`), so its five messages are fully annotated.

## Judgment calls most needing human review

1. **checkoutservice's and shippingservice's custom health-check methods
   (`cs.Check`/`cs.Watch` in checkoutservice, `server.Check`/`server.Watch` in
   shippingservice) are almost certainly dead code, not reachable RPC
   endpoints.** Both services register the *stock* `google.golang.org/grpc/health`
   package's server object (`healthcheck := health.NewServer(); healthpb.RegisterHealthServer(srv, healthcheck)`)
   as the actual Health service, not the struct that also happens to implement
   `Check`/`Watch`. I deliberately did **not** create `registered_api` rows for
   `checkoutService.Check`/`Watch` or `server.Check`/`Watch` — only for the
   `RegisterHealthServer` call itself (EXT3-050, EXT3-091) and the `SERVING`
   status literal each defines (EXT3-066, EXT3-102, marked `normal` rather than
   `critical` specifically because of this reachability doubt). By contrast,
   cartservice's `HealthCheckService` **is** genuinely wired
   (`endpoints.MapGrpcService<HealthCheckService>()` in `Startup.cs:75`), so its
   `Check` method (EXT3-004) is marked `critical` without qualification. A
   reviewer should double-check this dead-code reading of the Go services
   against the actual gRPC health package semantics.
2. **shippingservice's `Dockerfile` sets `APP_PORT=50051`, but the Go code reads
   `PORT`, not `APP_PORT`** (`main.go:73`, `os.LookupEnv("PORT")`). I annotated
   both as separate `environment` rows (EXT3-096, EXT3-098) rather than treating
   `APP_PORT` as a typo/no-op, since it is genuinely present in source, but a
   reviewer should confirm this is a real container/code mismatch worth flagging
   in the eventual generated documentation rather than an oversight in my
   reading.
3. **shippingservice's tracing is an unimplemented stub, not a real
   integration.** `main.go`'s `initTracing()` body is only
   `// TODO(arbrown) Implement OpenTelemetry tracing` with no code, and there is
   no `go.opentelemetry.io` import anywhere in `shippingservice/main.go` (the
   `go.opentelemetry.io/*` entries in `shippingservice/go.mod` are transitive/
   indirect only). I therefore did **not** create an `external_integration` row
   for OpenTelemetry in shippingservice, even though `checkoutservice` genuinely
   wires `otlptracegrpc` + `otelgrpc` stats handlers (EXT3-074). This
   service-by-service asymmetry (present in checkout, absent/stubbed in
   shipping, entirely absent in cart) is worth a reviewer's explicit sign-off
   since it's easy for a generated document to over-generalize "the platform
   uses OpenTelemetry" from the checkout evidence alone.
4. **Health-check endpoint importance.** I marked all `registered_api` rows for
   externally-reachable RPC/HTTP endpoints `critical`, including trivial ones,
   per the stated rule — except I deliberately marked cartservice's static
   informational `GET /` (EXT3-005) `normal` rather than `critical`, since it
   returns static text with no data or security implication. A reviewer should
   confirm this one exception is acceptable rather than mechanical rule
   application.
5. **Required vs. optional environment variables.** I marked `critical` only
   the checkoutservice downstream-address variables that use `mustMapEnv` and
   therefore `panic` unconditionally if unset
   (`SHIPPING_SERVICE_ADDR`, `PRODUCT_CATALOG_SERVICE_ADDR`, `CART_SERVICE_ADDR`,
   `CURRENCY_SERVICE_ADDR`, `EMAIL_SERVICE_ADDR`, `PAYMENT_SERVICE_ADDR`).
   `COLLECTOR_SERVICE_ADDR` also uses `mustMapEnv` inside `initTracing()`, but
   that function is only invoked when `ENABLE_TRACING=1`, so I marked it
   `normal` (conditionally required). Similarly, cartservice's AlloyDB-specific
   variables (`PROJECT_ID`, `ALLOYDB_SECRET_NAME`, `ALLOYDB_DATABASE_NAME`,
   `ALLOYDB_TABLE_NAME`) have no internal fallback but are only read if the
   AlloyDB backend is selected via `ALLOYDB_PRIMARY_IP`; I marked these
   `normal` rather than `critical` for the same reason. A reviewer should
   confirm this "conditional requirement is not critical" convention is the
   right call, since these variables are absolutely required *if* their branch
   is taken.
6. **Cart-mutation destructiveness.** I marked the three `EmptyCartAsync`
   backend writes (Redis EXT3-035, Spanner EXT3-037, AlloyDB EXT3-039) and the
   checkoutservice call site that discards `EmptyCart`'s error (EXT3-085/
   EXT3-069) as `critical`, since they permanently delete cart data with no
   application-level undo. `AddItemAsync` writes across all three backends are
   marked `normal`. A reviewer should confirm this critical/normal split
   matches their own risk assessment (e.g., whether silently swallowed
   `EmptyCart` errors after a successful charge deserve `critical` risk
   flagging, which I believe they do, versus being treated as merely a logging
   gap).
7. **`checkoutservice/money/money.go`'s two invariant-checking business rules**
   (currency-code matching in `Sum`, EXT3-087; unit/nanos sign matching in
   `signMatches`, EXT3-088) were included as `business_rule` rows even though
   they read more like defensive validation than product-facing policy. A
   reviewer may prefer to drop these two and keep only the checkout-level
   pricing rules (order total assembly, currency conversion) as `business_rule`
   evidence.
8. **AlloyDB SQL statements use string interpolation of `userId`/`productId`
   directly into `INSERT`/`SELECT`/`DELETE` text** (`AlloyDBCartStore.cs`, e.g.
   lines 69, 81–86, 113, 148) rather than parameterized queries — unlike the
   Spanner store, which does use `SpannerParameterCollection` parameters. This
   is a genuine SQL-injection-shaped code smell worth a reviewer's attention,
   but I did not create a dedicated gold row for it since no coverage category
   in this task's contract (`registered_api` / `data_contract` / `environment` /
   `entrypoint` / `status_value` / `test_file` / `external_side_effect` /
   `external_integration` / `business_rule`) cleanly fits "vulnerability
   pattern"; the two `AlloyDBCartStore` `external_side_effect` rows (EXT3-038,
   EXT3-039) already cite the exact lines a reviewer would need to evaluate
   this.

## Files I could not read

None. Every file listed by `find src/cartservice src/checkoutservice
src/shippingservice -type f` (excluding the two `genproto/` directories) was
successfully opened and read in full.

---

## 통합 검토 반영 (2026-07-30)

`docs/external-gold-review-summary.md`의 사례 3 판정을 초안에 반영했다. 111행에서
10행을 제거하고 3행을 재분류해 **101행**이 되었다. ID는 재번호하지 않았다.

### 제거된 10행

- `EXT3-007`–`EXT3-009` — `RedisCartStore`, `SpannerCartStore`,
  `AlloyDBCartStore`는 persistence 구현체이지 data contract가 아니다.
  `ICartStore`(`EXT3-006`)와 `Cart.proto` message만 contract로 남긴다.
- `EXT3-045`, `EXT3-082`, `EXT3-108` — 세 서비스의 Docker multi-stage build는
  build 도구이며 애플리케이션의 runtime external integration이 아니다. Docker
  entrypoint는 `entrypoint` 카테고리에 그대로 유지된다.
- `EXT3-051` — `checkoutService`는 downstream connection을 보유한 service
  구현체이지 데이터 shape가 아니다.
- `EXT3-092` — shipping의 `server`는 RPC 구현체이지 data contract가 아니다.
- `EXT3-066`, `EXT3-102` — 등록되지 않은 custom health method 안의 `SERVING`은
  도달 불가능한 status다. 실제 등록되는 stock gRPC health server만 남긴다.

### 재분류된 3행

- `EXT3-035` — Redis `EmptyCartAsync`가 key를 **삭제하지 않고 빈 cart를
  직렬화해 덮어쓴다**는 실제 동작을 surface에 기술했다. SQL store의 delete와
  구분된다.
- `EXT3-087`, `EXT3-088` — money 규칙을 product policy가 아니라 **monetary
  validation invariant**로 명시했다.

### 근거를 notes에만 기록한 항목

- `EXT3-069`와 `EXT3-085`의 관계: 전자는 CartService `EmptyCart` RPC를 호출하는
  side effect이고, 후자는 checkout이 그 오류를 무시하고 진행하는 business risk다.
  같은 코드 경로지만 관점이 다르므로 두 행을 유지하되 중복 측정으로 읽지 않는다.
- AlloyDB의 문자열 보간 SQL(`src/cartservice/cartstore/AlloyDBCartStore.cs`)은
  injection 형태의 실제 코드 스멜이다. 적합한 gold category가 없으므로 새 행을
  만들지 않고, 기존 AlloyDB side-effect 근거와 이 risk note에 보존한다. Spanner
  store는 파라미터화 쿼리를 쓴다는 대비도 함께 기록한다.
- shipping `Dockerfile:36`의 `ENV APP_PORT=50051`과 `main.go:73`의
  `os.LookupEnv("PORT")`는 이름이 달라 Dockerfile 값이 적용되지 않는 실제
  불일치다. 두 설정 surface를 모두 유지하고, 생성 문서에서 no-op 가능성을
  경고해야 한다.
- shipping의 tracing 함수는 TODO stub이며 OpenTelemetry import 자체가 없다.
  따라서 shipping에는 tracing integration 행을 만들지 않았고, checkout의 실제
  OTLP wiring만 유지한다.

### 범위 판정 유지

`pb.Money`, `pb.Address` 등 wire message type은 `src/protos/demo.proto`에
선언되어 있고 이 디렉터리는 고정 범위 밖이므로 data contract로 세지 않았다.
범위 안의 도메인 타입(`ICartStore`, `orderPrep`, shipping `Quote`,
cartservice의 `Cart.proto` message)만 계산했다. `genproto/**`는 생성 코드로
제외했다(case-manifest의 `scope_refinement` 참조).

### 상태

`human_review_pending`. 수정본은 저장소 밖에 있으며 승인 전까지 동결하지 않는다.
