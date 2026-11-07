-- Page & Pencil: settings 테이블 잠금 (2026-11-07 갱신)
-- ✅ 2026-11-07 적용 완료 (Aside). 아래는 기록·재적용용입니다.
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 효과: 공개(anon) 키로는 아래 화이트리스트 키만 읽기/쓰기 가능.
--       apikey·elevenlabs·gbooks_key 는 어느 목록에도 없으므로 **차단**됩니다.
--
-- ⚠️ 적용 순서 (SECURITY_PLAN.md 4번과 같습니다)
--    tts-proxy 를 배포해 음성이 서버 경유로 돌아간 뒤에 적용하세요.
--    브라우저가 ElevenLabs 를 직접 부르던 구조에서 이 파일을 적용하면 음원 생성이 멈춥니다.
--    (앱은 2026-11-07 부터 tts-proxy 를 먼저 쓰고, 없을 때만 설정 키로 직호출합니다.)
--
-- ── 코드가 쓰는 settings 키 (grep 결과, 2026-11-07) ─────────────────────
--  키            | 읽는 곳                              | 쓰는 곳              | 공개돼도 되나
--  pw            | DB.pw() · 선생님 로그인              | savePw               | ❌ 해시지만 공개 중 — 6번 과제
--  acct          | 학부모 결제 안내                      | saveAcct             | ⭕ 계좌 안내는 학부모에게 보여 주는 값
--  cloud         | DB.cld() · 업로드 preset             | saveCloudCfg         | ⭕ unsigned preset
--  kakao         | DB.kakao() · 학부모 문의             | saveKakaoCfg         | ⭕ 공개 연락 수단
--  cmtChips      | 코멘트 칩 목록                        | saveCmtChips         | ⭕
--  jgPrepDays    | ppJgPrepDays()                       | 설정 화면            | ⭕ 기준값
--  vocabPassPct  | ppVocabPassPct()                     | 설정 화면            | ⭕ 기준값
--  bmThresholds  | ppTh() · 홈 신호 기준                 | 설정 화면            | ⭕ 기준값
--  lastBackup    | 백업 알림(월 1회)                     | fullBackup           | ⭕ 날짜만
--  paperMix      | ppPaperMix() (_cache.settings)       | (아직 저장 경로 없음) | ⭕ 기준값 — 미래 대비로 열어 둠
--  elevenlabs    | elevenCfg()                          | saveElevenCfg        | ❌ 키 — tts-proxy 로 이전
--  apikey        | DB.api() (로컬 보관이 기본)           | (서버 저장 안 함)     | ❌ 키 — 행은 2026-11-07 삭제됨
--  gbooks_key    | **코드에 사용처 없음**                | 없음                 | ❌ 쓰이지 않는 행 — 삭제 권장
-- ───────────────────────────────────────────────────────────────────────

alter table settings enable row level security;

drop policy if exists settings_anon_read on settings;
create policy settings_anon_read on settings for select to anon
  using (key in ('pw','acct','cloud','kakao','lastBackup','cmtChips',
                 'jgPrepDays','vocabPassPct','bmThresholds','paperMix'));

drop policy if exists settings_anon_write on settings;
create policy settings_anon_write on settings for all to anon
  using (key in ('pw','acct','cloud','kakao','lastBackup','cmtChips',
                 'jgPrepDays','vocabPassPct','bmThresholds','paperMix'))
  with check (key in ('pw','acct','cloud','kakao','lastBackup','cmtChips',
                      'jgPrepDays','vocabPassPct','bmThresholds','paperMix'));

-- 적용 뒤 확인 (anon 키로 읽었을 때 위 10개만 나와야 합니다)
--   select key from settings order by key;

-- ── 메모 ───────────────────────────────────────────────────────────────
-- 1) apikey: 2026-11-07 Aside 가 행을 삭제했습니다. claude-proxy 가 서버 시크릿
--    ANTHROPIC_API_KEY 를 쓰고, 앱은 ppProbeAiProxy 로 '서버 키 있음'을 확인해 AI 를 켭니다.
--    위 목록에 없으니 다시 넣어도 anon 으로는 읽히지 않습니다.
--
-- 2) elevenlabs: tts-proxy 배포 뒤 settings_drop_secrets.sql 의 해당 줄로 행을 지우세요.
--    행을 지워도 목소리는 그대로입니다 — 기본 목소리를 Matilda 로 코드에 박아 뒀습니다
--    (tts_cache 키에 목소리가 들어가므로 기본값이 바뀌면 만들어 둔 음원을 못 씁니다).
--
-- 3) gbooks_key: 앱 코드 어디에서도 읽지 않습니다(2026-11-07 전체 grep). 지워도 됩니다:
--      delete from settings where key = 'gbooks_key';
--    나중에 Google Books 를 다시 쓸 일이 생기면 브라우저가 아니라 엣지 함수에서 부르세요.
--    (브라우저에 두면 지금처럼 anon 키로 누구나 읽어 원장님 할당량을 쓸 수 있습니다.)
--
-- 4) pw: 해시(64자)지만 공개 중입니다. 서버 비교 또는 Supabase Auth 로 옮기는 것이
--    근본 해결입니다 — supabase/AUTH_PLAN.md 참고. 그때까지는 이 목록에 남겨 둡니다
--    (지우면 선생님 로그인이 막힙니다).
--
-- 5) 이 파일은 settings 테이블만 다룹니다. students·lessons·tests·readings·logs·
--    notices·monthly_reports 는 RLS 자체가 꺼져 있어 anon 키로 전부 읽고 쓸 수 있습니다.
--    그쪽은 로그인을 서버로 옮겨야 막힙니다 — supabase/AUTH_PLAN.md (3부 설계).
