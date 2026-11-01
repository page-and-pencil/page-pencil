-- Page & Pencil: 매일 숙제 푸시 알림 설정 (2026-11-01, rev2)
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run  (여러 번 실행해도 안전합니다)
-- 배경: 기존 알림은 브라우저 로컬 타이머라 앱이 열려 있어야만 떴습니다.
--       서버가 매일 보내도록 구독 정보를 보관하고, Edge Function을 스케줄에 걸어 둡니다.

-- ── 1. 구독 테이블 ──
-- 다른 테이블과 같은 모양(id · sid · data · updated_at). data에 endpoint(알림을 보낼 수 있는 주소)가 들어갑니다.
create table if not exists push_subs (
  id         text primary key,
  sid        text,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists push_subs_sid_idx on push_subs (sid);

-- ── 2. 접근 차단 ──
-- endpoint가 노출되면 누구나 그 기기로 알림을 보낼 수 있으므로, 익명 키로는 이 테이블을 직접
-- 읽고 쓰지 못하게 합니다. 등록·해지는 아래 3번의 함수로만 합니다.
alter table push_subs enable row level security;
revoke all on table push_subs from anon, authenticated;

-- rev1에서 만들었던 직접 쓰기 정책은 제거합니다.
-- (PostgreSQL은 WHERE 절이 있는 update·delete에도 select 정책을 요구하므로
--  select를 막은 상태에서는 특정 행을 고치거나 지울 수 없었습니다 — 조용히 0행이 됩니다)
drop policy if exists push_subs_anon_write on push_subs;
drop policy if exists push_subs_anon_update on push_subs;
drop policy if exists push_subs_anon_delete on push_subs;

-- ── 3. 등록·해지 함수 (앱이 쓰는 유일한 창구) ──
-- security definer = 소유자 권한으로 실행 → RLS를 거치지 않으므로 endpoint를 공개하지 않고도
-- 등록·갱신·해지가 됩니다. 앱은 이 두 함수만 호출합니다 (js/utils.js의 _ppSaveSub·ppPushDisable).
create or replace function pp_push_subscribe(p_id text, p_sid text, p_data jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into push_subs (id, sid, data, updated_at)
  values (p_id, p_sid, p_data, now())
  on conflict (id) do update
     set sid = excluded.sid, data = excluded.data, updated_at = now();
$$;
revoke all on function pp_push_subscribe(text, text, jsonb) from public;
grant execute on function pp_push_subscribe(text, text, jsonb) to anon, authenticated;

create or replace function pp_push_unsubscribe(p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_subs where id = p_id;
$$;
revoke all on function pp_push_unsubscribe(text) from public;
grant execute on function pp_push_unsubscribe(text) to anon, authenticated;

-- ── 4. 선생님 화면용 공개 뷰 ──
-- '알림이 켜졌는지'만 보이게 endpoint를 뺀 컬럼만 노출합니다 (뷰는 소유자 권한으로 실행).
drop view if exists push_subs_pub;
create view push_subs_pub as
  select sid,
         data->>'role' as role,
         data->>'name' as name,
         updated_at
    from push_subs
   where coalesce((data->>'active')::boolean, true);
grant select on push_subs_pub to anon, authenticated;

-- ── 5. 시험용으로 남은 행 정리 (있으면 지움) ──
delete from push_subs where sid in ('_savetest','_cnt','_diag','_selftest');

-- ── 6. 매일 보내기 스케줄 ──
-- 먼저 Edge Function 시크릿을 넣고 함수를 배포해 주세요 (설치 안내 1·2단계):
--   VAPID_PRIVATE_JWK / VAPID_PUBLIC / VAPID_SUBJECT
--   (대시보드: Edge Functions → Secrets 탭에서 Key/Value로 추가)
-- ※ JWT 검증(Verify JWT)은 켠 채로 두세요. 아래 호출이 프로젝트 공개 키를 함께 보냅니다.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ★ 채울 곳이 없습니다 — 주소와 호출 키를 미리 넣어 뒀습니다.
--   호출 키는 공개 키(anon)입니다. 앱 코드(js/db.js)에 이미 있는 값이고,
--   함수가 '기기당 하루 1회'를 보장하므로 더 호출돼도 알림이 쌓이지 않습니다.
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

-- ── 확인 ──
-- select jobname, schedule, active from cron.job where jobname='pp-hw-push';
-- select * from cron.job_run_details where jobid=(select jobid from cron.job where jobname='pp-hw-push') order by start_time desc limit 5;
-- select sid, role, updated_at from push_subs_pub;         -- 알림 켠 기기 목록

-- ── 되돌리기 ──
-- select cron.unschedule('pp-hw-push');
