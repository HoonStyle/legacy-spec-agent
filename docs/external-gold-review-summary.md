# 외부 사례 2·3 gold 통합 검토 기록

## 상태와 범위

이 문서는 외부 문서 품질 평가의 사례 2와 사례 3에 대해 전달된
`gold-surfaces.jsonl` 초안과 review notes를 한 곳에 정리한 **검토 기록**이다.
두 JSONL 초안은 대화 입력에서 각각 두 번 반복되었으므로 첫 번째 완전한
사본만 검토 대상으로 간주했다. 이 문서는 수정된 gold 자체나 human approval을
대체하지 않으며, 아래 변경을 원본 gold에 반영하고 별도 사람이 승인하기 전까지
두 사례의 상태는 `human_review_pending`이다.

| 사례 | 저장소 | 검증한 고정 SHA | 최초 행 | 제거 권고 | 수정 후 예상 행 |
| --- | --- | --- | ---: | ---: | ---: |
| `external-py-flask-tutorial` | `pallets/flask` | `36e4a824f340fdee7ed50937ba8e7f6bc7d17f81` | 73 | 16 | 57 |
| `external-mixed-online-boutique` | `GoogleCloudPlatform/microservices-demo` | `9a4616e77f0f9cbcbecaf27d711c38890dda1404` | 111 | 10 | 101 |
| **합계** | | | **184** | **26** | **158** |

ID는 review reference의 안정성을 위해 다시 번호를 매기지 않는다. 제거된 행의
번호는 결번으로 남긴다.

## 공통 판정 원칙

1. 실제 외부 endpoint와 endpoint 등록 근거를 구분한다. Blueprint 생성·등록,
   service implementation type 또는 endpoint alias를 각각 별도 API로 중복
   계상하지 않는다.
2. 직렬화 데이터, persistence schema, 명시적인 row projection처럼 안정적인
   데이터 shape만 `data_contract`로 센다. service/store 구현 class 자체는 data
   contract가 아니다.
3. 일반적인 `if` 조건과 함수 내부 임시 변수를 `status_value`로 세지 않는다.
   인증 상태나 protocol status처럼 문서화할 의미가 있는 상태만 유지한다.
4. 같은 코드가 side effect와 business risk를 함께 나타내면 두 행을 유지할 수
   있지만, 서로 다른 관점임을 notes에 명시하여 중복 측정으로 오해하지 않게 한다.
5. 테스트 fixture의 파일·DB 변경은 production side effect와 구분한다.
6. build 도구와 framework helper를 runtime external integration으로 과장하지
   않는다.
7. 조건부로 필요한 설정은 존재 자체를 gold에 남기되, 해당 branch가 선택될
   때만 필수임을 명시한다.

## 사례 2 — Flask tutorial

### 승인하는 핵심 표면

- 실제 route인 `/hello`, `/auth/register`, `/auth/login`, `/auth/logout`, `/`,
  `/create`, `/<int:id>/update`, `/<int:id>/delete`를 API로 유지한다.
- `user`, `post` schema와 blog index의 post-with-author row projection을 data
  contract로 유지한다.
- `create_app`과 `init-db` CLI command를 entrypoint로 유지한다.
- 익명 사용자 상태(`g.user is None`)와 세션에 사용자 ID가 없는 상태만 의미
  있는 auth status로 유지한다.
- SQLite 변경, session 변경과 instance/test 파일 변경은 side effect로 유지하되
  test-only 행을 명시적으로 표시한다.
- 로그인 필요, 작성자 전용 수정·삭제, 고유 username, 입력 검증, password
  hashing/verification, missing post의 404, session lifecycle을 business rule로
  유지한다.
- template의 로그인 navigation과 작성자 edit link 조건은 UI visibility rule로
  유지할 수 있으나 server-side authorization enforcement로 표현하지 않는다.

### 제거할 행

| ID | 이유 |
| --- | --- |
| `EXT2-002` | `add_url_rule("/", endpoint="index")`는 `GET /`의 새 동작이 아니라 endpoint-name alias다. |
| `EXT2-003`–`EXT2-006` | Blueprint 생성과 등록은 route 연결 근거이지 각각 독립 endpoint가 아니다. |
| `EXT2-023`–`EXT2-026` | request method와 `error is None`은 route/validation 내부 제어 흐름이다. |
| `EXT2-029`–`EXT2-032` | test config, request method와 error 분기는 안정적인 status value가 아니다. |
| `EXT2-033` | `check_author=True`는 status가 아니라 author-only rule의 구성 요소다. |
| `EXT2-034` | missing-post 분기는 `EXT2-068`의 404 business rule과 중복된다. |
| `EXT2-060` | `abort` helper 사용은 독립적인 external integration이 아니다. |

