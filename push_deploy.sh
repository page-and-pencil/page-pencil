#!/usr/bin/env bash
# Page & Pencil — 푸시 알림 서버 설정 자동 적용
# 쓰는 방법: SUPABASE_TOKEN_LOCAL.txt 에 Supabase 액세스 토큰 한 줄을 넣고 이 스크립트를 실행
# 토큰은 화면에 출력하지 않고, 커밋되지 않는 파일에서만 읽습니다.
set -u
REF=pznpcewwdsbxwibpnapn
TOKFILE=SUPABASE_TOKEN_LOCAL.txt
VAPFILE=VAPID_KEYS_LOCAL.txt

[ -f "$TOKFILE" ] || { echo "토큰 파일 없음: $TOKFILE"; exit 1; }
[ -f "$VAPFILE" ] || { echo "VAPID 파일 없음: $VAPFILE"; exit 1; }
export SUPABASE_ACCESS_TOKEN="$(tr -d " 
" < "$TOKFILE")"
[ -n "$SUPABASE_ACCESS_TOKEN" ] || { echo "토큰이 비어 있음"; exit 1; }
echo "토큰 길이: ${#SUPABASE_ACCESS_TOKEN}자 (내용은 출력하지 않음)"

# VAPID 값을 안내 파일에서 뽑아 임시 env 파일로 (명령줄에 비밀값을 노출하지 않으려고 --env-file 사용)
ENVF="$(mktemp)"
python - "$VAPFILE" "$ENVF" <<PYEOF
import io,re,sys
s=io.open(sys.argv[1],encoding="utf-8").read()
jwk=re.search(r'(\{"kty".*?\})',s,re.S).group(1).strip()
pub=re.search(r"^\s*(B[A-Za-z0-9_-]{80,})\s*$",s,re.M).group(1).strip()
subj=re.search(r"(mailto:[^\s]+)",s).group(1).strip()
io.open(sys.argv[2],"w",encoding="utf-8",newline="
").write(
  "VAPID_PRIVATE_JWK="+jwk+"
VAPID_PUBLIC="+pub+"
VAPID_SUBJECT="+subj+"
")
print("env 파일 준비: 3개 항목 (JWK %d자, PUB %d자)"%(len(jwk),len(pub)))
PYEOF
[ -s "$ENVF" ] || { echo "env 파일 생성 실패"; exit 1; }

echo; echo "── 1) 시크릿 등록 ──"
npx --yes supabase@latest secrets set --project-ref "$REF" --env-file "$ENVF" 2>&1 | tail -8
rm -f "$ENVF"

echo; echo "── 2) 함수 배포 (JWT 검증 켠 상태) ──"
npx --yes supabase@latest functions deploy push-hw --project-ref "$REF" 2>&1 | tail -12

echo; echo "── 3) 등록된 시크릿 목록 (이름만) ──"
npx --yes supabase@latest secrets list --project-ref "$REF" 2>&1 | tail -12

echo; echo "── 4) 함수 목록 ──"
npx --yes supabase@latest functions list --project-ref "$REF" 2>&1 | tail -12
