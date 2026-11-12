require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 학습 세트 · 수업 기록 단원 자료 · 홈 시험 대비 — 전부 가짜 서버
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));
const PASS = 'Reading widely does more than fill a shelf. It teaches a reader to hold two ideas at once. ' +
  'A careful reader waits before judging a writer. Curious students ask what the writer has left unsaid. ' +
  'They compare a new book with an older memory. Good habits grow slowly over many quiet evenings.';
const KO = '널리 읽는 것은 책장을 채우는 것 이상이다.\n그것은 독자가 두 생각을 동시에 붙들도록 가르친다.\n신중한 독자는 작가를 판단하기 전에 기다린다.\n호기심 많은 학생은 작가가 말하지 않은 것을 묻는다.\n그들은 새 책을 오래된 기억과 견준다.\n좋은 습관은 여러 조용한 저녁에 걸쳐 천천히 자란다.';
const t0 = 1762000000000;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); ['pp_item_basket', 'pp_ib_filters'].forEach(k => localStorage.removeItem(k)); } catch (e) { } });
  const page = await ctx.newPage();
  const IB = new Map([['bankitem1', {
    id: 'bankitem1', updated_at: '2026-11-12T00:00:00+00:00',
    data: { type: 'blank', typeName: '읽기 · 빈칸 추론', skill: 'read', grade: '고1', diff: 3, stem: '빈칸 문항', passage: PASS, choices: ['a', 'b', 'c', 'd', 'e'], answer: 0, explain: '해설', wrong: [], points: 2, src: { kind: 'book', tbId: 'tb1', unit: 'Lesson 3' }, tags: [], createdAt: t0, editedAt: t0 }
  }]]);
  const WS = new Map();
  let wsPosts = [], ibPosts = [], aiCalls = [], ebReq = 0;
  const light = r => { const d = r.data || {}; const m = { ...d, preview: String(d.passage || '').slice(0, 180), hasPassage: true }; delete m.passage; delete m.explain; delete m.wrong; delete m.id; return { id: r.id, updated_at: r.updated_at, meta: m }; };
  await page.route('**/rest/v1/item_bank**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST') { let b = []; try { b = JSON.parse(req.postData() || '[]'); } catch (e) { } (Array.isArray(b) ? b : [b]).forEach(x => { ibPosts.push(x); if (x.id) IB.set(x.id, { id: x.id, data: x.data, updated_at: new Date().toISOString() }); }); return r.fulfill({ status: 201, body: '' }); }
    const sel = url.searchParams.get('select') || '';
    if (sel === 'updated_at') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + IB.size, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify([{ updated_at: '2026-11-12T00:00:00+00:00' }]) });
    let rows = [...IB.values()];
    const idq = url.searchParams.get('id');
    if (idq && idq.startsWith('eq.')) rows = rows.filter(x => x.id === decodeURIComponent(idq.slice(3)));
    else if (idq && idq.startsWith('in.(')) { const ids = idq.slice(4, -1).split(',').map(decodeURIComponent); rows = rows.filter(x => ids.indexOf(x.id) >= 0); }
    const out = sel.indexOf('meta') >= 0 ? rows.map(light) : sel === 'data' ? rows.map(x => ({ data: x.data })) : sel === 'id,data' ? rows.map(x => ({ id: x.id, data: x.data })) : rows.map(x => ({ id: x.id, updated_at: x.updated_at }));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await page.route('**/rest/v1/exam_bank**', r => { ebReq++; return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0', 'access-control-expose-headers': 'content-range' }, body: '[]' }); });
  await page.route('**/rest/v1/worksheets**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST') { const row = JSON.parse(req.postData() || '{}'); wsPosts.push(row); if (row.id) WS.set(row.id, { id: row.id, data: row.data }); return r.fulfill({ status: 201, body: '' }); }
    const idq = url.searchParams.get('id') || '';
    if (idq.startsWith('eq.')) { const row = WS.get(decodeURIComponent(idq.slice(3))); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...WS.values()]) });
  });
  await page.route('**/functions/v1/claude-proxy', async r => {
    let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
    if (!body.model) return r.fulfill({ status: 400, body: '{}' });
    const txt = JSON.stringify(body);
    const kind = /학생처럼 풀어라/.test(txt) ? 'verify' : (/뜻을 한국어로/.test(txt) ? 'words' : 'generate');
    aiCalls.push(kind);
    let out;
    if (kind === 'words') out = JSON.stringify({ shelf: '책장(명사)', judging: '판단하기(동사)', unsaid: '말하지 않은(형용사)', quiet: '조용한(형용사)', evenings: '저녁(명사)', compare: '견주다(동사)', older: '더 오래된(형용사)', memory: '기억(명사)', habits: '습관(명사)', grow: '자라다(동사)', slowly: '천천히(부사)', many: '많은(형용사)', students: '학생(명사)', writer: '작가(명사)', waits: '기다리다(동사)', careful: '신중한(형용사)', ideas: '생각(명사)', teaches: '가르치다(동사)', reader: '독자(명사)', reading: '읽기(명사)', widely: '널리(부사)', curious: '호기심 많은(형용사)', book: '책(명사)', new: '새로운(형용사)', good: '좋은(형용사)', fill: '채우다(동사)', hold: '붙들다(동사)', once: '한 번(부사)', asks: '묻다(동사)', ask: '묻다(동사)', left: '남기다(동사)', they: '그들' });
    else if (kind === 'generate') { const m = txt.match(/새 문항 (\d+)개/); const n = m ? +m[1] : 3; out = JSON.stringify(Array.from({ length: n }, (_, i) => ({ stem: '윗글의 내용과 일치하는 것은? (' + (i + 1) + ')', passage: PASS, choices: ['a', 'b', 'c', 'd', 'e'], answer: i % 5, explain: '본문에 그대로 나온다.', intent: '내용 확인', wrong: [] }))); }
    else { const nos = [...new Set((txt.match(/\\"no\\":(\d+)/g) || []).map(x => +x.replace(/\D/g, '')))]; out = JSON.stringify((nos.length ? nos : [1]).map(no => ({ no, answer: (no - 1) % 5, evidence: 'e', alt: false, why: '' }))); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: out }], usage: { input_tokens: 10, output_tokens: 20 } }) });
  });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));
  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(1800);
  // 가짜 교재·자료실 캐시·시험 일정
  await page.evaluate(d => {
    _cache.globalTextbooks = (_cache.globalTextbooks || []).concat([{
      id: 'tb1', title: '직결 리딩 3', unitTexts: { 'Lesson 3': d.pass }, unitSentKo: { 'Lesson 3': d.ko },
      unitTitles: { 'Lesson 3': 'Reading Habits' },
      units: { 'Lesson 3': [{ word: 'shelf', ko: '책장', pos: '명사' }, { word: 'reader', ko: '독자', pos: '명사' }, { word: 'judging', ko: '판단하기', pos: '동사' }] }
    }]);
    _ebRows = [
      { id: 'eb1', meta: { title: '직결 리딩 3 단원평가', series: '직결 리딩 3', cat: 'elt' } },
      { id: 'eb2', meta: { title: '직결 리딩 3 워크북', series: '직결 리딩 3', cat: 'elt' } },
      { id: 'eb3', meta: { title: '2026 1학기 중간 영어', school: '직결중학교', cat: 'school' } },
      { id: 'eb4', meta: { title: '엉뚱한 자료', series: '다른 책', cat: 'elt' } }
    ];
    const t = new Date(); t.setDate(t.getDate() + 10);
    const ymd = t.toISOString().slice(0, 10);
    _cache.examSchedules = [{ id: 'ex1', school: '직결중학교', grade: '중2', year: 2026, semester: 1, round: 1, examDate: ymd, scope: { textbooks: [{ bookId: 'tb1', title: '직결 리딩 3', units: ['Lesson 3'] }], extra: ['프린트물'] } }];
    show('s-teacher'); swTab('t-data'); switchDataTab('items');
  }, { pass: PASS, ko: KO });
  await wait(1600);
  const ai0 = aiCalls.length;

  // ① 세 가지 시작점
  const starts = await page.evaluate(async d => {
    const out = {};
    await lkFromItem('bankitem1');
    await new Promise(r => setTimeout(r, 700));
    out.item = { src: _lkKit.src.kind, tb: _lkKit.src.tbId, unit: _lkKit.src.unit, len: _lkKit.passage.length };
    lkOpen({}, '', '중1');
    document.getElementById('lk-tb').value = 'tb1'; _lkPaintUnits();
    document.getElementById('lk-unit').value = 'Lesson 3';
    lkFromBook();
    out.book = { src: _lkKit.src.kind, ko: !!_lkKit.ko, len: _lkKit.passage.length };
    lkOpen({}, '', '중1');
    document.getElementById('lk-paste').value = d.pass;
    lkPasteText();
    out.paste = { src: _lkKit.src.kind, len: _lkKit.passage.length };
    return out;
  }, { pass: PASS });
  ok('① 시작점 세 가지 (문항 지문·교재 단원·붙여넣기)',
    starts.item.src === 'book' && starts.item.unit === 'Lesson 3' && starts.book.ko && starts.book.len > 100 && starts.paste.src === 'paste',
    '문항 ' + starts.item.src + '/' + starts.item.unit + ' · 교재 해석 ' + starts.book.ko + ' · 붙여넣기 ' + starts.paste.len + '자');

  // ② 학년별로 만들기 (AI 0회)
  const byGrade = {};
  for (const g of ['초6', '중2', '고1']) {
    byGrade[g] = await page.evaluate(async d => {
      lkOpen({ kind: 'book', tbId: 'tb1', unit: 'Lesson 3' }, d.pass, d.g);
      _lkKit.ko = d.ko;
      document.getElementById('lk-grade').value = d.g; lkCfgChange();
      lkBuild();
      await new Promise(r => setTimeout(r, 500));
      const p = _lkKit.parts;
      return {
        vocab: (p.vocab || []).length, db: (p.vocab || []).filter(v => v.from === 'db').length,
        chunk: (p.chunk || []).length, chunkKo: ((p.chunk || [])[0] || {}).ko || '',
        clozeMode: (p.cloze || {}).mode, clozeN: ((p.cloze || {}).blanks || []).length,
        choices: ((p.cloze || {}).choices || []).length,
        order: ((p.order || {}).lines || []).length,
        writeMode: (p.write || {}).mode,
        writeLens: ((p.write || {}).items || []).map(w => (w.words || []).length || (w.answer || '').split(' ').length)
      };
    }, { pass: PASS, ko: KO, g });
    await page.evaluate(() => { window.__printed = []; window.open = () => { let b = ''; return { document: { write(s) { b += s; }, close() { window.__printed.push(b); } } }; }; });
    await page.evaluate(() => { lkPrint(false); lkPrint(true); });
    const htmls = await page.evaluate(() => window.__printed);
    fs.writeFileSync(SCR + '/lk_print_' + g + '.html', htmls[0], 'utf8');
    fs.writeFileSync(SCR + '/lk_print_' + g + '_ans.html', htmls[1], 'utf8');
  }
  ok('② 초5~6 — 낱말 빈칸 + 보기 · 배열 4~6단어',
    byGrade['초6'].clozeMode === 'word' && byGrade['초6'].choices > 0 && byGrade['초6'].writeMode === 'order' &&
    byGrade['초6'].writeLens.every(n => n >= 4 && n <= 6),
    '빈칸 ' + byGrade['초6'].clozeMode + '/보기 ' + byGrade['초6'].choices + '개 · 배열 ' + byGrade['초6'].writeLens.join(','));
  ok('③ 중1~2 — 구 빈칸 · 보기 없음 · 배열 7~10단어',
    byGrade['중2'].clozeMode === 'phrase' && byGrade['중2'].choices === 0 && byGrade['중2'].writeMode === 'order' &&
    byGrade['중2'].writeLens.every(n => n >= 7 && n <= 10),
    '빈칸 ' + byGrade['중2'].clozeMode + '/보기 ' + byGrade['중2'].choices + ' · 배열 ' + byGrade['중2'].writeLens.join(','));
  ok('④ 중3 이상 — 문장 빈칸 · 조건 영작',
    byGrade['고1'].clozeMode === 'sentence' && byGrade['고1'].writeMode === 'cond',
    '빈칸 ' + byGrade['고1'].clozeMode + ' · 영작 ' + byGrade['고1'].writeMode);
  ok('⑤ 단어 뜻은 앱 단어 DB 를 먼저 쓴다', byGrade['중2'].db >= 2, 'DB 에서 ' + byGrade['중2'].db + '개 · 전체 ' + byGrade['중2'].vocab + '개');
  ok('⑥ 문장 해석(unitSentKo)이 있으면 해석 칸에 들어간다', !!byGrade['중2'].chunkKo, '"' + byGrade['중2'].chunkKo.slice(0, 20) + '…"');
  ok('⑦ 순서 배열·끊어 읽기도 만들어진다', byGrade['중2'].order >= 3 && byGrade['중2'].chunk >= 5, '순서 ' + byGrade['중2'].order + '문장 · 끊어 읽기 ' + byGrade['중2'].chunk + '문장');
  ok('⑧ 여기까지 AI 호출 0회', aiCalls.length === ai0, (aiCalls.length - ai0) + '회');

  // ⑨ 뜻 채우기 — 호출 수를 먼저 보여 준다
  const warn = await page.evaluate(async () => {
    lkFillMeanings();
    await new Promise(r => setTimeout(r, 400));
    const msg = (document.getElementById('confirm-msg') || {}).textContent || '';
    document.getElementById('confirm-cancel-btn') ? document.getElementById('confirm-cancel-btn').click() : confirmCancel();
    return msg;
  });
  ok('⑨ 뜻이 없는 단어 수·AI 호출 수를 먼저 보여 준다', /뜻이 없는 단어 \d+개/.test(warn) && /AI 호출 약 \d+회/.test(warn) && aiCalls.length === ai0,
    warn.replace(/\n/g, ' ').slice(0, 60) + ' · 취소하면 AI ' + (aiCalls.length - ai0) + '회');
  const filled = await page.evaluate(async () => {
    lkFillMeanings();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('confirm-ok-btn').click();
    await new Promise(r => setTimeout(r, 1800));
    const v = _lkKit.parts.vocab || [];
    return { miss: v.filter(x => !x.ko).length, ai: v.filter(x => x.from === 'ai').length, db: v.filter(x => x.from === 'db').length };
  });
  ok('⑩ AI 는 뜻이 없는 단어만 채운다', filled.ai > 0 && filled.db >= 2 && aiCalls.filter(x => x === 'words').length === 1,
    'AI ' + filled.ai + '개 · DB ' + filled.db + '개 · 남은 빈칸 ' + filled.miss + '개 · 호출 ' + aiCalls.filter(x => x === 'words').length + '회');

  // ⑪ 내용 확인 문제 — 호출 수 먼저, 누를 때만
  const comp = await page.evaluate(async () => {
    document.getElementById('lk-comp-n').value = '3';
    lkMakeComp();
    await new Promise(r => setTimeout(r, 400));
    const msg = (document.getElementById('confirm-msg') || {}).textContent || '';
    document.getElementById('confirm-ok-btn').click();
    await new Promise(r => setTimeout(r, 2500));
    return { msg, n: (_lkKit.parts.comp || []).length, first: ((_lkKit.parts.comp || [])[0] || {}).stem || '' };
  });
  ok('⑪ 내용 확인 문제 — 호출 수를 먼저 보이고 누를 때만', /AI 호출 약 2회/.test(comp.msg) && comp.n === 3 &&
    aiCalls.filter(x => x === 'generate').length === 1 && aiCalls.filter(x => x === 'verify').length === 1,
    '문항 ' + comp.n + '개 · 생성 ' + aiCalls.filter(x => x === 'generate').length + '회 · 확인 ' + aiCalls.filter(x => x === 'verify').length + '회');

  // ⑫ 저장 · 은행에 넣기
  await wait(2000);
  const kitRow = wsPosts.map(p => p.data).filter(d => d && d.kind === 'kit').pop();
  ok('⑫ worksheets kind:kit 로 자동 저장', !!kitRow && kitRow.title && Object.keys(kitRow.parts || {}).length >= 5,
    '제목 "' + (kitRow || {}).title + '" · 자료 ' + Object.keys((kitRow || {}).parts || {}).length + '종');
  const bank = await page.evaluate(async () => { await lkToBank(); await new Promise(r => setTimeout(r, 1500)); return (_lkKit.itemIds || []).length; });
  const bankItems = ibPosts.map(p => p.data).filter(Boolean);
  ok('⑬ 만든 문항이 문제 은행에 (src.kind:book · 교재·단원)',
    bank > 0 && bankItems.length === bank && bankItems.every(d => d.src.kind === 'book' && d.src.tbId === 'tb1' && d.src.unit === 'Lesson 3'),
    '문항 ' + bankItems.length + '개 · 유형 ' + [...new Set(bankItems.map(d => d.type))].join(','));

  // ⑭ 원문 지문 세트는 기기에만
  const keepKit = await page.evaluate(async d => {
    const before = window.__wsCount || 0;
    lkOpen({ kind: 'item', itemId: 'x', tbId: '', unit: '', keep: true }, d.pass, '고1');
    lkBuild();
    await _lkSave(true);
    await new Promise(r => setTimeout(r, 800));
    const dev = (await idbGet('pp_kit_dev')) || [];
    return { stat: document.getElementById('lk-stat').textContent, dev: dev.length };
  }, { pass: PASS });
  const kitPosts = wsPosts.filter(p => (p.data || {}).kind === 'kit').length;
  ok('⑭ 원문 지문에서 시작한 세트는 기기에만', /기기에만 보관/.test(keepKit.stat) && keepKit.dev >= 1,
    '"' + keepKit.stat + '" · 기기 ' + keepKit.dev + '개');

  // ⑮ 수업 기록 · 이 단원 자료 (받기 0회)
  const ebBefore = ebReq;
  const mats = await page.evaluate(async () => {
    closeM('m-kit');
    swTab('t-les');
    await new Promise(r => setTimeout(r, 600));
    document.getElementById('subj-rows').innerHTML = '';
    addSRowTo('subj-rows', 'reading', '직결 리딩 3', 'Lesson 3', 'tb1');
    await new Promise(r => setTimeout(r, 300));
    // 선생님이 고른 것처럼 칸에 값을 넣는다 (교재 목록에 없는 책이면 select 에 없을 수 있다)
    const ctl = document.querySelector('#subj-rows [data-f=\"book\"]');
    if (ctl) { if (ctl.tagName === 'SELECT' && ![...ctl.options].some(o => o.value === '직결 리딩 3')) { const o = document.createElement('option'); o.value = '직결 리딩 3'; o.textContent = '직결 리딩 3'; ctl.appendChild(o); } ctl.value = '직결 리딩 3'; }
    const uctl = document.querySelector('#subj-rows [data-f=\"unit\"]');
    if (uctl) uctl.value = 'Lesson 3';
    lkUnitMats();
    await new Promise(r => setTimeout(r, 400));
    const box = document.getElementById('lk-unit-mats');
    return { html: box.innerHTML, txt: box.innerText.replace(/\n/g, ' | '), chips: box.querySelectorAll('.lk-chip').length };
  });
  ok('⑮ 수업 기록 — 이 단원 자료 (자료실·문제 은행·학습 세트·본문)',
    /자료실/.test(mats.txt) && /직결 리딩 3 단원평가/.test(mats.txt) && !/엉뚱한 자료/.test(mats.txt) && /학습 세트 만들기/.test(mats.txt),
    mats.txt.slice(0, 90));
  ok('⑯ 이 묶음 때문에 자료실을 새로 받지 않는다', ebReq === ebBefore, '받기 ' + (ebReq - ebBefore) + '회');
  await page.screenshot({ path: SCR + '/lk_lesson_mats.png' });
  const empty = await page.evaluate(async () => {
    document.getElementById('subj-rows').innerHTML = '';
    addSRowTo('subj-rows', 'reading', '없는 교재', '', '');
    await new Promise(r => setTimeout(r, 200));
    lkUnitMats();
    return document.getElementById('lk-unit-mats').innerHTML;
  });
  ok('⑰ 자료가 없으면 묶음을 보이지 않는다', empty === '', empty ? '(남아 있음)' : '비어 있음');

  // ⑱ 홈 · 시험 대비
  const dash = await page.evaluate(async () => {
    swTab('t-dash');
    await new Promise(r => setTimeout(r, 800));
    lkExamCard();
    await new Promise(r => setTimeout(r, 400));
    const box = document.getElementById('dash-exam-prep');
    return { txt: box.innerText.replace(/\n/g, ' | '), has: box.querySelectorAll('.lk-exam').length };
  });
  ok('⑱ 홈 — 시험 대비 카드 (D-28 안)', dash.has === 1 && /D-10/.test(dash.txt) && /학교 기출/.test(dash.txt) && /범위 문항/.test(dash.txt),
    dash.txt.slice(0, 90));
  await page.screenshot({ path: SCR + '/lk_dash_exam.png' });
  const paper = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll('#dash-exam-prep button')].find(b => /범위 문항으로/.test(b.textContent));
    const had = !!btn;
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 1200));
    return { had, open: getComputedStyle(document.getElementById('m-paper')).display !== 'none', tb: _pbCfg.tbId, unit: _pbCfg.unit, title: (_pbPaper || {}).title || '' };
  });
  ok('⑲ 범위 문항으로 시험지 만들기 — 조건이 채워진다', paper.had && paper.open && paper.tb === 'tb1' && paper.unit === 'Lesson 3',
    '교재 ' + paper.tb + ' · 단원 ' + paper.unit + ' · "' + paper.title + '"');

  // ⑳ 마무리
  await page.evaluate(() => { closeM('m-paper'); });
  const over = async w => { await page.setViewportSize({ width: w, height: 844 }); await wait(700); return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)); };
  const o390 = await over(390), o320 = await over(320);
  await page.setViewportSize({ width: 1440, height: 900 });
  ok('⑳ 넘침 0 (390·320)', o390 === 0 && o320 === 0, o390 + ' / ' + o320);
  ok('㉑ AI 호출은 고른 두 곳에서만', aiCalls.length - ai0 === 3, '뜻 채우기 1 + 내용 확인 2 = ' + (aiCalls.length - ai0) + '회 (' + aiCalls.slice(ai0).join(',') + ')');
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|400|404|406|500/i;
  const mineErr = errs.filter(e => !skip.test(e));
  ok('㉒ 콘솔 오류 0', mineErr.length === 0, mineErr.slice(0, 3).join(' | ') || '0');

  console.log('\nAI 호출 ' + (aiCalls.length - ai0) + '회(전부 가짜) · worksheets 저장 ' + wsPosts.length + '건 · item_bank 쓰기 ' + ibPosts.length + '건');
  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
