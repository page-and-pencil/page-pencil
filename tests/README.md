# 검사 (tests/)

> **1. 검사와 캡처는 실제 서버를 읽지 않는다.** 앱이 뜨는 데 필요한 줄은 `fixtures/db.json` 의 가짜 표에서 답한다.
> **2. 실제 서버를 읽는 확인은 `live` 묶음뿐이다** — `PP_ALLOW_LIVE_READ=1 node tests/run.js live --jobs 1`, 원장이 시킬 때만.
> **3. 그 밖에 실제로 나가는 요청은 끝줄의 '줄 수 전후' 확인 8건뿐이다.** 끝줄이 그 수를 적어 준다.
>
> **2026-11-27 까지는 `PP_SKIP_COUNTS=1 node tests/run.js` 를 기본으로 쓴다**(실제 서버 요청 0건).
> 한도를 넘어 11/15~11/27 에는 그 8건마저 402 로 막힐 수 있다. 막혀도 검사는 실패로 치지 않고,
> 끝줄에 '줄 수 확인 못 함(서버 제한 402)' 이라고만 적는다 — 통과·실패는 검사 결과로만 가린다.
>
> 왜: 2026-11-13 전송량이 한 주기에 **14.61GB / 5GB**(11/6 에는 6.47GB), 대시보드에 '11/15 부터 프로젝트 제한' 경고.
> 검사 한 번이 진짜 앱 → 진짜 Supabase 를 열어 몇 MB 씩 받아 갔다.

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

(2026-11-13: 그 `verify_iso.js` 와 `verify_failstate.js` 는 쓰는 표를 모두 가짜로 끼워 고쳤다 — 아래 `_fake.js`.)

## 어떻게 돌리나

```
PP_SKIP_COUNTS=1 node tests/run.js  # core 만 (11/27 까지는 이렇게 — 실제 서버 요청 0건)
node tests/run.js                 # core 만 — 배포 때마다 돌리는 것 (줄 수 확인 8건 포함)
node tests/run.js live            # 실제 서버를 읽는 검사 (한 번에 하나 · 500 이면 한 번 더)
node tests/run.js legacy          # 고치면 쓸 수 있는 옛 검사 (기본으로 돌지 않는다)
node tests/run.js all             # core + live + legacy
node tests/run.js iso item        # 이름에 그 글자가 든 것만 (묶음을 가리지 않는다)
node tests/run.js --list          # 묶음별 목록
node tests/run.js --readme        # 아래 표를 다시 찍는다
node tests/run.js --jobs 4        # 한 번에 몇 개씩 (기본 3, live 는 늘 1)
node tests/run.js --timeout 300   # 한 검사의 제한 시간(초, 기본 240)
```

브라우저를 띄우는 검사는 `http://localhost:5500` 에 이 폴더의 **윗 폴더**가 떠 있어야 한다.

끝줄은 늘 이렇게 한 줄로 나온다 — 줄 수는 **돌리기 전에 읽은 값과 끝나고 읽은 값**을 견준 것이다.

```
core 29/29 통과 · 실제 서버 쓰기 0건 · 줄 수 전후 같음(item_bank 55 · worksheets 0 · item_results 0 · assignments 47) · 318초
```

## 네 묶음

| 묶음 | 언제 도나 | 무엇인가 |
| --- | --- | --- |
| `core` | `node tests/run.js` — 배포 때마다 | 지금 통과하고, 가짜 데이터만 쓰는 검사 |
| `live` | 손으로 `node tests/run.js live` | 실제 서버를 **읽는** 검사. 500 이 튀면 run.js 가 한 번 더 돌린다 |
| `legacy` | 손으로 `node tests/run.js legacy` | 고치면 쓸 수 있는 옛 검사. 왜 안 도는지는 아래 표에 |
| `retired` | 돌리지 않는다 | `tests/retired/` 로 옮겼다. 지금 화면에 없는 기능이거나 다른 검사가 덮는다 |

