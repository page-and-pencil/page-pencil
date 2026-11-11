-- Page & Pencil / 직결영어 — 문제 은행 (item_bank)
-- 실행: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run
--
-- 기존 테이블의 구조·데이터는 건드리지 않습니다. 이 파일은 새 테이블 1개 + 목록용 뷰 1개만 만듭니다.
-- 여러 번 실행해도 안전합니다 (if not exists / create or replace).
--
-- 행 구조는 앱의 다른 테이블과 같습니다: {id, data, sid, updated_at}
--   · id  는 문항 하나의 id (동형 문제에서 만든 문항은 그 문항의 id 를 그대로 씁니다)
--   · sid 는 이 표에서 쓰지 않지만(학생 개인 자료가 아님), 공통 헬퍼 supaUpsert 가 보내는
--     모양을 맞추기 위해 열만 둡니다.
--   · 삭제는 하드 delete 가 아니라 data->>'_deleted' 표식(휴지통)으로 처리합니다.
--
-- ⚠️ 이 표에 학생 이름·점수 같은 개인정보를 넣지 마세요. 문항과 서지 정보만 담습니다.
-- ⚠️ 저작권이 있는 원문 지문(src.keep=true)은 공개 키가 열려 있는 동안 앱이 올리지 않습니다
--    (앱 쪽 스위치 ITEM_KEEP_SERVER=false — anon 을 닫은 뒤 true 로 바꿉니다).

create table if not exists public.item_bank (
  id          text primary key,
  sid         text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 자주 쓰는 거르기(영역·유형·학년·묶음)에 인덱스
create index if not exists item_bank_skill_idx on public.item_bank ((data->>'skill'));
create index if not exists item_bank_type_idx  on public.item_bank ((data->>'type'));
create index if not exists item_bank_grade_idx on public.item_bank ((data->>'grade'));
create index if not exists item_bank_set_idx   on public.item_bank ((data->>'setId'));

-- ── 목록용 뷰 ────────────────────────────────────────────────
-- 목록 화면에는 지문·해설·오답 해설·듣기 대본이 필요 없습니다(한 문항에서 가장 무거운 부분).
-- 그 넷을 뺀 가벼운 뷰를 따로 두고, 문항을 고를 때만 그 행의 data 전체를 한 줄 받습니다.
--   meta.preview  지문(없으면 대본) 앞 180자 — 카드에 두 줄 보여 주는 용도
--   meta.hasPassage / hasScript  본문이 있는지만 알려 줍니다
-- 휴지통(_deleted) 행은 뷰에서 빠집니다.
create or replace view public.item_bank_index as
select
  b.id,
  b.updated_at,
  jsonb_strip_nulls(jsonb_build_object(
    'skill',    nullif(b.data->>'skill',''),
    'type',     nullif(b.data->>'type',''),
    'typeName', nullif(b.data->>'typeName',''),
    'grade',    nullif(b.data->>'grade',''),
    'diff',     (nullif(b.data->>'diff',''))::numeric,
    'diffSrc',  nullif(b.data->>'diffSrc',''),
    'rate',     (nullif(b.data->>'rate',''))::numeric,
    'points',   (nullif(b.data->>'points',''))::numeric,
    'stem',     nullif(b.data->>'stem',''),
    'preview',  nullif(left(coalesce(nullif(b.data->>'passage',''),nullif(b.data->>'script',''),''),180),''),
    'choices',  case when jsonb_typeof(b.data->'choices')='array' then b.data->'choices' else null end,
    'answer',   (nullif(b.data->>'answer',''))::numeric,
    'words',    (nullif(b.data->>'words',''))::numeric,
    'src',      case when jsonb_typeof(b.data->'src')='object'  then b.data->'src'  else null end,
    'tags',     case when jsonb_typeof(b.data->'tags')='array'  then b.data->'tags' else null end,
    'setId',    nullif(b.data->>'setId',''),
    'setOrder', (nullif(b.data->>'setOrder',''))::numeric,
    'star',     case when (b.data->>'star')='true'    then true else null end,
    'checked',  case when (b.data->>'checked')='true' then true else null end,
    'note',     nullif(b.data->>'note',''),
    'createdAt',(nullif(b.data->>'createdAt',''))::numeric,
    'editedAt', (nullif(b.data->>'editedAt',''))::numeric,
    'hasPassage', (coalesce(b.data->>'passage','') <> ''),
    'hasScript',  (coalesce(b.data->>'script','')  <> '')
  )) as meta
from public.item_bank b
where coalesce(b.data->>'_deleted','') = '';

-- 뷰가 호출자의 권한을 따르게 (Postgres 15+). 이 줄에서 오류가 나면 지우고 실행하세요.
alter view public.item_bank_index set (security_invoker = on);

-- ── RLS ──────────────────────────────────────────────────────
-- 지금 이 앱은 정적 클라이언트가 anon 키로 PostgREST 에 직접 붙는 구조입니다
-- (supabase/auth_step3_close_anon.sql 은 아직 실행 전).
-- 그래서 exam_bank.sql 과 **같은 수준**으로 이 표에 한해 anon 읽기·쓰기를 엽니다.
-- 로그인 서버 이전 3단계를 실행하실 때, 이 표도 같이 닫고 아래 '선생님 전용' 블록을 켜세요.
alter table public.item_bank enable row level security;

drop policy if exists item_bank_anon_read on public.item_bank;
create policy item_bank_anon_read on public.item_bank
  for select to anon using (true);

drop policy if exists item_bank_anon_write on public.item_bank;
create policy item_bank_anon_write on public.item_bank
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.item_bank to anon;
grant select on public.item_bank_index to anon;

-- auth_step1.sql 을 실행하셨다면 선생님 토큰에도 열어 둡니다(3단계 뒤에도 그대로 돕니다).
do $do$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='pp_is_teacher') then
    execute 'drop policy if exists item_bank_teacher_all on public.item_bank';
    execute 'create policy item_bank_teacher_all on public.item_bank
               for all to authenticated using (public.pp_is_teacher()) with check (public.pp_is_teacher())';
    execute 'grant select, insert, update, delete on public.item_bank to authenticated';
    execute 'grant select on public.item_bank_index to authenticated';
  end if;
