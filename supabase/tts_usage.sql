-- ─────────────────────────────────────────────────────────────────────
-- tts_usage — ElevenLabs 월 누적 글자 수 (서버에서만 쓴다)
--
-- 왜 서버인가: 학생 토큰(anon)은 settings 에 쓸 수 없다(settings_rls 화이트리스트).
-- 그래서 누적 집계는 tts-proxy(Edge Function)가 서비스 롤로 기록한다.
--
-- 쓰기: service_role 만 (tts-proxy). 정책을 만들지 않으므로 anon·authenticated 는 쓸 수 없다.
-- 읽기: authenticated (선생님). 학생 화면은 이 값을 쓰지 않는다 —
--        한도를 넘으면 서버가 429 를 주고 앱이 조용히 브라우저 음성으로 넘어간다.
--        선생님 화면에 보이는 값은 tts-proxy 의 probe 응답으로도 내려온다.
--
-- 실행: Supabase SQL Editor 에서 이 파일 전체를 한 번 실행 (Aside)
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.tts_usage (
  month      text primary key,              -- 'YYYY-MM' (KST 기준)
  chars      bigint  not null default 0,    -- ElevenLabs 에 보낸 글자 수 누적
  calls      integer not null default 0,    -- 생성 호출 수 누적
  updated_at timestamptz not null default now()
);

comment on table  public.tts_usage is 'ElevenLabs 월 누적 사용량. tts-proxy 가 서비스 롤로만 기록한다.';
comment on column public.tts_usage.month is 'KST 기준 YYYY-MM';
comment on column public.tts_usage.chars is '이번 달 ElevenLabs 로 보낸 글자 수 (단어 음성 포함)';

alter table public.tts_usage enable row level security;

-- 선생님(로그인한 사용자)만 읽는다
drop policy if exists tts_usage_read on public.tts_usage;
create policy tts_usage_read on public.tts_usage
  for select to authenticated using (true);

-- ── 누적 더하기 (원자적) ──────────────────────────────────────────────
-- 읽고-쓰는 사이에 다른 요청이 끼어들어 집계가 틀어지지 않게 한 번의 upsert 로 더한다.
-- 돌려주는 값은 '더한 뒤의' 누적이다.
create or replace function public.tts_usage_add(p_month text, p_chars integer)
returns table (month text, chars bigint, calls integer)
language sql
security definer
set search_path = public
as $$
  insert into public.tts_usage as u (month, chars, calls, updated_at)
  values (p_month, greatest(p_chars, 0), 1, now())
  on conflict (month) do update
    set chars = u.chars + greatest(p_chars, 0),
        calls = u.calls + 1,
        updated_at = now()
  returning u.month, u.chars, u.calls;
$$;

revoke all on function public.tts_usage_add(text, integer) from public, anon, authenticated;
grant execute on function public.tts_usage_add(text, integer) to service_role;

-- 확인:
--   select * from public.tts_usage order by month desc;
--   select * from public.tts_usage_add('2026-11', 0);   -- service_role 로만 됩니다
--
-- 되돌리기:
--   drop function if exists public.tts_usage_add(text, integer);
--   drop table    if exists public.tts_usage;
