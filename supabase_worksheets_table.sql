-- Page & Pencil — 워크시트 스튜디오 저장 테이블
-- 실행 위치: Supabase 대시보드 > SQL Editor > New query > 붙여넣기 > Run
-- 기존 테이블(students 등)과 동일한 스키마: id(text PK) + sid(text) + data(jsonb) + updated_at(timestamptz).
-- sid는 나중에 워크시트를 특정 학생에게 할당할 때 쓸 수 있도록 포함(당장은 NULL).

create table if not exists public.worksheets (id text primary key, sid text, data jsonb, updated_at timestamptz default now());

alter table public.worksheets enable row level security;
drop policy if exists "anon all" on public.worksheets;
create policy "anon all" on public.worksheets for all to anon using (true) with check (true);
grant all on public.worksheets to anon;

-- 적용 후 PostgREST 스키마 캐시 새로고침
notify pgrst, 'reload schema';
