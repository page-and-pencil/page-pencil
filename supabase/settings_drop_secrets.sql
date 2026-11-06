-- settings 에서 비밀값 행 지우기
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고, 필요한 줄만 선택해서 Run
--
-- ⚠️ 순서를 지켜 주세요. SECURITY_PLAN.md 4번과 같습니다.
--    ① Anthropic·ElevenLabs 키를 새로 발급하고 옛 키를 폐기
--    ② Edge Functions → Secrets 에 ANTHROPIC_API_KEY 등록
--    ③ 앱 설정에서 Claude 키 칸을 비우고 저장 → 점이 '● 서버 키 사용 중' 인지 확인
--    ④ 아래 1번 줄 실행
--    ⑤ 앱에서 AI 코멘트를 한 번 눌러 작동 확인
--
-- 지우기 전에 무엇이 들어 있는지 '키 이름만' 확인 (값은 보지 않습니다)
select key, (value is not null) as has_value, updated_at
from settings order by key;

-- 1) Anthropic 키 — 서버 시크릿(ANTHROPIC_API_KEY)이 있으면 앱은 이 행 없이 돕니다.
--    callClaudeProxy 가 로컬 키가 없을 때 'proxy' 표식으로 서버 키를 쓰도록 2026-11-04 에 바꿔 뒀습니다.
-- delete from settings where key = 'apikey';

-- 2) ElevenLabs 키 — ⚠️ 아직 지우지 마세요.
--    js/db.js 가 브라우저에서 api.elevenlabs.io 를 직접 부릅니다(718·761행).
--    이 행을 지우면 원서 음원 생성이 바로 멈춥니다.
--    supabase/functions/tts-proxy 를 만들어 서버 경유로 바꾼 뒤에 실행하세요.
-- delete from settings where key = 'elevenlabs';

-- 3) 선생님 비밀번호 — 지우면 로그인이 막힙니다. 서버 비교 또는 Supabase Auth 로 옮긴 뒤에만.
--    (SECURITY_PLAN.md 6번)
-- delete from settings where key = 'pw';

-- 지운 뒤 확인
-- select key from settings order by key;
