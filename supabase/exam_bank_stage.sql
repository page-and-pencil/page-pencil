-- Page & Pencil / 직결영어 — 자료실 목록 뷰에 '수준' 을 싣는다 (exam_bank_index)
-- 실행: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run
--
-- ⚠️ 표(exam_bank)의 구조·데이터는 전혀 건드리지 않습니다. 목록용 뷰 하나만 다시 만듭니다.
--    (create or replace view — 열 이름·순서는 그대로라 앱의 받는 쪽은 바꾸지 않아도 됩니다)
-- 여러 번 실행해도 안전합니다.
--
-- 왜: 수준 값은 행 data 안에 이미 들어 있는데(아래 참고), 목록 화면은 files·audio 를 뺀
--     가벼운 뷰만 받습니다(6천 행 5MB → 1.8MB). 그 meta 에 수준이 없어서 거르기·배지가
--     쓸 수 없었습니다. 그래서 meta 에 다섯 값을 더합니다.
--
--   stage      P0 파닉스 · P1 초1~2 · P2 초3~4 · P3 초5~6 · M1 중1 · M2 중2 · M3 중3
--              · H1 고1 · H2 고2~3   (못 잰 자료는 null → 목록에서 '측정 안 됨')
--   stageG     추정 학년 (소수, 예 7.8)
--   stageBy    text 지문으로 · list 낱말 목록으로 · phonics 파닉스로
--   stageConf  high 높음 · mid 보통 · low 낮음
--   stageWhy   못 잰 이유 (예 '글을 뽑지 못함(그림·스캔)' · '음원만 있음')
--
-- jsonb_strip_nulls 는 그대로 둡니다 — 빈 값은 빠져서 받는 양이 줄고,
-- 앱은 'stage 키가 없으면 측정 안 됨' 으로 봅니다.

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
    'series', nullif(b.data->>'series',''),
    'year',   (nullif(b.data->>'year',''))::numeric,
    'month',  (nullif(b.data->>'month',''))::numeric,
    'round',  (nullif(b.data->>'round',''))::numeric,
    -- ↓ 여기부터가 이번에 더한 것 (수준)
    'stage',     nullif(b.data->>'stage',''),
    'stageG',    (nullif(b.data->>'stageG',''))::numeric,
    'stageBy',   nullif(b.data->>'stageBy',''),
    'stageConf', nullif(b.data->>'stageConf',''),
    'stageWhy',  nullif(b.data->>'stageWhy','')
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

-- create or replace 는 권한을 그대로 두지만, 혹시 몰라 다시 걸어 둡니다 (exam_bank.sql 과 같은 수준).
grant select on public.exam_bank_index to anon;
do $do$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='pp_is_teacher') then
    execute 'grant select on public.exam_bank_index to authenticated';
  end if;
end
$do$;

-- ── 확인용 (실행 뒤 한 줄씩 돌려 보셔도 됩니다) ───────────────
-- select meta->>'stage' as stage, count(*) from public.exam_bank_index group by 1 order by 1;
-- select count(*) from public.exam_bank_index where meta ? 'stage';          -- 수준이 있는 자료
-- select count(*) from public.exam_bank_index where not (meta ? 'stage');    -- 측정 안 된 자료
--
-- 앱 쪽: 선생님 화면 → 자료 DB → 기출·자료실 에서 ⋯ → '기기 캐시 비우고 다시 받기' 를
-- 한 번 누르면 수준 거르기 칸이 나타납니다 (안 눌러도 캐시 판이 올라가 자동으로 다시 받습니다).
