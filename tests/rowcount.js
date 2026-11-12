// 실제 표의 줄 수만 **읽는다**(GET 만). 검사 앞뒤로 재서 '아무것도 안 들어갔다'를 보인다.
//   node tests/rowcount.js            — 사람이 보기
//   node tests/rowcount.js --json     — run.js 가 비교할 때
// 키는 js/db.js 에서 읽어 쓰고, 어디에도 찍지 않는다.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js', 'db.js'), 'utf8');
const URL_ = (src.match(/const SUPA_URL\s*=\s*['"]([^'"]+)['"]/) || [])[1];
const KEY_ = (src.match(/const SUPA_KEY\s*=\s*['"]([^'"]+)['"]/) || [])[1];

const TABLES = ['item_bank', 'worksheets', 'item_results', 'assignments'];

async function countOf(t, extra) {
  if (!URL_ || !KEY_) return null;
  const u = URL_ + '/rest/v1/' + t + '?select=id' + (extra || '') + '&limit=1';
  try {
    const r = await fetch(u, {
      headers: { apikey: KEY_, Authorization: 'Bearer ' + KEY_, Prefer: 'count=exact', Range: '0-0' }
    });
    if (!r.ok) return null;
    const n = (r.headers.get('content-range') || '').split('/')[1];
    return n === undefined ? null : (n === '*' ? null : +n);
  } catch (e) { return null; }
}

async function snapshot() {
  const out = {};
  for (const t of TABLES) out[t] = await countOf(t);
  return out;
}

function line(s) {
  return TABLES.map(t => t + ' ' + (s[t] === null ? '(못 읽음)' : s[t])).join(' · ');
}

function diff(a, b) {
  return TABLES.filter(t => a[t] !== null && b[t] !== null && a[t] !== b[t])
    .map(t => t + ' ' + a[t] + '→' + b[t]);
}

module.exports = { snapshot, line, diff, TABLES };

if (require.main === module) {
  snapshot().then(s => {
    if (process.argv.includes('--json')) console.log(JSON.stringify(s));
    else console.log(line(s));
  });
}
