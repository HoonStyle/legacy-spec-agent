# task02-navigation — CONNECTOR (연결자 사용, 조건순서 first)

**Prompt**: `MeasurementResult`의 Mass/LoadCell/Offset이 채워지는 계산 위치와 공식.

## 답변
- `MlcHandler`가 산출: `massOffset = cfg.MassOffset`(`:155`), `loadCell = mass + massOffset`(`:156`), `buoyancy = BuoyancyCalculator.Buoyancy(P,T,H,loadCell)`(`:157`), `finalMass = Round(loadCell + buoyancy, 7)`(`:158`), `offset = OffsetCalculator.Offset(finalMass, loadCell)`(`:159`)  `Source/FerMass/FerMass.Modules/Handlers/MlcHandler.cs`
- `MeasurementResult`에 `Mass/LoadCell/Offset`로 대입(`:164`~)

## 도구 트레이스 (실측)
- `verify_citation` 1회 — 5-2 블록(주석 공식 151–154 + 대입 155–159) 결정적 반환, `suggested_line:156`
- 고유 소스 읽기: **0** · 중복 읽기: **0**
- connector 호출: **1**
- 결과: **Pass** — 공식 3식 정확 인용, 커넥터가 라인 확정(156)
- 인용 정확도: 5/5 checked correct
