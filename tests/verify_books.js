require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 교재 3천 권 — 고르기·교재 탭·자료 목록·쪽 받기 (fix/books-scale, 2026-11-15)
// 교재 이름은 전부 이 검사 안에서 지어낸다 (실제 책 이름 목록을 저장소에 넣지 않는다).
// 실제 서버는 읽지도 쓰지도 않는다 — 앱이 뜨는 줄은 fixtures, 나머지는 이 파일의 가짜 표.
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const { fakeTables } = require('./_fake');
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };
const SHOTS = process.env.PP_TEST_OUT ? path.join(process.env.PP_TEST_OUT, 'books') : path.join(__dirname, 'shots', 'books');
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (e) { }

// 쪽 받기 흉내 — 1,500줄이 모두 같은 updated_at. order 에 id 가 없으면 PostgREST 처럼 순서가 그때그때 달라진다.
const SAME = '2026-11-01T00:00:00+00:00';
const PG_ROWS = [];
for (let i = 0; i < 1500; i++) PG_ROWS.push({ id: 'pg' + String(i).padStart(5, '0'), sid: 'fx-pg', updated_at: SAME, data: { id: 'pg' + i, sid: 'fx-pg' } });
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function pageAnswer(url) {
  const lim = +(url.searchParams.get('limit') || 1000), off = +(url.searchParams.get('offset') || 0);
  const order = url.searchParams.get('order') || '';
  let rows = PG_ROWS.slice();
  if (/,id\b/.test(order)) rows.sort((a, b) => a.id < b.id ? -1 : 1);
  else rows.sort(() => rnd() - 0.5);                 // 같은 시각 — 쪽마다 순서가 섞인다
  return rows.slice(off, off + lim);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); localStorage.removeItem('pp_books_picked'); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));
  // 쓰기가 혹시 나가도 가짜 표가 받는다
  const fake = await fakeTables(page, ['lessons', 'global_textbooks', 'classes', 'assignments', 'settings']);
  await page.route('**/rest/v1/tests?**', r => {
    const url = new URL(r.request().url());
    const rows = pageAnswer(url);
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 400, contentType: 'application/json', body: '{}' }));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(2000);

  // ── 가짜 교재 3,000권 + 우리 교재 12권 ──
  const made = await page.evaluate(() => {
    const CATS = ['리딩', '어휘', '어법', '리스닝', '라이팅', '파닉스', ''];
    const tbs = [];
    for (let i = 0; i < 3000; i++) {
      const c = CATS[i % CATS.length];
      tbs.push({ id: 'gb' + i, type: 'textbook', title: '가상 ' + (c || '분류없음') + ' 책 ' + i,
        series: '가상 시리즈 ' + (i % 300), publisher: '가상 출판 ' + (i % 40), category: c,
        src: i % 11 ? 'bank-auto' : '', units: { 'U1': [{ en: 'a' }], 'U2': [{ en: 'b' }] } });
    }
    const ours = [];
    for (let i = 0; i < 12; i++) {
      const b = { id: 'our' + i, type: 'textbook', title: '우리 리딩 책 ' + i, series: '우리 시리즈', publisher: '가상 출판 0',
        category: '리딩', units: { 'U1': [{ en: 'a' }] } };
      tbs.push(b); ours.push(b);
    }
    _cache.globalTextbooks = tbs;
    const sid = (_cache.students[0] || {}).id;
    // 우리 교재가 되는 길 셋 — 수업 기록 6권 · 숙제 3권 · 반 공통 교재 3권
    _cache.lessons = ours.slice(0, 6).map((b, i) => ({ id: 'fl' + i, sid, date: '2026-11-0' + (i + 1), materials: { reading: { book: b.title, unit: 'U1' } } }));
    _cache.assignments = ours.slice(6, 9).map((b, i) => ({ id: 'fa' + i, sid, bookId: b.id, bookTitle: b.title, date: '2026-11-10' }));
    const cls = (_cache.globalClasses || [])[0];
    if (cls) { cls.commonMaterials = Object.assign({}, cls.commonMaterials || {}, { reading: { bookId: ours[9].id, book: ours[9].title } }); cls.nextBooks = [{ bookId: ours[10].id }, { book: ours[11].title }]; }
    else _cache.globalClasses = [{ id: 'fc', name: '가상 반', commonMaterials: { reading: { bookId: ours[9].id } }, nextBooks: [{ bookId: ours[10].id }, { book: ours[11].title }] }];
    _ourBk.k = '';
    return { n: tbs.length, our: ppOurBookIds().size, ourIds: [...ppOurBookIds()].sort() };
  });
  ok('우리 교재는 12권 (수업 기록·숙제·반 교재에서 셈)', made.our === 12, made.n + '권 중 ' + made.our + '권 · ' + made.ourIds.join(','));

  // ── [3] 수업 기록 교재 고르기 ──
  const pk = await page.evaluate(async () => {
    swTab('t-les'); await new Promise(r => setTimeout(r, 400));
    document.getElementById('subj-rows').innerHTML = '';
    addSRowTo('subj-rows', 'reading');
    const sel = document.querySelector('#subj-rows select[data-f="book"]');
    const opts = [...sel.options].map(o => o.value);
    return { n: opts.filter(v => v && v !== '__find__' && v !== '__addnew__').length,
      find: opts.indexOf('__find__') >= 0, add: opts.indexOf('__addnew__') >= 0, total: opts.length };
  });
  ok('수업 기록 고르기 — 우리 교재 12권 + 다른 교재 찾기…', pk.n === 12 && pk.find && pk.add, '책 ' + pk.n + '개 · 찾기 ' + pk.find + ' · 새 교재 추가 ' + pk.add + ' · 줄 ' + pk.total);

  await page.selectOption('#subj-rows select[data-f="book"]', '__find__');
  await wait(300);
  const opened = await page.evaluate(() => ({ box: !!document.getElementById('bk-find'), val: document.querySelector('#subj-rows select[data-f="book"]').value }));
  ok('다른 교재 찾기… 를 고르면 검색 칸이 뜨고 고르기 값은 그대로', opened.box && opened.val === '', JSON.stringify(opened));
  await page.fill('#bk-find-q', '가');
  await wait(150);
  const one = await page.evaluate(() => document.querySelectorAll('#bk-find-r .bk-find-i').length);
  await page.fill('#bk-find-q', '가상 리딩');
  await wait(200);
  const hits = await page.evaluate(() => [...document.querySelectorAll('#bk-find-r .bk-find-i b')].map(b => b.textContent));
  ok('한 글자는 찾지 않고, 두 글자 이상이면 20개까지', one === 0 && hits.length > 0 && hits.length <= 20, '한 글자 ' + one + '개 · "가상 리딩" ' + hits.length + '개');
  await page.screenshot({ path: path.join(SHOTS, 'picker_search.png') });
  const pickTitle = hits[0];
  await page.click('#bk-find-r .bk-find-i');
  await wait(300);
  const after = await page.evaluate(t => {
    const sel = document.querySelector('#subj-rows select[data-f="book"]');
    let picked = []; try { picked = JSON.parse(localStorage.getItem('pp_books_picked') || '[]'); } catch (e) { }
    return { val: sel.value, closed: !document.getElementById('bk-find'), picked, t };
  }, pickTitle);
  ok('찾은 책을 누르면 고르기에 들어가고 기억된다', after.val === pickTitle && after.closed && after.picked.length === 1, after.val + ' · 기억 ' + after.picked.join(','));
  const again = await page.evaluate(t => {
    document.getElementById('subj-rows').innerHTML = '';
    addSRowTo('subj-rows', 'reading');
    const sel = document.querySelector('#subj-rows select[data-f="book"]');
    const opts = [...sel.options].map(o => o.value);
    return { n: opts.filter(v => v && v !== '__find__' && v !== '__addnew__').length, has: opts.indexOf(t) >= 0 };
  }, pickTitle);
  ok('다음에 열면 그 책도 우리 교재 (13권)', again.has && again.n === 13, again.n + '권 · 들어 있음 ' + again.has);
  // Esc 로 닫힌다
  await page.selectOption('#subj-rows select[data-f="book"]', '__find__');
  await wait(200);
  await page.keyboard.press('Escape');
  await wait(150);
  ok('검색 칸은 Esc 로 닫힌다', await page.evaluate(() => !document.getElementById('bk-find')));

  // 다른 고르기 자리도 같은 꼴 (값이 id 인 자리)
  const sites = await page.evaluate(() => {
    const out = {};
    const chk = (name, sel) => { if (!sel) { out[name] = 'none'; return; }
      const o = [...sel.options].map(x => x.value);
      out[name] = { books: o.filter(v => v && v !== '__find__' && v !== '__addnew__').length, find: o.indexOf('__find__') >= 0, bkv: sel.dataset.bkv || '' }; };
    // 클래스 수정
    const ec = document.getElementById('ec-subj-rows');
    if (ec) { ec.innerHTML = ''; addSRowTo('ec-subj-rows', 'reading'); chk('클래스 수정', ec.querySelector('select[data-f="book"]')); }
    // 수업 수정
    const el = document.getElementById('el-subj-rows');
    if (el) { el.innerHTML = ''; addSRowTo('el-subj-rows', 'reading'); chk('수업 수정', el.querySelector('select[data-f="book"]')); }
    try { ecFillC5Books(''); } catch (e) { }
    chk('클래스5 책', document.getElementById('ec-c5-book'));
    try { tsFillUnitSel(); } catch (e) { }
    chk('재테스트 범위', document.getElementById('ts-unit-book'));
    try { vpFillBooks(); } catch (e) { }
    chk('단어 시험지', document.getElementById('vp-book'));
    try { const c = DB.classes()[0]; if (c) openPgPlan(c.id, '2026-11-20'); } catch (e) { }
    chk('진도 계획', document.getElementById('pg-plan-book'));
    document.querySelectorAll('.mo.open').forEach(m => m.classList.remove('open'));
    // 글자로 치는 칸 — 처음엔 우리 교재만, 두 글자부터 전체에서 20개까지
    try { updateTbookDatalist(); } catch (e) { }
    const dl = document.getElementById('dl-tbooks-les');
    const n0 = dl ? dl.options.length : -1;
    const inp = document.createElement('input'); inp.setAttribute('list', 'dl-tbooks-les'); document.body.appendChild(inp);
    inp.value = '가상 어휘'; inp.dispatchEvent(new Event('input', { bubbles: true }));
    const n1 = dl ? dl.options.length : -1;
    inp.value = '가상 어휘 책 1'; inp.dispatchEvent(new Event('change', { bubbles: true }));
    let picked = []; try { picked = JSON.parse(localStorage.getItem('pp_books_picked') || '[]'); } catch (e) { }
    inp.remove();
    try { fillAsgnBookDatalist('dl-tbooks-assign', 'reading'); } catch (e) { }
    out['글자 칸(datalist)'] = { first: n0, typed: n1, remembered: picked.indexOf('gb1') >= 0, assignReading: (document.getElementById('dl-tbooks-assign') || {}).options?.length };
    return out;
  });
  const dlx = sites['글자 칸(datalist)']; delete sites['글자 칸(datalist)'];
  const sitesOk = Object.values(sites).every(s => s === 'none' || (s.find && s.books <= 13)) && Object.values(sites).filter(s => s !== 'none').length >= 6;
  ok('글자로 치는 교재 칸 — 우리 교재만, 두 글자부터 20개 더, 고르면 기억', dlx.first === 13 && dlx.typed === 33 && dlx.remembered && dlx.assignReading <= 14, JSON.stringify(dlx));
  ok('클래스 수정·수업 수정·클래스5·재테스트·단어 시험지·진도 계획 고르기도 같은 꼴', sitesOk, JSON.stringify(sites));

  // ── [4] 교재 탭 ──
  const tab = await page.evaluate(async () => {
    swTab('t-data'); switchDataTab('tbook'); await new Promise(r => setTimeout(r, 300));
    tbSetSrc('ours'); setBookView('card'); await new Promise(r => setTimeout(r, 300));
    const own = document.getElementById('tb-src-own-n').textContent;
    const cards = document.querySelectorAll('#book-cards .bcard').length;
    const mineChk = !!document.getElementById('tbf-mine');
    return { own, cards, mineChk, all: document.getElementById('tb-src-all-n').textContent,
      bankLbl: document.getElementById('tb-src-bank').textContent.trim() };
  });
  ok('교재 탭은 우리 교재로 연다 (14 = 12 + 방금 고른 책 둘)', tab.own === '14' && tab.cards === 14, '우리 교재 ' + tab.own + ' · 카드 ' + tab.cards + ' · 전체 ' + tab.all);
  ok("'우리 반 교재만' 칸이 없다 · 이름은 '아직 교재가 아닌 자료'", !tab.mineChk && /아직 교재가 아닌 자료/.test(tab.bankLbl), tab.bankLbl);
  await page.screenshot({ path: path.join(SHOTS, 'tab_ours.png') });

  const all = await page.evaluate(async () => {
    tbSetSrc('all'); setBookView('series'); await new Promise(r => setTimeout(r, 400));
    const dom = document.querySelectorAll('#dp-book *').length;
    const heads = document.querySelectorAll('#book-series details.bser').length;
    const cardsBefore = document.querySelectorAll('#book-series .bser-card').length;
    const d = document.querySelector('#book-series details.bser');
    d.open = true; await new Promise(r => setTimeout(r, 200));
    const inside = d.querySelectorAll('.bser-card').length;
    const tag = document.querySelectorAll('#book-series .tb-frombank').length;
    setBookView('card'); await new Promise(r => setTimeout(r, 200));
    const cards = document.querySelectorAll('#book-cards .bcard').length;
    const more = (document.getElementById('book-pager').textContent || '').trim();
    const domCard = document.querySelectorAll('#dp-book *').length;
    document.querySelector('#book-pager button')?.click(); await new Promise(r => setTimeout(r, 200));
    const cards2 = document.querySelectorAll('#book-cards .bcard').length;
    setBookView('series');
    return { dom, heads, cardsBefore, inside, tag, cards, more, cards2, domCard };
  });
  ok("'전체' 는 시리즈 머리만 — DOM 5,000 이하", all.dom <= 5000 && all.cardsBefore === 0 && all.heads > 0, 'DOM ' + all.dom + ' · 머리 ' + all.heads + ' · 펼치기 전 책 칸 ' + all.cardsBefore);
  ok('시리즈를 펼치면 그 책들이 그려진다 · 자료에서 꼬리표', all.inside > 0 && all.tag > 0, '책 ' + all.inside + '권 · 자료에서 ' + all.tag);
  ok('카드는 100개씩 + [더 보기]', all.cards === 100 && /더 보기/.test(all.more) && all.cards2 === 200 && all.domCard <= 5000, all.cards + ' → ' + all.cards2 + ' · ' + all.more + ' · DOM ' + all.domCard);
  await page.screenshot({ path: path.join(SHOTS, 'tab_all.png') });

  const none = await page.evaluate(async () => {
    const ar = document.getElementById('tbf-area');
    const has = [...ar.options].some(o => o.value === 'none' && /분류 없음/.test(o.textContent));
    ar.value = 'none'; tbFilterChange(); setBookView('card'); await new Promise(r => setTimeout(r, 200));
    const n = (document.getElementById('book-total').textContent || '');
    ar.value = ''; tbFilterChange();
    return { has, n };
  });
  ok("영역 거르기에 '분류 없음'", none.has && /428권/.test(none.n), none.n);   // 3000/7 → 428

  // ── [1][4] 아직 교재가 아닌 자료 — 휠로 끝까지, 등록된 것은 빠진다 ──
  const bank = await page.evaluate(async () => {
    const rows = [];
    for (let i = 0; i < 1200; i++) rows.push({ id: 'eb' + i, nfiles: 2, naudio: 0,
      meta: { title: (i < 50 ? '가상 리딩 책 ' + (i * 7) : '가상 자료 책 ' + i), series: '가상 출판사 ' + String(i % 12).padStart(2, '0'), cat: '교재', origin: 'book', use: '일반' } });
    _ebRows = rows; _ebLoading = false;
    tbSetSrc('bank'); await new Promise(r => setTimeout(r, 400));
    const lbl = document.getElementById('tb-bank-count').textContent;
    const ds = [...document.querySelectorAll('#tb-bank-box details.ebb')];
    const emptyBefore = document.querySelectorAll('#tb-bank-box .ebb-row').length;
    ds.forEach(d => d.open = true);
    await new Promise(r => setTimeout(r, 300));
    const rowsN = document.querySelectorAll('#tb-bank-box .ebb-row').length;
    const box = document.getElementById('tb-bank-box');
    const cs = getComputedStyle(box);
    return { lbl, groups: ds.length, emptyBefore, rowsN, oy: cs.overflowY, sh: box.scrollHeight, ch: box.clientHeight };
  });
  ok('등록된 자료는 빠진다 (1,200 − 50 = 1,150줄)', /1,150줄/.test(bank.lbl) && bank.rowsN === 1150, bank.lbl + ' · 줄 ' + bank.rowsN);
  ok('묶음은 펼칠 때 그린다', bank.emptyBefore === 0 && bank.groups === 12, '펼치기 전 ' + bank.emptyBefore + '줄 · 묶음 ' + bank.groups);
  const bx = await page.evaluate(() => { const r = document.getElementById('tb-bank-box').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 200) }; });
  await page.mouse.move(bx.x, bx.y);
  for (let i = 0; i < 300; i++) { await page.mouse.wheel(0, 1500); if (i % 30 === 29) await wait(50); }
  await wait(500);
  const end = await page.evaluate(() => {
    const box = document.getElementById('tb-bank-box');
    const rows = box.querySelectorAll('.ebb-row');
    const last = rows[rows.length - 1];
    const lr = last.getBoundingClientRect(), br = box.getBoundingClientRect();
    const filt = document.getElementById('tb-bank-q').getBoundingClientRect();
    return { visible: lr.bottom <= br.bottom + 2 && lr.top >= br.top - 2 && lr.bottom <= innerHeight + 2,
      st: Math.round(box.scrollTop), max: box.scrollHeight - box.clientHeight, filterTop: Math.round(filt.top), last: last.textContent.slice(0, 30) };
  });
  ok('휠로 끝까지 내리면 마지막 줄이 보인다 · 거르기 줄은 제자리', end.visible && end.filterTop >= 0, '내림 ' + end.st + '/' + end.max + ' · 거르기 top ' + end.filterTop + ' · 마지막 "' + end.last + '"');
  await page.screenshot({ path: path.join(SHOTS, 'bank_bottom.png') });

  // ── [5] 쪽 받기 — 같은 updated_at 1,500줄이 다 온다 ──
  const pg = await page.evaluate(async () => {
    const a = await supaFetchAll('tests', true);
    const b = await supaFetchBySid('tests', 'fx-pg', { withDeleted: true }).catch(e => 'ERR ' + e.message);
    // 옛 순서(id 없이)로 받으면 빠지는 줄이 생긴다 — 가짜 서버가 실제처럼 군다는 확인
    let old = [], off = 0;
    while (true) { const r = await fetch(SUPA_URL + '/rest/v1/tests?limit=1000&offset=' + off + '&order=updated_at.desc', { headers: SUPA_HEADERS }); const j = await r.json(); old = old.concat(j); if (j.length < 1000) break; off += 1000; }
    const ids = x => new Set((x || []).map(r => r.id || (r.data && r.data.id))).size;
    return { all: a.length, allU: ids(a), sid: Array.isArray(b) ? b.length : String(b), sidU: Array.isArray(b) ? ids(b) : 0, oldU: ids(old) };
  });
  ok('쪽 받기 — 같은 시각 1,500줄이 모두 온다 (supaFetchAll)', pg.allU === 1500, '받은 줄 ' + pg.all + ' · 서로 다른 id ' + pg.allU);
  ok('쪽 받기 — 학생별로 받을 때도 (supaFetchBySid)', pg.sidU === 1500 || pg.sid === 1500, '받은 줄 ' + pg.sid + ' · 서로 다른 id ' + pg.sidU);
  ok('(대조) id 없는 옛 순서는 줄이 빠진다', pg.oldU < 1500, '서로 다른 id ' + pg.oldU);

  // 체험 모드·학생 화면에는 새 고르기가 없다 (선생님 함수만)
  // settings 의 cloud 한 줄은 앱이 뜰 때 늘 쓰는 것 (이 기능과 무관) — 교재·수업·반·숙제 표만 센다
  const w = ['lessons', 'global_textbooks', 'classes', 'assignments'].reduce((t, k) => t + fake.count(k), 0);
  ok('교재·수업·반·숙제 쓰기 0건 (고르기는 기기에만 기억)', w === 0, w + '건 ' + JSON.stringify(fake.byTable));
  console.log('\n콘솔 오류 ' + errs.length + '건' + (errs.length ? '\n  ' + errs.slice(0, 5).join('\n  ') : ''));
  ok('콘솔 오류 없음', errs.length === 0);
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_books 실패:', e); process.exit(1); });
