-- Page & Pencil — 공지 임시 정책 정리 (2026-11-08)
--
-- 언제 실행하나: **앱 ?v=20261108b 이상이 퍼진 뒤**(학생·학부모 기기가 새 버전을 한 번 열면 됩니다).
-- 그 버전부터 공지 읽음 표시를 notices 행이 아니라 messages 의
--   { type:'notice_read', noticeId, sid }  한 줄로 남깁니다.
-- 그래서 notices 에 열어 둔 update/insert 권한이 더 이상 필요 없습니다.
--
-- 왜 지워야 하나: auth_step1_supp.sql 의 notices_auth_readmark 는 `using (true)` 라
-- 학생·학부모 토큰으로 **공지 본문까지 고칠 수 있습니다.** 임시로만 둔 정책입니다.

drop policy if exists notices_auth_readmark on public.notices;
drop policy if exists notices_auth_readmark_ins on public.notices;

-- 확인 — notices 에는 teacher/self(읽기) 정책만 남아야 합니다
--   select policyname, cmd, roles from pg_policies
--    where schemaname='public' and tablename='notices' order by policyname;
--
-- 지운 뒤 확인할 것 (학부모 계정으로):
--   · 공지 배너가 뜨고, [닫기] 를 누르면 다시 열어도 그 공지가 안 뜬다
--   · 선생님 대시보드 공지 목록의 '읽음 N/M' 이 올라간다
--
-- 되돌리기 (문제가 생기면):
--   supabase/auth_step1_supp.sql 의 2) 블록을 다시 실행하세요.

-- 참고: 옛 readBy 기록은 notices 행에 그대로 둡니다(지우지 않습니다).
-- 앱이 옛 readBy 와 새 messages 기록을 **둘 다** 읽어 합치므로 지금까지의 읽음 표시가 유지됩니다.
