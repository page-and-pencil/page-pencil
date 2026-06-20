# Page & Pencil — 디자인 리뉴얼 핸드오프

이 폴더는 **Page & Pencil 웹앱(page-and-pencil/page-pencil)의 전체 디자인을 새 디자인 시스템으로 교체**하기 위한 명세서와 시안 묶음입니다.

> **VS Code의 Claude에게**: 이 README가 단일 작업 지시서입니다. 아래 순서대로 실제 repo 코드를 수정하세요. 함께 든 `*.dc.html` 파일은 **시각 레퍼런스(프로토타입)** 이며 그대로 복사하는 게 아니라, 기존 vanilla HTML/CSS/JS SPA 구조에 맞춰 **모양만 재현**하는 것이 목표입니다.

---

## 0. 대원칙 (반드시 지킬 것)

- **JS 로직·Supabase 연동·함수 시그니처·이벤트 핸들러는 절대 바꾸지 않는다.** 바꾸는 것은 **색/간격/컴포넌트 스타일/마크업 구조**뿐이다.
- 작업은 대부분 **`css/style.css`의 클래스 정의 수정**으로 끝난다. 그래야 모든 화면에 한 번에 반영된다. 화면별 인라인 스타일은 그 다음.
- 각 단계가 끝나면 앱이 여전히 정상 렌더되는지 확인하고 커밋한다. (선생님 로그인 / 학부모 PIN / 학생 PIN 진입 후 각 탭이 깨지지 않는지)
- `onclick`, `id`, `data-*` 속성은 유지한다. JS가 이 값들로 DOM을 찾는다.

---

## 1. 작업 순서 (레버 단위)

| 단계 | 작업 | 범위 | 효과 |
|---|---|---|---|
| **레버 1** | 색 토큰 교체 | `:root` + 하드코딩 색 | 전 화면 색 전환 |
| **레버 2** | 공통 컴포넌트 CSS 업그레이드 | `css/style.css` 클래스들 | 전 화면 "느낌" 전환 |
| **레버 3** | 화면별 레이아웃 재현 | 각 render 함수 | 구조 개선 (화면 단위) |

**레버 1 → 2 까지만 해도 앱 전체 인상이 80% 바뀝니다.** 레버 3은 화면별로 점진 진행.

---

## 2. 레버 1 — 색 토큰 (디자인 시스템)

### 2-1. `css/style.css`의 `:root`를 아래로 교체

```css
:root{
  --navy:#14304A;--navy2:#1B3B57;--navy3:#0E2230;
  --cream:#FFFFFF;--cream2:#F1F6F8;--cream3:#F6FAFB;
  --teal:#0CA4C9;--tl:#E3F5FA;
  --coral:#F59E0B;--cl:#FEF0D5;
  --amber:#F59E0B;--al:#FEF0D5;
  --purple:#0B8DAE;--pl:#E3F5FA;
  --slate:#5A6B7B;--border:rgba(15,48,74,0.08);
  --sh:0 1px 3px rgba(15,48,74,0.06);--shlg:0 8px 32px rgba(15,48,74,0.12);
  --r:12px;--rs:8px;
  --fb:'Pretendard','Noto Sans KR',sans-serif;--fd:'Montserrat',sans-serif;--fm:var(--fb);
}
```

### 2-2. 하드코딩된 옛 색을 전 파일에서 일괄 치환

`css/style.css`, `index.html`, `js/teacher.js`, `js/utils.js`, `js/student.js`, `js/parent.js` 전체에서:

| 찾기 | 바꾸기 | 의미 |
|---|---|---|
| `#0d2542` | `#14304A` | 잉크/네이비 |
| `#163358` | `#1B3B57` | 네이비2 |
| `#091b30` | `#0E2230` | 네이비3(다크면) |
| `#00c4cc` | `#0CA4C9` | 브랜드 틸 |
| `#00b0b6` | `#0B93BB` | 틸 hover |
| `#009aa0` | `#0B8DAE` | 틸 진한 hover |
| `#005f6b` | `#0B8DAE` | 틸 텍스트 |
| `#C4614A` | `#F59E0B` | coral→앰버 |
| `#F4784A` | `#F59E0B` | 앰버 |
| `#b84010`, `#A03020`, `#a03020`, `#7A4A0A` | `#B45309` | 경고 텍스트 |
| `#3b2fa0` | `#46586B` | 스펠 단계→슬레이트 |
| `#F5E6E1` | `#FEF0D5` | 경고 배경 |
| `#E0FAFB` | `#E3F5FA` | 틸 soft 배경 |
| `#D6F5F7` | `#E3F5FA` | purple soft |
| `rgba(0,196,204,` | `rgba(12,164,201,` | 틸 글로우 |
| `rgba(244,120,74,` / `rgba(196,97,74,` | `rgba(245,158,11,` | 앰버 |
| `rgba(92,79,187,` | `rgba(70,88,107,` | 슬레이트 |
| `rgba(13,37,66,` | `rgba(15,48,74,` | 잉크 테두리/그림자 |

