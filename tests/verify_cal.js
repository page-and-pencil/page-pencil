require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// fix/cal-split — 진도 캘린더: 한 날 칸을 두 층으로 (위=수업 알약, 아래=숙제 체크 줄)
//   [1] 두 층 · 숙제 줄 · '숙제 n/m' · 밀림 · '+n개'  [2] 잡음 줄이기(✕ 는 올렸을 때만, 11px 이상)
//   [3] 머리 줄의 꼴 그림과 늘 보이는 한 줄  [4] 600px 미만 — 점과 '숙 n/m', 그날 창
//   [5] 과제 탭 숙제 캘린더도 같은 숙제 줄 꼴
// 가짜 서버만 쓴다. 실제 서버로는 한 건도 나가지 않는다. 이름·교재는 지어낸 것만.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { pageUrl } = require('./_page');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const fs = require('fs');
const OUT = path.join(__dirname, 'shots', 'cal');
fs.mkdirSync(OUT, { recursive: true });
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };
const note = t => console.log('      · ' + t);

const T = new Date(), pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = ymd(T);
const shift = (ds, d) => { const x = new Date(ds + 'T12:00:00'); x.setDate(x.getDate() + d); return ymd(x); };
const YESTERDAY = shift(today, -1);      // 지난 날 · 안 한 숙제 → '밀림'
const DONE_DAY = shift(today, -3);       // 지난 날 · 다 한 숙제 → ☑ 와 이름
const FUT_DAY = shift(today, 3);         // 앞날 → ☐
const FIVE_DAY = shift(today, 5);        // 숙제 다섯 개인 날 → 줄 셋 + '+2개'
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
const WINDOW = Array.from({ length: 41 }, (_, i) => shift(today, i - 20));   // ±20일

// ── 가짜 자료 (지어낸 이름만) ─────────────────────────────────
const UNITS = Array.from({ length: 30 }, (_, i) => 'Unit ' + (i + 1));
const SNAP = {
  students: [{ id: 'cal-s1', name: '나봄', grade: '초4', cls: 'cal-c1', pin: '0001', fee: 0 }],
  globalClasses: [{
    id: 'cal-c1', name: '보기반 가', active: true, days: DOWS.slice(), studentIds: ['cal-s1'],
    commonMaterials: { reading: { book: '보기 리딩 1', unit: 'Unit 1', bookId: 'cal-tb1' } },
  }],
  globalTextbooks: [{
    id: 'cal-tb1', type: 'textbook', title: '보기 리딩 1', category: '리딩',
    units: Object.fromEntries(UNITS.map(u => [u, [{ word: 'barn', ko: '헛간' }]])),
  }],
  library: [],
  // 지난 날 하나에 수업 기록 — 채운 알약(수업한 것)
  lessons: [{
    id: 'cal-l1', sid: 'cal-s1', classId: 'cal-c1', date: DONE_DAY, att: 'normal', cmt: '',
    materials: { reading: { book: '보기 리딩 1', unit: 'Unit 3', bookId: 'cal-tb1' } },
  }],
  assignments: [
    // 날마다 도는 숙제 둘 — 그제보다 앞은 끝냄, 어제·오늘·앞날은 아직
    {
      id: 'cal-a1', sid: 'cal-s1', category: 'recur', text: '보기 리딩 1 읽기', bookTitle: '보기 리딩 1', bookId: 'cal-tb1',
      date: today, due: FUT_DAY,
      schedule: WINDOW.map((d, i) => ({ date: d, book: '보기 리딩 1', unit: 'Unit ' + (i + 1), done: d < YESTERDAY })),
    },
    {
      id: 'cal-a2', sid: 'cal-s1', category: 'class5', text: '클래스5', bookTitle: '보기 클래스5',
      date: today, due: FUT_DAY,
      schedule: WINDOW.map((d, i) => ({ date: d, book: '보기 클래스5', unit: '과 ' + (i + 1), done: d < YESTERDAY })),
    },
    // 한 날에 숙제 다섯이 되도록 단건 셋
    { id: 'cal-a3', sid: 'cal-s1', category: 'vocab', text: '보기 어휘 1', bookTitle: '보기 어휘 1', range: 'Day 1', due: FIVE_DAY },
    { id: 'cal-a4', sid: 'cal-s1', category: 'grammar', text: '보기 어법 1', bookTitle: '보기 어법 1', range: 'p.10', due: FIVE_DAY },
    { id: 'cal-a5', sid: 'cal-s1', category: 'writing', text: '보기 라이팅 1', bookTitle: '보기 라이팅 1', range: 'p.3', due: FIVE_DAY },
  ],
  tests: [], readings: [], logs: [], vocab_cards: [],
  notices: [], homeworks: [], textbooks: [], messages: [],
  monthlyReports: [], examSchedules: [], counsels: [],
  settings: {},
};

