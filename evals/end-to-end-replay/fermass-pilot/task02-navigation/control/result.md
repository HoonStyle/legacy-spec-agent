# task02-navigation — CONTROL (연결자 없이)

**Prompt**: `MeasurementResult`의 Mass/LoadCell/Offset이 채워지는 계산 위치와 공식.

## 답변 (동일 결론)
- `loadCell = mass + MassOffset`(`:156`), `buoyancy = BuoyancyCalculator.Buoyancy(...)`(`:157`), `finalMass = Round(loadCell+buoyancy,7)`(`:158`), `offset = OffsetCalculator.Offset(finalMass, loadCell)`(`:159`); 결과 대입 `Mass/LoadCell/Offset`(`:164`–166)  `Source/FerMass/FerMass.Modules/Handlers/MlcHandler.cs`

## 도구 트레이스 (실측)
- Grep 1회 (MlcHandler.cs)
- 고유 소스 읽기: **1** · 중복 읽기: **0**
- connector 호출: **0**
- 결과: **Pass** — 공식/대입 정확
- 인용 정확도: 5/5 correct
- 부가관찰: grep이 두 번째 매핑 블록(`:351`–353, 캘/측정 경로)도 반환 → 어느 블록이 "채우는" 곳인지 사람이 판별 필요(커넥터 조건은 앵커로 5-2 블록만 특정).
