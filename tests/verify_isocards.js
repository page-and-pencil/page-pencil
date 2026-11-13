require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 동형 — 유형 설계 카드 (가짜 AI · 가짜 서버). 기출 원문은 쓰지 않는다.
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };

// ── 가짜 AI ────────────────────────────────────────────────────────────
// 보낸 글을 그대로 받아 두고(요청 검사), 시킨 대로 답을 만든다.
let AI = { calls: [], makeBad: 0, items: null, resolve: null };
const KINDS = ['1. 화자·인물 혼동', '2. 반대·부정 뒤집기', '3. 시점 어긋남', '4. 부분만 맞음'];
function mkItem(i, over) {
  return Object.assign({
    type: 'l_long', grade: '중2',
    stem: '대화를 듣고, 여자의 마지막 말에 대한 남자의 응답으로 가장 적절한 것을 고르시오. (' + i + ')',
    passage: '', script: ['W: Hi Minsu, did you finish the science poster for our class today?',
      'M: Not yet. I still need a few more clear photos of the river near my small town.',
      'W: My cousin took many pictures of that river last summer during her long trip.',
      'M: That sounds perfect for my poster. Could you please ask her about them tonight?',
      'W: ________'].join('\n'),
    choices: ['Sure, I will call her now', 'I lost my camera last week', 'The poster is already on the wall',
      'She studies math every evening', 'We can buy a new frame today'],
    answer: 0, answerText: '',
    explanation: '여자가 사촌에게 물어보겠다고 답해야 한다.',
    evidence: 'Can you ask her tonight?',
    keyword: '', answerKind: '',
    distractors: [1, 2, 3, 4].map(k => ({ index: k, kind: KINDS[k - 1], why: '대화 내용과 어긋난다' })),
    applied: [], selfCheck: { checksPassed: true, trapsFound: [] }, warnings: [],
  }, over || {});
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const posts = [];
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    posts.push(m + ' ' + r.request().url().split('/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/functions/v1/claude-proxy', async r => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
    if (!b.model) return r.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
    const txt = String(((b.messages || [])[0] || {}).content ? JSON.stringify(b.messages[0].content) : '');
    const kind = /다시 풀기|처음 보는 눈으로/.test(txt) ? 'resolve' : 'make';
    AI.calls.push({ kind, txt });
    let out;
    if (kind === 'make') {
      if (AI.makeBad > 0) { AI.makeBad--; out = '이건 JSON 이 아닙니다 {{{'; }
      else {
        const items = AI.items || [mkItem(0)];
        // 문항마다 '정답 글' 을 적어 둔다 — 앱이 정답을 다른 자리로 옮겨도 다시 풀기가 따라갈 수 있게
        AI.right = AI.right || {};
        items.forEach(it => { AI.right[String(it.stem || '')] = String((it.choices || [])[Number(it.answer)] || ''); });
        out = JSON.stringify({ items });
      }
    } else {
      const n = AI.calls.filter(c => c.kind === 'resolve').length - 1;
      const list = AI.resolve || [];
      // 앱이 정답을 다른 자리로 옮기므로, 보낸 보기에서 **정답 글**을 찾아 그 자리를 답한다
      let idx = 0;
      try {
        const body = (JSON.parse(txt) || []).map(x => x.text || '').join(String.fromCharCode(10));
        const m = body.match(/\[ITEM\]\s*([\s\S]+)$/);
        const item = m ? JSON.parse(m[1].trim()) : null;
        const want = (AI.right || {})[String((item || {}).stem || '')] || AI.rightText || '';
        if (item && Array.isArray(item.choices) && want) {
          const k = item.choices.findIndex(c => String(c).trim() === String(want).trim());
          if (k >= 0) idx = k;
        }
      } catch (e) { }
      const base = { answer: idx, confidence: 0.95, perChoice: [], alsoPossible: [], noAnswer: false, solvableWithoutText: { answer: null, by: '' }, solvableFromLastLineOnly: { answer: null, note: '' }, writtenAnswer: '', languageIssues: [], hardWords: [] };
      out = JSON.stringify(list[n] ? Object.assign({}, base, list[n], (list[n].answer === undefined ? { answer: idx } : {})) : base);
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: out }], usage: { input_tokens: 10, output_tokens: 10 } }) });
  });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 150)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 150)));
  const setAI = v => page.evaluate(() => { }).then(() => { AI = Object.assign(AI, v); });

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(2200);

  // 카드 파일이 실려 있는가
  const cards = await page.evaluate(() => ({
    ok: typeof ISO_CARDS === 'object' && !!ISO_CARDS,
    v: (ISO_CARDS || {}).version, n: ((ISO_CARDS || {}).cards || []).length,
    types: ((ISO_CARDS || {}).cards || []).map(c => c.type),
    mlIso: (ISO_TYPES.ml_topic || {}).iso, mlW: String((ISO_TYPES.ml_topic || {}).w || '').length,
  }));
  ok('카드 10장이 실린다', cards.ok && cards.n === 10, cards.v + ' · ' + cards.types.join(','));
  ok('ml_topic 이 켜지고 출제 원리가 찬다', cards.mlIso !== false && cards.mlW > 10, 'iso=' + cards.mlIso + ' · w ' + cards.mlW + '자');

  // 가짜 문항 — 본보기용 (기기 보관)
  await page.evaluate(async () => {
    const dev = [];
    const base = (i, over) => Object.assign({
      id: 'ic-' + i, type: 'l_long', grade: '중2',
      stem: '대화를 듣고, 마지막 말에 대한 응답으로 가장 적절한 것을 고르시오.',
      script: 'M: Old sample line ' + i + '.\nW: ________', choices: ['a', 'b', 'c', 'd', 'e'],
      answer: i % 5, src: { kind: 'exam', exam: '보기용', keep: true },
    }, over || {});
    for (let i = 1; i <= 6; i++) dev.push(_ibNorm(base(i)));
    dev.push(_ibNorm(base(7, { warn: '잘림' })));
    dev.push(_ibNorm(base(8, { hasImage: true })));
    dev.push(_ibNorm(base(9, { grade: '중3' })));
    await idbSet('pp_item_keep', dev);
    await ibLoad(true);
    swTab('t-data'); switchDataTab('iso');
    await new Promise(r => setTimeout(r, 600));
  });

  // ── 요청에 CARD·COMMON·EXEMPLARS·ANSWER_SLOTS 가 실린다 ──
  AI.calls = []; AI.items = [0, 1, 2].map(i => mkItem(i, { answer: [2, 0, 4][i] }));
  const req = await page.evaluate(async () => {
    _isoCfg.type = 'l_long'; _isoCfg.grade = '중2'; _isoCfg.n = 3; _isoCfg.diff = 'same'; _isoCfg.passage = 'new';
    const card = isoCardOf('l_long');
    const ex = isoPickExemplars('l_long', '중2', card);
    const bodies = await isoExemplarBodies(ex.ids);
    const slots = isoAnswerSlots(3, []);
    const p = isoMakePrompt({ card, grade: '중2', n: 3, slots, diff: 'same', source: 'new', exemplars: bodies, avoid: [] });
    return {
      hasCard: p.indexOf('[CARD]') > 0 && p.indexOf('"type":"l_long"') > 0,
      hasCommon: p.indexOf('[COMMON]') > 0 && p.indexOf('보기는 5개') > 0,
      hasEx: p.indexOf('[EXEMPLARS]') > 0, nEx: bodies.length,
      hasSlots: p.indexOf('ANSWER_SLOTS: 문항마다 정답을 둘 자리 [') > 0,
      exIds: ex.ids, how: ex.how, slots,
    };
  });
  ok('카드 유형이면 CARD·COMMON·EXEMPLARS·ANSWER_SLOTS 가 실린다',
    req.hasCard && req.hasCommon && req.hasEx && req.hasSlots && req.nEx === 2,
    '본보기 ' + req.nEx + '개 · ' + req.how);
  const plain = await page.evaluate(() => ({ card: !!isoCardOf('l_pay'), use: isoCardCanUse('l_pay') }));
  ok('카드가 없는 유형은 지금 그대로', !plain.card && !plain.use);

  // 본보기 고르기 규칙
  const exr = await page.evaluate(() => {
    const card = isoCardOf('l_long');
    const r = isoPickExemplars('l_long', '중2', card);
    const metas = r.ids.map(id => ((_ibRows || []).find(x => x.id === id) || {}).meta || {});
    return {
      ids: r.ids, how: r.how,
      badFree: metas.every(m => !m.warn && !m.hasImage),
      diffAns: metas.length === 2 ? Number(metas[0].answer) !== Number(metas[1].answer) : false,
      grade: metas.every(m => String(m.grade) === '중2'),
    };
  });
  ok('카드 id 가 없으면 같은 유형·학년에서 고른다', exr.ids.length === 2 && exr.grade, exr.how + ' · ' + exr.ids.join(','));
  ok('warn·그림 문항은 고르지 않는다', exr.badFree && exr.diffAns, '정답 자리 다름 ' + exr.diffAns);

  // ── 예상 호출 수 = 실제 호출 수 ──
  AI.calls = []; AI.makeBad = 0;
  AI.items = [0, 1, 2].map(i => mkItem(i, { answer: [2, 0, 4][i] }));
  AI.resolve = [0, 1, 2].map(() => ({ confidence: 0.95, alsoPossible: [], noAnswer: false, solvableWithoutText: { answer: null, by: '' }, solvableFromLastLineOnly: { answer: null, note: '' } }));
  const run1 = await page.evaluate(async () => {
    _isoCfg.n = 3;
    const plan = isoPlanCalls(3);
    const realAsk = askConfirm; let asked = null;
    askConfirm = (t, m, l, c, cb) => { asked = m; cb(); };
    isoCardGo();
    for (let i = 0; i < 160 && (!_isoCardRun || !(_isoCardRun.items || []).length); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 400));
    askConfirm = realAsk;
    const run = _isoCardRun || {};
    return { plan: plan.total, asked: asked || '', calls: run.calls,
      states: (run.items || []).map(x => x.state), slots: run.slots,
      why: (run.items || []).map(x => (x.why || []).join('|')),
      ans: (run.items || []).map(x => x.answer) };
  });
  const madeCalls = AI.calls.length;
  ok('예상 호출 수를 먼저 보여 준다', /모두 4회/.test(run1.asked), run1.asked.split('\n').filter(x => /AI 호출/.test(x))[0] || '');
  ok('예상 4회 = 실제 4회', run1.plan === 4 && run1.calls === 4 && madeCalls === 4,
    '예상 ' + run1.plan + ' · 앱이 센 ' + run1.calls + ' · 실제 ' + madeCalls);
  ok('세 문항 모두 통과', run1.states.join(',') === 'pass,pass,pass',
    run1.states.join(',') + ' · 정답 ' + run1.ans.join(',') + ' · 자리 ' + (run1.slots || []).join(',') + ' · ' + run1.why.join(' // '));

  // JSON 재시도 1회 → 5회
  AI.calls = []; AI.makeBad = 1;
  const run2 = await page.evaluate(async () => {
    const realAsk = askConfirm; askConfirm = (t, m, l, c, cb) => cb();
    _isoCardRun = null; isoCardGo();
    for (let i = 0; i < 160 && (!_isoCardRun || !(_isoCardRun.items || []).length); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 400));
    askConfirm = realAsk;
    return { calls: (_isoCardRun || {}).calls, planned: (_isoCardRun || {}).planned, retried: (_isoCardRun || {}).retried };
  });
  ok('JSON 이 깨지면 한 번만 더 부르고 횟수에 더한다',
    run2.calls === 5 && run2.planned === 5 && run2.retried === true && AI.calls.length === 5,
    '앱 ' + run2.calls + '회 · 보인 예상 ' + run2.planned + '회 · 실제 ' + AI.calls.length + '회');

  // ── 자동 점검: 각각 막는다 ──
  const chk = await page.evaluate(() => {
    const KINDS = ['1. 화자·인물 혼동', '2. 반대·부정 뒤집기', '3. 시점 어긋남', '4. 부분만 맞음'];
    const card = isoCardOf('l_long'), g = '중2';
    const base = {
      type: 'l_long', grade: g, stem: '대화를 듣고 응답을 고르시오.',
      script: ['M: ' + 'river '.repeat(58).trim() + '.', 'W: ________'].join('\n'), passage: '',
      choices: ['Sure I will call her now', 'I lost my camera last week', 'The poster is on the wall',
        'She studies math every evening', 'We can buy a new frame'],
      answer: 0, distractors: [1, 2, 3, 4].map(k => ({ index: k, kind: KINDS[k - 1], why: 'x' })),
    };
    const run = (over, ctx) => {
      const it = Object.assign({}, base, over || {});
      const r = isoCheckItem(it, isoCardOf(it.type || 'l_long'), it.grade || g, ctx || {});
      return { ok: r.ok, bad: r.blocked.map(b => b.name) };
    };
    return {
      four: run({ choices: base.choices.slice(0, 4) }),
      range: run({ answer: 7 }),
      words: run({ script: 'M: short.\nW: ________' }),
      order: run({
        type: 'm_order', passage: '(A) one. (B) two. (C) three.',
        choices: ['(A)-(B)-(C)', '(B)-(A)-(C)', '(B)-(C)-(A)', '(C)-(A)-(B)', '(C)-(B)-(A)'], answer: 1,
      }),
      lastLine: run({ script: ['M: ' + 'word '.repeat(30), 'W: I will do it.'].join('\n') }),
      purpose: run({
        type: 'l_purpose', grade: '중2',
        script: 'M: ' + 'river '.repeat(60).trim() + '.\nW: Okay.',
        choices: ['도서관 이용을 안내하려고', '행사 일정을 알리기 위해서', '수업 변경을 알리려고', '봉사 모집을 하려고', '분실물을 찾으려고'], answer: 0,
      }),
      copy: run({}, { exemplarTexts: ['M: ' + 'river '.repeat(58).trim() + '.'] }),
      good: run({}),
    };
  });
  ok('자동 점검 — 보기 4개를 막는다', !chk.four.ok && chk.four.bad.indexOf('형식') >= 0, chk.four.bad.join(','));
  ok('자동 점검 — 정답 범위 밖을 막는다', !chk.range.ok && chk.range.bad.indexOf('형식') >= 0, chk.range.bad.join(','));
  ok('자동 점검 — 낱말 수 범위 밖을 막는다', !chk.words.ok && chk.words.bad.indexOf('낱말 수') >= 0, chk.words.bad.join(','));
  ok('자동 점검 — m_order 보기 묶음 어긋남을 막는다', !chk.order.ok && chk.order.bad.indexOf('보기 묶음') >= 0, chk.order.bad.join(','));
  ok('자동 점검 — l_long 마지막 줄 꼴을 막는다', !chk.lastLine.ok && chk.lastLine.bad.indexOf('마지막 줄') >= 0, chk.lastLine.bad.join(','));
  ok('자동 점검 — l_purpose 말끝 섞임을 막는다', !chk.purpose.ok && chk.purpose.bad.indexOf('보기 말끝') >= 0, chk.purpose.bad.join(','));
  ok('자동 점검 — 본보기와 8낱말 연속 일치를 막는다', !chk.copy.ok && chk.copy.bad.indexOf('본보기 베끼기') >= 0, chk.copy.bad.join(','));
  ok('멀쩡한 문항은 통과한다', chk.good.ok, chk.good.bad.join(',') || '막힌 것 없음');

  // ── 다시 풀기 규칙 ──
  const rv = await page.evaluate(() => {
    const it = { answer: 2, answerText: '' };
    const base = { answer: 2, confidence: 0.95, alsoPossible: [], noAnswer: false, solvableWithoutText: { answer: null, by: '' }, solvableFromLastLineOnly: { answer: null, note: '' } };
    const v = o => isoResolveVerdict(it, Object.assign({}, base, o));
    return {
      diff: v({ answer: 1 }).state, also: v({ alsoPossible: [3] }).state,
      conf: v({ confidence: 0.7 }).state,
      noText: v({ solvableWithoutText: { answer: 2, by: '길이' } }).state,
      pass: v({}).state, lower: v({ solvableFromLastLineOnly: { answer: 2, note: '' } }).lower,
    };
  });
  ok('다시 풀기 — 답이 다르면 버림', rv.diff === 'drop');
  ok('다시 풀기 — 다른 정답이 있으면 버림', rv.also === 'drop');
  ok('다시 풀기 — 확신도 0.7 이면 확인 대기', rv.conf === 'wait');
  ok('다시 풀기 — 지문 없이 풀리면 확인 대기', rv.noText === 'wait');
  ok('다시 풀기 — 그 밖에는 통과', rv.pass === 'pass' && rv.lower === true);

  // ── 막기에 걸린 문항은 다시 풀기를 부르지 않는다 ──
  AI.calls = []; AI.makeBad = 0;
  AI.items = [mkItem(0, { answer: 0 }), mkItem(1, { choices: ['a', 'b', 'c', 'd'] }), mkItem(2, { answer: 4 })];
  AI.resolve = [{ confidence: 0.95, alsoPossible: [] }, { confidence: 0.95, alsoPossible: [] }];
  const run3 = await page.evaluate(async () => {
    const realAsk = askConfirm; askConfirm = (t, m, l, c, cb) => cb();
    _isoCardRun = null; _isoCfg.n = 3; isoCardGo();
    for (let i = 0; i < 160 && (!_isoCardRun || !(_isoCardRun.items || []).length); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 400));
    askConfirm = realAsk;
    const run = _isoCardRun || {};
    return { states: (run.items || []).map(x => x.state), calls: run.calls };
  });
  ok('막기에 걸린 문항은 다시 풀기를 부르지 않는다',
    run3.states.filter(s => s === 'drop').length === 1 && AI.calls.filter(c => c.kind === 'resolve').length === 2,
    run3.states.join(',') + ' · 다시 풀기 ' + AI.calls.filter(c => c.kind === 'resolve').length + '회');

  // ── 정답 자리 ──
  const slot = await page.evaluate(() => {
    const s = isoAnswerSlots(5, []);
    const cnt = {}; s.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
    return { s, top: Math.max(...Object.values(cnt)) };
  });
  ok('정답 자리 — 5문항에서 같은 번호가 3번을 넘지 않는다', slot.top <= 2, slot.s.map(x => x + 1).join('·') + ' (가장 많은 번호 ' + slot.top + '번)');

  // ── 문제 은행에 넣기 ──
  AI.calls = []; AI.items = [mkItem(0, { answer: 0 })];
  AI.resolve = [{ confidence: 0.95, alsoPossible: [] }];
  const bank = await page.evaluate(async () => {
    const realAsk = askConfirm; askConfirm = (t, m, l, c, cb) => cb();
    _isoCardRun = null; _isoCfg.n = 1; _isoCfg.passage = 'new'; isoCardGo();
    for (let i = 0; i < 160 && (!_isoCardRun || !(_isoCardRun.items || []).length); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 300));
    askConfirm = realAsk;
    const it = (_isoCardRun.items || [])[0];
    const puts = [];
    const real = ibPutItem; ibPutItem = async (d) => { puts.push(d); return true; };
    await isoCardToBank(it.id);
    // 교재 본문으로 만든 것은 기기에만
    _isoCfg.passage = 'book';
    await isoCardToBank(it.id);
    ibPutItem = real;
    return { n: puts.length, src1: puts[0] ? puts[0].src : null, keep2: puts[1] ? puts[1].src.keep : null };
  });
  ok('문제 은행에 넣으면 card·cardVer·exemplars 가 남는다',
    bank.src1 && bank.src1.card === 'l_long' && /review-/.test(String(bank.src1.cardVer)) && (bank.src1.exemplars || []).length === 2,
    JSON.stringify({ card: bank.src1.card, ver: bank.src1.cardVer, ex: (bank.src1.exemplars || []).length, checks: !!bank.src1.checks, resolve: !!bank.src1.resolve }));
  ok('교재 지문으로 만든 문항은 서버로 가지 않는다', bank.keep2 === true, 'src.keep=' + bank.keep2);

  // ── [1] 정답 자리를 앱이 맞춘다 ──────────────────────────────
  AI.calls = []; AI.makeBad = 0; AI.right = {};
  AI.items = [0, 1, 2, 3, 4].map(i => mkItem(i, { answer: 0 }));   // 가짜 AI 가 모두 ① 로 준다
  AI.resolve = null;
  const slotRun = await page.evaluate(async () => {
    try { await idbSet('pp_iso_slots_v1', []); } catch (e) { }
    _isoCfg.type = 'l_long'; _isoCfg.grade = '중2'; _isoCfg.n = 5; _isoCfg.passage = 'new';
    const realAsk = askConfirm; askConfirm = (t, m, l, c, cb) => cb();
    _isoCardRun = null; isoCardGo();
    for (let i = 0; i < 200 && (!_isoCardRun || !(_isoCardRun.items || []).length); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 500));
    askConfirm = realAsk;
    const run = _isoCardRun || {};
    const its = run.items || [];
    return {
      slots: run.slots, ans: its.map(x => Number(x.answer)),
      // 정답 보기 글이 옮긴 자리에 있는가
      rightText: its.every(x => String((x.choices || [])[Number(x.answer)] || '') === 'Sure, I will call her now'),
      // 오답 kind 가 보기와 함께 옮겨졌는가 (정답 자리에는 오답이 없어야 한다)
      kindOk: its.every(x => !(x.distractors || []).some(d => Number(d.index) === Number(x.answer))),
      kindN: its.every(x => (x.distractors || []).length === 4),
      // 해설에 번호가 남아 있지 않은가
      noNum: its.every(x => !/[①②③④⑤]|[1-5]\s*번/.test(String(x.explanation || ''))),
      states: its.map(x => x.state),
      head: (document.querySelector('#iso-cardres .icr-top') || {}).textContent || '',
    };
  });
  ok('[1] 자유 순서 유형 — 정답 자리가 ANSWER_SLOTS 와 같다',
    slotRun.ans.join(',') === (slotRun.slots || []).join(','), '자리 ' + (slotRun.slots || []).join('·') + ' · 받은 ' + slotRun.ans.join('·'));
  ok('[1] 정답 보기 글이 옮긴 자리에 있다', slotRun.rightText);
  ok('[1] 오답 kind 와 해설이 어긋나지 않는다', slotRun.kindOk && slotRun.kindN && slotRun.noNum,
    '정답 자리에 오답 없음 ' + slotRun.kindOk + ' · 오답 4개 ' + slotRun.kindN + ' · 해설에 번호 없음 ' + slotRun.noNum);
  ok('[1] 머리줄에 정답 자리 분포', /① \d+ ② \d+ ③ \d+ ④ \d+ ⑤ \d+/.test(slotRun.head),
    (slotRun.head.match(/→ 만든 것 (.*)$/) || [])[1] || slotRun.head.slice(-40));

  // 묶인 순서 유형 — 옮기지 않고 확인 대기 (앱이 하는 그대로를 그 자리에서 잰다)
  const fixedOrder = await page.evaluate(() => {
    const mk = () => ({
      type: 'l_not', answer: 0, choices: ['이름', '나이', '취미', '사는 곳', '좋아하는 색'],
      distractors: [1, 2, 3, 4].map(k => ({ index: k, kind: 'k' + k, why: 'w' })),
      explanation: '①이 정답입니다.',
    });
    const want = 3;
    // 묶인 순서
    const fixed = mk(); const beforeF = fixed.choices.join('|');
    if (isoFreeOrder(fixed.type)) isoMoveAnswer(fixed, want); else fixed.slotMiss = want;
    let st = isoResolveVerdict({ answer: fixed.answer, answerText: '' },
      { answer: fixed.answer, confidence: 0.95, alsoPossible: [], noAnswer: false }).state;
    if (fixed.slotMiss != null && st === 'pass') st = 'wait';
    // 자유 순서 (견줌)
    const free = mk(); free.type = 'l_long'; const beforeL = free.choices.join('|');
    if (isoFreeOrder(free.type)) isoMoveAnswer(free, want); else free.slotMiss = want;
    return {
      fixedIs: isoFreeOrder('l_not'), freeIs: isoFreeOrder('l_long'),
      beforeF, afterF: fixed.choices.join('|'), ansF: fixed.answer, missF: fixed.slotMiss, stateF: st,
      beforeL, afterL: free.choices.join('|'), ansL: free.answer,
      explL: free.explanation,
    };
  });
  ok('[1] 묶인 순서 유형은 보기를 옮기지 않는다',
    fixedOrder.fixedIs === false && fixedOrder.afterF === fixedOrder.beforeF && fixedOrder.ansF === 0,
    '보기 ' + (fixedOrder.afterF === fixedOrder.beforeF ? '그대로' : '바뀜') + ' · 정답 ' + (fixedOrder.ansF + 1) + '번');
  ok('[1] 자리가 다르면 확인 대기', fixedOrder.missF === 3 && fixedOrder.stateF === 'wait',
    '요청 4번 · 받은 ' + (fixedOrder.ansF + 1) + '번 → ' + fixedOrder.stateF);
  ok('[1] 자유 순서는 옮기고 해설의 번호도 바꾼다',
    fixedOrder.freeIs === true && fixedOrder.ansL === 3 && fixedOrder.afterL !== fixedOrder.beforeL &&
    !/[①②③④⑤]/.test(fixedOrder.explL),
    '정답 ' + (fixedOrder.ansL + 1) + '번 · 해설 "' + fixedOrder.explL + '"');

  // ── [2] 점검 고치기 ──────────────────────────────────────────
  const chk2 = await page.evaluate(() => {
    const KINDS = ['1. 화자·인물 혼동', '2. 반대·부정 뒤집기', '3. 시점 어긋남', '4. 부분만 맞음'];
    const run = (type, over, grade) => {
      const base = {
        type: type, grade: grade || '중2', stem: '대화를 듣고 할 일을 고르시오.',
        script: ['M: ' + 'river '.repeat(55).trim() + '.', 'W: I’ll go to the store right now.'].join('\n'),
        passage: '', choices: ['가게 가기', '숙제 하기', '전화 걸기', '청소 하기', '책 읽기'],
        answer: 0, distractors: [1, 2, 3, 4].map(k => ({ index: k, kind: KINDS[k - 1], why: 'x' })),
      };
      const it = Object.assign({}, base, over || {});
      const r = isoCheckItem(it, isoCardOf(type), it.grade, {});
      const f = n => (r.list || []).find(c => c.name === n) || {};
      return { ok: r.ok, bad: r.blocked.map(b => b.name), f: f };
    };
    const todo = run('l_todo');
    const empty = run('l_todo', { choices: ['가게 가기', '숙제 하기', '전화 걸기', '청소 하기', '책 읽기', '', '  '] });
    const card = isoCardOf('l_long'), w = (card.byGrade['중2'] || {}).words;
    const lo = Math.floor(w[0] * 0.9);
    const near = run('l_long', { script: 'M: ' + 'river '.repeat(lo - 1).trim() + '.\nW: ________', choices: ['a b c', 'd e f', 'g h i', 'j k l', 'm n o'] });
    const far = run('l_long', { script: 'M: ' + 'river '.repeat(20).trim() + '.\nW: ________', choices: ['a b c', 'd e f', 'g h i', 'j k l', 'm n o'] });
    const tie = run('l_todo', { choices: ['가게에 가기요요', '숙제를 하기요요', '전화 걸기', '청소 하기', '책 읽기'], answer: 0 });
    return {
      todoHas: todo.f('맡는 말').got, todoOk: todo.f('맡는 말').ok,
      emptyGot: empty.f('형식').got, emptyOk: empty.f('형식').ok,
      nearLevel: near.f('낱말 수').level, nearGot: near.f('낱말 수').got, nearBlocked: near.bad.indexOf('낱말 수') >= 0,
      farLevel: far.f('낱말 수').level, farBlocked: far.bad.indexOf('낱말 수') >= 0,
      tieOk: tie.f('정답만 김').ok, tieGot: tie.f('정답만 김').got,
      want: w,
    };
  });
  ok('[2] 굽은 따옴표 I’ll 로 맡는 말을 찾는다', chk2.todoOk && chk2.todoHas === '있음', chk2.todoHas);
  ok('[2] 빈 보기 2개가 붙어 와도 5개로 센다', chk2.emptyOk && /보기 5개/.test(chk2.emptyGot), chk2.emptyGot);
  ok('[2] 조금 벗어난 낱말 수는 알리기', chk2.nearLevel === 'warn' && !chk2.nearBlocked,
    chk2.nearGot + ' (기준 ' + (chk2.want || []).join('~') + ')');
  ok('[2] 많이 벗어나면 막기', chk2.farLevel === 'block' && chk2.farBlocked);
  ok('[2] 정답이 가장 긴 보기와 같으면 걸리지 않는다', chk2.tieOk, chk2.tieGot);

  // ── [3] 지문 없이 풀림 — 확신도로 가른다 ──
  const soft = await page.evaluate(() => {
    const it = { answer: 2, answerText: '' };
    const base = { answer: 2, confidence: 0.95, alsoPossible: [], noAnswer: false, solvableFromLastLineOnly: { answer: null, note: '' } };
    const v = sw => isoResolveVerdict(it, Object.assign({}, base, { solvableWithoutText: sw }));
    const a = v({ answer: 2, by: '길이', confidence: 0.5 });
    const b = v({ answer: 2, by: '길이', confidence: 0.8 });
    return { lowState: a.state, lowSoft: (a.soft || []).join(''), highState: b.state };
  });
  ok('[3] 확신도 0.5 면 통과 + 알리기', soft.lowState === 'pass' && /짐작될 수 있어요/.test(soft.lowSoft), soft.lowSoft);
  ok('[3] 확신도 0.8 이면 확인 대기', soft.highState === 'wait');

  // ── [5] 깨진 응답 살리기 ──
  const rep = await page.evaluate(() => {
    const good = '{"items":[{"stem":"ㄱ"},{"stem":"ㄴ"}]}';
    const fence = '```json\n' + good + '\n```';
    const comma = '{"items":[{"stem":"ㄱ"},{"stem":"ㄴ"},]}';
    const cut = '{"items":[{"stem":"ㄱ","choices":["a","b"]},{"stem":"ㄴ","choi';
    const r = x => { const o = isoRepairJson(x); return o.ok ? ((o.data.items || []).length + '개 · ' + o.how) : '못 살림'; };
    return { fence: r(fence), comma: r(comma), cut: r(cut), junk: r('이건 JSON 이 아닙니다 {{{') };
  });
  ok('[5] ```json 울타리를 벗긴다', /2개/.test(rep.fence), rep.fence);
  ok('[5] 끝의 쉼표를 고친다', /2개/.test(rep.comma), rep.comma);
  ok('[5] 잘린 마지막 문항만 버리고 살린다', /1개/.test(rep.cut), rep.cut);
  ok('[5] 그래도 안 되면 못 살림', rep.junk === '못 살림', rep.junk);

  // ── [1] 카드용 설정 칸 ───────────────────────────────────────
  const cfg = await page.evaluate(async () => {
    switchDataTab('iso');
    await new Promise(r => setTimeout(r, 400));
    _isoText = ''; _isoImgs = [];
    _isoCfg.type = 'l_todo'; _isoCfg.grade = '중1'; _isoCfg.n = 3; _isoCfg.passage = 'new';
    _isoPaintCfg();
    await new Promise(r => setTimeout(r, 200));
    const bar = document.getElementById('iso-cardbar');
    const gs = document.getElementById('iso-grade');
    const ds = document.getElementById('iso-diff');
    const ps = document.getElementById('iso-passage');
    const ch = document.getElementById('iso-choices');
    const hint = document.getElementById('iso-callhint');
    const card = isoCardOf('l_todo');
    const out = {
      badge: bar.style.display !== 'none' && /설계 카드로 만듭니다/.test(bar.textContent),
      cardName: /할 일/.test(bar.textContent),
      limits: /믿을 수 있는 범위/.test(bar.textContent),
      grades: [...gs.options].map(o => o.value),
      cardGrades: isoCardGrades(card),
      diff: [...ds.options].map(o => o.textContent).join('/'),
      diffVals: [...ds.options].map(o => o.value).join('/'),
      choicesHidden: ch.style.display === 'none',
      hint3: hint.textContent,
      passOpts: [...ps.options].filter(o => !o.hidden).map(o => o.value),
    };
    // 개수를 바꾸면 단추 옆 글도 바뀐다
    _isoCfg.n = 5; _isoPaintCfg();
    out.hint5 = hint.textContent;
    // (추론) 학년 알림
    const gq = isoCardGrades(card).find(g => isoCardGuessed(card, g));
    if (gq) { _isoCfg.grade = gq; _isoPaintCfg(); }
    out.guessShown = (document.getElementById('iso-grade-note') || {}).style.display !== 'none';
    out.guessGrade = gq || '';
    _isoCfg.n = 3; _isoCfg.grade = '중1'; _isoPaintCfg();
    return out;
  });
  ok('[1] 설계 카드 배지와 카드 이름·한계', cfg.badge && cfg.cardName && cfg.limits);
  ok('[1] 학년은 카드에 있는 것만', cfg.grades.join(',') === cfg.cardGrades.join(','), cfg.grades.join(' '));
  ok('[1] 난이도 이름이 하·중·상 (값은 그대로)',
    cfg.diff === '중/하/상' && cfg.diffVals === 'same/easy/hard', cfg.diff + ' · ' + cfg.diffVals);
  ok('[1] 선택지 칸은 숨긴다', cfg.choicesHidden);
  ok('[1] 단추 옆 글 = 예상 호출 수', /AI 호출 4번 \(만들기 1 \+ 다시 풀기 3\)/.test(cfg.hint3) &&
    /AI 호출 6번 \(만들기 1 \+ 다시 풀기 5\)/.test(cfg.hint5), cfg.hint3 + ' → ' + cfg.hint5);
  ok('[1] (추론) 학년이면 알린다', !cfg.guessGrade || cfg.guessShown, '추론 학년 ' + (cfg.guessGrade || '(없음)'));

  // ── [2] 듣기면 SOURCE 는 늘 '새로 쓰기' ──────────────────────
  ok('[2] 듣기 유형이면 교재 본문 고르기가 없다', cfg.passOpts.join(',') === 'new', cfg.passOpts.join(','));
  AI.calls = []; AI.items = [mkItem(0, { answer: 0 })];
  AI.resolve = [{ confidence: 0.95, alsoPossible: [] }];
  const listen = await page.evaluate(async () => {
    // 읽기 유형에서 교재 본문을 고른 뒤 듣기 유형으로 바꾼다 (라이브에서 본 자리)
    const tb = (_cache.globalTextbooks || []).find(b => b && b.unitTexts &&
      Object.keys(b.unitTexts).some(u => String(b.unitTexts[u] || '').trim()));
    const unit = tb ? Object.keys(tb.unitTexts).find(u => String(tb.unitTexts[u] || '').trim()) : '';
    _isoCfg.type = 'm_blank'; _isoCfg.passage = 'book'; _isoCfg.tbId = tb ? tb.id : ''; _isoCfg.unit = unit;
    const head = (typeof _isoBookText === 'function' ? (_isoBookText() || '') : '').slice(0, 24);
    // 화면에서 유형만 바꾼다
    const ts = document.getElementById('iso-type'); ts.value = 'l_todo';
    isoCfgChange();
    const afterPick = _isoCfg.passage;
    _isoCfg.grade = '중1'; _isoCfg.n = 1;
    const realAsk = askConfirm; askConfirm = (t, m, l, c, cb) => cb();
    _isoCardRun = null; isoCardGo();
    for (let i = 0; i < 160 && (!_isoCardRun || !(_isoCardRun.items || []).length); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 300));
    askConfirm = realAsk;
    return { afterPick, head };
  });
  const mk = AI.calls.find(c => c.kind === 'make') || { txt: '' };
  // txt 는 content 배열을 JSON 으로 적은 것이다 — 글을 되살려서 본다
  const mkText = (() => { try { return (JSON.parse(mk.txt) || []).map(x => x.text || '').join(String.fromCharCode(10)); } catch (e) { return mk.txt; } })();
  const srcLine = ((mkText.match(/^5\. SOURCE: (.*)$/m) || [])[1] || '').trim();
  ok('[2] 유형을 바꾸면 지문이 새로 쓰기로 돌아온다', listen.afterPick === 'new', '바꾼 뒤 "' + listen.afterPick + '"');
  ok('[2] 듣기 유형의 SOURCE 는 늘 새로 쓰기',
    /새로 쓰기/.test(srcLine) && (!listen.head || mkText.indexOf(listen.head) < 0),
    'SOURCE "' + srcLine.slice(0, 20) + '"');

  // ── [3] 카드 없는 유형 ──
  const plainCfg = await page.evaluate(async () => {
    _isoCfg.type = 'l_pay'; _isoPaintCfg();
    await new Promise(r => setTimeout(r, 150));
    const bar = document.getElementById('iso-cardbar');
    const h2 = document.getElementById('iso-type-hint2');
    const ds = document.getElementById('iso-diff');
    const ch = document.getElementById('iso-choices');
    const ps = document.getElementById('iso-passage');
    return {
      barOff: bar.style.display === 'none',
      note: h2.style.display !== 'none' && /설계 카드가 아직 없어요/.test(h2.textContent),
      diff: [...ds.options].map(o => o.textContent).join('/'),
      choices: ch.style.display !== 'none',
      passOpts: [...ps.options].filter(o => !o.hidden).map(o => o.value).join(','),
    };
  });
  ok('[3] 카드 없는 유형이면 옛 화면 그대로', plainCfg.barOff && plainCfg.choices &&
    plainCfg.diff === '원본과 같게/한 단계 쉽게/한 단계 어렵게' && plainCfg.passOpts === 'new,keep,book',
    plainCfg.diff);
  ok('[3] 카드가 없다고 한 줄 알린다', plainCfg.note);

  // ── [4] 소재와 AVOID ─────────────────────────────────────────
  AI.calls = []; AI.items = [mkItem(0, { answer: 0 })];
  AI.resolve = [{ confidence: 0.95, alsoPossible: [] }];
  const avoid = await page.evaluate(async () => {
    try { await idbSet('pp_iso_log_v1', []); } catch (e) { }
    _isoCfg.type = 'l_long'; _isoCfg.grade = '중2'; _isoCfg.n = 1; _isoCfg.passage = 'new';
    const realAsk = askConfirm; askConfirm = (t, m, l, c, cb) => cb();
    _isoCardRun = null; isoCardGo();
    for (let i = 0; i < 160 && (!_isoCardRun || !(_isoCardRun.items || []).length); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 400));
    const log1 = (await idbGet('pp_iso_log_v1')) || [];
    const topics = await isoRecentTopics('l_long', 10);
    // 한 번 더 만들면 앞 묶음 소재가 AVOID 로 간다
    _isoCardRun = null; isoCardGo();
    for (let i = 0; i < 160 && (!_isoCardRun || !(_isoCardRun.items || []).length); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 300));
    askConfirm = realAsk;
    return { topics, logTopics: (log1[0] || {}).topics || [], sent: (_isoCardRun || {}).avoid || [] };
  });
  const mk2 = AI.calls.filter(c => c.kind === 'make');
  const lastMake = mk2[mk2.length - 1] || { txt: '' };
  const lastText = (() => { try { return (JSON.parse(lastMake.txt) || []).map(x => x.text || '').join(String.fromCharCode(10)); } catch (e) { return lastMake.txt; } })();
  ok('[4] 만든 기록에 소재 한 줄이 남는다', avoid.logTopics.length > 0 && avoid.logTopics[0].length <= 60,
    '"' + (avoid.logTopics[0] || '').slice(0, 40) + '"');
  ok('[4] 앞 묶음 소재가 AVOID 로 간다',
    avoid.sent.length > 0 && lastText.indexOf(avoid.sent[0].slice(0, 15)) >= 0,
    'AVOID ' + avoid.sent.length + '개');

  // ── 설계 카드 보기 ──
  const view = await page.evaluate(async () => {
    isoCardsOpen(0);
    await new Promise(r => setTimeout(r, 400));
    const t = (document.getElementById('isoc-body') || {}).textContent || '';
    return {
      tabs: document.querySelectorAll('#isoc-tabs .wz-opt').length,
      has: ['발문 말투', '학년별', '정답 근거 자리', '오답 방식', '난도 올리기', '함정', '점검 목록', '본보기', '한계'].filter(k => t.indexOf(k) >= 0).length,
      edit: /저장|고치기|수정/.test(t),
    };
  });
  ok('설계 카드 10장을 읽기 전용으로 본다', view.tabs === 10 && view.has >= 8 && !view.edit, '탭 ' + view.tabs + ' · 칸 ' + view.has + '개');

  // ── 만든 기록 ──
  const log = await page.evaluate(async () => {
    try { closeM('m-iso-cards'); } catch (e) { }
    await isoLogRender();
    const t = (document.getElementById('iso-log') || {}).textContent || '';
    const a = (await idbGet('pp_iso_log_v1')) || [];
    return { rows: a.length, shown: /만든 기록/.test(t), cols: /통과/.test(t) && /버림/.test(t) && /AI/.test(t) };
  });
  ok('만든 기록이 기기에 남는다', log.rows > 0 && log.shown && log.cols, log.rows + '줄');

  // ── 학생 화면 ──
  const stu = await page.evaluate(() => {
    const before = AI_NOT_DEFINED_GUARD();
    function AI_NOT_DEFINED_GUARD() { return 0; }
    try { localStorage.setItem('pp_session', JSON.stringify({ role: 'student', sid: 'x' })); } catch (e) { }
    const may = isoMayUse();
    const loaded = typeof ISO_CARDS === 'object' && !!ISO_CARDS;
    try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { }
    return { may, loaded, before };
  });
  const callsBefore = AI.calls.length;
  await wait(300);
  ok('학생 화면은 카드를 쓰지 않는다 (불러오기만, 호출 0)',
    stu.may === false && stu.loaded === true && AI.calls.length === callsBefore,
    '쓸 수 있나 ' + stu.may + ' · 불러옴 ' + stu.loaded);

  // ── 좁은 화면 ──
  const narrow = [];
  for (const W of [320, 390]) {
    await page.setViewportSize({ width: W, height: 760 });
    await page.evaluate(async () => { isoCardsOpen(0); await new Promise(r => setTimeout(r, 400)); });
    const over = await page.evaluate(() => Math.round(document.documentElement.scrollWidth - window.innerWidth));
    narrow.push(W + 'px ' + over);
    await page.evaluate(() => { try { closeM('m-iso-cards'); } catch (e) { } });
  }
  ok('320·390px 가로 넘침 0', narrow.every(x => / 0$/.test(x)), narrow.join(' · '));

  await page.evaluate(async () => { try { await idbSet('pp_item_keep', []); } catch (e) { } });
  console.log('\n가짜 서버가 받은 쓰기 ' + posts.length + '건 · 가짜 AI 호출 ' + AI.calls.length + '회 (전부 가짜)');
  console.log('콘솔 오류 ' + errs.length + '건');
  errs.slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_isocards 실패:', e); process.exit(1); });
