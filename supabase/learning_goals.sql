-- Page & Pencil / 직결영어 — 학습 목표 (2단계)
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
--
-- 기존 테이블의 구조·데이터는 건드리지 않습니다. 이 파일은 새 테이블만 만듭니다.
-- 행 구조는 앱의 다른 테이블과 같습니다: {id, data, sid, updated_at}
--   · 학생 개인 목표는 sid 를 채우고, 반 공통 목표는 sid 를 비우고 data.classId 를 씁니다.
--   · 삭제는 하드 delete 가 아니라 data->>'_deleted' 표식(휴지통)으로 처리합니다.

create table if not exists public.learning_goals (
  id          text primary key,
  sid         text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create index if not exists learning_goals_sid_idx on public.learning_goals (sid);
create index if not exists learning_goals_range_idx
  on public.learning_goals ((data->>'from'), (data->>'to'));

-- ── RLS ──────────────────────────────────────────────────────
-- 주의: 이 앱은 아직 Supabase 인증을 쓰지 않습니다. 정적 페이지가 anon 키로
-- PostgREST 에 직접 붙고, 로그인(PIN)은 브라우저에서 비교합니다.
-- 그래서 anon 에게 열어 두는 것 말고는 실질적인 행 단위 보호가 되지 않습니다.
-- 목표 문장에는 학생 이름·점수 같은 개인정보를 넣지 마세요
-- (학생 식별은 sid 로만 하고, 본문은 학습 내용만 적습니다).
-- 제대로 된 보호는 Supabase 인증 도입 또는 엣지 함수 경유가 필요하며, 별도 안건입니다.
alter table public.learning_goals enable row level security;

drop policy if exists learning_goals_anon_read on public.learning_goals;
create policy learning_goals_anon_read on public.learning_goals
  for select to anon using (true);

drop policy if exists learning_goals_anon_write on public.learning_goals;
create policy learning_goals_anon_write on public.learning_goals
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.learning_goals to anon;

-- ── data 모양 (참고) ─────────────────────────────────────────
-- {
--   "id": "gl...",
--   "sid": "mrekljn47acn",            -- 학생 개인 목표 (반 공통이면 비움)
--   "classId": "",                    -- 반 공통 목표일 때만
--   "track": "ch",                    -- jg = 직결 / ch = 체력 / common = 공통
--   "area": "구문",                    -- 학습 영역 (선택)
--   "goal": "긴 문장에서 주어와 동사를 찾는다",   -- 관찰 가능한 문장으로 적습니다
--   "criteria": "새 지문 5문장 중 4문장 이상",   -- 무엇을 보면 됐다고 할지
--   "from": "2026-11-03",
--   "to":   "2026-11-09",
--   "status": "active",               -- active = 진행 중 / met = 달성 / notmet = 미달
--   "checkedAt": "", "checkNote": "", -- 확인한 날과 메모 (확인 전에는 비움)
--   "_deleted": false
-- }
--
-- 확인하지 않은 목표를 '달성'으로 두지 않습니다. 기간이 지나도 자동으로 바꾸지 않고,
-- 선생님이 달성/미달을 직접 표시합니다. 미확인은 '미평가'로 남습니다.
