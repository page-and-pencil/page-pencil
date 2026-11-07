# 학생 개인정보 보호 — Supabase Auth 전환 설계서 (B안)

작성 2026-11-07. **설계서입니다. 아무 기능도 켜지 않았습니다.**
SQL 초안은 `supabase/auth_rls_draft.sql` — 실행하지 마세요.
**키·비밀번호·토큰 값은 이 문서에 없습니다.**

---

## 0. 왜 지금 구조로는 막을 수 없나

```
학생·학부모 로그인  =  이름 + PIN 을 브라우저가 비교
브라우저가 비교하려면  →  students 테이블을 읽을 수 있어야 한다
읽을 수 있으면        →  공개 anon 키를 가진 누구나 읽을 수 있다
읽히는 것            →  이름 · PIN · 학부모 연락처 · 학교 · 학년 · 수강료
```

RLS 를 켜도 "anon 에게 students select 허용" 정책을 달아야 앱이 돌기 때문에
**정책으로는 해결되지 않습니다.** 로그인을 서버로 옮기는 것이 유일한 길입니다.

---

## 1. 선생님 로그인

지금: `settings.pw` 의 64자 해시를 브라우저가 비교 (`DB.pw()` → `checkTeacherPw`).
해시가 공개돼 있어 사전 공격이 가능하고, 비밀번호를 바꿔도 공개되는 구조는 그대로입니다.

**바꿀 것: Supabase Auth 이메일 계정 1개 (`jikgyeol@gmail.com`)**

```
· Supabase → Authentication → Users → 계정 1개 생성 (비밀번호는 원장님만)
· 앱: supabase-js 를 새로 넣지 않고 REST 로 처리한다 (지금 구조 유지)
    POST /auth/v1/token?grant_type=password   { email, password }
    → { access_token, refresh_token, expires_in }
· access_token 을 Authorization 헤더로 쓰면 그 요청은 'authenticated' 역할이 된다
· 토큰은 sessionStorage 에 (localStorage 는 탭·기기 공유 위험)
· 만료(기본 1시간) 전에 refresh_token 으로 갱신 — 수업 중에 끊기지 않게
· 2단계 인증(선택): Supabase 가 TOTP 를 지원. 계정이 1개라 부담이 적다
```

**바뀌는 코드**: `checkTeacherPw`(teacher.js 30~41행), `changePw`, `DB.pw()`,
`SUPA_HEADERS`(db.js) — 헤더를 '세션이 있으면 그 토큰, 없으면 anon' 으로 만드는 함수 하나.

---

## 2. 학생·학부모 로그인 — 두 가지 안

### 2-A. 로그인 전용 엣지 함수 (추천)

```
supabase/functions/login/index.ts   (service_role 로 students 를 읽는다)
  입력  { role:'student'|'parent', name?, pin }
  하는 일 ① students 에서 이름+PIN 대조 (서버에서)
          ② 맞으면 그 학생 전용 Auth 사용자를 찾거나 만든다
             email = <학생id>@stu.jikgyeol.local  (실제 메일 주소가 아님)
             비밀번호 = 서버 시크릿에서 유도한 무작위 값 (어디에도 보여 주지 않음)
          ③ /auth/v1/token 으로 그 사용자의 세션을 받아 그대로 돌려준다
          ④ app_metadata 에 { sid, role } 을 박아 둔다  ← RLS 가 이것을 본다
  출력  { access_token, refresh_token, sid, name }
  방어  IP·sid 별 시도 횟수 제한, Origin 확인, PIN 은 로그에 남기지 않음
```

| 장점 | 단점 |
|---|---|
| 지금 PIN 로그인 경험이 그대로 (아이가 네 자리만 누름) | 함수 1개를 더 관리해야 함 |
| `students` 의 anon select 를 **완전히 닫을 수 있다** | Auth 사용자가 학생 수만큼 생김(무료 한도 안) |
| RLS 를 `app_metadata.sid` 로 간단히 쓸 수 있다 | 학생이 PIN 을 잊으면 선생님이 재발급(지금과 같음) |
| 선생님 앱은 1번의 계정 하나로 전부 접근 | |

