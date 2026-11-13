// 쓰기를 흉내 내는 **가짜 서버 표**. 쓰는 검사는 반드시 이걸 끼운다.
//
// 왜: 2026-11-12, 가짜 서버를 worksheets 에만 끼운 검사가 돌면서
//     _isoAutoSave → ibPutItem → POST item_bank 가 **실제 서버로 나가** 검사 문항이 들어갔다.
//     (tests/README.md) 막음 장치가 그 길을 막고는 있지만, 막히면 그 검사는 실패로 끝난다.
//     쓰는 검사는 자기가 건드리는 표를 모두 여기에 적어 둔다.
//
//   const { fakeTables } = require('./_fake');
//   const fake = await fakeTables(page, ['worksheets', 'item_bank', 'item_bank_index']);
//   …
//   fake.posts            // 받은 쓰기 수
//   fake.last('item_bank')// 마지막으로 받은 몸통
//
// GET 은 기본으로 빈 목록([])을 돌려준다. 다른 답이 필요하면 opts.get 으로 준다.
//   fakeTables(page, ['item_bank'], { get: (table, url) => rows })
function fakeTables(target, tables, opts) {
  const o = opts || {};
  const state = {
    posts: 0, byTable: {}, bodies: {},
    last(t) { return this.bodies[t]; },
    count(t) { return this.byTable[t] || 0; },
  };
  const list = (tables || []).map(String);
  const handler = async r => {
    const req = r.request();
    const url = new URL(req.url());
    const table = (url.pathname.split('/rest/v1/')[1] || '').split('?')[0];
    const m = req.method();
    if (m === 'GET' || m === 'HEAD') {
      const rows = o.get ? o.get(table, url) : [];
      return r.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': '0-0/' + (Array.isArray(rows) ? rows.length : 0) },
        body: JSON.stringify(rows || []),
      });
    }
    state.posts++;
    state.byTable[table] = (state.byTable[table] || 0) + 1;
    try { state.bodies[table] = JSON.parse(req.postData() || 'null'); } catch (e) { state.bodies[table] = req.postData(); }
    if (typeof o.on === 'function') {
      const made = o.on(table, m, state.bodies[table], r);
      if (made) return made;                      // 검사가 직접 답을 지었다 (실패 흉내 등)
    }
    if (m === 'DELETE') return r.fulfill({ status: 204, body: '' });
    return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  };
  return Promise.all(list.map(t => target.route('**/rest/v1/' + t + '**', handler))).then(() => state);
}

module.exports = { fakeTables };
