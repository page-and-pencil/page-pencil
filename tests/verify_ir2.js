require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 2차 확인 — 자체 시험 영역별·다시 풀기·듣기 대본·표 없음 가드·줄 휴지통·완료 옆 점수·sid·학생 화면 회귀
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));
const t0 = 1762000000000;
const P = 'Reading widely does more than fill a shelf. It teaches a reader to hold two ideas at once.';
const mk = (id, o) => Object.assign({
  id, type: 'blank', typeName: '읽기 · 빈칸 추론', skill: 'read', grade: '고1', diff: 3,
  stem: '[' + id + '] 다음 빈칸에 들어갈 말은?', passage: P, choices: ['a', 'b', 'c', 'd', 'e'], answer: 0,
  explain: '해설 ' + id, wrong: [], words: 15, points: 2, src: { kind: 'exam' }, tags: [], createdAt: t0, editedAt: t0
}, o);
const seed = [
  mk('r1'), mk('r2', { answer: 1 }),
  mk('g1', { type: 'grammar', typeName: '읽기 · 어법', skill: 'grammar', answer: 2 }),
  mk('v1', { type: 'vocab', typeName: '읽기 · 어휘 쓰임', skill: 'vocab', answer: 3 }),
  mk('l1', { type: 'l_purpose', typeName: '듣기 · 목적', skill: 'listen', answer: 1, passage: '', script: 'W: Good morning. I am happy to tell you about our reading club.' }),
  mk('w1', { type: 'm_write_cond', typeName: '중등·내신 · 조건 영작', skill: 'write', choices: [], answer: -1, stem: '조건에 맞게 영작하시오.', answerText: 'I have lived here.' })
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); ['pp_item_basket', 'pp_ib_filters'].forEach(k => localStorage.removeItem(k)); } catch (e) { } });
  const page = await ctx.newPage();
  const IB = new Map(seed.map(d => [d.id, { id: d.id, data: d, updated_at: '2026-11-12T00:00:00+00:00' }]));
  const WS = new Map(), IR = new Map();
  let TESTS = [], ASG = [], irPosts = [], irGets = [], irTableOk = true;
  const light = r => { const d = r.data || {}; const m = { ...d, preview: String(d.passage || d.script || '').slice(0, 180), hasPassage: !!d.passage }; delete m.passage; delete m.explain; delete m.wrong; delete m.script; delete m.id; return { id: r.id, updated_at: r.updated_at, meta: m }; };
  await page.route('**/rest/v1/item_bank**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST') return r.fulfill({ status: 201, body: '' });
    const sel = url.searchParams.get('select') || '';
    if (sel === 'updated_at') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + IB.size, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify([{ updated_at: '2026-11-12T00:00:00+00:00' }]) });
    let rows = [...IB.values()];
    const idq = url.searchParams.get('id');
    if (idq && idq.startsWith('in.(')) { const ids = idq.slice(4, -1).split(',').map(decodeURIComponent); rows = rows.filter(x => ids.indexOf(x.id) >= 0); }
    const out = sel.indexOf('meta') >= 0 ? rows.map(light) : sel === 'id,data' ? rows.map(x => ({ id: x.id, data: x.data })) : sel === 'data' ? rows.map(x => ({ data: x.data })) : rows.map(x => ({ id: x.id, updated_at: x.updated_at }));
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
    if (!irTableOk) return r.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"relation \\"public.item_results\\" does not exist"}' });
    if (req.method() === 'POST') {
      let row = {}; try { row = JSON.parse(req.postData() || '{}'); } catch (e) { }
      irPosts.push(row);
      if (row && row.id) IR.set(row.id, { id: row.id, sid: row.sid || '', data: row.data, updated_at: new Date().toISOString() });
      return r.fulfill({ status: 201, body: '' });
    }
    irGets.push(req.url());
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
  await page.route('**/rest/v1/tests**', async r => {
    if (r.request().method() === 'POST') { try { TESTS.push(JSON.parse(r.request().postData() || '{}')); } catch (e) { } return r.fulfill({ status: 201, body: '' }); }
    return r.continue();
  });
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
  await wait(1500);

  // ── 표가 없을 때 ───────────────────────────────────────────────────
  irTableOk = false;
  const noTable = await page.evaluate(async () => {
    await pbOpen(['r1', 'r2']); await new Promise(r => setTimeout(r, 900));
    _pbPaper.title = '표 없음 시험';
    await pbResults(); await new Promise(r => setTimeout(r, 800));
    const flagA = _irNoTable;
    const saved = await irPut('x1', { paperId: 'p', score: 1 }, 'dummyA');
    return { flagA, flagB: _irNoTable, saved, ls: Object.keys(localStorage).filter(k => /irNoTable|ir_no/i.test(k)).length };
  });
  ok('① 표가 없으면 쓰기를 멈춘다 (세션 안에서만)', noTable.flagA === true && noTable.saved === false && noTable.ls === 0,
    '표식 ' + noTable.flagA + ' · 저장 ' + noTable.saved + ' · localStorage 흔적 ' + noTable.ls + '개');
  irTableOk = true;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(1800);
  await page.evaluate(() => {
    _cache.students = (_cache.students || []).concat([{ id: 'dummyA', name: '더미A', active: true }, { id: 'dummyB', name: '더미B', active: true }]);
    show('s-teacher'); swTab('t-data'); switchDataTab('items');
  });
  await wait(1500);
  const cleared = await page.evaluate(() => _irNoTable);
  ok('② 새로고침하면 바로 풀린다', cleared === false, '_irNoTable=' + cleared);

  // ── 듣기 문항 알림 ─────────────────────────────────────────────────
  const listen = await page.evaluate(async () => {
    await pbOpen(['r1', 'g1', 'v1', 'l1', 'w1']); await new Promise(r => setTimeout(r, 1100));
    _pbPaper.title = '영역별 5문항';
    pbSend(); await new Promise(r => setTimeout(r, 400));
    ['dummyA', 'dummyB'].forEach(id => { const c = [...document.querySelectorAll('#pbs-list input')].find(x => x.value === id); if (c) { c.checked = true; _pbSendTick(c); } });
    document.getElementById('pbs-due').value = '2026-11-25';
    pbSendGo();
    await new Promise(r => setTimeout(r, 400));
    const msg = (document.getElementById('confirm-msg') || {}).textContent || '';
    const title = (document.getElementById('confirm-title') || {}).textContent || '';
    return { msg, title };
  });
  ok('③ 듣기 문항이 있으면 먼저 알린다', /듣기 문항 1개는 음원이 없어요/.test(listen.msg) && /듣기 문항이 있어요/.test(listen.title),
    '"' + listen.msg.replace(/\n/g, ' ') + '"');
  await wait(500);
  await page.screenshot({ path: SCR + '/ir2_listen_warn.png' });
  const sentId = await page.evaluate(async () => {
    document.getElementById('confirm-ok-btn').click();
    await new Promise(r => setTimeout(r, 1500));
    return (_pbPaper.sentIds || [])[0];
  });
  ok('④ 확인하면 보내진다', !!sentId && ASG.length === 2, '사본 ' + String(sentId).slice(0, 8) + ' · 과제 ' + ASG.length + '건');

  // ── 학생 풀이 — 대본은 안 보이고, 제출 뒤 결과에만 ─────────────────
  const asgnA = (ASG.find(a => a.sid === 'dummyA') || {}).data || {};
  const solve = await page.evaluate(async d => {
    _cache.assignments = (_cache.assignments || []).concat([d.a]);
    await openWsView(d.wsId, d.a.id, 'dummyA');
    await new Promise(r => setTimeout(r, 1200));
    const html = document.getElementById('wsv-body').innerHTML;
    psPick(0, 0); psPick(1, 2); psPick(2, 3); psPick(3, 1); psType(4, '내 답');
    return { leak: /Good morning|reading club/.test(html), guide: /듣기 문항 — 선생님이 들려주세요/.test(html) };
  }, { wsId: sentId, a: asgnA });
  ok('⑤ 푸는 동안 듣기 대본은 보이지 않는다', !solve.leak && solve.guide, '대본 노출 ' + solve.leak + ' · 안내 ' + solve.guide);
  const sub = await page.evaluate(async () => {
    psSubmit(); await new Promise(r => setTimeout(r, 400));
    document.getElementById('confirm-ok-btn').click();
    await new Promise(r => setTimeout(r, 1600));
    const html = document.getElementById('wsv-body').innerHTML;
    return { script: /Good morning/.test(html) && /듣기 대본/.test(html), score: (document.getElementById('wsv-body').innerText.match(/(\d+)\s*\/\s*(\d+)/) || []).slice(1, 3).join('/') };
  });
  ok('⑥ 제출한 뒤 결과에서는 대본이 보인다', sub.script, '점수 ' + sub.score);
  await page.screenshot({ path: SCR + '/ir2_student_script.png' });

  // ── sid 는 늘 붙는다 ───────────────────────────────────────────────
  const sidOk = irPosts.every(p => !!p.sid);
  const getsOk = irGets.filter(u => /sid=eq\./.test(u)).length;
  ok('⑦ 결과를 쓸 때 sid 를 늘 넣는다', irPosts.length > 0 && sidOk, '쓰기 ' + irPosts.length + '건 · sid 빠진 것 ' + irPosts.filter(p => !p.sid).length + '건');
  ok('⑧ 학생·학부모 쪽 읽기는 sid 로 거른다', getsOk > 0, 'sid 로 거른 읽기 ' + getsOk + '회 / 전체 ' + irGets.length + '회');

  // ── 자체 시험으로 기록 — 영역별 ────────────────────────────────────
  const asTest = await page.evaluate(async () => {
    closeM('m-ws-view');
    await pbResults(); await new Promise(r => setTimeout(r, 1000));
    const cb = document.getElementById('pr-astest'); cb.checked = true;
    await prAsTestAll(true);
    await new Promise(r => setTimeout(r, 1200));
    return true;
  });
  const t = (TESTS[0] || {}).data || {};
  ok('⑨ 자체 시험은 영역별로 나눠 들어간다',
    TESTS.length === 1 && t.readingTotal === 1 && t.grammarTotal === 1 && t.vocabTotal === 1 && t.listeningTotal === 1 && t.testKind === undefined,
    '읽기 ' + t.readingCorrect + '/' + t.readingTotal + ' · 어법 ' + t.grammarCorrect + '/' + t.grammarTotal +
    ' · 어휘 ' + t.vocabCorrect + '/' + t.vocabTotal + ' · 듣기 ' + t.listeningCorrect + '/' + t.listeningTotal);
  ok('⑩ 서술형은 넣지 않고, 이름·종류는 시험지 제목·자체', !('writeTotal' in t) && t.title === '영역별 5문항' && t.src === 'paper',
    '제목 "' + t.title + '" · testKind ' + (t.testKind || '(자체)'));

  // ── 다시 풀기 열기 · 회차 표시 ─────────────────────────────────────
  const retry = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll('#pr-body button')].find(b => /다시 풀기 열기/.test(b.textContent));
    const had = !!btn; if (btn) btn.click();
    await new Promise(r => setTimeout(r, 900));
    const a = (_cache.assignments || []).find(x => x.sid === 'dummyA' && x.paperId === _prPaper.id);
    return { had, retry: !!(a && a.retry) };
  });
  ok('⑪ 다시 풀기 열기 (과제 retry 켜기)', retry.had && retry.retry, '단추 ' + retry.had + ' · retry ' + retry.retry);
  const again = await page.evaluate(async d => {
    await openWsView(d.wsId, d.aid, 'dummyA');
    await new Promise(r => setTimeout(r, 1200));
    const foot = document.getElementById('wsv-footer').innerText;
    const btn = [...document.querySelectorAll('#wsv-footer button')].find(b => /다시 풀기/.test(b.textContent));
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 500));
    psPick(0, 0); psPick(1, 1); psPick(2, 2); psPick(3, 3); psType(4, '두 번째 답');
    psSubmit(); await new Promise(r => setTimeout(r, 400));
    document.getElementById('confirm-ok-btn').click();
    await new Promise(r => setTimeout(r, 1600));
    return { foot, score: (document.getElementById('wsv-body').innerText.match(/(\d+)\s*\/\s*(\d+)/) || []).slice(1, 3).join('/') };
  }, { wsId: sentId, aid: asgnA.id });
  const rowsA = [...IR.values()].filter(x => x.sid === 'dummyA');
  ok('⑫ 다시 풀면 새 줄로 저장된다', /다시 풀기/.test(again.foot) && rowsA.length === 2, '더미A 결과 ' + rowsA.length + '줄 · 두 번째 점수 ' + again.score);
  const tries = await page.evaluate(async () => {
    irForget(_prPaper.id);
    await pbResults(); await new Promise(r => setTimeout(r, 1000));
    const rows = [...document.querySelectorAll('#pr-body .pr-tbl')[0].querySelectorAll('.pr-row')].slice(1);
    return { n: rows.length, txt: rows.map(r => r.innerText.replace(/\n/g, ' ')).join(' | ') };
  });
  ok('⑬ 결과 표에는 가장 최근 것만 · 2회째 표시', tries.n === 1 && /2회째/.test(tries.txt) && /1\/4/.test(tries.txt), '줄 ' + tries.n + '개 · ' + tries.txt.slice(0, 80));

  // ── 줄 휴지통 ──────────────────────────────────────────────────────
  const trash = await page.evaluate(async () => {
    const before = _prRows.length;
    const btn = [...document.querySelectorAll('#pr-body .pr-bt button')].find(b => b.textContent === '×');
    const had = !!btn; if (btn) btn.click();
    await new Promise(r => setTimeout(r, 400));
    document.getElementById('confirm-ok-btn').click();
    await new Promise(r => setTimeout(r, 1200));
    return { had, before, after: _prRows.length };
  });
  const deleted = [...IR.values()].filter(x => (x.data || {})._deleted).length;
  ok('⑭ 결과 줄 휴지통 (soft delete)', trash.had && trash.after === trash.before - 1 && deleted === 1,
    '줄 ' + trash.before + '→' + trash.after + ' · _deleted 표식 ' + deleted + '건');

  // ── 과제 완료 옆 점수 ──────────────────────────────────────────────
  const score = await page.evaluate(async d => {
    closeM('m-paper-result');
    const box = document.createElement('div');
    box.innerHTML = '<span data-asg-paper="' + d.pid + '" data-asg-sid="dummyA"></span>';
    document.body.appendChild(box);
    await irPaintAsgnScores();
    await new Promise(r => setTimeout(r, 600));
    const t = box.innerText; box.remove();
    return t;
  }, { pid: await page.evaluate(() => _prPaper.id) });
  ok('⑮ 과제 완료 옆에 점수', /점수 \d+\/\d+/.test(score), '"' + score.trim() + '"');

  // ── 학생 화면 회귀 (숙제 카드·워크시트·동형) ───────────────────────
  const reg = await page.evaluate(async () => {
    const out = {};
    // 일반 워크시트
    const plain = { id: 'wsPlain', title: '일반 워크시트', gradeLevel: '중2', passageType: 'literature', passage: '옛 지문', sections: { comp: { questions: [{ question: '무엇을?' }] } }, sectionIds: ['comp'] };
    const iso = { id: 'wsIso', kind: 'iso', title: '동형 묶음', gradeLevel: '고1', isoTypeName: '읽기 · 빈칸 추론', items: [{ id: 'i1', stem: '동형 발문', passage: '동형 지문', choices: ['a', 'b'], answer: 0 }] };
    await fetch(SUPA_URL + '/rest/v1/worksheets', { method: 'POST', headers: { ...SUPA_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 'wsPlain', data: plain }) });
    await fetch(SUPA_URL + '/rest/v1/worksheets', { method: 'POST', headers: { ...SUPA_HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 'wsIso', data: iso }) });
    _cache.assignments = (_cache.assignments || []).concat([
      { id: 'asgP', sid: 'dummyA', type: 'worksheet', category: 'worksheet', wsId: 'wsPlain', bookTitle: '일반 워크시트', date: ppToday() },
      { id: 'asgI', sid: 'dummyA', type: 'worksheet', category: 'worksheet', wsId: 'wsIso', bookTitle: '동형 묶음', date: ppToday() }]);
    await openWsView('wsPlain', 'asgP', 'dummyA'); await new Promise(r => setTimeout(r, 900));
    out.plain = document.getElementById('wsv-body').innerText.slice(0, 60);
    out.plainOk = /옛 지문|무엇을/.test(document.getElementById('wsv-body').innerText);
    await openWsView('wsIso', 'asgI', 'dummyA'); await new Promise(r => setTimeout(r, 900));
    out.isoOk = /동형 발문/.test(document.getElementById('wsv-body').innerText) && /다 풀었어요/.test(document.getElementById('wsv-footer').innerText);
    out.fns = ['renderHomeworkTab', 'openWsView', 'completeAssignment', 'renderVocabDeck', 'psOpen']
      .map(f => typeof window[f] === 'function' ? 1 : 0).join('');
    closeM('m-ws-view');
    return out;
  });
  ok('⑯ 학생 화면 회귀 — 일반 워크시트·동형 보기 그대로', reg.plainOk && reg.isoOk, '일반 ' + reg.plainOk + ' · 동형 ' + reg.isoOk);
  ok('⑰ 학생 쪽 함수가 그대로 있다', reg.fns === '11111', 'renderHomeworkTab·openWsView·completeAssignment·renderVocabDeck·psOpen = ' + reg.fns);

  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|400|404|406/i;
  const mineErr = errs.filter(e => !skip.test(e));
  ok('⑱ 콘솔 오류 0', mineErr.length === 0, mineErr.slice(0, 3).join(' | ') || '0');

  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