### 2-B. 학생별 실제 계정 (이메일·비밀번호)

| 장점 | 단점 |
|---|---|
| 표준적이고 추가 함수가 필요 없다 | 초3 학생이 이메일·비밀번호를 쓸 수 없다 |
| 비밀번호 재설정이 Supabase 기본 기능 | 학부모 메일 주소를 전부 받아야 한다 |

**추천: 2-A.** 아이가 쓰는 앱이라 PIN 네 자리를 포기할 수 없습니다.
2-A 는 겉보기는 지금과 같고 안쪽만 서버로 옮기는 방식입니다.

### QR 링크

지금: `?pin=1234&role=student` — 링크만 있으면 누구나 그 학생으로 들어갑니다.
바꿀 것: `?t=<무작위 32자>` 토큰. `students.data.qrToken` 에 저장하고 login 함수가 대조합니다.
`[QR 새로 만들기]` 로 토큰을 갱신(= 옛 링크 무효). 주소에서 지우는 처리는 이미 들어가 있습니다.

---

## 3. 테이블별 RLS 정책 초안

`authenticated` 역할 안에서 선생님과 학생을 가르는 기준:

```sql
-- 선생님: app_metadata.role = 'teacher'
(auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher'
-- 본인(학생·학부모): app_metadata.sid = 그 행의 sid
(auth.jwt() -> 'app_metadata' ->> 'sid') = sid
```

| 테이블 | 선생님 | 학생·학부모 | anon |
|---|---|---|---|
| students | 전부 읽기·쓰기 | **자기 행만**, PIN·연락처·수강료는 뷰로 가림 | 닫음 |
| assignments · homeworks · vocab_cards · readings · logs | 전부 | 자기 `sid` 행 읽기·쓰기 (숙제 체크·단어 학습) | 닫음 |
| lessons · tests · messages · monthly_reports · counsels | 전부 | 자기 `sid` 행 읽기만 | 닫음 |
| classes · exam_schedules | 전부 | 읽기만 | 닫음 |
| global_textbooks · library · textbooks · notices · worksheets | 전부 | 읽기만 | 닫음 |
| tts_cache | 전부 | 읽기 + 새 음원 넣기 | 닫음 |
| settings | 전부 | 화이트리스트만 읽기 (`settings_rls.sql`) | 같음 |

`students` 의 PIN·연락처·수강료는 학생 자신에게도 보일 필요가 없습니다.
**뷰 `students_safe`**(이름·학년·학교·반만)를 만들어 학생·학부모는 뷰를 읽게 하고,
원본 테이블은 선생님만 읽게 하는 것이 깔끔합니다.

---

## 4. 바뀌는 코드 (함수 단위)

| 파일 | 함수 | 무엇이 바뀌나 |
|---|---|---|
| js/db.js | `SUPA_HEADERS` | 상수 → `ppHeaders()` 함수. 세션 토큰이 있으면 그걸, 없으면 anon |
| js/db.js | `supaFetch` · `supaFetchAll` · `supaFetchBySid` · `supaUpsert` · `supaDelete` · `supaTrash` · `supaGetSetting` · `supaSetSetting` | 헤더를 `ppHeaders()` 로. 401 이면 1회 토큰 갱신 후 재시도 |
| js/db.js | `loadAllData` · `loadAllDataFast` | 역할에 따라 받는 테이블이 달라짐(학생은 공용 + 자기 것만). 지금도 `supaFetchBySid` 로 나뉘어 있어 큰 수정은 아님 |
| js/db.js | (신규) `ppLogin` · `ppLogout` · `ppRefresh` · `ppSession` | 토큰 저장·갱신·만료 처리 |
| js/teacher.js | `checkTeacherPw` · `changePw` | Auth 로그인·비밀번호 변경으로 |
| js/teacher.js | `checkPin` (학부모) | login 함수 호출로 |
| js/student.js | `checkStudentPin` · `confirmStudentByName` · `loginStudent` | login 함수 호출로. **PIN 으로 학생 목록을 훑는 지금 방식이 사라진다** |
| js/student.js · js/parent.js | `stuLogoutAsk` · `parentLogoutAsk` | 토큰 폐기까지 |
| js/teacher.js | `renderQRCode` · `previewAsStudent` · `previewAsParent` | QR 는 토큰 방식으로, 미리보기는 선생님 토큰으로 그대로 |
| js/db.js | `ppDropSnapshot` · `_snapOwner` | 역할·sid 를 토큰에서 얻도록 기준을 맞춤 |