묶음은 `tests/_groups.js` 한 곳에 적는다. **검사를 새로 만들면 거기에 한 줄 적는다** — 적지 않으면 `run.js` 가 돌릴 때 알려 준다.

## 검사 표 (`node tests/run.js --readme` 로 다시 찍는다)

| 검사 | 묶음 | 무엇을 보는지 | 왜 안 도는지 |
| --- | --- | --- | --- |
| `verify_1107b` | core | 건너뛴 두 항목(1-6-1 화면 · 1-6-3 프롬프트)을 캐시에만 넣은 가짜 기록으로 확인. |  |
| `verify_acts` | core | 수업 중 활동 칩 (C) — 가짜 반·가짜 수업만 쓴다. 실제 반 데이터는 건드리지 않는다. |  |
| `verify_auth2` | core | 11/8 2차 — 진입점·선로딩·보스·응원문구·공지읽음·선생님 세션. 실DB 쓰기 전부 차단. |  |
| `verify_cheer` | core | 응원 문구·칭찬 배너가 학생 화면에 제때 뜨는지 |  |
| `verify_dupword` | core | syncVocabCards 중복 방지 검증 — 목업(서버 쓰기 차단) |  |
| `verify_eb_big` | core | 실제 분량(6,139행)으로 — 전송량·속도·화면 |  |
| `verify_egress` | core | egress 다이어트 동작 검증 — 교재 라이트 동기화의 정상·예외 경로. 쓰기는 전부 차단. |  |
| `verify_egress2` | core | 로그인 1회당 전송량 — 교재를 다시 받지 않는지 확인 (읽기만) |  |
| `verify_failstate` | core | 저장 실패 상태 — ’저장 실패 · 다시 저장’ 이 뜨고, 눌러서 다시 저장하면 되살아난다 |  |
| `verify_fit2` | core | 점수 탭 ②③④ 와 설정 탭을 320 / 390 / 1440 에서 측정. 실DB 쓰기 차단. |  |
| `verify_flow` | core | Page & Pencil — ’같은 사실은 한 곳에서’ 점검 (node verify_flow.js) |  |
| `verify_gifts` | core | 선물(상품) 알림이 선생님·학생 화면에 새지 않는지 · 390px 넘침 |  |
| `verify_goal` | core | 학습 목표 제거 · 학습 방향 유지 확인. 실DB 쓰기 차단. |  |
| `verify_guided` | core | 만들기(마법사) 점검 — 가짜 문항만 쓴다. 실제 학생 데이터·기출 원문은 쓰지 않는다. |  |
| `verify_hw3` | core | ① 마감일 없는 반복 숙제 ② 캘린더에서 리딩앤·원서읽기 한 칩 ③ 클래스5 색 복구. 실DB 쓰기 차단. |  |
| `verify_hwedit` | core | 숙제 자유 수정 검증 — 날짜별 일정 줄 수정·삭제·추가, 완료 표시 보존, 구분 직접 입력. |  |
| `verify_ib` | core | 문제 은행 — 화면·흐름 확인. AI 와 DB 는 모두 가짜. 진짜 돈·실DB 를 쓰지 않는다. |  |
| `verify_ib2` | core | 2차 확인 — 난도 규칙 보강 · 지문 묶음(setId) 카드 · 덮어쓰기 가져오기 · 표 없음 상태 |  |
| `verify_ir` | core | 시험지 풀이·채점·결과 — 전부 가짜 서버. AI 는 부르지 않는다. |  |
| `verify_ir2` | core | 2차 확인 — 자체 시험 영역별·다시 풀기·듣기 대본·표 없음 가드·줄 휴지통·완료 옆 점수·sid·학생 화면 회귀 |  |
| `verify_iso` | core | 동형 문제 — 화면·흐름 확인 (AI 는 가짜 응답으로, 저장도 가짜로 — 진짜 돈·DB를 쓰지 않는다) |  |
| `verify_iso_student` | core | 학생 화면 — 배정된 동형 문제가 ’문제만’ 보이는지 (정답·해설은 안 보여야 한다) |  |
| `verify_isocards` | core | 동형 — 유형 설계 카드 (가짜 AI · 가짜 서버). 기출 원문은 쓰지 않는다. |  |
| `verify_item` | core | Page & Pencil — 자료실·문제 은행 잇기 점검 (node verify_item.js) |  |
| `verify_itemid` | core | 문항 id 가 ’행 id’ 로 들어오는지 — data 안에 id 가 없는 문항으로만 확인한다 (가짜 서버) |  |
| `verify_library` | core | 라이브러리 (lib_books · lib_text) — 가짜 데이터만. 출판사 원문·학생 데이터는 쓰지 않는다. |  |
| `verify_limited` | core | 서버 제한(402·읽기만 됨·일시 정지) — 띠·보기 전용·기기 자료로 열기 |  |
| `verify_link` | core | Page & Pencil — ’다음 교재 하나로 잇기’ 점검 (node verify_link.js) |  |
| `verify_lk` | core | 학습 세트 · 수업 기록 단원 자료 · 홈 시험 대비 — 전부 가짜 서버 |  |
| `verify_paint` | core | 실제로 ’칠해진’ 파랑·남색·보라만 찾는다 — 계산된 스타일 기준. 소스에 남아 있어도 덮여 있으면 제외. |  |
| `verify_pb` | core | 시험지 만들기 + 문제 은행 보완 — 전부 가짜 서버. AI 는 부르지 않는다. |  |
| `verify_polish` | core | 시험지 다듬기 확인 — 배점·쪽 번호(PDF)·인쇄 단추 자리·장문 묶음·복제/기기 삭제 |  |
| `verify_r3` | core | 프롬프트 5~8 수정 검증. 실DB 쓰기 전부 차단. |  |
| `verify_r4` | core | 프롬프트 6 — 메시지 보내기 상태(sent)와 단추 되돌림 |  |
| `verify_scores` | core | A부 학부모 점수 탭 검증 — 블록 조합 5가지 + 390px 캡처. 실DB 쓰기 전부 차단. |  |
| `verify_scroll` | core | 스크롤 점검 — 화면보다 긴 내용이 **휠로 끝까지 닿는가**. |  |
| `verify_split` | core | 기출과 교재 나누기 (B) — 가짜 자료줄만 쓴다. 실제 기출 원문은 쓰지 않는다. |  |
| `verify_tts` | core | 2-1 tts-proxy 경로 검증. 실DB 쓰기·실제 ElevenLabs·Cloudinary 호출 전부 차단. |  |
| `verify_ux1` | core | 학부모 수업 탭·빈 탭 · 학생 인사 · 공지 보이는 기간 · 수업 기록 [저장하기] — 가짜 서버만 |  |
| `verify_ux2` | core | 학생 인사·보상·주간 띠·아래 메뉴·단어 탭·복습 탭 · 학부모 수업 탭 순서·알림 권유·지난달 견주기·성장 탭·글자 대비 — 가짜 서버만 |  |
| `verify_visible` | core | Page & Pencil — ’설정한 것이 보이는가’ 점검 (node verify_visible.js) |  |
| `verify_live_eb` | live | 라이브 확인 — 배포된 페이지가 진짜 Supabase 뷰에서 자료실을 받아오는지 (읽기만 한다) | 실제 서버·배포된 페이지를 읽어야 한다 (PP_ALLOW_LIVE_READ=1) |
| `verify_live_fix3` | live | 라이브 확인 — 자료실 듣기(드라이브 재생기 하나씩) · 동형 탭 (AI 는 부르지 않는다) | 실제 서버·배포된 페이지를 읽어야 한다 (PP_ALLOW_LIVE_READ=1) |
| `verify_live_ib` | live | 진짜 서버로 ’문제 은행’ 탭을 열어 본다 (표는 있고 0줄). | 실제 서버·배포된 페이지를 읽어야 한다 (PP_ALLOW_LIVE_READ=1) |
| `verify_live_song` | live | 라이브 노래 화면만 다시 — 광고 프리롤까지 기다린다 | 실제 서버·배포된 페이지를 읽어야 한다 (PP_ALLOW_LIVE_READ=1) |
| `verify_live_vocab` | live | 라이브 확인 — ① 실학생 학생뷰(체험 모드) 단어 탭에서 외부 호출 수 ② Sing Together 노래 화면 | 실제 서버·배포된 페이지를 읽어야 한다 (PP_ALLOW_LIVE_READ=1) |
| `verify_live_vocab2` | live | 라이브 확인 — ① 실학생 학생뷰(체험 모드) 단어 탭에서 외부 호출 수 ② Sing Together 노래 화면 | 실제 서버·배포된 페이지를 읽어야 한다 (PP_ALLOW_LIVE_READ=1) |
| `verify_1107` | legacy | 2026-11-07 1부 검증. 실DB 쓰기 전부 차단(GET/HEAD 만 통과). | 가짜 자료로는 안 맞는다 — 교재가 잡힌 학생은 단원도 미리 선택됨  — 0명 중 0명 |
| `verify_auth` | legacy | B-2 병행 로그인 검증. 실DB 쓰기 전부 차단. login 함수는 가짜로 응답한다. | 가짜 자료로는 안 맞는다 — page.evaluate: ReferenceError: K is not defined |
| `verify_auto` | legacy | 1) 자료 DB 칸별 스크롤  2) 동형 자동 저장  3) 지문 길이 지시 | 가짜 자료로는 안 맞는다 — TypeError: Cannot read properties of undefined (reading ’id’) |
| `verify_cap` | legacy | 음성 비용 장치 검증 (ⓑ 자동 상한 · ⓒ 선생님 버튼 · 서버 429 · ⓓ 출판사 음원). | 가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of undefined (reading |
| `verify_cats` | legacy | 자료실 구분 3개(원서 오디오·교재 음원·교재 단어/워크시트) + 원서는 듣기가 위 — 실제 카탈로그 6,518행으로 확인 | 가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of undefined (reading |
| `verify_dlg` | legacy | 대화문 화자 표기 검증. 실데이터는 읽기만(저장 0), 더미 교재는 끝나면 휴지통. | 가짜 자료로는 안 맞는다 — 대화문으로 판정된 단원이 있다  — 0단원 |
| `verify_eb` | legacy | 기출·자료실 확인 — 표가 아직 없으므로 exam_bank REST 를 가짜로 받아 준다(실 DB 접근 0) | 가짜 자료로는 안 맞는다 — 목록에 30건이 보인다  — 23건 · 23개 / 전체 30개 · "보기 mopyeong 2026-7" 문제지정답 |
| `verify_eb2` | legacy | 2차 확인 — 탭 이름 ’자료실’ · 기타 자료 묶음 · 합쳐진 폴더 · 시리즈 거르기 (실제 카탈로그 6,074행) | 가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of undefined (reading |
| `verify_fit` | legacy | 이번에 바꾼 UI 네 곳의 가로 넘침 측정 (320 / 390 / 1440). 실DB 쓰기 차단. | 가짜 자료로는 안 맞는다 — 설정 탭 (ElevenLabs 카드)  넘침 0px · 밖으로 ntab right=368 / ntab-ico right=322 |
| `verify_five` | legacy | 도장·원서 중복·리딩앤 탭·배지·레벨 뱃지 검증. 실데이터 GET 만, 쓰기 전부 차단. | 가짜 자료로는 안 맞는다 — readings 줄 수보다 권수가 적다(같은 책을 한 권으로)  — 0줄 → 0권 |
| `verify_fix3` | legacy | 확인 — ① 자료실 듣기(드라이브 재생기 하나씩) ② 동형 ② 원문 지문은 저장 막기 | 가짜 자료로는 안 맞는다 — ⑨ ② 원문 지문 — 저장 단추 숨김 · 안내 보임 — 이 묶음은 이 기기에만 보관돼요 (원문 지문) — 인쇄로 쓰세요. |
| `verify_hw` | legacy | 매일 반복 클래스5 넣기 + 숙제 삭제 검증. 실DB 쓰기는 전부 차단(화면·캐시만 확인). | 가짜 자료로는 안 맞는다 — 오늘 할 일에 클래스5 카드  —  ✨ 가온아, 잘했어! 오늘 할 일 끝! 🎉 오늘 할 일 다 했어요! 참 잘했어요 👏 🎉 숙 |
| `verify_hwsync` | legacy | 1) 학생/학부모 숙제 완료 표시 일치  2) 과제 할당 교재명 검색. 읽기만, 쓰기 전부 차단. | 가짜 자료로는 안 맞는다 — ’리딩앤 원서 읽기’(오늘 완료)가 양쪽에서 완료  — 없음 |
| `verify_match` | legacy | P2-1 검증. 실데이터 GET 만, 쓰기 전부 차단. 저장 없음. | 가짜 자료로는 안 맞는다 — 요즘 초등 영단어 2 단원 30개  — -1개 · totalUnits -1 |
| `verify_merge3` | legacy | 병합 뒤 3가지 확인: 복습 탭 단원 수 · 구간 표시 · 뜻 쓰기 #6·#17 | 가짜 자료로는 안 맞는다 — 복습 탭 Smart Listening 1.1 단원 12개  — undefined |
| `verify_p1d` | legacy | 실학생은 ’보기만’ — 체험 모드(미리보기)로 들어가 저장 0건을 확인 | 가짜 자료로는 안 맞는다 — 체험 모드로 들어갔다 (실학생 기록 보호) |
| `verify_p245` | legacy | P2-4(ppReviewCover) · P2-5(단원 점검) 검증. 읽기만, 저장 0건. | 가짜 자료로는 안 맞는다 — 요즘2 Unit 5 → Unit 1~4 · 36단어 |
| `verify_paper` | legacy | 단어 시험지 새 양식 검증. 실데이터 GET 만, 쓰기 전부 차단. | 가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of undefined (reading |
| `verify_print` | legacy | 월간 리포트 인쇄 미리보기 — 리브랜딩 뒤 이름·색 확인. 실DB 쓰기 차단, 저장 버튼 안 누름. | 가짜 자료로는 안 맞는다 — 머리글·바닥글이 직결영어  — 0곳 |
| `verify_r1` | legacy | 프롬프트 1·2 수정 검증. 실DB 쓰기 전부 차단. | 가짜 자료로는 안 맞는다 — 진도 없으면 다른 프롬프트로 보냄 |
| `verify_r2` | legacy | 프롬프트 4 수정 검증. 실DB 쓰기 차단. | 가짜 자료로는 안 맞는다 — page.evaluate: ReferenceError: process is not defined |
| `verify_r5` | legacy | 프롬프트 7·8 — 보완 필요 라벨 · 시험지 창 교재 기본값 · 단원 차례 | 가짜 자료로는 안 맞는다 — 시험지 창에 교재 기본값  — 교재 선택 (새 단어 없이 복습만 낼 수도 있어요) |
| `verify_sandbox` | legacy | 1) 도장판 정리  2) 체험 모드(학생 기록 보존)  3) 도장은 전부 완료한 날만. | 가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of undefined (reading |
| `verify_shelf` | legacy | 학생 복습 탭 ’수업 교재 복습’ 검증 — 실데이터 GET 만, 쓰기 전부 차단. | 가짜 자료로는 안 맞는다 — 책장에 Read It! 30-1 가 있다 |
| `verify_snap` | legacy | 스냅샷 부팅 — 역할·학생이 바뀔 때 다른 사람 데이터가 보이지 않는지, 로그아웃이 스냅샷을 지우는지, | 가짜 자료로는 안 맞는다 — 교재 전체를 받지 않음  — 2.6KB |
| `verify_song2` | legacy | 2차 확인 — ① 학생 복습 화면 히어로에 노래 ② 단어 누르면 노래 잠깐 멈춤 | 가짜 자료로는 안 맞는다 — 기록 "Top Of The World" → 교재 단원  — 못 찾음 |
| `verify_song3` | legacy | 3차 확인 — ① 단어를 누르면 노래가 멈추고 저절로 다시 틀리지 않는다 ② 히어로는 활동 제외로 돌아갔다 | 가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of null (reading ’pla |
| `verify_stage2` | legacy | feat/stage-filter 확인 — ① 학습 세트 해석 줄 맞추기 ② 학생 문장 학습 ③ 자료실 수준 | 실제 교재(중학영어 1~3)의 단원·문장이 있어야 한다 — 가짜 교재로는 못 찾는다 |
| `verify_stu3` | legacy | 조건 3 — 스냅샷 부팅 뒤에도 학생 단어장 3단계와 원서 듣기 본문이 온전한지. | 가짜 자료로는 안 맞는다 — name: ’TimeoutError’ |
| `verify_trash` | legacy | 휴지통 행이 새어 나오는지 검증. 실데이터 GET 만, 쓰기는 전부 차단. | 가짜 자료로는 안 맞는다 — 휴지통에 mw4t32s8lzs8 가 있다(withDeleted:true 로는 보임)  — 0건 |
| `verify_trim` | legacy | [1] 학생 화면 완료 숙제 제거 · [2] 번호 없는 Review 연결. 실데이터 쓰기 0. | 가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of undefined (reading |
| `verify_vocab2` | legacy | 넣은 어휘 반복 숙제가 학생·학부모 화면에 제대로 뜨는지. 읽기만, 쓰기 전부 차단. | 가짜 자료로는 안 맞는다 — 어휘 반복 숙제 2건이 보인다  — 0건 |
| `verify_bk1` | retired | 밀린 항목 11가지 점검 — 전부 더미 데이터 + 가짜 서버 (실DB·실AI 안 씀) | 도우미 fake_server.js 가 저장소 밖(임시 폴더)에 있어 돌지 않는다 |
| `verify_kspell` | retired | P2 뜻 쓰기(kspell) 검증. 더미 학생만. | 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |
| `verify_lk2` | retired | 학습 세트 다듬기 확인 — 실제 ’중학영어 2 (동아 윤정미) Lesson 5’ 본문으로 | 앞선 검사가 임시 폴더에 남긴 파일(l5.json)을 읽는다 — 혼자 돌지 못한다 |
| `verify_meta` | retired | 단어 탭 외부 호출 검증. 실데이터 저장 0. 외부 요청은 전부 가로채서 센다. | 도우미 meta_dummy.js 가 저장소 밖(임시 폴더)에 있어 돌지 않는다 |
| `verify_p1` | retired | P1 검증 — 더미 학생으로만. 실학생 행에는 쓰지 않는다. | 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |
| `verify_p1b` | retired | P1 검증 2 — 스펠·선택지·중간 이탈·별표. 더미 학생만. | 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |
| `verify_p1c` | retired | 일부만 풀고 결과로 간 경우 — 안 푼 카드가 바뀌지 않는지, 저장 건수가 줄었는지 | 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |
| `verify_p22` | retired | P2-2·P2-3 검증. 교재 편집기는 더미 교재로만, 실학생은 보기만. | 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |
| `verify_p3` | retired | P3 스피드 테스트 검증. 더미 학생만. 실학생에는 쓰지 않는다. | 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |
| `verify_p3box` | retired | 시험 ⑥ — 같은 날 중복 반영을 **양방향**으로, box 숫자까지 확인. 더미 학생만. | 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |
| `verify_p4` | retired | P4 누적 오답 4주 복습 검증. 더미 학생만. | 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |
| `verify_p5` | retired | P5 복습 게임 검증. 더미 학생(p1dummy0001)만 건드린다. | 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |
| `verify_p5b` | retired | P5 추가 확인: ① 세션 0건 → ’0일 · 0분’  ② 리포트 게임 한 줄  ③ kspGrade 끝말(조깅/빠르다) | 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |
| `verify_p6` | retired | P6 리포트·설정·리셋 검증. 더미 학생/숙제만. | 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |
| `verify_p7` | retired | P7 문장 학습 검증. 더미 학생·더미 교재만 건드린다. 실학생은 읽기만. | 도우미가 저장소 밖에 있고, 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |
| `verify_song` | retired | feat/song-player 확인 — 선생님 화면에서 노래 모드. 가사 글자는 찍지 않는다(줄 수만). | 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |
| `verify_stage` | retired | ’어느 스테이지의 첫 시도가 기록이 되는가’ 만 확인. 더미 학생만. | 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다 |

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

## 같이 쓰는 도우미

- `_page.js` — 여는 주소를 만든다. `pageUrl()` 은 저장소의 `index.html`, `fileUrl(p)` 는 아무 파일.
  `url.pathToFileURL` 을 쓴다 — 직접 `'file:///' + ROOT` 로 지으면 윈도에서 역슬래시가 `%5C` 로 바뀌어 열리지 않는다.
  기기 보관(IndexedDB)을 보는 검사는 `pageUrl(null, null, true)` 로 `http://localhost:5500` 을 쓴다.
- `_fakedb.js` + `fixtures/db.json` — **읽기** 를 답하는 가짜 표(학생 3명·반 2개·교재 2권 …).
  막음 장치가 이 표로 `*.supabase.co` 의 GET 에 답한다. 검사가 자기 줄을 넣으려면 `fakeRows('lessons', […])`.
  표에 없는 표(table)를 읽으면 404 로 막고 '막은 읽기' 로 센다 — 끝줄에 그 수가 나온다.
- `_fake.js` — `fakeTables(page, ['worksheets', 'item_bank', …])`. **쓰는 검사는 자기가 건드리는 표를 모두 적는다.**
  GET 은 빈 목록, 쓰기는 201 로 받아 세어 준다. 실패를 흉내 내려면 `{ on: (table, m, body, r) => … }`.
- `_catalog.js` — 기출 카탈로그. `PP_EXAM_CATALOG` 가 있으면 그 파일, 없으면 `tests/fixtures/exam_catalog_fake.json`(가짜 30줄).
  **실제 카탈로그 파일은 저장소에 넣지 않는다.**
- `fixtures/` — 가짜 자료. 실제 학교·시험 이름, 기출 원문, 학생 이름은 들어가지 않는다.

## 새 검사를 쓸 때

1. 파일을 `tests/verify_<이름>.js` 로 만든다 (저장소 밖에 두지 않는다).
2. 첫 줄에 `require('./_guard_assert');`
3. `tests/_groups.js` 에 한 줄 — 어느 묶음인지, 무엇을 보는지.
4. 저장소 경로는 `const { ROOT, pageUrl } = require('./_page')`,
   그림·찌끼 파일은 `process.env.PP_TEST_OUT` 아래에.
5. **실제 학생 이름·id·연락처와 기출 원문은 넣지 않는다.** 실학생 행을 꼭 읽어야 하면
   `process.env.PP_REAL_SID` 로 받고, 없으면 그 대목을 건너뛴다.
6. 쓰기를 흉내 내야 하면 `_fake.js` 의 `fakeTables` 로 **그 표를 모두** 끼운다. 안 끼우면 막음 장치가 잡는다.

## live 묶음과 live/ 폴더는 다르다

- **`live` 묶음** = 실제 서버를 **읽는** 검사(`verify_live_*`). `node tests/run.js live` 로 돌린다.
- **`tests/live/` 폴더** = 실제 서버에 **쓰는** 도구(`verify_push.js` 는 푸시 구독 시험 행을 넣었다 바로 지운다).
  `run.js` 가 돌리는 목록에 들어가지 않는다. 원장이 시켰을 때 손으로만 돌린다.

## retired/ 는 뭔가

지금 화면에 없는 기능을 보던 검사, 또는 다른 검사가 이미 덮는 검사다.
지우지 않고 `tests/retired/` 에 두어 **왜 그랬는지**를 표에 남긴다. `run.js` 는 이 폴더를 보지 않는다.
