require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 만들기(마법사) 점검 — 가짜 문항만 쓴다. 실제 학생 데이터·기출 원문은 쓰지 않는다.
//  (a) 다섯 마법사 모두 기본값만으로 끝까지 가서 인쇄 미리보기가 나온다
//  (b) 반이 하나면 반 단계가 없다
//  (c) [직접 고르기로 바꾸기]가 고른 것을 들고 간다
//  (d) 인쇄 뒤 '바로 할 일'에 답 입력 줄, 답을 넣으면 결과 보기
//  (e) 서답형(answer -1 + answerText)이 시험지에 담긴다
//  (f) 유형 연습지의 [바꾸기]가 같은 유형의 다른 문항을 준다
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n + (note ? ' — ' + note : '')); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  // 가짜 서버 — 저장은 받아 주는 척만 한다 (실제 서버에는 닿지 않는다)
  const posts = [];
  for (const tb of ['worksheets', 'item_bank', 'item_results']) {
    await page.route('**/rest/v1/' + tb + '**', r => {
      const m = r.request().method();
      if (m === 'GET' || m === 'HEAD') return r.continue();
      posts.push(m + ' ' + tb);
      return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    });
  }
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 150)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 150)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(2200);

  // 가짜 문항 — 한 회차 20문항(서답형 2개 포함) + 유형 연습용 여러 유형
  await page.evaluate(async () => {
    const dev = [];
    for (let i = 1; i <= 20; i++) {
      const essay = (i === 19 || i === 20);
      dev.push(_ibNorm(Object.assign({
        id: 'wz-ex-' + i, grade: '중2',
        stem: '보기용 문항 ' + i, passage: '보기용 지문 ' + i,
        src: { kind: 'exam', exam: '보기용 1회 중2 듣기', qno: String(i), audioId: 'wz-au', keep: true },
      }, essay
        ? { type: 'm_write_cond', answer: -1, answerText: '모범 답 ' + i, choices: [] }
        : { type: 'ml_place', answer: i % 4, choices: ['①', '②', '③', '④'] })));
    }
    const types = ['blank', 'blank', 'blank', 'blank', 'blank', 'blank',
      'grammar', 'grammar', 'grammar', 'grammar', 'vocab', 'vocab', 'vocab', 'vocab'];
    types.forEach((t, i) => dev.push(_ibNorm({
      id: 'wz-t-' + i, type: t, grade: '중2', stem: '연습 문항 ' + t + ' ' + i,
      passage: '연습 지문 ' + i, choices: ['a', 'b', 'c', 'd'], answer: i % 4, diff: 3,
      src: { kind: 'book', keep: true },
    })));
    await idbSet('pp_item_keep', dev);
    await ibLoad(true);
  });
  await wait(600);

  // ── 시작 화면 ──
  const home = await page.evaluate(async () => {
    swTab('t-data'); switchDataTab('make');
    await new Promise(r => setTimeout(r, 700));
    return {
      n: document.querySelectorAll('#mk-cards .mk-card').length,
      first: !!document.querySelector('#mk-cards .mk-first'),
      txt: (document.getElementById('mk-cards') || {}).textContent.replace(/\s+/g, ' ').slice(0, 130),
    };
  });
  ok('① 시작 화면에 카드 5장', home.n === 5, home.n + '장 · ' + home.txt);
  ok('① 처음 한 번 길잡이', home.first);

  // ── (e) 서답형이 '정답 미확인' 이 아니다 ──
  const essay = await page.evaluate(() => {
    const r = (_ibRows || []).find(x => x.id === 'wz-ex-19') || {};
    const m = r.meta || {};
    return { no: _ibNoAnswer(m), es: _ibIsEssay(m), at: m.answerText || '' };
  });
  ok('(e) 서답형은 정답 미확인이 아니다', essay.no === false && essay.es === true, 'answerText 표식 ' + (essay.at || '없음'));

  // ── (a)(b) 마법사 1 — 기출 한 회 ──
  const w1 = await page.evaluate(async () => {
    wzOpen('exam');
    const steps = [...document.querySelectorAll('#wz-steps .wz-step')].map(x => x.textContent.trim());
    const clsN = wzClasses().length;
    const auto = _wz.d.grade;             // 반 학생에서 가져온 기본 학년
    wzSet('grade', '중2');                 // 보기용 문항이 중2 라서
    await wzNext();                       // ① 학년
    await new Promise(r => setTimeout(r, 120));
    const picks = document.querySelectorAll('#wz-body .wz-pick').length;
    await wzNext();                       // ② 회차 — 기본으로 고른 것이 없으면 멈춘다
    const stopped = !!_wz && _wz.i === 1;
    if (stopped) { wzSet('exam', '보기용 1회 중2 듣기'); await wzNext(); }
    await new Promise(r => setTimeout(r, 120));
    const sum = (document.getElementById('wz-body') || {}).textContent.replace(/\s+/g, ' ');
    const ids = (_wz && _wz.d.ids || []).length;
    await wzNext();                       // ③ 만들기 → 시험지 창
    await new Promise(r => setTimeout(r, 2200));
    return {
      steps, clsN, picks, ids, auto, sum: sum.slice(0, 140),
      open: (document.getElementById('m-paper') || {}).className || '',
      slots: (typeof _pbSlots !== 'undefined' ? _pbSlots.length : 0),
      prev: document.querySelectorAll('#pb-prev .pbp-q, #pb-prev .pb-q').length,
      stepsBar: [...document.querySelectorAll('#pb-steps .wz-step')].map(x => x.textContent.trim()),
    };
  });
  ok('(a) 마법사 1 — 세 단계', w1.steps.length === 3, w1.steps.join(' / '));
  ok('(b) 반이 하나면 반 단계가 없다', w1.clsN !== 1 || w1.steps.indexOf('반') < 0, '반 ' + w1.clsN + '개 · ' + w1.steps.join('/'));
  ok('학년이 반에서 미리 채워진다', typeof w1.auto === 'string', '기본 학년 "' + (w1.auto || '(없음)') + '"');
  ok('(a) 회차 카드가 보인다', w1.picks > 0, w1.picks + '개');
  ok('(e) 서답형 2개가 빠지지 않는다', w1.ids === 20, '담은 문항 ' + w1.ids + '개');
  ok('(a) 끝에 시험지 창이 열린다', /open/.test(w1.open) && w1.slots === 20, '칸 ' + w1.slots + '개');
  ok('시험지 창에 단계 띠', w1.stepsBar.length === 4, w1.stepsBar.join(' / '));

  // ── (d) 인쇄 → 바로 할 일 → 답 입력 → 결과 ──
  const todo = await page.evaluate(async () => {
    const id = _pbPaper.id;
    _pbPaper.title = '보기용 시험지';
    _pbMarkPrinted();
    _cache.worksheets = (_cache.worksheets || []).filter(w => w && w.id !== id).concat([{ ...(_pbPaper), kind: 'paper' }]);
    const st1 = pbStatusOf(_cache.worksheets.find(w => w.id === id));
    const rows1 = pbTodoRows();
    const t1 = rows1.some(r => r.text.indexOf('보기용 시험지') >= 0 && r.text.indexOf('답 입력') >= 0);
    // 답을 넣은 것처럼
    await pbTouch(id, { scoredAt: new Date().toISOString() });
    const st2 = pbStatusOf(_cache.worksheets.find(w => w.id === id));
    const rows2 = pbTodoRows();
    const t2 = rows2.some(r => r.text.indexOf('결과 보기') >= 0);
    return { st1: st1.label + '/' + st1.next, st2: st2.label + '/' + st2.next, t1: t1, t2: t2 };
  });
  ok('(d) 인쇄하면 인쇄함 → 답 입력', todo.st1 === '인쇄함/답 입력' && todo.t1, todo.st1);
  ok('(d) 답을 넣으면 결과 보기로 바뀐다', todo.st2 === '답 입력함/결과 보기' && todo.t2, todo.st2);

  // ── (c) 직접 고르기로 바꾸기 ──
  const man = await page.evaluate(async () => {
    try { pbClose(); } catch (e) { }
    wzOpen('exam'); await wzNext();
    wzSet('exam', '보기용 1회 중2 듣기');
    wzManual();
    await new Promise(r => setTimeout(r, 700));
    return { tab: _dataTab, exam: (_ibF || {}).exam || '' };
  });
  ok('(c) 직접 고르기로 바꾸면 고른 것을 들고 간다', man.tab === 'items' && man.exam === '보기용 1회 중2 듣기', man.tab + ' · ' + man.exam);

  // ── (f) 유형 연습지 + 바꾸기 ──
  const w2 = await page.evaluate(async () => {
    _ibBasketSet([]);
    wzOpen('drill');
    const steps = [...document.querySelectorAll('#wz-steps .wz-step')].map(x => x.textContent.trim());
    await wzNext();                        // 학년
    await new Promise(r => setTimeout(r, 100));
    const typeChips = document.querySelectorAll('#wz-body .wz-opt').length;
    await wzNext();                        // 유형 (아무것도 안 고름 = 전부)
    await wzNext();                        // 문항 수 기본
    await new Promise(r => setTimeout(r, 150));
    const before = (_wz.d.ids || []).slice();
    const t0 = ((_ibRows || []).find(r => r.id === before[0]) || {}).meta || {};
    wzSwap(0);
    await new Promise(r => setTimeout(r, 100));
    const after = (_wz.d.ids || []).slice();
    const t1 = ((_ibRows || []).find(r => r.id === after[0]) || {}).meta || {};
    await wzNext();                        // 만들기
    await new Promise(r => setTimeout(r, 1800));
    return {
      steps, typeChips, n: before.length, changed: before[0] !== after[0],
      sameType: String(t0.type || '') === String(t1.type || ''),
      slots: (typeof _pbSlots !== 'undefined' ? _pbSlots.length : 0),
    };
  });
  ok('(a) 마법사 2 — 네 단계', w2.steps.length === 4, w2.steps.join(' / '));
  ok('(a) 유형 칩이 보인다', w2.typeChips > 0, w2.typeChips + '개');
  ok('(f) [바꾸기]가 같은 유형의 다른 문항을 준다', w2.changed && w2.sameType, (w2.changed ? '바뀜' : '그대로') + ' · 같은 유형 ' + w2.sameType);
  ok('(a) 마법사 2 도 시험지 창까지', w2.slots > 0, '칸 ' + w2.slots + '개');

  // ── 마법사 3·5 (학습 세트 · 단어 시험지) ──
  const w35 = await page.evaluate(async () => {
    try { pbClose(); } catch (e) { }
    const out = {};
    wzOpen('kit');
    out.kitSteps = [...document.querySelectorAll('#wz-steps .wz-step')].map(x => x.textContent.trim());
    out.kitBook = (_wz.d.tbId || '') ? 'ok' : '';
    for (let i = 0; i < 5 && _wz; i++) { await wzNext(); await new Promise(r => setTimeout(r, 260)); }
    out.kitOpen = /open/.test((document.getElementById('m-kit') || {}).className || '');
    try { closeM('m-kit'); } catch (e) { }
    wzOpen('vocab');
    out.vocabSteps = [...document.querySelectorAll('#wz-steps .wz-step')].map(x => x.textContent.trim());
    for (let i = 0; i < 5 && _wz; i++) { await wzNext(); await new Promise(r => setTimeout(r, 260)); }
    out.vocabOpen = /open/.test((document.getElementById('m-vocab-paper') || {}).className || '');
    try { closeM('m-vocab-paper'); } catch (e) { }
    return out;
  });
  ok('(a) 마법사 3 — 단계와 기본 책', w35.kitSteps.length >= 3 && w35.kitBook === 'ok', w35.kitSteps.join(' / '));
  ok('(a) 마법사 3 끝에 학습 세트 창', w35.kitOpen);
  ok('(a) 마법사 5 — 단계', w35.vocabSteps.length >= 3, w35.vocabSteps.join(' / '));
  ok('(a) 마법사 5 끝에 단어 시험지 창', w35.vocabOpen);

  // ── 마법사 4 (비슷한 문제) — AI 는 가짜로 ──
  await page.route('**/functions/v1/claude-proxy', async r => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
    if (!b.model) return r.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
    const txt = JSON.stringify(b);
    let out;
    if (/학생처럼 풀어라/.test(txt)) out = JSON.stringify([{ no: 1, answer: 0, evidence: '근거' }, { no: 2, answer: 1, evidence: '근거' }, { no: 3, answer: 2, evidence: '근거' }]);
    else out = JSON.stringify([1, 2, 3].map(i => ({
      stem: '새 문항 ' + i, passage: 'New passage ' + i + ' for practice. '.repeat(3),
      choices: ['a', 'b', 'c', 'd', 'e'], answer: i % 5, explain: '해설', intent: '의도',
    })));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: out }] }) });
  });
  const w4 = await page.evaluate(async () => {
    wzOpen('iso');
    const steps = [...document.querySelectorAll('#wz-steps .wz-step')].map(x => x.textContent.trim());
    const picks = document.querySelectorAll('#wz-body .wz-pick').length;
    _wz.d.itemId = 'wz-t-0';
    await wzNext(); await new Promise(r => setTimeout(r, 120));
    const note = (document.getElementById('wz-note') || {}).textContent || '';
    await wzNext(); await new Promise(r => setTimeout(r, 120));
    await wzNext();
    await new Promise(r => setTimeout(r, 3800));
    return { steps, picks, note, tab: _dataTab, items: (typeof _isoItems !== 'undefined' ? _isoItems.length : 0) };
  });
  ok('(a) 마법사 4 — 세 단계', w4.steps.length === 3, w4.steps.join(' / '));
  ok('(a) 마법사 4 — 원본 고르기', w4.picks > 0, w4.picks + '개');
  ok('마법사 4 는 AI 횟수를 미리 알려 준다', /AI/.test(w4.note), w4.note);
  ok('(a) 마법사 4 끝에 동형 화면 + 문항', w4.tab === 'iso' && w4.items > 0, w4.tab + ' · 문항 ' + w4.items + '개');

  // ── 문제 은행 다듬기 ──
  const ib = await page.evaluate(async () => {
    switchDataTab('items');
    await new Promise(r => setTimeout(r, 900));
    _ibBasketSet([]); _ibSelId = ''; renderItemList();
    await new Promise(r => setTimeout(r, 300));
    const side = document.querySelector('.ib-side');
    const shown = [...side.children].filter(x => x.tagName !== 'DETAILS' && (x.tagName === 'SELECT' || x.tagName === 'INPUT')).length;
    const guide = (document.getElementById('ib-detail') || {}).textContent || '';
    const labels = (document.getElementById('ib-list') || {}).textContent || '';
    ibBasketToggle('wz-t-0');
    await new Promise(r => setTimeout(r, 250));
    const bar = document.getElementById('ib-bskbar');
    return {
      shown, more: !!document.getElementById('ib-more-f'),
      guide: guide.indexOf('담기') >= 0 && guide.indexOf('시험지 만들기') >= 0,
      labels: labels.indexOf('담기') >= 0 && labels.indexOf('고치기') >= 0,
      bar: bar.style.display !== 'none' && bar.textContent.indexOf('바구니 ' + ibBasket().length + '개') >= 0
        && bar.textContent.indexOf('시험지 만들기') >= 0,
      barTxt: bar.textContent.replace(/\s+/g, ' ').slice(0, 40),
      labelTxt: labels.replace(/\s+/g, ' ').slice(0, 0) + (labels.indexOf('담기') >= 0 ? '담기O' : '담기X') + (labels.indexOf('고치기') >= 0 ? ' 고치기O' : ' 고치기X'),
    };
  });
  ok('A3 거르기는 넷만 보이고 나머지는 자세히', ib.shown === 4 && ib.more, '보이는 칸 ' + ib.shown + '개');
  ok('A3 오른쪽 빈 칸에 길잡이', ib.guide);
  ok('A3 카드 아이콘에 글자', ib.labels, ib.labelTxt);
  ok('A3 바구니 띠', ib.bar, ib.barTxt);

  await page.evaluate(async () => { try { await idbSet('pp_item_keep', []); } catch (e) { } });
  console.log('\n콘솔 오류 ' + errs.length + '건');
  errs.slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_guided 실패:', e); process.exit(1); });
