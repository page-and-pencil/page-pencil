require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 학생 탭도 대시보드 꼴 (feat/pl-tabs-2, 2026-11-15 Todd 결정)
//   ① 목록·패널 틀·요약·수업  ② 패널의 나머지 탭(테스트·숙제·책·리딩로그·단어장·결제)
// 가짜 서버만 쓴다. 이름·반·교재·단어는 이 검사 안에서 지어낸 것만. 실제 서버로는 한 건도 나가지 않는다.
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };
const OUT = process.env.PP_TEST_OUT ? path.join(process.env.PP_TEST_OUT, 'pltabs2') : path.join(__dirname, 'shots', 'pltabs2');
fs.mkdirSync(OUT, { recursive: true });

const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = ymd(new Date());
const shift = (ds, d) => { const x = new Date(ds + 'T12:00:00'); x.setDate(x.getDate() + d); return ymd(x); };
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
const UNITS = Array.from({ length: 20 }, (_, i) => 'Unit ' + (i + 1));
const WIN = Array.from({ length: 10 }, (_, i) => shift(today, i - 5));

const D = {
  students: [
    { id: 'p2-s1', name: '나봄', grade: '초4', school: '보기초등학교', pin: '0001', fee: 200000, payday: 5, enrollDate: '2025-03-02', parentName: '나봄 어머니', parentPhone: '010-0000-0000',
      payments: [{ date: today.slice(0, 8) + '01', amt: 200000, method: 'transfer' }], memo: '보기 메모' },
    { id: 'p2-s2', name: '다온', grade: '중1', school: '보기중학교', pin: '0002', fee: 0 },
    { id: 'p2-s3', name: '라희', grade: '초6', school: '보기초등학교', pin: '0003', fee: 0 },
  ],
  classes: [{ id: 'p2-c1', name: '보기반 가', active: true, days: ['화', '목'], time: '16:00', studentIds: ['p2-s1', 'p2-s2'],
    commonMaterials: { reading: { book: '보기 리딩 1', unit: 'Unit 1', bookId: 'p2-tb1' }, reading_2: { book: '보기 리딩 2', bookId: 'p2-tb2' }, vocab: { book: '보기 어휘 1', bookId: 'p2-tb3' } } }],
  global_textbooks: [
    { id: 'p2-tb1', type: 'textbook', title: '보기 리딩 1', category: '리딩', units: Object.fromEntries(UNITS.map(u => [u, [{ word: 'barn' }]])) },
    { id: 'p2-tb2', type: 'textbook', title: '보기 리딩 2', category: '리딩', units: Object.fromEntries(UNITS.map(u => [u, [{ word: 'calm' }]])) },
    { id: 'p2-tb3', type: 'textbook', title: '보기 어휘 1', category: '어휘', units: Object.fromEntries(UNITS.map((u, i) => ['Day ' + (i + 1), [{ word: 'vast' }]])) },
  ],
  lessons: Array.from({ length: 6 }, (_, i) => ({ id: 'p2-l' + i, sid: 'p2-s1', classId: 'p2-c1', date: shift(today, -2 - i * 3), att: i === 2 ? 'late' : 'normal',
    materials: { reading: { book: '보기 리딩 1', unit: 'Unit ' + (6 - i) + ', Unit ' + (7 - i), bookId: 'p2-tb1' }, vocab: { book: '보기 어휘 1', unit: 'Day ' + (6 - i), bookId: 'p2-tb3' } },
    cmt: '보기 코멘트 ' + i, polishedCmt: i === 0 ? '보기 학부모 코멘트' : '' })),
  tests: Array.from({ length: 4 }, (_, i) => ({ id: 'p2-t' + i, sid: 'p2-s1', date: shift(today, -i * 2), attempt: 1, passPct: 90, vocabCorrect: i === 1 ? 6 : 9, vocabTotal: 10,
    grammarCorrect: 8, grammarTotal: 10, readingCorrect: 0, readingTotal: 0, listeningCorrect: 0, listeningTotal: 0, wrongWords: i === 1 ? ['barn', 'calm'] : [], allWords: [] })),
  assignments: [
    { id: 'p2-a1', sid: 'p2-s1', category: 'recur', text: '보기 리딩 1 매일', bookTitle: '보기 리딩 1', date: WIN[0], due: WIN[9],
      schedule: WIN.map((d, i) => ({ date: d, book: '보기 리딩 1', unit: 'Unit ' + (i + 1), done: d < today, doneBy: 'student' })) },
    { id: 'p2-a2', sid: 'p2-s1', category: 'grammar', text: '보기 어법', bookTitle: '보기 어법 1', range: 'p.10', date: shift(today, -1), due: shift(today, 2) },
  ],
  readings: Array.from({ length: 70 }, (_, i) => ({ id: 'p2-r' + i, sid: 'p2-s1', date: shift(today, -i), title: '보기 원서 ' + (i + 1), arLevel: '2.' + (i % 9), progress: '완독' })),
  logs: Array.from({ length: 60 }, (_, i) => ({ id: 'p2-g' + i, sid: 'p2-s1', date: shift(today, -i), photoUrl: '', photoUrls: [], bookTitle: '보기 원서 ' + (i + 1), words: ['barn'] })),
  vocab_cards: [],
  homeworks: [],
};
// 단어 3,000개 — 지어낸 낱말
const VC = [];
for (let i = 0; i < 3000; i++) VC.push({ id: 'p2-v' + i, sid: 'p2-s1', word: 'word' + i, meaning: '뜻 ' + i, src: '보기 리딩 1', srcUnit: 'Unit ' + (i % 20 + 1),
  box: i % 5, hits: i % 4, misses: i % 3, due: shift(today, (i % 9) - 4), lastSeen: shift(today, -(i % 30)), source: '수업' });
