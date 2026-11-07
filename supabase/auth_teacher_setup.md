# 선생님 Auth 계정 만들기 (2026-11-08)

학생·학부모는 `login` 엣지 함수가 계정을 자동으로 만듭니다.
**선생님 계정 하나만 손으로 만듭니다.**

**비밀번호 값은 이 문서에 적지 않습니다.** 원장님이 직접 정해 입력하세요.

---

## 1. 계정 만들기 (Aside)

```
Supabase 대시보드 → Authentication → Users → [Add user] → Create new user
  Email          jikgyeol@gmail.com
  Password       (원장님이 정한 값 — 여기에 적지 않습니다)
  Auto Confirm User   ✅ 켜기   ← 끄면 확인 메일을 눌러야 로그인됩니다
```

비밀번호는 **원장님이 그 자리에서 입력**하시거나, 임시로 만든 뒤
앱의 설정 → 비밀번호 변경에서 바로 바꾸세요(2단계 배포 후).

---

## 2. 선생님 표식 넣기 (SQL Editor)

RLS 가 `app_metadata.role` 을 보고 선생님인지 판단합니다.

```sql
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"teacher"}'::jsonb
 where email = 'jikgyeol@gmail.com';
```

확인:

```sql
select email, raw_app_meta_data ->> 'role' as role
  from auth.users
 where email = 'jikgyeol@gmail.com';
-- role 이 teacher 로 나와야 합니다
```

> 이미 로그인한 상태라면 **한 번 로그아웃했다 다시 로그인**해야 새 표식이 토큰에 들어갑니다.

---

## 3. 앱에서 확인 (2단계 배포 후)

1. 선생님 화면 로그인 — 이메일/비밀번호가 맞으면 서버 로그인, 아니면 지금 방식으로 자동 폴백
2. 설정 탭 맨 위 **"로그인 방식"** 줄이 `서버(Supabase Auth)` 인지 확인
3. 학생 목록·수업 기록·교재가 평소대로 보이는지 (정책이 잘못 붙으면 목록이 비어 보입니다)

비어 보이면 **되돌리기**: `supabase/auth_step1.sql` 맨 아래 '되돌리기' 주석대로
정책을 지우거나 RLS 를 끄면 즉시 옛 상태가 됩니다. 앱은 폴백으로 계속 돕니다.

---

## 4. 비밀번호를 바꿀 때

- **2단계(병행) 기간**: 앱의 설정 → 비밀번호 변경이 **둘 다** 바꿉니다
  (Auth 계정 비밀번호 + 기존 `settings.pw` 해시).
- **전환 완료 후**: Auth 쪽만 바꿉니다. `settings.pw` 행은 4단계에서 지웁니다.

---

## 5. 학생·학부모 계정에 대해 (참고)

- `login` 함수가 처음 로그인하는 순간 `<학생id>@stu.jikgyeol.local`(학생),
  `<학생id>@par.jikgyeol.local`(학부모) 계정을 만듭니다. **손으로 만들 필요가 없습니다.**
- 비밀번호는 시크릿 `LOGIN_SECRET` 과 학생 id 로 서버가 그때그때 계산합니다.
  어디에도 저장하지 않고, 응답·로그에도 나오지 않습니다.
- **`LOGIN_SECRET` 을 바꾸면** 이미 만든 계정의 비밀번호와 어긋나 로그인이 막힙니다.
  바꿔야 한다면 그 전에 계정을 지우세요(다음 로그인 때 새로 만들어집니다):

```sql
-- ⚠️ 꼭 필요할 때만. 지워도 학생 데이터(students·lessons…)는 그대로입니다.
delete from auth.users
 where email like '%@stu.jikgyeol.local'
    or email like '%@par.jikgyeol.local';
```

- Supabase 가 `.local` 도메인을 거부하면 시크릿 `LOGIN_STU_DOMAIN` ·
  `LOGIN_PAR_DOMAIN` 에 다른 도메인을 넣고, 위 SQL 로 옛 계정을 지운 뒤 다시 로그인합니다.
