// 검사 묶음 — run.js 와 README 의 표가 **여기 하나**에서 나온다.
//
//   core    배포 때마다 돈다            node tests/run.js
//   live    실제 서버를 읽는다           node tests/run.js live   (한 번에 하나 · 500 이면 한 번 더)
//   legacy  고치면 쓸 수 있는 옛 검사    node tests/run.js legacy (기본으로 돌지 않는다)
//   retired tests/retired/ 로 옮겼다     run.js 가 돌리지 않는다
//
// 검사를 새로 만들면 여기에 한 줄 적는다. 적지 않으면 run.js 가 돌릴 때 알려 준다.
// w = 무엇을 보는지 한 줄 · why = (legacy·retired 면) 왜 안 도는지
const GROUPS = ['core', 'live', 'legacy', 'retired'];
const TESTS = {
  'verify_1107.js': { g: 'legacy', w: '2026-11-07 1부 검증. 실DB 쓰기 전부 차단(GET/HEAD 만 통과).', why: '가짜 자료로는 안 맞는다 — 교재가 잡힌 학생은 단원도 미리 선택됨  — 0명 중 0명' },
  'verify_1107b.js': { g: 'core', w: '건너뛴 두 항목(1-6-1 화면 · 1-6-3 프롬프트)을 캐시에만 넣은 가짜 기록으로 확인.' },
  'verify_acts.js': { g: 'core', w: '수업 중 활동 칩 (C) — 가짜 반·가짜 수업만 쓴다. 실제 반 데이터는 건드리지 않는다.' },
  'verify_auth.js': { g: 'legacy', w: 'B-2 병행 로그인 검증. 실DB 쓰기 전부 차단. login 함수는 가짜로 응답한다.', why: '가짜 자료로는 안 맞는다 — page.evaluate: ReferenceError: K is not defined' },
  'verify_auth2.js': { g: 'core', w: '11/8 2차 — 진입점·선로딩·보스·응원문구·공지읽음·선생님 세션. 실DB 쓰기 전부 차단.' },
  'verify_auto.js': { g: 'legacy', w: '1) 자료 DB 칸별 스크롤  2) 동형 자동 저장  3) 지문 길이 지시', why: '가짜 자료로는 안 맞는다 — TypeError: Cannot read properties of undefined (reading ’id’)' },
  'verify_bk1.js': { g: 'retired', w: '밀린 항목 11가지 점검 — 전부 더미 데이터 + 가짜 서버 (실DB·실AI 안 씀)', why: '도우미 fake_server.js 가 저장소 밖(임시 폴더)에 있어 돌지 않는다' },
  'verify_cap.js': { g: 'legacy', w: '음성 비용 장치 검증 (ⓑ 자동 상한 · ⓒ 선생님 버튼 · 서버 429 · ⓓ 출판사 음원).', why: '가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of undefined (reading' },
  'verify_cats.js': { g: 'legacy', w: '자료실 구분 3개(원서 오디오·교재 음원·교재 단어/워크시트) + 원서는 듣기가 위 — 실제 카탈로그 6,518행으로 확인', why: '가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of undefined (reading' },
  'verify_cheer.js': { g: 'core', w: '응원 문구·칭찬 배너가 학생 화면에 제때 뜨는지' },
  'verify_dlg.js': { g: 'legacy', w: '대화문 화자 표기 검증. 실데이터는 읽기만(저장 0), 더미 교재는 끝나면 휴지통.', why: '가짜 자료로는 안 맞는다 — 대화문으로 판정된 단원이 있다  — 0단원' },
  'verify_dupword.js': { g: 'core', w: 'syncVocabCards 중복 방지 검증 — 목업(서버 쓰기 차단)' },
  'verify_eb.js': { g: 'legacy', w: '기출·자료실 확인 — 표가 아직 없으므로 exam_bank REST 를 가짜로 받아 준다(실 DB 접근 0)', why: '가짜 자료로는 안 맞는다 — 목록에 30건이 보인다  — 23건 · 23개 / 전체 30개 · "보기 mopyeong 2026-7" 문제지정답' },
  'verify_eb2.js': { g: 'legacy', w: '2차 확인 — 탭 이름 ’자료실’ · 기타 자료 묶음 · 합쳐진 폴더 · 시리즈 거르기 (실제 카탈로그 6,074행)', why: '가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of undefined (reading' },
  'verify_eb_big.js': { g: 'core', w: '실제 분량(6,139행)으로 — 전송량·속도·화면' },
  'verify_egress.js': { g: 'core', w: 'egress 다이어트 동작 검증 — 교재 라이트 동기화의 정상·예외 경로. 쓰기는 전부 차단.' },
  'verify_egress2.js': { g: 'core', w: '로그인 1회당 전송량 — 교재를 다시 받지 않는지 확인 (읽기만)' },
  'verify_failstate.js': { g: 'core', w: '저장 실패 상태 — ’저장 실패 · 다시 저장’ 이 뜨고, 눌러서 다시 저장하면 되살아난다' },
  'verify_fit.js': { g: 'legacy', w: '이번에 바꾼 UI 네 곳의 가로 넘침 측정 (320 / 390 / 1440). 실DB 쓰기 차단.', why: '가짜 자료로는 안 맞는다 — 설정 탭 (ElevenLabs 카드)  넘침 0px · 밖으로 ntab right=368 / ntab-ico right=322' },
  'verify_fit2.js': { g: 'core', w: '점수 탭 ②③④ 와 설정 탭을 320 / 390 / 1440 에서 측정. 실DB 쓰기 차단.' },
  'verify_five.js': { g: 'legacy', w: '도장·원서 중복·리딩앤 탭·배지·레벨 뱃지 검증. 실데이터 GET 만, 쓰기 전부 차단.', why: '가짜 자료로는 안 맞는다 — readings 줄 수보다 권수가 적다(같은 책을 한 권으로)  — 0줄 → 0권' },
  'verify_fix3.js': { g: 'legacy', w: '확인 — ① 자료실 듣기(드라이브 재생기 하나씩) ② 동형 ② 원문 지문은 저장 막기', why: '가짜 자료로는 안 맞는다 — ⑨ ② 원문 지문 — 저장 단추 숨김 · 안내 보임 — 이 묶음은 이 기기에만 보관돼요 (원문 지문) — 인쇄로 쓰세요.' },
  'verify_flow.js': { g: 'core', w: 'Page & Pencil — ’같은 사실은 한 곳에서’ 점검 (node verify_flow.js)' },
  'verify_gifts.js': { g: 'core', w: '선물(상품) 알림이 선생님·학생 화면에 새지 않는지 · 390px 넘침' },
  'verify_goal.js': { g: 'core', w: '학습 목표 제거 · 학습 방향 유지 확인. 실DB 쓰기 차단.' },
  'verify_guided.js': { g: 'core', w: '만들기(마법사) 점검 — 가짜 문항만 쓴다. 실제 학생 데이터·기출 원문은 쓰지 않는다.' },
  'verify_hw.js': { g: 'legacy', w: '매일 반복 클래스5 넣기 + 숙제 삭제 검증. 실DB 쓰기는 전부 차단(화면·캐시만 확인).', why: '가짜 자료로는 안 맞는다 — 오늘 할 일에 클래스5 카드  —  ✨ 가온아, 잘했어! 오늘 할 일 끝! 🎉 오늘 할 일 다 했어요! 참 잘했어요 👏 🎉 숙' },
  'verify_hw3.js': { g: 'core', w: '① 마감일 없는 반복 숙제 ② 캘린더에서 리딩앤·원서읽기 한 칩 ③ 클래스5 색 복구. 실DB 쓰기 차단.' },
  'verify_hwedit.js': { g: 'core', w: '숙제 자유 수정 검증 — 날짜별 일정 줄 수정·삭제·추가, 완료 표시 보존, 구분 직접 입력.' },
  'verify_hwsync.js': { g: 'legacy', w: '1) 학생/학부모 숙제 완료 표시 일치  2) 과제 할당 교재명 검색. 읽기만, 쓰기 전부 차단.', why: '가짜 자료로는 안 맞는다 — ’리딩앤 원서 읽기’(오늘 완료)가 양쪽에서 완료  — 없음' },
  'verify_ib.js': { g: 'core', w: '문제 은행 — 화면·흐름 확인. AI 와 DB 는 모두 가짜. 진짜 돈·실DB 를 쓰지 않는다.' },
  'verify_ib2.js': { g: 'core', w: '2차 확인 — 난도 규칙 보강 · 지문 묶음(setId) 카드 · 덮어쓰기 가져오기 · 표 없음 상태' },
  'verify_ir.js': { g: 'core', w: '시험지 풀이·채점·결과 — 전부 가짜 서버. AI 는 부르지 않는다.' },
  'verify_ir2.js': { g: 'core', w: '2차 확인 — 자체 시험 영역별·다시 풀기·듣기 대본·표 없음 가드·줄 휴지통·완료 옆 점수·sid·학생 화면 회귀' },
  'verify_iso.js': { g: 'core', w: '동형 문제 — 화면·흐름 확인 (AI 는 가짜 응답으로, 저장도 가짜로 — 진짜 돈·DB를 쓰지 않는다)' },
  'verify_iso_student.js': { g: 'core', w: '학생 화면 — 배정된 동형 문제가 ’문제만’ 보이는지 (정답·해설은 안 보여야 한다)' },
  'verify_isocards.js': { g: 'core', w: '동형 — 유형 설계 카드 (가짜 AI · 가짜 서버). 기출 원문은 쓰지 않는다.' },
  'verify_item.js': { g: 'core', w: 'Page & Pencil — 자료실·문제 은행 잇기 점검 (node verify_item.js)' },
  'verify_itemid.js': { g: 'core', w: '문항 id 가 ’행 id’ 로 들어오는지 — data 안에 id 가 없는 문항으로만 확인한다 (가짜 서버)' },
  'verify_kspell.js': { g: 'retired', w: 'P2 뜻 쓰기(kspell) 검증. 더미 학생만.', why: '더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_limited.js': { g: 'core', w: '서버 제한(402·읽기만 됨·일시 정지) — 띠·보기 전용·기기 자료로 열기' },
  'verify_library.js': { g: 'core', w: '라이브러리 (lib_books · lib_text) — 가짜 데이터만. 출판사 원문·학생 데이터는 쓰지 않는다.' },
  'verify_link.js': { g: 'core', w: 'Page & Pencil — ’다음 교재 하나로 잇기’ 점검 (node verify_link.js)' },
  'verify_live_eb.js': { g: 'live', w: '라이브 확인 — 배포된 페이지가 진짜 Supabase 뷰에서 자료실을 받아오는지 (읽기만 한다)', why: '실제 서버·배포된 페이지를 읽어야 한다 (PP_ALLOW_LIVE_READ=1)' },
  'verify_live_fix3.js': { g: 'live', w: '라이브 확인 — 자료실 듣기(드라이브 재생기 하나씩) · 동형 탭 (AI 는 부르지 않는다)', why: '실제 서버·배포된 페이지를 읽어야 한다 (PP_ALLOW_LIVE_READ=1)' },
  'verify_live_ib.js': { g: 'live', w: '진짜 서버로 ’문제 은행’ 탭을 열어 본다 (표는 있고 0줄).', why: '실제 서버·배포된 페이지를 읽어야 한다 (PP_ALLOW_LIVE_READ=1)' },
  'verify_live_song.js': { g: 'live', w: '라이브 노래 화면만 다시 — 광고 프리롤까지 기다린다', why: '실제 서버·배포된 페이지를 읽어야 한다 (PP_ALLOW_LIVE_READ=1)' },
  'verify_live_vocab.js': { g: 'live', w: '라이브 확인 — ① 실학생 학생뷰(체험 모드) 단어 탭에서 외부 호출 수 ② Sing Together 노래 화면', why: '실제 서버·배포된 페이지를 읽어야 한다 (PP_ALLOW_LIVE_READ=1)' },
  'verify_live_vocab2.js': { g: 'live', w: '라이브 확인 — ① 실학생 학생뷰(체험 모드) 단어 탭에서 외부 호출 수 ② Sing Together 노래 화면', why: '실제 서버·배포된 페이지를 읽어야 한다 (PP_ALLOW_LIVE_READ=1)' },
  'verify_lk.js': { g: 'core', w: '학습 세트 · 수업 기록 단원 자료 · 홈 시험 대비 — 전부 가짜 서버' },
  'verify_lk2.js': { g: 'retired', w: '학습 세트 다듬기 확인 — 실제 ’중학영어 2 (동아 윤정미) Lesson 5’ 본문으로', why: '앞선 검사가 임시 폴더에 남긴 파일(l5.json)을 읽는다 — 혼자 돌지 못한다' },
  'verify_match.js': { g: 'legacy', w: 'P2-1 검증. 실데이터 GET 만, 쓰기 전부 차단. 저장 없음.', why: '가짜 자료로는 안 맞는다 — 요즘 초등 영단어 2 단원 30개  — -1개 · totalUnits -1' },
  'verify_merge3.js': { g: 'legacy', w: '병합 뒤 3가지 확인: 복습 탭 단원 수 · 구간 표시 · 뜻 쓰기 #6·#17', why: '가짜 자료로는 안 맞는다 — 복습 탭 Smart Listening 1.1 단원 12개  — undefined' },
  'verify_meta.js': { g: 'retired', w: '단어 탭 외부 호출 검증. 실데이터 저장 0. 외부 요청은 전부 가로채서 센다.', why: '도우미 meta_dummy.js 가 저장소 밖(임시 폴더)에 있어 돌지 않는다' },
  'verify_p1.js': { g: 'retired', w: 'P1 검증 — 더미 학생으로만. 실학생 행에는 쓰지 않는다.', why: '더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_p1b.js': { g: 'retired', w: 'P1 검증 2 — 스펠·선택지·중간 이탈·별표. 더미 학생만.', why: '더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_p1c.js': { g: 'retired', w: '일부만 풀고 결과로 간 경우 — 안 푼 카드가 바뀌지 않는지, 저장 건수가 줄었는지', why: '더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_p1d.js': { g: 'legacy', w: '실학생은 ’보기만’ — 체험 모드(미리보기)로 들어가 저장 0건을 확인', why: '가짜 자료로는 안 맞는다 — 체험 모드로 들어갔다 (실학생 기록 보호)' },
  'verify_p22.js': { g: 'retired', w: 'P2-2·P2-3 검증. 교재 편집기는 더미 교재로만, 실학생은 보기만.', why: '더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_p245.js': { g: 'legacy', w: 'P2-4(ppReviewCover) · P2-5(단원 점검) 검증. 읽기만, 저장 0건.', why: '가짜 자료로는 안 맞는다 — 요즘2 Unit 5 → Unit 1~4 · 36단어' },
  'verify_p3.js': { g: 'retired', w: 'P3 스피드 테스트 검증. 더미 학생만. 실학생에는 쓰지 않는다.', why: '더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_p3box.js': { g: 'retired', w: '시험 ⑥ — 같은 날 중복 반영을 **양방향**으로, box 숫자까지 확인. 더미 학생만.', why: '더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_p4.js': { g: 'retired', w: 'P4 누적 오답 4주 복습 검증. 더미 학생만.', why: '더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_p5.js': { g: 'retired', w: 'P5 복습 게임 검증. 더미 학생(p1dummy0001)만 건드린다.', why: '더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_p5b.js': { g: 'retired', w: 'P5 추가 확인: ① 세션 0건 → ’0일 · 0분’  ② 리포트 게임 한 줄  ③ kspGrade 끝말(조깅/빠르다)', why: '더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_p6.js': { g: 'retired', w: 'P6 리포트·설정·리셋 검증. 더미 학생/숙제만.', why: '더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_p7.js': { g: 'retired', w: 'P7 문장 학습 검증. 더미 학생·더미 교재만 건드린다. 실학생은 읽기만.', why: '도우미가 저장소 밖에 있고, 더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_paint.js': { g: 'core', w: '실제로 ’칠해진’ 파랑·남색·보라만 찾는다 — 계산된 스타일 기준. 소스에 남아 있어도 덮여 있으면 제외.' },
  'verify_paper.js': { g: 'legacy', w: '단어 시험지 새 양식 검증. 실데이터 GET 만, 쓰기 전부 차단.', why: '가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of undefined (reading' },
  'verify_pb.js': { g: 'core', w: '시험지 만들기 + 문제 은행 보완 — 전부 가짜 서버. AI 는 부르지 않는다.' },
  'verify_polish.js': { g: 'core', w: '시험지 다듬기 확인 — 배점·쪽 번호(PDF)·인쇄 단추 자리·장문 묶음·복제/기기 삭제' },
  'verify_print.js': { g: 'legacy', w: '월간 리포트 인쇄 미리보기 — 리브랜딩 뒤 이름·색 확인. 실DB 쓰기 차단, 저장 버튼 안 누름.', why: '가짜 자료로는 안 맞는다 — 머리글·바닥글이 직결영어  — 0곳' },
  'verify_r1.js': { g: 'legacy', w: '프롬프트 1·2 수정 검증. 실DB 쓰기 전부 차단.', why: '가짜 자료로는 안 맞는다 — 진도 없으면 다른 프롬프트로 보냄' },
  'verify_r2.js': { g: 'legacy', w: '프롬프트 4 수정 검증. 실DB 쓰기 차단.', why: '가짜 자료로는 안 맞는다 — page.evaluate: ReferenceError: process is not defined' },
  'verify_r3.js': { g: 'core', w: '프롬프트 5~8 수정 검증. 실DB 쓰기 전부 차단.' },
  'verify_r4.js': { g: 'core', w: '프롬프트 6 — 메시지 보내기 상태(sent)와 단추 되돌림' },
  'verify_r5.js': { g: 'legacy', w: '프롬프트 7·8 — 보완 필요 라벨 · 시험지 창 교재 기본값 · 단원 차례', why: '가짜 자료로는 안 맞는다 — 시험지 창에 교재 기본값  — 교재 선택 (새 단어 없이 복습만 낼 수도 있어요)' },
  'verify_sandbox.js': { g: 'legacy', w: '1) 도장판 정리  2) 체험 모드(학생 기록 보존)  3) 도장은 전부 완료한 날만.', why: '가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of undefined (reading' },
  'verify_scores.js': { g: 'core', w: 'A부 학부모 점수 탭 검증 — 블록 조합 5가지 + 390px 캡처. 실DB 쓰기 전부 차단.' },
  'verify_scroll.js': { g: 'core', w: '스크롤 점검 — 화면보다 긴 내용이 **휠로 끝까지 닿는가**.' },
  'verify_shelf.js': { g: 'legacy', w: '학생 복습 탭 ’수업 교재 복습’ 검증 — 실데이터 GET 만, 쓰기 전부 차단.', why: '가짜 자료로는 안 맞는다 — 책장에 Read It! 30-1 가 있다' },
  'verify_snap.js': { g: 'legacy', w: '스냅샷 부팅 — 역할·학생이 바뀔 때 다른 사람 데이터가 보이지 않는지, 로그아웃이 스냅샷을 지우는지,', why: '가짜 자료로는 안 맞는다 — 교재 전체를 받지 않음  — 2.6KB' },
  'verify_song.js': { g: 'retired', w: 'feat/song-player 확인 — 선생님 화면에서 노래 모드. 가사 글자는 찍지 않는다(줄 수만).', why: '더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_song2.js': { g: 'legacy', w: '2차 확인 — ① 학생 복습 화면 히어로에 노래 ② 단어 누르면 노래 잠깐 멈춤', why: '가짜 자료로는 안 맞는다 — 기록 "Top Of The World" → 교재 단원  — 못 찾음' },
  'verify_song3.js': { g: 'legacy', w: '3차 확인 — ① 단어를 누르면 노래가 멈추고 저절로 다시 틀리지 않는다 ② 히어로는 활동 제외로 돌아갔다', why: '가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of null (reading ’pla' },
  'verify_split.js': { g: 'core', w: '기출과 교재 나누기 (B) — 가짜 자료줄만 쓴다. 실제 기출 원문은 쓰지 않는다.' },
  'verify_stage.js': { g: 'retired', w: '’어느 스테이지의 첫 시도가 기록이 되는가’ 만 확인. 더미 학생만.', why: '더미 학생·교재 줄을 **실제 서버에 넣어** 확인하는 방식 — 읽기까지 막은 뒤로는 돌 수 없다. 가짜 표로 다시 써야 한다' },
  'verify_stage2.js': { g: 'legacy', w: 'feat/stage-filter 확인 — ① 학습 세트 해석 줄 맞추기 ② 학생 문장 학습 ③ 자료실 수준', why: '실제 교재(중학영어 1~3)의 단원·문장이 있어야 한다 — 가짜 교재로는 못 찾는다' },
  'verify_stu3.js': { g: 'legacy', w: '조건 3 — 스냅샷 부팅 뒤에도 학생 단어장 3단계와 원서 듣기 본문이 온전한지.', why: '가짜 자료로는 안 맞는다 — name: ’TimeoutError’' },
  'verify_trash.js': { g: 'legacy', w: '휴지통 행이 새어 나오는지 검증. 실데이터 GET 만, 쓰기는 전부 차단.', why: '가짜 자료로는 안 맞는다 — 휴지통에 mw4t32s8lzs8 가 있다(withDeleted:true 로는 보임)  — 0건' },
  'verify_trim.js': { g: 'legacy', w: '[1] 학생 화면 완료 숙제 제거 · [2] 번호 없는 Review 연결. 실데이터 쓰기 0.', why: '가짜 자료로는 안 맞는다 — page.evaluate: TypeError: Cannot read properties of undefined (reading' },
  'verify_tts.js': { g: 'core', w: '2-1 tts-proxy 경로 검증. 실DB 쓰기·실제 ElevenLabs·Cloudinary 호출 전부 차단.' },
  'verify_visible.js': { g: 'core', w: 'Page & Pencil — ’설정한 것이 보이는가’ 점검 (node verify_visible.js)' },
  'verify_vocab2.js': { g: 'legacy', w: '넣은 어휘 반복 숙제가 학생·학부모 화면에 제대로 뜨는지. 읽기만, 쓰기 전부 차단.', why: '가짜 자료로는 안 맞는다 — 어휘 반복 숙제 2건이 보인다  — 0건' },
};

const fs = require('fs');
const path = require('path');
function retired() {
  const d = path.join(__dirname, 'retired');
  try { return fs.readdirSync(d).filter(f => /^verify_.*\.js$/.test(f)).sort(); } catch (e) { return []; }
}
// README 의 표 (node tests/run.js --readme)
function markdown(all) {
  const names = [...new Set((all || Object.keys(TESTS)).concat(Object.keys(TESTS)))].sort();
  const out = ['| 검사 | 묶음 | 무엇을 보는지 | 왜 안 도는지 |', '| --- | --- | --- | --- |'];
  GROUPS.forEach(g => names.filter(f => (TESTS[f] || {}).g === g).forEach(f => {
    const t = TESTS[f];
    out.push('| `' + f.replace(/\.js$/, '') + '` | ' + g + ' | ' + (t.w || '') + ' | ' + (t.why || '') + ' |');
  }));
  return out.join('\n');
}
module.exports = { GROUPS, TESTS, retired, markdown };
