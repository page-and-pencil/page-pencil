-- Page & Pencil / 직결영어 — 기출·자료실 (exam_bank)
-- 실행: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run
--
-- 기존 테이블의 구조·데이터는 건드리지 않습니다. 이 파일은 새 테이블 1개 + 목록용 뷰 1개만 만듭니다.
-- 여러 번 실행해도 안전합니다 (if not exists / create or replace).
--
-- 행 구조는 앱의 다른 테이블과 같습니다: {id, data, sid, updated_at}
--   · id  는 구글 드라이브 폴더 id (시험 하나 = 폴더 하나 = 행 하나)
--   · sid 는 이 표에서 쓰지 않지만(학생 개인 자료가 아님), 공통 헬퍼 supaUpsert 가 보내는
--     모양을 맞추기 위해 열만 둡니다.
--   · 삭제는 하드 delete 가 아니라 data->>'_deleted' 표식(휴지통)으로 처리합니다.
--
-- ⚠️ 이 표에 학생 이름·점수 같은 개인정보를 넣지 마세요. 드라이브 파일 id 와 서지 정보만 담습니다.
-- ⚠️ 드라이브 파일은 비공개입니다. 앱은 파일 id 만 알고, 공유 설정은 건드리지 않습니다.

create table if not exists public.exam_bank (
  id          text primary key,
  sid         text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 자주 쓰는 필터(구분·연도·학교)에 인덱스
create index if not exists exam_bank_cat_idx    on public.exam_bank ((data->>'cat'));
create index if not exists exam_bank_year_idx   on public.exam_bank ((data->>'year'));
create index if not exists exam_bank_school_idx on public.exam_bank ((data->>'school'));

-- ── 목록용 뷰 ────────────────────────────────────────────────
-- 전체 표는 6천 행 · 5MB 가 넘습니다(대부분이 files 배열). 목록 화면에는 파일 목록이
-- 필요 없으므로, files·audio 를 뺀 가벼운 뷰를 따로 둡니다(약 1.7MB).
-- 상세를 열 때만 그 행의 data 전체를 한 줄 받습니다.
--   meta    목록·거르기에 쓰는 필드만 (구분·제목·폴더경로·학년·연도·지역·학교·메모)
--   nfiles  문서 개수            kinds  문서 종류 (쉼표로 이음: q 문제지 · a 정답 · s 해설 · sc 대본 · etc 기타)
--   naudio  드라이브 mp3 개수    extaud EBS 같은 바깥 음원 링크가 있는지
-- 휴지통(_deleted) 행은 뷰에서 빠집니다.
create or replace view public.exam_bank_index as
select
  b.id,
  b.updated_at,
  -- meta 는 목록·거르기에 쓰는 것만 담는다 (빈 값은 빼서 받는 양을 줄인다)
  jsonb_strip_nulls(jsonb_build_object(
    'cat',    nullif(b.data->>'cat',''),      'title',  nullif(b.data->>'title',''),
    'path',   nullif(b.data->>'path',''),     'note',   nullif(b.data->>'note',''),
    'level',  nullif(b.data->>'level',''),    'grade',  nullif(b.data->>'grade',''),
    'term',   nullif(b.data->>'term',''),     'school', nullif(b.data->>'school',''),
    'region', nullif(b.data->>'region',''),   'city',   nullif(b.data->>'city',''),
    'year',   (nullif(b.data->>'year',''))::numeric,
    'month',  (nullif(b.data->>'month',''))::numeric,
    'round',  (nullif(b.data->>'round',''))::numeric
  )) as meta,
  coalesce(jsonb_array_length(case when jsonb_typeof(b.data->'files')='array'
                                   then b.data->'files' else '[]'::jsonb end),0) as nfiles,
  coalesce((select string_agg(distinct f->>'k',',' order by f->>'k')
            from jsonb_array_elements(case when jsonb_typeof(b.data->'files')='array'
                                           then b.data->'files' else '[]'::jsonb end) f),'') as kinds,
  coalesce(jsonb_array_length(case when jsonb_typeof(b.data->'audio'->'files')='array'
                                   then b.data->'audio'->'files' else '[]'::jsonb end),0) as naudio,
  (coalesce(b.data->>'extAudio','') <> '') as extaud
from public.exam_bank b
where coalesce(b.data->>'_deleted','') = '';

-- 뷰가 호출자의 권한을 따르게 (Postgres 15+). 이 줄에서 오류가 나면 지우고 실행하세요.
alter view public.exam_bank_index set (security_invoker = on);

-- ── RLS ──────────────────────────────────────────────────────
-- 지금 이 앱은 정적 클라이언트가 anon 키로 PostgREST 에 직접 붙는 구조입니다
-- (supabase/auth_step3_close_anon.sql 은 아직 실행 전).
-- 그래서 exam_schedules.sql 과 **같은 수준**으로 이 표에 한해 anon 읽기·쓰기를 엽니다.
-- 로그인 서버 이전 3단계를 실행하실 때, 이 표도 같이 닫고 아래 '선생님 전용' 블록을 켜세요.
alter table public.exam_bank enable row level security;

drop policy if exists exam_bank_anon_read on public.exam_bank;
create policy exam_bank_anon_read on public.exam_bank
  for select to anon using (true);

drop policy if exists exam_bank_anon_write on public.exam_bank;
create policy exam_bank_anon_write on public.exam_bank
  for all to anon using (true) with check (true);

grant select, insert, update, delete on public.exam_bank to anon;
grant select on public.exam_bank_index to anon;

-- auth_step1.sql 을 실행하셨다면 선생님 토큰에도 열어 둡니다(3단계 뒤에도 그대로 돕니다).
do $do$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='pp_is_teacher') then
    execute 'drop policy if exists exam_bank_teacher_all on public.exam_bank';
    execute 'create policy exam_bank_teacher_all on public.exam_bank
               for all to authenticated using (public.pp_is_teacher()) with check (public.pp_is_teacher())';
    execute 'grant select, insert, update, delete on public.exam_bank to authenticated';
    execute 'grant select on public.exam_bank_index to authenticated';
  end if;