let reqs = { get: 0, write: 0 };
function serve(route) {
  const req = route.request();
  const isWrite = req.method() !== 'GET' && req.method() !== 'HEAD';
  if (isWrite) reqs.write++; else reqs.get++;
  const t = (new URL(req.url()).pathname.split('/rest/v1/')[1] || '').split('?')[0];
  const rows = ({
    students: SNAP.students, classes: SNAP.globalClasses, global_textbooks: SNAP.globalTextbooks,
    lessons: SNAP.lessons, assignments: SNAP.assignments, tests: SNAP.tests, logs: SNAP.logs,
    vocab_cards: SNAP.vocab_cards, readings: SNAP.readings, library: SNAP.library,
  })[t] || [];
  return route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(isWrite ? [] : rows.map(d => ({ id: d.id, sid: d.sid || null, data: d, updated_at: '2026-11-13T00:00:00.000Z' }))),
  });
}

const errs = [];
async function makePage(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  await page.route('**/rest/v1/**', serve);
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false,"server":false}' }));
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  await page.goto(pageUrl(null, null, true), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => (typeof _cache !== 'undefined') && (_cache.students || []).length > 0, null, { timeout: 60000 }).catch(() => { });
  await wait(1300);
  return { ctx, page };
}
// 달력을 그 날짜의 달로 연다
const openCal = async (page, ds) => page.evaluate(async (d) => {
  swTab('t-class'); await new Promise(r => setTimeout(r, 500));
  openClsDetail('cal-c1'); await new Promise(r => setTimeout(r, 500));
  _pgCalMonth = d.slice(0, 7); renderClsLessons('cal-c1');
  await new Promise(r => setTimeout(r, 700));
}, ds);

