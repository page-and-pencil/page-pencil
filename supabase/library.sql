-- Page & Pencil / 직결영어 — 라이브러리 (lib_books · lib_text)
-- 실행: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run
--
-- 기존 표의 구조·데이터는 전혀 건드리지 않습니다. 새 표 2개 + 목록용 뷰 1개 + 찾기 함수 1개만 만듭니다.
-- 여러 번 실행해도 안전합니다 (if not exists / create or replace).
--
-- ── 무엇을 담나 ──────────────────────────────────────────────
-- 국내외 영어 교재를 한곳에서 찾고, 열어 보고, 커리큘럼을 짜고, 새 자료를 만들 때 근거로 쓰는 '라이브러리'.
--   lib_books  책 한 권 = 한 줄 (서지·구성·우리가 잰 수준·이어 붙인 자료)
--   lib_text   그 책의 글 조각 (단원 본문·대본·낱말·목차) — 찾기와 '교재에서 가져오기' 의 근거
--
-- ── 용량 (2026-11-13 기준) ───────────────────────────────────
--   지금 DB 51MB / 500MB.
--   책 1만 권 ≈ 30MB (lib_books, 한 줄 ~3KB)
--   본문      ≈ 100MB (lib_text, 책당 ~10KB × 1만 권) + 색인 ~40MB
--   → 다 넣으면 220MB 안팎. 500MB 안에 들지만 **본문은 쓰는 책부터** 넣는 것을 권합니다.
--   목록 화면은 lib_books_index(가벼운 뷰)만 받아 기기(IndexedDB)에 두고
--   id·updated_at 만 비교해 바뀐 줄만 받습니다 — 전송량은 exam_bank 와 같은 방식.
--
-- ⚠️ 출판사 원문(본문·표지 이미지 파일)을 저장소(git)에 넣지 않습니다. 이 표에만 둡니다.
-- ⚠️ 학생 이름·점수 같은 개인정보를 넣지 마세요. 서지와 글만 담습니다.
-- ⚠️ 학생·학부모 화면과 체험 모드는 이 두 표를 **부르지도 않습니다**(앱 쪽 libMayUse 로 막음).

