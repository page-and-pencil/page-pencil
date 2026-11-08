-- ⚠️ 2026-11-08 Aside 가 Supabase SQL Editor 에서 실행 완료. 재실행 금지.
-- 이 파일은 '무엇을 했는지' 남겨 두는 기록용입니다. 다시 돌리지 마세요.
-- 되돌리기는 supabase/fix_textbook_units_rollback.sql 참고.
--
-- 한 일: 요즘 초등 영단어 1~4 에 Review Test 단원 6개 추가
--   대상 id  012602z11m7x(1권) · zfqb7sjq2yob(2권) · io9xv5bbl0tw(3권) · b2n2q8oa9ykz(4권)
--   추가 키  Unit 5 · Unit 10 · Unit 15 · Unit 20 · Unit 25 · Unit 30
--   units        → 빈 배열 (단어 없음 — 출판사 목차에서 Review Test 로 확인)
--   unitTitles   → 'Review Test'
--   unitNoVocab  → 단어 없음이 정상이라는 표식 (교재 점검 경고에서 빠짐)
--   unitOrder    → 번호 순서 자리에 삽입
--   totalUnits   → 30
--   기존 단원·단어는 건드리지 않았습니다 (새 키를 기존 맵 '앞'에 두고 기존 맵으로 덮어쓰는 순서).
--
-- 백업: backup_global_textbooks_20261108 (9행) — 아래 1) 로 먼저 만들었습니다.

-- 1) 백업 (실행 완료)
create table if not exists backup_global_textbooks_20261108 as select * from global_textbooks where false;
alter table backup_global_textbooks_20261108 enable row level security;
insert into backup_global_textbooks_20261108
select g.* from global_textbooks g
where g.id in ('012602z11m7x','zfqb7sjq2yob','io9xv5bbl0tw','b2n2q8oa9ykz')
   or g.data->>'title' in ('중학영어 1 (동아 윤정미)','중학영어 2 (동아 윤정미)','중학영어 3 (동아 윤정미, 2015 개정)','30-word READING 1','30-word READING 2')
  and not exists (select 1 from backup_global_textbooks_20261108 b where b.id=g.id);

-- 2) Review Test 단원 추가 (실행 완료)
with nk as (select unnest(array['Unit 5','Unit 10','Unit 15','Unit 20','Unit 25','Unit 30']) k),
newunits as (select jsonb_object_agg(k, '[]'::jsonb) j from nk),
newtitles as (select jsonb_object_agg(k, to_jsonb('Review Test'::text)) j from nk),
newnv as (select jsonb_object_agg(k, to_jsonb('Review Test 단원: 앞 4개 단원 복습, 새 단어 없음 (2026-11-08 출판사 목차 확인)'::text)) j from nk)
update global_textbooks g set
  data = g.data
    || jsonb_build_object('units', (select j from newunits) || coalesce(g.data->'units','{}'::jsonb))
    || jsonb_build_object('unitTitles', (select j from newtitles) || coalesce(g.data->'unitTitles','{}'::jsonb))
    || jsonb_build_object('unitNoVocab', (select j from newnv) || coalesce(g.data->'unitNoVocab','{}'::jsonb))
    || jsonb_build_object('unitOrder', (select jsonb_agg(k order by (substring(k from '\d+'))::int)
         from (select jsonb_array_elements_text(g.data->'unitOrder') k union select k from nk) s))
    || jsonb_build_object('totalUnits', 30),
  updated_at = now()
where g.id in ('012602z11m7x','zfqb7sjq2yob','io9xv5bbl0tw','b2n2q8oa9ykz');
