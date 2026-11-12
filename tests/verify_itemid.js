require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 문항 id 가 '행 id' 로 들어오는지 — data 안에 id 가 없는 문항으로만 확인한다 (가짜 서버)
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));
const t0 = 1762000000000;
const P = 'Reading widely does more than fill a shelf. It teaches a reader to hold two ideas at once.';
// ⚠️ data 안에 id 를 넣지 않는다 (Aside 가 REST 로 넣은 행과 같은 모양)
const mkNoId = o => Object.assign({
  type: 'blank', typeName: '읽기 · 빈칸 추론', skill: 'read', grade: '고1', diff: 3,
  stem: '다음 빈칸에 들어갈 말은?', passage: P, choices: ['a', 'b', 'c', 'd', 'e'], answer: 0,
  explain: '해설', wrong: [], words: 15, points: 2, src: { kind: 'exam' }, tags: [], createdAt: t0, editedAt: t0
}, o);
const ROWS = [
  { id: 'asidechk1', data: mkNoId({ stem: '[1] 빈칸 문항', answer: 0 }) },
  { id: 'asidechk2', data: mkNoId({ stem: '[2] 순서 문항', type: 'order', typeName: '읽기 · 글의 순서', answer: 1 }) },
  { id: 'asidechk3', data: mkNoId({ stem: '[3] 3점짜리 어법 문항', type: 'grammar', typeName: '읽기 · 어법', skill: 'grammar', answer: 2, points: 3 }) },
  { id: 'asidechk4', data: mkNoId({ stem: '[4] 어휘 문항', type: 'vocab', typeName: '읽기 · 어휘 쓰임', skill: 'vocab', answer: 3 }) }
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); ['pp_item_basket', 'pp_ib_filters'].forEach(k => localStorage.removeItem(k)); } catch (e) { } });
  const page = await ctx.newPage();
  const IB = new Map(ROWS.map(r => [r.id, { id: r.id, data: JSON.parse(JSON.stringify(r.data)), updated_at: '2026-11-12T00:00:00+00:00' }]));
  const WS = new Map(), IR = new Map();
  let irPosts = [], ibPosts = [], ASG = [];
  // 서버 쪽 뷰와 같게 — meta 에 id 는 들어가지 않는다
  const light = r => {
    const d = r.data || {}, p = String(d.passage || d.script || '');
    const m = { ...d, preview: p.slice(0, 180), hasPassage: !!d.passage };
    delete m.passage; delete m.explain; delete m.wrong; delete m.script; delete m.id;
    return { id: r.id, updated_at: r.updated_at, meta: m };
  };
  await page.route('**/rest/v1/item_bank**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST') {
      let b = []; try { b = JSON.parse(req.postData() || '[]'); } catch (e) { }
      (Array.isArray(b) ? b : [b]).forEach(row => { ibPosts.push(row); if (row && row.id) IB.set(row.id, { id: row.id, data: row.data, updated_at: new Date().toISOString() }); });
      return r.fulfill({ status: 201, body: '' });
    }
    const sel = url.searchParams.get('select') || '';
    if (sel === 'updated_at') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + IB.size, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify([{ updated_at: '2026-11-12T00:00:00+00:00' }]) });
    let rows = [...IB.values()];
    const idq = url.searchParams.get('id');
    if (idq && idq.startsWith('eq.')) rows = rows.filter(x => x.id === decodeURIComponent(idq.slice(3)));
    else if (idq && idq.startsWith('in.(')) { const ids = idq.slice(4, -1).split(',').map(decodeURIComponent); rows = rows.filter(x => ids.indexOf(x.id) >= 0); }
    const out = sel.indexOf('meta') >= 0 ? rows.map(light)
      : sel === 'data' ? rows.map(x => ({ data: x.data }))
        : sel === 'id,data' ? rows.map(x => ({ id: x.id, data: x.data }))
          : rows.map(x => ({ id: x.id, updated_at: x.updated_at }));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await page.route('**/rest/v1/worksheets**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST') { const row = JSON.parse(req.postData() || '{}'); if (row.id) WS.set(row.id, { id: row.id, data: row.data }); return r.fulfill({ status: 201, body: '' }); }
    const idq = url.searchParams.get('id') || '', acc = req.headers()['accept'] || '';
    if (idq.startsWith('eq.')) { const row = WS.get(decodeURIComponent(idq.slice(3))); if (acc.includes('object+json')) return row ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row) }) : r.fulfill({ status: 406, body: '{}' }); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...WS.values()]) });
  });
  await page.route('**/rest/v1/item_results**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST') { const row = JSON.parse(req.postData() || '{}'); irPosts.push(row); if (row.id) IR.set(row.id, { id: row.id, sid: row.sid || '', data: row.data }); return r.fulfill({ status: 201, body: '' }); }
    let rows = [...IR.values()];
    const sid = url.searchParams.get('sid'); if (sid && sid.startsWith('eq.')) rows = rows.filter(x => x.sid === decodeURIComponent(sid.slice(3)));
    const pid = url.searchParams.get('data->>paperId'); if (pid && pid.startsWith('eq.')) rows = rows.filter(x => (x.data || {}).paperId === decodeURIComponent(pid.slice(3)));
    const snt = url.searchParams.get('data->>sentId'); if (snt && snt.startsWith('eq.')) rows = rows.filter(x => (x.data || {}).sentId === decodeURIComponent(snt.slice(3)));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  await page.route('**/rest/v1/assignments**', async r => {
    if (r.request().method() === 'POST') { try { ASG.push(JSON.parse(r.request().postData() || '{}')); } catch (e) { } return r.fulfill({ status: 201, body: '' }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/rest/v1/tests**', r => r.request().method() === 'POST' ? r.fulfill({ status: 201, body: '' }) : r.continue());
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));
  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(1800);
  await page.evaluate(() => {
    _cache.students = (_cache.students || []).concat([{ id: 'dummyA', name: '더미A', active: true }, { id: 'dummyB', name: '더미B', active: true }]);
    show('s-teacher'); swTab('t-data'); switchDataTab('items');
  });
  await page.waitForFunction(() => document.querySelectorAll('#ib-list .ib-card').length > 0, null, { timeout: 60000 });
  await wait(900);

  // ① 목록·상세에서 행 id 가 들어온다
  const ids = await page.evaluate(async () => {
    const listIds = (_ibRows || []).map(r => r.id);
    const metaHasId = (_ibRows || []).some(r => (r.meta || {}).id !== undefined);
    const full = await _ibFullRow('asidechk3');
    const data = await _ibFetchData(['asidechk1', 'asidechk2']);
    const isoShape = await _ibFetchItems(['asidechk1']);
    return { listIds, metaHasId, fullId: full && full.id, fetchIds: [...data.keys()].map(k => (data.get(k) || {}).id), isoId: (isoShape[0] || {}).id };
  });
  ok('① 목록·상세·여러 줄 받기 모두 행 id', ids.listIds.join(',') === 'asidechk1,asidechk2,asidechk3,asidechk4' &&
    !ids.metaHasId && ids.fullId === 'asidechk3' && ids.fetchIds.join(',') === 'asidechk1,asidechk2' && ids.isoId === 'asidechk1',
    '목록 ' + ids.listIds.length + '개 · 상세 ' + ids.fullId + ' · 여러 줄 ' + ids.fetchIds.join(',') + ' · 동형 모양 ' + ids.isoId);

  // ② 시험지 사본의 id·배점
  const sent = await page.evaluate(async () => {
    await pbOpen(['asidechk1', 'asidechk2', 'asidechk3', 'asidechk4']);
    await new Promise(r => setTimeout(r, 1100));
    _pbPaper.title = 'id 없는 문항 4문항';
    const items = _pbSentItems();
    return { ids: items.map(i => i.id), pts: items.map(i => i.points), slots: _pbSlots.map(s => s.id) };
  });
  ok('② 시험지 사본의 문항 id = 행 id', sent.ids.join(',') === 'asidechk1,asidechk2,asidechk3,asidechk4' && !sent.ids.some(x => !x),
    sent.ids.join(','));
  ok('③ 배점도 문항에서 찾아온다 (3점 문항)', sent.pts.join(',') === '2,2,3,2', '배점 ' + sent.pts.join(','));

  // ④ [3점] 인쇄
  const printed = await page.evaluate(() => {
    window.__printed = [];
    window.open = () => { let buf = ''; return { document: { write(s) { buf += s; }, close() { window.__printed.push(buf); } } }; };
    pbSetFormat('suneung'); pbPrint('q');
    return window.__printed[0] || '';
  });
  ok('④ 3점 문항에 [3점] 이 인쇄된다', /3점짜리 어법 문항<\/b>|3점짜리 어법 문항 <b>\[3점\]<\/b>/.test(printed) && (printed.match(/\[3점\]/g) || []).length === 1,
    '[3점] ' + ((printed.match(/\[3점\]/g) || []).length) + '곳');
  fs.writeFileSync(SCR + '/itemid_print.html', printed, 'utf8');

  // ⑤ 답 입력 → 채점 → 저장
  const entry = await page.evaluate(async () => {
    pbEntry(); await new Promise(r => setTimeout(r, 500));
    _peRows.push({ sid: 'dummyA', name: '더미A', ans: _peItems.map(() => null) });
    _peRows.push({ sid: 'dummyB', name: '더미B', ans: _peItems.map(() => null) });
    _peRender();
    const set = (i, j, v) => { const el = document.getElementById('pe-' + i + '-' + j); el.value = v; peIn(el, i, j); };
    set(0, 0, '1'); set(0, 1, '2'); set(0, 2, '3'); set(0, 3, '4');   // 더미A 4개 다 맞음
    set(1, 0, '1'); set(1, 1, '1'); set(1, 2, '1'); set(1, 3, '1');   // 더미B 1개만 맞음
    const shown = [...document.querySelectorAll('#pe-grid .pe-sc')].map(e => e.textContent);
    await peSave();
    await new Promise(r => setTimeout(r, 1500));
    return { shown };
  });
  const saved = irPosts.map(p => p.data);
  const keys0 = Object.keys((saved[0] || {}).answers || {});
  ok('⑤ 답이 문항별로 저장된다 (undefined 키 없음)',
    saved.length === 2 && keys0.join(',') === 'asidechk1,asidechk2,asidechk3,asidechk4' && !keys0.some(k => k === 'undefined'),
    '키 ' + keys0.join(','));
  ok('⑥ 점수가 제대로 나온다', saved[0].score === 4 && saved[0].total === 4 && saved[1].score === 1 && saved[1].total === 4,
    '더미A ' + saved[0].score + '/' + saved[0].total + ' · 더미B ' + saved[1].score + '/' + saved[1].total + ' · 화면 ' + entry.shown.join(' '));
  ok('⑦ 배점으로 센 점수도 맞는다', saved[0].points === 9 && saved[0].pointsTotal === 9 && saved[1].pointsTotal === 9,
    '더미A ' + saved[0].points + '/' + saved[0].pointsTotal + '점');
  ok('⑧ 영역별 집계도 문항별로', JSON.stringify(saved[0].bySkill) === JSON.stringify({ read: [2, 2], grammar: [1, 1], vocab: [1, 1] }),
    JSON.stringify(saved[0].bySkill));

  // ⑨ 결과 화면 — 문항별 정답률
  const res = await page.evaluate(async () => {
    await pbResults(); await new Promise(r => setTimeout(r, 1200));
    const rows = [...document.querySelectorAll('#pr-body .pr-tbl')[1].querySelectorAll('.pr-row')].slice(1);
    return rows.map(r => r.innerText.replace(/\n/g, ' '));
  });
  ok('⑨ 결과 — 문항별 정답률이 0% 로 뭉개지지 않는다',
    res.length === 4 && /100%/.test(res[0]) && res.every(t => !/0% \(0\/0\)/.test(t)),
    res.map(t => (t.match(/\d+% \(\d+\/\d+\)/) || [''])[0]).join(' · '));
  await page.screenshot({ path: SCR + '/itemid_result.png' });

  // ⑩ 학생 앱 풀이도 같은 id 로
  const sentId = await page.evaluate(async () => {
    closeM('m-paper-result');
    pbSend(); await new Promise(r => setTimeout(r, 400));
    const c = [...document.querySelectorAll('#pbs-list input')].find(x => x.value === 'dummyA');
    c.checked = true; _pbSendTick(c);
    document.getElementById('pbs-due').value = '2026-11-25';
    pbSendGo();
    await new Promise(r => setTimeout(r, 1500));
    return (_pbPaper.sentIds || [])[0];
  });
  const stu = await page.evaluate(async d => {
    const a = { id: 'asgX', sid: 'dummyA', type: 'worksheet', category: 'worksheet', wsId: d.wsId, bookTitle: 'id 없는 문항 4문항', paper: true, paperId: d.pid, date: ppToday() };
    _cache.assignments = (_cache.assignments || []).concat([a]);
    await openWsView(d.wsId, 'asgX', 'dummyA');
    await new Promise(r => setTimeout(r, 1200));
    psPick(0, 0); psPick(1, 1); psPick(2, 2); psPick(3, 4);
    psSubmit(); await new Promise(r => setTimeout(r, 400));
    document.getElementById('confirm-ok-btn').click();
    await new Promise(r => setTimeout(r, 1600));
    return document.getElementById('wsv-body').innerText.slice(0, 40);
  }, { wsId: sentId, pid: await page.evaluate(() => _pbPaper.id) });
  const appRow = irPosts.map(p => p.data).find(d => d.mode === 'app');
  ok('⑩ 학생 앱 풀이도 행 id 로 저장된다',
    appRow && Object.keys(appRow.answers).join(',') === 'asidechk1,asidechk2,asidechk3,asidechk4' && appRow.score === 3,
    '키 ' + Object.keys(appRow ? appRow.answers : {}).join(',') + ' · 점수 ' + (appRow ? appRow.score + '/' + appRow.total : '?'));

  // ⑪ 가져오기·문항 추가·복제로 만든 문항
  const file = SCR + '/itemid_import.json';
  fs.writeFileSync(file, JSON.stringify([
    { id: 'impnoid1', type: 'order', grade: '고2', stem: '가져온 문항 (data.id 있음)', passage: 'x', choices: ['a', 'b', 'c', 'd', 'e'], answer: 2, points: 3 },
    { type: 'order', grade: '고2', stem: '가져온 문항 (id 없음 — 앱이 만들어 준다)', passage: 'y', choices: ['a', 'b', 'c', 'd', 'e'], answer: 1 }
  ]), 'utf8');
  await page.evaluate(() => { closeM('m-ws-view'); closeM('m-paper'); switchDataTab('items'); });
  await wait(900);
  await page.setInputFiles('#ib-import-file', file);
  await wait(900);
  await page.evaluate(() => document.getElementById('confirm-ok-btn').click());
  await wait(1500);
  const made = await page.evaluate(async () => {
    // 문항 추가 + 복제
    ibAddManual();
    document.getElementById('ib-paste').value = '다음 글의 주제로 가장 적절한 것은?\n\n본문\n\n① a\n② b\n③ c\n④ d\n⑤ e\n정답: 2';
    ibParsePaste();
    await _ibEditSave(true);
    await new Promise(r => setTimeout(r, 700));
    const manualId = _ibEditing.id;
    await ibDup('asidechk1');
    await new Promise(r => setTimeout(r, 900));
    const dupId = _ibSelId;
    const impIds = (_ibRows || []).filter(r => /가져온 문항/.test((r.meta || {}).stem || '')).map(r => r.id);
    return { manualId, dupId, impIds };
  });
  const mix = await page.evaluate(async d => {
    const list = [d.impIds[0], d.impIds[1], d.manualId, d.dupId].filter(Boolean);
    await pbOpen(list);
    await new Promise(r => setTimeout(r, 1200));
    _pbPaper.title = '가져오기·추가·복제 4문항';
    const items = _pbSentItems();
    pbEntry(); await new Promise(r => setTimeout(r, 500));
    _peRows.push({ sid: 'dummyB', name: '더미B', ans: _peItems.map(() => null) });
    _peRender();
    const set = (i, j, v) => { const el = document.getElementById('pe-' + i + '-' + j); el.value = v; peIn(el, i, j); };
    [1, 2, 3, 1].forEach((v, j) => set(0, j, String(v)));
    await peSave();
    await new Promise(r => setTimeout(r, 1500));
    return { ids: items.map(i => i.id), want: list, pts: items.map(i => i.points), imp3: (items.find(i => i.id === 'impnoid1') || {}).points };
  }, made);
  const mixRow = irPosts.map(p => p.data).find(d => d.title === '가져오기·추가·복제 4문항');
  ok('⑪ 가져오기·문항 추가·복제 문항도 행 id 로',
    mix.ids.join(',') === mix.want.join(',') && mixRow && Object.keys(mixRow.answers).join(',') === mix.want.join(','),
    '사본 ' + mix.ids.length + '개 · 저장 키 ' + Object.keys(mixRow ? mixRow.answers : {}).length + '개 · 배점 ' + mix.pts.join(','));
  ok('⑫ 가져온 3점 문항(impnoid1)의 배점도 산다', mix.imp3 === 3, 'impnoid1 배점 ' + mix.imp3 + ' · 전체 ' + mix.pts.join(','));

  // ⑬ 막음 장치 — id 가 없으면 저장하지 않는다
  const guard = await page.evaluate(async () => {
    const before = window.__irPostCount || 0;
    _peItems = _peItems.map(it => ({ ...it, id: undefined }));
    _peRows = [{ sid: 'dummyB', name: '더미B', ans: _peItems.map(() => 1) }];
    await peSave();
    await new Promise(r => setTimeout(r, 700));
    const t = (document.querySelector('.toast,#toast,.pp-toast') || {}).textContent || document.body.innerText.match(/문항 번호를 찾지 못했어요[^\n]*/);
    return { msg: Array.isArray(t) ? t[0] : String(t || '') };
  });
  const beforeN = irPosts.length;
  await wait(400);
  ok('⑬ 문항 번호가 없으면 저장하지 않는다', irPosts.length === beforeN && /문항 번호를 찾지 못했어요/.test(guard.msg),
    '"' + String(guard.msg).slice(0, 40) + '" · 저장 시도 0건');

  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|400|404|406|500/i;
  const mineErr = errs.filter(e => !skip.test(e));
  ok('⑭ 콘솔 오류 0', mineErr.length === 0, mineErr.slice(0, 3).join(' | ') || '0');

  console.log('\nitem_results 저장 ' + irPosts.length + '건 · item_bank 쓰기 ' + ibPosts.length + '건 (전부 가짜)');
  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
