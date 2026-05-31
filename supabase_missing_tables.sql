-- Page & Pencil — 누락 테이블 생성 스크립트
-- 실행 위치: Supabase 대시보드 > SQL Editor > New query > 붙여넣기 > Run
-- 원인: 아래 7개 테이블이 DB에 없어서(REST 404) loadAllData 전체가 실패했음.
-- 기존 테이블(students 등)과 동일한 스키마: id(text PK) + sid(text) + data(jsonb) + updated_at(timestamptz).
-- sid는 학생별 테이블(readings/logs/vocab_cards 등)에서만 쓰이지만, 통일성을 위해 모두 포함(미사용 시 NULL).

create table if not exists public.library          (id text primary key, sid text, data jsonb, updated_at timestamptz default now());
create table if not exists public.homeworks        (id text primary key, sid text, data jsonb, updated_at timestamptz default now());
create table if not exists public.assignments      (id text primary key, sid text, data jsonb, updated_at timestamptz default now());
create table if not exists public.textbooks        (id text primary key, sid text, data jsonb, updated_at timestamptz default now());
create table if not exists public.messages         (id text primary key, sid text, data jsonb, updated_at timestamptz default now());
create table if not exists public.global_textbooks (id text primary key, sid text, data jsonb, updated_at timestamptz default now());
create table if not exists public.vocab_cards      (id text primary key, sid text, data jsonb, updated_at timestamptz default now());
create table if not exists public.classes          (id text primary key, sid text, data jsonb, updated_at timestamptz default now());

-- 익명(anon) 키로 읽기/쓰기 가능하도록 (기존 동작과 동일하게 전체 허용)
do $$
declare t text;
begin
  foreach t in array array['library','homeworks','assignments','textbooks','messages','global_textbooks','vocab_cards','classes']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "anon all" on public.%I;', t);
    execute format('create policy "anon all" on public.%I for all to anon using (true) with check (true);', t);
    execute format('grant all on public.%I to anon;', t);
  end loop;
end $$;

-- 적용 후 PostgREST 스키마 캐시 새로고침
notify pgrst, 'reload schema';
