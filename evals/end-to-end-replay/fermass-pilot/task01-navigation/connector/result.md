# task01-navigation — CONNECTOR (연결자 사용)

**Prompt**: Modbus(FFU) CRC16 규격 — 초기값·다항식·바이트 순서 — 정의 위치와 값.

## 답변 (동일 결론)
- `ModbusCrc`: 초기값 **0xFFFF**(`:278`), 다항식 **0xA001**(`:283`), low-byte-first(`AppendCrc :271`)  `Source/FerMass/FerMass.Devices/Drivers/FfuModbusTransport.cs`

## 도구 트레이스 (실측)
- `verify_citation` 1회 — `context_lines:10`으로 메서드 전체 소스를 결정적으로 반환, `suggested_line:278` 제시
- 내가 준 앵커(276=메서드 선언)와 스니펫(278=`ushort crc = 0xFFFF;`) 불일치를 `content_mismatch`로 즉시 교정 → 정확 라인 278 확정
- 고유 소스 읽기: **0** (Grep/Read 미사용, 커넥터 반환 소스로 답) · 중복 읽기: **0**
- connector 호출: **1**
- 결과: **Pass** — 값 3건 정확, 커넥터가 라인 교정까지 제공
- 인용 정확도: 3/3 (커넥터가 278로 보정)

## 관찰
- C# 대상이라 `index_symbols`/`build_call_graph`(Python/Lezer)는 무효 → 이 태스크에서 커넥터 이점은 오직 `verify_citation`의 결정적 소스 반환 + moved-candidate(suggested_line).
- control은 grep 1회로 동일 결론에 도달 → 이 태스크 유형에선 커넥터가 읽기 1건을 커넥터 1콜로 치환(순증감 미미).
