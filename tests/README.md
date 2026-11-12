# 검사 (tests/)

## 왜 이 폴더가 생겼나

2026-11-12, 검사용 문항이 **실제 `item_bank` 에 세 번 들어갔다**(11:50 · 21:27 · 21:30, 매번 7줄).
들어간 글은 `Sample passage number 1 about curiosity and learning…` 과 `고친 발문입니다` — 검사 스크립트가 만드는 가짜 문항이다.

원인은 `verify_iso.js` 였다.

- 이 검사는 브라우저로 **진짜 앱**(`localhost:5500`)을 열고, 그 앱은 **진짜 Supabase** 를 본다.
- 가짜 서버를 `**/rest/v1/worksheets**` 와 `**/functions/v1/claude-proxy**` 에만 끼웠다.
- 그런데 동형 문항을 만들면 앱이 **단추를 누르지 않아도** 1.5초 뒤 저장을 한다 —
  `_isoAutoSave` → `_isoBankSync` → `ibPutItem` → `supaUpsert('item_bank', …)`
  → `POST https://…/rest/v1/item_bank`.
- `item_bank` 는 아무도 안 막았으니 그대로 **진짜 서버로 나갔다**. 한 번 돌 때 11번 시도했고, 같은 id 끼리 합쳐져 7줄이 남았다.

그때도 막음 장치(`verify_guard.js`)는 저장소에 있었다. **그 스크립트가 거치지 않았던 것**이 문제였다.
그리고 그 스크립트는 저장소 밖(임시 폴더)에 있어서 아무도 들여다보지 않았다.

그래서 두 가지를 바꿨다.

1. **검사는 전부 이 폴더에 둔다.** 저장소 밖에 검사를 두지 않는다.
2. **막음 장치를 거치지 않으면 돌지 않는다.**

## 어떻게 돌리나

```
node tests/run.js                 # 전부
node tests/run.js iso item        # 이름에 그 글자가 든 것만
node tests/run.js --list          # 목록
node tests/run.js --jobs 4        # 한 번에 몇 개씩 (기본 3)
node tests/run.js --timeout 300   # 한 검사의 제한 시간(초, 기본 240)
```

브라우저를 띄우는 검사는 `http://localhost:5500` 에 이 폴더의 **윗 폴더**가 떠 있어야 한다.

## 막음 장치

- `verify_guard.js` — 무엇을 막을지 가른다.
  - **데이터 쓰기**: `rest/v1` 의 POST·PATCH·PUT·DELETE → 막고, 엄격 모드에서는 **그 자리에서 멈춘다**.
  - **바깥 호출**: `functions/v1` 의 POST(AI·음성·메일) → 막고 적기만 한다.
    (앱이 뜰 때 하는 `tts-proxy` '살아 있나' 확인까지 멈추면 아무 검사도 못 돈다.)
  - 어느 쪽이든 요청은 **실제로 나가지 않는다**.
- `_guard_preload.js` — `node --require` 로 먼저 읽힌다. playwright 의 `launch`/`newContext`/`newPage` 를 가로채
  **페이지를 열기 전에** 컨텍스트마다 막는 route 를 건다.
  컨텍스트 단계에 걸기 때문에, 검사가 따로 거는 `page.route`(가짜 서버)가 더 먼저 잡는다 —
  가짜 서버를 끼운 표는 그대로 돌고, **아무도 안 막은 표만** 이 장치에 걸린다.
- `_guard_assert.js` — 모든 검사 파일의 첫 줄에서 부른다. 장치가 안 켜졌으면 그 검사는 돌지 않는다.
- `run.js` — 돌리기 전에 **모든 검사 파일에 그 첫 줄이 있는지** 본다. 하나라도 없으면 아무것도 돌리지 않는다.
  돌린 뒤에는 장치가 남긴 표식이 없는 검사를 실패로 친다.
- `rowcount.js` — `item_bank`·`worksheets`·`item_results`·`assignments` 의 줄 수를 **읽기만** 한다.
  `run.js` 가 돌리기 전후로 재서 같은지 본다.

## 새 검사를 쓸 때

1. 파일을 `tests/verify_<이름>.js` 로 만든다 (저장소 밖에 두지 않는다).
2. 첫 줄에 `require('./_guard_assert');`
3. 저장소 경로는 `const ROOT = require('path').resolve(__dirname, '..')`,
   그림·찌끼 파일은 `process.env.PP_TEST_OUT` 아래에.
4. **실제 학생 이름·id·연락처와 기출 원문은 넣지 않는다.** 실학생 행을 꼭 읽어야 하면
   `process.env.PP_REAL_SID` 로 받고, 없으면 그 대목을 건너뛴다.
5. 쓰기를 흉내 내야 하면 그 표에 가짜 서버(`page.route`)를 끼운다. 안 끼우면 막음 장치가 잡는다.

## live/ 는 뭔가

`tests/live/verify_push.js` 는 **실제 서버에 쓴다**(푸시 구독 시험 행을 넣었다 바로 지운다).
그래서 `run.js` 가 돌리는 목록에 들어가지 않는다. 원장이 시켰을 때 손으로만 돌린다.