end
$do$;

-- ── 3단계(anon 닫기) 뒤에 쓸 '선생님 전용' 마무리 ───────────────
-- 아래 네 줄을 그때 실행하면 공개 키로는 이 표를 전혀 읽을 수 없게 됩니다.
-- 그 뒤에 앱의 ITEM_KEEP_SERVER 를 true 로 바꾸면 원문 지문 문항도 서버에 저장됩니다.
--   drop policy if exists item_bank_anon_read  on public.item_bank;
--   drop policy if exists item_bank_anon_write on public.item_bank;
--   revoke select, insert, update, delete on public.item_bank from anon;
--   revoke select on public.item_bank_index from anon;

-- ── data 모양 (참고) ─────────────────────────────────────────
-- {
--   "skill": "read",             -- read 읽기 | listen 듣기 | grammar 어법 | vocab 어휘 | write 쓰기
--   "type": "blank",             -- 앱의 ISO_TYPES 키 (유형 사전 47종)
--   "typeName": "읽기 · 빈칸 추론",
--   "grade": "고1",              -- 초5 ~ 고3
--   "diff": 3,                   -- 1(쉬움) ~ 5(어려움)
--   "diffSrc": "rate",           -- rate 정답률 | rule 배점·유형 규칙 | teacher 선생님이 고침
--   "rate": 62, "points": 2,     -- 정답률(%) · 배점 (알 때만)
--   "stem": "다음 빈칸에 들어갈 말로 가장 적절한 것은?",
--   "passage": "...",            -- 지문 (듣기는 script 를 쓴다)
--   "choices": ["...","..."], "answer": 2,          -- answer 는 0 부터 센 번호, 서술형은 -1
--   "answerText": "모범 답안", "rubric": "채점 기준",
--   "explain": "해설", "wrong": ["①이 답이 아닌 이유"],
--   "script": "듣기 대본",
--   "words": 175,                -- 지문 단어 수
--   "src": {                     -- 어디서 왔는지
--     "kind": "iso",             -- iso 동형 | exam 기출 | book 교재 | manual 직접
--     "exam": "2026학년도 9월 모의평가 영어", "qno": "31",
--     "bankId": "1AbC...",       -- 자료실(exam_bank) 줄 id
--     "fileId": "1Xyz...", "page": 3, "audioId": "1R9U...",
--     "tbId": "...", "unit": "Lesson 3",
--     "isoFrom": "원본 문항 id",
--     "keep": false              -- 기출·출판사 원문 지문을 그대로 쓴 문항인지
--   },
--   "setId": "", "setOrder": 1,  -- 장문처럼 지문을 같이 쓰는 문항 묶음
--   "tags": ["어려움","1학기중간"], "star": false, "checked": false, "note": "",
--   "createdAt": 1762800000000, "editedAt": 1762800000000
-- }
