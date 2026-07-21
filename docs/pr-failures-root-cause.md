# PR 연쇄 실패 근본원인 분석

작성일: 2026-07-21
대상: 열려 있던 PR #33 ~ #39 (모두 CI 실패)

---

## 1. 현상 (Symptom)

- 동시에 열려 있던 PR **7개(#33~#39)** 가 전부 CI에서 실패.
- 7개 모두 **동일한 Codex 작업**의 산출물(멀티랭귀지 파서 + toolchain 다운로드 + connector v0.1.3)로, 사실상 같은 변경이 중복 생성됨.
- 각 PR의 CI 결과가 항상 동일한 패턴:

  | Job | 결과 |
  |---|---|
  | ubuntu-latest, Node 20 | ✅ success |
  | ubuntu-latest, Node 22 | ✅ success |
  | **windows-latest, Node 20** | ❌ failure |
  | **windows-latest, Node 22** | ❌ failure (※) |

  > (※) 이 표는 당시 관측 기록이다. 이후 최소 재현(§3)에서는 **Node 20에서만** 재현됐고
  > Node 22 Windows 실패는 재확인하지 못했다 — §3 “근거 구분” 표의 미확정 항목 참조.

- 메인 유닛/통합 테스트(97개)는 Windows 포함 전 플랫폼에서 통과.
  실패하는 것은 오직 이 PR들이 **새로 추가한** `Installed plugin smoke` 단계
  (`run-installed-smoke.mjs` → `dist/test/installed-plugin.test.js`)뿐이며, **Windows에서만** 실패.

## 2. 실패 지점 (정확한 위치)

`connector/test/installed-plugin.test.ts:71` (컴파일된 `dist/test/installed-plugin.test.js:71`):

```ts
assert.equal(existsSync(join(installedConnector, "node_modules")), false);
//   Windows: actual: true !== expected: false  → AssertionError
```

의미: 설치형 플러그인(clean git install)을 흉내내려고 connector를 임시 폴더로 복사한 직후,
`node_modules`가 **없어야** 하는데 Windows에서는 복사본에 남아 있음.

복사 코드(수정 전):

```ts
cpSync(connector, installedConnector, {
  recursive: true,
  filter(source) {
    const first = relative(connector, source).split(/[\\/]/)[0];
    return first !== "node_modules" && first !== "dist";
  },
});
```

## 3. 근본원인 (Root Cause)

두 층위로 나뉜다.

### (A) 프로세스: 중복 PR 양산
같은 Codex 태스크를 여러 번 실행해 동일 변경이 7개의 병렬 PR로 쌓였다.
코드 문제 이전에 "같은 변경을 7번 올린" 운영 문제.

### (B) 기술: cpSync가 filter에 `\\?\` 확장 경로를 넘겨 denylist가 무력화됨 (Node 20 Windows 한정)

> 2026-07-21 갱신: 이 절의 초기 가설(“필터 식은 맞다 / junction reparse point”)은
> **실제 Windows 러너 재현 실험으로 반증**되었다. 최소 재현 스크립트
> (`scripts/repro-cpsync-win.mjs`, 진단 후 제거)를 windows-latest × Node 20/22에서 돌려
> 아래 사실을 확정했다.

**확정된 메커니즘:**

Windows Node 20의 cpSync는 filter 콜백에 소스 경로를 **`\\?\` 확장 길이(namespaced) 접두사가
붙은 형태**로 넘긴다. 반면 호출부가 넘긴 `source` 문자열에는 접두사가 없다:

```
넘긴 source     = C:\Users\...\connector                        (접두사 없음)
filter 수신 src = \\?\C:\Users\...\connector\node_modules        (\\?\ 붙음)

relative(source, src) = "\\?\C:\Users\...\connector\node_modules"  ← 세그먼트가 아니라 "전체 경로"
first = split(/[\\/]/)[0] = ""                                     ← 맨 앞 백슬래시 → 빈 문자열
DENY.has("") === false → keep = true → node_modules·dist 전부 복사됨 ❌
```

`path.relative()`가 **접두사 붙은 경로 vs 안 붙은 경로**를 서로 다른 루트로 취급해 두 번째 경로를
통째로 반환하므로, `relative(...).split(sep)[0]` 가 `""` 이 되어 denylist가 한 번도 매치되지 않는다.

**즉 “필터 식은 맞다”는 처음 판단은 틀렸다.** `relative(base, src).split(sep)[0]` 방식은
cpSync가 `\\?\` 접두사 경로를 넘기는 순간 깨지는 **잠재 버그**였고, Linux/Node 22에서는
접두사가 없어 우연히 드러나지 않았을 뿐이다.

**버전 의존성 (실험 결과):**

| 환경 | 결과 | 비고 |
|---|---|---|
| windows-latest, Node 20 (20.20.2) | ❌ `node_modules`·`dist` 누출 | filter가 `\\?\` 경로 수신 → `first=""` |
| windows-latest, Node 22 | ✅ 정상 | 접두사 없는 경로 전달로 동작 변경(수정)됨 |
| ubuntu-latest, Node 20/22 | ✅ 정상 | `\\?\` 개념 없음 |
| Variant B (allowlist 개별 복사, #39) | ✅ 전부 정상 | `relative()`에 의존하지 않음 |

결론: 이것은 “플랫폼 상호작용/junction”이 아니라 **Node 20 Windows에 존재하다 Node 22에서
고쳐진 버전 의존 동작**이다. 근본원인은 ① cpSync가 filter에 `\\?\` 확장 경로를 넘긴 점,
② 그 경로 형태에 취약한 `relative().split()[0]` 필터 식, 두 가지의 조합이다.

**이것은 Node에 문서화된 알려진 이슈다 — 우리 코드 특유의 문제가 아니다.**

- [nodejs/node#44720 — “[fs.cp] fails with EPERM despite filter”](https://github.com/nodejs/node/issues/44720):
  Windows에서 `cpSync`가 filter 콜백에 `\\?\` 접두사 절대경로를 넘긴다는 사실이 그대로 보고돼 있다
  (예: filter가 받은 경로 = `\\?\B:\System Volume Information`). 우리가 관측한 `first=""`와 동일한 원인.
- 그 이슈의 수정([PR #45143](https://github.com/nodejs/node/pull/45143), 커밋 `1db20c8`)은 filter를
  stat *이전에* 평가하도록 옮겨 **EPERM 크래시만** 없앴을 뿐, **filter에 넘기는 경로 형태(`\\?\`)는
  바꾸지 않았다.** 이 EPERM 수정은 Node 20 이전 릴리스에 포함됐으므로, Node 20은
  “크래시는 안 나지만 filter가 여전히 `\\?\` 경로를 받는” 상태였다 → 그래서 denylist가 무력화된다.

**근거 구분 (넘겨짚지 않도록):**

| 항목 | 상태 |
|---|---|
| Windows에서 filter가 `\\?\` 경로를 받는 것이 알려진 이슈인가 | ✅ 확정 (#44720) |
| Node 20에서 실제로 그 동작이 일어나 누출됐는가 | ✅ 확정 (windows-latest Node 20.20.2 러너 직접 관측) |
| Node 22에서는 `\\?\` 없이 정상인가 | ✅ 확정 (동일 러너 관측) |
| 20→22 사이 어느 PR/릴리스가 filter 경로에서 `\\?\`를 제거했는가 | ⬜ 미확정 (#45143은 그 변경이 아님 — 별도 후속 변경으로 추정, 커밋 미특정) |
| 실제 connector가 §1 표대로 Node 22 Windows에서도 실패했는가 | ✅ 확정 — **단, cpSync 때문이 아님** (아래 (C) 참조) |

> 첫 항목(정확한 수정 커밋)은 실무 영향이 없다: #39의 allowlist 수정이 `relative()`에 의존하지 않아
> 경로 형태·Node 버전과 무관하게 cpSync 누출을 원천 차단하기 때문이다.

### (C) 두 번째 Windows 실패: 정리 단계의 `EBUSY` (cpSync와 별개, 미해결)

allowlist 수정으로 §2의 `node_modules` assert는 통과하지만, **#39의 최신 CI는 여전히
windows-latest Node 20·22 둘 다 실패한다.** 실패 지점이 §2와 완전히 다르다:

```
error: "EBUSY: resource busy or locked, rmdir '...\plugin Ω space\connector'"
  at rmSync(workspace, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })  // finally 블록
