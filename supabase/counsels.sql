-- Page & Pencil / 직결영어 — 상담 기록 (6단계 B18)
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
--
-- 기존 테이블의 구조·데이터는 건드리지 않습니다. 이 파일은 새 테이블만 만듭니다.
-- 이 테이블이 없어도 앱은 그대로 돕니다 (loadAllData 가 테이블별로 따로 읽고,
-- 실패한 테이블은 빈 배열로 둡니다). 만들면 상담 기록이 쌓이기 시작합니다.
--
-- 행 구조는 앱의 다른 테이블과 같습니다: {id, data, sid, updated_at}
--   · 삭제는 하드 delete 가 아니라 data->>'_deleted' 표식(휴지통)으로 처리합니다.

create table if not exists public.counsels (
  id          text primary key,
  sid         text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create index if not exists counsels_sid_idx on public.counsels (sid);
create index if not exists counsels_date_idx on public.counsels ((data->>'date'));

-- ── RLS ──────────────────────────────────────────────────────
-- 주의: 이 앱은 아직 Supabase 인증을 쓰지 않습니다. 정적 페이지가 anon 키로
-- PostgREST 에 직접 붙고, 로그인(PIN)은 브라우저에서 비교합니다.
-- 그래서 anon 에게 열어 두는 것 말고는 실질적인 행 단위 보호가 되지 않습니다.
--
-- 상담 기록은 이 앱에서 가장 민감한 데이터입니다. 학부모 앱은 이 테이블을
-- 읽지 않지만, anon 키를 가진 사람은 기술적으로 읽을 수 있습니다.
-- 그러므로 가정사·건강·형제 관계·다른 학생 이야기처럼 새어 나가면 곤란한 내용은
-- 적지 마세요. 적어야 할 때는 "상담 때 구두로 전달" 처럼 표시만 남기십시오.
-- 제대로 된 보호는 Supabase 인증 도입 또는 엣지 함수 경유가 필요하며, 별도 안건입니다.
alter table public.counsels enable row level security;

drop policy if exists counsels_anon_read on public.counsels;
create policy counsels_anon_read on public.counsels
  for select to anon using (true);

drop policy if exists counsels_anon_write on public.counsels;
create policy counsels_anon_write on public.counsels
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.counsels to anon;

-- ── data 모양 (참고) ─────────────────────────────────────────
-- {
--   "id": "cs...",
--   "sid": "mrekljn47acn",
--   "date": "2026-11-04",
--   "way": "phone",                  -- phone 전화 / visit 방문 / msg 메시지 / other 기타
--   "who": "어머니",                  -- 상담한 상대 (선택)
--   "topic": "겨울방학 수업 시간",       -- 한 줄 주제
--   "note": "...",                   -- 오고 간 이야기
--   "todo": "다음 주까지 시간표 안내",    -- 다음에 할 일 (선택)
--   "todoDone": false,               -- 할 일 완료 표시
--   "_deleted": false
-- }
--
-- 상담 기록은 선생님만 봅니다. 학부모 앱·학생 앱은 이 테이블을 읽지 않습니다.
-- 약속한 것(todo)은 지켰는지 표시할 수 있게 남겨 둡니다 — 적어 두고 잊는 것이
-- 상담에서 가장 흔한 실수입니다.
