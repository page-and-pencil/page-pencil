// 가짜 서버 **응답 표**. 검사는 실제 서버(*.supabase.co)를 읽지 않는다.
//
// 왜 (2026-11-13): 전송량이 한 주기에 14.61GB / 5GB 가 됐다. 11/15 부터는 프로젝트가 막힌다.
//   검사는 브라우저로 진짜 앱을 열고, 그 앱은 진짜 Supabase 를 본다 — 한 번 돌 때마다 몇 MB 가 나간다.
//   그래서 읽기도 막고, 앱이 뜨는 데 필요한 줄은 이 표에서 **가짜로** 돌려준다.
//
// 표에 있는 표(table)만 답한다. 없는 표는 404 로 돌려주고 '막은 읽기' 로 센다 —
// 앱은 404 난 표를 그 세션 동안 다시 부르지 않으므로 화면은 그대로 돈다.
//
// 검사가 자기 줄을 넣고 싶으면:
//   const { fakeRows } = require('./_fakedb');
//   fakeRows('lessons', [{ id: 'x', data: { … } }]);     // 이 검사 동안만
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'fixtures', 'db.json');
let DB = {};
try { DB = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { DB = {}; }
const SETTINGS = Object.assign({}, DB._settings || {});
const over = {};                                   // 검사가 더한 줄

const TABLES = Object.keys(DB).filter(k => k[0] !== '_');
// 같은 줄을 보는 뷰·별명
const ALIAS = { students_safe: 'students', students_parent: 'students', item_bank_index: 'item_bank' };

function fakeRows(table, rows) { over[String(table)] = rows || []; }
function fakeSetting(key, value) { SETTINGS[String(key)] = value; }
function knows(table) {
  const t = ALIAS[table] || table;
  return Object.prototype.hasOwnProperty.call(over, t) ||
    Object.prototype.hasOwnProperty.call(over, table) ||
    TABLES.indexOf(t) >= 0 || t === 'settings';
}
function rowsOf(table) {
  const t = ALIAS[table] || table;
  if (Object.prototype.hasOwnProperty.call(over, table)) return over[table];
  if (Object.prototype.hasOwnProperty.call(over, t)) return over[t];
  return DB[t] || [];
}

// PostgREST 흉내 — 검사가 보는 만큼만 (eq·limit·offset·count)
function answer(urlStr) {
  const u = new URL(urlStr);
  const table = (u.pathname.split('/rest/v1/')[1] || '').split('?')[0];
  if (!table || !knows(table)) return null;        // 표에 없다 → 부르는 쪽에서 막는다
  if (table === 'settings') {
    const k = String(u.searchParams.get('key') || '').replace(/^eq\./, '');
    const v = SETTINGS[k];
    return v === undefined || v === null ? [] : [{ key: k, value: v }];
  }
  let rows = (rowsOf(table) || []).slice();
  u.searchParams.forEach((val, key) => {
    if (['select', 'order', 'limit', 'offset', 'and', 'or'].indexOf(key) >= 0) return;
    const m = /^eq\.(.*)$/.exec(String(val));
    if (!m) return;
    const want = m[1];
    rows = rows.filter(r => String((r && r[key] !== undefined) ? r[key] : ((r.data || {})[key])) === want);
  });
  const off = +(u.searchParams.get('offset') || 0);
  const lim = +(u.searchParams.get('limit') || 0);
  if (off) rows = rows.slice(off);
  if (lim) rows = rows.slice(0, lim);
  return rows;
}

module.exports = { answer, knows, fakeRows, fakeSetting, TABLES, FILE };
