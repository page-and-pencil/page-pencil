-- Page & Pencil — 3단계 되돌리기 (공개 anon 권한 다시 열기)
-- 실행: auth_step3_close_anon.sql 을 적용한 뒤 무언가 비어 보일 때, 바로 이 파일을 Run.
-- 실행 즉시 옛 상태(공개 키로 전부 읽고 쓰기)로 돌아갑니다.
-- 앱도 PP_AUTH_FALLBACK = true 로 되돌려 배포하면 로그인까지 완전히 원래대로입니다.

grant select, insert, update, delete on
  public.students, public.lessons, public.tests, public.readings, public.logs,
  public.notices, public.homeworks, public.assignments, public.textbooks, public.messages,
  public.vocab_cards, public.global_textbooks, public.classes, public.monthly_reports,
  public.exam_schedules, public.counsels
to anon;

-- 있으면 같이 (없으면 이 줄만 빼고 실행)
-- grant select, insert, update, delete on public.worksheets, public.library, public.tts_cache to anon;

grant select on public.students_safe   to anon;
grant select on public.students_parent to anon;

-- anon 전부 허용 정책 다시 만들기
do $do$
declare
  t text;
  all_t text[] := array[
    'students','lessons','tests','readings','logs','notices','homeworks','assignments',
    'textbooks','messages','vocab_cards','global_textbooks','classes','monthly_reports',
    'exam_schedules','counsels','worksheets','library'
  ];
begin
  foreach t in array all_t loop
    if not exists (select 1 from information_schema.tables
                   where table_schema='public' and table_name=t) then
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', t || '_anon_all', t);
    execute format('create policy %I on public.%I for all to anon using (true) with check (true)',
                   t || '_anon_all', t);
  end loop;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tts_cache') then
    execute 'drop policy if exists tts_anon_all on public.tts_cache';
    execute 'create policy tts_anon_all on public.tts_cache for all to anon using (true) with check (true)';
  end if;
end
$do$;

-- 그래도 안 되면 RLS 자체를 끕니다 (정책과 무관하게 전부 열림 — 옛 상태와 같음)
-- alter table public.students        disable row level security;
-- alter table public.lessons         disable row level security;
-- alter table public.tests           disable row level security;
-- alter table public.readings        disable row level security;
-- alter table public.logs            disable row level security;
-- alter table public.notices         disable row level security;
-- alter table public.homeworks       disable row level security;
-- alter table public.assignments     disable row level security;
-- alter table public.textbooks       disable row level security;
-- alter table public.messages        disable row level security;
-- alter table public.vocab_cards     disable row level security;
-- alter table public.global_textbooks disable row level security;
-- alter table public.classes         disable row level security;
-- alter table public.monthly_reports disable row level security;
-- alter table public.exam_schedules  disable row level security;
-- alter table public.counsels        disable row level security;
