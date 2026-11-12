require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 라이브러리 (lib_books · lib_text) — 가짜 데이터만. 출판사 원문·학생 데이터는 쓰지 않는다.
//  (a) 목록 1만 줄을 받아 그리는 시간·메모리, 거르기 조합
//  (b) lib_search 가 제목·목차·본문을 모두 찾고 점수순
//  (c) 표지 실패 시 글자 표지
//  (d) 커리큘럼 지도에서 끌어 넣기 → 확인 → 교재 흐름 저장(가짜 서버)
//  (e) 책 한 권 탭 숫자가 데이터와 같다
//  (f) [교재에서 가져오기]가 출처를 남긴다
//  (g) 학생 화면에서 라이브러리 요청 0건
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };

// ── 가짜 라이브러리 ────────────────────────────────────────────────────
const PUBS = ['능률교육', 'YBM', 'Cengage', 'Oxford', '다락원'];
const AREAS = ['리딩', '리스닝', '문법', '어휘', '쓰기', '파닉스', '종합'];
const TARGETS = ['유아', '초등', '중등', '고등', '성인'];
const STAGES = ['P0', 'P1', 'P2', 'P3', 'M1', 'M2', 'M3', 'H1', 'H2'];
const USES = ['일반', '수능 대비', '내신 대비', '듣기평가 대비', '공인시험'];
function mkRows(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const pub = PUBS[i % PUBS.length], area = AREAS[i % AREAS.length];
    const st = STAGES[i % STAGES.length];
    const ser = pub + ' ' + area + ' Series ' + (i % 40);
    out.push({
      id: 'lb' + i, updated_at: '2026-11-14T00:00:00Z',
      meta: {
        key: 'k' + i, publisher: pub, series: ser, title: ser + ' ' + ((i % 6) + 1),
        volume: String((i % 6) + 1), pubLevel: 'Level ' + ((i % 6) + 1),
        target: (i % 9 === 0) ? undefined : TARGETS[i % TARGETS.length], area: area,
        use: (i % 4 === 0) ? '내신 대비' : USES[(i % 3) ? ((i + 1) % 3) : 0],
        isbn: '978' + (1000000000 + i), year: 2018 + (i % 8), pages: 120 + (i % 80),
        price: 12000 + (i % 10) * 500,
        cover: (i % 3 === 0) ? '' : ('https://example.invalid/cover/' + i + '.jpg'),
        stage: (i % 7 === 0) ? st : undefined, stageG: (i % 7 === 0) ? (1 + (i % 9) + 0.4) : undefined,
        stageBy: 'text', stageConf: 'high',
        seriesKey: 'sk' + (i % 40), seriesOrder: (i % 6) + 1,
        tbId: (i % 50 === 0) ? ('tb' + i) : undefined,
        bankIds: (i % 6 === 0) ? ['bk' + i] : undefined,
        outOfPrint: (i % 97 === 0) ? true : undefined,
        kind: (i % 23 === 0) ? '원서' : undefined,
        tocImage: (i % 11 === 0) ? ('https://example.invalid/toc/' + i + '.jpg') : undefined,
        detailImage: (i % 13 === 0) ? ('https://example.invalid/d/' + i + '.jpg') : undefined,
        previewImages: (i % 13 === 0) ? ['https://example.invalid/p1.jpg', 'https://example.invalid/p2.jpg'] : undefined,
        previewUrl: (i % 17 === 0) ? ('https://example.invalid/ebook/' + i) : undefined,
        authors: (i % 5 === 0) ? '보기용 글쓴이' : undefined,
        teacherMaterials: (i % 19 === 0) ? 3 : undefined,
      },
      ntoc: (i % 5) ? 8 : 0, hassample: i % 7 === 0, nbank: (i % 6 === 0) ? 1 : 0, ntext: (i % 2) ? 3 : 0,
      hastocimg: (i % 11 === 0), haspreview: (i % 17 === 0),
    });
  }
  return out;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();

  const N = 20500;
  const ROWS = mkRows(N);
  let libHits = 0, searchHits = 0;
  const posts = [];
  // 그 밖의 쓰기는 가짜로 받아 준다
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    posts.push(m + ' ' + r.request().url().split('/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  // 가짜 서버 — lib_* 는 표가 아직 없으니 전부 여기서 답한다
  await page.route('**/rest/v1/rpc/lib_search', r => {
    searchHits++;
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
    const q = String(b.q || '');
    const rows = [
      { book_id: 'lb1', unit: '', kind: 'title', snippet: '제목에 ' + q, score: 5 },
      { book_id: 'lb2', unit: '', kind: 'toc', snippet: '목차에 ' + q, score: 2 },
      { book_id: 'lb3', unit: 'Unit 3', kind: 'passage', snippet: '본문에 ' + q + ' 가 있습니다', score: 1.4 },
    ];
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  await page.route('**/rest/v1/lib_books**', r => {
    libHits++;
    const u = new URL(r.request().url());
    const eq = (u.searchParams.get('id') || '').replace('eq.', '');
    const row = ROWS.find(x => x.id === eq);
    if (!row) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    const d = Object.assign({}, row.meta, {
      desc: '이 책은 보기용입니다. ' + row.meta.title,
      toc: Array.from({ length: row.ntoc }, (_, k) => ({ no: k + 1, title: 'Unit ' + (k + 1) + ' Sample' })),
      sample: row.hassample ? '맛보기 지문' : '',
      components: ['본책', '워크북'],
    });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ data: d }]) });
  });
  await page.route('**/rest/v1/lib_books_index**', r => {
    libHits++;
    const u = new URL(r.request().url());
    const sel = u.searchParams.get('select') || '';
    const off = Number(u.searchParams.get('offset') || 0), lim = Number(u.searchParams.get('limit') || 1000);
    const idIn = u.searchParams.get('id');
    let rows = ROWS;
    if (idIn && idIn.indexOf('in.(') === 0) {
      const want = new Set(idIn.slice(4, -1).replace(/"/g, '').split(','));
      rows = ROWS.filter(x => want.has(x.id));
    } else if (u.searchParams.get('order') === 'updated_at.desc') {
      rows = ROWS.slice(-1);
    } else rows = ROWS.slice(off, off + lim);
    const body = (sel === 'id,updated_at')
      ? rows.map(x => ({ id: x.id, updated_at: x.updated_at }))
      : rows;
    return r.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/' + ROWS.length,
        'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' },
      body: JSON.stringify(body),
    });
  });
  await page.route('**/rest/v1/lib_text**', r => {
    libHits++;
    const u = new URL(r.request().url());
    const bid = (u.searchParams.get('book_id') || '').replace('eq.', '');
    const row = ROWS.find(x => x.id === bid);
    const n = row ? row.ntext : 0;
    const rows = Array.from({ length: n }, (_, k) => ({
      id: bid + '|Unit ' + (k + 1) + '|1', unit: 'Unit ' + (k + 1), kind: 'passage',
      text: 'Sample passage for unit ' + (k + 1) + '. '.repeat(6), words: 40 + k,
      src: { fileId: 'f' + k, page: k + 2, bankId: 'bk' + k },
    }));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });

  // 그림 요청을 센다 (탭을 열기 전에는 받지 않아야 한다)
  const imgHits = { toc: 0, detail: 0, cover: 0 };
  await page.route('**example.invalid/**', r => {
    const u = r.request().url();
    if (u.indexOf('/toc/') >= 0) imgHits.toc++;
    else if (u.indexOf('/d/') >= 0 || u.indexOf('/p1') >= 0 || u.indexOf('/p2') >= 0) imgHits.detail++;
    else imgHits.cover++;
    return r.fulfill({ status: 200, contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64') });
  });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 150)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 150)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(2200);

  // ── (a) 1만 줄 ────────────────────────────────────────────────
  const big = await page.evaluate(async () => {
    swTab('t-data'); switchDataTab('library');          // 탭이 먼저 한 번 받는다
    for (let i = 0; i < 100 && _libLoading; i++) await new Promise(r => setTimeout(r, 100));
    try { await idbSet('pp_lib_books_v1', null); } catch (e) { }
    _libRows = null; _libStamps = {}; _libAt = 0; _libMax = '';
    renderLibrary();
    const t0 = performance.now();
    window.__cnt = await _libCount();
    // 받는 동안 — 첫 카드가 언제 그려지는지, 숫자가 오르는지
    window.__first = 0; window.__prog = [];
    const tick = setInterval(() => {
      const n = document.querySelectorAll('#lib-grid .lib-card').length;
      if (n && !window.__first) window.__first = Math.round(performance.now() - t0);
      const t = (document.getElementById('lib-state') || {}).textContent || '';
      const m = t.match(/받는 중 ([\d,]+)/);
      if (m) window.__prog.push(+m[1].replace(/,/g, ''));
    }, 60);
    await libLoad(true);
    clearInterval(tick);
    const tLoad = performance.now() - t0;
    swTab('t-data'); switchDataTab('library');
    await new Promise(r => setTimeout(r, 200));
    const t1 = performance.now();
    renderLibrary();
    const tDraw = performance.now() - t1;
    const mem = (performance.memory && performance.memory.usedJSHeapSize) ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1;
    return {
      n: (_libRows || []).length, cnt: window.__cnt, tLoad: Math.round(tLoad), tDraw: Math.round(tDraw), mem,
      first: window.__first, prog: window.__prog.slice(),
      cards: document.querySelectorAll('#lib-grid .lib-card').length,
      count: (document.getElementById('lib-count') || {}).textContent || '',
    };
  });
  ok('(a) 2만 줄을 받는다', big.n === N, big.n.toLocaleString() + '줄 · 센 수 ' + big.cnt + ' · 받기 ' + big.tLoad + 'ms');
  ok('(a) 그리기는 한 쪽씩', big.cards === 60 && big.tDraw < 1500, '카드 ' + big.cards + '장 · 그리기 ' + big.tDraw + 'ms');
  ok('[2] 첫 쪽이 2초 안에 그려진다', big.first > 0 && big.first < 2000, big.first + 'ms');
  ok('[2] 받는 중 숫자가 오른다',
    big.prog.length >= 2 && big.prog[big.prog.length - 1] > big.prog[0] && big.prog.every((v, i) => i === 0 || v >= big.prog[i - 1]),
    big.prog.length + '번 — ' + big.prog[0] + ' → ' + big.prog[big.prog.length - 1]);
  ok('(a) 머리 숫자 — 접은 내신은 빼고 센다',
    /전체 20,500권/.test(big.count) && /^10,250권/.test(big.count.trim()), big.count);
  console.log('      메모리 ' + (big.mem < 0 ? '(못 잼)' : big.mem + 'MB'));

  const filt = await page.evaluate(async () => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; } };
    const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
    set('lib-f-target', '중등'); libFilterChange();
    const a = libFiltered().length;
    set('lib-f-area', '리딩'); libFilterChange();
    const b = libFiltered().length;
    set('lib-f-stage', 'M2'); libFilterChange();
    const c = libFiltered().length;
    const cBad = libFiltered().filter(r => (r.meta || {}).stage !== 'M2' || r.meta.area !== '리딩' || r.meta.target !== '중등').length;
    set('lib-f-stage', ''); set('lib-f-area', ''); set('lib-f-target', '');
    chk('lib-f-bank', true); libFilterChange();
    const d = libFiltered().length, dBad = libFiltered().filter(r => !(r.nbank > 0)).length;
    chk('lib-f-bank', false); chk('lib-f-text', true); libFilterChange();
    const e = libFiltered().length, eBad = libFiltered().filter(r => !(r.ntext > 0)).length;
    chk('lib-f-text', false); libResetFilters();
    const folded = libFiltered().length;
    // 내신 문제집도 보기
    chk('lib-f-naesin', true); libFilterChange();
    const open = libFiltered().length;
    const naesin = (_libRows || []).filter(r => String((r.meta || {}).use || '') === '내신 대비').length;
    chk('lib-f-naesin', false); libFilterChange();
    // 수준 잰 책만 · 대상 모름
    chk('lib-f-staged', true); libFilterChange();
    const staged = libFiltered().length, stagedBad = libFiltered().filter(r => !(r.meta || {}).stage).length;
    chk('lib-f-staged', false);
    set('lib-f-target', 'none'); libFilterChange();
    const noTg = libFiltered().length, noTgBad = libFiltered().filter(r => (r.meta || {}).target).length;
    libResetFilters();
    return { a, b, c, cBad, d, dBad, e, eBad, all: libFiltered().length, folded, open, naesin, staged, stagedBad, noTg, noTgBad };
  });
  ok('(a) 거르기 조합이 겹쳐 듣는다', filt.a > filt.b && filt.b > filt.c && filt.cBad === 0,
    '대상 ' + filt.a + ' → +영역 ' + filt.b + ' → +수준 ' + filt.c); 
  ok('(a) 자료 있음 · 본문 있음', filt.dBad === 0 && filt.eBad === 0 && filt.d > 0 && filt.e > 0,
    '자료 ' + filt.d + '권 · 본문 ' + filt.e + '권');
  ok('(a) 초기화하면 접은 상태로 돌아온다', filt.all === filt.folded, filt.all.toLocaleString() + '권 (내신 접음)');
  ok('[3] 내신 문제집을 켜고 끌 때 수가 맞는다', filt.open === filt.folded + filt.naesin && filt.open === N,
    '접음 ' + filt.folded.toLocaleString() + ' + 내신 ' + filt.naesin.toLocaleString() + ' = ' + filt.open.toLocaleString());
  ok('[3] 수준 잰 책만', filt.stagedBad === 0 && filt.staged > 0, filt.staged.toLocaleString() + '권');
  ok('[3] 대상 모름', filt.noTgBad === 0 && filt.noTg > 0, filt.noTg.toLocaleString() + '권');

  // ── (b) lib_search ───────────────────────────────────────────
  const deep = await page.evaluate(async () => {
    const before = 0;
    libQInput('sample');
    await new Promise(r => setTimeout(r, 900));
    const el = document.getElementById('lib-deep');
    const rows = [...el.querySelectorAll('.lib-deep-row')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
    const kinds = [...el.querySelectorAll('.lib-deep-k')].map(x => x.textContent.trim());
    const raw = (_libDeep || []).map(x => x.score);
    libQInput('');
    await new Promise(r => setTimeout(r, 200));
    return { shown: el.style.display, rows: rows.length, kinds, sorted: raw.every((v, i) => i === 0 || raw[i - 1] >= v), first: rows[0] || '' };
  });
  ok('(b) 제목·목차·본문을 모두 찾는다',
    deep.kinds.join(',') === '제목,목차,본문', deep.kinds.join(' / '));
  ok('(b) 점수순으로 보여 준다', deep.sorted && deep.rows === 3, deep.first.slice(0, 60));
  ok('(b) 서버 함수를 멈춘 뒤에만 부른다', searchHits === 1, 'lib_search ' + searchHits + '회');

  // ── (c) 표지 ─────────────────────────────────────────────────
  const cover = await page.evaluate(async () => {
    // 주소가 없는 책을 골라 띄운다 (정렬 탓에 첫 쪽에 안 올 수 있다)
    const noCov = (_libRows || []).find(r => !((r.meta || {}).cover) && String((r.meta || {}).use || '') !== '내신 대비');
    _libF.q = (noCov.meta.title || '');
    libPaintFilters(); renderLibrary();
    await new Promise(r => setTimeout(r, 400));
    const cards = [...document.querySelectorAll('#lib-grid .lib-card')];
    const noCover = cards.find(c => !c.querySelector('img')) || null;
    const withImg = cards.find(c => c.querySelector('img'));
    const img = withImg ? withImg.querySelector('img') : null;
    _libF.q = ''; libPaintFilters();
    return {
      fbAlways: cards.every(c => !!c.querySelector('.lib-cv-fb')),
      noCoverHasFb: !!(noCover && noCover.querySelector('.lib-cv-fb')),
      brokenHidden: img ? (img.style.display === 'none' || !img.classList.contains('on')) : null,
      letters: noCover ? (noCover.querySelector('.lib-cv-fb b') || {}).textContent : '',
      nNo: cards.filter(c => !c.querySelector('img')).length,
      pure: /<img/.test(libCoverHtml({ title: '표지 없는 책' })) === false && /lib-cv-fb/.test(libCoverHtml({ title: '표지 없는 책' })),
    };
  });
  ok('(c) 표지가 없으면 글자 표지', cover.pure && cover.noCoverHasFb && !!cover.letters,
    '글자 "' + cover.letters + '" · 주소 없는 카드 ' + cover.nNo + '장');
  ok('(c) 이미지가 열려도 글자 표지가 뒤에 깔려 있다', cover.fbAlways);

  // ── (e) 책 한 권 ─────────────────────────────────────────────
  const bk = await page.evaluate(async () => {
    const row = (_libRows || []).find(r => r.ntext > 0 && r.ntoc > 0 && r.nbank > 0) || _libRows[1];
    await libOpenBook(row.id);
    await new Promise(r => setTimeout(r, 700));
    const btns = [...document.querySelectorAll('#libb-tabs .tbd-tab')];
    const tabs = btns.map(x => x.textContent.trim());
    const num = n => { const b = btns.find(x => x.textContent.indexOf(n) === 0); const i = b && b.querySelector('i'); return i ? +i.textContent : 0; };
    const nums = [0, num('목차'), num('본문'), num('자료')];
    const home = (document.getElementById('libb-body') || {}).textContent || '';
    libTab('toc');
    const toc = document.querySelectorAll('#libb-body .libb-toc li').length;
    libTab('text');
    await new Promise(r => setTimeout(r, 500));
    const units = document.querySelectorAll('#libb-body .libb-units .wz-opt').length;
    const texts = document.querySelectorAll('#libb-body .libb-text').length;
    return {
      want: { toc: row.ntoc, text: row.ntext, bank: row.nbank }, tabs, nums, toc, units, texts,
      stage: home.indexOf('우리가 잰 수준') >= 0, series: home.indexOf('같은 시리즈') >= 0,
    };
  });
  ok('(e) 탭 숫자 = 데이터',
    bk.nums[1] === bk.want.toc && bk.nums[2] === bk.want.text && bk.nums[3] === bk.want.bank,
    '목차 ' + bk.nums[1] + '/' + bk.want.toc + ' · 본문 ' + bk.nums[2] + '/' + bk.want.text + ' · 자료 ' + bk.nums[3] + '/' + bk.want.bank);
  ok('(e) 목차·본문 줄 수도 같다', bk.toc === bk.want.toc && bk.units === bk.want.text,
    '목차 ' + bk.toc + '줄 · 단원 ' + bk.units + '개 · 본문 ' + bk.texts + '덩이');
  ok('(e) 개요에 수준 근거와 시리즈', bk.stage && bk.series);

  // ── [4] 목차 그림 · 소개 그림은 열 때만 ──────────────────────
  const pic = await page.evaluate(async () => {
    try { closeM('m-lib-book'); } catch (e) { }
    const row = (_libRows || []).find(r => r.hastocimg && !r.ntoc);
    const want = row ? row.id : '';
    return { want, has: !!row };
  });
  const beforeToc = imgHits.toc, beforeDetail = imgHits.detail;
  const toc = await page.evaluate(async (id) => {
    await libOpenBook(id);
    await new Promise(r => setTimeout(r, 700));
    const openedOnHome = !!document.querySelector('#libb-body .libb-tocimg img');
    libTab('toc');
    await new Promise(r => setTimeout(r, 600));
    const img = document.querySelector('#libb-body .libb-tocimg img');
    const n = [...document.querySelectorAll('#libb-tabs .tbd-tab')].find(x => x.textContent.indexOf('목차') === 0);
    const detailOpen = !!document.querySelector('#libb-pics img');
    return { openedOnHome, hasImg: !!img, tocNum: n ? (n.querySelector('i') || {}).textContent : '', detailOpen };
  }, pic.want);
  await wait(500);
  ok('[4] 목차 글이 없고 그림이 있으면 그림', toc.hasImg && toc.tocNum === '1', '목차 탭 숫자 "' + toc.tocNum + '"');
  ok('[4] 목차 그림은 탭을 열기 전에는 안 받는다', beforeToc === 0 && imgHits.toc > 0,
    '열기 전 ' + beforeToc + '건 · 연 뒤 ' + imgHits.toc + '건');
  ok('[4] 소개 그림은 접어 두고 안 받는다', !toc.detailOpen && imgHits.detail === beforeDetail,
    '소개 그림 요청 ' + (imgHits.detail - beforeDetail) + '건');
  const det = await page.evaluate(async () => {
    libTab('home');
    await new Promise(r => setTimeout(r, 400));
    const d = document.querySelector('#libb-body details.wz-more');
    if (!d) return { none: true };
    d.open = true; libPicsToggle(d);
    await new Promise(r => setTimeout(r, 600));
    return { n: document.querySelectorAll('#libb-pics img').length };
  });
  await wait(500);
  ok('[4] 펼치면 그때 받는다', det.none || (det.n > 0 && imgHits.detail > beforeDetail),
    det.none ? '(이 책엔 소개 그림 없음)' : (det.n + '장 · 요청 ' + (imgHits.detail - beforeDetail) + '건'));

  // ── (f) 교재에서 가져오기 ────────────────────────────────────
  const imp = await page.evaluate(async () => {
    try { closeM('m-lib-book'); } catch (e) { }
    libPickOpen('iso');
    libPickInput('sample');
    await new Promise(r => setTimeout(r, 900));
    const rows = document.querySelectorAll('#libp-body .lib-deep-row').length;
    await libPickTake(2);                       // 본문 줄
    await new Promise(r => setTimeout(r, 600));
    const src = _libLastSrc ? { ...(_libLastSrc) } : null;
    const ta = (document.getElementById('iso-text') || {}).value || '';
    // 만든 문항에 출처가 남는가
    _isoCfg.libSrc = src;
    const it = _ibFromIso({ id: 'x1', type: 'blank', stem: 's', passage: 'p', choices: ['a'], answer: 0 }, _isoCfg, {}, '', 1);
    return { rows, src, ta: ta.slice(0, 40), stamped: (it.src || {}) };
  });
  ok('(f) 가져오기 목록', imp.rows === 3, imp.rows + '줄');
  ok('(f) 본문이 지문 칸에 들어간다', /Sample passage/.test(imp.ta), '"' + imp.ta + '"');
  ok('(f) 출처(책·단원·쪽)를 남긴다',
    imp.stamped.libId && imp.stamped.unit === 'Unit 3' && imp.stamped.page,
    JSON.stringify({ libId: imp.stamped.libId, unit: imp.stamped.unit, page: imp.stamped.page }));

  // ── (d) 커리큘럼 지도 ────────────────────────────────────────
  const map = await page.evaluate(async () => {
    switchDataTab('library');
    libSetView('map');
    await new Promise(r => setTimeout(r, 900));
    const cells = document.querySelectorAll('#lib-map .lib-mi').length;
    const cols = document.querySelectorAll('#lib-map .stg-h .stg-hd').length - 1;
    // 반을 고르면 지금·흐름 표시
    const c = DB.classes()[0];
    libMapClsChange(c ? c.id : '');
    await new Promise(r => setTimeout(r, 500));
    const drop = (document.getElementById('lib-map-drop') || {}).style.display;
    // 등록 교재가 아닌 책을 끌면 안내
    const plain = (_libRows || []).find(r => !(r.meta || {}).tbId);
    let asked = null;
    const realAsk = askConfirm;
    askConfirm = (t, m, okl, cls, cb) => { asked = { t, m, cb }; };
    const ev = { preventDefault() { }, dataTransfer: { getData: () => 'lib:' + plain.id } };
    await libMapDrop(ev);
    const noTb = asked ? asked.t : '';
    // 등록 교재인 책을 끌면 '다음 교재로' 확인
    const reg = (_libRows || []).find(r => (r.meta || {}).tbId);
    asked = null;
    const ev2 = { preventDefault() { }, dataTransfer: { getData: () => 'lib:' + reg.id } };
    await libMapDrop(ev2);
    const askTitle = asked ? asked.t : '';
    // 확인을 누르면 교재 흐름으로 (가짜 서버가 받는다)
    let saved = false;
    const realAdd = _pgFlowAddBook;
    _pgFlowAddBook = async (cid, tbId) => { saved = { cid, tbId }; return true; };
    if (asked && asked.cb) await asked.cb();
    _pgFlowAddBook = realAdd; askConfirm = realAsk;
    return { cells, cols, drop, noTb, askTitle, saved, want: (reg.meta || {}).tbId, cls: c ? c.id : '' };
  });
  ok('(d) 지도에 수준 아홉 칸', map.cols === 9, map.cols + '칸 · 표지 ' + map.cells + '장');
  ok('(d) 반을 고르면 놓는 칸이 열린다', map.drop !== 'none');
  ok('(d) 등록 교재가 아니면 먼저 알려 준다', /수업 교재가 아니에요/.test(map.noTb), map.noTb);
  ok('(d) 끌어 넣으면 확인 창', /다음 교재로 넣을까요/.test(map.askTitle), map.askTitle);
  ok('(d) 확인하면 교재 흐름에 저장', !!map.saved && map.saved.tbId === map.want && map.saved.cid === map.cls,
    JSON.stringify(map.saved));

  // ── (g) 학생 화면 ────────────────────────────────────────────
  const hits0 = libHits;
  const stu = await page.evaluate(async () => {
    const may1 = libMayUse();
    try { localStorage.setItem('pp_session', JSON.stringify({ role: 'student', sid: 'x' })); } catch (e) { }
    const may2 = libMayUse();
    const r1 = await libLoad(true);
    const r2 = await libSearch('sample', 5);
    const r3 = await libTextOf('lb1', true);
    const r4 = await libFullRow('lb1');
    try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { }
    return { may1, may2, r1, r2: (r2 || []).length, r3: (r3 || []).length, r4: r4 ? 1 : 0 };
  });
  await wait(400);
  ok('(g) 학생 화면에서는 쓸 수 없다', stu.may1 === true && stu.may2 === false);
  ok('(g) 학생 화면에서 라이브러리 요청 0건',
    libHits === hits0 && stu.r1 === false && stu.r2 === 0 && stu.r3 === 0 && stu.r4 === 0,
    '요청 ' + (libHits - hits0) + '건 · 돌려받은 줄 ' + stu.r2 + '/' + stu.r3 + '/' + stu.r4);
  const sand = await page.evaluate(() => {
    const was = (typeof _ppSandbox !== 'undefined') ? _ppSandbox : null;
    let may = null;
    try { window.__sb = true; may = (typeof ppSandbox === 'function') ? libMayUse() : null; } catch (e) { }
    return { may };
  });

  console.log('\n가짜 서버가 받은 쓰기 ' + posts.length + '건 (전부 가짜)' + (posts.length ? (': ' + [...new Set(posts)].join(', ')) : ''));
  console.log('라이브러리 요청 ' + libHits + '건 (전부 가짜 서버) · lib_search ' + searchHits + '회');
  console.log('콘솔 오류 ' + errs.length + '건');
  errs.slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_library 실패:', e); process.exit(1); });
