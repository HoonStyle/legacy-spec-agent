# Legacy Spec Agent

<p align="center">
  <a href="README.md"><img alt="언어: English" src="https://img.shields.io/badge/lang-English-blue"></a>
  <a href="README.ko.md"><img alt="언어: 한국어" src="https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-blue"></a>
  <img alt="버전 0.3.0" src="https://img.shields.io/badge/version-0.3.0-informational">
  <a href="LICENSE"><img alt="라이선스: MIT" src="https://img.shields.io/badge/license-MIT-green"></a>
  <a href="https://github.com/HoonStyle/legacy-spec-agent/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/HoonStyle/legacy-spec-agent/actions/workflows/ci.yml/badge.svg"></a>
  <br>
  <img alt="Node 20+" src="https://img.shields.io/badge/Node-20%2B-339933?logo=nodedotjs&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="MCP" src="https://img.shields.io/badge/MCP-16%20tools%20%C2%B7%20stdio-6E56CF">
  <img alt="tree-sitter WASM" src="https://img.shields.io/badge/parsers-tree--sitter%20WASM%20%C2%B7%20Lezer-4B8BBE">
  <br>
  <a href="https://claude.com/claude-code"><img alt="Claude Code 플러그인" src="https://img.shields.io/badge/Claude%20Code-plugin-D97757?logo=claude&logoColor=white"></a>
  <a href="https://openai.com/codex/"><img alt="Codex 플러그인" src="https://img.shields.io/badge/Codex-plugin-000000?logo=openai&logoColor=white"></a>
  <img alt="분석 언어" src="https://img.shields.io/badge/analyzes-Python%20%C2%B7%20JS%2FTS%20%C2%B7%20Java%20%C2%B7%20C%23%20%C2%B7%20Go-555">
  <img alt="CI: Ubuntu · Windows" src="https://img.shields.io/badge/CI-Ubuntu%20%C2%B7%20Windows-0078D4">
</p>

소스 코드에서 인용 근거가 있는 명세를 생성하고, 코드 변경 후 그 인용이 유효한지 확인하는 도구입니다.

