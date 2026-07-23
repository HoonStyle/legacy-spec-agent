# End-to-end replay pilot — Run records

> 런당 1행. Provider 토큰 카운터는 세션 내 미노출 → `not exposed`(추정 금지). Elapsed는 스크립트 시계 접근 불가 → `not measured`. Primary measure = **소스 읽기 수 + connector 호출 수**(실제 도구 트레이스 집계). Repo `1984b4e`, model `claude-opus-4-8[1m]`.

| Task / cond | 토큰(in/cached/out/reason) | Primary(고유+중복 읽기) | connector 호출/오버플로 | 고유/중복 읽기 | Elapsed | 결과 | 인용 | Raw evidence |
|---|---|---|---|---|---|---|---|---|
| task01 / **control** | not exposed | 1 | 0 / 0 | 1 / 0 | not measured | Pass | 3/3 correct | task01-navigation/control/result.md |
| task01 / **connector** | not exposed | 0 | 1 / 0 | 0 / 0 | not measured | Pass | 3/3 (라인 278 교정) | task01-navigation/connector/result.md |
| task02 / **connector** | not exposed | 0 | 1 / 0 | 0 / 0 | not measured | Pass | 5/5 (라인 156 확정) | task02-navigation/connector/result.md |
| task02 / **control** | not exposed | 1 | 0 / 0 | 1 / 0 | not measured | Pass | 5/5 correct | task02-navigation/control/result.md |
| task03 / **control** | not exposed | 1 | 0 / 0 | 1 / 0 | not measured | Pass | 7/7 correct | task03-impact/control/result.md |
| task03 / **connector** | not exposed | 1 | 2 / 1(build_call_graph) | 1 / 0 | not measured | Pass | 7/7 correct | task03-impact/connector/result.md |
| task04 / **connector** | not exposed | 0 | 2 / 0 | 0 / 0 | not measured | Pass | 2/2 match, 개수11 | task04-impact/connector/result.md |
| task04 / **control** | not exposed | 2 | 0 / 0 | 2 / 0 | not measured | Pass | 2/2 correct, 개수11 | task04-impact/control/result.md |
| task05 / **control** | not exposed | 1 | 0 / 0 | 1 / 0 | not measured | Pass | 1/1 correct | task05-change/control/result.md |
| task05 / **connector** | not exposed | 0 | 1 / 0 | 0 / 0 | not measured | Pass | 1/1 match | task05-change/connector/result.md |

## 카운터 주의 (프로토콜 §Run record)
- Provider 범주 중첩 가능성 때문에 tool-response 토큰을 input에 합산하지 않음 — 어차피 전부 `not exposed`.
- "고유/중복 읽기"는 각 런에서 실제 실행한 Read/Grep/Glob 횟수. connector 조건이 커넥터 반환 소스로 답한 경우 읽기 0.
- connector "오버플로"는 토큰 상한 초과로 파일 저장된 호출(실질 낭비). task03의 `build_call_graph`(package)가 103,681자로 오버플로.
