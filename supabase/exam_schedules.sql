-- Page & Pencil / 직결영어 — 학교 시험 일정 (1단계)
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
--
-- 기존 테이블의 구조·데이터는 건드리지 않습니다. 이 파일은 새 테이블만 만듭니다.
-- 행 구조는 앱의 다른 테이블과 같습니다: {id, data, sid, updated_at}
--   · sid 는 이 테이블에서 쓰지 않지만(학교 단위 데이터), 공통 헬퍼 supaUpsert 가
--     보내는 모양을 맞추기 위해 열만 둡니다.
--   · 삭제는 하드 delete 가 아니라 data->>'_deleted' 표식(휴지통)으로 처리합니다.

create table if not exists public.exam_schedules (
  id          text primary key,
  sid         text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 학년도(year)는 적용 학년도입니다. 2026 일정을 2027에 쓰지 않도록 해마다 새 행을 만드세요.
-- 확정(status='confirmed') 일정만 직결 기간 전환에 쓰입니다.
-- 행이 아예 없는 상태는 '일정 미등록'이며, '지필 없음'(noExam)과 구분합니다.
--
-- 학교·학년·학기로 자주 찾으므로 인덱스를 둡니다
create index if not exists exam_schedules_school_idx
  on public.exam_schedules ((data->>'school'), (data->>'grade'));
create index if not exists exam_schedules_date_idx
  on public.exam_schedules ((data->>'examDate'));

-- ── RLS ──────────────────────────────────────────────────────
-- 이 앱은 정적 클라이언트가 anon 키로 PostgREST 에 직접 붙는 구조입니다.
-- settings_rls.sql 과 같은 수준으로, 이 테이블에 한해 anon 읽기·쓰기를 엽니다.
-- (시험 일정은 학생 개인정보가 아니라 학교 공개 일정입니다.
--  학생 이름·점수 같은 개인정보는 이 테이블에 넣지 마세요.)
alter table public.exam_schedules enable row level security;

drop policy if exists exam_schedules_anon_read on public.exam_schedules;
create policy exam_schedules_anon_read on public.exam_schedules
  for select to anon using (true);

drop policy if exists exam_schedules_anon_write on public.exam_schedules;
create policy exam_schedules_anon_write on public.exam_schedules
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.exam_schedules to anon;

-- ── data 모양 (참고) ─────────────────────────────────────────
-- {
--   "school": "섬강중학교",
--   "grade": "중1",                       -- 학생 grade 값과 같은 표기
--   "year": 2026,
--   "semester": 1,                         -- 1 | 2
--   "round": 1,                            -- 1 = 1회고사, 2 = 2회고사
--   "examDate": "2026-04-28",              -- 영어 시험일
--   "periodFrom": "2026-04-27",            -- 시험 기간 시작 (선택)
--   "periodTo":   "2026-05-01",            -- 시험 기간 끝   (선택)
--   "status": "confirmed",                 -- confirmed = 학교에서 확인한 확정 일정
--                                          -- planned   = 예정 (확인 전) — 기간 전환에 쓰지 않음
--                                          -- 값이 없는 옛 행은 confirmed 로 본다
--   "source": "학교 홈페이지 가정통신문",      -- 어디서 확인했는지
--   "checkedAt": "2026-11-03",             -- 확인한 날
--   "noExam": false,                       -- true 면 지필 없음(자유학기 등)
--   "noExamNote": "수행평가 100%",
--   "scope": {
--     "textbooks": [ { "bookId": "...", "title": "...", "units": ["Lesson 1"] } ],
--     "extra": ["부교재: ...", "프린트: ..."]
--   },
--   "memo": "",
--   "_deleted": false
-- }