end
$do$;

-- ── 3단계(anon 닫기) 뒤에 쓸 '선생님 전용' 마무리 ───────────────
-- 아래 두 줄을 그때 실행하면 공개 키로는 이 표를 전혀 읽을 수 없게 됩니다.
--   drop policy if exists exam_bank_anon_read  on public.exam_bank;
--   drop policy if exists exam_bank_anon_write on public.exam_bank;
--   revoke select, insert, update, delete on public.exam_bank from anon;
--   revoke select on public.exam_bank_index from anon;

-- ── data 모양 (참고) ─────────────────────────────────────────
-- {
--   "cat": "suneung",            -- suneung 수능 | mopyeong 모의평가 | hakpyeong 학력평가
--                                -- | naea 학업성취도 | edu 시도교육청 | listen 영어듣기능력평가
--                                -- | school 학교 정기고사 | goip 고입선발고사 | basic 기초학력
--                                -- | publisher 출판사·학원용 | elt 영어교육 출판사 | research 연구 자료
--   "catLabel": "수능 (평가원)",
--   "level": "고",               -- 초 | 중 | 고 (없으면 빈 문자열)
--   "grade": "고3",              -- 전 학년이면 "전학년"
--   "year": 2026, "month": 11, "round": null,
--   "term": "1학기 중간",         -- 학교 정기고사만
--   "region": "강원", "city": "춘천", "school": "강원중학교", "office": "",
--   "title": "2026학년도 수능 영어",
--   "path": "강원 / 춘천 / 강원중학교",   -- 드라이브 폴더 경로 (표시용)
--   "drive": "jikgyeol",         -- jikgyeol | translator (어느 드라이브인지 — 표시용)
--   "folderId": "1AbC...",       -- 이 시험 폴더
--   "files": [                   -- k: q 문제지 · a 정답 · s 해설/문항정보표 · sc 듣기대본 · etc 기타
--     {"k":"q","id":"1Xyz...","name":"...pdf","mime":"application/pdf","size":2049508}
--   ],
--   "audio": {"folderId":"1Dpo...","files":[{"id":"1R9U...","name":"01_문항 01.mp3"}]},
--   "extAudio": "https://wdown.ebsi.co.kr/.../eng_mp3.mp3",   -- 드라이브 mp3 가 없을 때
--   "note": "", "tags": []
-- }