> 의미 컬러 체계: **브랜드=틸 `#0CA4C9`**, **강점/긍정=에메랄드 `#10B981`(텍스트 `#047857`, 배경 `#D9F6E9`)**, **보완/경고=앰버 `#F59E0B`(텍스트 `#B45309`, 배경 `#FEF0D5`)**, **중립=슬레이트 `#46586B`**. 에메랄드는 레버 2~3에서 "완료/강점" 의미가 명확한 곳에 새로 도입한다(아래 참고).

---

## 3. 레버 2 — 공통 컴포넌트 CSS 업그레이드

`css/style.css`에서 아래 클래스 정의를 디자인 시스템 규격으로 조정한다. 시각 기준은 `디자인시스템.dc.html`.

### 3-1. 카드 · 면
```css
.card{ background:#fff; border-radius:14px; border:1px solid rgba(15,48,74,.07);
  box-shadow:0 1px 3px rgba(15,48,74,.04); }
.ch{ padding:16px 20px; }   /* 카드 헤더 패딩 ↑ */
.cb{ padding:18px 20px; }
```

### 3-2. 버튼 (시안: 주=틸+그림자, 보조=흰 테두리, 추가=점선)
```css
.btn{ border-radius:10px; font-weight:700; gap:6px; }
.bt{ background:#0CA4C9; color:#fff; box-shadow:0 3px 10px rgba(12,164,201,.3); }
.bt:hover{ background:#0B93BB; }
.bp{ background:#0CA4C9; color:#fff; box-shadow:0 3px 10px rgba(12,164,201,.3); } /* 주 액션도 틸로 통일 */
.bo{ background:#fff; color:#14304A; border:1px solid rgba(15,48,74,.13); }
.bo:hover{ border-color:rgba(15,48,74,.28); }
/* "추가" 류 점선 버튼 패턴 (신규 클래스로 도입 가능) */
.badd{ background:#fff; color:#0B8DAE; border:1px dashed rgba(12,164,201,.4);
  border-radius:8px; font-weight:600; }
```

### 3-3. 뱃지 (의미 컬러 3그룹 + 에메랄드 도입)
```css
.badge{ border-radius:11px; font-weight:700; padding:3px 10px; }
.bteal{ background:#E3F5FA; color:#0B8DAE; }          /* 진행중/브랜드 */
.bgreen{ background:#D9F6E9; color:#047857; }          /* 완료/강점 (신규) */
.bcoral{ background:#FEF0D5; color:#B45309; }          /* 보완/미납 → 앰버 */
.bamber{ background:#FEF0D5; color:#B45309; }
.bslate{ background:#F0F2F5; color:#5A6B7B; }          /* 중립/학년 */
```
> "완료/완납/강점" 의미로 쓰이던 `.bteal`을 **`.bgreen`(에메랄드)** 로 바꿔주면 시안과 정확히 일치한다. (예: 출석/완료/완독 뱃지)

### 3-4. 코멘트 칩 (강점=그린, 진행중=슬레이트, 보완=앰버)
시안 `디자인시스템.dc.html`의 "코멘트 칩 3그룹" 그대로. 칩 색을 그룹별로:
```css
/* 강점 */   background:#D9F6E9; border:1px solid #10B981; color:#047857;
/* 진행중 */ background:#fff;    border:1px solid rgba(15,48,74,.14); color:#46586B;
/* 보완 */   background:#FEF0D5; border:1px solid #F59E0B; color:#B45309;
```

### 3-5. 평가 막대 (성장/점수)
```css
/* 트랙 */ height:6px; background:#EDF2F4; border-radius:4px;
/* 채움: 우수=#10B981, 양호=#0CA4C9, 보완=#F59E0B */
```

