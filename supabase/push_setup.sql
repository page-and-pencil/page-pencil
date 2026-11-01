-- Page & Pencil: 매일 숙제 푸시 알림 설정 (2026-11-01)
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- 배경: 기존 알림은 브라우저 로컬 타이머라 앱이 열려 있어야만 떴습니다.
--       서버가 매일 보내도록 구독 정보를 보관하고, Edge Function을 스케줄에 걸어 둡니다.

-- ── 1. 구독 테이블 ──
-- 다른 테이블과 같은 모양(id · sid · data · updated_at)으로 둬서 기존 헬퍼(supaUpsert/supaDelete)를 그대로 씁니다.
create table if not exists push_subs (
  id         text primary key,
  sid        text,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists push_subs_sid_idx on push_subs (sid);

-- ── 2. RLS ──
-- 기기 등록/해지는 익명 키로 해야 하므로 insert·update·delete는 열어 둡니다.
-- 단 **select는 막습니다** — 열어 두면 남의 endpoint(알림을 보낼 수 있는 주소)가 노출됩니다.
-- 서버(Edge Function)는 service_role 키를 쓰므로 RLS를 우회해 읽습니다.
alter table push_subs enable row level security;

drop policy if exists push_subs_anon_write on push_subs;
create policy push_subs_anon_write on push_subs for insert to anon with check (true);

drop policy if exists push_subs_anon_update on push_subs;
create policy push_subs_anon_update on push_subs for update to anon using (true) with check (true);

drop policy if exists push_subs_anon_delete on push_subs;
create policy push_subs_anon_delete on push_subs for delete to anon using (true);
-- select 정책은 만들지 않습니다 (= 익명 읽기 불가)

-- 선생님 화면에서 '알림이 켜졌는지'를 확인할 수 있게, endpoint를 뺀 뷰만 공개합니다.
-- (뷰는 소유자 권한으로 실행되므로 RLS를 우회해 읽히지만, 공개 컬럼에 민감 정보가 없습니다)
drop view if exists push_subs_pub;
create view push_subs_pub as
  select sid,
         data->>'role' as role,
         data->>'name' as name,
         updated_at
    from push_subs
   where coalesce((data->>'active')::boolean, true);
grant select on push_subs_pub to anon;

-- ── 3. 매일 보내기 스케줄 ──
-- 먼저 Edge Function을 배포하고 시크릿을 넣어 주세요:
--   supabase secrets set VAPID_PRIVATE_JWK='{"kty":"EC","crv":"P-256","d":"...","x":"...","y":"..."}'
--   supabase secrets set VAPID_PUBLIC='BPr4qossLdd3M25srgcxQmgYItyEkFTariNV4bfc-QmeV58HxFHTOP1FsOhVe_w-Ag7vnFcDWzp3cW_KRGb0z2E'
--   supabase secrets set VAPID_SUBJECT='mailto:translator.sam.ahn@gmail.com'
--   (또는 대시보드: Edge Functions → Deploy a new function → Via Editor)
-- ※ JWT 검증은 **켠 채로 두세요**. 아래 cron이 프로젝트 공개 키를 Authorization에 실어 보내므로
--    검증을 켜도 통과하고, 끄면 열쇠 없이도 호출됩니다.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ★ 채울 곳이 없습니다 — 주소와 호출 키를 미리 넣어 뒀습니다.
--   호출 키는 **공개 키(anon)** 입니다. 이미 앱 코드(js/db.js)에 있는 값이라 따로 찾을 필요가 없고,
--   함수가 '기기당 하루 1회'를 보장하므로 함수가 더 호출돼도 알림이 쌓이지 않습니다.
--   (함수가 데이터를 읽을 때 쓰는 service_role 키는 Supabase가 자동으로 넣어줍니다 — 등록 불필요)
-- 시각: cron은 UTC 기준입니다. 한국 저녁 7시 = UTC 10:00 (= '0 10 * * *')
select cron.unschedule('pp-hw-push') where exists (select 1 from cron.job where jobname='pp-hw-push');
select cron.schedule('pp-hw-push','0 10 * * *', $$
  select net.http_post(
    url     := 'https://pznpcewwdsbxwibpnapn.supabase.co/functions/v1/push-hw',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bnBjZXd3ZHNieHdpYnBuYXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NjQ4NzUsImV4cCI6MjA5NTQ0MDg3NX0.fzXJKPfcxR-vrgsFbgt6-5sMEjtUH2p_rPsv6XjHe-c"}'::jsonb,
    body    := '{}'::jsonb
  );
$$);

-- 확인
-- select jobname, schedule, active from cron.job where jobname='pp-hw-push';
-- select * from cron.job_run_details where jobid=(select jobid from cron.job where jobname='pp-hw-push') order by start_time desc limit 5;

-- 되돌리기
-- select cron.unschedule('pp-hw-push');
