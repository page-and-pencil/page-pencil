require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 대시보드 꼴 (feat/dash-plain, 2026-11-15 Todd 결정) — 상자 대신 제목 줄과 가는 선
//   본보기: 목록·체크는 Things, 틀·표는 Attio, 색은 Cal.com. 바탕 넷·굵기 400·600.
// 가짜 서버만 쓴다. 이름·반·교재는 지어낸 것만. 실제 서버로는 한 건도 나가지 않는다.
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };
const OUT = process.env.PP_TEST_OUT ? path.join(process.env.PP_TEST_OUT, 'dash') : path.join(__dirname, 'shots', 'dash');
fs.mkdirSync(OUT, { recursive: true });

const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = ymd(new Date());
const shift = (ds, d) => { const x = new Date(ds + 'T12:00:00'); x.setDate(x.getDate() + d); return ymd(x); };
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
const dowOf = ds => DOWS[new Date(ds + 'T12:00:00').getDay()];
const TODAY_DOW = dowOf(today), NEXT_DOW = dowOf(shift(today, 2));
// 이번 주 월~일
const t0 = new Date(today + 'T12:00:00'); const mon = new Date(t0); mon.setDate(t0.getDate() - ((t0.getDay() + 6) % 7));
const WEEK = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return ymd(d); });
const UNITS = Array.from({ length: 20 }, (_, i) => 'Unit ' + (i + 1));

const D = {
  students: [
    { id: 'dp-s1', name: '나봄', grade: '초4', pin: '0001', fee: 0, hwChallenge: { goal: 20, reward: '작은 선물', start: shift(today, -10), createdAt: shift(today, -10) } },
    { id: 'dp-s2', name: '다온', grade: '초4', pin: '0002', fee: 0 },
    { id: 'dp-s3', name: '라희', grade: '중1', pin: '0003', fee: 0 },
  ],
  classes: [
    { id: 'dp-c1', name: '보기반 가', active: true, days: [TODAY_DOW], times: {}, time: '16:00', studentIds: ['dp-s1', 'dp-s2'],
      commonMaterials: { reading: { book: '보기 리딩 1', unit: 'Unit 1', bookId: 'dp-tb1' }, vocab: { book: '보기 어휘 1', unit: 'Day 1', bookId: 'dp-tb2' } } },
    { id: 'dp-c2', name: '보기반 나', active: true, days: [NEXT_DOW], time: '17:00', studentIds: ['dp-s3'],
      commonMaterials: { grammar: { book: '보기 어법 1', unit: 'Unit 1', bookId: 'dp-tb3' } } },
  ],
  global_textbooks: [
    { id: 'dp-tb1', type: 'textbook', title: '보기 리딩 1', category: '리딩', units: Object.fromEntries(UNITS.map(u => [u, [{ word: 'barn' }]])) },
    { id: 'dp-tb2', type: 'textbook', title: '보기 어휘 1', category: '어휘', units: Object.fromEntries(UNITS.map((u, i) => ['Day ' + (i + 1), [{ word: 'calm' }]])) },
    { id: 'dp-tb3', type: 'textbook', title: '보기 어법 1', category: '어법', units: Object.fromEntries(UNITS.map(u => [u, [{ word: 'is' }]])) },
  ],
  lessons: [
    { id: 'dp-l1', sid: 'dp-s1', classId: 'dp-c1', date: shift(today, -7), att: 'normal', materials: { reading: { book: '보기 리딩 1', unit: 'Unit 3', bookId: 'dp-tb1' }, vocab: { book: '보기 어휘 1', unit: 'Day 2', bookId: 'dp-tb2' } } },
    { id: 'dp-l2', sid: 'dp-s3', classId: 'dp-c2', date: shift(today, -5), att: 'normal', materials: { grammar: { book: '보기 어법 1', unit: 'Unit 6', bookId: 'dp-tb3' } } },
  ],
  assignments: [
    { id: 'dp-a1', sid: 'dp-s1', category: 'recur', text: '보기 리딩 1 읽기', bookTitle: '보기 리딩 1', bookId: 'dp-tb1', date: WEEK[0], due: WEEK[6],
      schedule: WEEK.map((d, i) => ({ date: d, book: '보기 리딩 1', unit: 'Unit ' + (i + 1), done: d < today || i === 0 })) },   // 월요일(지난 날 없음)에도 다 한 날이 하나는 있게
    { id: 'dp-a2', sid: 'dp-s2', category: 'vocab', text: '보기 어휘 1', bookTitle: '보기 어휘 1', bookId: 'dp-tb2', date: WEEK[0], due: WEEK[6],
      schedule: WEEK.map((d, i) => ({ date: d, book: '보기 어휘 1', unit: 'Day ' + (i + 1), done: i % 2 === 0 && d < today })) },
  ],
  homeworks: [
    { id: 'dp-h1', sid: 'dp-s2', submitted: true, checked: false, date: today },
    { id: 'dp-h2', sid: 'dp-s3', submitted: true, checked: false, date: today },
  ],
  notices: [{ id: 'dp-n1', text: '보기 공지 — 이번 주 금요일은 일찍 끝나요.', date: shift(today, -2), active: true }],
};
// ③ 에서만 더하는 가짜 학생·반·숙제 — 반복(수업으로 처리된 몫 포함) · 클래스5 · 끝난 교재의 단건 기간 숙제
let EXTRA = false;
const DX = {
  students: [{ id: 'dp-s4', name: '가람', grade: '초5', pin: '0004', fee: 0 }],
  classes: [{ id: 'dp-c3', name: '보기반 다', active: true, days: [], studentIds: ['dp-s4'], commonMaterials: {} }],
  assignments: [
    { id: 'dp-x1', sid: 'dp-s4', category: 'recur', text: '보기 리딩 1 매일', bookTitle: '보기 리딩 1', bookId: 'dp-tb1', date: WEEK[0], due: WEEK[6],
      schedule: WEEK.map((d, i) => ({ date: d, book: '보기 리딩 1', unit: 'Unit ' + (i + 1), done: i < 2, doneBy: i === 0 ? 'lesson' : (i === 1 ? 'student' : '') })) },
    { id: 'dp-x2', sid: 'dp-s4', category: 'class5', text: '클래스5', bookTitle: '보기 클래스5', date: WEEK[0], due: WEEK[6],
      schedule: [0, 2, 4].map(i => ({ date: WEEK[i], book: '보기 클래스5', unit: '과 ' + (i + 1), done: false })) },
    { id: 'dp-x3', sid: 'dp-s4', category: 'grammar', text: '보기 어법 1', bookTitle: '보기 어법 1', bookId: 'dp-tb3', range: 'Unit 20', date: WEEK[0], due: WEEK[2], completedAt: WEEK[1] + 'T10:00:00Z', completedBy: 'student' },
  ],
};
let writes = { notices: 0, other: 0 };
let loadWrites = 0, dashWrites = 0;   // 대시보드를 그린 뒤의 쓰기만 센다
const serve = r => {
  const req = r.request();
  const t = (new URL(req.url()).pathname.split('/rest/v1/')[1] || '').split('?')[0];
  if (req.method() !== 'GET' && req.method() !== 'HEAD') {
    if (t === 'notices') writes.notices++; else { writes.other++; (writes.by = writes.by || {})[t] = (writes.by[t] || 0) + 1; if (process.env.PP_DBG) console.log('      · 쓰기 ' + t + ' ' + req.method()); }
    return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  }
  if (D[t]) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify((EXTRA && DX[t] ? D[t].concat(DX[t]) : D[t]).map(x => ({ id: x.id, sid: x.sid || null, updated_at: '2026-11-15T00:00:00Z', data: x }))) });
  return r.continue();
};

