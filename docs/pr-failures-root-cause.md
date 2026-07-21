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
  | **windows-latest, Node 22** | ❌ failure |

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

> 남은 미해결: 최초 실패 표(§1)에는 실제 connector가 **Node 22 Windows에서도** 실패했다고
> 기록돼 있으나, 위 최소 재현은 **Node 20에서만** 실패한다. 실제 connector의 Node 22 실패는
> 다른 트리거(가득 찬 실제 node_modules 등)일 가능성이 있으며, 닫힌 PR(#33~#39)의 CI 로그
> 없이는 확정 불가. 다만 #39의 allowlist 수정이 두 경우 모두를 원천 차단하므로 실무상 영향은 없다.

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
  filter가 받는 경로 형태는 플랫폼·Node 버전마다 다르며(Windows Node 20은 `\\?\` 접두사),
  `relative(base, src)` 기반 매칭은 이때 깨진다. 제외 대상은 아예 대상 경로를 넘기지 않는
  **allowlist / 개별 복사** 방식이 안전. filter 안에서 경로 비교가 꼭 필요하면 양쪽을
  `path.resolve()`로 정규화한 뒤 비교할 것.
- **Windows 지원 필요성 재검토**: 이 플러그인이 Windows 중심 사용자층이 아니라면,
  Windows 레그를 `continue-on-error`로 두거나 설치형 스모크를 ubuntu에서만 돌려
  머지 게이트에서 제외하는 것도 유효한 선택지.
