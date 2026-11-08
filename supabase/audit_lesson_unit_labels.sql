-- ============================================================
-- audit_lesson_unit_labels.sql  (읽기 전용 — SELECT 만)
--
-- 수업 기록(lessons.data->'materials')에 적힌 단원명 가운데 교재의 실제 단원 키로
-- 연결되지 않는 것을 뽑습니다. 연결 규칙은 앱의 지금 규칙과 똑같이 맞췄습니다.
--   · 앞자리 0 무시 · 대소문자 무시 · 공백/기호 무시   (= js/teacher.js _pgNorm)
--   · 앞부분 일치, 단 숫자 경계 보호                    (= js/teacher.js _pgUMatch)
--     "unit1" 은 "unit1newfriends" 와 연결되지만 "unit11" 과는 연결되지 않음
--   · 단원 문자열은 쉼표(,)와 슬래시(/)로 나눠서 하나씩 봄 (= 앱의 split(','))
--
-- 돌리는 법: Supabase 대시보드 > SQL Editor 에 붙여넣고 Run.
-- 결과 열: 교재 | 기록_단원명 | 횟수 | 최근_날짜 | 제목으로는_연결됨 | 번호만_같은_단원
--   · '제목으로는_연결됨'  = unitTitles(소제목)까지 보면 어느 단원인지  → P2 에서 매칭에 넣을 후보
--   · '번호만_같은_단원'   = 숫자만 같은 단원 키. 사람이 눈으로 확인할 힌트
--   둘 다 비어 있으면 교재에 그 단원 자체가 없다는 뜻입니다(= Review 누락 같은 경우).
-- ============================================================

with tb as (
  select
    id,
    coalesce(data->>'title','') as title,
    case when jsonb_typeof(data->'units')='object' then data->'units' else '{}'::jsonb end       as units,
    case when jsonb_typeof(data->'unitTitles')='object' then data->'unitTitles' else '{}'::jsonb end as unit_titles
  from public.global_textbooks
  where coalesce(data->>'type','textbook') = 'textbook'
    and coalesce(data->>'_deleted','false') not in ('true','"true"')
),
-- 교재 단원 키 + 정규화형 + 소제목 정규화형
ukeys as (
  select t.id, t.title, u.key as k,
         regexp_replace(lower(u.key), '[^a-z0-9가-힣]', '', 'g')                        as nk,
         regexp_replace(lower(coalesce(t.unit_titles->>u.key,'')), '[^a-z0-9가-힣]', '', 'g') as nt,
         nullif((regexp_match(u.key, '([0-9]+)'))[1], '')::int                          as knum
  from tb t, lateral jsonb_each(t.units) u
),

-- 수업 기록의 materials 를 펼친다 (휴지통 제외)
mats as (
  select l.id as lesson_id,
         coalesce(l.data->>'date','') as ldate,
         m.value->>'book'   as book,
         m.value->>'bookId' as book_id,
         m.value->>'unit'   as unit_str
  from public.lessons l,
       lateral jsonb_each(case when jsonb_typeof(l.data->'materials')='object'
                               then l.data->'materials' else '{}'::jsonb end) m
  where coalesce(l.data->>'_deleted','false') not in ('true','"true"')
    and jsonb_typeof(m.value)='object'
    and coalesce(m.value->>'book','') <> ''
    and coalesce(m.value->>'unit','') <> ''
),
-- 쉼표·슬래시로 쪼갠다
parts as (
  select m.lesson_id, m.ldate, m.book, m.book_id,
         btrim(p.seg) as seg
  from mats m, lateral regexp_split_to_table(m.unit_str, '\s*[,/]\s*') p(seg)
  where btrim(p.seg) <> ''
),
-- 그 기록이 가리키는 교재 (bookId 우선, 없으면 제목 일치 — 앱과 같은 순서)
linked as (
  select p.*,
         coalesce(
           (select t.id from tb t where t.id = p.book_id),
           (select t.id from tb t where t.title = p.book limit 1)
         ) as tb_id,
         regexp_replace(lower(p.seg), '[^a-z0-9가-힣]', '', 'g') as nseg,
         nullif((regexp_match(p.seg, '([0-9]+)'))[1], '')::int   as segnum
  from parts p
),
-- 앱의 _pgUMatch 와 같은 판정
matched as (
  select l.*,
         exists (
           select 1 from ukeys u
           where u.id = l.tb_id
             and length(u.nk) > 0 and length(l.nseg) > 0
             and ( u.nk = l.nseg
                or (u.nk like l.nseg || '%' and coalesce(substring(u.nk from length(l.nseg)+1 for 1),'') !~ '^[0-9]')
                or (l.nseg like u.nk || '%' and coalesce(substring(l.nseg from length(u.nk)+1 for 1),'') !~ '^[0-9]') )
         ) as ok
  from linked l
  where l.tb_id is not null
)

select
  (select t.title from tb t where t.id = m.tb_id)                      as 교재,
  m.seg                                                                as 기록_단원명,
  count(*)                                                             as 횟수,
  max(m.ldate)                                                         as 최근_날짜,
  -- 소제목(unitTitles)으로 보면 연결되는 단원
  (select string_agg(distinct u.k, ', ')
     from ukeys u
    where u.id = m.tb_id and length(u.nt) > 0
      and ( u.nt = m.nseg
         or (u.nt like m.nseg || '%' and coalesce(substring(u.nt from length(m.nseg)+1 for 1),'') !~ '^[0-9]')
         or (m.nseg like u.nt || '%' and coalesce(substring(m.nseg from length(u.nt)+1 for 1),'') !~ '^[0-9]') )
  )                                                                    as 제목으로는_연결됨,
  -- 숫자만 같은 단원 (사람 눈 확인용 힌트)
  (select string_agg(distinct u.k, ', ')
     from ukeys u
    where u.id = m.tb_id and m.segnum is not null and u.knum = m.segnum
  )                                                                    as 번호만_같은_단원
from matched m
where not m.ok
group by m.tb_id, m.seg, m.nseg, m.segnum
order by count(*) desc, 교재, m.seg;

-- ── 참고용 두 번째 표: 교재를 아예 못 찾은 기록 (bookId 도 제목도 교재 DB 에 없음) ──
-- 위 표를 먼저 보시고, 필요하면 아래 주석을 풀어 따로 돌려 주세요.
--
-- with mats as (
--   select coalesce(l.data->>'date','') ldate, m.value->>'book' book, m.value->>'unit' unit_str
--   from public.lessons l,
--        lateral jsonb_each(case when jsonb_typeof(l.data->'materials')='object'
--                                then l.data->'materials' else '{}'::jsonb end) m
--   where coalesce(l.data->>'_deleted','false') not in ('true','"true"')
--     and jsonb_typeof(m.value)='object' and coalesce(m.value->>'book','') <> ''
-- )
-- select book as 기록된_교재명, count(*) as 횟수, max(ldate) as 최근_날짜
-- from mats
-- where not exists (select 1 from public.global_textbooks g
--                    where coalesce(g.data->>'type','textbook')='textbook'
--                      and coalesce(g.data->>'_deleted','false') not in ('true','"true"')
--                      and g.data->>'title' = mats.book)
-- group by book order by count(*) desc;
