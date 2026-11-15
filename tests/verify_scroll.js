require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 스크롤 점검 — 화면보다 긴 내용이 **휠로 끝까지 닿는가**.
// 새 탭·새 창을 만들 때마다 PANELS/MODALS 에 한 줄을 더한다.
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };

// 선생님 화면의 탭 — [이름, 여는 법, 맨 아래 요소를 고르는 법]
const PANELS = [
  ['대시보드', () => swTab('t-dash'), '#t-dash'],
  ['클래스', () => swTab('t-class'), '#t-class'],
  ['학생', () => swTab('t-stu'), '#t-stu'],
  ['과제', () => swTab('t-assign'), '#t-assign'],
  ['테스트', () => swTab('t-tst'), '#t-tst'],
  ['교재·문제 · 라이브러리', () => { swTab('t-data'); switchDataTab('library'); }, '#dp-library'],
  ['교재·문제 · 만들기', () => { swTab('t-data'); switchDataTab('make'); }, '#dp-make'],
  ['교재·문제 · 교재', () => { swTab('t-data'); switchDataTab('tbook'); }, '#dp-book'],
  ['교재·문제 · 원서', () => { swTab('t-data'); switchDataTab('lib'); }, '#dp-book'],
  ['교재·문제 · 어휘', () => { swTab('t-data'); switchDataTab('word'); }, '#dp-word'],
  ['교재·문제 · 기출', () => { swTab('t-data'); switchDataTab('bank'); }, '#dp-bank'],
  ['교재·문제 · 문제 은행', () => { swTab('t-data'); switchDataTab('items'); }, '#dp-items'],
  ['교재·문제 · 시험지', () => { swTab('t-data'); switchDataTab('paper'); }, '#dp-ws'],
  ['교재·문제 · 동형 문제', () => { swTab('t-data'); switchDataTab('iso'); }, '#dp-iso'],
  ['교재·문제 · 학습 세트', () => { swTab('t-data'); switchDataTab('kit'); }, '#dp-ws'],
  ['교재·문제 · 저장된 것', () => { swTab('t-data'); switchDataTab('ws'); }, '#dp-ws'],
  ['교재·문제 · 시험 일정', () => { swTab('t-data'); switchDataTab('exam'); }, '#dp-exam'],
  ['교재·문제 · 백업·일괄', () => { swTab('t-data'); switchDataTab('master'); }, '#dp-master'],
  ['설정', () => swTab('t-cfg'), '#t-cfg'],
];
const MODALS = [
  ['설계 카드', () => isoCardsOpen(0), '#m-iso-cards .mdl'],
  ['마법사', () => wzOpen('exam'), '#m-wiz .mdl'],
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 600 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  await page.route('**/rest/v1/**', r => r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 201, body: '[]' }));
  await page.route('**/functions/v1/claude-proxy', r => r.fulfill({ status: 400, contentType: 'application/json', body: '{}' }));
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 140)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(2200);

  // 가짜 책·문항을 넣어 길게 만든다 (실제 서버는 읽기만)
  await page.evaluate(async () => {
    const rows = [];
    for (let i = 0; i < 400; i++) rows.push({
      id: 'sc' + i, updated_at: '2026-11-14T00:00:00Z', ntoc: 3, hassample: false, nbank: 1, ntext: 1,
      hastocimg: false, haspreview: false,
      meta: { title: '보기용 교재 ' + i, publisher: '보기출판', series: '보기 시리즈 ' + (i % 7),
        seriesKey: 'sk' + (i % 7), seriesOrder: (i % 6) + 1, target: '중등', area: '리딩', use: '일반',
        stage: ['P3', 'M1', 'M2', 'M3', 'H1'][i % 5], stageG: 5 + (i % 5), cover: '' },
    });
    _libRows = rows; _libAt = Date.now(); _libStamps = {}; _libMax = '2026-11-14T00:00:00Z';
    const dev = [];
    for (let i = 0; i < 60; i++) dev.push(_ibNorm({
      id: 'sc-it-' + i, type: 'blank', grade: '중2', stem: '보기용 문항 ' + i,
      passage: '보기 지문 ' + i, choices: ['a', 'b', 'c', 'd'], answer: i % 4, src: { kind: 'book', keep: true },
    }));
    await idbSet('pp_item_keep', dev);
    try { await ibLoad(true); } catch (e) { }
  });

  // 휠로 끝까지 닿는가
  const reach = async (sel) => page.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (!root) return { skip: true };
    // 일부러 가려 둔 것(접은 <details>·overflow:hidden 카드 안)은 빼고 본다
    const clipped = e => {
      let p = e.parentElement;
      for (let i = 0; i < 12 && p && p !== document.body; i++) {
        const cs = getComputedStyle(p);
        if (cs.overflow === 'hidden' || cs.overflowY === 'hidden') {
          const pr = p.getBoundingClientRect(), er = e.getBoundingClientRect();
          if (er.bottom > pr.bottom + 2 || er.top < pr.top - 2) return true;
        }
        if (p.tagName === 'DETAILS' && !p.open) return true;
        p = p.parentElement;
      }
      return false;
    };
    const all = [...root.querySelectorAll('*')].filter(e => e.offsetParent !== null && !clipped(e));
    const last = all.length ? all[all.length - 1] : root;
    const vh0 = window.innerHeight;
    const b0 = Math.round(last.getBoundingClientRect().bottom);
    const need = Math.max(0, b0 - vh0);        // 화면 아래로 더 있는 길이
    // 스크롤되는 조상을 찾아 끝까지 내린다
    let el = last, moved = 0;
    for (let i = 0; i < 12 && el; i++) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4) {
        const before = el.scrollTop; el.scrollTop = 99999; moved += el.scrollTop - before;
      }
      el = el.parentElement;
    }
    // html{scroll-behavior:smooth} 라서 곧바로 재면 0 이다 — 'instant' 로 옮기고 기다린다
    const de = document.scrollingElement || document.documentElement;
    const dBefore = de.scrollTop;
    try { window.scrollTo({ top: 999999, behavior: 'instant' }); } catch (e) { try { window.scrollTo(0, 999999); } catch (e2) { } }
    await new Promise(r => setTimeout(r, 300));
    moved += Math.max(de.scrollTop, window.scrollY || 0) - dBefore;
    await new Promise(r => setTimeout(r, 150));
    const r = last.getBoundingClientRect();
    const who = last.tagName.toLowerCase() + (last.id ? ('#' + last.id) : '') +
      (last.className && typeof last.className === 'string' ? ('.' + last.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')) : '');
    return { need, moved, bottom: Math.round(r.bottom), vh: window.innerHeight, who,
      pos: getComputedStyle(last).position,
      reached: r.bottom <= window.innerHeight + 2 };
  }, sel);

  const bad = [];
  for (const [name, open, sel] of PANELS) {
    await page.evaluate(fn => { try { eval('(' + fn + ')()'); } catch (e) { } }, open.toString());
    await wait(700);
    const r = await reach(sel);
    if (r.skip) { console.log('  –   ' + name + ' (칸 없음)'); continue; }
    const over = r.need > 8;
    const good = !over || r.reached;
    if (!good) bad.push(name);
    console.log((good ? '  OK  ' : '  X   ') + name + ' — 더 있는 길이 ' + r.need + 'px · 내려간 양 ' + r.moved + 'px' + (good ? '' : ' · 맨 아래가 ' + (r.bottom - r.vh) + 'px 밖 [' + r.who + ' ' + r.pos + ']'));
  }
  ok('모든 탭이 끝까지 내려간다', bad.length === 0, bad.length ? ('안 되는 곳: ' + bad.join(', ')) : '19개 탭');

  // 라이브러리 — [더 보기] 로 120장이 된 뒤에도 닿는다
  const more = await page.evaluate(async () => {
    swTab('t-data'); switchDataTab('library');
    await new Promise(r => setTimeout(r, 600));
    _libPage = 1; renderLibrary();
    const n1 = document.querySelectorAll('#lib-grid .lib-card').length;
    _libPage = 2; renderLibrary();
    await new Promise(r => setTimeout(r, 300));
    return { n1, n2: document.querySelectorAll('#lib-grid .lib-card').length };
  });
  const r2 = await reach('#dp-library');
  ok('라이브러리는 [더 보기] 뒤에도 끝까지 닿는다', r2.reached && more.n2 > more.n1,
    more.n1 + '장 → ' + more.n2 + '장 · 더 있는 길이 ' + r2.need + 'px · 내려간 양 ' + r2.moved + 'px');

  // 커리큘럼 지도
  await page.evaluate(async () => { libSetView('map'); await new Promise(r => setTimeout(r, 800)); });
  const r3 = await reach('#dp-library');
  ok('커리큘럼 지도도 끝까지 닿는다', r3.reached, '더 있는 길이 ' + r3.need + 'px · 내려간 양 ' + r3.moved + 'px');
  await page.evaluate(() => libSetView('browse'));

  // 창
  const badM = [];
  for (const [name, open, sel] of MODALS) {
    await page.evaluate(fn => { try { eval('(' + fn + ')()'); } catch (e) { } }, open.toString());
    await wait(800);
    const r = await reach(sel);
    if (r.skip) { console.log('  –   ' + name + ' (창 없음)'); continue; }
    const good = r.need <= 8 || r.reached;
    if (!good) badM.push(name);
    console.log((good ? '  OK  ' : '  X   ') + name + ' 창 — 더 있는 길이 ' + r.need + 'px · 내려간 양 ' + r.moved + 'px');
    await page.evaluate(() => { document.querySelectorAll('.mo.open').forEach(m => m.classList.remove('open')); });
  }
  ok('창도 끝까지 내려간다', badM.length === 0, badM.length ? ('안 되는 곳: ' + badM.join(', ')) : MODALS.length + '개 창');

  // 휴대폰 폭
  const narrow = [];
  for (const W of [320, 390]) {
    await page.setViewportSize({ width: W, height: 600 });
    await page.evaluate(async () => { swTab('t-data'); switchDataTab('library'); await new Promise(r => setTimeout(r, 500)); });
    const r = await reach('#dp-library');
    const over = await page.evaluate(() => Math.round(document.documentElement.scrollWidth - window.innerWidth));
    narrow.push({ w: W, reached: !!r.reached, over: over, need: r.need, moved: r.moved });
  }
  ok('휴대폰 폭에서도 내려간다', narrow.every(x => x.reached && x.over === 0),
    narrow.map(x => x.w + 'px ' + (x.reached ? '닿음' : '못 닿음') + ' · 가로넘침 ' + x.over +
      ' · 더 있던 길이 ' + x.need + ' · 내려간 양 ' + x.moved).join(' / '));

  await page.evaluate(async () => { try { await idbSet('pp_item_keep', []); } catch (e) { } });
  await ctx.close();

  // ══ 넓힌 점검 (2026-11-15) — '갇힌 칸' 0 ══
  // overflow:hidden 인 칸의 내용이 40px 넘게 넘치는데, 그 안에도 밖에도 스크롤하는 칸이 없다 = 휠로 못 보는 내용.
  // 선생님 8탭 · 교재·문제 13화면(교재는 둘) · 학생 패널 탭 · 학생 3탭 · 학부모 탭 · 창 58개 × 네 크기.
  // 자료는 넉넉히 넘치게: 교재 3천 권·자료 1,200줄·수업 300건, 그리고 화면·창마다 맨 끝에 2,400px 채움 칸을 붙인다.
  const SIZES = [[1366, 800], [1280, 620], [800, 1000], [390, 780]];
  const traps = [];
  const trapScan = async (pg, where, rootSel, fill) => pg.evaluate(({ rootSel, fill }) => {
    const root = rootSel ? document.querySelector(rootSel) : document.body;
    if (!root || (root.offsetParent === null && getComputedStyle(root).position !== 'fixed')) return { skip: true };
    if (fill) {
      // 내용이 들어가는 칸(가장 큰 자식으로 내려가며)을 찾아 그 끝에 채움 칸을 붙인다
      // 안에 스크롤 칸이 있으면 내용은 거기 들어간다 — 가장 큰 스크롤 칸에 붙인다
      const sc = [...root.querySelectorAll('*')].filter(x => x.offsetParent !== null && x.clientHeight > 40 && /(auto|scroll)/.test(getComputedStyle(x).overflowY))
        .sort((x, y) => (y.clientHeight * y.clientWidth) - (x.clientHeight * x.clientWidth))[0];
      let c = sc || root;
      for (let i = 0; i < 6 && !sc; i++) {
        const kids = [...c.children].filter(k => k.offsetParent !== null && !k.classList.contains('mo-foot') && k.tagName !== 'BUTTON');
        if (!kids.length) break;
        const big = kids.sort((x, y) => y.offsetHeight - x.offsetHeight)[0];
        if (kids.length > 1 && big.offsetHeight < c.clientHeight * 0.3) break;
        c = big;
        if (kids.length > 1) break;
      }
      const f = document.createElement('div'); f.className = '__fill'; f.style.cssText = 'height:2400px;flex:none;background:repeating-linear-gradient(#0000 0 40px,#0001 40px 41px)';
      f.textContent = '채움'; c.appendChild(f);
    }
    const scrolls = el => { const cs = getComputedStyle(el); return /(auto|scroll|overlay)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4; };
    const docScroll = (() => { const de = document.scrollingElement || document.documentElement; return de.scrollHeight > innerHeight + 4 && getComputedStyle(document.body).overflowY !== 'hidden' && getComputedStyle(document.documentElement).overflowY !== 'hidden'; })();
    const out = [];
    const all = [root, ...root.querySelectorAll('*')];
    for (const e of all) {
      if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') continue;
      if (/^(SELECT|TEXTAREA|IMG|SVG|CANVAS|IFRAME|VIDEO|INPUT|svg|path)$/.test(e.tagName)) continue;
      const cs = getComputedStyle(e);
      if (!(cs.overflowY === 'hidden' || cs.overflowY === 'clip')) continue;
      if (e.clientHeight < 20) continue;
      if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') continue;
      const over = e.scrollHeight - e.clientHeight;
      if (over <= 40) continue;
      let p = e.parentElement, closed = false;
      for (; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open) { closed = true; break; }
      if (closed) continue;
      const inner = [...e.querySelectorAll('*')].some(scrolls);
      let outer = docScroll;
      for (let q = e.parentElement; q && !outer; q = q.parentElement) if (scrolls(q)) outer = true;
      if (inner || outer) continue;
      out.push((e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) + ' +' + over + 'px');
    }
    document.querySelectorAll('.__fill').forEach(f => f.remove());
    return { hits: out };
  }, { rootSel, fill });

  const seedTeacher = () => {
    const CATS = ['리딩', '어휘', '어법', '리스닝', '라이팅', '파닉스', ''];
    const tbs = [];
    for (let i = 0; i < 3000; i++) tbs.push({ id: 'sg' + i, type: 'textbook', title: '가상 ' + (CATS[i % 7] || '분류없음') + ' 책 ' + i,
      series: '가상 시리즈 ' + (i % 300), publisher: '가상 출판 ' + (i % 40), category: CATS[i % 7], src: i % 11 ? 'bank-auto' : '', units: { U1: [{ en: 'a' }] } });
    _cache.globalTextbooks = tbs.concat((_cache.globalTextbooks || []).filter(b => b.type === 'library'));
    const sid = (_cache.students[0] || {}).id;
    const L = [];
    for (let i = 0; i < 300; i++) L.push({ id: 'sl' + i, sid, date: '2026-' + String(1 + (i % 10)).padStart(2, '0') + '-' + String(1 + (i % 27)).padStart(2, '0'),
      materials: { reading: { book: tbs[i % 12].title, unit: 'U1' } }, comment: '가상 수업 메모 ' + i });
    _cache.lessons = L;
    const E = [];
    for (let i = 0; i < 1200; i++) E.push({ id: 'se' + i, nfiles: 2, naudio: 0, meta: { title: '가상 자료 책 ' + i, series: '가상 출판사 ' + (i % 12), cat: '교재', origin: 'book', use: '일반' } });
    _ebRows = E; _ebLoading = false;
    try { _ourBk.k = ''; } catch (e) { }
  };
  const T_SCREENS = [
    ['대시보드', "swTab('t-dash')", '#t-dash'], ['클래스', "swTab('t-class')", '#t-class'], ['학생', "swTab('t-stu')", '#t-stu'],
    ['숙제', "swTab('t-assign')", '#t-assign'], ['테스트', "swTab('t-tst')", '#t-tst'], ['교재·문제', "swTab('t-data')", '#t-data'],
    ['워크시트', "swTab('t-worksheet')", '#t-worksheet'], ['설정', "swTab('t-cfg')", '#t-cfg'],
    ...[['library', '#dp-library'], ['make', '#dp-make'], ['lib', '#dp-book'], ['word', '#dp-word'], ['bank', '#dp-bank'], ['items', '#dp-items'],
      ['paper', '#dp-ws'], ['iso', '#dp-iso'], ['kit', '#dp-ws'], ['ws', '#dp-ws'], ['exam', '#dp-exam'], ['master', '#dp-master']]
      .map(([k, sel]) => ['교재·문제 · ' + k, "swTab('t-data');switchDataTab('" + k + "')", sel]),
    ['교재·문제 · 교재 [우리 교재]', "swTab('t-data');switchDataTab('tbook');tbSetSrc('ours')", '#dp-book'],
    ['교재·문제 · 교재 [전체]', "swTab('t-data');switchDataTab('tbook');tbSetSrc('all')", '#dp-book'],
    ['교재·문제 · 교재 [아직 교재가 아닌 자료]', "swTab('t-data');switchDataTab('tbook');tbSetSrc('bank');document.querySelectorAll('#tb-bank-box details.ebb').forEach(d=>d.open=true)", '#dp-book'],
    ...['sp-summary', 'sp-lessons', 'sp-tests', 'sp-hw', 'sp-reading', 'sp-rdlog-tab', 'sp-vocab', 'sp-payment']
      .map(k => ['학생 패널 · ' + k, "swTab('t-stu');openStuPanelTab((_cache.students[0]||{}).id,'" + k + "')", '#' + k]),
  ];
  const screenCount = { teacher: 0, modal: 0, student: 0, parent: 0 };
  const run = async (pg, list, kind, W, H) => {
    for (const [name, open, sel, fill] of list) {
      await pg.evaluate(src => { try { document.querySelectorAll('.mo.open').forEach(m => m.classList.remove('open')); (0, eval)(src); } catch (e) { } }, open);
      await wait(kind === 'modal' ? 120 : 220);
      const r = await trapScan(pg, name, sel, fill !== false);
      if (r.skip) continue;
      screenCount[kind]++;
      r.hits.forEach(h => traps.push(W + 'x' + H + ' ' + name + ' — ' + h));
    }
  };
  const mkCtx = async (sess) => {
    const c = await browser.newContext({ viewport: { width: 1366, height: 800 }, locale: 'ko-KR' });
    await c.addInitScript(s => { try { localStorage.setItem('pp_session', JSON.stringify(s)); } catch (e) { } }, sess);
    const p = await c.newPage();
    await p.route('**/rest/v1/**', r => r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 201, body: '[]' }));
    await p.route('**/functions/v1/**', r => r.fulfill({ status: 400, contentType: 'application/json', body: '{}' }));
    await p.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
    await wait(1500);
    return { c, p };
  };
  const T = await mkCtx({ role: 'teacher' });
  await T.p.evaluate(seedTeacher);
  const MODAL_IDS = await T.p.evaluate(() => [...document.querySelectorAll('.mo[id]')].map(m => m.id));
  const M_SCREENS = MODAL_IDS.map(id => ['창 ' + id, "document.getElementById('" + id + "').classList.add('open')", '#' + id + ' .mdl, #' + id + ' > div']);
  const S = await mkCtx({ role: 'student', sid: 'fx-stu-1' });
  const P = await mkCtx({ role: 'parent', sid: 'fx-stu-1' });
  const S_SCREENS = ['st-home', 'st-vocab', 'st-library'].map(k => ['학생 · ' + k, "swStuTab('" + k + "')", '#' + k]);
  const P_SCREENS = await P.p.evaluate(() => [...document.querySelectorAll('#s-parent [data-ppnav]')].filter(b => b.offsetParent !== null)
    .map(b => ['학부모 · ' + b.dataset.ppnav, "ppNav(document.querySelector('[data-ppnav=\"" + b.dataset.ppnav + "\"]'),'" + b.dataset.ppnav + "')", '#pp-body [data-pptab="' + b.dataset.ppnav + '"]']));
  for (const [W, H] of SIZES) {
    for (const x of [T, S, P]) await x.p.setViewportSize({ width: W, height: H });
    await wait(300);
    await run(T.p, T_SCREENS, 'teacher', W, H);
    await run(T.p, M_SCREENS, 'modal', W, H);
    await T.p.evaluate(() => document.querySelectorAll('.mo.open').forEach(m => m.classList.remove('open')));
    await run(S.p, S_SCREENS, 'student', W, H);
    await run(P.p, P_SCREENS, 'parent', W, H);
  }
  traps.forEach(t => console.log('      갇힘 ' + t));
  ok('갇힌 칸 0 — 네 크기 (1366x800 · 1280x620 · 800x1000 · 390x780)', traps.length === 0,
    '본 화면 선생님 ' + screenCount.teacher + ' · 창 ' + screenCount.modal + ' · 학생 ' + screenCount.student + ' · 학부모 ' + screenCount.parent + ' (네 크기 합) · 창 ' + MODAL_IDS.length + '개 · 갇힘 ' + traps.length);
  ok('창 58개를 다 본다', MODAL_IDS.length >= 58, MODAL_IDS.length + '개');
  for (const x of [T, S, P]) await x.c.close();
  console.log('\n콘솔 오류 ' + errs.length + '건');
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_scroll 실패:', e); process.exit(1); });
