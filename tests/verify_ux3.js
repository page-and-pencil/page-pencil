require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// fix/ux-3 — 선생님 화면 정리
//   [1] 대시보드 순서(오늘의 수업·바로 할 일이 맨 위 · '새로 생긴 것' 은 맨 아래 접힌 한 줄)
//   [2] 교재·문제 하위 탭 두 줄(자료·만들기·관리) [3] 설정 묶음 셋 [4] 과제 표 한 격자·같은 이름 가르기
//   [5] 820px 이하 수업 기록 [6] 폰 위 메뉴 띠·도장 챌린지 띠 [7] 누름 자리 36px
//   [8] 단원 칸 190px [9] 글자 대비 4.5 [10] 체험 모드 띠
// 가짜 서버만 쓴다. 실제 서버로는 한 건도 나가지 않는다. 이름·교재는 지어낸 것만.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { pageUrl } = require('./_page');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const fs = require('fs');
const OUT = path.join(__dirname, 'shots', 'ux3');   // 그림은 tests/shots/ 아래 (저장소에 넣지 않는다)
fs.mkdirSync(OUT, { recursive: true });
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };
const note = t => console.log('      · ' + t);

const T = new Date(), pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = ymd(T);
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
const DOW = DOWS[T.getDay()];                       // 오늘 요일 — 보기반 가의 수업일
const DOW2 = DOWS[(T.getDay() + 1) % 7];            // 내일 요일 — '다음 수업' 이 나오는 반
const shift = (ds, d) => { const x = new Date(ds + 'T12:00:00'); x.setDate(x.getDate() + d); return ymd(x); };
const UNIT21 = 'Unit 4 On the Weekend';             // 21자 — 전에는 152px 칸에서 잘렸다

// ── 가짜 자료 (지어낸 이름만) ─────────────────────────────────
const SNAP = {
  students: [
    { id: 'ux3-s1', name: '나봄', grade: '초4', cls: 'ux3-c1', pin: '0001', fee: 200000,
      hwChallenge: { goal: 20, reward: '작은 선물', start: shift(today, -10), createdAt: shift(today, -10) } },
    { id: 'ux3-s2', name: '이든', grade: '초5', cls: 'ux3-c1', pin: '0002', fee: 200000 },
    { id: 'ux3-s3', name: '하루', grade: '중1', cls: 'ux3-c2', pin: '0003', fee: 0 },
  ],
  globalClasses: [
    { id: 'ux3-c1', name: '보기반 가', active: true, days: [DOW], times: { [DOW]: { start: '15:00', end: '16:30' } },
      studentIds: ['ux3-s1', 'ux3-s2'],
      commonMaterials: { reading: { book: '보기 리딩 1', unit: UNIT21, bookId: 'ux3-tb1' } } },
    { id: 'ux3-c2', name: '보기반 나', active: true, days: [DOW2], studentIds: ['ux3-s3'], commonMaterials: {} },
  ],
  globalTextbooks: [
    { id: 'ux3-tb1', type: 'textbook', title: '보기 리딩 1', category: '리딩',
      units: { [UNIT21]: [{ word: 'barn', ko: '헛간' }], 'Unit 5 At the Park': [{ word: 'swing', ko: '그네' }] } },
    { id: 'ux3-tb2', type: 'textbook', title: '보기 어휘 1', category: '어휘', units: { 'Day 1': [{ word: 'apple', ko: '사과' }] } },
  ],
  library: [{ id: 'ux3-lb1', title: '보기 원서 하나', series: '보기 시리즈', arLevel: '1.2' }],
  lessons: [
    { id: 'ux3-l1', sid: 'ux3-s1', classId: 'ux3-c1', date: shift(today, -7), att: 'normal', cmt: '잘했어요',
      materials: { reading: { book: '보기 리딩 1', unit: 'Unit 3' } } },
    { id: 'ux3-l2', sid: 'ux3-s2', classId: 'ux3-c1', date: shift(today, -7), att: 'normal', cmt: '', materials: {} },
  ],
  assignments: [
    // 이름이 같은 과제 둘 — 작은 글(기간)로 갈라져야 한다
    { id: 'ux3-a1', sid: 'ux3-s1', category: 'class5', text: '클래스5', date: shift(today, -8), due: shift(today, 20),
      schedule: Array.from({ length: 6 }, (_, i) => ({ date: shift(today, -8 + i * 4), book: '클래스5', unit: '과 ' + (i + 1), done: i < 2 })) },
    { id: 'ux3-a2', sid: 'ux3-s1', category: 'class5', text: '클래스5', date: shift(today, -2), due: shift(today, 40),
      schedule: Array.from({ length: 6 }, (_, i) => ({ date: shift(today, -2 + i * 7), book: '클래스5', unit: '과 ' + (i + 1), done: i < 1 })) },
    { id: 'ux3-a3', sid: 'ux3-s2', category: 'recur', text: '보기 리딩 1 읽기', bookTitle: '보기 리딩 1', bookId: 'ux3-tb1',
      date: today, due: shift(today, 14), schedule: Array.from({ length: 5 }, (_, i) => ({ date: shift(today, i), book: '보기 리딩 1', unit: 'Unit ' + (i + 4) })) },
  ],
  tests: [{ id: 'ux3-t1', sid: 'ux3-s1', date: shift(today, -5), vocabCorrect: 16, vocabTotal: 20 }],
  readings: [{ id: 'ux3-r1', sid: 'ux3-s1', title: '보기 원서 하나', date: shift(today, -3), arLevel: '1.2', read: true }],
  logs: [{ id: 'ux3-g1', sid: 'ux3-s1', date: shift(today, -3), bookTitle: '보기 원서 하나', read: true }],
  vocab_cards: Array.from({ length: 6 }, (_, i) => ({
    id: 'ux3-v' + i, sid: 'ux3-s1', word: 'word' + i, meaning: '보기 뜻', pos: 'n',
    addedDate: shift(today, -4), lastSeen: today, hits: 1, misses: 0 })),
  notices: [{ id: 'ux3-n1', text: '보기 공지 내용입니다', date: today, target: 'all', from: today, until: shift(today, 7) }],
  homeworks: [{ id: 'ux3-h1', sid: 'ux3-s1', date: shift(today, -1), submitted: true, checked: false, title: '보기 숙제' }],
  textbooks: [], messages: [], monthlyReports: [], examSchedules: [], counsels: [],
  settings: { acct: { name: '보기 학원' } },
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
    notices: SNAP.notices, homeworks: SNAP.homeworks,
  })[t] || [];
  return route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(isWrite ? [] : rows.map(d => ({ id: d.id, sid: d.sid || null, data: d, updated_at: '2026-11-13T00:00:00.000Z' }))),
  });
}

