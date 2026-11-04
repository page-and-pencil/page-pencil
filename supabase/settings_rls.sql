-- Page & Pencil: settings 테이블 잠금 (2026-07-27 QA)
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- 효과: 익명(anon) 키로는 화이트리스트 키만 읽기/쓰기 가능 — elevenlabs 등 민감 값 차단
alter table settings enable row level security;

drop policy if exists settings_anon_read on settings;
create policy settings_anon_read on settings for select to anon
  using (key in ('pw','acct','cloud','kakao','lastBackup','cmtChips','gbooks_key',
                 'jgPrepDays','vocabPassPct','bmThresholds','paperMix'));

drop policy if exists settings_anon_write on settings;
create policy settings_anon_write on settings for all to anon
  using (key in ('pw','acct','cloud','kakao','lastBackup','cmtChips',
                 'jgPrepDays','vocabPassPct','bmThresholds','paperMix'))
  with check (key in ('pw','acct','cloud','kakao','lastBackup','cmtChips',
                      'jgPrepDays','vocabPassPct','bmThresholds','paperMix'));
-- 참고: elevenlabs 키는 차단 대상이나, 현재 음원 생성이 브라우저 직호출 구조라
-- 차단 시 음원 생성이 멈춥니다. 음원 작업이 없는 평시에 적용하고,
-- 음원 작업 시에는 키를 설정 화면에 임시 입력(로컬 보관)해 쓰세요.

-- ── 2026-11-04 확인 ──────────────────────────────────────────
-- 1) Claude 키: 서버 시크릿 ANTHROPIC_API_KEY 가 이미 설정돼 있습니다.
--    (claude-proxy 에 키 없이 요청하면 Anthropic 이 응답 — 프록시가 서버 키를 씁니다.)
--    그래서 settings 의 apikey 행은 AI 동작에 더 이상 필요하지 않습니다.
--    앱도 로컬 키가 없으면 프록시에 키가 있는지 한 번 확인하고 AI 를 그대로 켭니다
--    (db.js 의 ppProbeAiProxy — 토큰을 쓰지 않는 확인입니다).
--    따라서 이 파일을 적용해도 AI 코멘트·단어 뜻 조회·워크시트 스튜디오는 계속 돕니다.
--
-- 2) 적용 뒤 settings 의 apikey 행은 지워도 됩니다 (공개 저장소의 anon 키로 읽히던 값):
--      delete from settings where key = 'apikey';
--    지우기 전에 Supabase 시크릿이 살아 있는지 확인하세요:
--      앱 설정 화면의 API Key 점이 '● 서버 키 사용 중' 으로 보이면 됩니다.
--
-- 3) elevenlabs 키는 여전히 화이트리스트에 없습니다 — 음원 생성이 브라우저 직호출이라
--    차단하면 멈춥니다. 위 주석대로 음원 작업 때만 설정 화면에 임시 입력해 쓰세요.
--
-- 4) 이 파일은 settings 테이블만 다룹니다. students·lessons·tests·readings·logs·
--    notices·monthly_reports 는 RLS 자체가 꺼져 있어 anon 키로 전부 읽고 쓸 수 있습니다.
--    RLS 를 켜도 지금 구조(정적 페이지 + anon 키 + PIN 로그인)에서는 anon 에게
--    열어 주는 정책을 달아야 하므로 실질적인 보호가 되지 않습니다.
--    제대로 막으려면 Supabase 인증 도입 또는 엣지 함수 경유가 필요하며, 별도 안건입니다.