-- ══ 1. lib_books ═══════════════════════════════════════════
-- 행 구조는 앱의 다른 표와 같습니다: {id, sid, data, updated_at}
--   · sid 는 쓰지 않지만 공통 헬퍼 supaUpsert 가 보내는 모양을 맞추려고 열만 둡니다.
--   · 삭제는 하드 delete 가 아니라 data->>'_deleted' 표식(휴지통)입니다.
create table if not exists public.lib_books (
  id          text primary key,
  sid         text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 자주 쓰는 거르기에 인덱스
create index if not exists lib_books_pub_idx    on public.lib_books ((data->>'publisher'));
create index if not exists lib_books_series_idx on public.lib_books ((data->>'seriesKey'));
create index if not exists lib_books_area_idx   on public.lib_books ((data->>'area'));
create index if not exists lib_books_target_idx on public.lib_books ((data->>'target'));
create index if not exists lib_books_stage_idx  on public.lib_books ((data->>'stage'));
create index if not exists lib_books_tb_idx     on public.lib_books ((data->>'tbId'));
create index if not exists lib_books_upd_idx    on public.lib_books (updated_at);

-- ── data 칸 (참고) ──────────────────────────────────────────
-- {
--   "key": "neungyule|junior-reading-expert|1",   -- 같은 책을 두 번 넣지 않으려는 열쇠
--   "publisher": "능률교육", "distributor": "에듀조선",
--   "series": "Junior Reading Expert", "title": "Junior Reading Expert 1", "volume": "1",
--   "pubLevel": "Level 1",            -- 출판사가 적은 레벨 표기 (그대로)
--   "target": "중등",                  -- 초등 | 중등 | 고등 | 성인 | 유아
--   "area": "리딩",                    -- 리딩|리스닝|문법|어휘|쓰기|말하기|파닉스|종합|내신|수능|시험
--   "use": "일반",                     -- 일반|수능 대비|내신 대비|듣기평가 대비|공인시험
--   "isbn": "9788925661234", "year": 2021, "pages": 160, "price": 14000,
--   "cover": "https://…/cover.jpg",   -- 이미지 '주소'만 둡니다 (파일은 저장소에 넣지 않습니다)
--   "url": "https://…",               -- 출판사·서점 쪽 책 소개
--   "desc": "…",                      -- 소개 글
--   "toc":  [{"no":1,"title":"Unit 1 …"}],
--   "sample": "맛보기 지문 (있을 때만)",
--   "components": ["본책","워크북","단어장","음원"],
--   "stage": "M2", "stageG": 7.8, "stageBy": "text", "stageConf": "high",   -- 우리가 잰 수준
--   "tbId": "cpbsdmsu00vu",            -- 등록 교재(global_textbooks) id — 이어 붙였을 때만
--   "bankIds": ["1AbC…"],              -- 자료실(exam_bank) 줄 id
--   "seriesKey": "neungyule|junior-reading-expert", "seriesOrder": 1,
--   "sources": ["publisher-site","aladin","drive"],
--   "_deleted": true                   -- 휴지통
-- }

-- ══ 2. lib_text ════════════════════════════════════════════
-- ⚠️ 뷰(lib_books_index)의 ntext 가 이 표를 보므로 **뷰보다 먼저** 만듭니다.
--    순서가 바뀌면 relation "public.lib_text" does not exist 로 멈춥니다.
-- 책의 글 조각. id 는 '책id|단원|조각번호' 로 만들어 같은 조각을 두 번 넣지 않습니다.
create table if not exists public.lib_text (
  id          text primary key,
  book_id     text not null,
  unit        text,
  kind        text not null default 'passage',   -- passage 본문 | script 대본 | vocab 낱말 | sample 맛보기 | toc 목차
  text        text not null default '',
  words       int,
  src         jsonb,                             -- {"fileId":"1Xyz…","page":3,"bankId":"1AbC…"}
  updated_at  timestamptz not null default now()
);
create index if not exists lib_text_book_idx on public.lib_text (book_id);
create index if not exists lib_text_kind_idx on public.lib_text (kind);
create index if not exists lib_text_upd_idx  on public.lib_text (updated_at);

-- 낱말 찾기 — 영어 본문이라 'simple' 로 충분합니다(한국어 형태소 사전이 없어도 됨)
alter table public.lib_text
  add column if not exists tsv tsvector
  generated always as (to_tsvector('simple', coalesce(unit,'') || ' ' || coalesce(text,''))) stored;
create index if not exists lib_text_tsv_idx on public.lib_text using gin (tsv);

-- 토막 글자 찾기(부분 일치) — pg_trgm 이 없으면 만듭니다
create extension if not exists pg_trgm;
create index if not exists lib_text_trgm_idx on public.lib_text using gin (text gin_trgm_ops);
create index if not exists lib_books_title_trgm_idx
  on public.lib_books using gin ((coalesce(data->>'title','') || ' ' || coalesce(data->>'series','')) gin_trgm_ops);

-- ══ 3. 목록용 뷰 ═══════════════════════════════════════════
-- 목록에는 소개 글·목차·맛보기가 필요 없습니다(한 줄에서 가장 무거운 부분).
-- 그 셋을 뺀 가벼운 meta 를 주고, 책 한 권을 열 때만 그 줄의 data 전체를 받습니다.
--   ntoc     목차 줄 수 · hasSample 맛보기 있음 · nbank 이어 붙인 자료 수
-- 휴지통(_deleted) 줄은 뷰에서 빠집니다.
create or replace view public.lib_books_index as
select
  b.id,
  b.updated_at,
  jsonb_strip_nulls(jsonb_build_object(
    'key',         nullif(b.data->>'key',''),
    'publisher',   nullif(b.data->>'publisher',''),
    'distributor', nullif(b.data->>'distributor',''),
    'series',      nullif(b.data->>'series',''),
    'title',       nullif(b.data->>'title',''),
    'volume',      nullif(b.data->>'volume',''),
    'pubLevel',    nullif(b.data->>'pubLevel',''),
    'target',      nullif(b.data->>'target',''),
    'area',        nullif(b.data->>'area',''),
    'use',         nullif(b.data->>'use',''),
    'isbn',        nullif(b.data->>'isbn',''),
    'year',        (nullif(b.data->>'year',''))::numeric,
    'pages',       (nullif(b.data->>'pages',''))::numeric,
    'price',       (nullif(b.data->>'price',''))::numeric,
    'cover',       nullif(b.data->>'cover',''),
    'url',         nullif(b.data->>'url',''),
    'stage',       nullif(b.data->>'stage',''),
    'stageG',      (nullif(b.data->>'stageG',''))::numeric,
    'stageBy',     nullif(b.data->>'stageBy',''),
    'stageConf',   nullif(b.data->>'stageConf',''),
    'tbId',        nullif(b.data->>'tbId',''),
    'seriesKey',   nullif(b.data->>'seriesKey',''),
    'seriesOrder', (nullif(b.data->>'seriesOrder',''))::numeric,
    'components',  case when jsonb_typeof(b.data->'components')='array' then b.data->'components' else null end,
    'sources',     case when jsonb_typeof(b.data->'sources')='array'    then b.data->'sources'    else null end,
    'bankIds',     case when jsonb_typeof(b.data->'bankIds')='array'    then b.data->'bankIds'    else null end,
    -- ↓ 2026-11-14 더한 것 — 목록 카드에서 바로 쓰는 값
    'kind',        nullif(b.data->>'kind',''),                      -- '원서' 배지
    'outOfPrint',  case when (b.data->>'outOfPrint')='true' then true else null end,
    'authors',     nullif(b.data->>'authors',''),
    'teacherMaterials', (nullif(b.data->>'teacherMaterials',''))::numeric
  )) as meta,
  coalesce(jsonb_array_length(case when jsonb_typeof(b.data->'toc')='array'
                                   then b.data->'toc' else '[]'::jsonb end),0) as ntoc,
  (coalesce(b.data->>'sample','') <> '') as hassample,
  (coalesce(b.data->>'tocImage','') <> '') as hastocimg,     -- 목차 '그림' 만 있는 책 (목록에서 알 수 있게)
  (coalesce(b.data->>'previewUrl','') <> '') as haspreview,
  coalesce(jsonb_array_length(case when jsonb_typeof(b.data->'bankIds')='array'
                                   then b.data->'bankIds' else '[]'::jsonb end),0) as nbank,
  (select count(*) from public.lib_text t where t.book_id = b.id) as ntext
from public.lib_books b
where coalesce(b.data->>'_deleted','') = '';

-- 뷰가 부른 사람의 권한을 따르게 (Postgres 15+). 이 줄에서 오류가 나면 지우고 실행하세요.
alter view public.lib_books_index set (security_invoker = on);

-- ══ 4. 찾기 함수 ═══════════════════════════════════════════
-- 제목·시리즈·목차(lib_books)와 본문(lib_text)을 **함께** 찾아 점수순으로 돌려줍니다.
--   book_id  책 줄 id
--   unit     본문이면 그 단원 (책 쪽 결과는 빈 값)
--   kind     'title' | 'series' | 'toc' | passage/script/vocab/sample
--   snippet  찾은 자리 앞뒤 120자
--   score    높을수록 가까움 (제목 > 시리즈 > 목차 > 본문)
create or replace function public.lib_search(q text, lim int default 30)
returns table(book_id text, unit text, kind text, snippet text, score real)
language sql
stable
security invoker
as $$
  with needle as (select btrim(coalesce(q,'')) as q),
  -- 책 쪽 (제목·시리즈·목차)
  bk as (
    select b.id as book_id,
           ''::text as unit,
           case
             when coalesce(b.data->>'title','')  ilike '%'||n.q||'%' then 'title'
             when coalesce(b.data->>'series','') ilike '%'||n.q||'%' then 'series'
             else 'toc'
           end as kind,
           left(coalesce(nullif(b.data->>'title',''), b.data->>'series', ''), 160) as snippet,
           case
             when coalesce(b.data->>'title','')  ilike n.q||'%'      then 5.0
             when coalesce(b.data->>'title','')  ilike '%'||n.q||'%' then 4.0
             when coalesce(b.data->>'series','') ilike '%'||n.q||'%' then 3.0
             else 2.0
           end::real as score
    from public.lib_books b, needle n
    where n.q <> ''
      and coalesce(b.data->>'_deleted','') = ''
      and (
        coalesce(b.data->>'title','')  ilike '%'||n.q||'%'
        or coalesce(b.data->>'series','') ilike '%'||n.q||'%'
        or coalesce(b.data->>'toc','')::text ilike '%'||n.q||'%'
      )
  ),
  -- 본문 쪽
  tx as (
    select t.book_id,
           coalesce(t.unit,'')::text as unit,
           t.kind,
           -- 찾은 자리 앞뒤 120자
           case when position(lower(n.q) in lower(t.text)) > 0
                then left(substr(t.text,
                       greatest(1, position(lower(n.q) in lower(t.text)) - 120),
                       length(n.q) + 240), 300)
                else left(t.text, 240) end as snippet,
           (1.0 + ts_rank(t.tsv, plainto_tsquery('simple', n.q)))::real as score
    from public.lib_text t, needle n
    where n.q <> ''
      and (t.tsv @@ plainto_tsquery('simple', n.q) or t.text ilike '%'||n.q||'%')
  )
  select * from (
    select * from bk
    union all
    select * from tx
  ) r
  order by r.score desc, r.book_id, r.unit
  limit greatest(1, coalesce(lim, 30));
$$;

-- ── 2026-11-14: 뷰만 다시 만들 때 ───────────────────────────
-- 위 'create or replace view public.lib_books_index' 블록만 다시 실행하면 됩니다.
-- 표·데이터는 건드리지 않습니다. (meta 에 kind·outOfPrint·authors·teacherMaterials,
--  열에 hastocimg·haspreview 를 더했습니다.)

-- ══ 5. RLS ═════════════════════════════════════════════════
-- 라이브러리는 **선생님 전용**입니다. 학생·학부모 화면은 이 표를 부르지도 않습니다.
-- 지금 이 앱은 정적 클라이언트가 anon 키로 PostgREST 에 직접 붙는 구조라
-- (supabase/auth_step3_close_anon.sql 은 아직 실행 전) item_bank·exam_bank 와 **같은 수준**으로
-- 그때까지만 anon 을 열어 둡니다. 3단계를 실행하실 때 아래 '선생님 전용' 마무리를 켜세요.
alter table public.lib_books enable row level security;
alter table public.lib_text  enable row level security;

drop policy if exists lib_books_anon_read on public.lib_books;
create policy lib_books_anon_read on public.lib_books for select to anon using (true);
drop policy if exists lib_books_anon_write on public.lib_books;
create policy lib_books_anon_write on public.lib_books for all to anon using (true) with check (true);

drop policy if exists lib_text_anon_read on public.lib_text;
create policy lib_text_anon_read on public.lib_text for select to anon using (true);
drop policy if exists lib_text_anon_write on public.lib_text;
create policy lib_text_anon_write on public.lib_text for all to anon using (true) with check (true);

grant select, insert, update, delete on public.lib_books to anon;
grant select, insert, update, delete on public.lib_text  to anon;
grant select on public.lib_books_index to anon;
grant execute on function public.lib_search(text, int) to anon;

-- auth_step1.sql 을 실행하셨다면 선생님 토큰에도 열어 둡니다(3단계 뒤에도 그대로 돕니다).
do $do$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='pp_is_teacher') then
    execute 'drop policy if exists lib_books_teacher_all on public.lib_books';
    execute 'create policy lib_books_teacher_all on public.lib_books
               for all to authenticated using (public.pp_is_teacher()) with check (public.pp_is_teacher())';
    execute 'drop policy if exists lib_text_teacher_all on public.lib_text';
    execute 'create policy lib_text_teacher_all on public.lib_text
               for all to authenticated using (public.pp_is_teacher()) with check (public.pp_is_teacher())';
    execute 'grant select, insert, update, delete on public.lib_books to authenticated';
    execute 'grant select, insert, update, delete on public.lib_text  to authenticated';
    execute 'grant select on public.lib_books_index to authenticated';
    execute 'grant execute on function public.lib_search(text, int) to authenticated';
  end if;
end
$do$;

-- ── 3단계(anon 닫기) 뒤에 쓸 '선생님 전용' 마무리 ───────────────
-- 아래 줄들을 그때 실행하면 공개 키로는 이 두 표를 전혀 읽을 수 없게 됩니다.
--   drop policy if exists lib_books_anon_read  on public.lib_books;
--   drop policy if exists lib_books_anon_write on public.lib_books;
--   drop policy if exists lib_text_anon_read   on public.lib_text;
--   drop policy if exists lib_text_anon_write  on public.lib_text;
--   revoke select, insert, update, delete on public.lib_books from anon;
--   revoke select, insert, update, delete on public.lib_text  from anon;
--   revoke select on public.lib_books_index from anon;
--   revoke execute on function public.lib_search(text, int) from anon;

-- ── 잘 들어갔는지 보기 (실행 뒤 한 번) ─────────────────────────
--   select count(*) from public.lib_books;
--   select count(*) from public.lib_text;
--   select * from public.lib_books_index limit 3;
--   select * from public.lib_search('reading', 10);
