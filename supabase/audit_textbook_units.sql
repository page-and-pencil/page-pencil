-- ============================================================
-- audit_textbook_units.sql  (읽기 전용 — SELECT 만. 실행해도 데이터가 바뀌지 않습니다)
--
-- 교재(global_textbooks, data->>'type'='textbook', 휴지통 제외)의 단원 구성을 서버 안에서
-- 전부 계산해 '문제 한 줄 = 한 행'으로 돌려줍니다. 교재 본문·단어를 내려받지 않으므로
-- 전송량은 결과 표 크기뿐입니다.
--
-- 돌리는 법: Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run.
-- 결과 열: 구분 | 교재 | 시리즈 | 내용 | 참고
--   a) unitOrder-units 차이   b) 다른 맵에만 있는 키   c) 번호 빈칸 / 뒤쪽 누락 의심
--   d) unitOrder 없음         e) totalUnits 불일치     f) 시리즈 안에서 Review 없음
--   g) 단어 0개 단원 목록     z) 교재별 요약 한 줄
-- ============================================================

with tb as (
  select
    id,
    coalesce(data->>'title','(제목 없음)')                                     as title,
    nullif(data->>'series','')                                                as series,
    nullif(data->>'category','')                                              as category,
    case when data->>'totalUnits' ~ '^[0-9]+$'
         then (data->>'totalUnits')::int end                                  as total_units,
    case when jsonb_typeof(data->'units')='object'
         then data->'units' else '{}'::jsonb end                              as units,
    case when jsonb_typeof(data->'unitOrder')='array'
         then data->'unitOrder' else '[]'::jsonb end                          as unit_order,
    case when jsonb_typeof(data->'unitTitles')='object'
         then data->'unitTitles' else '{}'::jsonb end                         as unit_titles,
    case when jsonb_typeof(data->'unitTexts')='object'
         then data->'unitTexts' else '{}'::jsonb end                          as unit_texts,
    case when jsonb_typeof(data->'unitAudio')='object'
         then data->'unitAudio' else '{}'::jsonb end                          as unit_audio,
    case when jsonb_typeof(data->'unitLinks')='object'
         then data->'unitLinks' else '{}'::jsonb end                          as unit_links,
    case when jsonb_typeof(data->'unitPatterns')='object'
         then data->'unitPatterns' else '{}'::jsonb end                       as unit_patterns,
    case when jsonb_typeof(data->'unitNoVocab')='object'
         then data->'unitNoVocab' else '{}'::jsonb end                        as unit_no_vocab
  from public.global_textbooks
  where coalesce(data->>'type','textbook') = 'textbook'
    and coalesce(data->>'_deleted','false') not in ('true','"true"')
),

-- units 의 키 + 단어 수 + 판정에 쓸 표식들 (뒤에서 jsonb 를 다시 안 보게 미리 계산)
ukeys as (
  select
    t.id,
    u.key                                                                     as k,
    case when jsonb_typeof(u.value)='array' then jsonb_array_length(u.value) else 0 end as n_words,
    jsonb_exists(t.unit_no_vocab, u.key)                                      as flag_novocab,
    (u.key ~* '(review|test|project|flashcard|challenge|복습|평가)')           as flag_reviewish,
    (jsonb_exists(t.unit_texts, u.key) or jsonb_exists(t.unit_patterns, u.key)) as flag_hastext
  from tb t, lateral jsonb_each(t.units) u
),

-- unitOrder 의 키와 자리
okeys as (
  select t.id, o.k, o.ord
  from tb t,
       lateral (select value #>> '{}' as k, ordinality as ord
                from jsonb_array_elements(t.unit_order) with ordinality) o
),

-- 단어 맵이 아닌 다른 맵들의 키 (어느 맵인지 함께)
mkeys as (
  select t.id, m.k, m.src
  from tb t,
       lateral (
                 select key as k, 'unitTitles'   as src from jsonb_each(t.unit_titles)
         union all select key,    'unitTexts'           from jsonb_each(t.unit_texts)
         union all select key,    'unitAudio'           from jsonb_each(t.unit_audio)
         union all select key,    'unitLinks'           from jsonb_each(t.unit_links)
         union all select key,    'unitPatterns'        from jsonb_each(t.unit_patterns)
       ) m
),