**예상 작업량**: 함수 2개(login · 선생님 세션) + 위 수정 + 정책 20여 개 + 검증 →
**집중해서 3~5일**, 실제로는 **1~2주**(수업·학부모 사용이 멈추지 않게 병행 기간이 필요).

---

## 5. 끊김 없이 옮기는 순서

```
1단계 (앱은 그대로)
   · login 함수 배포, students_safe 뷰 생성, 정책 추가 (anon 권한은 아직 열어 둔 채)
   · 선생님 Auth 계정 생성
   → 이 시점까지 앱 동작은 변화 없음

2단계 (병행)
   · 앱이 '토큰이 있으면 토큰, 없으면 anon' 으로 요청하게 바꿔 배포
   · 선생님·학생·학부모 로그인을 Auth 경로로 바꾸되, 실패하면 옛 PIN 경로로 폴백
   → 1~2주 쓰면서 401·빈 목록이 없는지 본다 (학부모 기기가 가장 다양하다)

3단계 (전환)
   · 폴백 제거, QR 토큰 발급(옛 ?pin= 링크 무효 — 학부모에게 새 QR 안내)
   · anon 권한 닫기: 테이블마다 revoke
   → 이 시점에 students 가 공개에서 사라진다

4단계 (정리)
   · settings.pw 행 삭제, anon 키 회전(새 키 발급) · js/db.js 갱신·배포
```

**되돌리는 방법**: 3단계의 `revoke` 를 `grant` 로 되돌리면 즉시 옛 상태입니다.
2단계까지는 앱 코드만 이전 커밋으로 돌리면 됩니다(데이터 구조를 바꾸지 않으므로).
**데이터 마이그레이션이 없는 것**이 이 설계의 핵심입니다 —
`students.data.pin` 은 그대로 두고 **읽는 주체만** 서버로 옮깁니다.

---

## 6. 틀린 PIN 연속 입력 제한

지금(2026-11-06 추가): `ppPinGate` · `ppPinFailed` · `ppPinOk` —
**브라우저에서** 5회 틀리면 30초 대기. 브라우저 저장소를 지우면 풀리므로 늦추기만 합니다.

**서버로 옮길 것** (login 함수 안):
```
· sid 별 실패 10회/시간 → 그 학생 로그인 15분 잠금 (선생님 화면에 표시)
· IP 별 실패 20회/시간 → 그 IP 1시간 차단
· 기록: logs 에 { type:'login_fail', sid, at } — PIN 값은 남기지 않는다
· 성공하면 실패 카운터 초기화
· 메모리 카운터로 시작하고, 함수 인스턴스가 여러 개면 테이블로 옮긴다
```
PIN 은 네 자리(1만 가지)라 서버 제한이 없으면 대입이 현실적으로 가능합니다.
그래서 **PIN 제한은 Auth 전환과 한 작업으로 묶는 것**이 맞습니다.

---

## 7. 결정해 주실 것

1. **2-A(엣지 함수) / 2-B(학생별 계정)** — 추천은 2-A
2. **일정** — 2단계 병행 기간이 1~2주이므로 수업이 적은 주에 시작하는 게 좋습니다
3. **QR 전환** — 옛 `?pin=` 링크를 무효로 만들면 학부모에게 새 QR 을 보내야 합니다
