-- Page & Pencil — Auth 전환 1단계 (2026-11-08)
-- 실행: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run (Aside)
--
-- 이 단계는 **anon 권한을 건드리지 않습니다.** 정책을 '추가'만 하므로
-- 지금처럼 anon 키로 도는 앱은 그대로 돕니다. 토큰으로 들어오는 요청에만 새 규칙이 붙습니다.
-- 여러 번 실행해도 안전합니다 (if not exists / drop policy if exists).
--
-- 되돌리기: 이 파일이 만든 정책만 지우면 됩니다 — 맨 아래 주석 참고.

-- ── 0. 판별식 ────────────────────────────────────────────────────────────
-- login 엣지 함수가 Auth 사용자의 app_metadata 에 { sid, role } 을 넣는다.
-- 선생님 계정은 { role: 'teacher' } (auth_teacher_setup.md).
create or replace function public.pp_is_teacher() returns boolean
language sql stable security invoker as
$fn$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'teacher', false);
$fn$;

create or replace function public.pp_my_sid() returns text
language sql stable security invoker as
$fn$
  select auth.jwt() -> 'app_metadata' ->> 'sid';
$fn$;

grant execute on function public.pp_is_teacher() to anon, authenticated;
grant execute on function public.pp_my_sid() to anon, authenticated;

-- ── 1. 안전 뷰 두 개 ─────────────────────────────────────────────────────
-- '빼기'로 만든다 — 새 필드가 생겨도 자동으로 따라가고, 없는 키를 빼는 것은 오류가 아니다.
--
--   students_safe   학생 화면용 — PIN·QR토큰·연락처·메모·수강료·결제 전부 제외
--   students_parent 학부모 화면용 — 위에 더해 수강료·결제는 **남긴다**
--                   (학부모 결제 탭이 fee·payday·payments 를 쓴다. 자기 아이 것만 보인다)
create or replace view public.students_safe as
  select
    id,
    (data
      - 'pin' - 'qrToken'
      - 'parentPhone' - 'parentPhone2' - 'phone' - 'parentName'
      - 'memo' - 'counselMemo'
      - 'fee' - 'payday' - 'payments'
    ) as data,
    updated_at
  from public.students;

create or replace view public.students_parent as
  select
    id,
    (data
      - 'pin' - 'qrToken'
      - 'parentPhone' - 'parentPhone2' - 'phone' - 'parentName'
      - 'memo' - 'counselMemo'
    ) as data,
    updated_at
  from public.students;

-- 뷰가 호출자의 권한을 따르게 (Postgres 15+). 이 줄에서 오류가 나면 지우고 실행하세요
-- (대신 뷰가 소유자 권한으로 돌아 students_self 정책이 적용되지 않으니, 그때는 알려 주세요).
alter view public.students_safe   set (security_invoker = on);
alter view public.students_parent set (security_invoker = on);

grant select on public.students_safe   to anon, authenticated;
grant select on public.students_parent to anon, authenticated;

-- ── 2. 테이블별 authenticated 정책 ───────────────────────────────────────
-- RLS 를 켜되 **anon 정책은 손대지 않는다**. anon 권한이 열려 있는 동안은
-- 지금 앱이 그대로 돌고, 토큰으로 오는 요청은 아래 규칙을 따른다.
--
-- ⚠️ RLS 를 켜면 '정책이 없는 역할'은 막힌다. 그래서 anon 에게도 '전부 허용' 정책을
--    같이 달아 둔다 (3단계에서 이 정책만 지우면 anon 이 닫힌다).

do $do$
declare
  t text;
  -- 자기 것 읽기 + 쓰기 (숙제 체크·단어 학습·리딩로그·음원 캐시)
  rw text[] := array['assignments','homeworks','vocab_cards','readings','logs'];
  -- 자기 것 읽기만 (수업·테스트·메시지·월간 리포트·상담)
  ro text[] := array['lessons','tests','messages','monthly_reports','counsels'];
  -- 공용 자료 — 학생·학부모는 읽기만
  pub text[] := array['global_textbooks','library','textbooks','notices','worksheets','classes','exam_schedules'];
