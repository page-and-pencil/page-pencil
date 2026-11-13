require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 2차 확인 — 난도 규칙 보강 · 지문 묶음(setId) 카드 · 덮어쓰기 가져오기 · 표 없음 상태
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));

const t0 = 1762000000000;
const mk = (id, o) => Object.assign({
  id, type: 'blank', typeName: '읽기 · 빈칸 추론', skill: 'read', grade: '고1', diff: 3, diffSrc: 'rule',
  stem: '발문 ' + id, passage: 'Passage for ' + id + '. ', choices: ['a', 'b', 'c', 'd', 'e'], answer: 0,
  explain: '해설', wrong: [], words: 10, src: { kind: 'iso' }, tags: [], star: false, checked: false,
  createdAt: t0, editedAt: t0
}, o);
const SET_PASS = 'Long passage shared by three questions. Reading widely builds the habit of asking better questions. ';
const seed = [
  mk('solo1'), mk('solo2'),
  mk('set1', { setId: 'setA', setOrder: 1, passage: SET_PASS, type: 'long3', typeName: '읽기 · 장문(순서·지칭·내용)', stem: '윗글의 제목으로 가장 적절한 것은?' }),
  mk('set2', { setId: 'setA', setOrder: 2, passage: SET_PASS, type: 'long3', typeName: '읽기 · 장문(순서·지칭·내용)', stem: '밑줄 친 부분이 가리키는 대상이 다른 것은?' }),
  mk('set3', { setId: 'setA', setOrder: 3, passage: SET_PASS, type: 'long3', typeName: '읽기 · 장문(순서·지칭·내용)', stem: '윗글의 내용으로 적절하지 않은 것은?' }),
  mk('touched1', { checked: true }),                       // 검수함 — 덮어쓰기에서 지켜야 한다
  mk('touched2', { diffSrc: 'teacher', diff: 5 }),         // 난도를 직접 고침
  mk('touched3', { editedAt: t0 + 50000 }),                // 만든 뒤 고친 적 있음
  mk('plain1'), mk('plain2')                               // 손대지 않음 — 덮어써도 된다
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); localStorage.removeItem('pp_ib_filters'); localStorage.removeItem('pp_item_basket'); } catch (e) { } });
  const page = await ctx.newPage();
  const DB = new Map(seed.map(d => [d.id, { id: d.id, data: d, updated_at: '2026-11-10T00:00:00+00:00' }]));
  let posts = [], tableOk = true;
  const light = r => {
    const d = r.data || {}, p = String(d.passage || '');
    const m = { ...d, preview: p.slice(0, 180), hasPassage: !!d.passage };
    delete m.passage; delete m.explain; delete m.wrong; delete m.id;
    return { id: r.id, updated_at: r.updated_at, meta: m };
  };
  await page.route('**/rest/v1/item_bank**', async r => {
    if (!tableOk) return r.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"relation \\"public.item_bank\\" does not exist"}' });
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST') {
      let b = []; try { b = JSON.parse(req.postData() || '[]'); } catch (e) { }
      (Array.isArray(b) ? b : [b]).forEach(row => { posts.push(row); if (row && row.id) DB.set(row.id, { id: row.id, data: row.data, updated_at: row.updated_at || new Date().toISOString() }); });
      return r.fulfill({ status: 201, body: '' });
    }
    const sel = url.searchParams.get('select') || '';
    if (sel === 'updated_at') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + DB.size, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify([{ updated_at: [...DB.values()].map(x => x.updated_at).sort().reverse()[0] }]) });
    let rows = [...DB.values()].filter(x => !(x.data || {})._deleted);
    const idq = url.searchParams.get('id');
    if (idq && idq.startsWith('eq.')) rows = rows.filter(x => x.id === decodeURIComponent(idq.slice(3)));
    else if (idq && idq.startsWith('in.(')) { const ids = idq.slice(4, -1).split(',').map(decodeURIComponent); rows = rows.filter(x => ids.indexOf(x.id) >= 0); }
    const out = sel.indexOf('meta') >= 0 ? rows.map(light)
      : sel === 'data' ? rows.map(x => ({ data: x.data }))
        : sel === 'id,data' ? rows.map(x => ({ id: x.id, data: x.data }))
          : rows.map(x => ({ id: x.id, updated_at: x.updated_at }));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await page.route('**/rest/v1/worksheets**', r => r.request().method() === 'POST' ? r.fulfill({ status: 201, body: '' }) : r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/functions/v1/claude-proxy', r => r.fulfill({ status: 400, body: '{"error":{"message":"테스트에서는 AI 를 부르지 않는다"}}' }));
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));
  const boot = async () => { await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 }); await wait(1600); };

  // ── 표가 아직 없을 때 (SQL 실행 전) ──────────────────────────────────
  tableOk = false;
  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await boot();
  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('items'); });
  await wait(2500);
  const nt = await page.evaluate(async () => ({
    note: (document.getElementById('ib-state') || {}).textContent || '',
    flag: _ibNoTable,
    saved: await ibPutItem({ id: 'x1', stem: 's', src: { kind: 'manual' }, choices: [], tags: [] }, true),
    ls: Object.keys(localStorage).filter(k => /notable|no_table|ib_no/i.test(k)),
    snap: await idbGet('pp_item_bank_v1')
  }));
  ok('① 표가 없으면 안내하고 쓰기를 멈춘다', /표가 아직 없습니다/.test(nt.note) && nt.flag === true && nt.saved === false, '"' + nt.note + '"');
  ok('② 그 상태는 어디에도 저장되지 않는다', nt.ls.length === 0 && !nt.snap, 'localStorage ' + nt.ls.length + '개 · 기기 캐시 ' + (nt.snap ? '있음' : '없음'));

  // 표를 만든 뒤 새로고침하면 바로 풀린다
  tableOk = true;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await boot();
  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('items'); });
  await page.waitForFunction(() => document.querySelectorAll('#ib-list .ib-card').length > 0, null, { timeout: 60000 });
  await wait(800);
  const p0 = posts.length;
  const re = await page.evaluate(async () => {
    const r = await ibPutItem({ id: 'probe1', type: 'blank', stem: '표가 생긴 뒤 저장', src: { kind: 'manual' }, choices: [], tags: [] }, true);
    return { flag: _ibNoTable, r, n: (_ibRows || []).length, note: (document.getElementById('ib-state') || {}).textContent || '' };
  });
  ok('③ 표를 만든 뒤 새로고침하면 바로 풀린다', re.flag === false && re.r === true && posts.length === p0 + 1 && re.n === seed.length + 1,
    '막힘 해제 ✓ · 목록 ' + re.n + '개 · "' + re.note + '"');

  // ── 난도 규칙 ───────────────────────────────────────────────────────
  const d = await page.evaluate(() => {
    const g = (rate, pts, t) => _ibDiffDefault(rate, pts, t);
    return {
      listen: ['l_purpose', 'l_gist', 'l_not', 'l_table', 'l_short'].map(k => g(null, null, k).diff),
      listen3: ['l_pay', 'l_long', 'l_situation'].map(k => g(null, null, k).diff),
      implicit: g(null, null, 'implicit').diff, irrelevant: g(null, null, 'irrelevant').diff,
      long: [g(null, null, 'long2').diff, g(null, null, 'long3').diff],
      match: [g(null, null, 'm_match').diff, g(null, null, 'notice').diff, g(null, null, 'bio').diff],
      clampHi: g(null, 5, 'blank').diff, clampLo: g(null, 1, 'l_purpose').diff
    };
  });
  ok('④ 듣기 2 (금액·긴 대화 응답·상황에 맞는 말 3)', d.listen.every(x => x === 2) && d.listen3.every(x => x === 3), d.listen.join('') + ' / ' + d.listen3.join(''));
  ok('⑤ 함축 4 · 무관한 문장·장문 3 · 일치·안내문 2', d.implicit === 4 && d.irrelevant === 3 && d.long.every(x => x === 3) && d.match.every(x => x === 2),
    '함축 ' + d.implicit + ' · 무관 ' + d.irrelevant + ' · 장문 ' + d.long.join('') + ' · 일치/안내/인물 ' + d.match.join(''));
  ok('⑥ 1~5 로 자른다', d.clampHi === 5 && d.clampLo === 1, '빈칸+5점 ' + d.clampHi + ' · 듣기1점 ' + d.clampLo);

  // ── 지문 묶음(setId) 카드 ───────────────────────────────────────────
  const s1 = await page.evaluate(() => {
    ibResetFilters();
    const cards = [...document.querySelectorAll('#ib-list .ib-card')];
    const setCard = document.querySelector('#ib-list .ib-card.ib-set');
    return {
      cards: cards.length, hasSet: !!setCard,
      label: setCard ? (setCard.querySelector('.ib-set-n') || {}).textContent : '',
      subRows: setCard ? setCard.querySelectorAll('.ib-srow').length : -1,
      count: (document.getElementById('ib-count') || {}).textContent
    };
  });
  ok('⑦ 한 지문 문항은 한 카드로 접힌다', s1.hasSet && /문항 3개/.test(s1.label) && s1.subRows === 0 && s1.cards === seed.length + 1 - 2,
    '카드 ' + s1.cards + '개 · "' + s1.label + '" · 개수표시 ' + s1.count);
  const s2 = await page.evaluate(async () => {
    ibSetToggle('setA');
    await new Promise(r => setTimeout(r, 300));
    const setCard = document.querySelector('#ib-list .ib-card.ib-set');
    const rows = [...setCard.querySelectorAll('.ib-srow')];
    rows[1].click();
    await new Promise(r => setTimeout(r, 700));
    return {
      subRows: rows.length, nos: rows.map(r => (r.querySelector('.ib-sno') || {}).textContent),
      sel: _ibSelId, editing: _ibEditing ? _ibEditing.stem : '',
      stillOpen: document.querySelectorAll('#ib-list .ib-srow').length
    };
  });
  ok('⑧ 펼치면 문항별로 고를 수 있다', s2.subRows === 3 && s2.nos.join('') === '123' && s2.sel === 'set2' && /가리키는 대상/.test(s2.editing),
    '문항 ' + s2.subRows + '개 · 고른 것 ' + s2.sel);
  await page.screenshot({ path: SCR + '/ib_set_card.png', clip: { x: 250, y: 100, width: 1190, height: 620 } });
  const s3 = await page.evaluate(() => {
    ibSetBasket('setA');
    const b = ibBasket();
    return { n: b.length, all: ['set1', 'set2', 'set3'].every(id => b.indexOf(id) >= 0) };
  });
  ok('⑨ 묶음 전체 담기', s3.all && s3.n === 3, '바구니 ' + s3.n + '개');

  // ── 가져오기 — 기본은 건너뛰기 ──────────────────────────────────────
  const file1 = SCR + '/ib_over_test.json';
  const over = [
    { id: 'plain1', type: 'blank', stem: '덮어쓴 발문 plain1', passage: 'new p', choices: ['a', 'b'], answer: 1, explain: 'x' },
    { id: 'plain2', type: 'blank', stem: '덮어쓴 발문 plain2', passage: 'new p', choices: ['a', 'b'], answer: 1, explain: 'x' },
    { id: 'touched1', type: 'blank', stem: '건드리면 안 됨 1', choices: ['a', 'b'], answer: 0 },
    { id: 'touched2', type: 'blank', stem: '건드리면 안 됨 2', choices: ['a', 'b'], answer: 0 },
    { id: 'touched3', type: 'blank', stem: '건드리면 안 됨 3', choices: ['a', 'b'], answer: 0 },
    { id: 'brand1', type: 'order', stem: '새 문항 1', passage: 'brand new', choices: ['a', 'b'], answer: 0 },
    { id: 'brand2', type: 'order', stem: '새 문항 2', passage: 'brand new', choices: ['a', 'b'], answer: 0 }
  ];
  fs.writeFileSync(file1, JSON.stringify(over), 'utf8');
  const p1 = posts.length;
  await page.setInputFiles('#ib-import-file', file1);
  await wait(900);
  const m1 = await page.evaluate(() => (document.getElementById('confirm-msg') || {}).textContent || '');
  await page.evaluate(() => document.getElementById('confirm-ok-btn').click());
  await wait(1500);
  const skipRes = await page.evaluate(() => ({ p1: (_ibRows.find(r => r.id === 'plain1') || {}).meta.stem, n: _ibRows.length }));
  ok('⑩ 기본은 새 문항만 (같은 id 건너뜀)', posts.length === p1 + 2 && /^발문 plain1$/.test(skipRes.p1) && /새로 (넣음 )?2 · 덮어씀 0 · 건너뜀 5/.test(m1),
    m1.replace(/\n/g, ' / ').slice(0, 110));
  ok('⑪ 안내에 정답 세는 법', /정답은 0부터\(① = 0\)/.test(m1), m1.indexOf('정답은 0부터') >= 0 ? '있음' : '없음');

  // ── 가져오기 — 덮어쓰기 ─────────────────────────────────────────────
  const p2 = posts.length;
  await page.evaluate(() => { _ibImportMode = 'over'; });
  await page.setInputFiles('#ib-import-file', file1);
  await wait(900);
  const m2 = await page.evaluate(() => (document.getElementById('confirm-msg') || {}).textContent || '');
  await page.evaluate(() => document.getElementById('confirm-ok-btn').click());
  await wait(1500);
  const ov = await page.evaluate(() => ({
    p1: (_ibRows.find(r => r.id === 'plain1') || {}).meta.stem,
    t1: (_ibRows.find(r => r.id === 'touched1') || {}).meta.stem,
    t2: (_ibRows.find(r => r.id === 'touched2') || {}).meta.stem,
    t3: (_ibRows.find(r => r.id === 'touched3') || {}).meta.stem
  }));
  const sent = posts.slice(p2);
  const plain1Post = sent.find(x => x.id === 'plain1');
  ok('⑫ 덮어쓰기 — 손대지 않은 문항만 바뀐다', sent.length === 4 && /덮어쓴 발문 plain1/.test(ov.p1) &&
    /건드리면/.test(ov.t1) === false && ov.t1 === '발문 touched1' && ov.t2 === '발문 touched2' && ov.t3 === '발문 touched3',
    '올린 ' + sent.length + '개 (' + sent.map(x => x.id).join(',') + ')');
  ok('⑬ 덮어써도 처음 만든 때는 지킨다', plain1Post && plain1Post.data.createdAt === t0 && plain1Post.data.editedAt > t0,
    'createdAt ' + (plain1Post && plain1Post.data.createdAt));
  ok('⑭ 개수 안내 (새로 넣음 / 덮어씀 / 건너뜀)', /새로 (넣음 )?0 · 덮어씀 4 · 건너뜀 3 \(손댄 문항 3개 보호\)/.test(m2),
    m2.replace(/\n/g, ' / ').slice(0, 130));

  // ── 넘침·오류 ───────────────────────────────────────────────────────
  const overflow = async w => { await page.setViewportSize({ width: w, height: 800 }); await wait(700); return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)); };
  const o1440 = await overflow(1440), o390 = await overflow(390), o320 = await overflow(320);
  await page.screenshot({ path: SCR + '/ib_set_390.png' });
  ok('⑮ 넘침 0 (1440·390·320)', o1440 === 0 && o390 === 0 && o320 === 0, [o1440, o390, o320].join(' / '));
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|400|404/i;
  const mine = errs.filter(e => !skip.test(e));
  ok('⑯ 콘솔 오류 0', mine.length === 0, mine.slice(0, 3).join(' | ') || '0');

  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
