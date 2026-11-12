require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 기출과 교재 나누기 (B) — 가짜 자료줄만 쓴다. 실제 기출 원문은 쓰지 않는다.
//  (g) 기출 탭 줄 수 = origin exam 줄 수, 용도 칩 합이 맞는다
//  (h) 교재 탭 '자료만 있는 책' 에 book 줄이 다 들어 있다
//  (i) origin 없는 줄이 사라지지 않는다
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  for (const tb of ['worksheets', 'item_bank', 'exam_bank'])
    await page.route('**/rest/v1/' + tb + '**', r => r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 201, body: '[]' }));
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 150)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 150)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(2000);

  // 가짜 자료줄 — origin·use 가 있는 줄 + 없는 줄(짐작해야 한다)
  const seed = await page.evaluate(async () => {
    const mk = (id, meta, naudio) => ({ id: id, updated_at: new Date().toISOString(), meta: meta, nfiles: 1, kinds: 'q', naudio: naudio || 0, extaud: false });
    const rows = [];
    const uses = [['수능', 4], ['내신', 3], ['듣기평가', 2], ['성취도·진단', 2], ['고입', 1]];
    let i = 0;
    uses.forEach(([u, n]) => { for (let k = 0; k < n; k++) rows.push(mk('ex-' + (i++), { origin: 'exam', use: u, cat: 'suneung', title: u + ' 보기용 ' + k, year: 2024, grade: '고1', region: '서울', school: '보기중', term: '1학기' })); });
    for (let k = 0; k < 6; k++) rows.push(mk('bk-' + k, { origin: 'book', use: k < 2 ? '수능 대비' : (k < 4 ? '일반' : '내신 대비'), cat: 'publisher', title: '보기용 교재 ' + k, series: '보기 시리즈', path: '출판사A/보기 시리즈' }));
    rows.push(mk('st-0', { origin: 'story', cat: 'audiobook', title: 'Sample Reader One' }, 3));
    rows.push(mk('dc-0', { origin: 'doc', cat: 'basic', title: '기초학력 보기 자료' }));
    // origin·use 가 없는 줄 — cat 으로 짐작해야 한다
    rows.push(mk('old-exam', { cat: 'school', title: '옛 줄(학교 정기고사)' }));
    rows.push(mk('old-book', { cat: 'bookdocs', title: '옛 줄(교재 단어)', series: '옛 시리즈', path: '출판사B/옛 시리즈' }));
    rows.push(mk('old-story', { cat: 'audiobook', title: 'Old Reader' }, 2));
    _ebRows = rows; _ebStoryIdx = null; _ebAt = Date.now();
    return {
      exam: rows.filter(r => ebOrigin(r.meta) === 'exam').length,
      book: rows.filter(r => ebOrigin(r.meta) === 'book').length,
      story: rows.filter(r => ebOrigin(r.meta) === 'story').length,
      doc: rows.filter(r => ebOrigin(r.meta) === 'doc').length,
      total: rows.length,
    };
  });
  ok('(i) origin 없는 줄도 어딘가에 들어간다',
    seed.exam + seed.book + seed.story + seed.doc === seed.total,
    'exam ' + seed.exam + ' · book ' + seed.book + ' · story ' + seed.story + ' · doc ' + seed.doc + ' / 전체 ' + seed.total);

  const guess = await page.evaluate(() => ({
    e: ebOrigin({ cat: 'school' }), b: ebOrigin({ cat: 'bookdocs' }), s: ebOrigin({ cat: 'audiobook' }),
    ue: ebUse({ cat: 'school' }), ub: ebUse({ cat: 'bookdocs' }),
  }));
  ok('(i) 갈래·용도를 cat 으로 짐작한다',
    guess.e === 'exam' && guess.b === 'book' && guess.s === 'story' && guess.ue === '내신' && guess.ub === '일반',
    JSON.stringify(guess));

  // ── (g) 기출 탭 ──
  const eb = await page.evaluate(async () => {
    swTab('t-data'); switchDataTab('bank');
    await new Promise(r => setTimeout(r, 700));
    ebSetUse('');
    await new Promise(r => setTimeout(r, 300));
    const cnt = (document.getElementById('eb-count') || {}).textContent || '';
    const chips = [...document.querySelectorAll('#eb-usebar .eb-use')].map(x => x.textContent.trim());
    const shown = _ebFiltered().length;
    // 칩 하나씩
    const by = {};
    for (const u of ['수능', '내신', '듣기평가', '성취도·진단', '고입']) {
      ebSetUse(u); by[u] = _ebFiltered().length;
    }
    ebSetUse('__doc'); const doc = _ebFiltered().length;
    ebSetUse('');
    const after = _ebFiltered().length;
    // 거르기 칸이 용도에 따라 바뀐다
    ebSetUse('내신');
    const naesin = ['eb-f-region', 'eb-f-school', 'eb-f-term'].map(id => (document.getElementById(id) || {}).style.display);
    ebSetUse('수능');
    const suneung = ['eb-f-region', 'eb-f-school'].map(id => (document.getElementById(id) || {}).style.display);
    ebSetUse('');
    return { cnt, chips, shown, by, doc, after, naesin, suneung };
  });
  ok('(g) 기출 탭은 origin exam 줄만', eb.shown === seed.exam, eb.shown + '줄 / exam ' + seed.exam + '줄');
  ok('(g) 용도 칩이 보인다', eb.chips.length === 7, eb.chips.join(' / '));
  ok('(g) 용도 칩 합 = 기출 전체',
    Object.values(eb.by).reduce((a, b) => a + b, 0) === seed.exam,
    JSON.stringify(eb.by));
  ok('(g) 참고 자료 칩은 doc 줄', eb.doc === seed.doc, eb.doc + '줄');
  ok('(g) 용도에 맞는 거르기만 남는다',
    eb.naesin.every(d => d !== 'none') && eb.suneung.every(d => d === 'none'),
    '내신 ' + JSON.stringify(eb.naesin) + ' · 수능 ' + JSON.stringify(eb.suneung));

  // ── (h) 교재 탭 '자료만 있는 책' ──
  const tb = await page.evaluate(async () => {
    switchDataTab('tbook');
    await new Promise(r => setTimeout(r, 900));
    const seg = !!document.getElementById('tb-src');
    tbSetSrc('bank');
    await new Promise(r => setTimeout(r, 600));
    const rows = tbBankRowsAll().length;
    const html = (document.getElementById('tb-bank-box') || {}).textContent || '';
    const uses = [...document.querySelectorAll('#tb-bank-uses .eb-use')].map(x => x.textContent.trim());
    tbBankSetUse('일반');
    await new Promise(r => setTimeout(r, 300));
    const only = tbBankRowsAll().length;
    tbBankSetUse('');
    tbSetSrc('own');
    await new Promise(r => setTimeout(r, 300));
    const backToOwn = (document.getElementById('tb-bank-wrap') || {}).style.display;
    return { seg, rows, uses, only, hasOld: html.indexOf('옛 시리즈') >= 0, backToOwn };
  });
  ok('(h) 교재 탭에 [등록 교재][자료만 있는 책] 전환', tb.seg);
  ok('(h) book 줄이 다 들어 있다', tb.rows === seed.book, tb.rows + '줄 / book ' + seed.book + '줄');
  ok('(h) origin 없는 옛 교재 줄도 보인다', tb.hasOld);
  ok('(h) 용도 거르기', tb.uses.length === 6 && tb.only > 0 && tb.only < tb.rows, tb.uses.join(' / ') + ' · 일반 ' + tb.only + '줄');
  ok('(h) 등록 교재로 되돌아온다', tb.backToOwn === 'none');

  // ── 원서 오디오 ──
  const st = await page.evaluate(() => ({ a: ebStoryAudio('Sample Reader One'), b: ebStoryAudio('Old Reader'), c: ebStoryAudio('없는 책 이름') }));
  ok('원서 줄에 오디오 수', st.a === 3 && st.b === 2 && st.c === 0, JSON.stringify(st));

  console.log('\n콘솔 오류 ' + errs.length + '건');
  errs.slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_split 실패:', e); process.exit(1); });
