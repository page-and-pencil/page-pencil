# Page & Pencil 프로젝트

## 배포
- URL: https://page-and-pencil.github.io/page-pencil/
- GitHub: page-and-pencil/page-pencil
- 배포 방법: git add . && git commit -m "설명" && git push

## 파일 구조
- index.html: HTML 구조 및 화면 레이아웃
- css/style.css: 전체 스타일
- js/db.js: Supabase 연결, _cache, DB 헬퍼 함수, loadAllData
- js/teacher.js: 선생님 앱 로직 (DOMContentLoaded 포함)
- js/student.js: 학생 앱 로직
- js/parent.js: 학부모 앱 로직
- js/utils.js: 공통 유틸 (show, toast, uid 등)
- worksheet-studio/: 워크시트 스튜디오 소스 (React+Vite, AI 리딩 워크시트 생성기)
- studio/: 워크시트 스튜디오 빌드 결과물 (직접 수정 금지 — 소스 수정 후 아래 명령으로 재빌드)
  - 빌드: `cd worksheet-studio && npm install && npx vite build --mode pp --base=./ --outDir ../studio --emptyOutDir`
  - pp 모드: AI 호출은 claude-proxy 엣지 함수, 저장은 worksheets 테이블, API 키는 settings의 apikey 재사용

## Supabase
- URL: https://pznpcewwdsbxwibpnapn.supabase.co
- 테이블: students, lessons, tests, readings, logs, library, notices, homeworks, assignments, textbooks, messages, vocab_cards, global_textbooks, settings, worksheets(워크시트 스튜디오)

## 외부 서비스
- Cloudinary: name=drwys3bkz, preset=pp_unsigned (오디오/이미지 업로드)
- Claude API: claude-haiku-4-5-20251001 (AI 코멘트 변환, 단어 뜻 조회)

## 3개 역할
- 선생님: 수업 기록, 테스트, 과제 할당, 학생 관리
- 학생: 숙제 확인, 단어장 3단계 학습, 원서 듣기
- 학부모: 수업 기록 조회, 테스트 점수 추이, 선생님 메시지

## 데이터 규칙
- **콘텐츠 진실성 (최우선)**: 단어 목록·단원 구성·본문·예문을 AI 지식으로 창작해 등록하는 것 금지.
  반드시 원본(책 사진·본문 텍스트·워드리스트 파일)에서 전사(추출)한 것만 등록한다.
  사전적 사실(단어의 뜻·품사·불규칙 변화)의 자동 보완은 허용. 예문은 원문 우선, 없으면 비워둔다.
  예외: 파닉스 교재 단어는 원문이 없는 경우 초보용 쉬운 자작 문장 허용 (exampleSrc:'easy' 표식, 2026-07-12 원장 지시).
- 교재 표기: 풀네임 한 줄 통일 (예: "Read It! 30-1", "Easy Link Starter 1"). 레벨 분리형은 2026-07-11 전량 마이그레이션 완료 — level 필드는 더 이상 쓰지 않음. bookId 없는 옛 수업 기록의 교재 문자열("Easy Link" 등)은 역사 기록이라 그대로 둠
- 카테고리(파닉스/어휘/어법/리딩/리스닝/라이팅/내신)는 비우지 않음 — 탭 필터·수업기록 자동 채움의 기준
- 원본은 교재 DB(global_textbooks): 단어·단원·학생 카드가 여기서 파생. 수정은 교재 쪽에서 (연쇄 반영: tuApplyRenames·tuCascadeCardUnits·_mergeCardMeaning)
- 클래스5 과제도 교재 DB(type:textbook)의 책·단원을 그대로 사용 — 별도 클래스5 라이브러리(type:class5)는 2026-07-12 통합·폐기 (행 9개 휴지통 처리, 과 목록은 교재 단원으로 이식). 과거 과제 기록의 책·과 문자열은 역사 기록이라 그대로 둠
- 백업: fullBackup()이 전 테이블 JSON 덤프 (대시보드가 월 1회 알림, localStorage pp_lastBackup 기준)
- 삭제는 휴지통(soft delete): 주요 삭제는 supaTrash(_deleted 표식)로 — loadAllData가 필터, 백업·일괄 탭 휴지통에서 복원, 30일 후 자동 영구 삭제(purgeOldTrash). 새 삭제 기능을 만들 땐 하드 delete 대신 supaTrash 사용

## 디자인 규칙
- 색·아이콘·카드는 `DESIGN_RULES.md` 를 따른다 (색은 토큰만, 카드 모서리 4단계, 아이콘은 선생님/학부모=Lucide·학생=이모지 허용)
- 브랜드 자산(로고·인쇄물) 기준은 별도 `DESIGN.md` — 앱 색과 다른 것은 의도된 것

## 작업 원칙
- 수정 요청 시 관련 파일만 읽고 수정
- yes/no 확인 없이 자동 진행
- 수정 완료 후 항상 git push까지 자동 실행
- 버그 수정 시 원인 먼저 파악 후 최소한의 변경만

## 검사 (tests/)
- 검사 스크립트는 **반드시 `tests/` 안에** 둔다. 임시 폴더에 두지 않는다.
- 돌리는 길은 하나: `node tests/run.js` (묶음 이름이나 검사 이름을 붙이면 그것만 — `node tests/run.js iso`)
- 모든 검사는 막음 장치를 거친다 — 첫 줄에 `require('./_guard_assert');`.
  없는 파일이 하나라도 있으면 run.js 가 **아무것도 돌리지 않는다**.
- **검사와 캡처는 실제 서버(Supabase)를 읽지 않는다.** 앱이 뜨는 데 필요한 줄은 `tests/fixtures/db.json` 의
  가짜 표에서 답한다(막음 장치가 읽기까지 막는다). 전송량이 2026-11-13 기준 14.61GB / 5GB 이고 11/15 부터 제한이다.
- **실제 서버를 읽는 확인은 `live` 묶음뿐이다** — `PP_ALLOW_LIVE_READ=1 node tests/run.js live --jobs 1`,
  원장이 시킬 때만. 그 밖에 실제로 나가는 요청은 run.js 끝줄의 '줄 수 전후' 확인 8건뿐이다.
- 새 검사도 **가짜 표로 짠다**. 쓰기를 흉내 내야 하면 그 표를 `tests/_fake.js` 의 `fakeTables` 로 끼운다.
  안 끼우면 막음 장치가 잡는다(2026-11-12 item_bank 에 검사 문항이 들어간 사고 — `tests/README.md`).
- 묶음은 넷이다(core·live·legacy·retired). `node tests/run.js` 는 **core 만** 돌린다. 묶음표는 `tests/_groups.js`.
- **2026-11-27 까지는 `PP_SKIP_COUNTS=1 node tests/run.js`** (실제 서버 요청 0건). 한도 초과로 11/15~11/27 에는
  줄 수 확인마저 402 로 막힐 수 있는데, 막혀도 검사는 실패로 치지 않는다.
- 검사 파일에 실제 학생 이름·id·연락처, 기출 원문, 키 값을 넣지 않는다.
- `tests/live/` 는 실제 서버에 쓰는 도구다. run.js 가 돌리지 않고, 손으로만 돌린다.
