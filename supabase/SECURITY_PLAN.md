# 공개 키로 읽히는 것들 — 현황과 남은 순서

최초 2026-11-04 · 갱신 2026-11-08.
**값(키·비밀번호·토큰)은 이 문서 어디에도 적지 않습니다. 있음/없음과 키 이름만.**
이 문서의 SQL·배포 명령은 **원장님이 실행**합니다. 저장소에는 파일만 만들어 두었습니다.

---

## 0. 지금까지 끝난 것

| 날짜 | 한 일 | 결과 |
|---|---|---|
| 11/07 09:50 | `settings` 의 `apikey` 행 삭제 (Aside) | Anthropic 키는 서버 시크릿 `ANTHROPIC_API_KEY` 만. 앱은 '● 서버 키 사용 중' |
| 11/07 10:05 | ElevenLabs 를 새 계정·새 키로 교체 (Aside) | TTS 권한만 · 월 8,000 크레딧 상한 · 유출 감지 시 자동 비활성화. 시크릿 `ELEVENLABS_API_KEY` 등록 |
| 11/07 | `tts-proxy` 신규 · `claude-proxy` 강화 **배포 완료** (Aside) | 브라우저가 ElevenLabs·Anthropic 을 직접 부르지 않음 |
| 11/07 | `settings` 의 `elevenlabs` · `gbooks_key` 행 삭제 (Aside) | **공개 anon 키로 읽히는 비밀 키는 0개** |
| 11/07 | `settings_rls.sql` 적용 (Aside) | anon 은 `acct`·`bmThresholds`·`cloud`·`pw`·`lastBackup`·`jgPrepDays`·`vocabPassPct` 만 읽음 |
| 11/07 | 시크릿 `CLAUDE_ALLOWED_ORIGINS`·`TTS_ALLOWED_ORIGINS` 등록 (Aside) | `https://page-and-pencil.github.io`, `http://127.0.0.1:5500`, `http://localhost:5500` |
| 11/08 | 로그인 서버 이전 **1·2단계 파일** 작성 | `login` 함수 · `auth_step1.sql` · 앱 병행 코드 — 배포·실행은 `AUTH_RUNBOOK.md` |

**키 정리는 끝났습니다.** 남은 것은 `settings.pw`(선생님 비밀번호 해시)와
**학생 개인정보(students 의 PIN·학부모 연락처)** 뿐이고, 둘 다 로그인 서버 이전 과제입니다.
→ **`supabase/AUTH_RUNBOOK.md`** 순서대로 진행합니다.

---

## 1. 지금 상태 요약 (2026-11-08)

- 공개 anon 키가 `js/db.js` 에 있고 그 파일은 공개 저장소에 있습니다. **그대로입니다.**
- `settings` 에 남은 비밀값은 **`pw`(선생님 비밀번호 해시) 하나**입니다.
  Anthropic·ElevenLabs 키는 서버 시크릿에만 있고, `settings_rls.sql` 로 화이트리스트도 걸려 있습니다.
- **아직 열려 있는 것**: `students`·`lessons`·`tests`·`readings`·`logs`·`notices`·
  `monthly_reports` 등 표 전체가 anon 키로 읽고 쓰고 지울 수 있습니다.
  `students` 에는 **학생 이름·PIN·학부모 연락처·수강료**가 들어 있습니다 → 6번.
- `claude-proxy`·`tts-proxy` 는 **출처·모델·토큰·크기·IP 상한**이 걸려 배포돼 있습니다.

---

## 2. 끝난 순서 (11/07 — 기록용)

아래 ①~⑧ 은 **전부 완료됐습니다.** 남은 일은 3부(로그인 서버 이전)뿐이고,
그 순서는 **`supabase/AUTH_RUNBOOK.md`** 에 따로 적었습니다.