```

- 테스트 본문은 ~62초간 **끝까지 성공**한다(bootstrap → `npm ci` → build → 5개 언어 `index_symbols`).
- `finally`의 `rmSync(workspace, …)` 정리에서 Windows가 아직 열린 파일 핸들(스폰된 MCP 서버
  자식 프로세스가 잡고 있는 `connector` 하위 파일 추정)을 놓지 못해 **EBUSY**로 실패.
- Node 20·22 **둘 다** 여기서 죽으므로 **버전 의존이 아니라** Windows 일반의 파일락/teardown 문제.
- `maxRetries: 10 / retryDelay: 100`(총 ~1s)로는 핸들 해제를 못 기다린다.

즉 §1 표의 “Node 22 Windows도 실패”는 사실이었고, 그 원인은 cpSync가 아니라 **이 EBUSY teardown**이다.
cpSync 누출(§B, Node 20 한정)과 EBUSY 정리(§C, 전 Windows)는 **서로 다른 두 버그**이며,
#39는 전자만 고쳤다. 후자는 아직 미해결(예상 조치: 클라이언트 close 후 자식 프로세스 종료를 확실히
대기, `rmSync` 재시도/대기 시간 상향, 또는 정리 실패를 비치명적으로 처리).

## 4. 조치 (별도 진행)

이 문서는 **현상·원인 기록**용이며, 실제 코드 수정은 별도로 진행됨:

- **#39에 수정 push**: 재귀 필터에 의존하지 않고, 최상위에서 `node_modules`/`dist`를
  **아예 cpSync에 넘기지 않도록** 항목별 복사로 변경. cpSync가 filter에 `\\?\` 확장 경로를
  넘겨 denylist가 무력화되는 위 문제를 원천 차단하며, git이 실제 shipping하는 내용과 정확히 일치.

  ```ts
  mkdirSync(installedConnector, { recursive: true });
  for (const entry of readdirSync(connector)) {
    if (entry === "node_modules" || entry === "dist") continue;
    cpSync(join(connector, entry), join(installedConnector, entry), { recursive: true });
  }
  ```

  검증(Linux): 스모크 `pass 1`, 전체 스위트 `97 tests / fail 0`.

- **#33~#38 close**: #39로 통합, 각 PR에 안내 코멘트 남김.

## 5. 재발 방지 제언

- **Codex 태스크당 1 PR** 운영 — 같은 태스크 반복 실행 시 병렬 PR이 쌓임.
- **크로스플랫폼 파일 조작 원칙**: `cpSync(recursive) + denylist filter`에 기대지 말 것.
  filter가 받는 경로 형태는 플랫폼·Node 버전마다 다르며(Windows Node 20은 `\\?\` 접두사 —
  [nodejs/node#44720](https://github.com/nodejs/node/issues/44720)), `relative(base, src)` 기반
  매칭은 이때 깨진다. 제외 대상은 아예 대상 경로를 넘기지 않는 **allowlist / 개별 복사** 방식이
  안전. filter 안에서 경로 비교가 꼭 필요하면 filter 인자를 `path.resolve()`로 정규화하고
  비교 기준(base)도 같은 방식으로 정규화한 뒤 비교할 것 — 문자열 접두사에 의존하지 말 것.
- **Windows 지원 필요성 재검토**: 이 플러그인이 Windows 중심 사용자층이 아니라면,
  Windows 레그를 `continue-on-error`로 두거나 설치형 스모크를 ubuntu에서만 돌려
  머지 게이트에서 제외하는 것도 유효한 선택지.
