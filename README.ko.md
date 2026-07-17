# Legacy Spec Agent

<p align="center">
  <a href="README.md"><img alt="언어: English" src="https://img.shields.io/badge/lang-English-blue"></a>
  <a href="README.ko.md"><img alt="언어: 한국어" src="https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-blue"></a>
  <img alt="버전 0.1.0" src="https://img.shields.io/badge/version-0.1.0-informational">
  <a href="LICENSE"><img alt="라이선스: MIT" src="https://img.shields.io/badge/license-MIT-green"></a>
</p>


> 문서가 부족한 레거시 코드베이스에서 근거 기반 명세서를 재구성하는 [Claude Code](https://claude.com/claude-code) 플러그인입니다.

Legacy Spec Agent는 소스 트리를 유일한 진실의 원천으로 다룹니다. 기존 코드를 읽고 동작을 추출한 뒤, 모든 사실성 주장에 `path:line` 형태의 코드 인용을 붙여 명세 산출물을 작성합니다. 코드로 검증할 수 없는 주장은 사실처럼 표시하지 않고 **Unverified** 섹션으로 분리합니다.

이후 코드가 변경되면 기록된 인용을 다시 확인해 각 인용이 그대로 유지되었는지, 이동했는지, 의미가 달라졌는지, 고아 상태가 되었는지, 또는 해석할 수 없는지 보고할 수 있습니다.

## 그냥 LLM에 저장소 요약을 맡기는 것과 무엇이 다른가요?

일반적인 LLM 요약도 유용할 수 있지만 감사하기 어렵습니다. Legacy Spec Agent는 여기에 두 가지 안전장치를 더합니다.

1. **Critic gate** — 산출물을 내보내기 전에 검토 단계가 모든 인용 라인을 다시 열어 소스가 해당 주장을 뒷받침하는지 확인합니다.
2. **결정적 MCP 커넥터** — 인용 검증, 심볼 인덱싱, 드리프트 탐지, 매니페스트 추출, 차트 렌더링처럼 실행마다 흔들리면 안 되는 작업은 자유 형식 모델 출력이 아니라 TypeScript MCP 서버가 처리합니다.

모델은 추론을 담당하고, 커넥터는 근거를 강제합니다.

## 산출물

| 산출물 | 설명 |
| --- | --- |
| `SPEC.md` | 목적, 비즈니스 규칙, 입력, 출력, 제약 조건. |
| `ARCHITECTURE.md` | 코드에 추적 가능한 의존성 그래프와 제어 흐름도. |
| `INTERFACES.md` | 실제 시그니처가 포함된 공개 API 표면. |
| `DATA_MODEL.md` | 엔티티, 필드, 관계, Mermaid ER 다이어그램. |
| `ONBOARDING.md` | 빌드/실행 명령, 의존성, 환경 변수. |
| `TESTCASES.md` | 리팩터링 전에 현재 동작을 고정하는 특성화 테스트. |
| `RISKS.md` | 검증 중 발견된 결함 후보 목록. |
| `CHANGELOG.md` | conventional commit 유형별로 묶은 Git 이력. |
| `DRIFT_REPORT.md` | 인용별 드리프트 분류. |
| `audit_log.jsonl` | 검증 및 플래그 처리 이력을 남기는 append-only 로그. |
| Charts | 커버리지, 드리프트, 벤치마크, 아키텍처, ER 다이어그램. |
| `REPORT.html` | 커넥터가 생성하는 자체 포함 탭형 보고서. |

Legacy Spec Agent는 ADR, PRD, 사용자 매뉴얼을 의도적으로 생성하지 않습니다. 이런 문서는 의도와 의사결정을 설명하는데, 이는 보통 소스 코드만으로 증명할 수 없기 때문입니다.

## 모드

### Mode A: reverse-spec

전체 명세 재구성 파이프라인을 실행합니다.

1. 코드베이스 범위를 정합니다.
2. 모듈별로 동작을 추출합니다.
3. 아키텍처와 인터페이스를 종합합니다.
4. 모든 인용에 대해 Critic gate를 실행합니다.
5. 최종 산출물을 내보냅니다.

### Mode B: drift check

기존 명세와 기록된 커밋에서 시작합니다. 커넥터는 각 인용의 소스 라인을 현재 트리와 비교하고 드리프트를 분류한 뒤, 명세를 조용히 덮어쓰는 대신 업데이트 후보를 제안합니다.

## 커넥터 도구

번들 MCP 커넥터는 다음 결정적 도구를 제공합니다.

- `verify_citation`
- `index_symbols`
- `build_call_graph`
- `detect_drift`
- `extract_data_model`
- `extract_project_meta`
- `extract_changelog`
- `emit_charts`
- `render_report`

커넥터를 사용할 수 없는 경우에도 스킬은 LLM-only 모드로 실행할 수 있지만, 보장 수준은 낮아집니다.

## 대형 저장소 지원

Legacy Spec Agent는 큰 코드베이스에서도 보고서가 과도하게 커지지 않도록 설계되어 있습니다.

- 항목 단위 산출물은 `limit`을 받을 수 있으며, 잘린 경우 생략된 내용을 명시적으로 보고합니다.
- 그래프는 `package` 단위로 렌더링할 수 있어 큰 의존성 다이어그램도 읽기 쉽게 유지됩니다.

## 설치

Claude Code 마켓플레이스 소스에서 플러그인을 설치합니다.

```bash
claude plugin marketplace add hoonstyle/legacy-spec-agent
claude plugin install legacy-spec-agent@legacy-spec-agent
```

커넥터는 첫 실행 시 자체 빌드되며, 플러그인 업데이트에 새 커넥터 소스가 포함되면 다시 빌드됩니다. 첫 빌드에는 네트워크 접근이 필요합니다.

이 저장소를 Claude Code가 발견하는 스킬 디렉터리에 복사해서 사용할 수도 있습니다. 예시는 다음과 같습니다.

```text
.claude/skills/legacy-spec-agent/
```

그런 다음 Claude에게 문서화되지 않은 파일이나 디렉터리의 명세를 재구성해 달라고 요청하면 됩니다.

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
.claude-plugin/      플러그인 및 마켓플레이스 매니페스트, .mcp.json 연결
showcase.html        데모 산출물용 탭형 뷰어
```

## 근거

- `demo-hookify/`에는 낯선 서드파티 패키지를 대상으로 한 변경 없는 실행 결과가 들어 있습니다. 전체 산출물 세트를 생성했으며, 이미 구현된 기능을 future work처럼 설명하던 오래된 소스 주석도 찾아냈습니다.
- `evals/BENCHMARK.md`는 동일한 프롬프트에서 스킬 사용 결과와 기준선 결과를 비교합니다. 스킬은 86-87% 인용 커버리지를 보였고 기준선은 0%였으며, 샘플링한 인용 6개 중 6개가 정확했습니다.
- 커넥터 테스트 스위트는 데모 감사 로그의 12개 인용을 고정 커밋에 대해 재생하고 기계적으로 검증합니다. 테스트는 49개이며, 적대적 리뷰에서 발견된 사항에 대한 회귀 테스트도 포함합니다.

## 개발

변경사항을 제출하기 전에 커넥터 테스트를 실행하세요.

```bash
cd connector
npm test
```

선택적 acceptance test를 실행하려면 `HOOKIFY_ROOT`가 Claude Code 체크아웃의 `plugins/hookify` 디렉터리를 가리켜야 합니다.

`SKILL.md` 또는 `references/` 안의 파일을 수정했다면 플러그인 사본을 동기화하세요.

```bash
node scripts/sync-plugin-skill.mjs
```

루트 스킬 파일과 플러그인 레이아웃 사본이 달라지면 테스트가 실패합니다.

## 기여

이슈와 풀 리퀘스트를 환영합니다. 동작을 문서화할 때는 이 도구가 강제하는 것과 같은 기준을 따르세요. 해당 주장을 뒷받침하는 정확한 소스 라인을 인용해야 합니다.

## 라이선스

[MIT](LICENSE)