```
① 시크릿 확인                                                    (원장님, 1분)
   Supabase → Edge Functions → Secrets 에 아래 두 개가 있는지
     ANTHROPIC_API_KEY      (있음 — 11/07)
     ELEVENLABS_API_KEY     (있음 — 11/07)

② 함수 배포                                                      (원장님, 2분)
   supabase functions deploy tts-proxy
   supabase functions deploy claude-proxy
   ※ 저장소에 코드만 있습니다. 이 명령은 제가 실행하지 않았습니다.

③ 앱 배포 확인                                                    (이미 push 됨)
   라이브 index.html 의 ?v= 가 새 값인지 확인
   (새로고침이 안 먹으면 주소 뒤 ?x=1 을 붙여 한 번 열어 보세요)

④ 음성 확인                                                      (원장님, 2분)
   설정 탭을 엽니다 → ElevenLabs 점이 '● 사용 중 (서버 경유)' 로 바뀌는지
   [테스트 재생] → 결과 아래에 '경로: 서버 경유(tts-proxy)' 라고 나오면 성공
   → '경로: 이 기기에 저장된 키' 로 나오면 함수 배포나 시크릿을 다시 확인하세요
   (설정 행의 키가 아직 살아 있어서, 서버가 안 되면 자동으로 그 키로 돌아갑니다
    — 이 단계에서 음성이 끊기는 일은 없습니다. 학생·학부모 화면은 ⑥ 뒤에
    서버 경유로 바뀝니다.)

⑤ AI 확인                                                        (원장님, 1분)
   수업 기록에서 AI 코멘트 한 번 · 워크시트 스튜디오에서 한 문제 생성
   → 되면 claude-proxy 강화판이 정상

⑥ ElevenLabs 키 행 삭제                                           (원장님, 1분)
   supabase/settings_drop_secrets.sql 의 2) 줄만 실행
   → 앱을 새로 열면 점이 '● 서버 키 사용 중' 이 되고 키 입력칸이 사라집니다
   → 이때부터 학생·학부모 화면의 음성도 서버 경유로 생성됩니다
   → 목소리는 그대로입니다 (기본 목소리 Matilda 를 코드에 박아 뒀습니다)
   → 학생 화면에서 ⑴ 단어 발음 ⑵ 원서 본문 듣기 를 한 번씩 확인해 주세요
   ───── 여기까지 하면 공개된 키는 0개입니다 ─────

⑦ 쓰이지 않는 행 정리 (선택)
   settings_drop_secrets.sql 의 3) 줄 — gbooks_key

⑧ settings 잠금                                                  (원장님, 1분)
   supabase/settings_rls.sql 실행 → 그 뒤 앱을 한 번 열어
   결제 안내·기준값·코멘트 칩이 그대로 나오는지 확인

⑨ 선생님 비밀번호·학생 개인정보                                     → 6번(별도 과제)
```

④⑤ 가 안 되면 ⑥ 을 하지 마세요. `settings` 의 `elevenlabs` 행이 남아 있는 동안은
앱이 그 키로 직접 생성하므로 음성이 멈추지 않습니다(프록시 실패 시 자동 폴백).

---

## 3. 비밀값 위치 (값은 적지 않음)

| 키 이름 | 지금 어디에 | 옮길 곳 |
|---|---|---|
| Anthropic API 키 | **시크릿 `ANTHROPIC_API_KEY` 만** | 끝 |
| ElevenLabs 키 (`settings.elevenlabs`) | 시크릿 `ELEVENLABS_API_KEY` + settings 행(아직) | ⑥ 으로 settings 행 삭제 |
| 선생님 비밀번호 (`settings.pw`) | settings 행 (64자 해시) | 서버 비교 또는 Supabase Auth (6번) |
| Cloudinary (`settings.cloud`) | settings 행 | 그대로 — unsigned preset |
| Google Books (`settings.gbooks_key`) | settings 행 | **사용처 없음 → 삭제** |
| 기준값 (`jgPrepDays`·`vocabPassPct`·`bmThresholds`·`cmtChips`·`acct`·`kakao`·`lastBackup`·`paperMix`) | settings 행 | 그대로 (비밀이 아니고 계속 읽혀야 함) |

---

## 4. 파일 목록

| 파일 | 하는 일 | 상태 |
|---|---|---|
| `supabase/functions/tts-proxy/index.ts` | ElevenLabs 를 서버에서 부른다 (글자 수·목소리·출처·IP 상한) | **이번에 추가 — 배포 필요** |
| `supabase/functions/claude-proxy/index.ts` | 허용 모델·max_tokens·본문 크기·출처·IP 상한, 클라이언트 키 무시 | **이번에 갱신 — 배포 필요** |
| `supabase/settings_rls.sql` | settings 화이트리스트 잠금 (apikey·elevenlabs·gbooks_key 차단) | ⑧ 에서 실행 |
| `supabase/settings_drop_secrets.sql` | 비밀값 행 삭제 (순서 주석 포함) | ⑥⑦ 에서 실행 |
| `supabase/AUTH_PLAN.md` | Supabase Auth 전환 설계서 (왜·무엇을) | 11/07 |
| `supabase/AUTH_RUNBOOK.md` | **그대로 따라 하는 순서** (배포·SQL·확인·되돌리기) | **11/08 추가 — 여기부터 보세요** |
| `supabase/functions/login/index.ts` | 학생·학부모 로그인(이름+PIN / QR 토큰)을 서버에서 | **11/08 추가 — 배포 필요** |
| `supabase/auth_step1.sql` | students_safe 뷰 + 토큰용 정책 (anon 은 건드리지 않음) | **11/08 추가 — 실행 필요** |
| `supabase/auth_teacher_setup.md` | 선생님 Auth 계정 만들기 | **11/08 추가** |
| `supabase/auth_step3_close_anon.sql` · `auth_step3_rollback.sql` | 공개 권한 닫기 / 되돌리기 | **11/08 추가 — 아직 실행 금지** |
| `supabase/auth_rls_draft.sql` | 맨 처음 초안 (auth_step1.sql 로 대체됨 — 참고용) | 11/07 |

