-- ⚠️ 2026-11-08 Aside 가 Supabase SQL Editor 에서 실행 완료. 재실행 금지.
-- 이 파일은 기록용입니다. 다시 돌리지 마세요.
-- 되돌리기는 supabase/fix_textbook_units_rollback.sql 참고.
--
-- 한 일: unitOrder 정리 (P0 점검표 a·d 항목)
--   중학영어 1·2·3 (동아 윤정미)
--     unitOrder 가 아예 없어 units 키 순서에만 기대고 있었습니다 → Lesson 1~8 순서로 생성.
--     3권의 Special Lesson 은 맨 끝(999).
--   30-word READING 1·2
--     unitOrder 는 'Unit 1' 인데 units 키는 'Unit 01 Hello!' 라 서로 달랐습니다.
--     tbUnitKeys 가 unitOrder 중 units 에 없는 키를 버리고 나머지를 이름순으로 붙이는 탓에
--     단원이 24개로 보였습니다 → 실제 키 순서로 교체.
--
-- 정렬 규칙: 이름에 'special' 이 들어가면 맨 끝(999),
--            숫자가 있으면 그 숫자, 숫자가 없으면 998, 같으면 이름순.

update global_textbooks g set
  data = g.data || jsonb_build_object('unitOrder', (
    select jsonb_agg(k order by (case when k ~* '^special' then 999
                                      else coalesce((substring(k from '\d+'))::int, 998) end), k)
    from jsonb_object_keys(g.data->'units') k)),
  updated_at = now()
where g.data->>'title' in ('중학영어 1 (동아 윤정미)','중학영어 2 (동아 윤정미)','중학영어 3 (동아 윤정미, 2015 개정)','30-word READING 1','30-word READING 2');