### 수정할 행

- `EXT2-016`: `post_with_author`를 class가 아니라 **blog index row
  projection**이라고 명시한다.
- `EXT2-017`–`EXT2-020`: `SECRET_KEY`, `DATABASE`, `config.py`, `TESTING`은 OS
  environment variable이 아니라 Flask configuration/test configuration이라는
  사실을 surface에 표시한다.
- `EXT2-027`, `EXT2-028`: 조건식 문자열보다 anonymous/session authentication
  state라는 의미를 이름에 담는다.
- `EXT2-050`–`EXT2-052`: temporary DB 생성·삭제·fixture SQL 실행을
  `test-only` side effect로 표시한다.
- `EXT2-061`: decorator 구현과 create/update/delete 세 적용 지점을 notes에
  함께 기록한다.
- `EXT2-062`: `check_author=True`, 403 guard, update/delete 호출을 하나의
  author-only rule 근거로 묶는다.
- `EXT2-072`, `EXT2-073`: UI 표시 조건이며 권한 강제 장치가 아님을 명시한다.

### 사례 2 판단 결론

1. `add_url_rule` alias는 별도 API로 계산하지 않는다.
2. `request.method`/`error` 분기는 status에서 모두 제거한다.
3. `login_required`는 route별 세 행으로 늘리지 않고 하나의 business rule로
   유지하되 세 적용 위치를 모두 기록한다.
4. `check_author=True`는 critical status에서 제거하고 author-only business
   rule에 통합한다.
5. template 조건은 normal UI business rule로 유지할 수 있다.
6. joined query 결과는 명시적인 read-model projection으로 유지한다.

## 사례 3 — Online Boutique의 세 서비스

### 승인하는 핵심 표면

- cartservice의 세 cart RPC, 실제로 wiring된 C# health RPC, checkout의
  `PlaceOrder`, shipping의 `GetQuote`와 `ShipOrder`, stock gRPC health server
  등록을 유지한다.
- cartservice 범위 안의 `Cart.proto` message, `ICartStore`, checkout의
  `orderPrep`, shipping의 `Quote`를 data contract로 유지한다.
- startup code와 Docker entrypoint, 실제 service configuration을 유지한다.
- 결제, 배송, email, cart mutation, DB/cache write와 listener bind를 side
  effect로 유지한다.
- downstream gRPC services, Redis, Spanner, AlloyDB, Secret Manager,
  OpenTelemetry가 실제 wiring된 경우를 integration으로 유지한다.
- cart backend 선택, total 계산, currency conversion, cart cleanup/error
  handling, money invariant, shipping quote와 tracking ID 생성을 business
  rule로 유지한다.

### 제거할 행

| ID | 이유 |
| --- | --- |
| `EXT3-007`–`EXT3-009` | 세 cart store class는 persistence 구현체이지 data contract가 아니다. |
| `EXT3-045` | Docker build 자체는 애플리케이션의 runtime external integration이 아니다. |
| `EXT3-051` | `checkoutService`는 downstream connection을 보유한 service 구현체다. |
| `EXT3-066` | 등록되지 않은 custom health method 안의 `SERVING`은 unreachable status다. |
| `EXT3-082` | checkout Docker build는 runtime external integration이 아니다. |
| `EXT3-092` | shipping `server`는 RPC 구현체이지 data contract가 아니다. |
| `EXT3-102` | 등록되지 않은 custom health method 안의 `SERVING`은 unreachable status다. |
| `EXT3-108` | shipping Docker build는 runtime external integration이 아니다. |

### 수정할 행

- `EXT3-035`: Redis `EmptyCartAsync`는 key를 삭제하지 않고 빈 cart를
  직렬화해 덮어쓴다고 정확히 기술한다.
- `EXT3-069`와 `EXT3-085`: 전자는 CartService RPC side effect이고 후자는
  checkout이 그 오류를 무시하는 business risk임을 notes에 구분한다.
- `EXT3-087`, `EXT3-088`: product policy가 아니라 monetary validation
  invariant라고 표시한다.

### 사례 3 판단 결론

