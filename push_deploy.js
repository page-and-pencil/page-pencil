// Page & Pencil — 푸시 알림 서버 설정 자동 적용
//
// 쓰는 방법
//   1) Supabase 대시보드 → 오른쪽 위 계정 → Access Tokens → Generate new token
//   2) 받은 토큰을 프로젝트 폴더의  SUPABASE_TOKEN_LOCAL.txt  에 한 줄로 저장
//      (이 파일은 .gitignore에 등록돼 깃에 올라가지 않습니다)
//   3)  node push_deploy.js
//
// 하는 일: VAPID 시크릿 3개 등록 → push-hw 함수 배포 → 등록 결과 확인
// 비밀값은 임시 env 파일로만 넘겨 명령줄·프로세스 목록에 남기지 않고, 토큰은 길이만 출력합니다.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REF = 'pznpcewwdsbxwibpnapn';
const TOKFILE = 'SUPABASE_TOKEN_LOCAL.txt';
const VAPFILE = 'VAPID_KEYS_LOCAL.txt';

function die(msg) { console.error('✗ ' + msg); process.exit(1); }

if (!fs.existsSync(TOKFILE)) die(`토큰 파일이 없습니다: ${TOKFILE}\n   대시보드 → 계정 → Access Tokens 에서 발급해 한 줄로 저장해 주세요.`);
if (!fs.existsSync(VAPFILE)) die(`VAPID 파일이 없습니다: ${VAPFILE}`);

const token = fs.readFileSync(TOKFILE, 'utf8').trim();
if (!token) die('토큰 파일이 비어 있습니다.');
console.log(`토큰 확인: ${token.length}자 (내용은 출력하지 않습니다)`);

// ── VAPID 값 추출 ──
const vap = fs.readFileSync(VAPFILE, 'utf8');
const mJwk = vap.match(/(\{"kty"[\s\S]*?\})/);
const mPub = vap.match(/^[ \t]*(B[A-Za-z0-9_-]{80,})[ \t]*$/m);
const mSub = vap.match(/(mailto:[^\s]+)/);
if (!mJwk || !mPub || !mSub) die('VAPID 파일에서 값을 찾지 못했습니다 (JWK / 공개키 / mailto).');
const jwk = mJwk[1].trim(), pub = mPub[1].trim(), sub = mSub[1].trim();
console.log(`VAPID 확인: 비밀키 ${jwk.length}자 · 공개키 ${pub.length}자 · 연락처 ${sub}`);

const envPath = path.join(os.tmpdir(), 'pp_vapid_' + Date.now() + '.env');
fs.writeFileSync(envPath, `VAPID_PRIVATE_JWK=${jwk}\nVAPID_PUBLIC=${pub}\nVAPID_SUBJECT=${sub}\n`, { mode: 0o600 });

const env = { ...process.env, SUPABASE_ACCESS_TOKEN: token };
function cli(args, label) {
  console.log(`\n── ${label} ──`);
  try {
    const out = execFileSync('npx', ['--yes', 'supabase@latest', ...args], {
      env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true, timeout: 420000,
    });
    const s = (out || '').trim();
    console.log(s ? s.split('\n').slice(-14).join('\n') : '(출력 없음)');
    return { ok: true, out: s };
  } catch (e) {
    const s = ((e.stdout || '') + (e.stderr || '')).trim();
    console.log('✗ 실패');
    console.log(s ? s.split('\n').slice(-14).join('\n') : String(e.message));
    return { ok: false, out: s };
  }
}

const r1 = cli(['secrets', 'set', '--project-ref', REF, '--env-file', envPath], '1) VAPID 시크릿 등록');
try { fs.unlinkSync(envPath); } catch (_) {}

// JWT 검증은 켠 채로 둔다 (cron이 프로젝트 공개 키를 함께 보내므로 통과한다)
const r2 = cli(['functions', 'deploy', 'push-hw', '--project-ref', REF], '2) push-hw 함수 배포');
const r3 = cli(['secrets', 'list', '--project-ref', REF], '3) 등록된 시크릿 (이름만)');
const r4 = cli(['functions', 'list', '--project-ref', REF], '4) 배포된 함수 목록');

console.log('\n════ 요약 ════');
console.log('시크릿 등록 :', r1.ok ? 'OK' : '실패');
console.log('함수 배포   :', r2.ok ? 'OK' : '실패');
console.log('목록 조회   :', (r3.ok && r4.ok) ? 'OK' : '일부 실패');
if (r1.ok && r2.ok) console.log('\n다음: node verify_push.js 로 끝까지 확인하세요.');
process.exit(r1.ok && r2.ok ? 0 : 1);
