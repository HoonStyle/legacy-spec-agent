# task03-impact — CONNECTOR (연결자 사용)

**Prompt**: `MassOffset`(machineConfig) 값을 바꾸면 영향받는 코드/설정 경로 열거.

## 답변 (control과 동일한 7경로)
동일 결론(정의 `MachineConfig.cs:168` · 로더 `AppConfigMachineConfigLoader.cs:95` · 설정 `machineConfig.config:145` · 계산 `MlcHandler.cs:155`+전파 · 부력 `BuoyancyCalculator.cs:27` · 계약 `ModuleServices.cs:35` · 테스트 2파일). 8파일 15occurrence.

## 도구 트레이스 (실측)
- `index_symbols`(subdir=`FerMass.Data/Config`) 1회 — **C# 완전 파싱**: 3파일·20심볼·`unsupported_files:0`. `MachineConfig` 클래스(63–200)·`AppConfigMachineConfigLoader.Load`(20–114) 등 컨테이닝 심볼 정확 특정. **단, 필드(`MassOffset`) 참조는 심볼 인덱스에 없음**(클래스/메서드만).
- `build_call_graph`(package) 1회 — **토큰 초과**(103,681자/1,489줄)로 오버플로, 파일로 저장됨. package 단위인데도 과대 → 이 리포엔 부적합(커넥터 러프 엣지).
- Grep 1회 — 필드 참조 실제 열거(8파일 15건). **커넥터엔 C# 참조검색 도구가 없어 grep 필수.**
- 고유 소스 읽기: **1**(grep) · 중복 읽기: 0
- connector 호출: **2** (index_symbols, build_call_graph[overflow])
- 결과: **Pass** — control과 동일 결론
- 인용 정확도: 7/7 correct

## 관찰 (판정에 중요)
- **정정**: index_symbols는 이 플러그인(0.2.0)에서 **C#를 지원**한다(SPEC의 "C# 미지원" 서술은 구버전 기준 — 별도 드리프트 후보).
- 그러나 **impact/reference 태스크에는 심볼 인덱스가 직접 도움 안 됨**(참조 아닌 정의만). 결국 grep로 control과 동일 작업 → 커넥터 순증: connector 호출 +2(1건은 오버플로 낭비), 읽기 절감 0.