-- 번호가 붙은 단원만 (Unit/Lesson/Day/Chapter + 숫자). 앞자리 0 은 무시.
numbered as (
  select
    u.id,
    lower((regexp_match(u.k, '^[[:space:]]*(unit|lesson|day|chapter)[[:space:]]*0*([0-9]+)[[:space:]]*$', 'i'))[1]) as label,
    ((regexp_match(u.k, '^[[:space:]]*(unit|lesson|day|chapter)[[:space:]]*0*([0-9]+)[[:space:]]*$', 'i'))[2])::int as num
  from ukeys u
  where u.k ~* '^[[:space:]]*(unit|lesson|day|chapter)[[:space:]]*0*[0-9]+[[:space:]]*$'
),
num_range as (
  select id, label, min(num) as lo, max(num) as hi, count(*) as cnt
  from numbered group by id, label
),
num_gaps as (
  select r.id, r.label, r.lo, r.hi, r.cnt,
         (select string_agg(g.g::text, ', ' order by g.g)
            from generate_series(r.lo, r.hi) as g(g)
           where not exists (select 1 from numbered n
                              where n.id = r.id and n.label = r.label and n.num = g.g)) as gaps
  from num_range r
),
-- 같은 시리즈 다른 권의 최대 번호 (뒤쪽 누락 판단용)
sib_max as (
  select t.series, r.label, max(r.hi) as hi_max
  from num_range r join tb t on t.id = r.id
  where t.series is not null
  group by t.series, r.label
),
sib_who as (
  select s.series, s.label, s.hi_max,
         (select t2.title
            from num_range r2 join tb t2 on t2.id = r2.id
           where t2.series = s.series and r2.label = s.label and r2.hi = s.hi_max
           order by t2.title limit 1) as who
  from sib_max s
),

-- Review·Test 류 단원이 있는 권인지 (시리즈 비교용)
reviewish as (
  select id, bool_or(flag_reviewish) as has_review
  from ukeys group by id
),
series_review as (
  select t.series,
         count(*) filter (where r.has_review) as vols_with,
         count(*)                             as vols_all,
         string_agg(t.title, ', ' order by t.title) filter (where r.has_review) as with_titles
  from tb t join reviewish r on r.id = t.id
  where t.series is not null
  group by t.series
),

