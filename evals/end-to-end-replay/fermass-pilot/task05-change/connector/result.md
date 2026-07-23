# task05-change — CONNECTOR (연결자 사용)

**Prompt**: `SPEC.md` System Purpose에 gRPC 기본 h2c·`RemoteTlsEnabled` 시 TLS 조건을 한 구절 보강.

## 제안 diff (control과 동일) — 적용됨
System Purpose gRPC 문장에 "기본 h2c 평문 / `RemoteTlsEnabled`→PFX TLS / 인증서 실패 시 fail-closed" 절 추가, 인용 `chamber.proto:10`·`Program.cs:141`.
→ 페어 종료 후 SPEC.md에 **1회만** 적용(양 조건 diff 동일).

## 도구 트레이스 (실측)
- `verify_citation`(Program.cs:141, snippet `if (config.RemoteTlsEnabled)`) 1회 — `verdict: match`, StartRemoteHost의 fail-closed 주석(133–135)·분기(141)·미시작 return(151) 반환
- 고유 소스 읽기: **0** · 중복 읽기: 0
- connector 호출: **1**
- 결과: **Pass** — 제안 diff 정확·인용 동반, 커넥터가 스니펫 일치(match)로 인용 확정
- 인용 정확도: 1/1 match

## 관찰
- change 태스크에서 커넥터 이점 = 제안 인용의 **결정적 확정**(match/스니펫). control은 grep로 근거를 봤으나 인용 정확성 보증은 사람 판단. 값 판정엔 소폭 플러스(정확도 보증), 읽기 절감은 1건.
