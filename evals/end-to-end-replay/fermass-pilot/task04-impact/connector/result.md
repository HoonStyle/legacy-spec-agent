# task04-impact — CONNECTOR (연결자 사용, 조건순서 first)

**Prompt**: `AlarmCodes` 대역 체계와 기동 시 등록되는 알람 정의 개수.

## 답변
- 대역: **디바이스 1xxx**(1001/1002/1003/1010/1020), **모듈 2xxx**(2001/2002/2010/2011), **시스템 3xxx**(3001/3002)  `Source/FerMass/FerMass.Data/Alarm/AlarmCodes.cs:9`(모듈 16, 시스템 22)
- 기동 등록: `RegisterAlarmDefinitions`가 **11종** 등록  `Source/FerMass/FerMass/Program.cs:203`(등록 205–215, 11줄)

## 도구 트레이스 (실측)
- `verify_citation`(AlarmCodes.cs:9, ctx18) 1회 — `match`, 클래스 전체(대역 3구간) 반환
- `verify_citation`(Program.cs:203, ctx30) 1회 — `match`, `RegisterAlarmDefinitions` 블록 반환 → 등록 11건 직접 카운트
- 고유 소스 읽기: **0** · 중복 읽기: 0
- connector 호출: **2**
- 결과: **Pass** — 대역 3구간 + 개수 11 정확
- 인용 정확도: 2/2 match, 개수 11 확정
