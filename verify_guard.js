// 검사 도구가 **실제 서버에 쓰지 못하게** 막는 장치.
//
// 2026-11-12, 검사용 문항 7줄('Sample passage number 1 about curiosity…')이 실제 item_bank 에
// 들어간 적이 있다. 그 뒤로 모든 verify_*.js 와 화면 검사 도구는 이 장치를 끼운 채로만 돈다.
//
//  · 가짜 서버가 끼워졌으면 guardFake(true) 로 알린다.
//  · 쓰기(POST·PATCH·PUT·DELETE)가 실제 주소로 가려 하면 **그 자리에서 멈추고** 보고한다.
//  · 보고의 '서버 쓰기 0건' 은 이 장치의 기록(guardReport)으로 적는다.
let _blocked = [], _strict = true, _fake = false;
function guardFake(on) { _fake = !!on; }
function guardStrict(on) { _strict = !!on; }   // false = 멈추지 않고 기록만 (장치 자체 점검용)
function guardCheck(method, url) {
  const m = String(method || 'GET').toUpperCase();
  const u = String(url || '');
  if (m === 'GET' || m === 'HEAD') return 'ok';
  if (u.indexOf('/rest/v1/') < 0 && u.indexOf('/functions/v1/') < 0) return 'ok';
  const what = m + ' ' + (u.split('/v1/')[1] || u).split('?')[0];
  _blocked.push(what);
  if (_strict) {
    console.error('\n🛑 검사가 실제 서버에 쓰려고 했습니다 — 여기서 멈춥니다.');
    console.error('   ' + m + ' ' + u.slice(0, 150));
    console.error('   가짜 서버를 끼우거나, 쓰기를 막은 채로만 돌 수 있습니다 (verify_guard).');
    process.exit(2);
  }
  return 'block';
}
// node 검사용 fetch 대역 — 읽기는 빈 응답, 쓰기는 막는다
function guardFetch() {
  return async (u, o) => {
    guardCheck((o && o.method), (u && u.url) || u);
    return { ok: false, status: 0, headers: { get: () => null }, json: async () => ({}), text: async () => '' };
  };
}
// Playwright 화면 검사용 — page.route 핸들러에 끼운다
function guardRoute(route, opts) {
  const req = route.request();
  const m = req.method();
  const url = req.url();
  if (m === 'GET' || m === 'HEAD') return (opts && opts.onGet) ? opts.onGet(route) : route.continue();
  guardCheck(m, url);                      // 가짜 서버가 없으면 여기서 멈춘다
  return route.abort();
}
function guardReport() { return { blocked: _blocked.slice(), fake: _fake }; }
function guardClear() { _blocked = []; }      // 장치 자체를 점검한 뒤 기록을 지운다
function guardLine() {
  const r = guardReport();
  return '막음 장치: 실제 서버 쓰기 ' + r.blocked.length + '건' +
    (r.blocked.length ? (' (' + r.blocked.slice(0, 6).join(', ') + ')') : '') +
    (r.fake ? ' · 가짜 서버 끼움' : '');
}
module.exports = { guardCheck, guardFetch, guardRoute, guardReport, guardFake, guardStrict, guardLine, guardClear };
