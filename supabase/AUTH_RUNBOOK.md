# 로그인 서버 이전 — 실행 순서 (Aside 용)

작성 2026-11-08. 설계는 `supabase/AUTH_PLAN.md`, 이 문서는 **그대로 따라 하는 순서**입니다.
**키·비밀번호·토큰 값은 이 문서에 없습니다.**

각 단계 끝에 **확인 방법**과 **되돌리기**가 붙어 있습니다. 확인이 안 되면 다음 단계로 가지 마세요.

---

## 0. 지금 상태 (2026-11-08)

- 앱은 **그대로 돕니다**. 아래 1~2단계를 해도 겉보기 동작은 달라지지 않습니다.
- 앱에는 이미 '서버 로그인을 먼저 시도하고, 안 되면 지금 방식으로' 들어가는 코드가 들어 있습니다.
  함수가 없으면 404 를 한 번 받고 바로 옛 방식으로 갑니다.
- 되돌리는 스위치: `js/db.js` 의 `PP_AUTH_FALLBACK` (지금 `true`).

---

## 1. 함수 배포 · 시크릿 (Aside, 10분)

### 1-1. `login` 함수 배포
대시보드 → Edge Functions → Create function → 이름 `login` →
`supabase/functions/login/index.ts` 내용을 붙여넣고 Deploy.
(외부 import 는 `deno.land/std` 하나뿐이라 대시보드 편집기에서 그대로 배포됩니다.)

### 1-2. 시크릿 등록
Edge Functions → Secrets:

```
LOGIN_SECRET            무작위 32자 이상 (Aside 가 생성, 어디에도 적지 않음)
LOGIN_ALLOWED_ORIGINS   https://page-and-pencil.github.io,http://127.0.0.1:5500,http://localhost:5500
```

`SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` 는 기본 제공이라 등록하지 않습니다.

> ⚠️ `LOGIN_SECRET` 은 **한 번 정하면 바꾸지 않습니다.** 바꾸면 이미 만들어진 학생 계정의
> 비밀번호와 어긋나 로그인이 막힙니다 (복구법은 `auth_teacher_setup.md` 5번).

### 확인
```
curl -s -X POST https://<프로젝트>.supabase.co/functions/v1/login \
  -H "apikey: <공개 anon 키>" -H "content-type: application/json" \
  -H "origin: https://page-and-pencil.github.io" \
  -d '{"probe":true}'
→ {"ok":true,"ready":true}   ready 가 false 면 LOGIN_SECRET 이 빠진 것입니다
```

### 되돌리기
함수를 삭제하면 앱은 404 를 받고 옛 방식으로 돕니다(아무 영향 없음).

---

## 2. step1 SQL (Aside, 2분)

SQL Editor 에 `supabase/auth_step1.sql` 을 통째로 붙여넣고 Run.
이 파일은 **정책을 추가만** 합니다. anon 권한은 그대로이므로 앱 동작은 달라지지 않습니다.
여러 번 실행해도 안전합니다.

### 확인
```sql
select tablename, policyname from pg_policies
 where schemaname='public' order by tablename, policyname;   -- <표>_anon_all / _teacher / _self 가 보임
select count(*) from students_safe;                          -- 학생 수와 같아야 함
select data from students_safe limit 1;                       -- pin·parentPhone·fee 키가 없어야 함
```
그리고 **앱을 한 번 열어** 선생님·학생·학부모 화면이 평소와 같은지 봅니다.

### 되돌리기
`auth_step1.sql` 맨 아래 '되돌리기' 주석 (정책 삭제 또는 `disable row level security`).

---

## 3. 선생님 계정 (원장님 + Aside, 5분)

`supabase/auth_teacher_setup.md` 대로:
1. Authentication → Users → Add user (`jikgyeol@gmail.com`, **Auto Confirm 켜기**)
   비밀번호는 원장님이 입력
2. SQL Editor 에서 `raw_app_meta_data` 에 `{"role":"teacher"}` 넣기

### 확인
```sql
select email, raw_app_meta_data ->> 'role' from auth.users where email='jikgyeol@gmail.com';
```
앱에서 선생님 로그인 → 설정 탭 맨 위 **로그인 방식**이 `서버(Supabase Auth)` 인지.

---

## 4. 앱 확인 항목 (원장님, 10분)

한 번씩만 눌러 보면 됩니다. **하나라도 안 되면 2번 되돌리기를 하고 알려 주세요.**

| # | 확인할 것 | 정상이면 |
|---|---|---|
| 1 | 선생님 로그인 | 설정 탭 '로그인 방식'이 `서버(Supabase Auth)` |
| 2 | 학생 목록·수업 기록·교재 DB | 평소대로 전부 보임 |
| 3 | 수업 기록 저장 | 저장되고 목록이 바뀜 |
| 4 | 학생 로그인 (PIN 4자리) | 들어가지고 숙제·단어가 보임 |
| 5 | 학생 숙제 체크 | 체크되고 도장이 찍힘 |
| 6 | 학부모 로그인 (이름+PIN) | 수업 기록·점수 탭이 보임 |
| 7 | 설정 → QR 만들기 | `?t=…` 링크가 나오고, 그 링크로 바로 들어가짐 |
| 8 | 옛 `?pin=` 링크 | 아직 열림 (병행 기간이므로 정상) |
| 9 | 나가기(로그아웃) → 다시 들어오기 | 정상 |

