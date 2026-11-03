-- Page & Pencil / 직결영어 — 중학영어 3 (2015 개정) 고유명사 대소문자 복구
-- 작성 2026-11-04 · 실행은 수동 (Supabase 대시보드 → SQL Editor)
--
-- 배경
--   tuAddWord 가 입력한 단어를 소문자로 바꿔 저장하던 때 들어간 것들이다.
--   코드는 이미 고쳤고(입력 대소문자 유지), 이미 저장된 5개만 되돌린다.
--
-- 바꾸는 것
--   Lesson 1  northern lights → Northern Lights
--   Lesson 2  italian         → Italian
--   Lesson 3  british         → British
--   Lesson 3  mayan           → Mayan
--   Lesson 3  spanish         → Spanish
--
-- 건드리지 않는 것
--   뜻(ko) · 품사(pos) · 예문(example) · 그 밖의 키 · 단어 순서
--   같은 단원의 다른 단어 · 다른 교재 (Read It! 60-3 의 Italian 등은 이미 올바른 표기)
--
-- 2026-11-04 확인
--   title 이 정확히 일치하는 행은 1개 (단원 9 · 단어 171)
--   vocab_cards 1,225행 전수 확인 — 이 단어들에서 파생된 학생 카드 0개 → 학생 단어장 영향 없음
--
-- ※ 한 단계씩 실행하고, 각 단계의 결과를 눈으로 확인한 뒤 다음으로 넘어가세요.


-- ══════════════════════════════════════════════════════════════
-- 0) 백업 — 고치기 전에 대상 행을 통째로 보관한다
-- ══════════════════════════════════════════════════════════════
create table if not exists backup_global_textbooks_20261104 (
  backed_up_at timestamptz not null default now(),
  id           text,
  sid          text,
  data         jsonb,
  updated_at   timestamptz
);

insert into backup_global_textbooks_20261104 (id, sid, data, updated_at)
select t.id, t.sid, t.data, t.updated_at
from   global_textbooks t
where  t.data->>'title' = '중학영어 3 (동아 윤정미, 2015 개정)';

-- 백업이 1행 들어갔는지 확인 (0 이면 멈추세요 — 제목이 다른 것입니다)
select count(*) as 백업행수 from backup_global_textbooks_20261104;

-- 되돌리려면 (맨 아래 '되돌리기' 참고)


-- ══════════════════════════════════════════════════════════════
-- 1) 실행 전 확인 — 대상이 정확히 5개인지, 단어가 171개인지
-- ══════════════════════════════════════════════════════════════
select u.key                as 단원,
       w.ord                as 순번,
       w.val->>'word'       as 현재표기,
       w.val->>'ko'         as 뜻
from   global_textbooks t,
       lateral jsonb_each(t.data->'units')                       as u(key, arr),
       lateral jsonb_array_elements(u.arr) with ordinality       as w(val, ord)
where  t.data->>'title' = '중학영어 3 (동아 윤정미, 2015 개정)'
  and  w.val->>'word' in ('northern lights','italian','british','mayan','spanish')
order  by u.key, w.ord;
-- 기대: 5행 (Lesson 1 northern lights / Lesson 2 italian / Lesson 3 british·mayan·spanish)

select sum(jsonb_array_length(u.arr)) as 단어_총개수
from   global_textbooks t,
       lateral jsonb_each(t.data->'units') as u(key, arr)
where  t.data->>'title' = '중학영어 3 (동아 윤정미, 2015 개정)';
-- 기대: 171


-- ══════════════════════════════════════════════════════════════
-- 2) 바꾸기 — word 철자만. 단원·순서·다른 키는 그대로
-- ══════════════════════════════════════════════════════════════
update global_textbooks t
set    data = jsonb_set(
         t.data,
         '{units}',
         (
           -- units 가 비어 있으면 jsonb_object_agg 가 NULL 을 돌려준다 → 그때는 원래 값을 유지
           select coalesce(jsonb_object_agg(
                    u.key,
                    (
                      select coalesce(
                               jsonb_agg(
                                 case w.val->>'word'
                                   when 'northern lights' then jsonb_set(w.val, '{word}', '"Northern Lights"')
                                   when 'italian'         then jsonb_set(w.val, '{word}', '"Italian"')
                                   when 'british'         then jsonb_set(w.val, '{word}', '"British"')
                                   when 'mayan'           then jsonb_set(w.val, '{word}', '"Mayan"')
                                   when 'spanish'         then jsonb_set(w.val, '{word}', '"Spanish"')
                                   else w.val
                                 end
                                 order by w.ord
                               ),
                               '[]'::jsonb
                             )
                      from jsonb_array_elements(u.arr) with ordinality as w(val, ord)
                    )
                  ), t.data->'units')
           from jsonb_each(t.data->'units') as u(key, arr)
         )
       ),
       updated_at = now()
where  t.data->>'title' = '중학영어 3 (동아 윤정미, 2015 개정)';
-- 기대: UPDATE 1


-- ══════════════════════════════════════════════════════════════
-- 3) 실행 후 확인
-- ══════════════════════════════════════════════════════════════
select u.key           as 단원,
       w.val->>'word'  as 표기,
       w.val->>'ko'    as 뜻
from   global_textbooks t,
       lateral jsonb_each(t.data->'units')         as u(key, arr),
       lateral jsonb_array_elements(u.arr)         as w(val)
where  t.data->>'title' = '중학영어 3 (동아 윤정미, 2015 개정)'
  and  w.val->>'word' in ('Northern Lights','Italian','British','Mayan','Spanish')
order  by u.key, w.val->>'word';
-- 기대: 5행, 전부 대문자 표기. 뜻이 그대로인지도 함께 보세요

select sum(jsonb_array_length(u.arr)) as 단어_총개수
from   global_textbooks t,
       lateral jsonb_each(t.data->'units') as u(key, arr)
where  t.data->>'title' = '중학영어 3 (동아 윤정미, 2015 개정)';
-- 기대: 171 (1번과 같아야 합니다. 다르면 아래 '되돌리기')

select count(*) as 남은_소문자
from   global_textbooks t,
       lateral jsonb_each(t.data->'units')         as u(key, arr),
       lateral jsonb_array_elements(u.arr)         as w(val)
where  t.data->>'title' = '중학영어 3 (동아 윤정미, 2015 개정)'
  and  w.val->>'word' in ('northern lights','italian','british','mayan','spanish');
-- 기대: 0


-- ══════════════════════════════════════════════════════════════
-- 되돌리기 — 백업한 행으로 통째로 복원
-- ══════════════════════════════════════════════════════════════
-- update global_textbooks t
-- set    data = b.data, updated_at = now()
-- from   (select distinct on (id) id, data
--           from backup_global_textbooks_20261104
--          order by id, backed_up_at desc) b
-- where  t.id = b.id;

-- 확인이 끝나고 백업이 더 필요 없으면:
-- drop table backup_global_textbooks_20261104;