-- ───────── 문제 행 ─────────
issues as (

  -- (a) unitOrder 와 units 키의 차이
  select 'a. unitOrder-units 차이'::text as 구분, t.title as 교재, t.series as 시리즈,
         ('unitOrder 에만 있고 units 에 없는 키 ' || count(*) || '개')::text as 내용,
         string_agg(o.k, ', ' order by o.ord)::text as 참고
  from tb t join okeys o on o.id = t.id
  where not exists (select 1 from ukeys u where u.id = t.id and u.k = o.k)
  group by t.title, t.series

  union all
  select 'a. unitOrder-units 차이', t.title, t.series,
         'units 에만 있고 unitOrder 에 없는 키 ' || count(*) || '개 (화면에서는 맨 뒤 이름순으로 밀림)',
         string_agg(u.k, ', ' order by u.k)
  from tb t join ukeys u on u.id = t.id
  where jsonb_array_length(t.unit_order) > 0
    and not exists (select 1 from okeys o where o.id = t.id and o.k = u.k)
  group by t.title, t.series

  -- (b) 다른 맵에는 있는데 unitOrder 에 없는 키
  union all
  select 'b. 다른 맵에만 있는 키', t.title, t.series,
         m.src || ' 에는 있는데 unitOrder 에 없는 키 ' || count(*) || '개',
         string_agg(distinct m.k, ', ')
  from tb t join mkeys m on m.id = t.id
  where jsonb_array_length(t.unit_order) > 0
    and not exists (select 1 from okeys o where o.id = t.id and o.k = m.k)
  group by t.title, t.series, m.src

  -- (c-1) 번호 빈칸
  union all
  select 'c. 번호 빈칸', t.title, t.series,
         initcap(g.label) || ' ' || g.lo || '~' || g.hi || ' 중 빠진 번호: ' || g.gaps,
         '등록 ' || g.cnt || '개'
  from num_gaps g join tb t on t.id = g.id
  where g.gaps is not null

  -- (c-2) 마지막 번호 뒤에 단원이 더 있을 가능성
  union all
  select 'c. 뒤쪽 누락 의심', t.title, t.series,
         '마지막 ' || initcap(g.label) || ' ' || g.hi || ' 에서 끝남 — '
         || case when t.total_units is not null and t.total_units > g.hi
                   then 'totalUnits 는 ' || t.total_units
                 else '같은 시리즈 최대 ' || sw.hi_max || ' (' || coalesce(sw.who,'다른 권') || ')' end,
         '책 목차를 확인해 주세요'
  from num_gaps g
  join tb t on t.id = g.id
  left join sib_who sw on sw.series = t.series and sw.label = g.label
  where (t.total_units is not null and t.total_units > g.hi)
     or (sw.hi_max is not null and sw.hi_max > g.hi)

  -- (d) unitOrder 없음
  union all
  select 'd. unitOrder 없음', t.title, t.series,
         '단원 ' || (select count(*) from ukeys u where u.id = t.id) || '개가 units 키 순서에만 기대고 있음',
         (select string_agg(u.k, ', ' order by u.k) from ukeys u where u.id = t.id)
  from tb t
  where jsonb_array_length(t.unit_order) = 0

  -- (e) totalUnits 와 실제 단원 수가 다름
  union all
  select 'e. totalUnits 불일치', t.title, t.series,
         'totalUnits=' || t.total_units || ' 인데 실제 단원 ' || c.n || '개',
         case when t.total_units > c.n then '단원 ' || (t.total_units - c.n) || '개가 비어 있을 수 있음'
              else 'totalUnits 가 실제보다 작음' end
  from tb t
  join lateral (select count(*) as n from ukeys u where u.id = t.id) c on true
  where t.total_units is not null and t.total_units <> c.n

  -- (f) 같은 시리즈 다른 권에는 Review·Test 가 있는데 이 권에는 없음
  union all
  select 'f. 시리즈 안에서 Review 없음', t.title, t.series,
         '같은 시리즈 ' || s.vols_all || '권 중 ' || s.vols_with || '권에는 Review·Test 단원이 있는데 이 권에는 없음',
         '있는 권: ' || s.with_titles
  from tb t
  join series_review s on s.series = t.series
  join reviewish r on r.id = t.id
  where s.vols_with > 0 and not r.has_review

  -- (g) 단어 0개 단원 (정상인 것과 빠진 것 구분)
  union all
  select 'g. 단어 0개 단원', t.title, t.series,
         '단어 0개 ' || count(*) || '개',
         string_agg(
           u.k || case when u.flag_novocab   then ' [단어없음 정상 표식]'
                       when u.flag_reviewish then ' [이름이 Review/Test]'
                       when u.flag_hastext   then ' [본문·패턴 있음]'
                       else ' [빠진 것일 수 있음]' end,
           ', ' order by u.k)
  from tb t join ukeys u on u.id = t.id
  where u.n_words = 0
  group by t.title, t.series

  -- (z) 교재별 요약
  union all
  select 'z. 요약', t.title, t.series,
         '단원 ' || c.n || '개 · 단어 ' || c.w || '개 · 단어0개 ' || c.z || '개'
         || ' · unitOrder ' || jsonb_array_length(t.unit_order) || '개'
         || ' · totalUnits ' || coalesce(t.total_units::text, '(없음)'),
         coalesce(t.category, '(분류 없음)')
  from tb t
  join lateral (
    select count(*) as n,
           coalesce(sum(u.n_words), 0) as w,
           count(*) filter (where u.n_words = 0) as z
    from ukeys u where u.id = t.id
  ) c on true
)

select 구분, 교재, coalesce(시리즈, '—') as 시리즈, 내용, 참고
from issues
order by 구분, coalesce(시리즈, 'zzz'), 교재;
