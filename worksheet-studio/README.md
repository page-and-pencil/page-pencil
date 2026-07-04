# Worksheet Studio (개인용)

영어 독해 지문을 붙여넣으면 AI가 인쇄용 리딩 워크시트를 생성해주는 개인용 앱입니다.
로그인·결제·사용량 제한 없이 자유롭게 사용할 수 있습니다.

- 기능은 [worksheetstudio.store](https://worksheetstudio.store/)의 개인용 풀 클론,
- 디자인은 [Page & Pencil](https://page-and-pencil.github.io/page-pencil/)의 클린·미니멀 스타일을 따릅니다.

## 기능

- **3단계 플로우**: 지문 붙여넣기 → AI 생성(섹션별 진행 로그) → 검토 & 다운로드 스튜디오
- **이미지/PDF 가져오기**: 교재 사진·스캔·PDF 최대 4개(파일당 10MB) → AI가 지문만 추출
- **13개 워크시트 섹션**: Summary Infographic, Sentence Translation, Vocabulary(단어표+퀴즈),
  Comprehension, Thinking, Discussion, Writing(브레인스토밍→문장템플릿→초안), Grammar Spotlight,
  Text Structure + 문학 전용 4종 (Literary Devices, Character, Plot, Theme & Symbolism)
- **8개 모국어 지원**: 한국어, 영어, 베트남어, 힌디어, 일본어, 중국어, 인도네시아어, 아랍어
- 학년(Grade 2–12) 및 지문 타입(Informational / Literature) 선택
- **디자인 스튜디오**: 테마 5종 + 커스텀 색상(Primary/헤더/텍스트), 워크시트 폰트 5종
  (Editorial/Classroom Serif, Modern/Clean/Poster Sans), 제목 굵기, 여백, 행 높이,
  정렬, 번호 스타일, 영어 컬럼 폭, 줄번호·모국어 컬럼·이모지·지문 표시 토글
- **전체 인라인 편집**: 미리보기에서 아무 텍스트나 클릭해 수정, 섹션 순서 ▲▼ 변경
- **내보내기**: 문제지 PDF + 답안지(Answer Key) PDF (브라우저 인쇄 → "PDF로 저장"), **Excel(.xlsx)**
- Name / Date / Score 박스, 학교·교사명 인쇄(선택)
- **기본 설정 저장**: 학년·언어·섹션 & 디자인 설정을 내 기본값으로 저장
- 저장 히스토리 (검색 / 다시 열기 / 삭제)

## 실행 방법 (Windows)

```powershell
cd Worksheet
npm install   # 처음 한 번
npm run dev   # 프론트 5173 + API 8787
```

그다음 브라우저에서 **http://localhost:5173** 을 여세요.

## AI 연결 (.env)

실제 AI 생성을 쓰려면 `.env` 파일에 Anthropic API 키를 넣으세요:

```
ANTHROPIC_API_KEY=sk-ant-...
```

- 키 발급: https://platform.claude.com
- 키가 없으면 **데모 모드**로 동작합니다 (화면 우측 상단에 "Demo mode" 배지 표시,
  섹션 구조는 동일하지만 내용은 자리표시 텍스트). 이미지/PDF 가져오기는 키가 필요합니다.
- AI 호출 코드: [server/generate.js](server/generate.js) — Claude `claude-opus-4-8`.
  섹션마다 **개별 JSON Schema 구조화 호출**(최대 3개 병렬 + 프롬프트 캐시)로 생성합니다 —
  전체 섹션을 스키마 하나로 합치면 API의 compiled-grammar 한도를 초과하기 때문.

## 구조

```
server/          Express API (생성 잡, OCR 가져오기, 워크시트 저장)
  generate.js    Claude API 호출(생성+비전 OCR) + 데모 폴백
  sections.js    섹션 카탈로그 + JSON 스키마
  store.js       JSON 파일 저장소 (data/db.json)
src/             React (Vite) 프론트엔드
  components/    3단계 위저드, 워크시트 렌더러(디자인 옵션), 디자인 패널, 히스토리
  excel.js       Excel(.xlsx) 내보내기
  constants.js   섹션/언어/테마/폰트/레이아웃 카탈로그 + 기본설정 저장
```

> 다른 컴퓨터로 옮길 때는 `data/db.json`(저장 히스토리)과 `.env`(API 키)를 함께 복사하세요.
