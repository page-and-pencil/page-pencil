-- Page & Pencil: monthly_reports 테이블 (2026-11-01)
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- 배경: 이 테이블만 아직 없어서 앱을 열 때마다 404 요청이 한 번씩 납니다.
--       기능은 빈 목록으로 정상 동작하지만, 그 404가 콘솔을 빨갛게 만들어
--       진짜 오류를 가립니다. (2026-11-01 점검 기준 누락 테이블은 이것 하나뿐)

create table if not exists monthly_reports (
  id         text primary key,
  sid        text,
  month      text,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists monthly_reports_sid_idx   on monthly_reports (sid);
create index if not exists monthly_reports_month_idx on monthly_reports (month);

-- 다른 테이블과 같은 접근 방식(익명 키로 읽고 씀 — 앱이 브라우저에서 직접 호출하는 구조)
alter table monthly_reports disable row level security;

-- 확인
-- select count(*) from monthly_reports;
