-- Page & Pencil / 직결영어 — 시험지 푼 결과 (item_results)
-- 실행: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run
--
-- 기존 테이블의 구조·데이터는 건드리지 않습니다. 이 파일은 새 테이블 1개만 만듭니다.
-- 여러 번 실행해도 안전합니다 (if not exists / drop policy if exists).
--
-- 행 구조는 앱의 다른 테이블과 같습니다: {id, data, sid, updated_at}
--   · 한 줄 = 한 학생이 한 시험지를 한 번 푼 기록.
--   · sid 는 학생 id. 진단 테스트처럼 재원생이 아닌 경우에는 'diag_...' 로 시작하는 임시 값을 씁니다.
--   · 삭제는 하드 delete 가 아니라 data->>'_deleted' 표식(휴지통)으로 처리합니다.
--
-- ⚠️ 이 표에는 점수와 고른 번호만 담습니다. 문항 본문·해설은 item_bank 와
--    보낸 시험지(worksheets) 쪽에 있고 여기에는 넣지 않습니다.
-- ⚠️ 연락처·주소 같은 개인정보는 넣지 마세요. 진단 테스트도 이름만 받습니다.

create table if not exists public.item_results (
  id          text primary key,
  sid         text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create index if not exists item_results_sid_idx   on public.item_results (sid);
create index if not exists item_results_paper_idx on public.item_results ((data->>'paperId'));
create index if not exists item_results_date_idx  on public.item_results ((data->>'date'));

-- ── RLS ──────────────────────────────────────────────────────
-- 지금 이 앱은 정적 클라이언트가 anon 키로 PostgREST 에 직접 붙는 구조라,
-- 학생 기록 표(tests 등)와 **같은 수준**으로 anon 을 열어 둡니다.
-- auth_step1.sql 을 실행하셨다면 선생님 토큰은 전부, 학생·학부모 토큰은 자기 sid 만 보게
-- _teacher · _self 정책을 함께 겁니다(다른 표와 같은 모양).
alter table public.item_results enable row level security;

drop policy if exists item_results_anon_all on public.item_results;
create policy item_results_anon_all on public.item_results
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.item_results to anon;

do $do$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='pp_is_teacher') then
    -- 선생님: 전부
    execute 'drop policy if exists item_results_teacher on public.item_results';
    execute 'create policy item_results_teacher on public.item_results
               for all to authenticated using (public.pp_is_teacher()) with check (public.pp_is_teacher())';
    -- 학생·학부모: 자기 sid 만 (학생은 자기 답을 쓰기도 하므로 for all)
    execute 'drop policy if exists item_results_self on public.item_results';
    execute 'create policy item_results_self on public.item_results
               for all to authenticated using (sid = public.pp_my_sid()) with check (sid = public.pp_my_sid())';
    execute 'grant select, insert, update, delete on public.item_results to authenticated';
  end if;
end
$do$;

-- ── 3단계(anon 닫기) 뒤에 쓸 마무리 ──────────────────────────
-- 아래 두 줄을 그때 실행하면 공개 키로는 이 표를 전혀 쓸 수 없게 됩니다.
--   drop policy if exists item_results_anon_all on public.item_results;
--   revoke select, insert, update, delete on public.item_results from anon;

-- ── data 모양 (참고) ─────────────────────────────────────────
-- {
--   "paperId": "pp...",              -- 시험지(worksheets kind:'paper') id
--   "sentId":  "ws...",              -- 학생에게 보낸 사본 줄 id (앱 풀이일 때)
--   "title":   "2026 1학기 중간 대비",
--   "date":    "2026-11-12",          -- 푼 날 (ppToday 기준)
--   "mode":    "app",                 -- app 앱에서 풀기 | paper 종이로 푼 답 입력
--   "purpose": "",                    -- diag 면 진단 테스트
--   "name":    "",                    -- 진단 테스트에서 받은 이름 (재원생은 비움)
--   "answers": {"itemId": 2, "itemId2": "I have lived here for ten years."},
--                                     -- 객관식은 0 부터 센 번호, 서술형은 쓴 글, 무응답은 null
--   "correct": {"itemId": true, "itemId2": null},
--                                     -- null = 아직 못 매김 (서술형은 선생님이 누를 때까지 null)
--   "score": 17, "total": 20,          -- 맞은 문항 수 / 매긴 문항 수
--   "points": 34, "pointsTotal": 40,   -- 배점으로 센 점수 (있을 때만)
--   "byType": {"blank": [2,4], "order": [1,2]},   -- 유형별 [맞은 수, 문항 수]
--   "bySkill": {"read": [12,16], "listen": [3,4]},-- 영역별 [맞은 수, 문항 수]
--   "submittedAt": 1762900000000,
--   "gradedAt": 1762900500000,         -- 선생님이 서술형까지 매긴 때
--   "testId": "",                      -- '자체 시험으로 기록' 을 골랐을 때 만든 tests 줄 id
--   "_deleted": false
-- }
