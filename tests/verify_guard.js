// 검사 도구가 **실제 서버에 쓰지 못하게** 막는 장치.
//
// 2026-11-12, 검사용 문항 7줄('Sample passage number 1 about curiosity…')이 실제 item_bank 에
// 세 번(11:50 · 21:27 · 21:30) 들어갔다. 원인은 verify_iso.js 가 rest/v1/worksheets 만
// 가짜로 끼우고 item_bank 는 안 끼운 채, 앱의 **자동 저장**(_isoAutoSave → _isoBankSync →
// ibPutItem → supaUpsert('item_bank'))이 돌았던 것이다.
// 그 뒤로 모든 검사는 tests/run.js 를 거쳐 이 장치를 끼운 채로만 돈다(tests/_guard_preload.js).
//
// 가르는 기준 두 가지
//   · 데이터 쓰기  rest/v1 의 POST·PATCH·PUT·DELETE — 실제 줄이 바뀐다. 엄격 모드에서 **그 자리에서 멈춘다**.
//   · 바깥 호출    functions/v1 의 POST — 돈이 들거나(AI·음성) 메일이 나간다. 막고 적기만 한다
//                  (앱이 뜰 때 하는 '살아 있나' 확인까지 멈추면 아무 검사도 못 돈다).
// 어느 쪽이든 요청은 **실제로 나가지 않는다**.
let _writes = [], _calls = [], _strict = true, _fake = false;
function guardFake(on) { _fake = !!on; }
function guardStrict(on) { _strict = !!on; }   // false = 멈추지 않고 기록만 (장치 자체 점검용)
function guardKind(url) {
  const u = String(url || '');
  if (u.indexOf('/rest/v1/') >= 0) return 'write';
  if (u.indexOf('/functions/v1/') >= 0) return 'call';
  return '';
}
function guardCheck(method, url) {
  const m = String(method || 'GET').toUpperCase();
  const u = String(url || '');
  if (m === 'GET' || m === 'HEAD') return 'ok';
  const kind = guardKind(u);
  if (!kind) return 'ok';
  const what = m + ' ' + (u.split('/v1/')[1] || u).split('?')[0];
  if (kind === 'call') { _calls.push(what); return 'block'; }
  _writes.push(what);
  if (_strict) {
    console.error('\n🛑 검사가 실제 서버에 쓰려고 했습니다 — 여기서 멈춥니다.');
    console.error('   ' + m + ' ' + u.slice(0, 150));
    console.error('   가짜 서버를 끼우거나, 쓰기를 막은 채로만 돌 수 있습니다 (tests/run.js).');
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
  guardCheck(m, url);                      // 데이터 쓰기면 여기서 멈춘다
  // 끊지 않고 403 으로 답한다 (ERR_FAILED 가 콘솔에 쌓이지 않게) — 요청은 서버에 닿지 않는다
  return route.fulfill({
    status: 403, contentType: 'application/json',
    body: JSON.stringify({ message: '검사 중에는 실제 서버에 쓸 수 없습니다 (verify_guard)' })
  });
}
function guardReport() { return { blocked: _writes.slice(), calls: _calls.slice(), fake: _fake }; }
function guardClear() { _writes = []; _calls = []; }   // 장치 자체를 점검한 뒤 기록을 지운다
function guardLine() {
  const r = guardReport();
  return '막음 장치: 실제 서버 쓰기 ' + r.blocked.length + '건' +
    (r.blocked.length ? (' (' + r.blocked.slice(0, 6).join(', ') + ')') : '') +
    (r.calls.length ? (' · 막은 바깥 호출 ' + r.calls.length + '건') : '') +
    (r.fake ? ' · 가짜 서버 끼움' : '');
}
module.exports = { guardCheck, guardFetch, guardRoute, guardReport, guardFake, guardStrict, guardLine, guardClear, guardKind };
