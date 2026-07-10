# 보안 강화 로드맵 (단계적)

현황: 정적 사이트(GitHub Pages, 공개 저장소) + Supabase anon 키가 소스에 포함.
→ 기술적으로 아는 사람이면 누구나 DB를 읽고 쓸 수 있는 구조. 아래 순서로 좁혀간다.

## 0단계 — 완료된 것
- ✅ 전체 백업: 앱 내 `fullBackup()`(백업·일괄 탭) + 대시보드 월 1회 알림.
  악의적 삭제·실수 대비 복구 지점 확보가 모든 보안의 전제.
- ✅ claude-proxy 서버 키 우선: 엣지 함수가 `ANTHROPIC_API_KEY` 시크릿을 우선 사용
  (`supabase/functions/claude-proxy/index.ts`). 시크릿 미설정 시 기존 방식 유지(하위 호환).

## 1단계 — 원장님이 Supabase 대시보드에서 5분 (코드 변경 불필요)
1. **Database → Backups**: 일일 자동 백업 활성 확인 (무료 플랜은 7일 보관).
2. **Claude API 키를 서버 시크릿으로 이전** (키 노출·크레딧 도용 방지):
   ```
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # supabase CLI, 프로젝트 링크 후
   supabase functions deploy claude-proxy
   ```
   배포 후 앱 설정의 apikey 값을 지워도 AI 기능이 동작하는지 확인 → 동작하면
   settings 테이블에서 apikey 행 삭제 (Claude에게 "설정에서 apikey 제거해줘"라고 요청).
   ※ 클라이언트 게이트(DB.api() 체크) 수정이 필요하므로 삭제 전에 Claude에게 요청할 것.

## 2단계 — 쓰기 제한 (Claude와 함께, 반나절)
목표: anon 키로는 **읽기만** 가능하게. 모든 쓰기(수업 저장·과제·삭제)는 엣지 함수 경유.
- 쓰기 엣지 함수 1개(`db-write`) 신설: service_role 키(시크릿)로 upsert/delete 수행,
  요청에 교사 세션 토큰(간단하게는 설정된 비밀 토큰) 요구.
- 클라이언트 `supaUpsert`/`supaDelete`를 함수 호출로 교체.
- 그 후 RLS 활성: `anon`은 SELECT만 허용.
- 효과: 외부인이 데이터를 파괴/변조할 수 없음 (읽기 노출은 3단계에서).

## 3단계 — 읽기 보호 (제대로, 1~2일)
목표: 학부모 전화번호 등 개인정보의 익명 읽기 차단.
- Supabase Auth 도입: 교사=이메일 로그인, 학생/학부모=PIN → 커스텀 JWT 발급(엣지 함수).
- RLS: 학생/학부모는 자기 sid 데이터만 SELECT, 교사 role은 전체.
- 학생/학부모 앱의 loadAllData를 sid 스코프 조회로 변경.

## 원칙
- 각 단계는 독립적으로 가치가 있고, 앞 단계 없이 다음 단계를 서두르지 않는다.
- 단계 전환 중에도 앱이 한 번도 멈추지 않도록 하위 호환을 유지한다 (0단계 proxy처럼).
