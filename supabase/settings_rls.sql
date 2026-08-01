-- Page & Pencil: settings 테이블 잠금 (2026-07-27 QA)
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- 효과: 익명(anon) 키로는 화이트리스트 키만 읽기/쓰기 가능 — elevenlabs 등 민감 값 차단
alter table settings enable row level security;

drop policy if exists settings_anon_read on settings;
create policy settings_anon_read on settings for select to anon
  using (key in ('pw','acct','cloud','kakao','lastBackup','cmtChips','gbooks_key'));

drop policy if exists settings_anon_write on settings;
create policy settings_anon_write on settings for all to anon
  using (key in ('pw','acct','cloud','kakao','lastBackup','cmtChips'))
  with check (key in ('pw','acct','cloud','kakao','lastBackup','cmtChips'));
-- 참고: elevenlabs 키는 차단 대상이나, 현재 음원 생성이 브라우저 직호출 구조라
-- 차단 시 음원 생성이 멈춥니다. 음원 작업이 없는 평시에 적용하고,
-- 음원 작업 시에는 키를 설정 화면에 임시 입력(로컬 보관)해 쓰세요.
