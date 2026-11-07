-- Page & Pencil — Auth 1단계 보완 정책 (2026-11-08)
-- 실행: SQL Editor 에 붙여넣고 Run. **auth_step1.sql 다음에** 실행합니다.
-- Aside 가 11/8 에 이미 실행한 내용을 그대로 파일로 남긴 것입니다(다시 실행해도 안전).
--
-- 왜 필요했나 — auth_step1.sql 만으로는 토큰으로 들어온 학생·학부모·선생님이 아래를 못 했습니다:
--   · 학부모 '확인했습니다'   → messages insert 가 막힘
--   · 공지 읽음 표시          → notices update 가 막힘
--   · 학부모 결제 안내·카카오 문의 → settings 의 acct·kakao 읽기가 막힘
--   · 선생님 학습 목표 목록   → learning_goals 에 RLS 는 켜져 있는데 authenticated 정책이 없어 빈 목록

-- 1) 학부모 '확인했습니다' 등 자기 sid 메시지 읽기·쓰기
drop policy if exists messages_self on public.messages;
create policy messages_self on public.messages for all to authenticated
  using (sid = public.pp_my_sid()) with check (sid = public.pp_my_sid());

-- 2) 공지 읽음 표시 (임시)
--    ⚠️ 이 두 정책은 **임시**입니다. 학생·학부모 토큰으로 공지 본문까지 고칠 수 있습니다.
--    앱이 읽음 표시를 messages 로 옮겼으므로(2026-11-08 배포), 그 버전이 퍼진 뒤
--    supabase/auth_step1_notice_cleanup.sql 로 이 두 정책을 지우세요.
drop policy if exists notices_auth_readmark on public.notices;
create policy notices_auth_readmark on public.notices for update to authenticated using (true) with check (true);

drop policy if exists notices_auth_readmark_ins on public.notices;
create policy notices_auth_readmark_ins on public.notices for insert to authenticated
  with check (public.pp_is_teacher() or exists (select 1 from public.notices n where n.id = notices.id));

-- 3) 학부모·학생이 읽어야 하는 설정값 (비밀값은 빠져 있습니다 — pw·apikey·elevenlabs 없음)
drop policy if exists settings_auth_read on public.settings;
create policy settings_auth_read on public.settings for select to authenticated
  using (key in ('acct','cloud','kakao','cmtChips','jgPrepDays','vocabPassPct','bmThresholds','paperMix'));

-- 4) 학습 목표 — 선생님 전부, 학생·학부모는 자기 것 읽기
drop policy if exists learning_goals_teacher on public.learning_goals;
create policy learning_goals_teacher on public.learning_goals for all to authenticated
  using (public.pp_is_teacher()) with check (public.pp_is_teacher());

drop policy if exists learning_goals_self on public.learning_goals;
create policy learning_goals_self on public.learning_goals for select to authenticated
  using (sid = public.pp_my_sid());

-- 확인
--   select tablename, policyname, cmd, roles from pg_policies
--    where schemaname='public' and tablename in ('messages','notices','settings','learning_goals')
--    order by tablename, policyname;
