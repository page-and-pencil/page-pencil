-- Page & Pencil — ElevenLabs TTS 캐시 테이블
-- 실행 위치: Supabase 대시보드 > SQL Editor > New query > 붙여넣기 > Run
-- 같은 문장+보이스 조합은 한 번만 생성하고 Cloudinary URL을 여기 저장해 재사용 (크레딧 절약).
-- 기존 테이블과 동일한 스키마: id(text PK) + sid(text) + data(jsonb) + updated_at.

create table if not exists public.tts_cache (id text primary key, sid text, data jsonb, updated_at timestamptz default now());

alter table public.tts_cache enable row level security;
drop policy if exists "anon all" on public.tts_cache;
create policy "anon all" on public.tts_cache for all to anon using (true) with check (true);
grant all on public.tts_cache to anon;

notify pgrst, 'reload schema';
