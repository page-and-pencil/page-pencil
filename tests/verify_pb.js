require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
const { pageUrl, fileUrl } = require('./_page');
// 시험지 만들기 + 문제 은행 보완 — 전부 가짜 서버. AI 는 부르지 않는다.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));
const t0 = 1762000000000;

const P = 'Reading widely does more than fill a shelf. It teaches a reader to hold two ideas at once, to wait before judging, and to ask what a writer has left unsaid. ';
const mk = (id, o) => Object.assign({
  id, type: 'blank', typeName: '읽기 · 빈칸 추론', skill: 'read', grade: '고1', diff: 3, diffSrc: 'rule',
  stem: '다음 빈칸에 들어갈 말로 가장 적절한 것은?', passage: P, choices: ['keep asking', 'memorize more', 'avoid problems', 'work alone', 'follow rules'],
  answer: 0, explain: '글의 핵심을 다른 말로 바꾼 표현이 정답이다.', wrong: ['① 정답', '② 재활용'], words: 28,
  src: { kind: 'exam', exam: '2026학년도 9월 모의평가 영어', qno: '31' }, tags: [], star: false, checked: false,
  createdAt: t0, editedAt: t0
}, o);
const TYPES = ['blank', 'purpose', 'mood', 'claim', 'gist', 'topic', 'title', 'grammar', 'vocab', 'order', 'insert', 'summary', 'irrelevant', 'implicit', 'chart', 'notice', 'bio'];
const seed = [];
TYPES.forEach((t, i) => {
  for (let k = 0; k < 2; k++) seed.push(mk('it' + t + k, {
    type: t, typeName: '', skill: '', diff: 1 + ((i + k) % 5), grade: (i % 2) ? '고1' : '고2',
    stem: '[' + t + k + '] 윗글에 대한 물음', answer: (i + k) % 5
  }));
});
// 한 지문 묶음 3문항 + 듣기(대본) + 서술형
seed.push(mk('set1', { setId: 'setA', setOrder: 1, type: 'long3', stem: '윗글의 제목으로 가장 적절한 것은?', passage: P + P }));
seed.push(mk('set2', { setId: 'setA', setOrder: 2, type: 'long3', stem: '밑줄 친 부분이 가리키는 대상이 다른 것은?', passage: P + P, answer: 2 }));
seed.push(mk('set3', { setId: 'setA', setOrder: 3, type: 'long3', stem: '윗글의 내용으로 적절하지 않은 것은?', passage: P + P, answer: 3 }));
seed.push(mk('listen1', { type: 'l_purpose', skill: 'listen', stem: '다음을 듣고, 남자가 하는 말의 목적으로 가장 적절한 것은?', passage: '', script: 'W: Good morning, everyone. I am happy to tell you about our new reading club.', answer: 1 }));
seed.push(mk('essay1', { type: 'm_write_cond', skill: 'write', stem: '조건에 맞게 영작하시오.', choices: [], answer: -1, answerText: 'I have lived here for ten years.', rubric: '현재완료 2점, 어순 2점, 철자 1점' }));
seed.push(mk('keep1', { id: 'keep1', stem: '원문 지문 문항', src: { kind: 'exam', keep: true, exam: '2025 수능' } }));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); ['pp_ib_filters', 'pp_item_basket', 'pp_paper_frames'].forEach(k => localStorage.removeItem(k)); } catch (e) { } });
  const page = await ctx.newPage();
  const DB = new Map(seed.map(d => [d.id, { id: d.id, data: d, updated_at: '2026-11-11T00:00:00+00:00' }]));
  let itemPosts = [], wsPosts = [], aiCalls = 0;
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
      (Array.isArray(b) ? b : [b]).forEach(row => { itemPosts.push(row); if (row && row.id) DB.set(row.id, { id: row.id, data: row.data, updated_at: new Date().toISOString() }); });
      return r.fulfill({ status: 201, body: '' });
    }
    const sel = url.searchParams.get('select') || '';
    if (sel === 'updated_at') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + DB.size, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify([{ updated_at: '2026-11-11T00:00:00+00:00' }]) });
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
  const wsDB = new Map();
  await page.route('**/rest/v1/worksheets**', async r => {
    if (r.request().method() === 'POST') {
      let row = {}; try { row = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
      wsPosts.push(row);
      if (row && row.id) wsDB.set(row.id, { id: row.id, data: row.data, updated_at: new Date().toISOString() });
      return r.fulfill({ status: 201, body: '' });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...wsDB.values()]) });
  });
  await page.route('**/functions/v1/claude-proxy', r => { if (r.request().method() === 'POST') { aiCalls++; } return r.fulfill({ status: 400, body: '{"error":{"message":"no"}}' }); });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));
  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(1800);
  const aiBoot = aiCalls;

  // ── 0) 문제 은행 보완 ────────────────────────────────────────────────
  const GUESS = [
    ['다음 글의 목적으로 가장 적절한 것은?', 'purpose'],
    ['다음 글에 드러난 I의 심경으로 가장 적절한 것은?', 'mood'],
    ['다음 글에서 필자가 주장하는 바로 가장 적절한 것은?', 'claim'],
    ['밑줄 친 부분이 의미하는 바로 가장 적절한 것은?', 'implicit'],
    ['다음 글의 요지로 가장 적절한 것은?', 'gist'],
    ['다음 글의 주제로 가장 적절한 것은?', 'topic'],
    ['다음 글의 제목으로 가장 적절한 것은?', 'title'],
    ['다음 도표의 내용과 일치하지 않는 것은?', 'chart'],
    ['다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?', 'grammar'],
    ['문맥상 낱말의 쓰임이 적절하지 않은 것은?', 'vocab'],
    ['대화의 빈칸에 들어갈 말로 가장 적절한 것은?', 'l_short'],
    ['다음 빈칸에 들어갈 말로 가장 적절한 것은?', 'blank'],
    ['전체 흐름과 관계 없는 문장은?', 'irrelevant'],
    ['주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?', 'order'],
    ['주어진 문장이 들어가기에 가장 적절한 곳은?', 'insert'],
    ['다음 글의 내용을 한 문장으로 요약하고자 한다. 요약문의 빈칸에…', 'summary'],
    ['다음 안내문의 내용과 일치하는 것은?', 'notice'],
    ['Marie Curie에 관한 다음 글의 내용과 일치하지 않는 것은?', 'bio'],
    ['밑줄 친 (a)~(e) 중에서 가리키는 대상이 다른 것은?', 'm_ref'],
    ['조건에 맞게 영어로 쓰시오.', 'm_write_cond'],
    ['괄호 안의 단어를 바르게 배열하시오.', 'm_write_order'],
    ['그냥 물음입니다', '']
  ];
  const guessed = await page.evaluate(list => list.map(([s, want]) => { const k = _ibGuessType(s); return [s, k, want, k ? ISO_TYPES[k].n : '']; }), GUESS);
  const bad = guessed.filter(g => g[1] !== g[2]);
  ok('① 발문으로 유형 추정', bad.length === 0, bad.length ? bad.map(b => b[0].slice(0, 16) + '→' + (b[1] || '없음') + '(기대 ' + b[2] + ')').join(' / ') : GUESS.length + '개 규칙 모두 맞음');

  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('items'); });
  await page.waitForFunction(() => document.querySelectorAll('#ib-list .ib-card').length > 0, null, { timeout: 60000 });
  await wait(900);
  const add = await page.evaluate(async () => {
    ibAddManual();
    document.getElementById('ib-paste').value = '다음 글의 주제로 가장 적절한 것은?\n\nReading is a habit.\n\n① habit\n② speed\n③ money\n④ sleep\n⑤ noise\n정답: 1';
    ibParsePaste();
    await new Promise(r => setTimeout(r, 300));
    const sel = [...document.querySelectorAll('#ib-detail select')].find(s => s.querySelector('optgroup'));
    return { type: _ibEditing.type, name: _ibEditing.typeName, skill: _ibEditing.skill, selVal: sel ? sel.value : '(없음)', warn: /유형을 골라 주세요/.test(document.getElementById('ib-detail').innerText) };
  });
  ok('② 문항 추가 — 유형이 자동으로 찍힌다', add.type === 'topic' && /주제/.test(add.name) && add.skill === 'read' && add.selVal === 'topic' && !add.warn,
    add.type + ' · ' + add.name + ' · 칸 ' + add.selVal);
  const noGuess = await page.evaluate(async () => {
    ibAddManual();
    document.getElementById('ib-paste').value = '그냥 물음입니다\n\n본문\n\n① a\n② b';
    ibParsePaste();
    await new Promise(r => setTimeout(r, 300));
    const warn = /유형을 골라 주세요/.test(document.getElementById('ib-detail').innerText);
    const sel = [...document.querySelectorAll('#ib-detail select')].find(s => s.querySelector('optgroup'));
    sel.value = 'grammar'; sel.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 300));
    return { warn, type: _ibEditing.type, name: _ibEditing.typeName, skill: _ibEditing.skill };
  });
  ok('③ 못 찾으면 비우고 안내 · 골라서 채운다', noGuess.warn && noGuess.type === 'grammar' && /어법/.test(noGuess.name) && noGuess.skill === 'grammar',
    '안내 ✓ · 고른 뒤 ' + noGuess.name + '/' + noGuess.skill);
  const tbs = await page.evaluate(() => {
    const el = document.getElementById('ib-f-tb');
    return { shown: el.style.display !== 'none', n: el.options.length - 1, all: (_cache.globalTextbooks || []).length };
  });
  ok('④ 교재 거르기 — 은행에 있는 교재만', !tbs.shown && tbs.n === 0, '교재 전체 ' + tbs.all + '권 중 은행에 쓰인 것 ' + tbs.n + '권 → 칸 ' + (tbs.shown ? '보임' : '숨김'));

  // ── 1) 바구니 → 시험지 편집 ─────────────────────────────────────────
  const w0 = wsPosts.length;
  const open1 = await page.evaluate(async () => {
    ibCloseDetail();
    ['set2', 'itblank0', 'set1', 'itpurpose0', 'set3'].forEach(id => ibBasketToggle(id));
    await pbOpen();
    await new Promise(r => setTimeout(r, 1200));
    return {
      open: document.getElementById('m-paper').classList.contains('open'),
      rows: document.querySelectorAll('#pb-list .pb-row').length,
      order: _pbSlots.map(s => s.id),
      setLine: document.querySelectorAll('#pb-list .pb-setline').length
    };
  });
  const setIdx = open1.order.map((id, i) => /^set/.test(id) ? i : -1).filter(i => i >= 0);
  ok('⑤ 바구니를 누르면 시험지 편집이 열린다', open1.open && open1.rows === 5, '문항 ' + open1.rows + '줄');
  ok('⑥ 한 지문 묶음은 붙어 다닌다', setIdx.length === 3 && setIdx[2] - setIdx[0] === 2 && open1.setLine === 1,
    '자리 ' + setIdx.join(',') + ' · 순서 ' + open1.order.join(' '));
  const mv = await page.evaluate(() => { const before = _pbSlots.map(s => s.id); pbMove(_pbSlots.findIndex(s => /^set/.test(s.id)), 1); return { before, after: _pbSlots.map(s => s.id) }; });
  const aIdx = mv.after.map((id, i) => /^set/.test(id) ? i : -1).filter(i => i >= 0);
  ok('⑦ 묶음은 통째로 옮겨진다', aIdx.length === 3 && aIdx[2] - aIdx[0] === 2 && mv.before.join() !== mv.after.join(),
    mv.before.join(' ') + ' → ' + mv.after.join(' '));
  await page.evaluate(() => { pbPoints(0, 3); pbPoints(1, 2); });
  await wait(2200);
  const sum = await page.evaluate(() => ({ sum: document.getElementById('pb-sum').innerText, stat: document.getElementById('pb-stat').textContent }));
  const paper = wsPosts[wsPosts.length - 1];
  ok('⑧ 1.5초 자동 저장 (내용은 복사하지 않는다)',
    wsPosts.length === w0 + 1 && paper.data.kind === 'paper' && paper.data.itemIds.length === 5 &&
    !paper.data.items && !JSON.stringify(paper.data).includes('Reading widely does more'),
    'kind=' + paper.data.kind + ' · itemIds ' + paper.data.itemIds.length + '개 · 본문 없음 ✓ · "' + sum.stat + '"');
  ok('⑨ 배점 합계·정답 분포·쏠림 알림', /배점 11 ?점/.test(sum.sum.replace(/\s+/g,' ')) && /정답 분포/.test(sum.sum), sum.sum.replace(/\s+/g, ' ').slice(0, 90));

  // ── 2) 서식 4종 인쇄 ────────────────────────────────────────────────
  await page.evaluate(async () => {           // 듣기 대본·서술형도 들어간 시험지로 찍는다
    _pbSlots.push({ id: 'listen1' }, { id: 'essay1' });
    await _pbLoadData(['listen1', 'essay1']);
    _pbRender();
    window.__printed = [];
    window.open = () => { let buf = ''; return { document: { write(s) { buf += s; }, close() { window.__printed.push(buf); } } }; };
  });
  const FMT = [['suneung', '수능형'], ['naesin', '내신형'], ['worksheet', '학습지'], ['mini', '숙제 미니']];
  for (const [k] of FMT) {
    await page.evaluate(f => { pbSetFormat(f); pbPrint('q'); }, k);
    await wait(250);
  }
  await page.evaluate(() => { pbPrint('ans'); pbPrint('sol'); pbPrint('script'); pbPrint('omr'); });
  await wait(400);
  const printed = await page.evaluate(() => window.__printed);
  ok('⑩ 서식 4종 + 같이 찍는 것 4종이 만들어진다', printed.length === 8, printed.length + '장');
  const [su, na, ws, mi, ans, sol, scr, omr] = printed;
  ok('⑪ 수능형 — 2단·영어 영역·[3점]·묶음 지시문·확인 사항',
    /column-count:2/.test(su) && /영어 영역/.test(su) && /\[3점\]/.test(su) && /\[\d+~\d+\] 다음 글을 읽고/.test(su) && /확인 사항/.test(su),
    [/column-count:2/.test(su), /영어 영역/.test(su), /\[3점\]/.test(su), /\[\d+~\d+\]/.test(su), /확인 사항/.test(su)].join(','));
  ok('⑫ 내신형 — 머리표(학년도·고사명·과목·반·번호·이름) + 서술형 답란',
    /학년도·학기/.test(na) && /고사명/.test(na) && /과목/.test(na) && /번호·이름/.test(na) && /qw2|qw/.test(na), 'ok');
  ok('⑬ 학습지 — 1단 + 메모 여백 + 풀이 칸', !/column-count:2/.test(ws) && /memo-col/.test(ws) && /qmemo/.test(ws), 'ok');
  ok('⑭ 숙제 미니 — 정답이 마지막에 작게', /mini-ans/.test(mi) && /<b>정답<\/b>/.test(mi), 'ok');
  ok('⑮ 정답표·해설지·대본·OMR', /정답표/.test(ans) && /<th>번호<\/th>/.test(ans) && /정답·해설/.test(sol) && /듣기 대본/.test(scr) && /답안지/.test(omr) && /○ ○ ○ ○ ○/.test(omr), 'ok');
  // 인쇄 미리보기 캡처
  for (let i = 0; i < FMT.length; i++) {
    const f = SCR + '/pb_print_' + FMT[i][0] + '.html';
    fs.writeFileSync(f, printed[i], 'utf8');
    const p2 = await ctx.newPage();
    await p2.emulateMedia({ media: 'print' });
    await p2.setViewportSize({ width: 820, height: 1160 });
    await p2.goto(fileUrl(f));
    await wait(500);
    await p2.screenshot({ path: SCR + '/pb_print_' + FMT[i][0] + '.png' });
    await p2.close();
  }

  // ── 3) 자동 구성 (AI 없이) ──────────────────────────────────────────
  const aiBefore = aiCalls;
  const comp = await page.evaluate(async () => {
    document.getElementById('pb-frame').value = 'suneung28'; pbCfgChange();
    await pbCompose();
    await new Promise(r => setTimeout(r, 800));
    return {
      n: _pbSlots.length, filled: _pbSlots.filter(s => s.id).length, empty: _pbSlots.filter(s => s.empty).length,
      emptyShown: document.querySelectorAll('#pb-list .pb-empty').length,
      sum: document.getElementById('pb-sum').innerText
    };
  });
  ok('⑯ 자동 구성 — 수능 28문항 틀로 은행에서 채운다', comp.n === 28 && comp.filled > 0 && comp.empty === comp.emptyShown && aiCalls === aiBefore,
    '28칸 중 채움 ' + comp.filled + ' · 비어 있음 ' + comp.empty + ' · AI ' + (aiCalls - aiBefore) + '회');
  const unused = await page.evaluate(() => {
    const ids = _pbSlots.filter(s => s.id).map(s => s.id);
    return { allUnused: ids.every(id => ibUsedCount(id) <= 1), n: ids.length };
  });
  ok('⑰ 안 쓴 문항 먼저', unused.allUnused, '고른 ' + unused.n + '개 모두 사용 0~1회');
  const mid = await page.evaluate(async () => {
    document.getElementById('pb-frame').value = 'middle25'; pbCfgChange();
    await pbCompose(); await new Promise(r => setTimeout(r, 500));
    return _pbSlots.length;
  });
  const focus = await page.evaluate(async () => {
    document.getElementById('pb-frame').value = 'focus10'; pbCfgChange();
    document.getElementById('pb-focus').value = 'blank'; pbCfgChange();
    await pbCompose(); await new Promise(r => setTimeout(r, 500));
    return { n: _pbSlots.length, filled: _pbSlots.filter(s => s.id).length };
  });
  const custom = await page.evaluate(async () => {
    document.getElementById('pb-frame').value = 'custom'; pbCfgChange();
    pbCustomSet('purpose', 2); pbCustomSet('gist', 1);
    await pbCompose(); await new Promise(r => setTimeout(r, 500));
    const saved = JSON.parse(localStorage.getItem('pp_paper_frames') || '{}');
    return { n: _pbSlots.length, saved: saved.my, inSettings: false };
  });
  ok('⑱ 틀 4종', mid === 25 && focus.n === 10 && focus.filled >= 2 && custom.n === 3 && custom.saved.purpose === 2,
    '중학 ' + mid + ' · 유형집중 ' + focus.n + '칸(은행 문항 ' + focus.filled + '개) · 직접 ' + custom.n);
  ok('⑲ 직접 만든 틀은 기기에 (settings 아님)', !!custom.saved && aiCalls === aiBefore, 'localStorage pp_paper_frames ✓');

  // ── 4) 원문 지문 시험지는 기기에만 ──────────────────────────────────
  const w1 = wsPosts.length;
  const keepRes = await page.evaluate(async () => {
    await pbOpen(['keep1', 'itblank0']);
    await new Promise(r => setTimeout(r, 800));
    await _pbSave(true);
    const dev = (await idbGet('pp_paper_dev')) || [];
    return { stat: document.getElementById('pb-stat').textContent, dev: dev.length };
  });
  ok('⑳ 원문 지문이 든 시험지는 기기에만', wsPosts.length === w1 && keepRes.dev >= 1 && /기기에만 보관/.test(keepRes.stat),
    '서버 ' + (wsPosts.length - w1) + '회 · 기기 ' + keepRes.dev + '장');

  // ── 5) 다시 열기 ────────────────────────────────────────────────────
  const reopen = await page.evaluate(async () => {
    const saved = (_cache.worksheets || []).filter(w => w.kind === 'paper');
    pbClose();
    await new Promise(r => setTimeout(r, 400));
    await pbOpenSaved(saved[0].id);
    await new Promise(r => setTimeout(r, 1200));
    return { id: _pbPaper.id, n: _pbSlots.length, same: _pbPaper.id === saved[0].id, pts: Object.keys(_pbPaper.points || {}).length, title: _pbPaper.title };
  });
  ok('㉑ 저장된 시험지를 다시 연다', reopen.same && reopen.n > 0, '문항 ' + reopen.n + '줄 · 배점 ' + reopen.pts + '개 · "' + reopen.title + '"');
  const card = await page.evaluate(async () => {
    pbClose(); switchDataTab('ws');
    await new Promise(r => setTimeout(r, 1200));
    const cards = [...document.querySelectorAll('#ws-cards .bcard')];
    return { n: cards.length, paper: cards.filter(c => /시험지/.test(c.innerText)).length, dev: cards.filter(c => /이 기기/.test(c.innerText)).length };
  });
  ok('㉒ 저장된 워크시트에 시험지 카드', card.paper >= 1 && card.dev >= 1, '카드 ' + card.n + '개 중 시험지 ' + card.paper + '(기기 보관 ' + card.dev + ')');

  // ── 6) 사용 n회 ─────────────────────────────────────────────────────
  const used2 = await page.evaluate(async () => {
    switchDataTab('items');
    await new Promise(r => setTimeout(r, 1200));
    _pbUsageClear(); renderItemList();
    const txt = document.getElementById('ib-list').innerText;
    return { has: /사용 \d+회/.test(txt), n: ibUsedCount('itblank0') };
  });
  ok('㉓ 문항 카드에 사용 n회 (시험지 줄에서 센다)', used2.has && used2.n >= 1, 'itblank0 사용 ' + used2.n + '회');

  // ── 7) 화면 ─────────────────────────────────────────────────────────
  await page.evaluate(async () => { await pbOpen(['itblank0', 'itpurpose0', 'set1', 'set2', 'set3']); });
  await wait(1200);
  await page.screenshot({ path: SCR + '/pb_edit_1440.png' });
  const over = async w => { await page.setViewportSize({ width: w, height: 844 }); await wait(700); return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)); };
  const o390 = await over(390);
  await page.screenshot({ path: SCR + '/pb_edit_390.png' });
  const o320 = await over(320);
  await page.screenshot({ path: SCR + '/pb_edit_320.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  ok('㉔ 넘침 0 (390·320)', o390 === 0 && o320 === 0, o390 + ' / ' + o320);
  ok('㉕ AI 호출 0회 (부팅 확인 말고는)', aiCalls === aiBoot, (aiCalls - aiBoot) + '회');
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|400|404/i;
  const mine = errs.filter(e => !skip.test(e));
  ok('㉖ 콘솔 오류 0', mine.length === 0, mine.slice(0, 3).join(' | ') || '0');

  console.log('\n── 유형 추정 규칙 ──');
  guessed.forEach(g => console.log('  ' + (g[0].length > 34 ? g[0].slice(0, 33) + '…' : g[0]).padEnd(36) + ' → ' + (g[1] ? (g[3] + ' (' + g[1] + ')') : '(비움)')));
  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