const writes = { by: {}, n: 0 };
const serve = r => {
  const req = r.request();
  const u = new URL(req.url());
  const t = (u.pathname.split('/rest/v1/')[1] || '').split('?')[0];
  if (req.method() !== 'GET' && req.method() !== 'HEAD') {
    writes.n++; writes.by[t] = (writes.by[t] || 0) + 1;
    return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  }
  let rows = t === 'vocab_cards' ? VC : D[t];
  if (rows) {
    const sid = u.searchParams.get('sid');
    if (sid && /^eq\./.test(sid)) rows = rows.filter(x => x.sid === sid.slice(3));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows.map(x => ({ id: x.id, sid: x.sid || null, updated_at: '2026-11-15T00:00:00Z', data: x }))) });
  }
  return r.continue();
};

// 재는 도구 — 그림자·그림 문자·굵기·바탕·작은 누름 자리·한쪽 굵은 선·말줄임
const MEASURE = ({ sel }) => {
  const root = document.querySelector(sel);
  const vis = e => { if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const all = [...root.querySelectorAll('*')].filter(vis);
  const nm = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const shadow = all.filter(e => getComputedStyle(e).boxShadow !== 'none').map(nm);
  const bgs = new Map();
  all.forEach(e => { const c = getComputedStyle(e).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && !/, 0\)$/.test(c)) bgs.set(c, (bgs.get(c) || 0) + 1); });
  const own = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  const emo = all.filter(e => /\p{Extended_Pictographic}/u.test(own(e))).map(e => nm(e) + ' "' + own(e).slice(0, 16) + '"');
  const w = new Map(), odd = [];
  all.forEach(e => { if (!own(e)) return; const fw = getComputedStyle(e).fontWeight; w.set(fw, (w.get(fw) || 0) + 1); if (fw !== '400' && fw !== '600' && odd.length < 6) odd.push(fw + ' ' + nm(e) + ' "' + own(e).slice(0, 12) + '"'); });
  const clk = e => e.matches('button,a[href],summary,select,input,textarea,[onclick],[role=button]');
  const small = all.filter(e => {
    if (!clk(e)) return false;
    if (e.matches('input[type=checkbox],input[type=radio]') && e.closest('label')) { const lb = e.closest('label').getBoundingClientRect(); if (lb.height >= 32) return false; }
    if (e.matches('audio')) return false;
    const b = e.getBoundingClientRect(); if (b.height >= 32 && b.width >= 32) return false;
    for (let p = e.parentElement; p && p !== root; p = p.parentElement) if (clk(p)) { const pb = p.getBoundingClientRect(); if (pb.height >= 32) return false; }
    return true;
  }).map(e => nm(e) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
  const side = all.filter(e => { const cs = getComputedStyle(e); const L = cs.borderLeftStyle === 'none' ? 0 : parseFloat(cs.borderLeftWidth) || 0;
    if (L < 2) return false; const o = Math.max(...['Top', 'Right', 'Bottom'].map(k => cs['border' + k + 'Style'] === 'none' ? 0 : parseFloat(cs['border' + k + 'Width']) || 0)); return L > o + 1.5; }).map(nm);
  return { shadow, bgs: [...bgs.entries()], emo, w: [...w.entries()], odd, small, side, dom: root.querySelectorAll('*').length };
};
const judge = (tab, m) => {
  const bad = [];
  if (m.shadow.length) bad.push('그림자 ' + m.shadow.slice(0, 2).join(','));
  if (m.emo.length) bad.push('그림 문자 ' + m.emo.slice(0, 3).join(' | '));
  if (!m.w.every(([x]) => x === '400' || x === '600')) bad.push('굵기 ' + m.odd.join(' | '));
  if (m.small.length) bad.push('32px 미만 ' + m.small.length + ' ' + m.small.slice(0, 4).join(' · '));
  if (m.side.length) bad.push('한쪽 선 ' + m.side.slice(0, 3).join(','));
  if (m.bgs.length > 5) bad.push('바탕 ' + m.bgs.length + ' ' + m.bgs.map(([k, n]) => k + '×' + n).join(' · '));
  ok(tab + ' — 그림자·그림 문자 0 · 굵기 400·600 · 32px 미만 0 · 한쪽 선 0 · 바탕 다섯 이하', bad.length === 0, bad.join(' / ') || ('바탕 ' + m.bgs.length + ' · DOM ' + m.dom));
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const errs = [];
  const mk = async (vp) => {
    const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR' });
    await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    await page.route('**/rest/v1/**', serve);
    await page.route('**/functions/v1/**', r => r.fulfill({ status: 400, contentType: 'application/json', body: '{}' }));
    await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
    await wait(1500);
    return { ctx, page };
  };
  const settle = async () => { for (let t = 0, last = writes.n, still = 0; t < 12000 && still < 2500; t += 200) { await wait(200); if (writes.n === last) still += 200; else { last = writes.n; still = 0; } } };
  const tabOpen = (page, id) => page.evaluate(async id => { swSpTab(id); await new Promise(r => setTimeout(r, 500)); }, id);

  // ═══ ① 1366x800 ═══
  const { ctx, page } = await mk({ width: 1366, height: 800 });
  await page.evaluate(async () => { swTab('t-stu'); await new Promise(r => setTimeout(r, 600)); });
  const wide = await page.evaluate(() => ({ cols: document.querySelectorAll('.sl-tbl thead th').length, panel: getComputedStyle(document.getElementById('stu-detail-col')).display,
    sum: (document.getElementById('stu-sum') || {}).textContent }));
  ok("학생을 고르기 전 — 넓은 표만 · 머리 '재원생 n명 · 이번 달 미납 n명'", wide.cols === 7 && wide.panel === 'none' && /^재원생 \d+명 · 이번 달 미납 \d+명$/.test(wide.sum), JSON.stringify(wide));
  await page.mouse.move(1, 1);   // 올려 둔 줄의 hover 바탕은 세지 않는다
  judge('목록(넓은 표)', await page.evaluate(MEASURE, { sel: '#t-stu' }));
  await page.screenshot({ path: path.join(OUT, 'list_1366.png') });
  await page.click('#stu-grid tr.sc');            // 첫 학생
  await wait(1200); await settle();
  const fr = await page.evaluate(() => {
    const col = document.querySelector('.stu-list-col').getBoundingClientRect(), det = document.getElementById('stu-detail-col').getBoundingClientRect();
    const bar = document.querySelector('.stu-panel-tabs'), tabs = [...bar.querySelectorAll('.sptab')];
    const br = bar.getBoundingClientRect();
    const body = document.querySelector('.stu-panel-body'), head = document.querySelector('.stu-panel-header');
    const cut = [...document.querySelectorAll('.stu-panel-header *')].filter(e => { const cs = getComputedStyle(e); return (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none' && cs.webkitLineClamp) && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1); }).map(e => e.className);
    return { list: Math.round(col.width), panel: Math.round(det.width), barScroll: bar.scrollWidth - bar.clientWidth, tabsIn: tabs.every(t => { const b = t.getBoundingClientRect(); return b.left >= br.left - 1 && b.right <= br.right + 1; }),
      tabTop: Math.round(br.top - det.top), over: Math.max(body.scrollWidth - body.clientWidth, head.scrollWidth - head.clientWidth), cut, n: tabs.length,
      tabFs: getComputedStyle(tabs[0]).fontSize, meta: document.getElementById('sp-meta').textContent };
  });
  ok('1366x800 학생을 고르면 — 목록 320px(±8) · 패널 700px 이상', Math.abs(fr.list - 320) <= 8 && fr.panel >= 700, '목록 ' + fr.list + ' · 패널 ' + fr.panel);
  ok('탭 여덟 개가 가로 스크롤 없이 보인다 (13px) · 탭 줄이 패널 위 150px 안', fr.n === 8 && fr.barScroll <= 0 && fr.tabsIn && fr.tabFs === '13px' && fr.tabTop <= 150, '넘침 ' + fr.barScroll + ' · 위에서 ' + fr.tabTop + 'px · ' + fr.tabFs);
  ok('패널 안 가로 넘침 0 · 머리에 말줄임으로 잘린 글 0 · 📱 없음', fr.over <= 0 && fr.cut.length === 0 && !/📱/.test(fr.meta), '넘침 ' + fr.over + ' · 잘림 ' + fr.cut.join(',') + ' · "' + fr.meta + '"');
  await page.screenshot({ path: path.join(OUT, 'sel_1366.png') });
  // ⋯ — 학생뷰 · 학부모뷰 · 단어 학습 체험
  await page.click('#sp-more'); await page.waitForSelector('#pl-menu .pl-menu-i', { timeout: 5000 }).catch(() => { });
  const menu = await page.evaluate(() => [...document.querySelectorAll('#pl-menu .pl-menu-i')].map(b => b.textContent));
  await page.evaluate(() => plMenuClose());
  ok("패널 ⋯ 에 '학생뷰 · 학부모뷰 · 단어 학습 체험'", menu.join(',') === '학생뷰,학부모뷰,단어 학습 체험', menu.join(','));
  const views = [];
  for (const [i, want] of [[0, '학생 뷰'], [1, '학부모 뷰'], [2, '학생 뷰']]) {
    await page.click('#sp-more'); await page.waitForSelector('#pl-menu .pl-menu-i', { timeout: 5000 }).catch(() => { });
    await page.evaluate(i => document.querySelectorAll('#pl-menu .pl-menu-i')[i].click(), i);
    // 미리보기는 비동기로 뜬다 — 띠가 뜰 때까지 기다린다 (여럿을 함께 돌리면 느려진다)
    await page.waitForFunction(w => ((document.getElementById('_teacher-preview-bar') || {}).textContent || '').includes(w), want, { timeout: 15000 }).catch(() => { });
    await wait(i === 2 ? 900 : 300);
    const r = await page.evaluate(() => ({ bar: (document.getElementById('_teacher-preview-bar') || {}).textContent || '', vocab: !!document.querySelector('#st-vocab.active') }));
    views.push(r.bar.includes(want) && (i !== 2 || r.vocab));
    await page.evaluate(async () => { await returnToTeacher(); await new Promise(r => setTimeout(r, 900)); });
    await page.waitForFunction(() => !document.getElementById('_teacher-preview-bar') && document.querySelector('#s-teacher.active,#s-teacher[style*="block"]') !== null, null, { timeout: 15000 }).catch(() => { });
  }
  ok('⋯ 의 세 가지가 전과 같이 열린다 (학생뷰 · 학부모뷰 · 단어 학습 체험 → 학생 단어 탭)', views.every(Boolean), views.join(','));
  await page.evaluate(async () => { swTab('t-stu'); if (!document.querySelector('#stu-split.has-sel')) { selStu('p2-s1', document.querySelector('#stu-grid tr.sc')); } await new Promise(r => setTimeout(r, 800)); });
  await settle();
  // 요약
  await tabOpen(page, 'sp-summary');
  await page.mouse.move(1, 1);
  judge('요약 탭', await page.evaluate(MEASURE, { sel: '#t-stu' }));
  const sm = await page.evaluate(async () => {
    const nest = document.querySelectorAll('#sp-summary .card, #sp-summary .sp-card, #sp-summary .bp-area, #sp-summary .sp-prog-card, #sp-summary .sp-rd-card').length;
    const r = document.querySelector('#sp-summary .sp-jr-row[role=button]');
    const id = r && r.id.replace('sp-jr-r-', ''); const b0 = document.getElementById('sp-jr-b-' + id).hidden;
    r.click(); await new Promise(x => setTimeout(x, 200));
    const b = document.getElementById('sp-jr-b-' + id);
    return { nest, b0, open: !b.hidden, next: /다음 책/.test(b.textContent) && /보기 리딩 2/.test(b.textContent), add: !!document.querySelector('#sp-summary .sp-journey .pl-sec-aux button'),
      chips: document.querySelectorAll('#sp-summary .sp-period .pl-chip').length };
  });
  ok('요약 — 영역 줄을 누르면 다음 책이 펼쳐진다 · 카드 안 카드 0 · [+ 교재] 하나 · 기간 칩 한 줄', sm.nest === 0 && sm.b0 && sm.open && sm.next && sm.add && sm.chips === 6, JSON.stringify(sm));
  await page.screenshot({ path: path.join(OUT, 'tab_summary.png') });
  // 수업
  await tabOpen(page, 'sp-lessons');
  await page.mouse.move(1, 1);
  judge('수업 탭', await page.evaluate(MEASURE, { sel: '#t-stu' }));
  const ls = await page.evaluate(() => ({ secs: document.querySelectorAll('#sp-lessons .sp-les').length, pills: document.querySelectorAll('#sp-lessons .spill,#sp-lessons .prog-pill,#sp-lessons .cls-les-card').length,
    head: (document.querySelector('#sp-lessons .sp-les .pl-sec-t') || {}).textContent, row: (document.querySelector('#sp-lessons .sp-les-row') || {}).textContent }));
  ok("수업 — 날짜 제목 줄 '2026-11-12 (목)' 꼴 · 교재마다 한 줄 · 색 알약·단원 알약·카드 0", ls.secs >= 6 && ls.pills === 0 && /^\d{4}-\d\d-\d\d \(.\)$/.test(ls.head) && /보기 리딩 1/.test(ls.row) && /Unit \d, Unit \d/.test(ls.row), JSON.stringify(ls));
  await page.screenshot({ path: path.join(OUT, 'tab_lessons.png') });
  // ⋯ — 복사 · 수정 · 삭제
  await page.click('#sp-lessons .sp-les .pl-more'); await page.waitForSelector('#pl-menu .pl-menu-i', { timeout: 5000 }).catch(() => { });
  const lm = await page.evaluate(() => [...document.querySelectorAll('#pl-menu .pl-menu-i')].map(b => b.textContent));
  await page.evaluate(() => document.querySelectorAll('#pl-menu .pl-menu-i')[1].click()); await wait(500);
  const edOpen = await page.evaluate(() => { const m = document.getElementById('m-edit-les'); const o = !!m && m.classList.contains('open'); if (m) m.classList.remove('open'); return o; });
  await page.click('#sp-lessons .sp-les .pl-more'); await page.waitForSelector('#pl-menu .pl-menu-i', { timeout: 5000 }).catch(() => { });
  await page.evaluate(() => document.querySelectorAll('#pl-menu .pl-menu-i')[0].click()); await wait(500);
  const copied = await page.evaluate(() => { const t = (document.getElementById('toast') || {}).textContent || ''; const c = document.querySelector('#m-confirm.open'); if (c) c.classList.remove('open'); return /복사/.test(t) || !!c; });
  const n0 = writes.by.lessons || 0, cnt0 = await page.evaluate(() => document.querySelectorAll('#sp-lessons .sp-les').length);
  const lid = await page.evaluate(() => /spLesMenu\(this,'([^']+)'/.exec(document.querySelector('#sp-lessons .sp-les .pl-more').getAttribute('onclick'))[1]);
  await page.click('#sp-lessons .sp-les .pl-more'); await page.waitForSelector('#pl-menu .pl-menu-i', { timeout: 5000 }).catch(() => { });
  await page.evaluate(() => document.querySelectorAll('#pl-menu .pl-menu-i')[2].click()); await wait(300);
  await page.evaluate(() => { const b = [...document.querySelectorAll('#m-confirm button')].find(x => /삭제/.test(x.textContent)); if (b) b.click(); }); await wait(900);
  const del = await page.evaluate(lid => ({ gone: !DB.less().some(l => l.id === lid), cnt: document.querySelectorAll('#sp-lessons .sp-les').length }), lid);
  ok('수업 ⋯ — 복사 · 수정 · 삭제가 전과 같이 (삭제는 확인 창 → 휴지통, 쓰기 1건)', lm.join(',') === '복사,수정,삭제' && edOpen && copied && del.gone && (writes.by.lessons || 0) - n0 === 1,
    lm.join(',') + ' · 수정 창 ' + edOpen + ' · 복사 ' + copied + ' · 삭제 ' + del.gone + ' 쓰기 ' + ((writes.by.lessons || 0) - n0) + ' · 줄 ' + cnt0 + '→' + del.cnt);

  // ═══ 390x780 — 패널이 화면을 덮는다 ═══
  await page.setViewportSize({ width: 390, height: 780 }); await wait(500);
  await tabOpen(page, 'sp-payment');
  const m390 = await page.evaluate(() => { const det = document.getElementById('stu-detail-col').getBoundingClientRect(); const bar = document.querySelector('.stu-panel-tabs').getBoundingClientRect();
    const on = document.querySelector('.sptab.active').getBoundingClientRect();
    return { cover: Math.round(det.left) <= 1 && Math.round(det.width) >= 388, over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      onVis: on.left >= bar.left - 1 && on.right <= bar.right + 1, body: (() => { const b = document.querySelector('.stu-panel-body'); return b.scrollWidth - b.clientWidth; })() }; });
  ok('390x780 — 패널이 화면을 덮고 가로 넘침 0 · 고른 탭(결제)이 보인다', m390.cover && m390.over === 0 && m390.body <= 0 && m390.onVis, JSON.stringify(m390));
  await page.screenshot({ path: path.join(OUT, 'panel_390.png') });
  await ctx.close();

  console.log('\n콘솔 오류 ' + errs.length + '건' + (errs.length ? '\n  ' + errs.slice(0, 5).join('\n  ') : ''));
  ok('콘솔 오류 없음', errs.length === 0);
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_pl_tabs2 실패:', e); process.exit(1); });
