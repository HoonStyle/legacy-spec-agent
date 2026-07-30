# 외부 저장소 문서 품질 평가 계획

이 문서는 `IMPLEMENTATION_ROADMAP.md`의 외부 문서 품질 평가를 실행하기 위한 후보 저장소, 분석 범위, 고정 절차와 산출물을 정리한다. 아래 commit SHA는 2026-07-30에 확인한 **고정 후보**이며, 실제 평가를 시작하기 전에 원격 저장소에서 존재 여부와 라이선스를 다시 확인한 뒤 scope manifest에 최종 기록한다.

후보 선정은 평가 대상이 작아서 사람이 독립적으로 전체 gold annotation을 검토할 수 있으면서도, API·데이터 계약·설정·진입점·상태·테스트·영속성 또는 부작용·외부 통합·비즈니스 규칙을 가능한 한 다양하게 포함하는 것을 원칙으로 한다.

## 권장 평가 세트

| 사례 ID | 유형 | 저장소와 선택 범위 | 라이선스 | 고정 후보 SHA |
| --- | --- | --- | --- | --- |
| `external-ts-prisma-rest` | 작은 TypeScript 서비스 | [`prisma/prisma-examples`](https://github.com/prisma/prisma-examples)의 `deployment-platforms/rest-express-docker-aws-ec2` | 저장소 Apache-2.0, 선택 패키지 MIT | `eb8f4328821c6746680a2ba02e0e5636a085a327` |
| `external-py-flask-tutorial` | Python 서비스 | [`pallets/flask`](https://github.com/pallets/flask)의 `examples/tutorial` | BSD-3-Clause | `36e4a824f340fdee7ed50937ba8e7f6bc7d17f81` |
| `external-mixed-online-boutique` | 비-TypeScript·혼합 서비스 | [`GoogleCloudPlatform/microservices-demo`](https://github.com/GoogleCloudPlatform/microservices-demo)의 `cartservice`, `checkoutservice`, `shippingservice` | Apache-2.0 | `9a4616e77f0f9cbcbecaf27d711c38890dda1404` |

세 저장소의 결과는 저장소 소유 합성 fixture 결과와 합치지 않고 별도의 외부 평가 요약으로 보고한다.

## 사례 1: Prisma REST Express

### 선정 이유

- Express 라우트가 분리되어 있어 등록 API를 사람이 검토하기 쉽다.
- Prisma schema와 migration이 데이터 계약, 영속성, 부작용의 근거를 제공한다.
- 환경변수, Docker, TypeScript 설정을 포함하므로 소스 코드만 있는 Hello World보다 문서 표면이 다양하다.
- 하위 프로젝트만 고정하면 사람이 완전한 gold를 작성할 수 있는 규모를 유지할 수 있다.

### 포함 경로

```text
deployment-platforms/rest-express-docker-aws-ec2/src/**
deployment-platforms/rest-express-docker-aws-ec2/prisma/**
deployment-platforms/rest-express-docker-aws-ec2/package.json
deployment-platforms/rest-express-docker-aws-ec2/tsconfig.json
deployment-platforms/rest-express-docker-aws-ec2/.env.example
deployment-platforms/rest-express-docker-aws-ec2/Dockerfile
deployment-platforms/rest-express-docker-aws-ec2/docker-compose.yml
deployment-platforms/rest-express-docker-aws-ec2/README.md
```

### 제외 경로

```text
**/node_modules/**
**/dist/**
**/.git/**
deployment-platforms/rest-express-docker-aws-ec2/.github/**
```

## 사례 2: Flask Tutorial

### 선정 이유

- Flask 공식 저장소가 관리하는 실행 가능한 Python 서비스 예제다.
- Blueprint 등록, application factory, 설정, 인증 상태, SQLite 영속성과 테스트를 작은 범위에서 다룬다.
- 프레임워크 전체가 아니라 tutorial만 선택해 독립적인 gold 검토 비용을 제한할 수 있다.

### 포함 경로

최종 manifest에는 고정 SHA의 실제 tree를 확인한 뒤 존재하는 파일만 열거한다.

```text
examples/tutorial/flaskr/**
examples/tutorial/tests/**
examples/tutorial/pyproject.toml
examples/tutorial/README.rst
```

### 제외 경로

```text
src/flask/**
tests/**
docs/**
examples/javascript/**
**/__pycache__/**
**/.venv/**
**/.git/**
```

최상위 `tests/**`는 Flask 프레임워크 자체 테스트이므로 제외하지만, `examples/tutorial/tests/**`는 평가 범위에 포함한다.

## 사례 3: Online Boutique 일부 서비스

### 선정 이유

- C#과 Go 서비스가 함께 있어 비-TypeScript 및 혼합 언어 동작을 검증할 수 있다.
- 서비스 간 통합, 상태, 데이터 계약, 외부 호출과 비즈니스 규칙을 포함하는 현실적인 사례다.
- 전체 저장소 대신 세 서비스만 선택해 gold의 완전성과 검토 가능성을 유지한다.

### 포함 경로

```text
src/cartservice/**
src/checkoutservice/**
src/shippingservice/**
```

배포 manifest가 서비스 동작을 설명하는 데 필요하면 `kubernetes-manifests/**` 또는 `helm-chart/**` 전체를 넣지 말고, 선택한 세 서비스와 직접 대응하는 파일만 manifest에 명시적으로 추가한다.

### 제외 경로

```text
src/frontend/**
src/loadgenerator/**
src/adservice/**
src/recommendationservice/**
src/shoppingassistantservice/**
**/node_modules/**
**/dist/**
**/bin/**
**/obj/**
**/.git/**
```

선택한 서비스 디렉터리 내부의 테스트, Dockerfile, 프로젝트 파일과 설정 파일은 제외하지 않는다.

## 실행 전 고정 절차

각 사례는 connector를 실행하기 전에 다음 순서로 고정한다.

1. 저장소 URL과 전체 40자리 commit SHA를 확인한다.
2. 해당 SHA에서 라이선스 파일과 SPDX 식별자를 확인한다.
3. 선택 profile을 `standard`로 기록한다.
4. included paths와 excluded paths를 파일 또는 glob 수준으로 기록한다.
5. 운영체제, 아키텍처, Node 버전, connector revision과 실행 방식을 기록한다.
6. connector, extractor와 생성 문서를 보지 않은 사람이 소스를 검토해 gold annotation을 작성한다.
7. 별도의 사람이 gold의 완전성과 인용을 검토한 뒤 승인하고, gold 파일의 SHA-256 digest를 기록해 동결한다.
8. 동결 후에만 extractor와 Mode A workflow를 실행한다.

사람의 검토가 완료되지 않으면 `human_review_pending`을 기록하고 **동결과 추출을 중단**한다. 에이전트가 작성한 초안이나 사용자 무응답을 human-reviewed gold로 간주해서는 안 된다.

브랜치 이름인 `main`, `master`, `latest`는 재현 가능한 식별자가 아니므로 평가 식별자로 사용하지 않는다. 예를 들어 후보 SHA를 검증한 다음 다음과 같이 detached checkout을 사용한다.

```bash
git checkout --detach eb8f4328821c6746680a2ba02e0e5636a085a327
```

## Gold annotation 범위

Gold는 connector 또는 detector 출력과 독립적으로 사람이 작성하며, 해당 사례에 존재하는 다음 표면을 모두 포함한다.

- 등록 API와 라우트
- 데이터 계약과 상태값
- 설정과 환경변수
- 실행 진입점
- 테스트와 검증 동작
- 데이터베이스, 파일, 네트워크 등 영속성 및 부작용
- 외부 서비스와 라이브러리 통합
- 코드에서 근거를 확인할 수 있는 비즈니스 규칙

`gold-surfaces.jsonl`에는 소스에서 실제 확인한 positive annotation만 넣는다. 어떤 개념 범주가 존재하지 않으면 `Not found`를 gold 행으로 만들지 않고 `gold-review-notes.md`에 검색한 경로, 패턴과 부재 판단을 기록한다. 현재 evaluator는 모든 gold 행을 기대 표면으로 계산하므로 `Not found` 행은 잘못된 false negative를 만든다. 현재 detector 출력은 누락된 gold를 보충하는 자료로 사용하지 않는다.

사람이 검토하는 의미 범주는 등록 API, 데이터 계약, 설정/환경, 진입점, 상태, 테스트, 영속성/부작용, 외부 통합, 비즈니스 규칙의 9개다. 현재 extractor의 채점 vocabulary는 `registered_api`, `data_contract`, `environment`, `entrypoint`, `status_value`, `test_file`, `external_side_effect`의 7개다. 외부 통합과 비즈니스 규칙은 `gold-review-notes.md` 및 생성 문서 감사에서 별도로 평가하며, evidence work 도중 extractor 기능을 추가해 이 차이를 숨기지 않는다.

## Mode A 실행 순서

각 고정 사례에 대해 다음 역할을 분리해 `standard` workflow를 실행한다.

1. **Writer**가 고정 scope와 extractor 결과로 Markdown 초안을 생성한다.
2. **Independent Evidence Auditor**가 모든 claim과 citation 근거를 독립적으로 검사한다.
3. **Coverage Sentinel**이 코드 표면에서 문서 방향으로 역감사해 누락을 찾는다.
4. 초안 digest를 동결한다.
5. 읽기 전용 **Gatekeeper**가 `evaluate_document_gate`를 실행한다.
6. 승인된 초안만 publication 단계로 전달한다.

Writer, Auditor, Coverage Sentinel과 Gatekeeper의 actor identity, 입력 digest, 출력 digest와 실행 순서를 보존한다. 역할 이름만 다르게 기록하고 같은 actor가 모두 수행한 실행은 외부 품질 게이트의 독립 역할 조건을 충족한 것으로 간주하지 않는다.

## 사례별 필수 산출물

각 사례 디렉터리에 최소한 다음 자료를 보존한다.

```text
case-manifest.json
scope-manifest.json
gold-surfaces.jsonl
gold-review-notes.md
gold-digest.txt
raw-extractor-output.json
actual-surfaces.jsonl
extractor-run.json
extractor-result.json
generated-documents/
audit_log.jsonl
evidence-audit.json
coverage-audit.json
draft-digest.txt
gate-result.json
publication-record.json
run-record.json
result.json
```

`raw-extractor-output.json`은 extractor가 반환한 배열을 그대로 보존하고, 같은 배열을 행 단위로 직렬화한 `actual-surfaces.jsonl`을 `evaluate-document-quality.mjs`에 전달한다. 기존 evaluator는 JSONL 입력만 받으므로 raw JSON을 직접 채점하지 않는다. `extractor-result.json`에는 evaluator 원본 결과를 보존하고, 별도의 결정론적 집계가 audit, coverage, gate 및 publication 기록을 결합해 최종 `result.json`을 만든다.

`run-record.json`에는 elapsed time, peak 또는 end-of-run RSS의 측정 방식, source bytes, response bytes, 실행 명령과 도구 버전을 기록한다. provider token, read count 또는 다른 계측값을 환경이 제공하지 않으면 추정값으로 대체하지 않고 `not_exposed` 또는 `not_measured`로 기록한다.

## 보고 지표와 판정 기준

사례별 및 전체 외부 요약에서 다음 원시값과 계산값을 보고한다.

- true positives, false positives, false negatives
- 범주별 precision과 recall
- critical-surface recall
- citation accuracy
- unsupported verified claims
- unexplained omissions
- rejected-draft publication count

외부 품질 gate는 다음 조건을 모두 만족할 때만 통과한다.

| 지표 | 통과 조건 |
| --- | --- |
| Critical-surface recall | 100% |
| Citation accuracy | 100% |
| Unexplained omissions | 0 |
| Unsupported verified claims | 0 |
| Rejected-draft publication count | 0 |

하나라도 만족하지 않으면 문서 품질 개선을 입증했다고 표현하지 않는다. 대표 파일 하나의 읽기, 인코딩, 크기, parse 또는 grammar 문제가 평가를 막을 때만 최소 범위의 per-file isolation 수정과 집중 회귀 테스트를 허용한다.

## 권장 착수 순서

1. `external-ts-prisma-rest`의 manifest와 human-reviewed gold 양식을 먼저 완성한다.
2. extractor를 실행하기 전에 gold 독립성 및 digest를 검토한다.
3. 양식만 재사용해 Flask와 Online Boutique gold를 각각 독립 작성한다.
4. 세 사례의 Mode A 실행을 완료한 후에만 외부 품질 종합 결과를 작성한다.

첫 사례의 connector 결과나 detector 분류를 나머지 사례의 gold 작성 기준으로 사용해서는 안 된다. 재사용 가능한 것은 manifest와 annotation의 **형식**뿐이다.

## 사례 1 실행 시 확인된 제약

- 재현용 clone은 MCP 서버 root 아래인 `/workspace/legacy-spec-agent/.external-sources/prisma-examples`에 둔다. `/home/user/legacy-spec-agent`처럼 현재 실행 환경에 없는 경로를 고정하지 않는다.
- `.external-sources/`는 Git에서 제외하며 clone 자체를 평가 결과로 커밋하지 않는다.
- `source_root`는 clone root로 유지한다. 따라서 gold, actual, coverage와 문서 인용의 경로는 모두 `deployment-platforms/rest-express-docker-aws-ec2/...`로 시작한다.
- `scope-manifest.json`은 strict gate input이므로 case metadata를 섞지 않는다. URL, 라이선스, 환경과 human-review 상태는 `case-manifest.json`에 기록한다.
- `file_counts.supported`는 `includedSourceFiles()`가 인식하는 확장자의 파일 수와 정확히 일치시킨다. 각 `included_paths` 값은 `module_extractors`에 정확히 한 번 대응시킨다.
- 문서 게이트가 인식하는 citation 확장자는 `.py`, `.ts`, `.js`, `.jsx`, `.tsx`, `.md`, `.json`, `.jsonl`, `.sh`, `.mjs`, `.cjs`, `.java`, `.cs`, `.go`다. `.prisma`, `.yml`, `.env`와 Dockerfile의 backtick 위치는 citation으로 집계되지 않으므로 이 파일만으로 뒷받침되는 claim을 검증된 인용으로 가장하지 않는다.
- 일곱 Markdown 문서의 `analyzed_source_commit`은 detached source HEAD와 일치해야 한다. Writer, Evidence Auditor, Coverage Sentinel, Gatekeeper actor ID는 서로 달라야 하며, 역할 이름만 바꾼 동일 실행을 독립 actor로 간주하지 않는다.
- `evaluate-document-quality.mjs`는 extractor precision/recall만 계산한다. citation accuracy, unsupported verified claims, unexplained omissions와 rejected-draft publication count는 원시 audit 및 publication 자료에서 결정론적으로 집계한다.
