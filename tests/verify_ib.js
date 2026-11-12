require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 문제 은행 — 화면·흐름 확인. AI 와 DB 는 모두 가짜. 진짜 돈·실DB 를 쓰지 않는다.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));

// 가짜 은행 — 서버에 이미 들어 있는 문항
const TYPES = ['blank', 'order', 'grammar', 'l_purpose', 'm_write_cond', 'vocab'];
const GRADES = ['중2', '중3', '고1', '고2'];
const seed = Array.from({ length: 36 }, (_, i) => {
  const type = TYPES[i % TYPES.length];
  const d = {
    id: 'seed' + String(i + 1).padStart(3, '0'), type,
    typeName: '', grade: GRADES[i % GRADES.length],
    rate: (i % 3 === 0) ? (40 + (i % 5) * 10) : null, points: 2,
    stem: '씨앗 발문 ' + (i + 1) + ' — 다음 글의 빈칸에 들어갈 말은?',
    passage: 'Seed passage ' + (i + 1) + '. The quick brown fox jumps over the lazy dog near the quiet river. '.repeat(3) + ((i % 6 === 0) ? ' ZEBRAWORD ends here.' : ''),
    choices: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'], answer: i % 5,
    explain: '해설 ' + (i + 1), wrong: [], words: 40,
    src: { kind: (i % 4 === 0) ? 'exam' : (i % 4 === 1) ? 'iso' : (i % 4 === 2) ? 'book' : 'manual', exam: (i % 4 === 0) ? '2026학년도 9월 모의평가 영어' : '', qno: String(20 + i) },
    tags: (i % 5 === 0) ? ['1학기중간'] : [], star: (i % 7 === 0), checked: (i % 3 === 0),
    createdAt: 1762000000000 + i * 1000, editedAt: 1762000000000 + i * 1000
  };
  return d;
});
const ANALYZE = { type: 'blank', typeName: '빈칸 추론', stem: '다음 빈칸에 들어갈 말로 가장 적절한 것은?', passage: 'Original passage. '.repeat(20), choices: ['a', 'b', 'c', 'd', 'e'], answer: 2, evidence: 'x', points: ['주제문'], words: 175, level: '고1 수준', distractors: '재활용' };
const mkItems = n => Array.from({ length: n }, (_, i) => ({
  stem: '만든 발문 ' + (i + 1), passage: 'Made passage ' + (i + 1) + ' about curiosity. '.repeat(10),
  choices: ['keep asking', 'memorize', 'avoid', 'work alone', 'follow'], answer: i % 5,
  explain: '해설', intent: '의도', wrong: ['①', '②']
}));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();

  const DB = new Map(seed.map(d => [d.id, { id: d.id, data: d, updated_at: '2026-11-10T00:00:00+00:00' }]));
  let posts = [], wsPosts = [], aiCalls = 0, ibBytes = 0, ibReq = 0;
  const light = r => {
    const d = r.data || {}, p = String(d.passage || d.script || '');
    const m = {
      skill: d.skill, type: d.type, typeName: d.typeName, grade: d.grade, diff: d.diff, diffSrc: d.diffSrc,
      rate: d.rate, points: d.points, stem: d.stem, preview: p.slice(0, 180), choices: d.choices, answer: d.answer,
      words: d.words, src: d.src, tags: d.tags, setId: d.setId, setOrder: d.setOrder,
      star: d.star || null, checked: d.checked || null, note: d.note, createdAt: d.createdAt, editedAt: d.editedAt,
      hasPassage: !!d.passage, hasScript: !!d.script
    };
    Object.keys(m).forEach(k => { if (m[k] === null || m[k] === undefined || m[k] === '') delete m[k]; });
    return { id: r.id, updated_at: r.updated_at, meta: m };
  };
  await page.route('**/rest/v1/item_bank**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST') {
      let b = []; try { b = JSON.parse(req.postData() || '[]'); } catch (e) { }
      (Array.isArray(b) ? b : [b]).forEach(row => {
        posts.push(row);
        if (row && row.id) DB.set(row.id, { id: row.id, data: row.data, updated_at: row.updated_at || new Date().toISOString() });
      });
      return r.fulfill({ status: 201, body: '' });
    }
    const sel = url.searchParams.get('select') || '';
    ibReq++;
    if (sel === 'updated_at') {
      const mx = [...DB.values()].map(x => x.updated_at).sort().reverse()[0] || '';
      const body = JSON.stringify([{ updated_at: mx }]);
      ibBytes += Buffer.byteLength(body);
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + DB.size, 'access-control-expose-headers': 'content-range' }, body });
    }
    let rows = [...DB.values()].filter(x => !(x.data || {})._deleted);
    const idq = url.searchParams.get('id');
    if (idq && idq.startsWith('eq.')) rows = rows.filter(x => x.id === decodeURIComponent(idq.slice(3)));
    else if (idq && idq.startsWith('in.(')) { const ids = idq.slice(4, -1).split(',').map(decodeURIComponent); rows = rows.filter(x => ids.indexOf(x.id) >= 0); }
    const orq = url.searchParams.get('or');
    if (orq) { const m = orq.match(/ilike\.\*(.+?)\*/); const q = m ? decodeURIComponent(m[1]).toLowerCase() : ''; rows = rows.filter(x => JSON.stringify(x.data).toLowerCase().includes(q)); }
    let out;
    if (sel.indexOf('meta') >= 0) out = rows.map(light);
    else if (sel === 'id,updated_at') out = rows.map(x => ({ id: x.id, updated_at: x.updated_at }));
    else if (sel === 'id') out = rows.map(x => ({ id: x.id }));
    else if (sel === 'data') out = rows.map(x => ({ data: x.data }));
    else if (sel === 'id,data') out = rows.map(x => ({ id: x.id, data: x.data }));
    else out = rows;
    const body = JSON.stringify(out);
    ibBytes += Buffer.byteLength(body);
    return r.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await page.route('**/rest/v1/worksheets**', async r => {
    if (r.request().method() === 'POST') { try { wsPosts.push(JSON.parse(r.request().postData() || '{}')); } catch (e) { } return r.fulfill({ status: 201, body: '' }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/functions/v1/claude-proxy', async r => {
    let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
    if (!body.model) return r.fulfill({ status: 400, contentType: 'application/json', body: '{"error":{"message":"no model"}}' });
    aiCalls++;
    const txt = JSON.stringify(body);
    const kind = /학생처럼 풀어라/.test(txt) ? 'verify' : (/분석해서 JSON/.test(txt) ? 'analyze' : 'generate');
    let out;
    if (kind === 'analyze') out = JSON.stringify(ANALYZE);
    else if (kind === 'generate') { const m = txt.match(/새 문항 (\d+)개/); out = JSON.stringify(mkItems(m ? +m[1] : 3)); }
    else { const nos = [...new Set((txt.match(/\\"no\\":(\d+)/g) || []).map(x => +x.replace(/\D/g, '')))]; out = JSON.stringify((nos.length ? nos : [1]).map(no => ({ no, answer: (no - 1) % 5, evidence: 'e', alt: false, why: '' }))); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: out }], usage: { input_tokens: 10, output_tokens: 20 } }) });
  });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));
  const boot = async () => { await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 }); await wait(1800); };
  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await boot();

  // ① 탭 — 선생님 화면에만
  const t = await page.evaluate(() => ({
    label: (document.getElementById('dtab-items') || {}).textContent || '',
    inTeacher: !!document.querySelector('#s-teacher #dp-items'),
    inStudent: !!document.querySelector('#s-student #dp-items') || !!document.querySelector('#s-parent #dp-items'),
    may: typeof ibMayUse === 'function' ? ibMayUse() : null,
    keepSwitch: typeof ITEM_KEEP_SERVER !== 'undefined' ? ITEM_KEEP_SERVER : null
  }));
  ok('① 문제 은행 탭 (선생님 전용)', t.label.trim() === '문제 은행' && t.inTeacher && !t.inStudent && t.may === true && t.keepSwitch === false, JSON.stringify(t));

  // ② 난도 기본값 규칙
  const d1 = await page.evaluate(() => ({
    r85: _ibDiffDefault(85, 2, 'blank'), r70: _ibDiffDefault(70, 2, 'blank'), r55: _ibDiffDefault(55, 2, 'blank'),
    r40: _ibDiffDefault(40, 2, 'blank'), r20: _ibDiffDefault(20, 2, 'blank'),
    rule: _ibDiffDefault(null, 2, 'blank'), rule3: _ibDiffDefault(null, 3, 'gist'), ruleLow: _ibDiffDefault(null, 1, 'gist'),
    skill: [_ibSkillOf('l_purpose'), _ibSkillOf('grammar'), _ibSkillOf('vocab'), _ibSkillOf('m_write_cond'), _ibSkillOf('blank')]
  }));
  ok('② 난도 기본값 — 정답률', d1.r85.diff === 1 && d1.r70.diff === 2 && d1.r55.diff === 3 && d1.r40.diff === 4 && d1.r20.diff === 5 && d1.r85.diffSrc === 'rate',
    [d1.r85.diff, d1.r70.diff, d1.r55.diff, d1.r40.diff, d1.r20.diff].join(''));
  ok('③ 난도 기본값 — 배점·유형', d1.rule.diff === 4 && d1.rule.diffSrc === 'rule' && d1.rule3.diff === 3 && d1.ruleLow.diff === 1,
    '빈칸 ' + d1.rule.diff + ' · 요지(3점) ' + d1.rule3.diff + ' · 요지(1점) ' + d1.ruleLow.diff);
  ok('④ 영역 자동 분류', JSON.stringify(d1.skill) === JSON.stringify(['listen', 'grammar', 'vocab', 'write', 'read']), d1.skill.join(','));

  // ⑤ 목록 받기 (뷰 1회)
  const b0 = ibBytes;
  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('items'); });
  await page.waitForFunction(() => document.querySelectorAll('#ib-list .ib-card').length > 0, null, { timeout: 60000 });
  await wait(900);
  const l1 = await page.evaluate(() => ({ n: (_ibRows || []).length, cards: document.querySelectorAll('#ib-list .ib-card').length, cnt: (document.getElementById('ib-count') || {}).textContent }));
  const firstBytes = ibBytes - b0;
  ok('⑤ 목록 36개 · 50개씩', l1.n === 36 && l1.cards === 36, l1.cnt + ' · 받은 ' + firstBytes + 'B');
  // 다시 열 때
  const b1 = ibBytes;
  await page.evaluate(() => { switchDataTab('iso'); switchDataTab('items'); });
  await wait(1200);
  const againBytes = ibBytes - b1;
  const b2 = ibBytes;
  await page.evaluate(() => ibLoad(true));
  await wait(1500);
  const probeBytes = ibBytes - b2;
  ok('⑥ 다시 열 때는 더 받지 않는다', againBytes === 0 && probeBytes < 200, '탭 재방문 ' + againBytes + 'B · 강제 최신화 ' + probeBytes + 'B');

  // ⑦ 거르기
  const f1 = await page.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); if (e) { e.value = v; } };
    set('ib-f-skill', 'listen'); ibFilterChange();
    const listen = document.querySelectorAll('#ib-list .ib-card').length;
    set('ib-f-skill', ''); set('ib-f-src', 'exam'); ibFilterChange();
    const exam = document.querySelectorAll('#ib-list .ib-card').length;
    set('ib-f-src', ''); set('ib-f-checked', 'y'); ibFilterChange();
    const checked = document.querySelectorAll('#ib-list .ib-card').length;
    set('ib-f-checked', ''); document.getElementById('ib-f-star').checked = true; ibFilterChange();
    const star = document.querySelectorAll('#ib-list .ib-card').length;
    document.getElementById('ib-f-star').checked = false; set('ib-f-q', '씨앗 발문 7'); ibFilterChange();
    const q = document.querySelectorAll('#ib-list .ib-card').length;
    ibResetFilters();
    return { listen, exam, checked, star, q, all: document.querySelectorAll('#ib-list .ib-card').length };
  });
  ok('⑦ 거르기 (영역·출처·검수·별표·검색)', f1.listen === 6 && f1.exam === 9 && f1.checked === 12 && f1.star === 6 && f1.q === 1 && f1.all === 36,
    JSON.stringify(f1));

  // ⑧ 본문까지 찾기 (서버가 id 만 돌려준다)
  const f2 = await page.evaluate(async () => {
    document.getElementById('ib-f-q').value = 'zebraword'; ibFilterChange();
    const before = document.querySelectorAll('#ib-list .ib-card').length;
    await ibDeepSearch(); await new Promise(r => setTimeout(r, 400));
    const after = document.querySelectorAll('#ib-list .ib-card').length;
    ibResetFilters();
    return { before, after };
  });
  ok('⑧ 본문까지 찾기 (목록에 없는 지문 속 낱말)', f2.before === 0 && f2.after === 6, '목록만 ' + f2.before + '개 → 본문까지 ' + f2.after + '개');

  // ⑨ 카드 단추 — 별표·담기·복제
  const p0 = posts.length;
  const a1 = await page.evaluate(async () => {
    const id = _ibFiltered()[0].id;
    await ibStar(id); await new Promise(r => setTimeout(r, 400));
    ibBasketToggle(id);
    await ibDup(id); await new Promise(r => setTimeout(r, 700));
    return { id, basket: ibBasket().length, sel: _ibSelId, n: (_ibRows || []).length, bt: (document.getElementById('ib-basket') || {}).textContent };
  });
  ok('⑨ 별표·담기·복제', posts.length === p0 + 2 && a1.basket === 1 && a1.n === 37 && a1.sel !== a1.id && /1개/.test(a1.bt),
    '저장 ' + (posts.length - p0) + '회 · 바구니 ' + a1.basket + ' · 목록 ' + a1.n + '개');
  ok('⑩ 복제본은 새 id · 검수 해제', (() => { const c = posts[posts.length - 1]; return c && c.data && c.id !== a1.id && c.data.checked === false && c.data.src.isoFrom === a1.id; })(),
    (posts[posts.length - 1] || {}).id);

  // ⑪ 고치기 — 1.5초 뒤 자동 저장, createdAt 유지
  const p1 = posts.length;
  const e1 = await page.evaluate(async () => {
    const id = 'seed002';
    await ibSelect(id); await new Promise(r => setTimeout(r, 600));
    const created = _ibEditing.createdAt;
    const el = document.querySelector('#ib-detail .iso-ed');
    el.innerText = '고친 발문입니다';
    ibItemEdit('stem', el);
    const mid = document.getElementById('ib-estat').textContent;
    await new Promise(r => setTimeout(r, 2000));
    return { created, mid, stat: document.getElementById('ib-estat').textContent, card: (document.querySelector('#ib-list .ib-card.on .ib-stem') || {}).textContent };
  });
  const saved = posts[posts.length - 1];
  ok('⑪ 고치면 1.5초 뒤 자동 저장', posts.length === p1 + 1 && /^저장됨 \d\d:\d\d$/.test(e1.stat) && saved.data.stem === '고친 발문입니다',
    '"' + e1.mid + '" → "' + e1.stat + '"');
  ok('⑫ 처음 만든 때는 지키고 고친 때만 갱신', saved.data.createdAt === e1.created && saved.data.editedAt > e1.created,
    'createdAt ' + saved.data.createdAt + ' · editedAt ' + saved.data.editedAt);

  // ⑬ 여러 개 골라 태그·난도·담기
  const p2 = posts.length;
  page.once('dialog', d => d.accept('모의고사'));
  const bu = await page.evaluate(async () => {
    ibResetFilters();
    const ids = _ibFiltered().slice(0, 3).map(r => r.id);
    ids.forEach(id => _ibPick.add(id)); renderItemList();
    const shown = document.getElementById('ib-bulk').style.display !== 'none';
    ibBulkBasket();
    await ibBulkDiff('5'); await new Promise(r => setTimeout(r, 900));
    return { shown, ids, basket: ibBasket().length, inB: ids.every(id => ibInBasket(id)), rows: ids.map(id => (_ibRows.find(r => r.id === id) || {}).meta) };
  });
  ok('⑬ 여러 개 골라 담기·난도', bu.shown && bu.inB && posts.length === p2 + 3 && bu.rows.every(m => m.diff === 5 && m.diffSrc === 'teacher'),
    '바구니 ' + bu.basket + ' · 저장 ' + (posts.length - p2) + '회');

  // ⑭ 문항 추가 + 붙여넣기
  const add = await page.evaluate(async () => {
    ibPickClear(); ibAddManual();
    document.getElementById('ib-paste').value =
      '다음 글의 주제로 가장 적절한 것은?\n\nReading is a habit that grows slowly.\nIt needs time and patience.\n\n① habit\n② speed\n③ money\n④ sleep\n⑤ noise\n정답: 1\n해설: 글 전체가 습관에 대한 이야기다.';
    ibParsePaste();
    const d = _ibEditing;
    return { stem: d.stem, pass: d.passage, ch: d.choices, ans: d.answer, exp: d.explain, kind: d.src.kind, words: d.words };
  });
  ok('⑭ 문항 추가 — 붙여넣기로 칸 채우기 (AI 없음)',
    /주제로 가장 적절한/.test(add.stem) && /Reading is a habit/.test(add.pass) && add.ch.length === 5 && add.ch[0] === 'habit' && add.ans === 0 && /습관/.test(add.exp) && add.kind === 'manual',
    '발문·지문·선택지 ' + add.ch.length + '개·정답 ' + (add.ans + 1) + '번·해설 ✓');
  const p3 = posts.length;
  await page.evaluate(() => _ibEditSave(true));
  await wait(800);
  ok('⑮ 추가한 문항 저장', posts.length === p3 + 1 && posts[posts.length - 1].data.src.kind === 'manual', '저장 ' + (posts.length - p3) + '회');

  // ⑯ 휴지통 (soft delete)
  const p4 = posts.length;
  const tr = await page.evaluate(async () => {
    const id = _ibFiltered().find(r => /^seed/.test(r.id)).id;
    ibTrash(id);
    await new Promise(r => setTimeout(r, 500));
    document.getElementById('confirm-ok-btn').click();
    await new Promise(r => setTimeout(r, 900));
    return { id, gone: !(_ibRows || []).some(r => r.id === id) };
  });
  const del = posts[posts.length - 1];
  ok('⑯ 휴지통은 soft delete', posts.length === p4 + 1 && del.data._deleted === true && del.id === tr.id && tr.gone, '표식 _deleted ✓');

  // ⑰ JSON 가져오기 — 200개씩, 같은 id 는 건너뜀
  const file = SCR + '/ib_import_test.json';
  const imp = Array.from({ length: 250 }, (_, i) => ({
    id: 'imp' + String(i + 1).padStart(3, '0'), type: 'order', grade: '고2', rate: 45,
    stem: '가져온 발문 ' + (i + 1), passage: 'Imported passage ' + (i + 1) + '. ', choices: ['a', 'b', 'c', 'd', 'e'], answer: 1,
    explain: '해설', src: { kind: 'exam', exam: '2025 수능' }
  })).concat([{ id: 'seed003', stem: '덮어쓰면 안 되는 문항', type: 'blank' }]);
  fs.writeFileSync(file, JSON.stringify(imp), 'utf8');
  const p5 = posts.length;
  await page.setInputFiles('#ib-import-file', file);
  await wait(1200);
  await page.evaluate(() => document.getElementById('confirm-ok-btn').click());
  await wait(3000);
  const impRes = await page.evaluate(() => ({ n: (_ibRows || []).length, seed3: ((_ibRows || []).find(r => r.id === 'seed003') || {}).meta.stem }));
  const chunks = posts.length - p5;
  const bulkSizes = [];
  ok('⑰ JSON 가져오기 — 200개씩 · 같은 id 는 건너뜀', chunks === 250 && impRes.seed3 !== '덮어쓰면 안 되는 문항',
    '올린 문항 ' + chunks + '개 · seed003 그대로 "' + String(impRes.seed3).slice(0, 12) + '…"');

  // ⑱ 동형 → 은행
  const p6 = posts.length, w0 = wsPosts.length;
  await page.evaluate(() => {
    switchDataTab('iso'); isoNew();
    document.getElementById('iso-text').value = '원본 문항 글'; isoTextChange();
    document.getElementById('iso-n').value = '3';
    document.getElementById('iso-type').value = 'blank';
    document.getElementById('iso-passage').value = 'new';
    isoCfgChange();
  });
  await page.evaluate(() => isoGenerate());
  await page.waitForFunction(() => document.querySelectorAll('#iso-list .iso-card').length === 3, null, { timeout: 60000 });
  await wait(2500);
  const g1 = await page.evaluate(() => ({ stat: (document.getElementById('iso-stat') || {}).textContent || '', ids: _isoItems.map(i => i.id) }));
  const ws = wsPosts[wsPosts.length - 1];
  ok('⑱ 동형으로 만들면 문항이 은행에 들어간다', posts.length === p6 + 3 && wsPosts.length === w0 + 1 && /은행 3문항/.test(g1.stat), '은행 ' + (posts.length - p6) + '개 · 상태 "' + g1.stat + '"');
  ok('⑲ 묶음 행은 itemIds 를 가진다', ws && ws.data && JSON.stringify(ws.data.itemIds) === JSON.stringify(g1.ids) && (ws.data.items || []).length === 3,
    'itemIds ' + ((ws.data || {}).itemIds || []).length + '개 · items 도 그대로(학생 과제용)');
  ok('⑳ 묶음도 처음 만든 때를 지킨다', ws.data.createdAt && ws.data.editedAt >= ws.data.createdAt, 'createdAt ' + ws.data.createdAt);

  // ㉑ 원문 지문 묶음 — 은행에도 서버 저장 0
  const p7 = posts.length, w1 = wsPosts.length;
  await page.evaluate(() => {
    isoNew(); document.getElementById('iso-text').value = '원본 지문 문항'; isoTextChange();
    document.getElementById('iso-n').value = '2'; document.getElementById('iso-type').value = 'blank';
    document.getElementById('iso-passage').value = 'keep'; isoCfgChange();
  });
  await page.evaluate(() => isoGenerate());
  await page.waitForFunction(() => document.querySelectorAll('#iso-list .iso-card').length === 2, null, { timeout: 60000 });
  await wait(2500);
  const k1 = await page.evaluate(async () => ({
    stat: (document.getElementById('iso-stat') || {}).textContent || '',
    dev: ((await idbGet('pp_item_keep')) || []).length
  }));
  ok('㉑ 원문 지문 문항은 서버에 안 올라간다', posts.length === p7 && wsPosts.length === w1 && k1.dev >= 2 && /기기에만/.test(k1.stat),
    '서버 ' + (posts.length - p7) + '회 · 기기 ' + k1.dev + '개 · "' + k1.stat + '"');

  // ㉒ 예전 묶음 → '문제 은행으로 가져오기'
  const p8 = posts.length;
  const leg = await page.evaluate(async () => {
    _cache.worksheets = (_cache.worksheets || []).filter(w => w.id !== 'legacy1').concat([{
      id: 'legacy1', rowId: 'legacy1', kind: 'iso', title: '예전 묶음', createdAt: 1761000000000, gradeLevel: '고1',
      isoType: 'blank', isoTypeName: '읽기 · 빈칸 추론', source: { exam: '2024 수능', qno: '31' },
      items: [{ id: 'old1', type: 'blank', typeName: '읽기 · 빈칸 추론', stem: '옛 발문 1', passage: 'Old passage one. '.repeat(8), choices: ['a', 'b', 'c', 'd', 'e'], answer: 1, explain: '해설', wrong: [] },
      { id: 'old2', type: 'blank', typeName: '읽기 · 빈칸 추론', stem: '옛 발문 2', passage: 'Old passage two. '.repeat(8), choices: ['a', 'b', 'c', 'd', 'e'], answer: 2, explain: '해설', wrong: [] }]
    }]);
    await isoOpenSaved('legacy1');
    await new Promise(r => setTimeout(r, 700));
    const shown = document.getElementById('iso-tobank').style.display !== 'none';
    await isoToBank();
    await new Promise(r => setTimeout(r, 900));
    return { shown, after: document.getElementById('iso-tobank').style.display !== 'none', n: _isoItems.length };
  });
  const legPosts = posts.slice(p8);
  ok('㉒ 예전 묶음 → 문제 은행으로 가져오기 (원본 유지)',
    leg.shown && !leg.after && legPosts.length === 2 && legPosts.every(x => /^old/.test(x.id)) && wsPosts.length === w1,
    '단추 보임 ✓ · 복사 ' + legPosts.length + '개 · worksheets 쓰기 0회');

  // ㉓ 비슷한 문항 만들기 — AI 는 안 부른다
  const ai0 = aiCalls;
  const sim = await page.evaluate(async () => {
    switchDataTab('items');
    await new Promise(r => setTimeout(r, 600));
    await ibSimilar('seed001');
    await new Promise(r => setTimeout(r, 700));
    return { tab: document.getElementById('dp-iso').style.display !== 'none', txt: (document.getElementById('iso-text') || {}).value || '', type: _isoCfg.type };
  });
  ok('㉓ 비슷한 문항 만들기 — 글만 넘기고 AI 는 안 부름', sim.tab && /씨앗 발문 1/.test(sim.txt) && sim.type === 'blank' && aiCalls === ai0,
    'AI ' + (aiCalls - ai0) + '회 · 넘긴 글 ' + sim.txt.length + '자');

  // ㉔ 체험 모드에서는 저장하지 않는다
  const p9 = posts.length;
  const sb = await page.evaluate(async () => {
    const real = window.ppSandbox; window.ppSandbox = () => true;
    const r = await ibPutItem({ id: 'sbx1', stem: 's', src: { kind: 'manual' }, choices: [], tags: [] }, true);
    const may = ibMayUse();
    window.ppSandbox = real;
    return { r, may };
  });
  ok('㉔ 체험 모드 — 저장 0 · 탭 못 씀', posts.length === p9 && sb.r === false && sb.may === false);

  // ㉕ 스크롤 · 넘침 · 오류
  await page.setViewportSize({ width: 1440, height: 430 });
  await page.evaluate(() => { switchDataTab('items'); });
  await wait(1200);
  const sc = await page.evaluate(() => {
    const p = document.getElementById('dp-items'), pr = p.getBoundingClientRect();
    const scs = [p, ...p.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && (e.scrollHeight - e.clientHeight) > 4; });
    let moved = 0; scs.forEach(s => { s.scrollTop = 0; const a = s.scrollTop; s.scrollTop = s.scrollHeight; moved += s.scrollTop - a; });
    const inS = e => scs.some(s => s !== e && s.contains(e));
    const vis = [...p.querySelectorAll('*')].filter(e => e.offsetParent !== null && e.getBoundingClientRect().height > 0 && !inS(e));
    const maxB = vis.length ? Math.max(...vis.map(e => e.getBoundingClientRect().bottom)) : pr.bottom;
    return { scroller: scs.map(s => s.id || s.className).join('+'), moved: Math.round(moved), cut: Math.round(maxB - pr.bottom) };
  });
  ok('㉕ 문제 은행 칸도 끝까지 스크롤', sc.moved > 100 && sc.cut <= 8, sc.scroller + ' ' + sc.moved + 'px · 잘림 ' + sc.cut + 'px');
  const over = async w => { await page.setViewportSize({ width: w, height: 800 }); await wait(800); return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)); };
  const o1440 = await over(1440);
  await page.screenshot({ path: SCR + '/ib_1440.png' });
  const o390 = await over(390);
  await page.screenshot({ path: SCR + '/ib_390.png' });
  const o320 = await over(320);
  ok('㉖ 넘침 0 (1440·390·320)', o1440 === 0 && o390 === 0 && o320 === 0, [o1440, o390, o320].join(' / '));
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|400/i;
  const mine = errs.filter(e => !skip.test(e));
  ok('㉗ 콘솔 오류 0', mine.length === 0, mine.slice(0, 3).join(' | ') || '0');

  console.log('\n받은 바이트: 첫 목록 ' + firstBytes + 'B · 탭 재방문 ' + againBytes + 'B · 강제 최신화 ' + probeBytes + 'B (요청 ' + ibReq + '회)');
  console.log('AI 호출 ' + aiCalls + '회(전부 가짜) · item_bank 저장 ' + posts.length + '건 · worksheets 저장 ' + wsPosts.length + '건 (전부 가짜)');
  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