begin
  foreach t in array (rw || ro || pub) loop
    -- 테이블이 없으면 건너뛴다 (프로젝트마다 일부 테이블이 없을 수 있다)
    if not exists (select 1 from information_schema.tables
                   where table_schema='public' and table_name=t) then
      raise notice '건너뜀: % (테이블 없음)', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    -- anon: 지금과 같게 전부 허용 (3단계에서 이 정책을 지운다)
    execute format('drop policy if exists %I on public.%I', t || '_anon_all', t);
    execute format('create policy %I on public.%I for all to anon using (true) with check (true)',
                   t || '_anon_all', t);

    -- 선생님: 전부
    execute format('drop policy if exists %I on public.%I', t || '_teacher', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.pp_is_teacher()) with check (public.pp_is_teacher())',
                   t || '_teacher', t);

    execute format('drop policy if exists %I on public.%I', t || '_self', t);
    if t = any (rw) then
      execute format('create policy %I on public.%I for all to authenticated using (sid = public.pp_my_sid()) with check (sid = public.pp_my_sid())',
                     t || '_self', t);
    elsif t = any (ro) then
      execute format('create policy %I on public.%I for select to authenticated using (sid = public.pp_my_sid())',
                     t || '_self', t);
    else
      execute format('create policy %I on public.%I for select to authenticated using (true)',
                     t || '_self', t);
    end if;
  end loop;
end
$do$;

-- students 는 따로 — 선생님만 원본, 학생·학부모는 자기 행만(뷰로 가린 항목 제외)
alter table public.students enable row level security;

drop policy if exists students_anon_all on public.students;
create policy students_anon_all on public.students for all to anon using (true) with check (true);

drop policy if exists students_teacher on public.students;
create policy students_teacher on public.students for all to authenticated
  using (public.pp_is_teacher()) with check (public.pp_is_teacher());

drop policy if exists students_self on public.students;
create policy students_self on public.students for select to authenticated
  using (id = public.pp_my_sid());

-- tts_cache: 누구든 읽고 새 음원을 넣을 수 있어야 한다 (있을 때만)
do $do$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tts_cache') then
    execute 'alter table public.tts_cache enable row level security';
    execute 'drop policy if exists tts_anon_all on public.tts_cache';
    execute 'create policy tts_anon_all on public.tts_cache for all to anon using (true) with check (true)';
    execute 'drop policy if exists tts_auth_read on public.tts_cache';
    execute 'create policy tts_auth_read on public.tts_cache for select to authenticated using (true)';
    execute 'drop policy if exists tts_auth_insert on public.tts_cache';
    execute 'create policy tts_auth_insert on public.tts_cache for insert to authenticated with check (true)';
    execute 'drop policy if exists tts_teacher on public.tts_cache';
    execute 'create policy tts_teacher on public.tts_cache for all to authenticated using (public.pp_is_teacher()) with check (public.pp_is_teacher())';
  end if;
end
$do$;

-- settings 는 이미 settings_rls.sql 로 잠겨 있다 — 선생님 토큰도 읽을 수 있게 한 줄만 더
do $do$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='settings') then
    execute 'drop policy if exists settings_teacher on public.settings';
    execute 'create policy settings_teacher on public.settings for all to authenticated using (public.pp_is_teacher()) with check (public.pp_is_teacher())';
  end if;
end
$do$;

-- ── 3. 확인 ──────────────────────────────────────────────────────────────
-- 정책이 붙었는지:
--   select tablename, policyname, roles from pg_policies
--   where schemaname='public' order by tablename, policyname;
-- 뷰가 보이는지 (pin·parentPhone 키가 없어야 합니다):
--   select data from students_safe limit 1;
--   select data from students_parent limit 1;   -- fee·payday·payments 는 있어야 합니다
--
-- 이 시점에서 앱은 **아무것도 달라지지 않습니다**(anon 정책이 전부 허용이므로).

-- ── 되돌리기 ─────────────────────────────────────────────────────────────
-- 이 파일이 만든 것만 지웁니다. RLS 를 다시 끄려면 테이블별로:
--   alter table public.<표> disable row level security;
-- 정책만 지우려면:
--   drop policy if exists <표>_teacher on public.<표>;
--   drop policy if exists <표>_self    on public.<표>;
--   drop policy if exists <표>_anon_all on public.<표>;   -- ⚠️ RLS 가 켜져 있으면 anon 이 막힘
-- 뷰:  drop view if exists public.students_safe;
