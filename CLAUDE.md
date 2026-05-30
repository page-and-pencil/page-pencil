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

## Supabase
- URL: https://pznpcewwdsbxwibpnapn.supabase.co
- 테이블: students, lessons, tests, readings, logs, library, notices, homeworks, assignments, textbooks, messages, vocab_cards, global_textbooks, settings

## 외부 서비스
- Cloudinary: name=drwys3bkz, preset=pp_unsigned (오디오/이미지 업로드)
- Claude API: claude-haiku-4-5-20251001 (AI 코멘트 변환, 단어 뜻 조회)

## 3개 역할
- 선생님: 수업 기록, 테스트, 과제 할당, 학생 관리
- 학생: 숙제 확인, 단어장 3단계 학습, 원서 듣기
- 학부모: 수업 기록 조회, 테스트 점수 추이, 선생님 메시지

## 작업 원칙
- 수정 요청 시 관련 파일만 읽고 수정
- yes/no 확인 없이 자동 진행
- 수정 완료 후 항상 git push까지 자동 실행
- 버그 수정 시 원인 먼저 파악 후 최소한의 변경만
