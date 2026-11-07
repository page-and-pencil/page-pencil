-- settings 에서 비밀값 행 지우기
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고, 필요한 줄만 선택해서 Run
--
-- 지우기 전에 무엇이 들어 있는지 '키 이름만' 확인 (값은 보지 않습니다)
select key, (value is not null) as has_value, updated_at
from settings order by key;

-- 1) Anthropic 키 — ✅ 2026-11-07 09:50 완료 (Aside)
--    settings 의 apikey 행이 삭제됐고, 앱 설정 화면은 '● 서버 키 사용 중' 입니다.
--    claude-proxy 가 시크릿 ANTHROPIC_API_KEY 를 씁니다. 다시 실행할 필요 없습니다.
-- delete from settings where key = 'apikey';

-- 2) ElevenLabs 키 — ✅ 2026-11-07 완료 (Aside). 다시 실행할 필요 없습니다.
--    (아래는 그때의 순서 기록입니다)
-- 2-옛) **tts-proxy 를 배포한 뒤에 실행**
--    순서: supabase functions deploy tts-proxy
--          → 앱 배포(?v= 올린 js) → 설정 화면 점이 '● 서버 키 사용 중' 인지 확인
--          → 단어 발음·본문 듣기를 한 번씩 재생해 소리가 나는지 확인
--          → 그 다음에 아래 줄 실행
--    시크릿 ELEVENLABS_API_KEY 는 2026-11-07 10:05 에 이미 등록돼 있습니다.
--    행을 지워도 목소리는 그대로입니다 (기본 목소리 Matilda 를 코드에 박아 뒀습니다).
-- delete from settings where key = 'elevenlabs';

-- 3) 쓰이지 않는 Google Books 키 — ✅ 2026-11-07 완료 (Aside).
-- delete from settings where key = 'gbooks_key';

-- 4) 선생님 비밀번호 — **아직 지우지 마세요.** 지우면 폴백 로그인이 막힙니다.
--    supabase/AUTH_RUNBOOK.md 7번(4단계)에서, 서버 로그인만으로 도는 것을 확인한 뒤에.
-- delete from settings where key = 'pw';

-- 지운 뒤 확인
-- select key from settings order by key;
