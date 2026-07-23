# task04-impact — CONTROL (연결자 없이)

**Prompt**: `AlarmCodes` 대역 체계와 기동 시 등록되는 알람 정의 개수.

## 답변 (동일 결론)
- 대역: 디바이스 1xxx(5)·모듈 2xxx(4)·시스템 3xxx(2)  `Source/FerMass/FerMass.Data/Alarm/AlarmCodes.cs:9`
- 등록: `alarms.Register(new AlarmDefinition(...))` **11회**  `Source/FerMass/FerMass/Program.cs`(grep count=11)

## 도구 트레이스 (실측)
- Read 1회 (AlarmCodes.cs 전체) + Grep count 1회 (Program.cs 등록 패턴 → 11)
- 고유 소스 읽기: **2** · 중복 읽기: 0
- connector 호출: **0**
- 결과: **Pass** — 대역 + 개수 11 정확
- 인용 정확도: 2/2 correct
- 부가관찰: `grep -c`가 등록 카운트에 커넥터만큼 효율적(11 직산출). 이 태스크는 커넥터·control 동률.
