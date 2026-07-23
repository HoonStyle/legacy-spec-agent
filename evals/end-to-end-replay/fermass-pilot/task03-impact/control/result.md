# task03-impact — CONTROL (연결자 없이, 조건순서 first)

**Prompt**: `MassOffset`(machineConfig) 값을 바꾸면 영향받는 코드/설정 경로 열거.

## 영향 경로 (grep 1회로 도출)
1. **설정 정의**: `MachineConfig.MassOffset { get; set; } = 0m`  `Source/FerMass/FerMass.Data/Config/MachineConfig.cs:168`
2. **설정 로더**: `AppConfigMachineConfigLoader`가 `appSettings` "MassOffset" 파싱  `Source/FerMass/FerMass.Data/Config/AppConfigMachineConfigLoader.cs:95`
3. **설정 값(파일)**: `machineConfig.config` `<add key="MassOffset" value="0"/>`  `Source/FerMass/FerMass/machineConfig.config:145`
4. **소비/계산**: `MlcHandler`에서 `loadCell = mass + MassOffset`  `Source/FerMass/FerMass.Modules/Handlers/MlcHandler.cs:155` → 이후 `Mass=Round(loadCell+Buoyancy,7)`·`Offset=Round(Mass−LoadCell,7)`·`BuildRecord(...loadCell...)`로 전파(동일 파일 157–159, 179)
5. **부력 계산 입력**: `BuoyancyCalculator.Buoyancy`의 loadCell 인자로 유입  `Source/FerMass/FerMass.Measurement/BuoyancyCalculator.cs:27`
6. **서비스 주입 계약**: `ModuleServices`(MassOffset 미주입 시 기본 0)  `Source/FerMass/FerMass.Modules/ModuleServices.cs:35`
7. **테스트 영향**: `AppConfigMachineConfigLoaderTests`(파싱 1.25), `MlcHandlerTests`(MassOffset=0.5 케이스)  `Source/FerMass/FerMass.Modules.Tests/MlcHandlerTests.cs:227`

## 도구 트레이스 (실측)
- Grep 1회 (Source 전역, 패턴 `MassOffset`) → 8개 파일 히트
- 고유 소스 읽기: **1**(grep, 다중 파일) · 중복 읽기: **0**
- connector 호출: **0**
- 결과: **Pass** — 정의·로더·설정파일·계산·부력·계약·테스트 7경로 식별, 다운스트림(Mass/Offset/BuildRecord)은 형식으로 전파 추론
- 인용 정확도: 7/7 correct