// 대시보드 안을 재는 도구 (페이지 안에서 돈다)
const MEASURE = () => {
  const root = document.getElementById('t-dash');
  const vis = e => { if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const all = [...root.querySelectorAll('*')].filter(vis);
  const shadow = all.filter(e => getComputedStyle(e).boxShadow !== 'none').map(e => e.tagName + '.' + e.className);
  const parse = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(',').map(Number); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  const bgs = new Map();
  all.forEach(e => { const b = parse(getComputedStyle(e).backgroundColor); if (b && b.a > 0.02) { const k = getComputedStyle(e).backgroundColor; bgs.set(k, (bgs.get(k) || 0) + 1); } });
  // 옅은 색 바탕의 정사각 아이콘 칸 — 24~40px 정사각, 흰색·투명 아닌 바탕
  const sq = all.filter(e => { const b = e.getBoundingClientRect(); if (Math.abs(b.width - b.height) > 2 || b.width < 22 || b.width > 42) return false;
    const c = parse(getComputedStyle(e).backgroundColor); if (!c || c.a < 0.05) return false; const [r, g, bb] = c.c; return !(r > 250 && g > 250 && bb > 250) && (r + g + bb) / 3 > 170; })
    .map(e => e.tagName + '.' + e.className);
  const weights = new Map();
  all.forEach(e => { const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!own) return; const w = getComputedStyle(e).fontWeight; weights.set(w, (weights.get(w) || 0) + 1); });
  const odd = all.filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && !['400', '600'].includes(getComputedStyle(e).fontWeight))
    .slice(0, 6).map(e => getComputedStyle(e).fontWeight + ' ' + e.tagName + '.' + String(e.className).slice(0, 30) + ' "' + e.textContent.trim().slice(0, 14) + '"');
  return { shadow, bgs: [...bgs.entries()], sq, weights: [...weights.entries()], odd,
    stat: document.querySelectorAll('#t-dash .dash-stat').length,
    greet: /좋은 아침|안녕하세요|수고 많으셨어요/.test(root.innerText) };
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const mk = async (vp) => {
    const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR' });
    await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); localStorage.setItem('pp_lastBackup', new Date().toISOString().slice(0, 7)); } catch (e) { } });
    const page = await ctx.newPage();
    await page.route('**/rest/v1/**', serve);
    await page.route('**/functions/v1/**', r => r.fulfill({ status: 400, contentType: 'application/json', body: '{}' }));
    await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
    await wait(1500);
    // 앱이 뜰 때 하는 동기화(가짜 자료에 빠진 칸을 채워 쓰기)는 대시보드와 무관 — 여기까지는 세지 않는다
    loadWrites = writes.other;
    await page.evaluate(async () => { swTab('t-dash'); renderDash(); await new Promise(r => setTimeout(r, 600)); });
    return { ctx, page };
  };
  const errs = [];

  // ═══ ① 1366x800 — 수업 있는 날 ═══
  {
    const { ctx, page } = await mk({ width: 1366, height: 800 });
    let base1 = loadWrites;
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    const m = await page.evaluate(MEASURE);
    ok('상자 꾸밈 없음 — 그림자 0 · .dash-stat 0 · 옅은 색 정사각 아이콘 칸 0', m.shadow.length === 0 && m.stat === 0 && m.sq.length === 0,
      '그림자 ' + m.shadow.length + ' · dash-stat ' + m.stat + ' · 아이콘 칸 ' + m.sq.length + (m.sq.length ? ' ' + m.sq.slice(0, 3).join(',') : ''));
    ok('바탕색 다섯 가지 이하 (투명 제외)', m.bgs.length <= 5, m.bgs.map(([k, n]) => k + '×' + n).join(' · '));
    ok('글자 굵기 400·600 뿐', m.weights.every(([w]) => w === '400' || w === '600'), m.weights.map(([w, n]) => w + '×' + n).join(' · ') + (m.odd.length ? ' | ' + m.odd.join(' | ') : ''));
    // 인사 글 — 아침·낮·저녁
    const greet = await page.evaluate(async () => {
      const real = Date.prototype.getHours, out = [];
      for (const h of [8, 14, 21]) { Date.prototype.getHours = function () { return h; }; renderDash(); await new Promise(r => setTimeout(r, 150)); out.push(/좋은 아침|안녕하세요|수고 많으셨어요/.test(document.getElementById('t-dash').innerText)); }
      Date.prototype.getHours = real; renderDash(); await new Promise(r => setTimeout(r, 200));
      return out;
    });
    ok('인사 글 0곳 (아침·낮·저녁)', greet.every(x => !x), greet.join(','));
    const lay = await page.evaluate(() => {
      const top = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), w: Math.round(b.width) }; };
      const title = document.querySelector('#dash-greet .pl-title');
      return { stats: top('#dash-stats'), today: top('#dash-today .pl-sec-h'), act: top('#dash-actions .pl-sec-h'), heat: top('#dash-weekheat .pl-sec-h'),
        title: title ? { t: title.textContent, fs: getComputedStyle(title).fontSize, fw: getComputedStyle(title).fontWeight } : null,
        mk: (() => { const b = document.querySelector('#dash-greet .pl-head-btn'); return b ? { t: b.textContent.trim(), title: b.title, right: Math.round(b.getBoundingClientRect().right) } : null; })(),
        page: top('#t-dash .pl-page'), vh: innerHeight };
    });
    ok('날짜가 제목 (20px/600) · [만들기] 는 제목 줄 오른쪽 끝, 설명은 title', !!lay.title && /\d+월 \d+일 .요일/.test(lay.title.t) && lay.title.fs === '20px' && lay.title.fw === '600'
      && !!lay.mk && lay.mk.t === '만들기' && /따라가며/.test(lay.mk.title) && Math.abs(lay.mk.right - (lay.page.l + lay.page.w)) <= 2,
      JSON.stringify(lay.title) + ' · 만들기 right ' + (lay.mk && lay.mk.right) + ' / 본문 ' + (lay.page.l + lay.page.w));
    ok('1366x800 — 숫자 줄이 위에서 200px 안', !!lay.stats && lay.stats.t <= 200, lay.stats && lay.stats.t + 'px');
    ok("1366x800 — '오늘의 수업'·'바로 할 일'·'이번 주 숙제' 머리가 스크롤 없이 화면 안",
      [lay.today, lay.act, lay.heat].every(x => x && x.b <= lay.vh) && lay.today.l < lay.act.l && lay.act.w === 340,
      '오늘 ' + (lay.today && lay.today.t) + ' · 할 일 ' + (lay.act && lay.act.t) + '(폭 ' + (lay.act && lay.act.w) + ') · 이번 주 ' + (lay.heat && lay.heat.b) + ' / ' + lay.vh);
    // 머리 요약과 첫 칸 — 수업 있는 날
    const day1 = await page.evaluate(() => ({ sum: document.getElementById('dash-sum').textContent,
      cells: [...document.querySelectorAll('#dash-stats .pl-stat')].map(c => ({ k: c.dataset.k, l: c.querySelector('.pl-stat-l').textContent, v: c.querySelector('.pl-stat-v').textContent, col: getComputedStyle(c.querySelector('.pl-num')).color })) }));
    ok("수업 있는 날 — 머리 '오늘 수업 1개 · 기록 0/1', 첫 칸 '오늘 기록 0/1', 재원생 칸 없음",
      day1.sum === '오늘 수업 1개 · 기록 0/1' && day1.cells[0].k === 'rec' && day1.cells[0].v.replace(/\s/g, '') === '0/1' && !day1.cells.some(c => c.k === 'stu') && day1.cells.length === 4,
      '"' + day1.sum + '" · ' + day1.cells.map(c => c.l + ' ' + c.v).join(' | '));
    const hw = day1.cells.find(c => c.k === 'hw'), stamp = day1.cells.find(c => c.k === 'stamp');
    ok('확인할 숙제 2건 — 그 숫자만 --badt, 다른 칸은 아니다', !!hw && /^2/.test(hw.v) && hw.col === 'rgb(160, 50, 9)' && day1.cells.filter(c => c.col === 'rgb(160, 50, 9)').length === 1,
      hw && (hw.v + ' ' + hw.col));
    ok("도장 칸 — 학생 한 명이면 '○○ 도장 n/20'", !!stamp && /나봄 도장/.test(stamp.l) && /\/20/.test(stamp.v), stamp && (stamp.l + ' ' + stamp.v));
    // 오늘의 수업 줄
    const tdy = await page.evaluate(() => { const r = document.querySelector('#dash-today .pl-row'); return r ? { t: r.innerText.replace(/\n/g, ' | '), btn: !!r.querySelector('.btn'), time: (r.querySelector('.pl-row-time') || {}).textContent } : null; });
    ok('오늘의 수업 — 시각 · 반 이름 · 오늘 나갈 교재·단원 · [기록]', !!tdy && /16:00/.test(tdy.time) && /보기반 가/.test(tdy.t) && /보기 리딩 1/.test(tdy.t) && tdy.btn, tdy && tdy.t);
    // 바로 할 일
    const todo = await page.evaluate(() => { const rows = [...document.querySelectorAll('#dash-actions .pl-row')]; const r = rows[0]; if (!r) return null; const ck = r.querySelector('.pl-ck');
      const cs = ck ? getComputedStyle(ck) : null; return { n: rows.length, h: Math.round(r.getBoundingClientRect().height), ck: cs && { w: cs.width, bw: cs.borderTopWidth, r: cs.borderRadius, pe: cs.pointerEvents },
        link: (r.querySelector('.pl-link') || {}).textContent, linkFs: r.querySelector('.pl-link') ? getComputedStyle(r.querySelector('.pl-link')).fontSize : '' }; });
    ok('바로 할 일 — 줄 40px · 빈 동그라미 15px/1.5px(누르는 자리 아님) · 오른쪽 글 링크 12px', !!todo && todo.h >= 40 && todo.ck && todo.ck.w === '15px' && /^1(\.5)?px$/.test(todo.ck.bw) && todo.ck.pe === 'none' && todo.linkFs === '12px',
      todo && JSON.stringify(todo));
    // 이번 주 숙제 표
    const wk = await page.evaluate(() => {
      const tds = [...document.querySelectorAll('#dash-weekheat td.pl-td')];
      const colored = tds.filter(td => { const b = getComputedStyle(td).backgroundColor; return b !== 'rgba(0, 0, 0, 0)' && b !== 'rgb(255, 255, 255)'; }).length
        + tds.filter(td => [...td.querySelectorAll('*')].some(e => { const b = getComputedStyle(e).backgroundColor; return b !== 'rgba(0, 0, 0, 0)' && b !== 'rgb(255, 255, 255)'; })).length;
      const full = tds.filter(td => td.classList.contains('full'));
      return { title: (document.querySelector('#dash-weekheat .pl-sec-t') || {}).textContent, aux: (document.querySelector('#dash-weekheat .pl-sec-aux') || {}).textContent,
        n: tds.length, colored, full: full.length, fullCheck: full.every(td => !!td.querySelector('svg,.pl-ok')),
        h: tds[0] ? Math.round(tds[0].getBoundingClientRect().height) : 0, th: document.querySelector('#dash-weekheat th') ? getComputedStyle(document.querySelector('#dash-weekheat th')).fontSize : '' };
    });
    ok("이번 주 숙제 — 제목·보조 글 '한 것 / 낸 것' · 색 바탕 칸 0 · 다 한 날 체크 · 줄 40px · 머리 12px",
      wk.title === '이번 주 숙제' && wk.aux === '한 것 / 낸 것' && wk.n > 0 && wk.colored === 0 && wk.full > 0 && wk.fullCheck && wk.h >= 40 && wk.th === '12px', JSON.stringify(wk));
    // 반별 진도 막대
    const bar = await page.evaluate(() => { const bs = [...document.querySelectorAll('#dash-clspath .pl-bar')]; return { n: bs.length, h: bs.map(b => Math.round(b.getBoundingClientRect().height)),
      fill: [...new Set(bs.map(b => getComputedStyle(b.firstElementChild).backgroundColor))], areas: [...document.querySelectorAll('#dash-clspath .pl-bar-k')].map(e => e.textContent), dots: document.querySelectorAll('#dash-clspath .pp-area-dot').length }; });
    ok('반별 진도 — 막대 4px · 채움 색이 영역과 상관없이 하나 · 색 점 없음', bar.n >= 2 && bar.h.every(h => h === 4) && bar.fill.length === 1 && new Set(bar.areas).size >= 2 && bar.dots === 0,
      bar.n + '줄 · 높이 ' + bar.h.join(',') + ' · 채움 ' + bar.fill.join(',') + ' · 영역 ' + [...new Set(bar.areas)].join(','));
    // 이번 달 현황 — 숫자 줄 꼴
    const mo = await page.evaluate(() => [...document.querySelectorAll('#dash-monthly .pl-stat .pl-stat-l')].map(e => e.textContent));
    ok('이번 달 현황 — 숫자 줄 꼴 (출석 · 테스트 평균 · 원서)', mo.join(',') === '출석,테스트 평균,원서', mo.join(','));
    await page.screenshot({ path: path.join(OUT, 'dash_1366_lesson.png') });
    // 공지 — 처음엔 한 줄, [새 공지] 로 펼쳐 등록
    const n0 = await page.evaluate(() => ({ newHidden: document.getElementById('dash-notice-new').hidden, listHidden: document.getElementById('dash-notice-list').hidden,
      line: document.querySelector('#dash-notice-section .pl-fold-row').innerText.replace(/\n/g, ' '), h: Math.round(document.getElementById('dash-notice-section').getBoundingClientRect().height) }));
    ok("공지 — 처음엔 한 줄 '공지 · 게시 중 n건 [새 공지]'", n0.newHidden && n0.listHidden && /공지/.test(n0.line) && /게시 중 1건/.test(n0.line) && /새 공지/.test(n0.line) && n0.h <= 52, JSON.stringify(n0));
    await page.click('#dash-notice-tg'); await wait(150);
    const lst = await page.evaluate(() => !document.getElementById('dash-notice-list').hidden && document.querySelectorAll('#notice-board .notice-item').length);
    await page.click('#dash-notice-new-btn'); await wait(150);
    await page.fill('#dash-notice-input', '보기 공지 둘 — 다음 주 월요일 휴강');
    const before = writes.notices;
    await page.click('#dash-notice-new .btn.bt'); await wait(500);
    const n1 = await page.evaluate(() => (document.querySelector('#dash-notice-tg .pl-sec-aux') || {}).textContent);
    ok('공지 — 줄을 누르면 게시 중 목록 · [새 공지] 로 펼쳐 등록 (가짜 서버 쓰기 1건)', !!lst && writes.notices - before === 1 && /게시 중 2건/.test(n1), '목록 ' + lst + '건 · 쓰기 ' + (writes.notices - before) + ' · ' + n1);

    // [기록] — 클래스 탭으로 옮겨 오늘 기록이 열린다. 저장하고 돌아오면 '기록함' (fix/dash-plain-2)
    await page.click('#dash-today .pl-row-btn'); await wait(700);
    const rec = await page.evaluate(() => { const b = document.getElementById('cl-save-btn'); const r = b ? b.getBoundingClientRect() : null;
      return { tab: (document.querySelector('#s-teacher .panel.active') || {}).id, date: (document.getElementById('cl-date') || {}).value, cls: document.getElementById('cl-class-id').value,
        save: !!r && r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && document.getElementById('cls-record-col').classList.contains('open') }; });
    ok('[기록] — 클래스 탭 · 그 반 · 오늘 날짜 기록이 열리고 [저장하기] 가 화면 안', rec.tab === 't-class' && rec.date === today && rec.cls === 'dp-c1' && rec.save, JSON.stringify(rec));
    await page.screenshot({ path: path.join(OUT, 'dash_record_open.png') });
    const wSave0 = writes.other;
    await page.evaluate(async () => { await saveClassLesson(); await new Promise(r => setTimeout(r, 600));
      document.querySelectorAll('.mo.open').forEach(m => m.classList.remove('open')); });   // 저장 뒤 뜨는 '학부모 알림' 창은 닫는다
    // 저장 뒤 단어 카드 동기화가 몇 초 늦게 따라온다 — 쓰기가 3.5초 멎을 때까지 기다린다 (최대 12초)
    for (let t = 0, last = writes.other, still = 0; t < 12000 && still < 3500; t += 200) { await wait(200); if (writes.other === last) still += 200; else { last = writes.other; still = 0; } }
    const afterSave = await page.evaluate(() => ({ tab: (document.querySelector('#s-teacher .panel.active') || {}).id, rec: DB.less().some(l => l.classId === 'dp-c1' && l.date === ppToday()) }));
    base1 += writes.other - wSave0;                    // 수업 기록 저장은 대시보드 밖의 쓰기
    await page.evaluate(async () => { swTab('t-dash'); await new Promise(r => setTimeout(r, 500)); });
    const back = await page.evaluate(() => ({ done: (document.querySelector('#dash-today .pl-row-2 .pl-done') || {}).textContent || '', sum: document.getElementById('dash-sum').textContent }));
    ok("저장 뒤 클래스 탭에 남고, 대시보드로 오면 그 줄이 '기록함'", afterSave.tab === 't-class' && afterSave.rec && back.done === '기록함' && /기록 1\/1/.test(back.sum),
      JSON.stringify(afterSave) + ' · ' + JSON.stringify(back));

    // 0 이면 흐리게
    const zero = await page.evaluate(async () => { _cache.homeworks = []; renderDash(); await new Promise(r => setTimeout(r, 300));
      const c = document.querySelector('#dash-stats .pl-stat[data-k="hw"] .pl-num'); const m = document.createElement('i'); m.style.color = 'var(--text-muted)'; document.body.appendChild(m); const mc = getComputedStyle(m).color; m.remove();
      return { v: c.textContent, col: getComputedStyle(c).color, muted: mc }; });
    ok('확인할 숙제 0 — 숫자가 --text-muted', zero.v === '0' && zero.col === zero.muted, zero.v + ' ' + zero.col + ' / ' + zero.muted);

    // ═══ 수업 없는 날 ═══
    const day0 = await page.evaluate(async (nd) => {
      _cache.globalClasses.forEach(c => { c.days = [nd]; c.extraDates = []; });
      renderDash(); await new Promise(r => setTimeout(r, 400));
      return { sum: document.getElementById('dash-sum').textContent,
        cells: [...document.querySelectorAll('#dash-stats .pl-stat')].map(c => c.dataset.k), today: document.getElementById('dash-today').innerText.replace(/\n/g, ' | '),
        prev: !!document.querySelector('#dash-today .pl-link') && document.querySelector('#dash-today .pl-link').textContent };
    }, NEXT_DOW);
    const want = '오늘 수업 없음 · 다음 수업 ' + Number(shift(today, 2).slice(5, 7)) + '/' + Number(shift(today, 2).slice(8, 10)) + '(' + NEXT_DOW + ') 보기반 가·보기반 나';
    ok("수업 없는 날 — 머리 '오늘 수업 없음 · 다음 수업 m/d(요) 반', 첫 칸 확인할 숙제, 재원생 칸 있음",
      day0.sum === want && day0.cells[0] === 'hw' && day0.cells.includes('stu') && !day0.cells.includes('rec'), '"' + day0.sum + '" (기대 "' + want + '") · ' + day0.cells.join(','));
    ok("수업 없는 날 — '오늘은 수업이 없어요' 와 다음 수업 줄 [미리 보기]", /오늘은 수업이 없어요/.test(day0.today) && /다음 수업/.test(day0.today) && day0.prev === '미리 보기', day0.today);
    await page.evaluate(() => { document.querySelectorAll('.pl-fold-body').forEach(b => b.hidden = true); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelectorAll('*').forEach(e => { if (e.scrollTop) e.scrollTop = 0; }); const t = document.getElementById('toast'); if (t) t.style.display = 'none'; }); await wait(200);
    await page.screenshot({ path: path.join(OUT, 'dash_1366_nolesson.png') });
    // [미리 보기] — 클래스 탭으로 옮겨 다음 수업 날짜의 기록이 열린다 (fix/dash-plain-2)
    const nx = await page.evaluate(() => [...document.querySelectorAll('#dash-today .pl-next')].map(r => ({ t: r.querySelector('.pl-row-t').textContent, sub: r.querySelector('.pl-row-sub').textContent })));
    ok('다음 수업 줄 — 반마다, 아래 작은 글에 그날 교재·단원', nx.length === 2 && nx.every(x => x.sub.trim().length > 0), JSON.stringify(nx));
    await page.click('#dash-today .pl-next .pl-link'); await wait(700);
    const pv = await page.evaluate(() => { const b = document.getElementById('cl-save-btn'); const r = b ? b.getBoundingClientRect() : null;
      return { tab: (document.querySelector('#s-teacher .panel.active') || {}).id, date: (document.getElementById('cl-date') || {}).value,
        save: !!r && r.width > 0 && r.top >= 0 && r.bottom <= innerHeight }; });
    ok('[미리 보기] — 보이는 탭이 클래스 · 날짜 칸이 다음 수업 날짜 · [저장하기] 가 화면 안', pv.tab === 't-class' && pv.date === shift(today, 2) && pv.save, JSON.stringify(pv) + ' (기대 ' + shift(today, 2) + ')');
    await page.screenshot({ path: path.join(OUT, 'dash_preview_open.png') });
    await page.evaluate(async () => { try { closeClsRecord(); } catch (e) { } swTab('t-dash'); await new Promise(r => setTimeout(r, 400)); });
    // 도장 — 여럿이면 '오늘 도장 n/m명'
    const st2 = await page.evaluate(async () => { _cache.students.forEach(s => { s.hwChallenge = { goal: 20, reward: '작은 선물', start: ppToday(), createdAt: ppToday() }; });
      renderDash(); await new Promise(r => setTimeout(r, 300)); const c = document.querySelector('#dash-stats .pl-stat[data-k="stamp"]'); return c.innerText.replace(/\n/g, ' '); });
    ok("도장 칸 — 여럿이면 '오늘 도장 n/m명'", /오늘 도장/.test(st2) && /\/3명/.test(st2), st2);
    dashWrites += writes.other - base1;
    await ctx.close();
  }

  // ═══ ② 1440x900 · 390x780 캡처와 폭 ═══
  {
    const { ctx, page } = await mk({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(OUT, 'dash_1440.png') });
    await page.setViewportSize({ width: 390, height: 780 }); await wait(400);
    const r = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('#dash-stats .pl-stat')].map(c => { const b = c.getBoundingClientRect(); return { t: Math.round(b.top), l: Math.round(b.left) }; });
      const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      // 접힌 줄도 펼쳐 본다 (데이터 채우기 목록의 [더 보기] 단추 dashFillToggle 이 17px 이었다)
      document.querySelectorAll('#t-dash details').forEach(d => { d.open = true; });
      try { _dashFillAll = false; renderDashFill(); } catch (e) { }
      // 누름 자리: 버튼·링크·onclick·summary·입력 — 32px 미만이고, 32px 이상인 누름 자리 안에 들어 있지 않은 것
      const clk = e => e.matches('button,a[href],summary,select,input,textarea,[onclick]');
      const root = document.getElementById('t-dash');
      const small = [...root.querySelectorAll('*')].filter(e => {
        if (!clk(e) || e.offsetParent === null) return false;
        const b = e.getBoundingClientRect(); if (!b.width || !b.height) return false;
        if (b.height >= 32 && b.width >= 32) return false;
        for (let p = e.parentElement; p && p !== root; p = p.parentElement) if (clk(p)) { const pb = p.getBoundingClientRect(); if (pb.height >= 32) return false; }
        return true;
      }).map(e => e.tagName + '.' + String(e.className).slice(0, 24) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
      return { cells, over, small };
    });
    const tops = [...new Set(r.cells.map(c => c.t))], lefts = [...new Set(r.cells.map(c => c.l))];
    ok('390x780 — 숫자 줄 2x2', r.cells.length === 4 && tops.length === 2 && lefts.length === 2, JSON.stringify(r.cells));
    ok('390x780 — 문서 가로 넘침 0', r.over === 0, r.over + 'px');
    ok('390x780 — 32px 미만 누름 자리 0곳', r.small.length === 0, r.small.slice(0, 6).join(' · '));
    await page.screenshot({ path: path.join(OUT, 'dash_390.png') });
    await page.screenshot({ path: path.join(OUT, 'dash_390_full.png'), fullPage: true });
    await ctx.close();
  }

  // ═══ ③ 숙제를 세는 곳은 하나 — 대시보드 '이번 주 숙제' · 진도 캘린더 그날 머리 · 학생 주간 띠 (fix/dash-plain-2) ═══
  // 한 주에 숙제 셋(반복 숙제 — 수업으로 처리된 몫 섞임 · 클래스5 · 끝난 교재의 단건 기간 숙제) 중 하나를 끝낸 가짜 학생
  {
    EXTRA = true;
    const { ctx, page } = await mk({ width: 1366, height: 900 });
    await page.evaluate(async () => { renderDash(); await new Promise(r => setTimeout(r, 300)); });
    { const el = await page.$('#dash-weekheat'); if (el) await el.screenshot({ path: path.join(OUT, 'dash_weekheat.png') }); }
    const dash = await page.evaluate(async (WEEK) => {
      renderDash(); await new Promise(r => setTimeout(r, 300));
      const tr = [...document.querySelectorAll('#dash-weekheat tbody tr')].find(t => /가람/.test(t.textContent));
      const cells = tr ? [...tr.querySelectorAll('td.pl-td')].map(td => td.textContent.replace(/[^0-9/–]/g, '')) : [];
      // 진도 캘린더 — 그 반 · 그 학생 · 그날 머리 '숙제 n/m'
      swTab('t-class'); await new Promise(r => setTimeout(r, 300));
      openClsDetail('dp-c3'); await new Promise(r => setTimeout(r, 300));
      _pgHwStuId = 'dp-s4';
      const cal = {};
      for (const ds of WEEK) {
        _pgCalMonth = ds.slice(0, 7); renderClsLessons('dp-c3'); await new Promise(r => setTimeout(r, 120));
        const h = document.querySelector('.pg-cal-card .pg-cell[data-ds="' + ds + '"] .pg-hw-head');
        const m = h ? /(\d+)\/(\d+)/.exec(h.textContent) : null;
        cal[ds] = m ? m[1] + '/' + m[2] : '–';
      }
      return { cells, cal };
    }, WEEK);
    await ctx.close();
    const S = await (async () => {
      const c2 = await browser.newContext({ viewport: { width: 390, height: 780 }, locale: 'ko-KR' });
      await c2.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'student', sid: 'dp-s4' })); } catch (e) { } });
      const p2 = await c2.newPage();
      await p2.route('**/rest/v1/**', serve); await p2.route('**/functions/v1/**', r => r.fulfill({ status: 400, contentType: 'application/json', body: '{}' }));
      await p2.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await p2.waitForFunction(() => { try { return (_cache.students || []).length > 0 && !!document.getElementById('stu-hw-card'); } catch (e) { return false; } }, null, { timeout: 120000 });
      await wait(800);
      const out = await p2.evaluate(async (WEEK) => { const o = {}; for (const ds of WEEK) { stuSelectDay(ds); await new Promise(r => setTimeout(r, 80)); const w = window._wkCnt || {}; o[ds] = w.total ? w.done + '/' + w.total : '–'; } return o; }, WEEK);
      await c2.close();
      return out;
    })();
    const rows = WEEK.map((ds, i) => ({ d: DOWS[new Date(ds + 'T12:00:00').getDay()], dash: dash.cells[i] || '?', cal: dash.cal[ds], stu: S[ds] }));
    const same = rows.every(r => r.dash === r.cal && r.cal === r.stu);
    const anyLesson = true;
    ok('이번 주 숙제 숫자 = 진도 캘린더 그날 머리 = 학생 주간 띠 (요일마다)', same && rows.some(r => r.dash !== '–'),
      rows.map(r => r.d + ' ' + r.dash + '·' + r.cal + '·' + r.stu).join(' | '));
    EXTRA = false;
  }

  ok('대시보드에서 생긴 쓰기는 공지 1건뿐 (다른 표 0)', dashWrites === 0, '공지 ' + writes.notices + ' · 대시보드 뒤 그 밖 ' + dashWrites + ' (앱이 뜰 때의 동기화 쓰기는 따로)');
  console.log('\n콘솔 오류 ' + errs.length + '건' + (errs.length ? '\n  ' + errs.slice(0, 5).join('\n  ') : ''));
  ok('콘솔 오류 없음', errs.length === 0);
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_dash_plain 실패:', e); process.exit(1); });
