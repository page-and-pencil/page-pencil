# 공개 키로 읽히는 것들 — 현황과 정리 계획

작성 2026-11-07. **값(키·비밀번호)은 이 문서 어디에도 적지 않습니다. 있음/없음과 키 이름만.**
이 문서의 SQL·코드는 **원장님이 실행**합니다. 이 저장소에서는 파일만 만들었습니다.

---

## 0. 먼저 할 일 (원장님)

1. Anthropic 콘솔에서 'page and pencil' 키 **새로 발급 → 옛 키 폐기**
2. ElevenLabs 키 **새로 발급 → 옛 키 폐기**
3. 선생님 비밀번호 변경
4. 새 키는 **앱 설정 화면에 넣지 않습니다.** 아래 4번 순서대로 서버 시크릿에만 넣습니다.

지금 공개된 anon 키로 `settings` 를 읽으면 그 값들이 그대로 나옵니다. 키를 바꾸기 전에는
아래 작업을 아무리 해도 이미 유출된 키는 살아 있습니다. **폐기가 먼저입니다.**

---

## 1. 테이블별 anon 권한

Supabase 커넥터가 지금 정책 조회를 거부해(권한 오류) 정책 SQL 을 직접 읽지 못했습니다.
대신 **확인된 사실**로만 적습니다. 쓰기 시험은 하지 않았습니다.

- 2026-11-04 Supabase security advisor: **RLS 가 꺼진 테이블 8개** —
  `students`, `lessons`, `tests`, `readings`, `logs`, `notices`, `settings`, `monthly_reports`
- RLS 가 꺼진 테이블은 PostgREST 를 통해 anon 역할의 테이블 권한을 그대로 따릅니다.
- **앱이 매일 anon 키로 그 테이블들에 쓰고 있습니다**(supaUpsert/supaDelete). 즉 쓰기가 됩니다 —
  시험해 볼 필요 없이 앱 동작 자체가 증거입니다.

| 테이블 | select | insert/update | delete | 근거 |
|---|---|---|---|---|
| students | ○ | ○ | ○ | RLS off(advisor) · 앱이 anon 으로 저장·휴지통 처리 |
| lessons | ○ | ○ | ○ | 〃 |
| tests | ○ | ○ | ○ | 〃 |
| readings | ○ | ○ | ○ | 〃 |
| logs | ○ | ○ | ○ | 〃 |
| notices | ○ | ○ | ○ | 〃 · supaDelete 사용 |
| settings | ○ | ○ | ○ | 〃 · **apikey·elevenlabs·pw 가 여기 있음** |
| monthly_reports | ○ | ○ | ○ | 〃 |
| assignments · homeworks · textbooks · messages · vocab_cards · global_textbooks · classes · exam_schedules · counsels · worksheets | ○ | ○ | ○ | RLS 를 켰더라도 anon 에게 열어 주는 정책이 있어야 앱이 도는데, 실제로 돌고 있음 |

**요약: 지금은 anon 키 하나로 모든 테이블을 읽고 쓰고 지울 수 있습니다.**
anon 키는 `js/db.js` 에 들어 있고 그 파일은 공개 저장소에 있습니다.

---

## 2. 비밀값 위치 (값은 적지 않음)

| 키 이름 | 지금 어디에 | 옮길 곳 |
|---|---|---|
| Anthropic API 키 (`settings.apikey`) | settings 행 · 브라우저 localStorage | **Edge Function 시크릿 `ANTHROPIC_API_KEY` 만** |
| ElevenLabs 키 (`settings.elevenlabs`) | settings 행 · localStorage | **시크릿 `ELEVENLABS_API_KEY`** + 서버 함수 경유 |
| 선생님 비밀번호 (`settings.pw`) | settings 행 (64자 해시) | 서버에서 비교하거나 Supabase Auth |
| Cloudinary (`settings.cloud`) | settings 행 | 그대로 — unsigned preset 이라 공개돼도 업로드 외 권한 없음 |
| 기준값 (`jgPrepDays`·`vocabPassPct`·`bmThresholds`·`paperMix`·`cmtChips`·`acct`·`kakao`) | settings 행 | 그대로 (비밀이 아님, 계속 읽혀야 함) |

확인된 것: `callClaudeProxy` 는 이미 서버 시크릿을 우선 씁니다(2026-11-04 확인 — 클라이언트 키 없이도
AI 가 작동). 즉 **`settings.apikey` 는 이미 없어도 되는 값**입니다.
ElevenLabs 는 다릅니다 — `js/db.js:718,761` 이 브라우저에서 `api.elevenlabs.io` 를 직접 부릅니다.
**키를 지우면 음원 생성이 멈춥니다.** 서버 함수(`tts-proxy`)를 먼저 만들어야 합니다.

