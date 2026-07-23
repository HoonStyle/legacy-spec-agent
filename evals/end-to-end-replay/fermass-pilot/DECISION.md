# End-to-end replay pilot — Pair review & Decision record

Repo `1984b4e` · legacy-spec connector(MCP) vs 비연결자 대조 · 5쌍 10런.

## Pair review (connector − control)

Primary measure = 소스 읽기 수. 부가 = connector 호출 수(그 자체가 오버헤드)·인용·결과.

| Task | 읽기 control→connector (Δ) | connector 호출 | 결과(둘 다) | 인용 품질 |
|---|---|---|---|---|
| task01-navigation | 1 → 0 (**−1**) | +1 | Pass=Pass | connector가 라인 278로 교정 |
| task02-navigation | 1 → 0 (**−1**) | +1 | Pass=Pass | connector가 라인 156 확정 |
| task03-impact | 1 → 1 (**0**) | +2 (1건 오버플로 낭비) | Pass=Pass | 동일 7/7 |
| task04-impact | 2 → 0 (**−2**) | +2 | Pass=Pass | 동일; control은 `grep -c`로 동률 |
| task05-change | 1 → 0 (**−1**) | +1 | Pass=Pass | connector가 스니펫 `match` 보증 |

### 집계
- **primary(읽기) 개선 쌍**: 4 / 5 (task03 동률)
- **읽기 Δ 중앙값**: **−1**
- **repeated reads Δ 중앙값**: 0 (양 조건 중복읽기 0 — 리포 소규모·기지식)
- **elapsed Δ 중앙값**: not measured (시계 미접근)
- **pass/partial/fail**: control 5/0/0 · connector 5/0/0
- **인용 오류**: 0 / 0 (connector는 추가로 라인 교정·match 보증 제공)
- **연결자 런이 색인 소스를 재열람한 빈도**: 낮음 — connector 조건 대부분 읽기 0(커넥터 반환 소스로 응답). 단 task03은 필드 참조를 위해 grep 재실행 필요.
- **연결자 오버헤드 제외 시에만 성립하는 결과**: **예 (핵심)** — 읽기 −1은 대부분 "읽기 1 → connector 호출 1"의 1:1 치환. connector 호출 토큰비용(반환 소스 10~30줄)이 grep+read와 대등하다고 보면 **순이득은 오버헤드 제외 시에만 존재**.

## 관찰된 실패 모드 (작업 제안 전 식별 — 프로토콜 요구)
1. **`build_call_graph`(package) 토큰 오버플로**: 이 C# 리포에서 package 단위인데도 103,681자 반환 → 실질 낭비 호출(task03). 대형 C# 리포에 부적합.
2. **필드/참조 검색 부재**: `index_symbols`는 정의(클래스/메서드)만, 필드 참조는 못 찾음 → impact 태스크는 커넥터 조건에서도 grep 필수(순이득 0, task03).
3. **정정된 가정**: `index_symbols`/`build_call_graph`는 이 플러그인(0.2.0)에서 **C#를 지원**한다(`unsupported_files:0`). ReverseSpec/SPEC.md의 "커넥터 심볼/콜그래프 C# 미지원" 서술은 구버전 기준 — **드리프트 후보**(코드가 아닌 도구 서술이므로 SPEC 재검토 필요).

## 커넥터의 실제 이점 (관찰된 것만)
- `verify_citation`의 **결정적 소스 반환 + moved-candidate(suggested_line)**: 인용 라인 자동 교정(task01 276→278, task02 →156)·스니펫 `match` 보증(task05). 인용 정확도 관점 이점은 실재. 단 토큰 절감으로 이어지는지는 미노출.

## Decision

> **INCONCLUSIVE** (프로토콜 §Decision — 확장 승인 전 불확실성 원인 명시)

- **근거**: primary(읽기)는 4/5 개선·중앙값 −1이나, 이는 대체로 "읽기→connector 호출" 1:1 치환이며 **진짜 계량 지표(provider 토큰)가 미노출**이라 순개선을 확증할 수 없다. 프로토콜상 "개선이 연결자 오버헤드 제외 시에만 성립"에 해당 → Continue 기준 미충족, 그렇다고 품질 퇴행(0건)·재열람 과다도 아니므로 순수 stop도 아님.
- **불확실성의 구체적 원천**: ① provider 토큰 카운터 부재(핵심 지표 측정 불가), ② elapsed 미측정, ③ 표본 5쌍·소규모 기지식 리포라 읽기 절감 신호가 약함.
- **품질 판정**: 태스크 정확도·인용은 퇴행 없음(오히려 connector가 라인 교정 제공). **의미 백엔드 부재가 실패나 낭비 읽기를 유발하지 않았다**(10/10 Pass) → 프로토콜 지침상 언어 리졸버/의미 백엔드 재개 **불필요**.

### 확장(최대 10~20 태스크) 승인 전 선행 조건
1. **토큰 카운터 확보**: 동일 페어를 provider usage 대시보드가 노출되는 환경에서 재실행(런별 in/cached/out 기록). 그 전엔 continue/stop 미판정.
2. **`build_call_graph` 대형 C# 리포 대응**: `limit`/`subdir`로 경계, 또는 package 요약이 상한 안에 들도록 수정(오버플로 낭비 제거).
3. 확장 시 태스크에 **참조/영향 중심**을 더 넣지 말 것 — 현 커넥터엔 C# 참조검색이 없어 grep 대비 이점 미검증.
