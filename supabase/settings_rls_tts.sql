-- ─────────────────────────────────────────────────────────────────────
-- settings 화이트리스트에 ttsAutoMax 추가
--
-- ttsAutoMax : 학생 화면에서 본문 음성을 '자동 생성'할 글자 수 상한 (기본 600, 코드에 있음)
--              학생(anon)이 읽어야 하므로 화이트리스트에 넣는다.
--              이 값을 올려도 서버(tts-proxy)의 월 누적 상한은 그대로 막는다.
--
-- ttsMonthCap 은 넣지 않는다 — 서버가 서비스 롤로 읽으므로 화이트리스트가 필요 없고,
-- anon 이 쓸 수 있게 두면 상한을 올려 버릴 수 있다.
-- (바꾸려면 Supabase 표 편집기에서 settings 의 ttsMonthCap 행을 고치거나,
--  Edge Function 시크릿 TTS_MONTH_CAP 을 쓰면 된다 — 시크릿이 우선이다.)
--
-- 실행: Supabase SQL Editor 에서 이 파일 전체를 한 번 실행 (Aside)
--       settings_rls.sql 을 이미 적용한 뒤여야 한다.
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists settings_anon_read on settings;
create policy settings_anon_read on settings for select to anon
  using (key in ('pw','acct','cloud','kakao','lastBackup','cmtChips',
                 'jgPrepDays','vocabPassPct','bmThresholds','paperMix',
                 'ttsAutoMax'));

drop policy if exists settings_anon_write on settings;
create policy settings_anon_write on settings for all to anon
  using (key in ('pw','acct','cloud','kakao','lastBackup','cmtChips',
                 'jgPrepDays','vocabPassPct','bmThresholds','paperMix',
                 'ttsAutoMax'))
  with check (key in ('pw','acct','cloud','kakao','lastBackup','cmtChips',
                      'jgPrepDays','vocabPassPct','bmThresholds','paperMix',
                      'ttsAutoMax'));

-- 확인 (anon 키로 읽었을 때 위 11개만 나와야 합니다)
--   select key from settings order by key;
--
-- 되돌리기: supabase/settings_rls.sql 을 다시 실행하면 ttsAutoMax 가 빠집니다.
