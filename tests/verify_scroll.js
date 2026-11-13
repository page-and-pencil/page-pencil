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
  console.log('\n콘솔 오류 ' + errs.length + '건');
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_scroll 실패:', e); process.exit(1); });
