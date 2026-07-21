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

### (B) 기술: recursive cpSync + denylist filter 조합이 Windows에서 신뢰 불가

확인된 사실:

1. **필터 문자열 로직 자체는 올바르다.** Windows 스타일 경로로 직접 검증:

   ```
   base = D:\a\...\connector
   relative(base, base\node_modules) = "node_modules" → split[0] = "node_modules" → 제외됨(true)
   relative(base, base\dist)         = "dist"         → split[0] = "dist"         → 제외됨(true)
   ```
   즉 `relative(...).split(/[\\/]/)[0]` 는 Windows에서도 node_modules/dist를 정확히 걸러낸다.
   → **오타·논리 오류가 아니다.**

2. **그럼에도 실제 Windows 러너에서는 node_modules가 복사본에 남는다** (위 assert가 증명).

3. Linux에서는 동일 코드가 정상 동작(스모크 통과) — 즉 **Windows 전용** 문제.

결론: 버그는 "필터 식이 틀렸다"가 아니라, **Node의 `cpSync`가 Windows에서 재귀 필터를
적용하는 방식 / 필터에 넘기는 실제 경로 형태와의 상호작용**에 있다.
(유력 가설: Windows의 `node_modules`에는 `.bin` junction 등 reparse point가 섞여 있고,
cpSync가 재귀하며 필터에 넘기는 경로가 realpath 등으로 정규화되면서 `relative()` 결과의
첫 세그먼트가 `node_modules`가 아니게 되어 필터를 통과.)

> 정확한 내부 메커니즘은 Windows 러너 없이는 100% 단정 불가.
> 확실한 것: ① 필터 식은 맞다 ② 그럼에도 결과적으로 안 걸러진다 ③ 원인 카테고리는 cpSync–Windows 상호작용.

## 4. 조치 (별도 진행)

이 문서는 **현상·원인 기록**용이며, 실제 코드 수정은 별도로 진행됨:

- **#39에 수정 push**: 재귀 필터에 의존하지 않고, 최상위에서 `node_modules`/`dist`를
  **아예 cpSync에 넘기지 않도록** 항목별 복사로 변경. Windows cpSync 재귀 필터 quirk와
  junction 복사 위험을 원천 차단하며, git이 실제 shipping하는 내용과 정확히 일치.

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
- **크로스플랫폼 파일 조작 원칙**: `cpSync(recursive) + denylist filter`처럼 플랫폼 의존 동작에
  기대지 말 것. 제외 대상은 아예 대상 경로를 넘기지 않는 **allowlist / 개별 복사** 방식이 안전.
- **Windows 지원 필요성 재검토**: 이 플러그인이 Windows 중심 사용자층이 아니라면,
  Windows 레그를 `continue-on-error`로 두거나 설치형 스모크를 ubuntu에서만 돌려
  머지 게이트에서 제외하는 것도 유효한 선택지.
