# task01-navigation — CONTROL (연결자 없이)

**Prompt**: Modbus(FFU) CRC16 규격 — 초기값·다항식·바이트 순서 — 정의 위치와 값.

## 답변
- `ModbusCrc(byte[], int)`: 초기값 **0xFFFF**, 다항식 **0xA001**(reversed 0x8005), 비트 8회 우측 시프트·LSB=1이면 XOR  `Source/FerMass/FerMass.Devices/Drivers/FfuModbusTransport.cs:276`(init 278, poly 283)
- 바이트 순서: **low-byte-first**(Modbus) — `AppendCrc`가 `crc & 0xFF` 먼저, `crc >> 8` 뒤  `Source/FerMass/FerMass.Devices/Drivers/FfuModbusTransport.cs:271`
- 수신 검증 `VerifyCrc`도 lo/hi 분리 대조  `Source/FerMass/FerMass.Devices/Drivers/FfuModbusTransport.cs:260`

## 도구 트레이스 (실측)
- Grep 1회 (FfuModbusTransport.cs, 패턴 `0xFFFF|0xA001|ModbusCrc|...`)
- 고유 소스 읽기: **1** (FfuModbusTransport.cs) · 중복 읽기: **0**
- connector 호출: **0**
- 결과: **Pass** — 초기값/다항식/바이트순서 모두 정확, file:line 3건 인용
- 인용 정확도: 3/3 checked correct
