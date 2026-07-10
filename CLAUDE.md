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
- 교재 표기: 풀네임 한 줄 통일 (예: "Read It! 30-1", "Easy Link Starter 1"). 레벨 분리형은 2026-07-11 전량 마이그레이션 완료 — level 필드는 더 이상 쓰지 않음. bookId 없는 옛 수업 기록의 교재 문자열("Easy Link" 등)은 역사 기록이라 그대로 둠
- 카테고리(파닉스/어휘/어법/리딩/리스닝/라이팅/내신)는 비우지 않음 — 탭 필터·수업기록 자동 채움의 기준
- 원본은 교재 DB(global_textbooks): 단어·단원·학생 카드가 여기서 파생. 수정은 교재 쪽에서 (연쇄 반영: tuApplyRenames·tuCascadeCardUnits·_mergeCardMeaning)
- 클래스5 라이브러리(type:class5)는 클래스5 과제의 과 목록 전용, 수업용 책은 교재 DB에 별도 등록
- 백업: fullBackup()이 전 테이블 JSON 덤프 (대시보드가 월 1회 알림, localStorage pp_lastBackup 기준)
- 삭제는 휴지통(soft delete): 주요 삭제는 supaTrash(_deleted 표식)로 — loadAllData가 필터, 백업·일괄 탭 휴지통에서 복원, 30일 후 자동 영구 삭제(purgeOldTrash). 새 삭제 기능을 만들 땐 하드 delete 대신 supaTrash 사용

## 작업 원칙
- 수정 요청 시 관련 파일만 읽고 수정
- yes/no 확인 없이 자동 진행
- 수정 완료 후 항상 git push까지 자동 실행
- 버그 수정 시 원인 먼저 파악 후 최소한의 변경만