---

## 3. 만들 파일

| 파일 | 하는 일 | 상태 |
|---|---|---|
| `supabase/settings_rls.sql` | settings 를 화이트리스트로 잠금 (apikey·elevenlabs·pw 차단) | 이미 있음 — ElevenLabs 서버화 뒤에 적용 |
| `supabase/settings_drop_secrets.sql` | settings 에서 apikey·elevenlabs 행 삭제 | **이번에 추가** |
| `supabase/rls_student_privacy.sql` | students 등 개인정보 테이블 RLS 설계 (초안·적용 금지) | **이번에 추가(주석 위주)** |
| `supabase/functions/tts-proxy/` | ElevenLabs 를 서버에서 부르는 함수 | 다음 단계 |

---

## 4. 실행 순서 (앱이 끊기지 않게)

```
① Anthropic·ElevenLabs 키 새로 발급, 옛 키 폐기          (원장님)
② Supabase → Edge Functions → Secrets 에
   ANTHROPIC_API_KEY 등록(이미 있으면 새 값으로 교체)      (원장님)
③ 앱 설정 화면에서 Claude 키 칸을 비우고 저장 →
   점이 '● 서버 키 사용 중' 으로 바뀌는지 확인              (원장님, 1분)
④ supabase/settings_drop_secrets.sql 의 apikey 줄만 실행    (원장님)
⑤ 앱에서 AI 코멘트 한 번 눌러 작동 확인                     (원장님)
───── 여기까지 하면 Anthropic 키는 더 이상 공개되지 않습니다 ─────
⑥ ElevenLabs: tts-proxy 함수 작성·배포 → 앱을 서버 경유로 바꿈 → 키 행 삭제
⑦ settings_rls.sql 적용 (화이트리스트 잠금)
⑧ pw·students 는 5번 참고 — 별도 과제
```

③④⑤ 사이에 AI 가 잠깐 멈춰도 수업 기록·숙제는 그대로 돌아갑니다.

---

## 5. claude-proxy 남용 방지

지금은 anon 키만 있으면 누구나 부를 수 있습니다(= 원장님 Anthropic 요금으로 남이 쓸 수 있음).
현실적인 순서:

1. **모델·max_tokens 상한** — 함수에서 허용 모델 목록과 max_tokens 상한을 강제. 코드 몇 줄, 위험 없음. **먼저 이것**
2. **요청 수 제한** — IP 또는 anon 키 기준 분당/일별 상한. Supabase Edge 에서 메모리 카운터로 간단히. 중간
3. **선생님 세션 확인** — 제대로 하려면 Supabase Auth 가 필요(지금은 PIN 을 브라우저에서 비교). 8번 과제와 묶임

---

## 6. 학생 개인정보 (students 의 PIN·학부모 연락처)

**지금 구조로는 RLS 를 켜도 막을 수 없습니다.** 학생·학부모가 이름+PIN 으로 로그인하는데,
그 비교를 브라우저가 합니다. 브라우저가 비교하려면 students 를 읽을 수 있어야 하고,
읽을 수 있으면 anon 키를 가진 누구나 읽을 수 있습니다.

제대로 막으려면 **로그인을 서버로 옮겨야** 합니다.

```
A안 (작음·빠름)  로그인 전용 Edge Function
   · login(name, pin) → 맞으면 그 학생 데이터만 담은 토큰/세션 반환
   · students 는 anon select 금지, 함수(service_role)만 읽음
   · 앱은 토큰으로 자기 데이터만 요청
   작업량: 함수 1개 + 로그인 흐름 수정 + 각 테이블 RLS 정책 → 2~3일
   한계: 토큰을 직접 다뤄야 하고, 선생님 앱은 여전히 anon 으로 전부 읽음

B안 (제대로)   Supabase Auth 도입
   · 선생님 계정 1개 + 학생/학부모 계정(또는 매직링크·PIN 교환)
   · RLS 를 auth.uid() 기준으로 — 학생은 자기 행만, 선생님은 전부
   작업량: 로그인·세션·정책 전면 수정 → 1~2주
   효과: 키·개인정보·claude-proxy 남용이 한 번에 정리됨
```

**권고**: ①~⑤(키 정리)를 먼저 끝내고, 학생 개인정보는 B안을 별도 과제로 잡으시는 게 맞습니다.
A안은 중간 상태라 나중에 B안으로 갈 때 두 번 고치게 됩니다.

---

## 7. 지금 당장 줄어드는 위험

②~⑤만 해도 **Anthropic 키 유출은 끝납니다**(가장 돈이 나가는 구멍).
⑥⑦로 ElevenLabs·비밀번호가 정리되고, 남는 것은 학생 개인정보 하나입니다.
