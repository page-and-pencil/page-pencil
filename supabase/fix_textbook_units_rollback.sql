-- ⚠️ 2026-11-08 Aside 실행분의 되돌리기. 아직 실행하지 않았습니다 — 필요할 때만 돌리세요.
-- 되돌리는 대상: fix_yozm_review_units.sql · fix_unitorder_middle_30word.sql
--
-- backup_global_textbooks_20261108 (2026-11-08 수정 직전 9행) 의 data 로 통째로 되돌립니다.
-- ⚠️ 그 뒤에 교재를 편집했다면 그 편집분도 함께 사라집니다. 돌리기 전에 updated_at 을 확인하세요.

-- 0) 무엇이 되돌아가는지 먼저 봅니다 (SELECT — 안전)
select b.id,
       b.data->>'title'                                   as 교재,
       jsonb_array_length(coalesce(b.data->'unitOrder','[]'::jsonb)) as 백업_단원수,
       jsonb_array_length(coalesce(g.data->'unitOrder','[]'::jsonb)) as 현재_단원수,
       g.updated_at                                       as 현재_수정시각
from backup_global_textbooks_20261108 b
join global_textbooks g on g.id = b.id
order by 교재;

-- 1) 실제 되돌리기 (위 결과를 확인한 뒤에만)
-- update global_textbooks g set data = b.data, updated_at = now()
-- from backup_global_textbooks_20261108 b where b.id = g.id;