const errs = [];
async function makePage(browser, sess, vp) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR' });
  await ctx.addInitScript(s => { try { localStorage.setItem('pp_session', JSON.stringify(s)); } catch (e) { } }, sess);
  const page = await ctx.newPage();
  await page.route('**/rest/v1/**', serve);
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false,"server":false}' }));
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  await page.goto(pageUrl(null, null, true), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => (typeof _cache !== 'undefined') && (_cache.students || []).length > 0, null, { timeout: 60000 }).catch(() => { });
  await wait(1300);
  return { ctx, page };
}

// ── 글자 대비 — 보이는 글자마다 글자색:바탕색 비 (그림 문자·꺼진 것·일부러 흐린 것 제외) ──
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
  const bad = []; let seen = 0;
  root.querySelectorAll('*').forEach(el => {
    const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    if (!t || !/[0-9A-Za-z가-힣]/.test(t)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') return;
    if (el.closest('[data-pp-lim-off]')) return;
    if (el.closest('button:disabled,input:disabled,[disabled]')) return;
    let p = el, dim = false;
    while (p && p.nodeType === 1) { if (+getComputedStyle(p).opacity < 0.75) { dim = true; break; } p = p.parentElement; }
    if (dim) return;
    const fg = parse(st.color); if (!fg) return;
    const bg = bgOf(el);
    const col = over(fg, bg);
    const l1 = L(col), l2 = L(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    seen++;
    if (ratio < 4.5) bad.push({ t: t.slice(0, 22), r: Math.round(ratio * 100) / 100, c: st.color, b: 'rgb(' + bg.map(Math.round).join(',') + ')', cls: (el.className || '').toString().slice(0, 28) });
  });
  return { seen, bad: bad.slice(0, 12), n: bad.length };
};

// ── 낱말이 줄 사이에서 꺾였는지 — 낱말마다 글자들의 윗자리를 본다 ──
const NOBREAK = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return { found: false, broken: [], lines: [] };
  const rng = document.createRange(), broken = [], chars = [];
  const walk = n => [...n.childNodes].forEach(c => {
    if (c.nodeType === 3) {
      const txt = c.textContent; let i = 0;
      txt.split(/(\s+)/).forEach(tok => {
        if (tok.trim()) {
          const tops = new Set();
          for (let k = 0; k < tok.length; k++) {
            rng.setStart(c, i + k); rng.setEnd(c, i + k + 1);
            const b = rng.getBoundingClientRect();
            tops.add(Math.round(b.top)); chars.push({ y: Math.round(b.top), ch: tok[k] });
          }
          if (tops.size > 1) broken.push(tok);
        }
        i += tok.length;
      });
    } else if (c.nodeType === 1) walk(c);
  });
  walk(el);
  const byY = {}; chars.forEach(x => { (byY[x.y] = byY[x.y] || []).push(x.ch); });
  return { found: true, broken, lines: Object.keys(byY).sort((a, b) => a - b).map(k => byY[k].join('')) };
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  // ═══ ① 대시보드 1366x800 — 순서 · 새로 생긴 것 · 대비 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'teacher' }, { width: 1366, height: 800 });
    const r = await page.evaluate(async () => {
      swTab('t-dash'); await new Promise(r => setTimeout(r, 900));
      const box = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: Math.round(b.top + window.scrollY), l: Math.round(b.left), w: Math.round(b.width), vis: b.top >= 0 && b.top < window.innerHeight }; };
      const fold = document.getElementById('wn-fold');
      return {
        // feat/dash-plain: 카드 상자 대신 구역 제목 줄(.pl-sec-h)
        today: box('#dash-today .pl-sec-h'), act: box('#dash-actions .pl-sec-h'),
        mon: box('#dash-monthly .pl-sec-h'), heat: box('#dash-weekheat .pl-sec-h'),
        wn: box('#dash-whatsnew details'),
        wnOpen: !!(fold && fold.open), wnTxt: (document.getElementById('dash-whatsnew') || {}).innerText || '',
        wnRows: document.querySelectorAll('#dash-whatsnew .wn-row').length,
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    ok('[1] 숫자 카드 아래 첫 줄에 오늘의 수업(왼쪽 넓게)과 바로 할 일(오른쪽)',
      !!(r.today && r.act) && Math.abs(r.today.t - r.act.t) <= 2 && r.today.l < r.act.l && r.today.w > r.act.w,
      '오늘 ' + (r.today && r.today.t) + 'px·' + (r.today && r.today.w) + '폭 / 할 일 ' + (r.act && r.act.t) + 'px·' + (r.act && r.act.w) + '폭');
    ok('[1] 첫 줄이 스크롤 없이 화면 안', !!(r.today && r.today.vis && r.act && r.act.vis),
      '머리 ' + (r.today && r.today.t) + 'px (화면 800px)');
    // feat/dash-plain [11]: 둘째 줄이 이번 주 숙제·반별 진도, 그 아래 이번 달 현황
    ok('[1] 그 아래 이번 주 숙제 · 이번 달 현황', !!(r.mon && r.heat) && r.heat.t > r.today.t && r.mon.t > r.heat.t,
      '이번 주 ' + (r.heat && r.heat.t) + ' < 현황 ' + (r.mon && r.mon.t));
    // (접힌 details 안의 줄도 DOM 에는 있다 — 접혔는지는 open 으로만 본다)
    ok("[1] '새로 생긴 것' 은 맨 아래 · 접힌 채로", !!r.wn && r.wn.t > r.mon.t && r.wnOpen === false,
      '머리 ' + (r.wn && r.wn.t) + 'px (이번 주 ' + (r.heat && r.heat.t) + 'px 아래) · 펼침 ' + r.wnOpen + ' · DOM 줄 ' + r.wnRows + '개');
    ok("[1] 접힌 줄은 '새로 생긴 것 n개 [펼치기] [모두 확인]'",
      /새로 생긴 것/.test(r.wnTxt) && /\d+개/.test(r.wnTxt) && /펼치기/.test(r.wnTxt) && /모두 확인/.test(r.wnTxt),
      '"' + r.wnTxt.replace(/\n/g, ' ') + '"');
    ok('[1] 대시보드 가로 넘침 0', r.over === 0, r.over + 'px');
    await page.screenshot({ path: path.join(OUT, 'dash_1366.png') }).catch(() => { });

    // 펼치면 목록이 나오고 [모두 확인] 이 듣는다
    const r2 = await page.evaluate(async () => {
      const f = document.getElementById('wn-fold');
      f.open = true; f.dispatchEvent(new Event('toggle'));
      await new Promise(r => setTimeout(r, 250));
      const rows = document.querySelectorAll('#dash-whatsnew .wn-row').length;
      const lbl = (document.querySelector('#dash-whatsnew .wn-sum-o') || {}).textContent || '';
      document.querySelector('#dash-whatsnew .wn-all').click();
      await new Promise(r => setTimeout(r, 350));
      return { rows, lbl, after: (document.getElementById('dash-whatsnew') || {}).innerHTML.length };
    });
    ok("[1] 펼치면 목록이 나온다 ('접기' 로 바뀜)", r2.rows > 0 && r2.lbl === '접기', '줄 ' + r2.rows + '개 · 라벨 "' + r2.lbl + '"');
    ok('[1] [모두 확인] 을 누르면 줄이 사라진다', r2.after === 0, '남은 길이 ' + r2.after);

    // 대비 — 대시보드
    const c1 = await page.evaluate(async fn => { renderWhatsNew(); await new Promise(r => setTimeout(r, 200)); return eval('(' + fn + ')')('#t-dash'); }, CONTRAST.toString());
    ok('[9] 대시보드 — 대비 4.5 미만 0곳', c1.n === 0, '본 글자 ' + c1.seen + '곳 · 미만 ' + c1.n + '곳');
    c1.bad.forEach(b => note('대비 ' + b.r + ' — "' + b.t + '" ' + b.c + ' / ' + b.b + ' [' + b.cls + ']'));

    // 수업이 없는 날 — '오늘 수업 없음' 과 다음 수업
    const r3 = await page.evaluate(async (d2) => {
      _cache.globalClasses.forEach(c => { c.days = [d2]; c.extraDates = []; });   // 오늘은 수업 없음, 내일 있음
      renderDash(); await new Promise(r => setTimeout(r, 600));
      // feat/dash-plain: '오늘 수업 없음 · 다음 수업' 은 머리 요약 줄(#dash-sum)로 옮겼다
      return { stat: (document.getElementById('dash-sum') || {}).innerText || '',
               card: (document.getElementById('dash-today') || {}).innerText || '' };
    }, DOW2);
    ok("[1] 수업 없는 날 머리 요약이 '없음' 과 다음 수업을 보인다",
      /없음/.test(r3.stat) && /다음 수업/.test(r3.stat) && /보기반/.test(r3.stat), '"' + r3.stat.replace(/\n/g, ' ') + '"');
    ok("[1] '오늘의 수업' 카드도 '오늘 수업 없음' 과 다음 수업 날짜·반 이름",
      /오늘은 수업이 없어요/.test(r3.card) && /다음 수업/.test(r3.card) && /보기반/.test(r3.card), '"' + r3.card.replace(/\n/g, ' ').slice(0, 90) + '"');
    await ctx.close();
  }

  // ═══ ② 교재·문제 하위 탭 — 1366 · 1024 ═══
  for (const W of [1366, 1024]) {
    const { ctx, page } = await makePage(browser, { role: 'teacher' }, { width: W, height: 820 });
    const r = await page.evaluate(async () => {
      swTab('t-data'); await new Promise(r => setTimeout(r, 800));
      const grp = () => ['res', 'mk', 'adm'].filter(k => document.getElementById('dtg-' + k).classList.contains('on'));
      const bar = document.querySelector('#t-data .dtabs');
      const rowBar = document.querySelector('#t-data .dtg-row');
      const out = {
        over: bar.scrollWidth - bar.clientWidth, grpOver: rowBar.scrollWidth - rowBar.clientWidth,
        vis: [...document.querySelectorAll('#t-data .dtabs [data-dtg]')].filter(b => b.offsetParent).length,
        all: document.querySelectorAll('#t-data .dtabs [data-dtg]').length,
        lines: new Set([...document.querySelectorAll('#t-data .dtabs [data-dtg]')].filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().top))).size,
      };
      for (const t of ['exam', 'iso', 'library']) {
        switchDataTab(t); await new Promise(r => setTimeout(r, 350));
        out[t] = grp().join(',');
      }
      // 열린 묶음 단추에는 점이 없고, 닫힌 묶음에 점이 있으면 하나만
      out.dots = ['res', 'mk', 'adm'].map(k => {
        const b = document.getElementById('dtg-' + k);
        const d = [...b.querySelectorAll('.wn-dot')].filter(x => getComputedStyle(x).display !== 'none').length;
        return k + ':' + d + (b.classList.contains('on') ? '(열림)' : '');
      });
      // 13개 화면이 모두 열리는지
      const panelOf = { library: 'dp-library', tbook: 'dp-book', lib: 'dp-book', word: 'dp-word', bank: 'dp-bank',
        make: 'dp-make', items: 'dp-items', paper: 'dp-ws', iso: 'dp-iso', kit: 'dp-ws', ws: 'dp-ws',
        exam: 'dp-exam', master: 'dp-master' };
      const bad = [];
      for (const t of Object.keys(panelOf)) {
        switchDataTab(t); await new Promise(r => setTimeout(r, 320));
        const p = document.getElementById(panelOf[t]);
        if (!p || p.style.display === 'none' || !p.offsetParent) bad.push(t);
      }
      const bar2 = document.querySelector('#t-data .dtabs');
      out.bad = bad; out.over2 = bar2.scrollWidth - bar2.clientWidth;
      return out;
    });
    ok('[2] ' + W + 'px — 탭 줄 가로 넘침 0', r.over === 0 && r.over2 === 0 && r.grpOver === 0,
      '탭 줄 ' + r.over + 'px · 묶음 줄 ' + r.grpOver + 'px');
    ok('[2] ' + W + 'px — 한 묶음의 탭만 한 줄에', r.vis < r.all && r.lines === 1,
      '보이는 탭 ' + r.vis + '/' + r.all + '개 · ' + r.lines + '줄');
    ok('[2] ' + W + 'px — exam→관리 · iso→만들기 · library→자료',
      r.exam === 'adm' && r.iso === 'mk' && r.library === 'res', 'exam ' + r.exam + ' · iso ' + r.iso + ' · library ' + r.library);
    ok('[2] ' + W + 'px — 13개 화면이 모두 열린다', r.bad.length === 0, r.bad.length ? ('안 열린 것: ' + r.bad.join(',')) : '13개 모두');
    note('묶음 단추 점: ' + r.dots.join(' · '));
    await page.evaluate(() => switchDataTab('library'));
    await wait(400);
    await page.screenshot({ path: path.join(OUT, 'dtabs_' + W + '.png'), clip: { x: 0, y: 0, width: W, height: 300 } }).catch(() => { });
    await ctx.close();
  }

  // ═══ ③ 설정 — 묶음 셋 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'teacher' }, { width: 1366, height: 820 });
    const r = await page.evaluate(async () => {
      swTab('t-cfg'); await new Promise(r => setTimeout(r, 800));
      const cards = [...document.querySelectorAll('#t-cfg .card[data-cg]')];
      const inOne = cards.filter(c => c.parentNode && /^cfg-g-(ops|face|adv)$/.test(c.parentNode.id || '')).length;
      const groups = ['ops', 'face', 'adv'].map(k => document.querySelectorAll('#cfg-g-' + k + ' > [data-cg]').length);
      const out = { cards: cards.length, inOne, groups,
        auth: document.getElementById('t-cfg').innerText.indexOf('auth_teacher_setup') >= 0,
        authTxt: (document.getElementById('auth-mode-row') || {}).innerText || '',
        wnRows: document.querySelectorAll('#cfg-whatsnew .wn-row').length,
        btns: document.querySelectorAll('#t-cfg .cfg-gb').length, h: {} };
      for (const g of ['ops', 'face', 'adv']) {
        cfgGroup(g); await new Promise(r => setTimeout(r, 250));
        out.h[g] = { vis: cards.filter(c => c.offsetParent).length, ph: document.getElementById('t-cfg').scrollHeight };
      }
      cfgGroup('ops'); await new Promise(r => setTimeout(r, 200));
      return out;
    });
    ok('[3] 묶음 셋 단추', r.btns === 3, r.btns + '개');
    ok('[3] 카드 12개가 어느 한 묶음에 꼭 한 번', r.cards === 12 && r.inOne === 12 && r.groups.reduce((a, b) => a + b, 0) === 13,
      '카드 ' + r.cards + '개 · 묶음 안 ' + r.inOne + '개 · 묶음별 ' + r.groups.join('/') + ' (로그인 방식 줄 포함)');
    ok('[3] 고른 묶음만 보인다', r.h.ops.vis === 3 && r.h.face.vis === 3 && r.h.adv.vis === 6,
      '수업 운영 ' + r.h.ops.vis + ' · 보이는 것 ' + r.h.face.vis + ' · 연결·고급 ' + r.h.adv.vis);
    ok("[3] 'auth_teacher_setup' 글이 화면에 없다", r.auth === false, '"' + r.authTxt.replace(/\n/g, ' ').slice(0, 70) + '"');
    ok("[3] '새로 생긴 것' 카드에 목록이 그려진다", r.wnRows > 0, r.wnRows + '줄');
    note('묶음별 화면 높이: 수업 운영 ' + r.h.ops.ph + 'px · 보이는 것 ' + r.h.face.ph + 'px · 연결·고급 ' + r.h.adv.ph + 'px');
    // 설정 안의 낱말로 가는 길 — 맞는 묶음을 연다
    const r2 = await page.evaluate(async () => {
      cfgGroup('ops'); await new Promise(r => setTimeout(r, 150));
      cfgGoto('cfg-cld-name'); await new Promise(r => setTimeout(r, 400));
      const el = document.getElementById('cfg-cld-name');
      return { on: ['ops', 'face', 'adv'].filter(k => document.getElementById('cfgg-' + k).classList.contains('on')).join(''), vis: !!(el && el.offsetParent) };
    });
    ok('[3] 설정 안의 한 칸으로 가면 그 묶음이 열린다', r2.on === 'adv' && r2.vis, '열린 묶음 ' + r2.on);
    await page.evaluate(() => cfgGroup('adv'));
    await wait(300);
    await page.screenshot({ path: path.join(OUT, 'cfg_adv_1366.png') }).catch(() => { });
    await page.evaluate(() => cfgGroup('ops'));
    await wait(300);
    await page.screenshot({ path: path.join(OUT, 'cfg_ops_1366.png') }).catch(() => { });
    const c = await page.evaluate(fn => eval('(' + fn + ')')('#t-cfg'), CONTRAST.toString());
    ok('[9] 설정 — 대비 4.5 미만 0곳', c.n === 0, '본 글자 ' + c.seen + '곳 · 미만 ' + c.n + '곳');
    c.bad.forEach(b => note('대비 ' + b.r + ' — "' + b.t + '" ' + b.c + ' / ' + b.b + ' [' + b.cls + ']'));
    await ctx.close();
  }

  // ═══ ④ 과제 표 — 한 격자 · 같은 이름 가르기 · 누름 자리 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'teacher' }, { width: 1366, height: 900 });
    const r = await page.evaluate(async () => {
      swTab('t-assign'); await new Promise(r => setTimeout(r, 1000));
      const head = document.querySelector('.al-row.al-head');
      const rows = [...document.querySelectorAll('.al-row:not(.al-head)')];
      if (!head || !rows.length) return { err: true };
      const lefts = el => [...el.children].map(c => Math.round(c.getBoundingClientRect().left));
      const hl = lefts(head);
      const diff = rows.map(rw => { const l = lefts(rw); return Math.max(...l.map((v, i) => Math.abs(v - hl[i]))); });
      const nm = rows.map(rw => {
        const n = rw.querySelector('.al-nm');
        return { nm: ((n.childNodes[0] || {}).textContent || '').trim(), sub: ((n.querySelector('.al-sub') || {}).textContent || '').trim() };
      });
      const btns = [...document.querySelectorAll('.al-act .btn,.al-fl .btn')].filter(b => b.offsetParent)
        .map(b => Math.round(b.getBoundingClientRect().height));
      return { diff: Math.max(...diff), rows: rows.length, nm, btns: btns.length ? Math.min(...btns) : null };
    });
    ok('[4] 머리글 칸과 줄 칸이 같은 자리', !r.err && r.diff <= 4, '가장 큰 차이 ' + r.diff + 'px (줄 ' + r.rows + '개)');
    const dup = (r.nm || []).filter(x => (r.nm || []).filter(y => y.nm === x.nm).length > 1);
    ok('[4] 같은 이름 과제 둘에 서로 다른 작은 글',
      dup.length >= 2 && dup.every(x => x.sub) && new Set(dup.map(x => x.sub)).size === dup.length,
      dup.map(x => x.nm + '(' + x.sub + ')').join(' / '));
    ok('[7] 과제 표 단추·칩 높이 36px 이상', r.btns >= 36, '가장 낮은 것 ' + r.btns + 'px');
    const c = await page.evaluate(fn => eval('(' + fn + ')')('#t-assign'), CONTRAST.toString());
    ok('[9] 과제 탭 — 대비 4.5 미만 0곳', c.n === 0, '본 글자 ' + c.seen + '곳 · 미만 ' + c.n + '곳');
    c.bad.forEach(b => note('대비 ' + b.r + ' — "' + b.t + '" ' + b.c + ' / ' + b.b + ' [' + b.cls + ']'));
    await page.screenshot({ path: path.join(OUT, 'assign_1366.png') }).catch(() => { });
    await ctx.close();
  }

  // ═══ ⑤ 수업 기록 — 1366 단원 칸 · 800x1000 저장 단추 ═══
  for (const vp of [{ width: 1366, height: 800 }, { width: 800, height: 1000 }]) {
    const { ctx, page } = await makePage(browser, { role: 'teacher' }, vp);
    const r = await page.evaluate(async (o) => {
      swTab('t-class'); await new Promise(r => setTimeout(r, 900));
      openClsDetail('ux3-c1'); await new Promise(r => setTimeout(r, 600));
      openClassLesson('ux3-c1', o.today); await new Promise(r => setTimeout(r, 1000));
      const u = document.querySelector('#cl-subj-rows .sr input[data-f="unit"]');
      if (u) { u.value = o.unit; u.dispatchEvent(new Event('input')); }
      await new Promise(r => setTimeout(r, 200));
      const save = document.getElementById('cl-save-btn');
      const sb = save ? save.getBoundingClientRect() : null;
      const col = document.getElementById('cls-record-col');
      const inner = document.querySelector('.cls-record-inner');
      return {
        unitW: u ? Math.round(u.getBoundingClientRect().width) : null,
        unitCut: u ? (u.scrollWidth > u.clientWidth) : null,
        recW: col ? Math.round(col.getBoundingClientRect().width) : null,
        saveIn: !!(sb && sb.top >= 0 && sb.bottom <= window.innerHeight + 1),
        saveTop: sb ? Math.round(sb.top) : null,
        doc: document.documentElement.scrollHeight, vh: window.innerHeight,
        innerOver: inner ? inner.scrollWidth - inner.clientWidth : null,
      };
    }, { today, unit: UNIT21 });
    if (vp.width === 1366) {
      ok('[8] 1366px — 단원 칸 190px 이상', r.unitW >= 190, '단원 칸 ' + r.unitW + 'px (기록 칸 ' + r.recW + 'px)');
      ok('[8] 1366px — 21자 단원이 잘리지 않는다', r.unitCut === false, '"' + UNIT21 + '"');
      ok('[8] 1366px — 기록 칸 가로 넘침 0', r.innerOver === 0, r.innerOver + 'px');
      const c = await page.evaluate(fn => eval('(' + fn + ')')('#t-class'), CONTRAST.toString());
      ok('[9] 클래스 탭 — 대비 4.5 미만 0곳', c.n === 0, '본 글자 ' + c.seen + '곳 · 미만 ' + c.n + '곳');
      c.bad.forEach(b => note('대비 ' + b.r + ' — "' + b.t + '" ' + b.c + ' / ' + b.b + ' [' + b.cls + ']'));
      await page.screenshot({ path: path.join(OUT, 'record_1366.png') }).catch(() => { });
    } else {
      ok('[5] 800x1000 — [저장하기] 가 스크롤 없이 화면 안', r.saveIn === true, '저장 단추 ' + r.saveTop + 'px (화면 ' + r.vh + 'px)');
      ok('[5] 800x1000 — 문서 높이가 화면 두 배를 넘지 않는다', r.doc <= r.vh * 2, '문서 ' + r.doc + 'px (전에는 21,092px)');
      ok('[5] 800x1000 — 기록 칸이 화면을 덮는다', r.recW >= 760, '기록 칸 ' + r.recW + 'px');
      await page.screenshot({ path: path.join(OUT, 'record_800.png') }).catch(() => { });
    }
    await ctx.close();
  }

  // ═══ ⑥ 390px — 위 메뉴 띠 · 도장 챌린지 띠 · 체험 모드 띠 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'teacher' }, { width: 390, height: 780 });
    const r = await page.evaluate(async (fn) => {
      swTab('t-dash'); await new Promise(r => setTimeout(r, 900));
      const bar = document.querySelector('#s-teacher .t-sidebar');
      const out = { more: bar.classList.contains('nav-more'), sw: bar.scrollWidth, cw: bar.clientWidth };
      swTab('t-cfg'); await new Promise(r => setTimeout(r, 600));
      const b = bar.querySelector('.ntab[data-tab="t-cfg"]');
      const br = bar.getBoundingClientRect(), bb = b.getBoundingClientRect();
      out.cfgIn = (bb.left >= br.left - 1 && bb.right <= br.right + 1);
      out.endFade = bar.classList.contains('nav-more');
      swTab('t-dash'); await new Promise(r => setTimeout(r, 700));
      out.strip = eval('(' + fn + ')')('#dash-stats .pl-stat[data-k="stamp"]');   // feat/dash-plain: 띠 → 숫자 줄의 도장 칸
      out.over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return out;
    }, NOBREAK.toString());
    ok('[6] 390px — 밀 수 있는 띠의 오른쪽 끝이 흐려진다', r.more === true && r.sw > r.cw, '띠 ' + r.sw + 'px / 보이는 폭 ' + r.cw + 'px');
    ok('[6] 390px — 끝까지 밀면 흐림이 사라진다', r.endFade === false);
    ok("[6] 390px — 탭을 '설정' 으로 바꾸면 그 탭이 띠 안에 보인다", r.cfgIn === true);
    ok('[6] 390px — 도장 칸의 낱말이 꺾이지 않는다', r.strip.found && r.strip.broken.length === 0,
      r.strip.found ? (r.strip.lines.length + '줄: ' + r.strip.lines.join(' / ')) : '띠가 없다');
    ok('[6] 390px — 가로 넘침 0', r.over === 0, r.over + 'px');
    await page.screenshot({ path: path.join(OUT, 'dash_390.png') }).catch(() => { });
    // [10] 체험 모드 띠
    const r2 = await page.evaluate(async () => {
      swTab('t-stu'); await new Promise(r => setTimeout(r, 500));
      loadStuPanel('ux3-s1'); await new Promise(r => setTimeout(r, 700));
      previewAsStudent('ux3-s1'); await new Promise(r => setTimeout(r, 1300));
      const bar = document.getElementById('_teacher-preview-bar');
      if (!bar) return { found: false };
      const sp = bar.querySelector('span');
      return { found: true, txt: sp.innerText, cut: sp.scrollWidth > sp.clientWidth + 1,
        inside: bar.getBoundingClientRect().width <= window.innerWidth + 1 };
    });
    ok("[10] 체험 모드 띠가 '저장 안 됨' 으로 줄고 390px 에서 잘리지 않는다",
      r2.found && /저장 안 됨/.test(r2.txt) && r2.cut === false && r2.inside,
      r2.found ? ('"' + r2.txt.replace(/\n/g, ' ') + '"') : '띠가 없다');
    await page.screenshot({ path: path.join(OUT, 'preview_bar_390.png'), clip: { x: 0, y: 0, width: 390, height: 120 } }).catch(() => { });
    await ctx.close();
  }

  // ═══ ⑦ 누름 자리 — 학생 패널 기간 칩 · 교재 보기 전환 · 새로 생긴 것 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'teacher' }, { width: 1366, height: 900 });
    const r = await page.evaluate(async () => {
      const low = sel => { const es = [...document.querySelectorAll(sel)].filter(e => e.offsetParent); return es.length ? Math.min(...es.map(e => Math.round(e.getBoundingClientRect().height))) : null; };
      swTab('t-stu'); await new Promise(r => setTimeout(r, 600));
      loadStuPanel('ux3-s1'); await new Promise(r => setTimeout(r, 900));
      const out = { spSeg: low('.sp-seg button') };
      swTab('t-data'); await new Promise(r => setTimeout(r, 700));
      out.seg = low('#t-data .seg button');
      swTab('t-dash'); await new Promise(r => setTimeout(r, 700));
      const f = document.getElementById('wn-fold');
      if (f) { f.open = true; await new Promise(r => setTimeout(r, 250)); }
      out.wnRow = low('.wn-row .btn'); out.wnAll = low('.wn-fold .wn-all');
      return out;
    });
    ok('[7] 학생 패널 기간 칩 36px 이상', r.spSeg >= 36, r.spSeg + 'px (전 25px)');
    ok('[7] 교재 보기 전환 칩 36px 이상', r.seg >= 36, r.seg + 'px (전 27px)');
    ok("[7] '새로 생긴 것' 의 [가 보기]·[확인]·[모두 확인] 36px 이상",
      r.wnRow >= 36 && r.wnAll >= 36, '줄 단추 ' + r.wnRow + 'px · 모두 확인 ' + r.wnAll + 'px (전 28px)');
    await ctx.close();
  }

  // ═══ ⑧ 학생 · 학부모 — 대비가 그대로 0 인지 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'student', sid: 'ux3-s1' }, { width: 390, height: 780 });
    const c = await page.evaluate(async fn => {
      currentStudentSid = 'ux3-s1'; renderStudentHome('ux3-s1');
      await new Promise(r => setTimeout(r, 900));
      return eval('(' + fn + ')')('#st-home');
    }, CONTRAST.toString());
    ok("[9] 학생 '오늘' — 대비 4.5 미만 0곳", c.n === 0, '본 글자 ' + c.seen + '곳 · 미만 ' + c.n + '곳');
    c.bad.forEach(b => note('대비 ' + b.r + ' — "' + b.t + '" ' + b.c + ' / ' + b.b + ' [' + b.cls + ']'));
    await ctx.close();
  }
  {
    const { ctx, page } = await makePage(browser, { role: 'parent', sid: 'ux3-s1' }, { width: 390, height: 780 });
    const c = await page.evaluate(async fn => {
      currentParentSid = 'ux3-s1'; loadParent('ux3-s1');
      await new Promise(r => setTimeout(r, 1500));
      document.querySelectorAll('#pp-body .pp-tab[data-pptab="les"] details').forEach(d => d.open = true);
      await new Promise(r => setTimeout(r, 400));
      return eval('(' + fn + ')')('#pp-body .pp-tab[data-pptab="les"]');
    }, CONTRAST.toString());
    ok('[9] 학부모 수업 탭 — 대비 4.5 미만 0곳', c.n === 0, '본 글자 ' + c.seen + '곳 · 미만 ' + c.n + '곳');
    c.bad.forEach(b => note('대비 ' + b.r + ' — "' + b.t + '" ' + b.c + ' / ' + b.b + ' [' + b.cls + ']'));
    await ctx.close();
  }

  await browser.close();
  ok('콘솔 오류 0건', errs.length === 0, errs.slice(0, 4).join(' | '));
  console.log('\n가짜 서버가 받은 요청: 읽기 ' + reqs.get + '건 · 쓰기 ' + reqs.write + '건 (실제 서버로는 0건)');
  console.log('그림: ' + OUT);
  console.log('\n' + pass.length + '/' + (pass.length + fail.length) + ' 통과');
  if (fail.length) { console.log('실패:\n - ' + fail.join('\n - ')); process.exit(1); }
})().catch(e => { console.error('실패:', e); process.exit(1); });