// 글자 대비 (fix/ux-3 와 같은 자)
const CONTRAST = (sel) => {
  const L = c => { const f = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
  const parse = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(',').map(x => parseFloat(x)); return { c: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }; };
  const over = (fg, bg) => fg.c.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
  const bgOf = el => {
    const layers = []; let n = el;
    while (n && n.nodeType === 1) {
      const st = getComputedStyle(n); const b = parse(st.backgroundColor);
      if (b && b.a > 0.02) { layers.push(b); if (b.a >= 0.999) break; }
      n = n.parentElement;
    }
    let base = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  const root = document.querySelector(sel) || document.body;
  const bad = [], small = []; let seen = 0;
  root.querySelectorAll('*').forEach(el => {
    const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    if (!t || !/[0-9A-Za-z가-힣]/.test(t)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') return;
    let p = el, dim = false;
    while (p && p.nodeType === 1) { if (+getComputedStyle(p).opacity < 0.75) { dim = true; break; } p = p.parentElement; }
    if (dim) return;
    const fs = parseFloat(st.fontSize);
    if (fs < 11) small.push({ t: t.slice(0, 18), fs, cls: (el.className || '').toString().slice(0, 26) });
    const fg = parse(st.color); if (!fg) return;
    const bg = bgOf(el);
    const col = over(fg, bg);
    const l1 = L(col), l2 = L(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    seen++;
    if (ratio < 4.5) bad.push({ t: t.slice(0, 20), r: Math.round(ratio * 100) / 100, c: st.color, b: 'rgb(' + bg.map(Math.round).join(',') + ')', cls: (el.className || '').toString().slice(0, 26) });
  });
  return { seen, bad: bad.slice(0, 10), n: bad.length, small: small.slice(0, 10), sn: small.length };
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  // ═══ ① 1366px — 두 층 · 꼴 가르기 ═══
  {
    const { ctx, page } = await makePage(browser, { width: 1366, height: 900 });
    await openCal(page, today);
    const r = await page.evaluate((o) => {
      const cell = ds => document.querySelector('.pg-cal-card .pg-cell[data-ds="' + ds + '"]');
      const box = e => { const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width) }; };
      // 수업·숙제가 함께 있는 날
      const c = cell(o.done);
      const les = [...c.querySelectorAll('.pg-lay-les .pg-chip')].map(box);
      const rows = [...c.querySelectorAll('.pg-hw-row')].map(box);
      const head = (c.querySelector('.pg-hw-head') || {}).innerText || '';
      // 숙제 줄의 바탕·테두리 (채운 알약과 달라야 한다)
      const r0 = c.querySelector('.pg-hw-row'), p0 = c.querySelector('.pg-lay-les .pg-chip.rec') || c.querySelector('.pg-lay-les .pg-chip');
      const sr = r0 ? getComputedStyle(r0) : null, sp = p0 ? getComputedStyle(p0) : null;
      // 이름 없는 작은 칩이 남아 있는지
      const tiny = [...document.querySelectorAll('.pg-cal-card .pg-chip,.pg-cal-card .pg-hw-row')]
        .filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.width < 40 && e.textContent.replace(/[✓✕☐☑·\s]/g, '') === ''; }).length;
      return {
        lesN: les.length, rowN: rows.length, head,
        order: les.length && rows.length ? Math.max(...les.map(x => x.b)) <= Math.min(...rows.map(x => x.t)) + 1 : null,
        rowBg: sr && sr.backgroundColor, rowBl: sr && (sr.borderLeftWidth + ' ' + sr.borderLeftStyle),
        // fix/no-leftbar: 영역 색은 체크 네모가 맡는다
        ckBd: (() => { const k = r0 && r0.querySelector('.pg-ck'); if (!k) return ''; const q = getComputedStyle(k); return q.borderTopWidth + ' ' + q.borderTopStyle; })(),
        chipBg: sp && sp.backgroundColor, chipBorder: sp && (sp.borderLeftWidth + ' ' + sp.borderLeftStyle),
        chipCls: p0 && p0.className, tiny,
        ck: [...c.querySelectorAll('.pg-hw-row .pg-ck')].map(e => e.dataset.ck),
        names: [...c.querySelectorAll('.pg-hw-row .pg-hw-t')].map(e => e.textContent.trim()),
      };
    }, { done: DONE_DAY });
    ok('[1] 수업 칩이 모두 숙제 줄보다 위', r.order === true, '수업 ' + r.lesN + '개 · 숙제 ' + r.rowN + '줄');
    ok('[1] 숙제 줄에 채운 바탕이 없다 (옅은 바탕 + 영역 색 체크 네모, 왼쪽 띠 없음)',
      !!r.rowBg && r.rowBg !== r.chipBg && /^0px|none/.test(r.rowBl) && /^1(\.5)?px solid/.test(r.ckBd),
      '줄 바탕 ' + r.rowBg + ' · 왼쪽 ' + r.rowBl + ' · 체크 네모 ' + r.ckBd + ' / 칩 바탕 ' + r.chipBg);
    ok('[1] 같은 자리에서 진도 칩과 숙제 줄의 꼴이 다르다', r.chipBg !== r.rowBg || r.chipBorder !== r.rowBl,
      '칩 ' + r.chipCls + ' ' + r.chipBg + ' / 줄 ' + r.rowBg);
    ok('[1] 끝난 숙제도 이름을 그대로 적는다 (☑ · 이름 없는 작은 알약 0개)',
      r.tiny === 0 && r.ck.every(x => x === '☑') && r.names.every(n => n.length > 1),
      '체크 ' + r.ck.join('') + ' · 이름 ' + r.names.join(' / ') + ' · 작은 알약 ' + r.tiny + '개');
    ok("[1] 머리 '숙제 2/2'", /숙제\s*2\/2/.test(r.head.replace(/숙\s*/, '숙제 ')) || /2\/2/.test(r.head), '"' + r.head.trim() + '"');
    const calEl = await page.$('.pg-cal-card');
    if (calEl) await calEl.screenshot({ path: path.join(OUT, 'cal_month_1366.png') }).catch(() => { });
    const cellShot = await page.$('.pg-cal-card .pg-cell[data-ds="' + FIVE_DAY + '"]');
    if (cellShot) await cellShot.screenshot({ path: path.join(OUT, 'cal_cell_1366.png') }).catch(() => { });

    // 지난 날 미완 → 밀림 / 앞날 → ☐
    const r2 = await page.evaluate((o) => {
      const cell = ds => document.querySelector('.pg-cal-card .pg-cell[data-ds="' + ds + '"]');
      const read = ds => {
        const c = cell(ds); if (!c) return null;
        return { head: ((c.querySelector('.pg-hw-head') || {}).innerText || '').trim(),
          late: !!c.querySelector('.pg-hw-head.late'),
          ck: [...c.querySelectorAll('.pg-hw-row .pg-ck')].map(e => e.dataset.ck),
          names: [...c.querySelectorAll('.pg-hw-row .pg-hw-t')].map(e => e.textContent.trim()) };
      };
      return { y: read(o.y), f: read(o.f) };
    }, { y: YESTERDAY, f: FUT_DAY });
    ok("[1] 지난 날 미완은 '밀림' 과 경고색", !!r2.y && r2.y.late && /밀림/.test(r2.y.head) && /0\/2/.test(r2.y.head),
      r2.y ? '"' + r2.y.head + '"' : '칸 없음');
    ok('[1] 앞날 숙제 줄에 ☐', !!r2.f && r2.f.ck.length > 0 && r2.f.ck.every(x => x === '☐'),
      r2.f ? (r2.f.ck.join('') + ' · ' + r2.f.names.join(' / ')) : '칸 없음');

    // 다섯 개인 날 → 줄 셋 + '+2개' → 그날 창에 다섯
    const r3 = await page.evaluate(async (ds) => {
      const c = document.querySelector('.pg-cal-card .pg-cell[data-ds="' + ds + '"]');
      const rows = c.querySelectorAll('.pg-hw-row').length;
      const more = (c.querySelector('.pg-hw-more') || {}).textContent || '';
      c.querySelector('.pg-hw-more').click();
      await new Promise(r => setTimeout(r, 400));
      const sheet = document.getElementById('pg-daysheet');
      const out = { rows, more, sheet: !!sheet,
        sheetRows: sheet ? sheet.querySelectorAll('.pg-hw-row').length : 0,
        groups: sheet ? [...sheet.querySelectorAll('.pg-sheet-g>b')].map(b => b.textContent) : [] };
      if (sheet) pgDaySheetClose();
      return out;
    }, FIVE_DAY);
    ok("[1] 숙제 다섯인 날은 줄 셋 + '+2개'", r3.rows === 3 && /\+2개/.test(r3.more), '줄 ' + r3.rows + ' · "' + r3.more + '"');
    ok('[1] 그날 창에 다섯이 다 나온다', r3.sheet && r3.sheetRows === 5 && r3.groups.join(',') === '수업,숙제',
      '창 줄 ' + r3.sheetRows + '개 · 묶음 ' + r3.groups.join('·'));

    // 숙제 줄을 누르면 완료가 바뀐다 (가짜 서버 쓰기 1건)
    const before = reqs.write;
    const r4 = await page.evaluate(async (ds) => {
      const c = document.querySelector('.pg-cal-card .pg-cell[data-ds="' + ds + '"]');
      const row = c.querySelector('.pg-hw-row');
      const was = row.querySelector('.pg-ck').dataset.ck;
      row.click();
      await new Promise(r => setTimeout(r, 900));
      const c2 = document.querySelector('.pg-cal-card .pg-cell[data-ds="' + ds + '"]');
      return { was, now: c2.querySelector('.pg-hw-row .pg-ck').dataset.ck, head: (c2.querySelector('.pg-hw-head') || {}).textContent.trim() };
    }, FUT_DAY);
    await wait(400);
    ok('[1] 숙제 줄을 누르면 완료가 바뀐다 (서버 쓰기 1건)',
      r4.was === '☐' && r4.now === '☑' && reqs.write - before === 1,
      r4.was + ' → ' + r4.now + ' · 머리 "' + r4.head + '" · 쓰기 ' + (reqs.write - before) + '건');

    // 레이어 단추 셋이 각각 제 층만 숨긴다
    const r5 = await page.evaluate(async () => {
      const n = () => ({ les: document.querySelectorAll('.pg-cal-card .pg-lay-les .pg-chip').length,
        hw: document.querySelectorAll('.pg-cal-card .pg-hw-row').length,
        c5: [...document.querySelectorAll('.pg-cal-card .pg-hw-row .pg-hw-t')].filter(e => /과 \d/.test(e.textContent)).length });
      const base = n();
      pgLayerToggle('prog', 'cal-c1'); await new Promise(r => setTimeout(r, 500));
      const noProg = n();
      pgLayerToggle('prog', 'cal-c1'); pgLayerToggle('hw', 'cal-c1'); await new Promise(r => setTimeout(r, 500));
      const noHw = n();
      pgLayerToggle('hw', 'cal-c1'); pgLayerToggle('c5', 'cal-c1'); await new Promise(r => setTimeout(r, 500));
      const noC5 = n();
      pgLayerToggle('c5', 'cal-c1'); await new Promise(r => setTimeout(r, 500));
      return { base, noProg, noHw, noC5, back: n() };
    });
    ok('[3] 켜고 끄는 단추 셋이 각각 제 층만 숨긴다',
      r5.noProg.les === 0 && r5.noProg.hw > 0 && r5.noHw.hw < r5.base.hw && r5.noHw.les > 0 &&
      r5.noC5.c5 === 0 && r5.noC5.hw > 0 && r5.back.les === r5.base.les && r5.back.hw === r5.base.hw,
      '전부 ' + JSON.stringify(r5.base) + ' · 진도끔 ' + JSON.stringify(r5.noProg) + ' · 숙제끔 ' + JSON.stringify(r5.noHw) + ' · 클5끔 ' + JSON.stringify(r5.noC5));

    // [3] 늘 보이는 한 줄 · 꼴 그림
    const r6 = await page.evaluate(() => {
      const k = document.querySelector('.pg-cal-card .pg-key-line');
      return { txt: k ? k.innerText.replace(/\s+/g, ' ').trim() : '',
        sw: k ? k.querySelectorAll('.pp-sw,.pg-ly-sw,svg.pg-hwsw').length : 0,   // (fix/ux-5) 숙제 그림은 체크 네모와 줄 svg
        lyIco: [...document.querySelectorAll('.pg-ly-b .pg-ly-sw,.pg-ly-b svg.pg-hwsw')].length,
        emoji: [...document.querySelectorAll('.pg-ly-b')].filter(b => /[📘📕🎮]/.test(b.textContent)).length };
    });
    ok('[3] 늘 보이는 한 줄 (채운 알약 · 점선 알약 · 체크 줄)',
      /채운 알약 = 수업한 것/.test(r6.txt) && /점선 알약 = 수업 예정/.test(r6.txt) && /체크 줄 = 숙제/.test(r6.txt) && r6.sw === 3,
      '"' + r6.txt + '"');
    ok('[3] 켜고 끄는 단추의 그림이 꼴 그대로', r6.lyIco === 3 && r6.emoji === 0, '꼴 그림 ' + r6.lyIco + '개 · 남은 그림 문자 ' + r6.emoji + '개');

    // [2] 글자 크기·대비 · ✕ 는 올렸을 때만
    const c1 = await page.evaluate(fn => eval('(' + fn + ')')('.pg-cal-card'), CONTRAST.toString());
    ok('[2] 달력 글자 11px 미만 0곳', c1.sn === 0, '본 글자 ' + c1.seen + '곳 · 작은 글자 ' + c1.sn + '곳');
    c1.small.forEach(b => note(b.fs + 'px — "' + b.t + '" [' + b.cls + ']'));
    ok('[2] 달력 대비 4.5 미만 0곳', c1.n === 0, '미만 ' + c1.n + '곳');
    c1.bad.forEach(b => note('대비 ' + b.r + ' — "' + b.t + '" ' + b.c + ' / ' + b.b + ' [' + b.cls + ']'));
    const r7 = await page.evaluate(() => {
      const x = document.querySelector('.pg-cal-card .pg-hw-row .pg-x') || document.querySelector('.pg-cal-card .pg-chip .pg-x');
      return { op: x ? +getComputedStyle(x).opacity : null,
        past: getComputedStyle(document.querySelector('.pg-cell.past') || document.body).opacity };
    });
    ok('[2] ✕ 는 올렸을 때만 보인다', r7.op === 0, '기본 불투명도 ' + r7.op);
    ok('[2] 지난 날 칸에 겹친 불투명도가 없다', r7.past === '1', '불투명도 ' + r7.past);
    await ctx.close();
  }

  // ═══ ② 390px — 칸에는 글이 없다 · 그날 창 ═══
  {
    const { ctx, page } = await makePage(browser, { width: 390, height: 780 });
    await openCal(page, today);
    const r = await page.evaluate(async (o) => {
      const cells = [...document.querySelectorAll('.pg-cal-card .pg-cell')];
      const vis = el => !!el.offsetParent;
      const chipTxt = cells.reduce((a, c) => a + [...c.querySelectorAll('.pg-chip')].filter(vis).length, 0);
      const rowTxt = cells.reduce((a, c) => a + [...c.querySelectorAll('.pg-hw-row')].filter(vis).length, 0);
      const dots = cells.reduce((a, c) => a + [...c.querySelectorAll('.pg-dot')].filter(vis).length, 0);
      const head = (document.querySelector('.pg-cell[data-ds="' + o.done + '"] .pg-hw-head') || {}).innerText || '';
      const maxDots = Math.max(...cells.map(c => [...c.querySelectorAll('.pg-dot')].filter(vis).length));
      // 날을 누르면 그날 창
      document.querySelector('.pg-cell[data-ds="' + o.five + '"]').click();
      await new Promise(r => setTimeout(r, 450));
      const sh = document.getElementById('pg-daysheet');
      const out = { chipTxt, rowTxt, dots, maxDots, head: head.replace(/\s+/g, ' ').trim(),
        sheet: !!sh, groups: sh ? [...sh.querySelectorAll('.pg-sheet-g>b')].map(b => b.textContent) : [],
        sheetRows: sh ? sh.querySelectorAll('.pg-hw-row').length : 0,
        sheetLes: sh ? sh.querySelectorAll('.pg-sheet-les .pg-chip').length : 0,
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      return out;
    }, { done: DONE_DAY, five: FIVE_DAY });
    ok('[4] 390px — 칸 안에 글자 칩·줄 0개', r.chipTxt === 0 && r.rowTxt === 0, '칩 ' + r.chipTxt + ' · 줄 ' + r.rowTxt);
    ok('[4] 390px — 수업은 영역 색 점(최대 넷)', r.dots > 0 && r.maxDots <= 4, '점 ' + r.dots + '개 · 한 칸 최대 ' + r.maxDots);
    ok("[4] 390px — 숙제는 '숙 n/m' 만", /^숙\s*\d+\/\d+/.test(r.head), '"' + r.head + '"');
    ok('[4] 390px — 날을 누르면 그날 창에 두 묶음', r.sheet && r.groups.join(',') === '수업,숙제' && r.sheetRows === 5 && r.sheetLes > 0,
      '숙제 ' + r.sheetRows + '줄 · 수업 ' + r.sheetLes + '개');
    ok('[4] 390px — 가로 넘침 0', r.over === 0, r.over + 'px');
    await page.screenshot({ path: path.join(OUT, 'cal_sheet_390.png') }).catch(() => { });
    await page.evaluate(() => pgDaySheetClose());
    await wait(300);
    const calEl2 = await page.$('.pg-cal-card');
    if (calEl2) await calEl2.screenshot({ path: path.join(OUT, 'cal_month_390.png') }).catch(() => { });
    const c2 = await page.evaluate(fn => eval('(' + fn + ')')('.pg-cal-card'), CONTRAST.toString());
    ok('[2] 390px 달력 — 11px 미만 0곳 · 대비 4.5 미만 0곳', c2.sn === 0 && c2.n === 0,
      '본 글자 ' + c2.seen + '곳 · 작은 ' + c2.sn + ' · 대비 미만 ' + c2.n);
    c2.small.forEach(b => note(b.fs + 'px — "' + b.t + '" [' + b.cls + ']'));
    c2.bad.forEach(b => note('대비 ' + b.r + ' — "' + b.t + '" [' + b.cls + ']'));
    await ctx.close();
  }

  // ═══ ③ 과제 탭 숙제 캘린더도 같은 숙제 줄 꼴 ═══
  {
    const { ctx, page } = await makePage(browser, { width: 1366, height: 900 });
    const r = await page.evaluate(async () => {
      swTab('t-assign'); await new Promise(r => setTimeout(r, 1200));
      const cells = [...document.querySelectorAll('#assign-cal .pg-cell')];
      const rows = document.querySelectorAll('#assign-cal .pg-hw-row').length;
      const heads = document.querySelectorAll('#assign-cal .pg-hw-head').length;
      const oldChips = document.querySelectorAll('#assign-cal .pg-chip.pg-hw,#assign-cal .pg-chip.hw-done').length;
      const r0 = document.querySelector('#assign-cal .pg-hw-row');
      const st = r0 ? getComputedStyle(r0) : null;
      return { cells: cells.length, rows, heads, oldChips,
        bl: st ? st.borderLeftWidth + ' ' + st.borderLeftStyle : '', bg: st ? st.backgroundColor : '',
        ckBd: (() => { const k = r0 && r0.querySelector('.pg-ck'); if (!k) return ''; const q = getComputedStyle(k); return q.borderTopWidth + ' ' + q.borderTopStyle; })(),
        ck: r0 ? r0.querySelector('.pg-ck').dataset.ck : '' };
    });
    ok('[5] 과제 탭 숙제 캘린더도 체크 줄 꼴', r.rows > 0 && r.heads > 0 && r.oldChips === 0,
      '줄 ' + r.rows + '개 · 머리 ' + r.heads + '개 · 옛 숙제 칩 ' + r.oldChips + '개');
    ok('[5] 과제 탭 줄도 같은 꼴 — 옅은 바탕 + 영역 색 체크 네모 (왼쪽 띠 없음)', /^0px|none/.test(r.bl) && /^1(\.5)?px (solid|dashed)/.test(r.ckBd),
      '왼쪽 ' + r.bl + ' · 바탕 ' + r.bg + ' · 체크 네모 ' + r.ckBd + ' · ' + r.ck);
    const c3 = await page.evaluate(fn => eval('(' + fn + ')')('#assign-cal'), CONTRAST.toString());
    ok('[2] 숙제 캘린더 — 11px 미만 0곳 · 대비 4.5 미만 0곳', c3.sn === 0 && c3.n === 0,
      '본 글자 ' + c3.seen + '곳 · 작은 ' + c3.sn + ' · 대비 미만 ' + c3.n);
    c3.small.forEach(b => note(b.fs + 'px — "' + b.t + '" [' + b.cls + ']'));
    c3.bad.forEach(b => note('대비 ' + b.r + ' — "' + b.t + '" [' + b.cls + ']'));
    const acEl = await page.$('#assign-cal');
    if (acEl) await acEl.screenshot({ path: path.join(OUT, 'assigncal_1366.png') }).catch(() => { });
    await ctx.close();
  }

  await browser.close();
  ok('콘솔 오류 0건', errs.length === 0, errs.slice(0, 4).join(' | '));
  console.log('\n가짜 서버가 받은 요청: 읽기 ' + reqs.get + '건 · 쓰기 ' + reqs.write + '건 (실제 서버로는 0건)');
  console.log('그림: ' + OUT);
  console.log('\n' + pass.length + '/' + (pass.length + fail.length) + ' 통과');
  if (fail.length) { console.log('실패:\n - ' + fail.join('\n - ')); process.exit(1); }
})().catch(e => { console.error('실패:', e); process.exit(1); });