---

## 5. 1~2주 병행 체크리스트 (주 1회)

| 볼 것 | 어디서 | 정상 |
|---|---|---|
| 로그인 실패 기록 | `select count(*) from logs where data->>'type'='login_fail';` | 갑자기 늘지 않음 |
| 함수 오류 | 대시보드 → Edge Functions → login → Logs | 500 이 없음 |
| Auth 사용자 수 | Authentication → Users | 학생 수 × 2(학생·학부모) 안쪽 |
| 선생님 로그인 방식 | 설정 탭 한 줄 | 계속 `서버` |
| 학부모 문의 | 카카오톡 | "로그인이 안 돼요" 가 없음 |

병행 기간에 **옛 QR 링크(?pin=)를 받은 학부모에게 새 링크를 다시 보냅니다.**
(설정 → QR 만들기 → 링크 복사)

---

## 6. 3단계 — 공개 권한 닫기 (Aside)

### 6-1. 먼저 앱부터
`js/db.js` 의 **`PP_AUTH_FALLBACK` 을 `false`** 로 바꾸고, `index.html` 의 `?v=` 를 올려 배포합니다.
이 상태로 **1~2일** 두고 5번 체크리스트를 한 번 더 봅니다.
(이때부터 옛 `?pin=` 링크는 열리지 않습니다.)

**그 한 줄이 끄는 것** — 코드를 지우지 않고 스위치 하나로 전부 꺼집니다.

| 위치 | 꺼지는 것 |
|---|---|
| `js/db.js` 21행 | 스위치 본체 (`const PP_AUTH_FALLBACK=true;` → `false`) |
| `js/teacher.js` 34행 `checkPw` | 선생님: `settings.pw` 해시 대조 폴백 |
| `js/teacher.js` 94행 `checkPin` | 학부모: 브라우저에서 이름+PIN 대조 |
| `js/student.js` 217행 `checkStudentPin` | 학생: 브라우저에서 PIN 대조 |
| `js/teacher.js` 17103행 | QR 토큰(`?t=`)을 캐시에서 찾던 폴백 |
| `js/teacher.js` 17110행 | **옛 `?pin=` 자동 로그인 가지 전체** |

(행 번호는 2026-11-08 기준입니다. 바뀌었으면 `PP_AUTH_FALLBACK` 로 찾으세요 — 6곳입니다.)

### 6-2. SQL
`supabase/auth_step3_close_anon.sql` 실행.

### 확인
- 브라우저 주소창:
  `https://<프로젝트>.supabase.co/rest/v1/students?select=id&limit=1&apikey=<공개 anon 키>`
  → **빈 배열** 이 나와야 성공
- 앱에서 4번 표의 1~6, 9 를 다시 한 번

### 되돌리기
`supabase/auth_step3_rollback.sql` 실행 + `PP_AUTH_FALLBACK` 을 `true` 로 되돌려 배포.

---

## 7. 4단계 — 뒷정리

3단계가 1주일 이상 조용한 뒤에 합니다.

```
① settings 의 pw 행 삭제
     delete from settings where key = 'pw';
   (그 전에: 선생님 로그인이 서버 쪽으로만 되는지 확인 — 설정 탭 '로그인 방식')

② 공개 anon 키 회전
   1. 대시보드 → Settings → API → anon 키 재발급
   2. js/db.js 의 SUPA_KEY 를 새 값으로 바꾸고 ?v= 올려 배포
   3. worksheet-studio/src/pp-backend.js 의 키도 같이 바꾸고 studio 재빌드
        cd worksheet-studio && npx vite build --mode pp --base=./ --outDir ../studio --emptyOutDir
   4. 앱을 열어 4번 표를 한 번 더
   ※ 2~3 사이에 옛 키로 접속한 사람은 잠깐 막힙니다 — 수업이 없는 시간에 하세요.

③ 앱에서 지워도 되는 것 (선택, 별도 작업)
   · js/teacher.js 의 ?pin= 자동 로그인 가지
   · js/teacher.js checkPw 의 settings.pw 비교
   · js/student.js checkStudentPin / confirmStudentByName 의 폴백
   · js/teacher.js checkPin 의 폴백
   (PP_AUTH_FALLBACK=false 로 이미 꺼져 있으므로 급하지 않습니다)
```

---

## 8. 한눈에

```
1. login 함수 배포 + LOGIN_SECRET          → probe 가 ready:true
2. auth_step1.sql                          → 앱 그대로 돎
3. 선생님 계정 + role:teacher              → 설정 탭 '서버'
4. 앱 확인 9항목
5. 1~2주 병행 (주 1회 체크, 새 QR 배포)
6. PP_AUTH_FALLBACK=false 배포 → 1~2일 → auth_step3_close_anon.sql
7. settings.pw 삭제 → anon 키 회전
```
