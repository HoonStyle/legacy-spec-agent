# End-to-end replay pilot — Task manifest

> `END_TO_END_REPLAY.md`(legacy-spec-agent 플러그인 루트) 절차에 따른 페어드 리플레이 파일럿.
> 목적: connector(legacy-spec MCP)의 가치에 대한 **continue / narrow / stop** 저비용 판정. 일반 성능 주장 아님.

## Scope

- **Repository**: FerMass (단일 리포)
- **Revision (pinned)**: `1984b4e324b9e4bec7fa2c7f48fc1b105737fbee`
- **Language**: C# / .NET 8 (`net8.0-windows`)
- **Tasks**: 스펙 중심 5개 (navigation 2 · impact 2 · change 1)
- **Runs**: 태스크당 control(연결자 없이) 1 + connector(연결자 사용) 1 = **10런**
- **연결자 미추가**: 파일럿 동안 connector 기능 변경 없음

## Paired-run controls (각 페어 내 동일 유지)

| 항목 | 값 |
|---|---|
| Repository revision | `1984b4e` (clean, 트래킹 수정 0) |
| Prompt · 완료기준 | 태스크별 고정(아래), 조건 본 뒤 재작성 금지 |
| Model | claude-opus-4-8[1m] (동일 세션) |
| 비연결자 도구 | Read / Grep / Glob / Bash (양 조건 공통) |
| 연결자 도구 | control=**금지**, connector=`verify_citation`·`detect_drift`·`index_symbols`·`extract_*` 허용 |
| 환경 | 동일 세션, 동일 워킹트리 |

**조건 순서 교대**: task01·03·05 = control→connector, task02·04 = connector→control.

## 측정 방식 (사용자 확정)

- **Provider 토큰 카운터(input/cached/output/reasoning)**: 세션 내 런별 미노출 → 전부 `not exposed`(추정 금지, 프로토콜 §Run record 준수).
- **Primary metered measure (proxy)**: **고유/중복 소스 읽기 수 + connector 호출 수**. 보조: 태스크 결과·인용 정확도.
- **Elapsed time**: 스크립트 시계 접근 불가 → `not measured`(런별 벽시계 미기록). 판정에서 제외.
- 관찰 지표는 각 런의 실제 도구 호출 트레이스에서 집계(추정 아님).

## Task manifest

| Task ID | Type | Prompt (완료기준) | 조건순서 |
|---|---|---|---|
| **task01-navigation** | Navigation | "Modbus(FFU) CRC16 규격 — 초기값·다항식·바이트 순서 — 정의 위치와 값을 `file:line`으로." **Pass**: `FfuModbusTransport.cs`의 `ModbusCrc`를 초기 0xFFFF·다항식 0xA001·low-byte-first로 정확 인용. | control→connector |
| **task02-navigation** | Navigation | "`MeasurementResult`의 Mass/LoadCell/Offset이 채워지는 계산 위치와 공식." **Pass**: `MlcHandler.cs`의 loadCell=mass+MassOffset·Mass=Round(loadCell+Buoyancy,7)·Offset=Round(Mass−LoadCell,7) 정확 인용. | connector→control |
| **task03-impact** | Impact | "`MassOffset`(machineConfig) 값을 바꾸면 영향받는 코드/설정 경로 열거." **Pass**: `MachineConfig.MassOffset`, `MlcHandler` loadCell 계산, `BuildRecord`, 설정 소스(App.config) 식별 + 인용. | control→connector |
| **task04-impact** | Impact | "`AlarmCodes` 대역 체계와 기동 시 등록되는 알람 정의 개수." **Pass**: `AlarmCodes.cs` 1xxx/2xxx/3xxx 대역 + `Program.cs` 알람정의 11종 정확 인용. | connector→control |
| **task05-change** | Change | "`SPEC.md` System Purpose에 gRPC 기본 h2c·`RemoteTlsEnabled` 시 TLS 조건을 한 구절 보강(인용 포함)." **Pass**: 최소 1줄 정정 diff가 정확·인용 동반, 기존 서술과 모순 없음. | control→connector |

> 무효 태스크 발생 시 해당 페어 양 런 폐기 후 사유 기록(프로토콜 §Task manifest). 조건별 프롬프트는 동일하며 결과를 본 뒤 수정하지 않는다.
