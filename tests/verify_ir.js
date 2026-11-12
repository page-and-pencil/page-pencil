require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 시험지 풀이·채점·결과 — 전부 가짜 서버. AI 는 부르지 않는다.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));
const t0 = 1762000000000;
const P = 'Reading widely does more than fill a shelf. It teaches a reader to hold two ideas at once. ';
const mk = (id, o) => Object.assign({
  id, type: 'blank', typeName: '읽기 · 빈칸 추론', skill: 'read', grade: '고1', diff: 3, diffSrc: 'rule',
  stem: '[' + id + '] 다음 빈칸에 들어갈 말은?', passage: P,
  choices: ['keep asking', 'memorize more', 'avoid problems', 'work alone', 'follow rules'],
  answer: 0, explain: '해설 ' + id + ' — 핵심을 바꿔 쓴 표현이 정답', wrong: ['① 정답', '② 재활용'], words: 16, points: 2,
  src: { kind: 'exam', exam: '2026 9월 모평' }, tags: [], star: false, checked: false, createdAt: t0, editedAt: t0
}, o);
const seed = [
  mk('q1'), mk('q2', { answer: 1, type: 'order', typeName: '읽기 · 글의 순서' }),
  mk('q3', { answer: 2, type: 'grammar', typeName: '읽기 · 어법', skill: 'grammar' }),
  mk('q4', { answer: 3, type: 'order', typeName: '읽기 · 글의 순서' }),
  mk('q5', { type: 'm_write_cond', typeName: '중등·내신 · 조건 영작', skill: 'write', choices: [], answer: -1, stem: '조건에 맞게 영작하시오.', answerText: 'I have lived here for ten years.', rubric: '현재완료 2점' }),
  mk('q6', { answer: 4, type: 'blank' }), mk('q7', { answer: 0, type: 'grammar', skill: 'grammar' }),
  mk('q8', { answer: 1, type: 'order' }), mk('q9', { answer: 2, type: 'blank' }), mk('q10', { answer: 3, type: 'blank' }),
  mk('keepx', { src: { kind: 'exam', keep: true, exam: '2025 수능' }, stem: '원문 지문 문항' })
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); ['pp_ib_filters', 'pp_item_basket', 'pp_paper_frames'].forEach(k => localStorage.removeItem(k)); } catch (e) { } });
  const page = await ctx.newPage();
  const IB = new Map(seed.map(d => [d.id, { id: d.id, data: d, updated_at: '2026-11-12T00:00:00+00:00' }]));
  const WS = new Map(), IR = new Map(), ASG = [], TESTS = [];
  let aiCalls = 0;
  const light = r => {
    const d = r.data || {}, p = String(d.passage || '');
    const m = { ...d, preview: p.slice(0, 180), hasPassage: !!d.passage };
    delete m.passage; delete m.explain; delete m.wrong; delete m.id;
    return { id: r.id, updated_at: r.updated_at, meta: m };
  };
  await page.route('**/rest/v1/item_bank**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST') return r.fulfill({ status: 201, body: '' });
    const sel = url.searchParams.get('select') || '';
    if (sel === 'updated_at') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + IB.size, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify([{ updated_at: '2026-11-12T00:00:00+00:00' }]) });
    let rows = [...IB.values()];
    const idq = url.searchParams.get('id');
    if (idq && idq.startsWith('eq.')) rows = rows.filter(x => x.id === decodeURIComponent(idq.slice(3)));
    else if (idq && idq.startsWith('in.(')) { const ids = idq.slice(4, -1).split(',').map(decodeURIComponent); rows = rows.filter(x => ids.indexOf(x.id) >= 0); }
    const out = sel.indexOf('meta') >= 0 ? rows.map(light) : sel === 'data' ? rows.map(x => ({ data: x.data }))
      : sel === 'id,data' ? rows.map(x => ({ id: x.id, data: x.data })) : rows.map(x => ({ id: x.id, updated_at: x.updated_at }));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await page.route('**/rest/v1/worksheets**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST') {
      let row = {}; try { row = JSON.parse(req.postData() || '{}'); } catch (e) { }
      if (row && row.id) WS.set(row.id, { id: row.id, data: row.data, updated_at: new Date().toISOString() });
      return r.fulfill({ status: 201, body: '' });
    }
    const idq = url.searchParams.get('id') || '';
    const acc = (req.headers()['accept'] || '');
    if (idq.startsWith('eq.')) {
      const row = WS.get(decodeURIComponent(idq.slice(3)));
      if (acc.includes('object+json')) return row ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row) }) : r.fulfill({ status: 406, body: '{}' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...WS.values()]) });
  });
  await page.route('**/rest/v1/item_results**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST') {
      let row = {}; try { row = JSON.parse(req.postData() || '{}'); } catch (e) { }
      if (row && row.id) IR.set(row.id, { id: row.id, sid: row.sid || '', data: row.data, updated_at: new Date().toISOString() });
      return r.fulfill({ status: 201, body: '' });
    }
    let rows = [...IR.values()];
    const sid = url.searchParams.get('sid');
    if (sid && sid.startsWith('eq.')) rows = rows.filter(x => x.sid === decodeURIComponent(sid.slice(3)));
    const pid = url.searchParams.get('data->>paperId');
    if (pid && pid.startsWith('eq.')) rows = rows.filter(x => (x.data || {}).paperId === decodeURIComponent(pid.slice(3)));
    const snt = url.searchParams.get('data->>sentId');
    if (snt && snt.startsWith('eq.')) rows = rows.filter(x => (x.data || {}).sentId === decodeURIComponent(snt.slice(3)));
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
  await page.route('**/functions/v1/claude-proxy', r => { if (r.request().method() === 'POST') aiCalls++; return r.fulfill({ status: 400, body: '{}' }); });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));
  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(1800);
  const aiBoot = aiCalls;
  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('items'); });
  await page.waitForFunction(() => document.querySelectorAll('#ib-list .ib-card').length > 0, null, { timeout: 60000 });
  await wait(800);
  // 시험용 더미 학생 — 화면 캐시에만 넣는다 (실학생·실DB 는 건드리지 않는다)
  const stu = await page.evaluate(() => {
    _cache.students = (_cache.students || []).concat([
      { id: 'dummyA', name: '더미A', active: true }, { id: 'dummyB', name: '더미B', active: true }]);
    return [{ id: 'dummyA', name: '더미A' }, { id: 'dummyB', name: '더미B' }];
  });
  ok('① 더미 학생 2명으로 시험한다 (실학생은 건드리지 않음)', stu.length === 2, stu.map(s => s.name).join(', '));

  // ── 원문 지문이 든 시험지는 보내지 못한다 ───────────────────────────
  const keepBlock = await page.evaluate(async () => {
    await pbOpen(['keepx', 'q1']); await new Promise(r => setTimeout(r, 900));
    pbSend(); await new Promise(r => setTimeout(r, 300));
    const msg = (document.getElementById('confirm-msg') || {}).textContent || '';
    const open = getComputedStyle(document.getElementById('m-paper-send')).display !== 'none';
    document.getElementById('confirm-ok-btn').click();
    return { msg, open };
  });
  ok('② 원문 지문이 든 시험지는 보내지 못한다', !keepBlock.open && /원문 지문/.test(keepBlock.msg), keepBlock.msg.replace(/\n/g, ' ').slice(0, 70));

  // ── 학생에게 보내기 ─────────────────────────────────────────────────
  const send = await page.evaluate(async sids => {
    await pbOpen(['q1', 'q2', 'q3', 'q4', 'q5']);
    await new Promise(r => setTimeout(r, 1000));
    _pbPaper.title = '중간 대비 5문항';
    pbSend(); await new Promise(r => setTimeout(r, 500));
    sids.forEach(id => { const c = [...document.querySelectorAll('#pbs-list input')].find(x => x.value === id); if (c) { c.checked = true; _pbSendTick(c); } });
    document.getElementById('pbs-due').value = '2026-11-20';
    await pbSendGo();
    await new Promise(r => setTimeout(r, 1200));
    return { n: _pbSendIds.length, closed: getComputedStyle(document.getElementById('m-paper-send')).display === 'none', sentIds: _pbPaper.sentIds || [] };
  }, stu.slice(0, 2).map(s => s.id));
  const sentRow = await page.evaluate(id => null, 0);
  const wsRows = await page.evaluate(() => null);
  const sentId = send.sentIds[send.sentIds.length - 1];
  const sent = await page.evaluate(async id => {
    const r = await fetch(SUPA_URL + '/rest/v1/worksheets?id=eq.' + id, { headers: SUPA_HEADERS });
    const rows = await r.json(); return (rows[0] || {}).data || null;
  }, sentId);
  const sol = await page.evaluate(async id => {
    const r = await fetch(SUPA_URL + '/rest/v1/worksheets?id=eq.' + id + '_sol', { headers: SUPA_HEADERS });
    const rows = await r.json(); return (rows[0] || {}).data || null;
  }, sentId);
  ok('③ 보내기 — 학생 수만큼 과제가 생긴다', send.closed && ASG.length === 2 && ASG.every(a => (a.data || {}).wsId === sentId && (a.data || {}).due === '2026-11-20'),
    '과제 ' + ASG.length + '건 · 마감 ' + ((ASG[0] || {}).data || {}).due + ' · 닫힘 ' + send.closed + ' · wsId 일치 ' + ASG.map(a => ((a.data||{}).wsId === sentId)).join(',') + ' · sentId ' + String(sentId).slice(0,10));
  ok('④ 보낸 사본에는 해설·오답 해설이 없다',
    sent && sent.kind === 'paperSent' && sent.items.length === 5 && sent.items.every(it => !('explain' in it) && !('wrong' in it)) && !JSON.stringify(sent).includes('핵심을 바꿔 쓴'),
    '문항 ' + (sent ? sent.items.length : 0) + '개 · 해설 없음 ✓');
  ok('⑤ 해설은 따로 된 줄(_sol)에 있다', sol && sol.kind === 'paperSol' && sol.items.length === 5 && /핵심을 바꿔 쓴/.test(JSON.stringify(sol)), 'ok');

  // ── 학생이 앱에서 풀기 ──────────────────────────────────────────────
  const sid0 = stu[0].id, asgn0 = (ASG.find(a => a.sid === sid0) || {}).data || {};
  const solve = await page.evaluate(async d => {
    _cache.assignments = (_cache.assignments || []).concat([d.a]);
    await openWsView(d.wsId, d.a.id, d.sid);
    await new Promise(r => setTimeout(r, 1200));
    const qs = document.querySelectorAll('#wsv-body .ps-q').length;
    const grp = document.querySelectorAll('#wsv-body .ps-grp').length;
    const btn0 = document.getElementById('ps-submit').textContent;
    psPick(0, 0); psPick(1, 1); psPick(2, 4); psType(4, '나의 답');   // 3번(q4)은 안 품
    await new Promise(r => setTimeout(r, 200));
    return { qs, grp, btn0, btn1: document.getElementById('ps-submit').textContent };
  }, { wsId: sentId, a: asgn0, sid: sid0 });
  ok('⑥ 학생 화면 — 한 쪽에 모아 풀기', solve.qs === 5 && /제출하기 — 안 푼 문항 5개/.test(solve.btn0) && /안 푼 문항 1개/.test(solve.btn1),
    '문항 ' + solve.qs + '개 · "' + solve.btn1 + '"');
  const sub = await page.evaluate(async () => {
    psSubmit();
    await new Promise(r => setTimeout(r, 400));
    const msg = (document.getElementById('confirm-msg') || {}).textContent || '';
    document.getElementById('confirm-ok-btn').click();
    await new Promise(r => setTimeout(r, 1500));
    const body = document.getElementById('wsv-body').innerText;
    return { msg, score: (body.match(/(\d+)\s*\/\s*(\d+)/) || []).slice(1, 3).join('/'), wrong: document.querySelectorAll('#wsv-body .ps-wrong').length, hasEx: /해설/.test(body), foot: document.getElementById('wsv-footer').innerText };
  });
  const irRows = await page.evaluate(async () => {
    const r = await fetch(SUPA_URL + '/rest/v1/item_results?select=id,sid,data', { headers: SUPA_HEADERS });
    return (await r.json()).map(x => ({ sid: x.sid, ...x.data }));
  });
  const mine = irRows.find(x => x.sid === sid0);
  ok('⑦ 제출 — 안 푼 문항을 알려 주고 객관식 자동 채점', /안 푼 문항이 1개/.test(sub.msg) && mine && mine.mode === 'app' && mine.total === 4 && mine.score === 2,
    '"' + sub.msg.replace(/\n/g, ' ').slice(0, 34) + '" · 점수 ' + (mine ? mine.score + '/' + mine.total : '?'));
  ok('⑧ 서술형은 매기지 않고 남겨 둔다', mine && mine.correct['q5'] === null && mine.answers['q5'] === '나의 답', 'q5 correct=null ✓');
  ok('⑨ 제출 뒤 틀린 문항과 해설이 보인다', sub.wrong === 2 && sub.hasEx && !/다시 풀기/.test(sub.foot),
    '틀린 문항 ' + sub.wrong + '개 · 해설 ' + (sub.hasEx ? '보임' : '없음') + ' · 다시 풀기 숨김 ✓');
  const retry = await page.evaluate(async d => {
    const a = (_cache.assignments || []).find(x => x.id === d.aid); a.retry = true;
    psPaintResult();
    return document.getElementById('wsv-footer').innerText;
  }, { aid: asgn0.id });
  ok('⑩ 다시 풀기는 선생님이 풀어 줄 때만', /다시 풀기/.test(retry), retry.replace(/\n/g, ' '));

  // ── 종이로 푼 답 넣기 ───────────────────────────────────────────────
  const entry = await page.evaluate(async sids => {
    closeM('m-ws-view');
    const slotsBefore = _pbSlots.length;
    pbEntry(); await new Promise(r => setTimeout(r, 500));
    const itemsAfter = _peItems.length;
    sids.forEach((sid, i) => {
      const s = (_cache.students || []).find(x => x.id === sid);
      _peRows.push({ sid: sid, name: (s && s.name) || '학생', ans: _peItems.map(() => null) });
    });
    _peRender();
    // 1번 학생: 1,2,3,4 + 서술형 / 2번 학생: 1,1,1,1
    const miss = [];
    const set = (i, j, v) => { const el = document.getElementById('pe-' + i + '-' + j); if (!el) { miss.push(i + '-' + j); return; } el.value = v; peIn(el, i, j); };
    if (!document.getElementById('pe-0-0')) return { bail: true, slotsBefore, itemsAfter, rows: _peRows.length, grid: (document.getElementById('pe-grid') || {}).innerHTML ? (document.getElementById('pe-grid').innerHTML.slice(0, 200)) : '(없음)' };
    set(0, 0, '1'); set(0, 1, '2'); set(0, 2, '3'); set(0, 3, '4');
    const t1 = document.getElementById('pe-0-4'); t1.value = '종이에 쓴 답'; peIn(t1, 0, 4);
    set(1, 0, '1'); set(1, 1, '1'); set(1, 2, '1'); set(1, 3, '1');   // 더미B 는 1번만 맞는다
    const focusAfter = document.activeElement ? document.activeElement.id : '';
    document.getElementById('pe-astest').checked = true;
    await peSave();
    await new Promise(r => setTimeout(r, 1500));
    return { focusAfter, slotsBefore, itemsAfter, closed: !document.getElementById('m-paper-entry').classList.contains('open') };
  }, stu.slice(0, 2).map(s => s.id));
  const irRows2 = await page.evaluate(async () => {
    const r = await fetch(SUPA_URL + '/rest/v1/item_results?select=id,sid,data', { headers: SUPA_HEADERS });
    return (await r.json()).map(x => ({ id: x.id, sid: x.sid, ...x.data }));
  });
  const paperRows = irRows2.filter(x => x.mode === 'paper');
  if (entry.bail) console.log('진단:', JSON.stringify(entry));
  ok('⑪ 1~5 키로 넣고 다음 칸으로 넘어간다', entry.focusAfter === 'pe-1-4', '마지막 포커스 ' + entry.focusAfter + ' · 시험지 칸 ' + entry.slotsBefore + ' · 답 칸 ' + entry.itemsAfter);
  ok('⑫ 종이 답 — 채점해서 저장 (mode:paper)', paperRows.length === 2 && paperRows[0].total === 4 && paperRows.some(r => r.score === 4) && paperRows.some(r => r.score === 1),
    paperRows.map(r => r.score + '/' + r.total).join(' · '));
  const tt = (TESTS[0] || {}).data || {};
  ok('⑬ 자체 시험으로 기록 (tests 줄 · 영역별)',
    TESTS.length === 2 && TESTS.every(t => (t.data || {}).src === 'paper' && (t.data || {}).testKind === undefined) &&
    tt.readingTotal === 3 && tt.grammarTotal === 1,
    'tests ' + TESTS.length + '줄 · 읽기 ' + tt.readingCorrect + '/' + tt.readingTotal + ' · 어법 ' + tt.grammarCorrect + '/' + tt.grammarTotal);

  // ── 결과 ────────────────────────────────────────────────────────────
  const res = await page.evaluate(async () => {
    await pbResults(); await new Promise(r => setTimeout(r, 1200));
    const t = document.getElementById('pr-body').innerText;
    return {
      rows: document.querySelectorAll('#pr-body .pr-tbl')[0].querySelectorAll('.pr-row').length - 1,
      items: document.querySelectorAll('#pr-body .pr-tbl')[1].querySelectorAll('.pr-row').length - 1,
      txt: t.slice(0, 400), hasRate: /%/.test(t), hasWrong: /①|②|③|④|⑤/.test(t)
    };
  });
  // 같은 학생의 여러 번은 한 줄로 묶인다 (더미A 는 앱+종이 두 번 → 한 줄)
  ok('⑭ 결과 표 — 학생별(묶음)·문항별', res.rows === 2 && res.items === 5 && res.hasRate && res.hasWrong,
    '학생 ' + res.rows + '줄 · 문항 ' + res.items + '줄');
  const grade = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll('#pr-body button')].find(b => /서술형 채점/.test(b.textContent));
    const had = !!btn; if (btn) btn.click();
    await new Promise(r => setTimeout(r, 400));
    const okBtn = [...document.querySelectorAll('#pr-body .pr-g-b button')][0];
    if (okBtn) okBtn.click();
    await new Promise(r => setTimeout(r, 300));
    const save = [...document.querySelectorAll('#pr-body button')].find(b => /채점 저장/.test(b.textContent));
    if (save) save.click();
    await new Promise(r => setTimeout(r, 900));
    return { had };
  });
  const after = await page.evaluate(async () => {
    const r = await fetch(SUPA_URL + '/rest/v1/item_results?select=id,sid,data', { headers: SUPA_HEADERS });
    return (await r.json()).map(x => x.data).filter(d => d.correct && d.correct['q5'] !== null && d.correct['q5'] !== undefined);
  });
  ok('⑮ 서술형은 선생님이 맞음·틀림을 누른다', grade.had && after.length >= 1 && after[0].score >= 3,
    '채점 뒤 점수 ' + (after[0] ? after[0].score + '/' + after[0].total : '?'));
  const weak = await page.evaluate(async () => {
    await pbResults(); await new Promise(r => setTimeout(r, 900));
    const rows = [...document.querySelectorAll('#pr-body .pr-tbl')[0].querySelectorAll('.pr-row')];
    const row = rows.find(x => /더미B/.test(x.innerText));
    const btn = row ? [...row.querySelectorAll('button')].find(b => /틀린 유형 연습/.test(b.textContent)) : null;
    if (!btn) return { had: false };
    btn.click();
    await new Promise(r => setTimeout(r, 1500));
    return { had: true, title: (_pbPaper || {}).title || '', n: (_pbSlots || []).length, ids: (_pbSlots || []).map(s => s.id) };
  });
  ok('⑯ 틀린 유형 연습 묶음 (AI 없음)', weak.had && weak.n > 0 && /틀린 유형 연습/.test(weak.title) && aiCalls === aiBoot,
    '"' + weak.title + '" · ' + weak.n + '문항 · AI ' + (aiCalls - aiBoot) + '회');

  // ── 진단 ────────────────────────────────────────────────────────────
  const diag = await page.evaluate(async () => {
    await pbOpen(['q1', 'q2', 'q3']);
    await new Promise(r => setTimeout(r, 900));
    _pbPaper.title = '진단 테스트'; pbSetPurpose('diag');
    pbEntry(); await new Promise(r => setTimeout(r, 400));
    const shown = document.getElementById('pe-diag').style.display !== 'none';
    _peRows.push({ sid: 'diag_' + uid(), name: '김미래', diag: true, ans: _peItems.map(() => null) });
    _peRender();
    const set = (i, j, v) => { const el = document.getElementById('pe-' + i + '-' + j); el.value = v; peIn(el, i, j); };
    set(0, 0, '1'); set(0, 1, '2'); set(0, 2, '5');
    await peSave();
    await new Promise(r => setTimeout(r, 1500));
    window.__printed = [];
    window.open = () => { let buf = ''; return { document: { write(s) { buf += s; }, close() { window.__printed.push(buf); } } }; };
    await pbResults(); await new Promise(r => setTimeout(r, 900));
    const hasBtn = !!([...document.querySelectorAll('#pr-body button')].find(b => /진단 결과지/.test(b.textContent)));
    prPrintDiag();
    await new Promise(r => setTimeout(r, 300));
    return { shown, hasBtn, html: (window.__printed[0] || '') };
  });
  const diagRows = await page.evaluate(async () => {
    const r = await fetch(SUPA_URL + '/rest/v1/item_results?select=id,sid,data', { headers: SUPA_HEADERS });
    return (await r.json()).filter(x => String(x.sid).indexOf('diag_') === 0).map(x => ({ sid: x.sid, ...x.data }));
  });
  ok('⑰ 진단 — 이름만으로 넣고 sid 는 diag_', diag.shown && diagRows.length === 1 && diagRows[0].name === '김미래' && !diagRows[0].phone,
    'sid ' + (diagRows[0] || {}).sid + ' · 이름 ' + (diagRows[0] || {}).name);
  ok('⑱ 진단 결과지 인쇄 (점수·유형별 정답률·의견 칸)',
    diag.hasBtn && /진단 결과/.test(diag.html) && /선생님 의견/.test(diag.html) && /정답률/.test(diag.html) && !/연락처/.test(diag.html),
    'ok');

  // ── 학부모 화면 ─────────────────────────────────────────────────────
  const par = await page.evaluate(async sid => {
    const d = document.createElement('div'); d.id = 'pp-paper-card'; document.body.appendChild(d);
    await ppPaperCard(sid);
    await new Promise(r => setTimeout(r, 600));
    const t = d.innerText;
    const html = d.innerHTML;
    d.remove();
    return { t, leak: /빈칸에 들어갈|Reading widely|해설/.test(html) };
  }, sid0);
  ok('⑲ 학부모 — 점수와 영역 요약만 (문항 원문 없음)',
    /시험지 결과/.test(par.t) && /%/.test(par.t) && /읽기|어법|쓰기/.test(par.t) && !par.leak,
    par.t.replace(/\n/g, ' / ').slice(0, 80));

  // ── 학생 상세의 약점 카드 ──────────────────────────────────────────
  const weakCard = await page.evaluate(async sid => {
    const d = document.createElement('div'); d.id = 'stu-weak-card2'; document.body.appendChild(d);
    await irWeakCard(sid, 'stu-weak-card2');
    await new Promise(r => setTimeout(r, 500));
    const t = d.innerText; d.remove();
    return t;
  }, sid0);
  ok('⑳ 학생 상세 — 유형별 약점 카드 (문항 5개 미만 유형은 숨김)',
    /유형별 약점/.test(weakCard) || weakCard === '', weakCard ? weakCard.replace(/\n/g, ' / ').slice(0, 70) : '(문항이 적어 숨김)');

  // ── 마무리 ─────────────────────────────────────────────────────────
  await page.evaluate(() => { closeM('m-paper-result'); closeM('m-paper'); });
  const over = async w => { await page.setViewportSize({ width: w, height: 844 }); await wait(700); return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)); };
  const o390 = await over(390), o320 = await over(320);
  await page.setViewportSize({ width: 1440, height: 900 });
  ok('㉑ 넘침 0 (390·320)', o390 === 0 && o320 === 0, o390 + ' / ' + o320);
  ok('㉒ AI 호출 0회', aiCalls === aiBoot, (aiCalls - aiBoot) + '회');
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|400|404|406/i;
  const mineErr = errs.filter(e => !skip.test(e));
  ok('㉓ 콘솔 오류 0', mineErr.length === 0, mineErr.slice(0, 3).join(' | ') || '0');

  console.log('\nitem_results ' + IR.size + '줄 · worksheets ' + WS.size + '줄 · assignments ' + ASG.length + '건 · tests ' + TESTS.length + '줄 (전부 가짜)');
  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
