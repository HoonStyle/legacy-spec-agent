# Legacy Spec Agent

<p align="center">
  <a href="README.md"><img alt="언어: English" src="https://img.shields.io/badge/lang-English-blue"></a>
  <a href="README.ko.md"><img alt="언어: 한국어" src="https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-blue"></a>
  <img alt="버전 0.1.0" src="https://img.shields.io/badge/version-0.1.0-informational">
  <a href="LICENSE"><img alt="라이선스: MIT" src="https://img.shields.io/badge/license-MIT-green"></a>
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

번들 커넥터가 제공하는 아홉 개 도구입니다.

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

## 대형 저장소 지원

큰 코드베이스에서 보고서가 감당하기 어려운 크기로 자라지 않도록 다음을 지원합니다.

- 항목 단위 산출물은 `limit`을 받을 수 있고, 잘렸을 때는 무엇이 생략됐는지 밝힙니다.
- 그래프는 `package` 단위로도 그릴 수 있어 큰 의존성 다이어그램도 읽을 만하게 유지됩니다.

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
connector/           아홉 개 도구와 테스트가 포함된 TypeScript MCP 서버
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

## 개발

변경을 올리기 전에 커넥터 테스트를 돌려 주세요.

```bash
cd connector
npm test
```

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
