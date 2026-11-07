-- Page & Pencil — Supabase Auth 전환용 RLS 초안 (2026-11-07)
--
-- ⚠️ 실행하지 마세요. supabase/AUTH_PLAN.md 를 읽고 결정한 뒤
--    1단계(앱은 그대로 두고 정책만 추가)에서 하나씩 적용합니다.
--    지금 그대로 실행하면 anon 키로 도는 현재 앱이 즉시 멈춥니다.
--
-- 전제: login 엣지 함수가 Auth 사용자의 app_metadata 에 { role, sid } 를 박아 둔다.
--       선생님 계정은 { role: 'teacher' }, 학생·학부모는 { role: 'student'|'parent', sid: '<학생id>' }.

-- ── 공통 판별식 ──────────────────────────────────────────────────────────
create or replace function pp_is_teacher() returns boolean
language sql stable as
$fn$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher', false);
$fn$;

create or replace function pp_my_sid() returns text
language sql stable as
$fn$
  select auth.jwt() -> 'app_metadata' ->> 'sid';
$fn$;

-- ── students: 선생님만 원본, 학생·학부모는 안전 뷰 ────────────────────────
alter table students enable row level security;

drop policy if exists students_teacher on students;
create policy students_teacher on students for all to authenticated
  using (pp_is_teacher()) with check (pp_is_teacher());

drop policy if exists students_self on students;
create policy students_self on students for select to authenticated
  using (id = pp_my_sid());

-- PIN·연락처·수강료를 뺀 뷰 — 학생·학부모 화면이 필요한 것만 본다
create or replace view students_safe as
  select id,
         data - 'pin' - 'parentPhone' - 'phone' - 'fee' - 'payments' as data,
         updated_at
  from students;
-- 뷰가 호출자의 권한을 따르게 (Postgres 15+)
alter view students_safe set (security_invoker = on);

-- ── sid 로 나뉘는 테이블 ─────────────────────────────────────────────────
do $do$
declare t text;
begin
  -- 자기 것 읽기 + 쓰기 (숙제 체크·단어 학습·리딩로그)
  foreach t in array array['assignments','homeworks','vocab_cards','readings','logs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_teacher', t);
    execute format('create policy %I on %I for all to authenticated using (pp_is_teacher()) with check (pp_is_teacher())', t||'_teacher', t);
    execute format('drop policy if exists %I on %I', t||'_self', t);
    execute format('create policy %I on %I for all to authenticated using (sid = pp_my_sid()) with check (sid = pp_my_sid())', t||'_self', t);
  end loop;

  -- 자기 것 읽기만 (수업·테스트·메시지·월간 리포트·상담)
  foreach t in array array['lessons','tests','messages','monthly_reports','counsels'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_teacher', t);
    execute format('create policy %I on %I for all to authenticated using (pp_is_teacher()) with check (pp_is_teacher())', t||'_teacher', t);
    execute format('drop policy if exists %I on %I', t||'_self', t);
    execute format('create policy %I on %I for select to authenticated using (sid = pp_my_sid())', t||'_self', t);
  end loop;

  -- 공용 자료 — 학생·학부모는 읽기만
  foreach t in array array['global_textbooks','library','textbooks','notices','worksheets','classes','exam_schedules'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_teacher', t);
    execute format('create policy %I on %I for all to authenticated using (pp_is_teacher()) with check (pp_is_teacher())', t||'_teacher', t);
    execute format('drop policy if exists %I on %I', t||'_read', t);
    execute format('create policy %I on %I for select to authenticated using (true)', t||'_read', t);
  end loop;
end
$do$;

-- tts_cache: 누구든 읽고, 새 음원은 넣을 수 있어야 한다 (지우기는 선생님만)
alter table tts_cache enable row level security;
drop policy if exists tts_read on tts_cache;
create policy tts_read on tts_cache for select to authenticated using (true);
drop policy if exists tts_insert on tts_cache;
create policy tts_insert on tts_cache for insert to authenticated with check (true);
drop policy if exists tts_teacher on tts_cache;
create policy tts_teacher on tts_cache for all to authenticated
  using (pp_is_teacher()) with check (pp_is_teacher());

-- ── 3단계: anon 권한 닫기 ────────────────────────────────────────────────
-- 여기부터는 '앱이 토큰으로 돈다'는 것을 확인한 뒤에만.
--
-- revoke select, insert, update, delete on
--   students, lessons, tests, readings, logs, notices, homeworks, assignments,
--   textbooks, messages, vocab_cards, global_textbooks, classes, monthly_reports,
--   exam_schedules, counsels, worksheets, library, tts_cache
-- from anon;
-- grant select on students_safe to authenticated;
--
-- 되돌리기 (문제가 생기면 즉시):
-- grant select, insert, update, delete on <위 표 목록> to anon;
