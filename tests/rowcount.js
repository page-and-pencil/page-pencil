// 실제 표의 줄 수만 **읽는다**(GET 만). 검사 앞뒤로 재서 '아무것도 안 들어갔다'를 보인다.
//   node tests/rowcount.js            — 사람이 보기
//   node tests/rowcount.js --json     — run.js 가 비교할 때
// 키는 js/db.js 에서 읽어 쓰고, 어디에도 찍지 않는다.
//
// 2026-11-13: 무료 한도를 넘어 11/15~11/27 사이에는 서버가 **402** 를 돌려줄 수 있다.
//   · 못 읽으면 검사를 실패로 치지 않는다 — 끝줄에 '줄 수 확인 못 함(…)' 이라고만 적는다.
//   · PP_SKIP_COUNTS=1 이면 아예 묻지 않는다 (실제 서버 요청 0건). 11/27 까지는 이것을 기본으로 쓴다.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js', 'db.js'), 'utf8');
const URL_ = (src.match(/const SUPA_URL\s*=\s*['"]([^'"]+)['"]/) || [])[1];
const KEY_ = (src.match(/const SUPA_KEY\s*=\s*['"]([^'"]+)['"]/) || [])[1];

const TABLES = ['item_bank', 'worksheets', 'item_results', 'assignments'];
const SKIP = () => process.env.PP_SKIP_COUNTS === '1';

async function countOf(t, extra) {
  if (!URL_ || !KEY_) return { n: null, why: '키 없음' };
  const u = URL_ + '/rest/v1/' + t + '?select=id' + (extra || '') + '&limit=1';
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(u, {
      headers: { apikey: KEY_, Authorization: 'Bearer ' + KEY_, Prefer: 'count=exact', Range: '0-0' },
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!r.ok) return { n: null, why: '서버 제한 ' + r.status };
    const n = (r.headers.get('content-range') || '').split('/')[1];
    if (n === undefined || n === '*') return { n: null, why: '수를 못 읽음' };
    return { n: +n, why: '' };
  } catch (e) {
    clearTimeout(tid);
    return { n: null, why: (e && e.name === 'AbortError') ? '시간 초과' : '못 닿음' };
  }
}

async function snapshot() {
  if (SKIP()) return { _skip: true };
  const out = {};
  let bad = 0, why = '';
  for (const t of TABLES) {
    const r = await countOf(t);
    out[t] = r.n;
    if (r.n === null) { bad++; why = why || r.why; }
  }
  if (bad) out._fail = why || '못 읽음';          // 하나라도 못 읽으면 '확인 못 함' 으로 본다
  return out;
}

function skipped(s) { return !!(s && s._skip); }
function failed(s) { return !!(s && s._fail); }
function line(s) {
  if (skipped(s)) return '확인 안 함 (PP_SKIP_COUNTS=1)';
  if (failed(s)) return '확인 못 함 (' + s._fail + ')';
  return TABLES.map(t => t + ' ' + (s[t] === null ? '(못 읽음)' : s[t])).join(' · ');
}

// 못 읽었거나 건너뛰었으면 '바뀐 것 없음' 으로 본다 — 읽지 못한 것을 '줄이 바뀌었다' 로 읽지 않는다
function diff(a, b) {
  if (skipped(a) || skipped(b) || failed(a) || failed(b)) return [];
  return TABLES.filter(t => a[t] !== null && b[t] !== null && a[t] !== b[t])
    .map(t => t + ' ' + a[t] + '→' + b[t]);
}

module.exports = { snapshot, line, diff, skipped, failed, TABLES };

if (require.main === module) {
  snapshot().then(s => {
    if (process.argv.includes('--json')) console.log(JSON.stringify(s));
    else console.log(line(s));
  });
}