### 함수에 넣을 수 있는 선택 시크릿

값이 없으면 코드의 기본값이 쓰입니다. 평소에는 건드릴 필요가 없습니다.

```
TTS_ALLOWED_ORIGINS      기본 https://page-and-pencil.github.io
TTS_ALLOW_NO_ORIGIN      '1' 이면 Origin 없는 요청 허용 (로컬 file:// 시험용)
TTS_ALLOWED_VOICES       기본 Matilda, Sarah 두 개
TTS_MAX_PER_MIN          기본 40
TTS_MAX_CHARS_PER_DAY    기본 20000
CLAUDE_ALLOWED_ORIGINS   기본 https://page-and-pencil.github.io
CLAUDE_ALLOW_NO_ORIGIN   '1' 이면 Origin 없는 요청 허용
CLAUDE_ALLOWED_MODELS    기본 haiku-4-5 / sonnet-4-6 / opus-4-8
CLAUDE_MAX_TOKENS        기본 16000
CLAUDE_MAX_BODY_BYTES    기본 12MB (워크시트 스튜디오의 이미지 가져오기)
CLAUDE_MAX_PER_MIN       기본 30 · CLAUDE_MAX_PER_DAY 기본 800
```

**주의**: 새 모델로 바꾸면 `CLAUDE_ALLOWED_MODELS` 에 그 이름을 넣거나
함수 코드의 `DEFAULT_MODELS` 를 고쳐야 합니다. 안 하면 "허용되지 않은 model" 로 막힙니다.

---

## 5. claude-proxy·tts-proxy 남용 방지 — 무엇이 막히고 무엇이 안 막히나

**막히는 것**
- 다른 사이트에 올린 페이지에서 부르기 (Origin 확인)
- 비싼 모델·큰 max_tokens 로 바꿔 부르기 (모델 목록·토큰 상한)
- 큰 본문 밀어 넣기 (크기 상한)
- 한 사람이 몰아서 쓰기 (IP 별 분·일 상한)
- 모르는 목소리로 음성 만들기 (voiceId 목록)

**아직 막히지 않는 것**
- anon 키를 들고 **정상 범위 안에서** 부르는 것. 상한은 인스턴스 메모리라
  함수가 여러 개 떠 있으면 그만큼 느슨합니다.
- 제대로 막으려면 **선생님 세션 확인**이 필요하고, 그건 Supabase Auth 과제(6번)와 묶입니다.
- 현실적 방어선: ElevenLabs 새 키의 **월 8,000 크레딧 상한**과 Anthropic 콘솔의 사용량 한도.
  Anthropic 쪽에도 월 상한을 걸어 두시는 걸 권합니다(콘솔 → Limits).

---

## 6. 학생 개인정보 (students 의 PIN·학부모 연락처) — 별도 과제

**지금 구조로는 RLS 를 켜도 막을 수 없습니다.** 학생·학부모가 이름+PIN 으로 로그인하는데
그 비교를 브라우저가 합니다. 브라우저가 비교하려면 `students` 를 읽을 수 있어야 하고,
읽을 수 있으면 anon 키를 가진 누구나 읽을 수 있습니다.

설계서는 **`supabase/AUTH_PLAN.md`**, 실행 순서는 **`supabase/AUTH_RUNBOOK.md`** 입니다.
2026-11-08 에 **1·2단계 파일을 전부 만들었습니다**(앱은 서버 로그인을 먼저 시도하고
안 되면 지금 방식으로 들어가므로, 배포 전에도 그대로 돕니다).
(선생님 Auth 계정 1개 + 학생·학부모 로그인 함수, 테이블별 정책 초안, 바뀌는 코드 목록,
끊김 없이 옮기는 순서, 되돌리는 방법.) **아직 아무 기능도 켜지 않았습니다.**

권고: 위 ①~⑧(키·설정 정리)을 먼저 끝내고, 개인정보는 날짜를 따로 잡아 진행하세요.
