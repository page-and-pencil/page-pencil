-- Page & Pencil — Auth 전환 3단계: 공개(anon) 권한 닫기
-- ⚠️ **아직 실행하지 마세요.** 아래 조건이 전부 참일 때만 실행합니다.
--
--   ① supabase/auth_step1.sql 을 실행해 정책이 붙어 있다
--   ② login 함수가 배포돼 있고, 학생·학부모·선생님 로그인이 모두 서버로 들어간다
--   ③ 앱에서 PP_AUTH_FALLBACK = false 로 바꿔 배포했고, 그 상태로 **1~2일** 문제가 없었다
--   ④ 옛 ?pin= QR 링크를 받은 학부모에게 새 링크(?t=)를 다시 보냈다
--
-- 이 파일을 실행하면 공개 anon 키로는 아무 표도 읽을 수 없습니다.
-- 문제가 생기면 같은 폴더의 auth_step3_rollback.sql 을 실행하면 **즉시** 원래대로 돌아갑니다.

-- ── 1. anon 전부 허용 정책 삭제 ──────────────────────────────────────────
-- auth_step1.sql 이 만든 <표>_anon_all 정책만 지웁니다. RLS 는 켜진 채로 두므로
-- 정책이 없는 anon 은 아무 행도 보지 못합니다.
do $do$
declare
  t text;
  all_t text[] := array[
    'students','lessons','tests','readings','logs','notices','homeworks','assignments',
    'textbooks','messages','vocab_cards','global_textbooks','classes','monthly_reports',
    'exam_schedules','counsels','worksheets','library','tts_cache'
  ];
begin
  foreach t in array all_t loop
    if not exists (select 1 from information_schema.tables
                   where table_schema='public' and table_name=t) then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_all', t);
  end loop;
  -- tts_cache 는 이름이 다르다
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tts_cache') then
    execute 'drop policy if exists tts_anon_all on public.tts_cache';
  end if;
end
$do$;

-- ── 2. 테이블 권한 자체도 회수 ───────────────────────────────────────────
-- 정책만 지워도 막히지만, 권한까지 회수하면 '정책을 잘못 달아 다시 열리는' 사고를 막습니다.
revoke select, insert, update, delete on
  public.students, public.lessons, public.tests, public.readings, public.logs,
  public.notices, public.homeworks, public.assignments, public.textbooks, public.messages,
  public.vocab_cards, public.global_textbooks, public.classes, public.monthly_reports,
  public.exam_schedules, public.counsels
from anon;

-- 있으면 같이 (없으면 이 줄에서 오류가 납니다 — 그 줄만 빼고 실행하세요)
-- revoke select, insert, update, delete on public.worksheets, public.library, public.tts_cache from anon;

-- 안전 뷰는 토큰이 있는 사람만
revoke select on public.students_safe   from anon;
revoke select on public.students_parent from anon;
grant  select on public.students_safe   to authenticated;
grant  select on public.students_parent to authenticated;

-- ── 3. 확인 ──────────────────────────────────────────────────────────────
-- 공개 키로 읽히는지 직접 확인 (브라우저 주소창에 넣고 빈 배열이 나오면 성공):
--   https://<프로젝트>.supabase.co/rest/v1/students?select=id&limit=1&apikey=<공개 anon 키>
-- 앱에서:
--   · 선생님 로그인 → 학생 목록·수업·교재가 보이는지
--   · 학생 로그인(PIN) → 숙제·단어가 보이는지
--   · 학부모 로그인 → 수업 기록·점수가 보이는지
--   · 로그인하지 않은 첫 화면이 그대로 뜨는지(여기서 데이터를 읽으면 안 됩니다)
--
-- 하나라도 비어 보이면 **바로** auth_step3_rollback.sql 을 실행하세요.