### 3-6. 헤더 · 사이드바 · 탭
- 상단 헤더 `.ah`, `.stu-app-header`, `.ph`: 배경 `var(--navy)`(=#14304A) 유지, 로고 `&`는 틸 이탤릭.
- **사이드/탭 활성 표시**를 시안처럼: 데스크톱 사이드바 활성 항목은 **틸 pill**(`background:#0CA4C9; color:#fff; border-radius:11px; box-shadow:0 3px 10px rgba(12,164,201,.3)`), 모바일 탭 활성은 하단 틸 보더 + 틸 텍스트(현 `.ntab.active`/`.ptab.active`/`.stutab.active` 그대로 색만 새 틸).
- 입력 필드 `.f input` 등: 포커스 시 `border-color:#0CA4C9`, 배경 `#F8FBFC`.

### 3-7. 아이콘 (이모지 → Lucide, 선택)
시안은 기능 아이콘을 **Lucide 라인 아이콘**으로 통일했다. 도입하려면 `index.html`에 `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>` 추가 후, 렌더 끝에 `lucide.createIcons()` 호출. 이모지 → Lucide 매핑은 `디자인시스템.dc.html`의 "아이콘 매핑" 섹션 참조. **학생용 응원/게임 요소의 이모지는 유지 가능.** (이 작업은 레버 3에서 화면별로 점진 적용 권장)

---

## 4. 레버 3 — 화면별 레이아웃

각 화면의 목표 모양은 동봉한 시안 파일에 있다. 해당 render 함수의 **마크업/인라인 스타일만** 시안 구조에 맞춘다.

| 시안 파일 | 대상 (역할·화면) | 실제 코드 위치(대략) |
|---|---|---|
| `선생님 대시보드.dc.html` | 선생님 대시보드 | `js/teacher.js` 대시보드 render |
| `선생님 학생관리.dc.html` | 선생님 · 학생 (목록+상세 split) | `js/teacher.js` 학생 패널 |
| `선생님 자료DB.dc.html` | 선생님 · 자료 DB | `js/teacher.js` 자료 DB |
| `선생님 테스트.dc.html` | 선생님 · 테스트(AI 채점) | `js/teacher.js` 테스트 |
| `선생님 과제.dc.html` | 선생님 · 과제(할당/제출현황) | `js/teacher.js` 과제 |
| `선생님 설정.dc.html` | 선생님 · 설정 | `js/teacher.js` 설정 |
| `학생 모바일.dc.html` | 학생 · 오늘 홈 | `js/student.js` 홈 |
| `학생 단어카드.dc.html` | 학생 · 단어 3단계 학습 | `js/student.js` 단어 |
| `학생 복습.dc.html` | 학생 · 복습(망각곡선) | `js/student.js` 복습 |
| `학생 원서듣기.dc.html` | 학생 · 원서 듣기 | `js/student.js` 원서 |
| `학부모 모바일.dc.html` | 학부모 · 수업 기록 | `js/parent.js` 수업 탭 |
| `학부모 점수추이.dc.html` | 학부모 · 점수 | `js/parent.js` 점수 탭 |
| `학부모 메시지.dc.html` | 학부모 · 메시지 | `js/parent.js` 메시지 탭 |
| `학부모 결제.dc.html` | 학부모 · 결제 | `js/parent.js` 결제 탭 |
| `랜딩.dc.html` | 공개 랜딩 | `index.html` `#s-land` (또는 별도 페이지) |
| `로그인.dc.html` | 로그인/역할 선택 | `index.html` `#s-login`/`#s-pin`/`#s-stupin` |

**권장 진행 순서**: 선생님 대시보드 → 학부모 3탭(점수/메시지/결제) → 학생 홈/복습/원서 → 선생님 테스트/과제/설정 → 랜딩/로그인.

각 화면 작업 시: 시안 파일을 열어 (1) 레이아웃 골격(그리드/플렉스/폭) (2) 카드 구성 (3) 텍스트 위계(크기/굵기) (4) 의미 컬러 사용을 그대로 옮기되, **데이터는 기존 JS가 채우는 변수를 그대로 사용**한다. 더미 텍스트는 시안 참고용일 뿐 실제 바인딩으로 대체.

---

## 5. 디자인 토큰 요약 (빠른 참조)

- **타이포**: 본문/UI = Pretendard, 로고/숫자/영문 라벨 = Montserrat(`.mono`/`var(--fd)`). H1 23·800, H2 17·800, 본문 13.5, 라벨 11·700 UPPERCASE .05em.
- **색**: 위 `:root` + 의미 컬러(틸/에메랄드/앰버/슬레이트).
- **반경**: 칩·입력 8, 카드 14, pill 20.
- **그림자**: 카드 `0 1px 3px rgba(15,48,74,.06)`, 틸 버튼 `0 3px 10px rgba(12,164,201,.3)`.
- **간격**: 카드 패딩 20~22, 섹션 16~18, 칩 7~8, 필드 14~16.

---

## 6. 동봉 파일

- `디자인시스템.dc.html` — **마스터 디자인 시스템** (색/타이포/컴포넌트/아이콘 매핑). 모든 판단의 기준.
- `Page_and_Pencil_브랜드DNA.md` — 톤·메시지(랜딩 카피용).
- `*.dc.html` (16개) — 화면별 시안. HTML 안의 인라인 스타일 값을 그대로 참고.

> 이 `.dc.html`들은 디자인 도구 전용 프로토타입이라 `support.js` 런타임에 의존한다. **브라우저로 직접 띄우는 용도가 아니라, 코드를 열어 스타일 값을 읽는 레퍼런스**로 사용할 것.
