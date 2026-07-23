# task05-change — CONTROL (연결자 없이, 조건순서 first)

**Prompt**: `SPEC.md` System Purpose에 gRPC 기본 h2c·`RemoteTlsEnabled` 시 TLS 조건을 한 구절 보강(인용 포함).

## 제안 diff (control이 독립 도출)
System Purpose의 gRPC 문장에 다음 절 추가:
> "기본 h2c 평문이며 `RemoteTlsEnabled`면 PFX로 TLS(HTTP/2), 인증서 로드 실패 시 평문 폴백 없이 원격을 열지 않는다(fail-closed)  `Source/FerMass/FerMass/Program.cs:141`"

## 근거 (grep 1회)
- `기본 h2c, RemoteTlsEnabled=true면 PFX로 TLS`  `Source/FerMass/FerMass/Program.cs:86`
- fail-closed 서술(평문 폴백 금지)  `Source/FerMass/FerMass/Program.cs:133`–135, 분기 `:141`

## 도구 트레이스 (실측)
- Grep 1회 (Program.cs)
- 고유 소스 읽기: **1** · 중복 읽기: 0
- connector 호출: **0**
- 결과: **Pass** — 최소 1줄 정정, 기존 서술과 모순 없음, 인용 동반
- 인용 정확도: 제안 인용 1건 correct (Program.cs:141)