1. checkout/shipping custom `Check`와 `Watch`는 stock health server 대신
   등록되지 않으므로 registered API에서 제외한다.
2. shipping Dockerfile의 `APP_PORT`와 code의 `PORT`는 실제 불일치다. 두 설정
   surface를 유지하고 generated documentation에서 no-op 가능성을 경고한다.
3. shipping의 tracing 함수는 TODO stub이므로 OpenTelemetry integration을
   만들지 않는다. checkout의 실제 OTLP wiring만 유지한다.
4. cartservice의 정적 `GET /`는 API이지만 informational endpoint이므로
   `normal`을 유지한다.
5. tracing/AlloyDB branch에서만 필요한 설정은 conditionally required이므로
   `normal`을 유지한다. checkout 시작 시 무조건 필요한 downstream address는
   `critical`을 유지한다.
6. EmptyCart mutation과 checkout의 ignored error는 `critical`을 유지하되
   Redis overwrite와 SQL delete를 구분한다.
7. money 규칙은 business rule에 남기되 validation invariant임을 명시한다.
8. AlloyDB interpolated SQL은 별도 gold category가 없으므로 새 행을 만들지
   않고 risk review note 및 기존 AlloyDB side-effect evidence에 보존한다.

## 동결 전 필수 작업

1. 위 제거·수정을 두 사례의 `gold-surfaces.jsonl`에 반영한다.
2. 전달 과정에서 반복된 두 번째 JSONL 사본을 제거하고 각 줄을 독립적인 JSON
   object로 정규화한다.
3. ID 고유성, category/type mapping, `found_at == source_citation`, source path와
   line 범위를 검사한다.
4. 사례별 review notes에 이 문서의 판단과 searched-but-absent 범위를 반영한다.
5. 수정된 gold를 별도 사람이 source-only로 승인한다.
6. 승인된 파일의 SHA-256을 `gold-digest.txt`에 기록한다.
7. 그 이후에만 extractor와 Mode A workflow를 실행한다.

현재 외부 품질 gate는 평가 전이며, 이 검토만으로 critical recall, citation
accuracy, omission, unsupported claim 또는 publication 조건을 충족했다고 주장하지
않는다.

## 적용 기록 (2026-07-30)

위 "동결 전 필수 작업"의 1–3단계를 실행한 결과다. 4단계는 각 사례의
`gold-review-notes.md`에 반영했고, **5단계 이후는 실행하지 않았다**.

| 사례 | 초안 | 제거 | 재분류 | 수정 후 | 검증 오류 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `external-py-flask-tutorial` | 73 | 16 | 12 | 57 | 0 |
| `external-mixed-online-boutique` | 111 | 10 | 3 | 101 | 0 |

제거 후 카테고리 분포:

- 사례 2 — business_rule 13, external_side_effect 13, registered_api 8,
  external_integration 7, test_file 5, environment 4, data_contract 3,
  status_value 2, entrypoint 2. critical 31.
- 사례 3 — environment 29, external_integration 17, business_rule 12,
  external_side_effect 12, registered_api 10, data_contract 9, entrypoint 7,
  test_file 3, status_value 2. critical 32.

검증 항목은 전 항목 통과했다. ID 고유성, 결번을 유지한 오름차순 정렬,
category → `expected_document_type` 매핑, `found_at == source_citation`, 스키마
외 키 부재, 중복 튜플 부재, 모든 `found_at`의 소스 파일 존재와 line 범위,
사례 3의 `genproto` 경로 부재를 확인했다.

**JSONL 중복에 관한 사실 확인.** 검토자 입력에서 각 JSONL이 두 번 반복된 것은
전달 과정의 문제이며, 저장소가 보유한 초안 파일 자체에는 중복이 없었다. 원본
초안은 사례 2가 73행 73 ID, 사례 3이 111행 111 ID로 각각 고유하고 순차적이었고,
모든 줄이 이미 독립적인 JSON object였다. 따라서 2단계는 제거 작업 없이 확인으로
완료했다.

**현재 상태는 여전히 `human_review_pending`이다.** 수정된 gold는 저장소 밖
(`scratchpad`)에 `gold-surfaces.corrected.jsonl`로 보관하며, 승인 전에는 사례
디렉터리에 `gold-surfaces.jsonl`을 두지 않고 `gold-digest.txt`도 만들지 않는다.
extractor와 Mode A workflow는 실행하지 않았다.