Legacy Spec Agent는 공통 스킬과 TypeScript MCP 커넥터로 구성된 [Claude Code](https://claude.com/claude-code)·Codex 플러그인입니다. 주장은 `path:line`에 연결하고 근거 없는 해석은 **Unverified**로 분리합니다. 구문 분석과 인용 검증은 검토를 돕지만, 문서가 모든 동작을 담았음을 보장하지는 않습니다.

**시작하기:** [설치](#설치) · [사용법](#사용법) · [산출물 예시](demo-hookify/) · [알려진 제약](#알려진-제약)

## 사용법

플러그인을 설치한 뒤 호스트에 스킬 사용을 요청합니다. 예시:

```text
이 저장소에 legacy-spec-agent Mode A, standard 프로파일을 적용해줘.
먼저 소스 범위를 정하고, 인용 근거가 있는 명세를 작성해줘.
지원하지 않거나 검증하지 못한 동작은 공개하고 대상 코드는 실행하지 마.
```

```text
legacy-spec-agent Mode B로 기존 명세를 현재 소스와 대조해줘.
인용 드리프트와 수정안을 보고하되 수정안을 자동 적용하지 마.
```

셸 명령이 아닌 호스트용 프롬프트 예시입니다. 기본 산출물 프로파일은 `standard`이며 `core`는 명시적으로 요청해야 합니다. 문서 구성은 [산출물](#산출물)을 참고하세요.

## 알려진 제약

- 구조 분석은 구문 수준이며 컴파일러가 해석한 메서드 호출 그래프가 아닙니다.
- 인용 정확성과 내용의 완전성은 다릅니다. [외부 저장소 3개 대상 평가](evals/document-quality/external/SUMMARY.md)에서 486개 주장의 인용은 정확했지만 strict critical-surface recall은 1/75로 품질 기준을 충족하지 못했습니다.
- 토큰 비용 절감 도구로 검증되지 않았습니다. 효율 목적 확장에 대한 end-to-end 리플레이 결정은 **Stop**으로 유지합니다. 자세한 내용은 [대형 저장소 지원](#대형-저장소-지원)을 참고하세요.
- 다운로드는 명시적 동의가 필요하며, SDK 설치나 대상 코드 실행까지 허용하는 것은 아닙니다.

## 목차

- [사용법](#사용법)
- [알려진 제약](#알려진-제약)
- [그냥 LLM한테 저장소 요약을 시키면 안 되나요?](#그냥-llm한테-저장소-요약을-시키면-안-되나요)
- [산출물](#산출물)
- [모드](#모드)
- [커넥터 도구](#커넥터-도구)
- [대형 저장소 지원](#대형-저장소-지원)
- [설치](#설치)
- [저장소 구조](#저장소-구조)
- [근거](#근거)
- [Wiki](#wiki)
- [개발](#개발)
- [기여](#기여)
- [라이선스](#라이선스)

## 그냥 LLM한테 저장소 요약을 시키면 안 되나요?

됩니다. 요약도 대체로 쓸 만합니다. 문제는 그 요약이 맞는지 확인할 방법이 없다는 겁니다. 그래서 두 가지 장치를 두었습니다.

1. **Critic gate.** 산출물을 쓰기 전에 검토 단계가 인용된 라인을 전부 다시 열어, 코드가 정말 그 주장을 뒷받침하는지 확인합니다.
2. **MCP 커넥터.** 인용 검증, 심볼 인덱싱, 드리프트 탐지, 매니페스트 추출, 차트 렌더링처럼 실행할 때마다 같은 결과가 나와야 하는 작업은 모델이 아니라 TypeScript 서버가 처리합니다.

추론은 모델이 하고, 근거가 맞는지는 커넥터가 확인합니다.

## 산출물

Mode A에는 두 프로파일이 있습니다. **기본값은 `standard`** 이며, 축소된 **`core`는 사용자가 명시적으로 요청할 때만** 씁니다.

| 프로파일 | 산출물 |
| --- | --- |
| `core` | `SPEC.md`, `ARCHITECTURE.md`, `audit_log.jsonl` |
| `standard` (기본값) | `core` 전체와 `INTERFACES.md`, `DATA_MODEL.md`, `ONBOARDING.md`, `TESTCASES.md`, `RISKS.md`, charts, `REPORT.html` |

`SPEC.md`는 system boundary, actor와 entrypoint, 핵심 use case, 식별된 business rule, validation과 error, 상태 전이, configuration, persistence와 side effect, 운영 동작, 알려진 한계, unverified 항목을 다룹니다. 나머지 standard 문서는 architecture view, 정확한 interface 계약, persistent entity와 configuration/interface contract의 분리, 근거 있는 설정 절차, 테스트 목록·scenario·candidate, 분류된 risk를 정의합니다. `BR-*`, `API-*`, `DM-*`, `TC-*`, `RSK-*`, `UV-*` 안정 ID로 문서 간 참조를 검증합니다.

모든 문서에 적용되는 규칙:

- 필수 문서나 섹션을 비워 두거나 추측으로 채우지 않습니다. 저장소에 해당 개념이 없으면 검색 범위와 **발견되지 않음(Not found)** 을 기록하고, 저장소가 정의하지 않은 외부 계약은 **Unverified**로 분리합니다.
- charts와 `REPORT.html`은 커넥터의 chart/report 도구가 있을 때 생성합니다. 다국어 라벨은 충돌 없는 diagram ID와 함께 원문을 보존하고, 보고서는 UTF-8 BOM으로 출력합니다. 잘못 인코딩된 입력은 깨진 문서를 만들지 않고 명확히 실패합니다. 도구가 없으면 생성하지 못한 조건을 명시합니다.
- `build_call_graph` 기반 architecture 결과에는 `graph_type: module_dependency`, `resolution: syntax`를 표시합니다. syntax-only module/import 분석이며, 실제 method call graph나 compiler/runtime/dynamic-dispatch 해석이 아닙니다.
- `CHANGELOG.md`는 Git 이력이 있고 사용자가 요청한 경우에만 선택적으로 생성합니다. ADR, PRD, 사용자 매뉴얼은 소스 코드로 설계·사업 의도를 입증할 수 없어 생성하지 않습니다.

## 모드

### Mode A: reverse-spec

명세 복원 파이프라인 전체를 실행합니다.

1. 코드베이스 범위를 정합니다.
2. 모듈별로 동작을 추출합니다.
3. 아키텍처와 인터페이스 문서를 정리합니다.
4. 모든 인용에 Critic gate를 돌립니다.
5. 최종 산출물을 작성합니다.

### Mode B: drift check

기존 명세와 그 명세가 기록된 커밋에서 출발합니다. 인용된 라인을 현재 코드와 비교해 무엇이 달라졌는지 분류하고, 명세를 마음대로 고쳐 쓰는 대신 수정안을 제안합니다.

## 커넥터 도구

번들 커넥터는 열여덟 개 도구를 제공합니다. 커넥터 없이도 스킬은 동작하지만 LLM 출력에만 의존하게 되어 보장 수준은 낮아집니다.

| 그룹 | 도구 | 용도 |
| --- | --- | --- |
| 근거 | `verify_citation`, `detect_drift` | 인용 라인 재확인, 기록된 커밋 이후 변경 분류 |
| 구조 | `index_symbols`, `build_call_graph` | 구문 수준 심볼 인덱스와 모듈 의존성 그래프 |
| 추출 | `extract_data_model`, `extract_project_meta`, `extract_changelog` | typed model, 매니페스트, Git 기반 changelog |
| 렌더링 | `emit_charts`, `render_report` | charts와 `REPORT.html` |
| 출처 고정 | `snapshot_source_scope`, `snapshot_document_claims` | 의미 판단을 주장하지 않고 원본 바이트와 인용 claim binding 동결 |
| 발행 | `evaluate_document_gate`, `publish_approved_documents` | Mode A 최종 게이트와 트랜잭션 발행 |
| 툴체인 | `assess_language_toolchains`, `approve_toolchain_download`, `download_language_toolchain`, `get_toolchain_download_status`, `cancel_toolchain_download` | 누락 SDK 탐지, 명시적 동의 후에만 다운로드 |

### 발행 게이트

`evaluate_document_gate`는 Mode A의 읽기 전용 최종 게이트입니다. Writer가 실행되기 전에 범위 매니페스트를 동결하고, 독립 증거 감사자(Independent Evidence Auditor)와 커버리지 센티널(Coverage Sentinel)이 동결된 초안을 감사하며, Gatekeeper만이 그 기록을 게이트에 제출합니다. 게이트는 동결된 코드 표면을 독립적으로 재열거하고 필수 문서/섹션, 인용 라인과 100% 감사 커버리지, ID, 누락, 절단 공개, 구문 그래프 라벨, 역할 식별자, 실제 초안·원본·claim binding을 검증한 뒤 결정적 사유 코드와 함께 `approved` 또는 `rejected`를 반환합니다. 산출물을 수정하지는 않습니다. 결과는 결정론적 `structural_validation`, 감사자의 판단인 `semantic_audit`, `execution_provenance`, `source_provenance`를 분리합니다. 서로 다른 actor 문자열이나 `caller_attested` 기록을 호스트가 인증한 실행으로 표시하지 않습니다.

`publish_approved_documents`는 staging 초안에 같은 게이트를 적용하고 승인된 경우에만 목적지 디렉터리를 트랜잭션 방식으로 교체합니다. 거절된 초안은 기존 발행본을 건드리지 않습니다.

### `build_call_graph`에 대해

호환성을 위해 이름은 `build_call_graph`로 유지하지만, 이 도구가 반환하는 것은 메서드 호출 그래프가 아니라 구문 수준의 **모듈 의존성 그래프**입니다. 응답은 이 계약을 `graph_type: "module_dependency"`와 `resolution: "syntax"`로 표시하고 `resolved`·`unresolved` import 관계 수를 함께 보고합니다. 심볼, 메서드 호출, 런타임 호출, 동적 디스패치는 해석하지 않으며, 해석할 수 없는 import는 추측하지 않고 `externals`에 남깁니다.

### 언어 SDK가 없을 때

커넥터를 실행하는 환경은 분석 대상 저장소의 개발 환경과 달라도 됩니다.

- `assess_language_toolchains`는 Python, JavaScript/TypeScript, Java, C#, Go 소스와 일반적인 버전 고정 파일, 로컬 SDK 명령을 검사하고, 다운로드나 코드 실행 없이 구조화된 동의 정보를 반환합니다.
- 번들된 순수 JavaScript/WASM 파서는 로컬 SDK 없이도 이 다섯 언어의 syntax-level 심볼 인덱스, import 그래프, typed model 추출을 수행합니다. SDK 사용 가능 여부와 semantic backend 사용 가능 여부는 따로 보고하며, SDK를 찾거나 받았다는 이유만으로 compiler-resolved semantic 추출을 했다고 표시하지 않습니다.
- 정밀 분석에 필요한 파서나 SDK가 없으면 에이전트는 정확한 언어·버전·공식 아티팩트 URL·SHA-256·용도·예상 용량·격리된 캐시 위치를 보여 주고 사용자에게 묻습니다. 거절해도 명세 복원은 멈추지 않습니다. 소스를 직접 읽거나 구문 분석만 수행한 뒤 검증하지 못한 시맨틱 항목을 명시합니다.
- 명시적 동의 뒤 `approve_toolchain_download`가 그 계획에 결합된 단기 일회용 토큰을 발급합니다. `download_language_toolchain`은 토큰을 소비하고 공식 host/path 규칙, 제한된 redirect, 용량·동시성·시간 제한, 체크섬 검증을 적용해 커넥터가 관리하는 캐시로 내려받습니다. `get_toolchain_download_status`는 바이트·백분율과 상태(대기, 다운로드, 검증, 완료, 실패, 취소)를 보고하고, `cancel_toolchain_download`로 취소합니다.
- 승인 출처는 `caller_attestation`으로 명시됩니다. 에이전트 호스트가 계획을 표시하고 동의를 받았다고 증명하는 방식이며, 커넥터는 이를 프로토콜 수준의 MCP elicitation이라고 주장하지 않습니다.
- 다운로드 완료는 검증된 아티팩트를 뜻할 뿐 SDK 설치를 뜻하지 않습니다. 동의는 압축 해제, dependency restore, 빌드, install hook, 저장소 스크립트, 대상 코드 실행을 포함하지 않습니다. 비대화형 실행에서는 호출자가 미리 opt-in하지 않는 한 다운로드하지 않습니다.

## 대형 저장소 지원

큰 코드베이스에서 보고서가 감당하기 어려운 크기로 자라지 않도록 다음을 지원합니다.

- 항목 단위 산출물은 `limit`을 받을 수 있고, 잘렸을 때는 무엇이 생략됐는지 밝힙니다.
- 그래프는 `package` 단위로도 그릴 수 있어 큰 의존성 다이어그램도 읽을 만하게 유지됩니다.

다중 언어 응답에는 원본 소스 바이트, 직렬화된 응답 바이트, WASM parse cache hit/miss도 포함됩니다. 결정적 합성 벤치마크에서는 원본 소스 전문 대비 file-level 심볼 응답이 43.0%, package 요약이 95.3% 적은 토큰을 사용했습니다. 이는 fixture 측정값이며 전체 세션이나 과금 토큰 절감률은 아닙니다. 방법과 한계는 [`TOKEN_USAGE.md`](TOKEN_USAGE.md)에 있습니다.

end-to-end 질문은 직접 측정했습니다. per-run provider 토큰 카운터를 켠 5쌍 페어드 리플레이(2026-08-04)에서 커넥터 실행은 총 provider 입력 토큰을 31.3% **증가**시켰고 5쌍 중 1쌍만 개선했으며, 과제 품질과 인용 정확도의 회귀는 없었습니다. 모든 커넥터 런이 저장소 전체 심볼 인덱스를 매번 다시 전송한 것이 주된 원인입니다. 기록된 결정은 효율 목적 확장에 대한 **Stop**입니다([`evals/end-to-end-replay/counter-replay/DECISION.md`](evals/end-to-end-replay/counter-replay/DECISION.md)). 커넥터는 컨텍스트 비용 최적화가 아니라 검증·근거 엔진으로 취급해야 합니다.

출시 차단 항목, 언어별 resolver, semantic backend, 마지막 SDK installer 단계의 순서는 [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md)에 정리했습니다.

## 설치

먼저 저장소를 복제합니다.

```bash
git clone https://github.com/HoonStyle/legacy-spec-agent.git
cd legacy-spec-agent
```

**Claude Code.** 분석할 프로젝트에서 Claude Code를 시작할 때 이 checkout을 로컬 플러그인으로 지정합니다.

```bash
claude --plugin-dir /absolute/path/to/legacy-spec-agent
```

`.claude-plugin/` 메타데이터와 번들 커넥터용 `.mcp.json`이 포함되어 있습니다. 커넥터에는 Node.js 20+가 필요하며 첫 실행 시 의존성을 가져올 수 있어야 합니다.

**Codex / ChatGPT Work mode.** 이 checkout을 로컬 플러그인 마켓플레이스로 등록한 뒤 Plugins Directory에서 **Legacy Spec Agent**를 설치합니다.

```bash
codex plugin marketplace add "$(pwd)"
```

두 런타임은 같은 커넥터를 쓰고, 경로 처리 방식이 달라 실행 메타데이터만 분리되어 있습니다. 커넥터가 없어도 스킬은 LLM-only 모드로 동작합니다.

**Windows.** Python 파서가 순수 JavaScript 구현이라 `node-gyp`, Visual Studio, VC++ 툴셋이 필요 없습니다. 이전 버전의 설치 실패 잔재가 남았다면 플러그인의 `connector` 디렉터리에서 한 번만 실행하세요.

```bat
rmdir /s /q node_modules 2>nul
npm ci
npm run build
node bootstrap.mjs "C:\분석할\프로젝트"
```

마지막 명령이 즉시 종료되지 않고 stdio MCP 서버로 대기하면 복구된 것입니다. Ctrl+C로 종료한 뒤 Claude Code를 재시작하거나 MCP를 다시 연결하세요.

## 저장소 구조

```text
SKILL.md             스킬 워크플로, 템플릿, 필수 규칙
references/          추출, 아키텍처, critic 계약
SPEC.md              최초 설계 문서(v0.1)
CONNECTOR_DESIGN.md  커넥터 설계 및 마일스톤 기록(C0-C7)
connector/           열여섯 개 도구와 테스트가 포함된 TypeScript MCP 서버
demo-hookify/        서드파티 패키지를 대상으로 한 Mode A 예시 실행 결과
evals/               스킬 사용/미사용 벤치마크 결과
wiki/                사람이 관리하는 위키 문서
skills/              플러그인 레이아웃용 스킬 사본
scripts/             플러그인 스킬 동기화 등 유틸리티
.codex-plugin/       Codex 플러그인 매니페스트
.agents/plugins/     로컬 설치용 저장소 내 Codex 마켓플레이스
.claude-plugin/      Claude Code 플러그인 및 마켓플레이스 매니페스트
.mcp.json            번들 커넥터용 Claude Code MCP 설정
showcase.html        데모 산출물용 탭형 뷰어
```

## 근거

- `demo-hookify/`는 처음 보는 서드파티 패키지에 손대지 않고 Mode A를 돌린 결과물입니다. 전체 산출물이 만들어졌고, 이미 구현된 기능을 미래 계획처럼 설명하던 낡은 주석도 하나 잡아냈습니다.
- `evals/BENCHMARK.md`는 같은 프롬프트로 스킬을 쓴 경우와 안 쓴 경우를 비교합니다. 인용 커버리지는 86-87% 대 0%였고, 표본으로 확인한 인용 6개는 전부 정확했습니다.
- 커넥터 테스트는 데모 감사 로그의 인용 12개를 고정된 커밋에 대해 재검증합니다. 플러그인 패키징과 리뷰에서 지적된 문제에 대한 회귀 테스트도 함께 들어 있습니다.
- `evals/end-to-end-replay/`에는 고정된 InternalRepo 리비전에 대한 bounded replay 두 건이 보존되어 있습니다. 2026-08-04 카운터 지원 리플레이는 provider 토큰을 직접 측정했습니다. 10개 런 전부에서 품질과 인용은 유지됐지만 커넥터 조건의 입력 토큰이 31.3% 더 들었고, 기록된 결정은 **Stop**입니다. 부정적 측정도 근거이므로 그대로 남겨 두었습니다.

## Wiki

사람이 관리하는 위키 문서는 [`wiki/`](wiki/Home.md)에 있습니다. 설치, 워크플로, 산출물, 커넥터 도구, 개발 절차를 GitHub Wiki로도 옮기기 쉬운 Markdown 파일로 정리합니다.

## 개발

새 클라우드 또는 임시 Linux 워크스페이스를 준비하려면:

```bash
scripts/setup-cloud-test.sh
```

스크립트는 Node.js 20 이상을 확인하고, `npm ci`로 커넥터 의존성을 설치한 뒤 TypeScript 커넥터를 빌드하고 테스트 스위트를 실행합니다. 테스트 없이 설치·빌드만 하려면 `RUN_TESTS=0`, 이 checkout을 로컬 Codex 플러그인 마켓플레이스로 등록하고 **Legacy Spec Agent**까지 설치하려면 `REGISTER_CODEX_MARKETPLACE=1`을 설정합니다. `codex`가 없으면 `npx -y @openai/codex`로 대체 실행하며, 특정 버전은 `CODEX_NPM_PACKAGE=@openai/codex@<version>`으로 고정합니다.

변경을 올리기 전에 커넥터 테스트를 돌려 주세요.

```bash
cd connector
npm test
```

CI는 같은 스위트를 Ubuntu와 Windows, Node 20과 22에서 실행합니다. 선택적인 acceptance 테스트는 `HOOKIFY_ROOT`가 Claude Code 체크아웃의 `plugins/hookify` 디렉터리를 가리켜야 실행됩니다.

`SKILL.md`나 `references/` 아래 파일을 고쳤다면 플러그인 사본도 동기화합니다. 두 사본이 어긋나면 테스트가 실패합니다.

```bash
node scripts/sync-plugin-skill.mjs
```

## 기여

이슈와 PR 모두 환영합니다. 동작을 문서로 남길 때는 이 도구가 하는 것처럼 근거가 되는 소스 라인을 함께 인용해 주세요.

## 라이선스

[MIT](LICENSE)
