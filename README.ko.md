# Legacy Spec Agent

<p align="center">
  <a href="README.md"><img alt="언어: English" src="https://img.shields.io/badge/lang-English-blue"></a>
  <a href="README.ko.md"><img alt="언어: 한국어" src="https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-blue"></a>
  <img alt="버전 0.1.3" src="https://img.shields.io/badge/version-0.1.3-informational">
  <a href="LICENSE"><img alt="라이선스: MIT" src="https://img.shields.io/badge/license-MIT-green"></a>
  <br>
  <a href="https://claude.com/claude-code"><img alt="Claude Code 플러그인" src="https://img.shields.io/badge/Claude%20Code-plugin-D97757?logo=claude&logoColor=white"></a>
  <a href="https://openai.com/codex/"><img alt="Codex 플러그인" src="https://img.shields.io/badge/Codex-plugin-000000?logo=openai&logoColor=white"></a>
</p>

[Claude Code](https://claude.com/claude-code)와 Codex / ChatGPT Work mode에서 쓸 수 있는 플러그인입니다. 스킬과 번들 MCP 커넥터로 구성되어 있습니다.

Legacy Spec Agent는 문서가 없는 코드에 뒤늦게라도 명세서를 만들어 줍니다. 소스를 읽고 실제 동작을 파악한 뒤, 모든 주장에 `path:line` 인용이 붙은 명세 문서를 작성합니다. 코드로 확인되지 않는 내용은 본문에 사실처럼 쓰지 않고 **Unverified** 섹션에 따로 모아 둡니다.

인용은 장식이 아닙니다. 나중에 코드가 바뀌면 기록해 둔 인용을 하나씩 다시 확인해서, 아직 유효한지, 위치만 옮겨졌는지, 내용이 달라졌는지, 인용 대상이 아예 사라졌는지를 보고합니다.

## 그냥 LLM한테 저장소 요약을 시키면 안 되나요?

됩니다. 요약도 대체로 쓸 만합니다. 문제는 그 요약이 맞는지 확인할 방법이 없다는 겁니다. 그래서 두 가지 장치를 두었습니다.

1. **Critic gate**: 산출물을 쓰기 전에 검토 단계가 인용된 라인을 전부 다시 열어, 코드가 정말 그 주장을 뒷받침하는지 확인합니다.
2. **MCP 커넥터**: 인용 검증, 심볼 인덱싱, 드리프트 탐지, 매니페스트 추출, 차트 렌더링처럼 실행할 때마다 같은 결과가 나와야 하는 작업은 모델이 아니라 TypeScript 서버가 처리합니다.

추론은 모델이 하고, 그 근거가 맞는지는 커넥터가 확인합니다.

## 산출물

| 산출물 | 설명 |
| --- | --- |
| `SPEC.md` | 목적, 비즈니스 규칙, 입력, 출력, 제약 조건. |
| `ARCHITECTURE.md` | 코드까지 추적되는 의존성 그래프와 제어 흐름도. |
| `INTERFACES.md` | 실제 시그니처가 붙은 공개 API 목록. |
| `DATA_MODEL.md` | 엔티티, 필드, 관계, Mermaid ER 다이어그램. |
| `ONBOARDING.md` | 빌드/실행 명령, 의존성, 환경 변수. |
| `TESTCASES.md` | 리팩터링 전에 현재 동작을 고정해 두는 특성화 테스트. |
| `RISKS.md` | 검증 중 발견된 결함 후보. |
| `CHANGELOG.md` | conventional commit 유형별로 묶은 Git 이력. |
| `DRIFT_REPORT.md` | 인용별 드리프트 분류. |
| `audit_log.jsonl` | 검증·플래그 이력이 쌓이는 append-only 로그. |
| Charts | 커버리지, 드리프트, 벤치마크, 아키텍처, ER 다이어그램. |
| `REPORT.html` | 커넥터가 생성하는 탭 구조의 단일 HTML 보고서. |

ADR, PRD, 사용자 매뉴얼은 일부러 만들지 않습니다. 이런 문서는 의도와 의사결정의 기록인데, 의도는 소스 코드만으로 증명할 수 없기 때문입니다.

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

번들 커넥터가 제공하는 열네 개 도구입니다.

- `assess_language_toolchains`
- `approve_toolchain_download`
- `download_language_toolchain`
- `get_toolchain_download_status`
- `cancel_toolchain_download`
- `verify_citation`
- `index_symbols`
- `build_call_graph`
- `detect_drift`
- `extract_data_model`
- `extract_project_meta`
- `extract_changelog`
- `emit_charts`
- `render_report`

커넥터 없이도 스킬은 동작합니다. 다만 LLM 출력에만 의존하게 되어 보장 수준은 낮아집니다.

기존 호출자와의 호환성을 위해 이름은 `build_call_graph`로 유지하지만, 이 도구가 반환하는 것은 메서드 호출 그래프가 아니라 구문 수준의 **모듈 의존성 그래프**입니다. 응답은 이 계약을 `graph_type: "module_dependency"`와 `resolution: "syntax"`로 표시하고 `resolved` 및 `unresolved` import 관계 수를 함께 보고합니다. 심볼, 메서드 호출, 런타임 호출 또는 동적 디스패치는 해석하지 않으며, 해석할 수 없는 import는 추측하지 않고 `externals`에 남깁니다.

### 언어 SDK가 없을 때

커넥터를 실행하는 환경은 분석 대상 저장소의 개발 환경과 다를 수 있습니다. `assess_language_toolchains`는 Python, JavaScript/TypeScript, Java, C#, Go 소스와 저장소의 일반적인 버전 고정 파일 및 로컬 SDK 명령을 검사하고, 다운로드나 코드 실행 없이 구조화된 동의 정보를 반환합니다. 정밀 분석에 필요한 파서나 SDK가 없으면 에이전트는 이 결과를 이용해 버전, 용도, 공식 배포처, 확인 가능한 경우 예상 용량, 격리된 캐시 위치를 밝히고 다운로드 전에 사용자에게 묻습니다. 사용자가 거절해도 명세 복원을 중단하지 않고, 파서가 없으면 소스를 직접 읽고 파서가 있으면 가능한 구문 분석을 수행한 뒤 검증하지 못한 시맨틱 항목을 명시합니다.

SDK 사용 가능 여부와 semantic backend 사용 가능 여부는 따로 보고합니다. 번들된 순수 JavaScript/WASM 파서는 로컬 SDK 없이도 Python, JavaScript/TypeScript, Java, C#, Go의 syntax-level 심볼 인덱스, import 그래프, typed model 추출을 수행합니다. SDK를 찾거나 다운로드했다는 이유만으로 compiler-resolved semantic 추출을 수행했다고 표시하지는 않습니다.

정확한 언어·버전·공식 아티팩트 URL·SHA-256을 사용자에게 표시하고 명시적 동의를 받은 뒤 `approve_toolchain_download`가 그 계획에 결합된 단기 일회용 토큰을 발급합니다. `download_language_toolchain`은 토큰을 소비하고 공식 host/path 규칙, 제한된 redirect, 용량·동시성·시간 제한, 체크섬 검증을 적용해 커넥터가 관리하는 캐시로 다운로드합니다. 반환된 작업 ID를 `get_toolchain_download_status`에 전달하면 바이트·백분율과 대기, 다운로드, 검증, 완료, 실패, 취소 상태를 확인할 수 있고 `cancel_toolchain_download`로 취소할 수 있습니다.

현재 승인 출처는 `caller_attestation`으로 명시됩니다. 즉 에이전트 호스트가 정확한 계획을 표시하고 동의를 받았다고 증명하는 방식이며, 커넥터는 이를 프로토콜 수준의 MCP elicitation이라고 주장하지 않습니다.

다운로드 완료는 검증된 아티팩트를 뜻하며 SDK 설치 완료를 뜻하지 않습니다. 다운로드 동의는 압축 해제, dependency restore, 프로젝트 빌드, install hook, 저장소 스크립트 또는 대상 코드 실행에 대한 동의가 아닙니다. 그런 작업은 별도의 명시적 동의가 필요합니다. 비대화형 실행에서는 호출자가 미리 opt-in하지 않은 한 다운로드하지 않는 것이 기본값입니다.

## 대형 저장소 지원

큰 코드베이스에서 보고서가 감당하기 어려운 크기로 자라지 않도록 다음을 지원합니다.

- 항목 단위 산출물은 `limit`을 받을 수 있고, 잘렸을 때는 무엇이 생략됐는지 밝힙니다.
- 그래프는 `package` 단위로도 그릴 수 있어 큰 의존성 다이어그램도 읽을 만하게 유지됩니다.

다중 언어 응답에는 원본 소스 바이트, 직렬화된 응답 바이트, WASM parse cache hit/miss도 포함됩니다. 현재 결정적 합성 벤치마크에서는 원본 소스 전문 대비 file-level 심볼 응답이 43.0%, package 요약이 95.3% 적은 토큰을 사용했습니다. 이는 fixture 측정값이며 전체 에이전트 세션이나 과금 토큰 절감률은 아닙니다. 측정 방법과 한계는 [`TOKEN_USAGE.md`](TOKEN_USAGE.md)에 기록했습니다.

출시 차단 항목, 언어별 resolver, semantic backend, 마지막 SDK installer 단계의 작업 순서는 [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md)에 정리했습니다.

## 설치

로컬에서 Codex / ChatGPT Work mode로 써 보려면 이 checkout을 로컬 플러그인 마켓플레이스로 등록한 뒤 Plugins Directory에서 **Legacy Spec Agent**를 설치하면 됩니다.

```bash
codex plugin marketplace add "$(pwd)"
```

Claude Code에서는 따로 할 일이 없습니다. 기존 `.claude-plugin/` 매니페스트와 루트 `.mcp.json`이 그대로 동작합니다. 두 런타임은 같은 커넥터를 쓰고, 경로 처리 방식이 달라 실행 메타데이터만 분리되어 있습니다. 커넥터가 없어도 스킬은 LLM-only 모드로 동작합니다.

## 저장소 구조

```text
SKILL.md             스킬 워크플로, 템플릿, 필수 규칙
references/          추출, 아키텍처, critic 계약
SPEC.md              최초 설계 문서(v0.1)
CONNECTOR_DESIGN.md  커넥터 설계 및 마일스톤 기록(C0-C7)
connector/           열네 개 도구와 테스트가 포함된 TypeScript MCP 서버
demo-hookify/        서드파티 패키지를 대상으로 한 Mode A 예시 실행 결과
evals/               스킬 사용/미사용 벤치마크 결과
skills/              플러그인 레이아웃용 스킬 사본
scripts/             플러그인 스킬 동기화 등 유틸리티
.codex-plugin/       Codex 플러그인 매니페스트
.agents/plugins/     로컬 설치용 저장소 내 Codex 마켓플레이스
.claude-plugin/      Claude Code 플러그인 및 마켓플레이스 매니페스트
.mcp.json            번들 커넥터용 Claude Code MCP 설정
showcase.html        데모 산출물용 탭형 뷰어
```

## 근거

- `demo-hookify/`는 처음 보는 서드파티 패키지에 손대지 않고 Mode A를 돌린 결과물입니다. 전체 산출물이 만들어졌고, 이미 구현된 기능을 미래 계획처럼 설명하던 낡은 소스 주석도 하나 잡아냈습니다.
- `evals/BENCHMARK.md`는 같은 프롬프트로 스킬을 쓴 경우와 안 쓴 경우를 비교합니다. 인용 커버리지는 86-87% 대 0%였고, 표본으로 확인한 인용 6개는 전부 정확했습니다.
- 커넥터 테스트는 데모 감사 로그의 인용 12개를 고정된 커밋에 대해 재검증합니다. 플러그인 패키징과 리뷰에서 지적된 문제에 대한 회귀 테스트도 함께 들어 있습니다.

## Wiki

사람이 관리하는 위키 문서는 [`wiki/`](wiki/Home.md)에 있습니다. 설치, 워크플로, 산출물, 커넥터 도구, 개발 절차를 GitHub Wiki로도 옮기기 쉬운 Markdown 파일로 정리합니다.

## 개발

새 클라우드 또는 임시 Linux 워크스페이스에서 테스트 환경을 준비하려면 다음을 실행하세요.

```bash
scripts/setup-cloud-test.sh
```

설정 스크립트는 Node.js 20 이상을 확인하고, `npm ci`로 커넥터 의존성을 설치한 뒤 TypeScript 커넥터를 빌드하고 커넥터 테스트 스위트를 실행합니다. 테스트 실행 없이 설치/빌드만 하려면 `RUN_TESTS=0`을 설정하고, 이 체크아웃을 로컬 Codex 플러그인 마켓플레이스로 등록하고 **Legacy Spec Agent**를 설치하려면 `REGISTER_CODEX_MARKETPLACE=1`을 설정하세요. `codex`가 이미 설치되어 있지 않으면 스크립트가 `npx -y @openai/codex`로 대체 실행하며, 특정 CLI 버전을 고정하려면 `CODEX_NPM_PACKAGE=@openai/codex@<version>`을 설정하면 됩니다.

변경을 올리기 전에 커넥터 테스트를 돌려 주세요.

```bash
cd connector
npm test
```

### Windows 설치

Python 구문 분석기를 순수 JavaScript 구현으로 교체했으므로 이제 `node-gyp`,
Visual Studio 또는 VC++ 툴셋이 필요하지 않습니다. 이전 버전의 설치 실패 잔재가
남았다면 플러그인의 `connector` 디렉터리에서 한 번만 다음 명령을 실행하세요.

```bat
rmdir /s /q node_modules 2>nul
npm ci
npm run build
node bootstrap.mjs "C:\분석할\프로젝트"
```

마지막 명령이 즉시 종료되지 않고 stdio MCP 서버로 대기하면 복구된 것입니다.
Ctrl+C로 종료한 뒤 Claude Code를 재시작하거나 MCP를 다시 연결하세요.

선택적인 acceptance 테스트는 `HOOKIFY_ROOT`가 Claude Code 체크아웃의 `plugins/hookify` 디렉터리를 가리켜야 실행됩니다.

`SKILL.md`나 `references/` 아래 파일을 고쳤다면 플러그인 사본도 동기화해야 합니다.

```bash
node scripts/sync-plugin-skill.mjs
```

두 사본이 어긋나면 테스트가 실패합니다.

## 기여

이슈와 PR 모두 환영합니다. 동작을 문서로 남길 때는 이 도구가 하는 것처럼 근거가 되는 소스 라인을 함께 인용해 주세요.

## 라이선스

[MIT](LICENSE)
