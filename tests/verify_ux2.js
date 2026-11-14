require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// fix/ux-2 — 학생 화면 정리(인사·보상·주간 띠·아래 메뉴·단어 탭·복습 탭·리딩로그)
//            학부모 화면 정리(수업 탭 순서·알림 권유·지난달 견주기·성장 탭·글자 대비)
// 가짜 서버만 쓴다. 실제 서버로는 한 건도 나가지 않는다. 이름·교재는 지어낸 것만.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { pageUrl } = require('./_page');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const fs = require('fs');
const OUT = path.join(__dirname, 'shots', 'ux2');   // 검사가 남긴 그림은 tests/shots/ 아래 (저장소에 넣지 않는다)
fs.mkdirSync(OUT, { recursive: true });
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };
const note = t => console.log('      · ' + t);

const T = new Date(), pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = ymd(T);
const DOW = ['일', '월', '화', '수', '목', '금', '토'][T.getDay()];
const shift = (ds, d) => { const x = new Date(ds + 'T12:00:00'); x.setDate(x.getDate() + d); return ymd(x); };
// 이번 주 월~일 (학생 주간 띠와 같은 기준)
const MON = shift(today, -((T.getDay() + 6) % 7));
const WEEK = Array.from({ length: 7 }, (_, i) => shift(MON, i));
// 그날 배정 수 1·2·2·2·3·2·2 = 14 (라이브에서 본 배정 수와 같게)
const PERDAY = [1, 2, 2, 2, 3, 2, 2];
const WEEK_QUESTS = PERDAY.reduce((a, b) => a + b, 0);
// 지난 날은 차례로 '다 한 날 → 일부 한 날 → 안 한 날', 오늘·앞날은 안 한 것으로 둔다
const pastIdx = WEEK.filter(d => d < today).length;
const doneOf = (i) => {
  const d = WEEK[i];
  if (d >= today) return 0;
  const rank = WEEK.filter(x => x < d).length;      // 몇 번째 지난 날인가
  if (rank === 0) return PERDAY[i];                 // 다 한 날
  if (rank === 1) return 1;                         // 일부 한 날
  if (rank === 2) return 0;                         // 안 한 날
  return 1;
};
const schedRow = (i, which) => ({ date: WEEK[i], book: '보기 리딩 1', unit: 'Unit ' + (i + 1), done: doneOf(i) >= which });

// ── 가짜 자료 ─────────────────────────────────────────────────
const dayNow = Number(today.slice(8, 10));
const lastMonthD = new Date(T.getFullYear(), T.getMonth() - 1, 1);
const LM = lastMonthD.getFullYear() + '-' + pad(lastMonthD.getMonth() + 1);
const TM = T.getFullYear() + '-' + pad(T.getMonth() + 1);
const lateDay = dayNow < 27 ? pad(dayNow + 1) : '28';     // 지난달의 '아직 안 지난 날'
const VOCAB = Array.from({ length: 20 }, (_, i) => ({
  id: 'ux2-v' + i, sid: 'ux2-s1', word: ['barn', 'city', 'field', 'goat', 'hay', 'lamb', 'mud', 'pond', 'rake', 'seed',
    'shed', 'silo', 'straw', 'tractor', 'trough', 'wheat', 'wool', 'yard', 'calf', 'crop'][i],
  meaning: '보기 뜻 ' + (i + 1), pos: 'n', addedDate: shift(today, -2), hits: 0, misses: 0,
  wlevel: i === 0 ? 'B2' : '',           // 옛 코드가 등급 칩을 그리던 자리 — 지금은 안 그려야 한다
}));
const SNAP = {
  students: [
    { id: 'ux2-s1', name: '가온', grade: '초4', cls: 'ux2-c1', pin: '0001', fee: 0 },
    { id: 'ux2-p1', name: '유다인', grade: '초5', cls: 'ux2-c1', pin: '0002', fee: 0 },
    { id: 'ux2-p2', name: '한소리', grade: '초6', cls: 'ux2-c1', pin: '0003', fee: 0 },
  ],
  globalClasses: [{
    id: 'ux2-c1', name: '보기반 A', active: true, days: [DOW], studentIds: ['ux2-s1', 'ux2-p1', 'ux2-p2'],
    commonMaterials: { reading: { book: '보기 리딩 1', unit: 'Unit 4 On the Farm', bookId: 'ux2-tb1' } },
  }],
  // 본문·음원은 없고 단어만 있는 단원 — 복습 탭에 [단어 복습] 이 나와야 한다
  globalTextbooks: [{
    id: 'ux2-tb1', type: 'textbook', title: '보기 리딩 1', category: '리딩',
    units: { 'Unit 4 On the Farm': [{ word: 'barn', ko: '헛간' }, { word: 'goat', ko: '염소' }] },
  }],
  library: [],
  lessons: [
    { id: 'ux2-l1', sid: 'ux2-s1', classId: 'ux2-c1', date: shift(today, -1), att: 'normal', cmt: '',
      materials: { reading: { book: '보기 리딩 1', unit: 'Unit 4 On the Farm' } } },
    // 학부모 — 이번 달 4회 / 지난달 이맘때 5회 / 지난달 전체 13회
    ...Array.from({ length: 4 }, (_, i) => ({ id: 'ux2-lt' + i, sid: 'ux2-p1', classId: 'ux2-c1', date: TM + '-01', att: 'normal', cmt: '', materials: {} })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: 'ux2-le' + i, sid: 'ux2-p1', classId: 'ux2-c1', date: LM + '-01', att: 'normal', cmt: '', materials: {} })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: 'ux2-ll' + i, sid: 'ux2-p1', classId: 'ux2-c1', date: LM + '-' + lateDay, att: 'normal', cmt: '', materials: {} })),
    { id: 'ux2-l9', sid: 'ux2-p2', classId: 'ux2-c1', date: TM + '-01', att: 'normal', cmt: '', materials: {} },
  ],
  assignments: [
    // 학생 — 이번 주 14개 (1·2·2·2·3·2·2)
    { id: 'ux2-a1', sid: 'ux2-s1', category: 'recur', text: '보기 리딩 1 읽기', bookTitle: '보기 리딩 1',
      date: today, due: today, schedule: WEEK.map((_, i) => schedRow(i, 1)) },
    { id: 'ux2-a2', sid: 'ux2-s1', category: 'vocab', text: '단어 복습', bookTitle: '보기 단어 1',
      date: today, due: today, schedule: WEEK.map((_, i) => schedRow(i, 2)).filter((_, i) => i >= 1) },
    { id: 'ux2-a3', sid: 'ux2-s1', category: 'grammar', text: '보기 어법 1', bookTitle: '보기 어법 1',
      date: WEEK[4], due: WEEK[4], schedule: [schedRow(4, 3)] },
    // 학부모 — 같은 말이 두 번 나오던 과제 + 12일 밀림
    { id: 'ux2-b1', sid: 'ux2-p1', category: 'vocab', text: '앱으로 단어 20개 학습', date: today, due: today,
      schedule: Array.from({ length: 12 }, (_, i) => ({ date: shift(today, -(i + 1)), book: '앱으로 단어 20개 학습' }))
        .concat([{ date: today, book: '앱으로 단어 20개 학습' }]) },
  ],
  // 테스트는 '한소리' 에게만 — '유다인' 의 성장 탭에는 영역별 성장 카드가 없어야 한다
  tests: [
    { id: 'ux2-t1', sid: 'ux2-p2', date: shift(today, -5), vocabCorrect: 18, vocabTotal: 20, grammarCorrect: 8, grammarTotal: 10 },
    { id: 'ux2-t2', sid: 'ux2-p2', date: shift(today, -20), vocabCorrect: 15, vocabTotal: 20, grammarCorrect: 7, grammarTotal: 10 },
  ],
  readings: [
    { id: 'ux2-r1', sid: 'ux2-p1', title: '보기 원서 1', date: shift(today, -40), arLevel: '0.1', read: true },
    { id: 'ux2-r2', sid: 'ux2-p1', title: '보기 원서 2', date: shift(today, -10), arLevel: '0.4', read: true },
    { id: 'ux2-r3', sid: 'ux2-p1', title: '보기 원서 3', date: shift(today, -2), arLevel: '0.4', read: true },
  ],
  // 학생 홈 리딩로그 25개 — 6개만 보이고 [더 보기] 로 나머지
  logs: Array.from({ length: 25 }, (_, i) => ({
    id: 'ux2-g' + i, sid: 'ux2-s1', date: shift(today, -i), bookTitle: '보기 원서 ' + (i + 1), read: true,
    photoUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  })).concat(Array.from({ length: 3 }, (_, i) => ({
    id: 'ux2-pg' + i, sid: 'ux2-p1', date: shift(today, -i * 3), bookTitle: '보기 원서 ' + (i + 1), read: true,
    photoUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  }))),
  notices: [], homeworks: [], textbooks: [], messages: [],
  monthlyReports: [], examSchedules: [], counsels: [],
  vocab_cards: VOCAB.concat(Array.from({ length: 6 }, (_, i) => ({
    id: 'ux2-pv' + i, sid: 'ux2-p1', word: 'pear' + i, meaning: '보기 뜻', pos: 'n',
    addedDate: shift(today, -9), hits: i < 2 ? 3 : 1, misses: 0,
  }))),
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
  })[t] || [];
  return route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(isWrite ? [] : rows.map(d => ({ id: d.id, sid: d.sid || null, data: d, updated_at: '2026-11-13T00:00:00.000Z' }))),
  });
}

const errs = [];
async function makePage(browser, sess, vp) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR' });
  await ctx.addInitScript(s => {
    try { localStorage.setItem('pp_session', JSON.stringify(s)); } catch (e) { }
  }, sess);
  const page = await ctx.newPage();
  await page.route('**/rest/v1/**', serve);
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false,"server":false}' }));
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  await page.goto(pageUrl(null, null, true), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => (typeof _cache !== 'undefined') && (_cache.students || []).length > 0, null, { timeout: 60000 }).catch(() => { });
  await wait(1200);
  return { ctx, page };
}

// ── 글자 대비 — 보이는 글자마다 글자색:바탕색 비를 센다 (그림 문자·꺼진 것 제외) ──
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
    if (!t || !/[0-9A-Za-z가-힣]/.test(t)) return;                 // 그림 문자만 있는 것은 뺀다
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') return;
    if (el.closest('[data-pp-lim-off]')) return;                   // 서버 제한으로 꺼 둔 단추
    if (el.closest('button:disabled,input:disabled,[disabled]')) return;
    let p = el, dim = false;
    while (p && p.nodeType === 1) { if (+getComputedStyle(p).opacity < 0.75) { dim = true; break; } p = p.parentElement; }
    if (dim) return;                                               // 일부러 흐리게 둔 것(끝낸 퀘스트)
    const fg = parse(st.color); if (!fg) return;
    const bg = bgOf(el);
    const col = over(fg, bg);
    const l1 = L(col), l2 = L(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    seen++;
    if (ratio < 4.5) bad.push({ t: t.slice(0, 22), r: Math.round(ratio * 100) / 100, c: st.color, b: 'rgb(' + bg.map(Math.round).join(',') + ')', cls: (el.className || '').toString().slice(0, 28) });
  });
  return { seen, bad: bad.slice(0, 14), n: bad.length };
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  // ═══ ① 학생 390x780 — 인사 · 보상 · 주간 띠 · 아래 메뉴 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'student', sid: 'ux2-s1' }, { width: 390, height: 780 });
    const r = await page.evaluate(async (o) => {
      currentStudentSid = 'ux2-s1';
      renderStudentHome('ux2-s1');
      await new Promise(r => setTimeout(r, 700));
      // 제목 줄 나누기 — 줄마다 글자를 본다
      const ttl = document.querySelector('#st-home .stu-hero-title');
      const lines = [];
      if (ttl) {
        const rng = document.createRange();
        const walk = (el) => [...el.childNodes].forEach(n => { if (n.nodeType === 3) { for (let i = 0; i < n.textContent.length; i++) { rng.setStart(n, i); rng.setEnd(n, i + 1); const b = rng.getBoundingClientRect(); lines.push({ y: Math.round(b.top), ch: n.textContent[i] }); } } else if (n.nodeType === 1) walk(n); });
        walk(ttl);
      }
      const byY = {};
      lines.forEach(x => { (byY[x.y] = byY[x.y] || []).push(x.ch); });
      const lineTxt = Object.keys(byY).sort((a, b) => a - b).map(k => byY[k].join('').trim()).filter(Boolean);
      const home = document.getElementById('st-home');
      const txt = home.innerText;
      const boss = document.querySelector('#st-home .boss-card');
      const bossFold = boss ? boss.closest('details') : null;
      const bonusSum = [...home.querySelectorAll('details>summary')].find(s => s.textContent.indexOf('보너스') >= 0);
      const dots = [...home.querySelectorAll('.wk-day')].map(b => {
        const d = b.querySelector('.wk-day-dot');
        return { txt: (d.textContent || '').trim(), cls: d.className.replace('wk-day-dot', '').trim(), today: b.classList.contains('today'), tip: b.getAttribute('title') || '' };
      });
      const nav = [...document.querySelectorAll('#s-student .stu-bottomnav .stutab')].filter(b => b.offsetWidth > 0)
        .map(b => (b.querySelector('.snav-lbl') || {}).textContent || '');
      return {
        lineTxt, txt: txt.slice(0, 400),
        hasTrack: txt.indexOf('체력 기간') >= 0 || txt.indexOf('직결 기간') >= 0,
        bossInFold: !!bossFold, bossFoldOpen: bossFold ? bossFold.open : null,
        bossLine: bonusSum ? (bonusSum.textContent.match(/주간 보스 \d+\/\d+/) || [''])[0] : '',
        dots, nav, homeH: Math.round(home.scrollHeight),
        legend: !!home.querySelector('.wk-legend'),
        xover: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, {});
    const last = r.lineTxt[r.lineTxt.length - 1] || '';
    ok('[1] 제목의 어느 줄도 두 글자 이하로 끝나지 않는다',
      r.lineTxt.length > 0 && r.lineTxt.every(l => l.replace(/[,\s]/g, '').length > 2),
      r.lineTxt.map(x => '"' + x + '"').join(' / '));
    ok('[2] 첫 화면에 주간 보스 카드가 없다 (접힌 묶음 안에 있다)', r.bossInFold === true && r.bossFoldOpen === false);
    ok('[2] 접힌 줄에 보스 진행 숫자가 있다', /주간 보스 \d+\/\d+/.test(r.bossLine), '"' + r.bossLine + '"');
    ok('[2] 학생 화면에 "체력 기간" 글이 없다', r.hasTrack === false);
    // 주간 띠 — 네 가지가 서로 다르게
    const pastDots = r.dots.filter((d, i) => !d.today && WEEK[i] < today);
    const kinds = {
      allDone: pastDots.find(d => d.cls === 'done'), part: pastDots.find(d => d.cls === 'part'),
      none: pastDots.find(d => d.cls === 'none'), today: r.dots.find(d => d.today),
    };
    const shown = Object.keys(kinds).filter(k => kinds[k]);
    const texts = shown.map(k => kinds[k].txt);
    ok('[3] 주간 띠 — 다 한 날·일부 한 날·안 한 날·오늘이 서로 다르다',
      shown.length >= Math.min(4, pastIdx + 1) && new Set(texts).size === texts.length,
      shown.map(k => k + '="' + kinds[k].txt + '"').join(' · '));
    ok('[3] 오늘 칸은 "n개"', /^\d+개$/.test((kinds.today || {}).txt || ''), '"' + ((kinds.today || {}).txt || '') + '"');
    ok('[3] 숫자가 무엇인지 적는 줄이 있다', r.legend === true);
    ok('[3] 칸마다 설명(title)이 붙는다', r.dots.every(d => d.tip.length > 3));
    ok('[4] 아래 메뉴 네 칸', r.nav.length === 4 && /다른 앱/.test(r.nav[3] || ''), r.nav.join(' · '));
    ok('[—] 가로 넘침 0 (390px)', r.xover <= 0, r.xover + 'px');
    note('학생 "오늘" 높이 ' + r.homeH + 'px');
    await page.screenshot({ path: path.join(OUT, 'student_home_390.png'), fullPage: false }).catch(() => { });

    // 글자 대비 — 학생 '오늘'
    const c1 = await page.evaluate(fn => eval('(' + fn + ')')('#st-home'), CONTRAST.toString());
    ok('[12] 학생 "오늘" — 대비 4.5 미만 0곳', c1.n === 0, '본 글자 ' + c1.seen + '곳 · 미만 ' + c1.n + '곳');
    c1.bad.forEach(b => note('대비 ' + b.r + ' — "' + b.t + '" ' + b.c + ' / ' + b.b + ' [' + b.cls + ']'));

    // [2] 보스 목표는 배정 수를 넘지 않는다
    const bz = await page.evaluate(() => {
      const wk = _bossWeekKey();
      const cap = _bossCap('ux2-s1', 'q', wk, [], 0);
      const qs = BOSS_POOL.filter(d => d.k === 'q');
      let h = 0; for (const ch of (wk + 'ux2-s1')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const def = BOSS_POOL[h % BOSS_POOL.length];
      const b = weeklyBossInfo('ux2-s1');
      const caps = { w: _bossCap('ux2-s1', 'w', wk, ppLive(_cache.vocab_cards).filter(c => c.sid === 'ux2-s1'), 0), d: _bossCap('ux2-s1', 'd', wk, [], 0), m: _bossCap('ux2-s1', 'm', wk, ppLive(_cache.vocab_cards).filter(c => c.sid === 'ux2-s1'), 0), q: cap };
      return { cap, qMax: Math.max(...qs.map(d => Math.min(d.target, cap))), kind: def.k, target: b.target, desc: b.desc, caps };
    });
    ok('[2] 퀘스트형 보스 목표가 배정 수(' + WEEK_QUESTS + ') 이하', bz.cap === WEEK_QUESTS && bz.qMax <= WEEK_QUESTS,
      '배정 ' + bz.cap + ' · 가장 큰 목표 ' + bz.qMax);
    ok('[2] 이번 주 보스 목표도 채울 수 있는 값', bz.target <= Math.max(1, bz.caps[bz.kind]),
      ({ w: '워드', d: '개근', m: '마스터', q: '퀘스트' })[bz.kind] + '형 · 목표 ' + bz.target + ' · 채울 수 있는 최대 ' + bz.caps[bz.kind]);
    note('보스 글: ' + bz.desc);
    note('채울 수 있는 최대 — 워드 ' + bz.caps.w + ' · 개근 ' + bz.caps.d + ' · 마스터 ' + bz.caps.m + ' · 퀘스트 ' + bz.caps.q);

    // [4] '다른 앱' 올라오는 창
    const sh = await page.evaluate(async () => {
      document.getElementById('stu-nav-ext').click();
      await new Promise(r => setTimeout(r, 350));
      const box = document.querySelector('#m-extapps .pp-sheet-box');
      const bs = [...document.querySelectorAll('#m-extapps .pp-sheet-b')].map(b => (b.querySelector('b') || {}).textContent || '');
      const open = getComputedStyle(document.getElementById('m-extapps')).display !== 'none';
      return { open, bs, bottom: box ? Math.round(box.getBoundingClientRect().bottom) : -1, vh: window.innerHeight };
    });
    ok('[4] "다른 앱" 창에 단추 셋', sh.open === true && sh.bs.length === 3 && sh.bs.join(',') === '클래스5,오토보카,리딩앤', sh.bs.join(' · '));
    await page.screenshot({ path: path.join(OUT, 'student_extsheet_390.png') }).catch(() => { });
    await page.evaluate(() => closeExtSheet());
    await wait(300);

    // ═══ [5] 단어 탭 — 시작 화면이 먼저 ═══
    const vs = await page.evaluate(async () => {
      document.querySelector('#s-student .stutab[data-tab="st-vocab"]').click();
      await new Promise(r => setTimeout(r, 500));
      const el = document.getElementById('st-vocab');
      return {
        start: !!el.querySelector('.vcs-wrap'), txt: el.innerText.replace(/\n+/g, ' | ').slice(0, 160),
        btn: (el.querySelector('.vcs-go') || {}).textContent || '',
        card: !!el.querySelector('.vc-deck'),
      };
    });
    ok('[5] 단어 탭은 시작 화면이 먼저 나온다', vs.start === true && vs.card === false, vs.txt);
    ok('[5] 시작 화면에 단계 순서가 적힌다', /→/.test(vs.txt) && /\d+개/.test(vs.txt));
    await page.screenshot({ path: path.join(OUT, 'student_vocab_start_390.png') }).catch(() => { });

    const vc = await page.evaluate(async () => {
      document.querySelector('#st-vocab .vcs-go').click();
      await new Promise(r => setTimeout(r, 600));
      const el = document.getElementById('st-vocab');
      const deck = el.querySelector('.vc-deck');
      const front = el.querySelector('.vc-front');
      const badges = front ? [...front.querySelectorAll('.badge')].map(b => b.textContent.trim()) : [];
      const deckTop = deck ? Math.round(deck.getBoundingClientRect().top) : -1;
      const panelTop = Math.round(el.getBoundingClientRect().top);
      saveDeckState();                        // 아이가 한 장 넘긴 것과 같은 상태로 둔다
      return { card: !!deck, badges, gap: deckTop - panelTop, lvl: /\b[ABC][12]\b/.test(front ? front.innerText : ''), prog: vcProgLine() };
    });
    ok('[5] [시작] 을 누르면 카드가 나온다', vc.card === true, '진행 "' + vc.prog + '"');
    ok('[5] 카드에 등급 칩(B2 등)이 없다', vc.badges.length === 0 && vc.lvl === false, vc.badges.join(',') || '없음');
    note('카드 위 빈 자리 ' + vc.gap + 'px');
    await page.screenshot({ path: path.join(OUT, 'student_vocab_card_390.png') }).catch(() => { });

    const vr = await page.evaluate(async () => {
      swStuTab('st-home');
      await new Promise(r => setTimeout(r, 400));
      document.querySelector('#s-student .stutab[data-tab="st-vocab"]').click();
      await new Promise(r => setTimeout(r, 500));
      const el = document.getElementById('st-vocab');
      return { start: !!el.querySelector('.vcs-wrap'), btn: (el.querySelector('.vcs-go') || {}).textContent || '' };
    });
    ok('[5] 하던 것이 있으면 [이어서 하기]', vr.start === true && /이어서 하기/.test(vr.btn) && /구간 \d+\/\d+/.test(vr.btn), '"' + vr.btn + '"');

    // ═══ [6] 복습 탭 ═══
    const rv = await page.evaluate(async () => {
      document.querySelector('#s-student .stutab[data-tab="st-library"]').click();
      await new Promise(r => setTimeout(r, 600));
      const el = document.getElementById('st-library');
      const btns = [...el.querySelectorAll('button')].map(b => b.textContent.trim());
      return { txt: el.innerText, dead: el.innerText.indexOf('본문·음원 없음') >= 0, word: btns.some(b => /단어 복습/.test(b)) };
    });
    ok('[6] 복습 탭에 "본문·음원 없음" 이 없다', rv.dead === false);
    ok('[6] 단어가 있으면 [단어 복습] 단추', rv.word === true);
    await page.screenshot({ path: path.join(OUT, 'student_review_390.png') }).catch(() => { });

    // ═══ [7] 리딩로그 6개 + [더 보기] ═══
    const lg = await page.evaluate(async () => {
      swStuTab('st-home');
      await new Promise(r => setTimeout(r, 600));
      const vis = () => [...document.querySelectorAll('#st-home .ig-card')].filter(c => c.offsetWidth > 0).length;
      const before = vis();
      const b = document.getElementById('stu-rdlog-btn');
      const lbl = b ? b.textContent.trim() : '';
      if (b) b.click();
      await new Promise(r => setTimeout(r, 300));
      return { before, after: vis(), lbl };
    });
    ok('[7] 리딩로그는 최근 6개만 보인다', lg.before === 6, lg.before + '개');
    ok('[7] [더 보기] 로 25개가 다 보인다', lg.after === 25, '"' + lg.lbl + '" 누른 뒤 ' + lg.after + '개');
    await ctx.close();
  }

  // ═══ ② 학부모 390x780 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'parent', sid: 'ux2-p1' }, { width: 390, height: 780 });
    const r = await page.evaluate(async () => {
      currentParentSid = 'ux2-p1';
      loadParent('ux2-p1');
      await new Promise(r => setTimeout(r, 900));
      const card = word => [...document.querySelectorAll('#pp-body .pp-tab[data-pptab="les"] .card')]
        .find(x => ((x.querySelector('.ct') || {}).textContent || '').indexOf(word) >= 0);
      const topOf = w => { const c = card(w); return c ? Math.round(c.getBoundingClientRect().top) : -1; };
      const txt = document.querySelector('#pp-body .pp-tab[data-pptab="les"]').innerText;
      const row = document.getElementById('pp-push-row');
      return {
        hwTop: topOf('숙제'), lesTop: topOf('최근 수업'), monTop: topOf('이번 달 현황'),
        heroTop: (() => { const h = [...document.querySelectorAll('#pp-body .pp-tab[data-pptab="les"] >div')].find(d => /월 한 달/.test(d.innerText || '')); return h ? Math.round(h.getBoundingClientRect().top) : -1; })(),
        trackTop: (() => { const t = document.querySelector('#pp-body .track-line'); return t ? Math.round(t.getBoundingClientRect().top) : -1; })(),
        dup: /앱으로 단어 20개 학습\s*앱으로 단어 20개 학습/.test(txt),
        hwLine: (txt.match(/[^\n]*밀림[^\n]*/) || [''])[0],
        lastMonth: (txt.match(/지난달 이맘때 \d+회/) || [''])[0],
        arrow: /[▲▼]/.test(txt),
        pushVisible: row ? getComputedStyle(row).display !== 'none' : false,
        pushHasClose: !!document.querySelector('#pp-push-row .pp-push-x'),
        nav: [...document.querySelectorAll('#s-parent .stu-bottomnav .stutab')].filter(b => b.offsetWidth > 0).map(b => (b.querySelector('.snav-lbl') || {}).textContent || ''),
        xover: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    ok('[8] 숙제 카드 머리가 화면 위에서 300px 안', r.hwTop > 0 && r.hwTop <= 300, r.hwTop + 'px');
    ok('[8] 순서 — 숙제 → 최근 수업 → 한 달 요약 → 단계 안내 → 이번 달 현황',
      r.hwTop < r.lesTop && r.lesTop < r.heroTop && r.heroTop < r.trackTop && r.trackTop < r.monTop,
      '숙제 ' + r.hwTop + ' · 최근수업 ' + r.lesTop + ' · 요약 ' + r.heroTop + ' · 단계 ' + r.trackTop + ' · 현황 ' + r.monTop);
    ok('[8] 같은 말이 두 번 나오지 않는다', r.dup === false, r.hwLine ? '"' + r.hwLine.trim() + '"' : '');
    ok('[10] "지난달 이맘때 n회" 로 적는다', r.lastMonth === '지난달 이맘때 5회', '"' + r.lastMonth + '"');
    ok('[10] 화살표(▲▼)를 쓰지 않는다', r.arrow === false);
    ok('[9] 알림 권유에 [닫기] 가 있다', r.pushHasClose === true);
    ok('[9] 알림 권유가 수업 탭에 보인다', r.pushVisible === true);
    ok('[11] 아래 메뉴 이름이 "성장"', r.nav.indexOf('성장') >= 0, r.nav.join(' · '));
    ok('[—] 가로 넘침 0 (390px)', r.xover <= 0, r.xover + 'px');
    await page.screenshot({ path: path.join(OUT, 'parent_les_390.png') }).catch(() => { });

    await page.evaluate(() => { document.querySelectorAll('#pp-body .pp-tab[data-pptab="les"] details').forEach(d => d.open = true); });
    await wait(400);
    const c2 = await page.evaluate(fn => eval('(' + fn + ')')('#pp-body .pp-tab[data-pptab="les"]'), CONTRAST.toString());
    ok('[12] 학부모 수업 탭 — 대비 4.5 미만 0곳', c2.n === 0, '본 글자 ' + c2.seen + '곳 · 미만 ' + c2.n + '곳');
    c2.bad.forEach(b => note('대비 ' + b.r + ' — "' + b.t + '" ' + b.c + ' / ' + b.b + ' [' + b.cls + ']'));

    // [9] 다른 탭에서는 권유가 없다 · [11] 테스트 없으면 영역별 성장 카드 없음
    const g = await page.evaluate(async () => {
      document.querySelector('#s-parent .stu-bottomnav .stutab[data-ppnav="score"]').click();
      await new Promise(r => setTimeout(r, 500));
      const row = document.getElementById('pp-push-row');
      const sc = document.querySelector('#pp-body .pp-tab[data-pptab="score"]');
      return {
        pushVisible: row ? getComputedStyle(row).display !== 'none' : false,
        area: [...sc.querySelectorAll('.ct')].some(c => c.textContent.indexOf('영역별 성장') >= 0),
        pass100: /통과\s*100%/.test(sc.innerText),
        mini: !!document.getElementById('pp-push-mini'),
      };
    });
    ok('[9] 다른 탭에서는 권유가 보이지 않는다', g.pushVisible === false);
    ok('[11] 테스트가 없으면 "영역별 성장" 카드가 없다', g.area === false && g.pass100 === false);
    ok('[9] 켜고 끄는 자리는 접힌 묶음 안에 남는다', g.mini === true);
    await page.screenshot({ path: path.join(OUT, 'parent_score_notest_390.png') }).catch(() => { });

    // [9] 닫으면 다시 열어도 없다
    const cl = await page.evaluate(async () => {
      document.querySelector('#s-parent .stu-bottomnav .stutab[data-ppnav="les"]').click();
      await new Promise(r => setTimeout(r, 300));
      ppPushNudgeClose();
      loadParent('ux2-p1');
      await new Promise(r => setTimeout(r, 800));
      const row = document.getElementById('pp-push-row');
      return { visible: row ? getComputedStyle(row).display !== 'none' : false, saved: !!localStorage.getItem('pp_pushnudge_off_ux2-p1') };
    });
    ok('[9] 닫으면 다시 열어도 권유가 없다', cl.visible === false && cl.saved === true);
    await ctx.close();
  }

  // ═══ ③ 테스트가 있는 학부모 — 영역별 성장은 지금처럼 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'parent', sid: 'ux2-p2' }, { width: 390, height: 780 });
    const r = await page.evaluate(async () => {
      currentParentSid = 'ux2-p2';
      loadParent('ux2-p2');
      await new Promise(r => setTimeout(r, 900));
      const sc = document.querySelector('#pp-body .pp-tab[data-pptab="score"]');
      return { area: [...sc.querySelectorAll('.ct')].some(c => c.textContent.indexOf('영역별 성장') >= 0), basis: sc.innerText.indexOf('테스트 평균') >= 0 };
    });
    ok('[11] 테스트가 있으면 영역별 성장은 지금처럼 나온다', r.area === true && r.basis === true);
    await ctx.close();
  }

  // ═══ ④ 성장 탭의 글 — AR · 단어 마스터 · 대비 (읽은 책이 있는 학부모) ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'parent', sid: 'ux2-p1' }, { width: 390, height: 780 });
    // 학부모 앱은 단어 카드를 서버에서 받지 않는다(loadVocabCards 는 학생·선생님 길에만 있다).
    // '단어 마스터' 타일이 그려지는 길을 보려면 캐시에 넣어 준 뒤 그린다.
    await page.evaluate(async (cards) => {
      currentParentSid = 'ux2-p1';
      _cache.vocab_cards = cards;
      loadParent('ux2-p1');
      await new Promise(r => setTimeout(r, 900));
    }, SNAP.vocab_cards.filter(c => c.sid === 'ux2-p1'));
    const g2 = await page.evaluate(async () => {
      document.querySelector('#s-parent .stu-bottomnav .stutab[data-ppnav="score"]').click();
      await new Promise(r => setTimeout(r, 500));
      document.querySelectorAll('#pp-body .pp-tab[data-pptab="score"] details').forEach(d => d.open = true);
      await new Promise(r => setTimeout(r, 300));
      const sc = document.querySelector('#pp-body .pp-tab[data-pptab="score"]');
      return { ar: (sc.innerText.match(/읽는 책 수준\(AR\)[^\n]*/) || [''])[0], base: (sc.innerText.match(/AR 지수가 있는 책[^\n]*/) || [''])[0],
        master: (sc.innerText.match(/세 번 맞힌 단어/) || [''])[0], arrow: /AR 추이|↑ 0\.|총 \d+권 ·/.test(sc.innerText) };
    });
    ok('[11] AR 글이 무엇의 숫자인지 적는다', /읽는 책 수준\(AR\)/.test(g2.ar) && /AR 지수가 있는 책 \d+권 기준/.test(g2.base) && g2.arrow === false,
      '"' + g2.ar + '" · "' + g2.base + '"');
    ok('[11] "단어 마스터" 아래 작은 글에 "세 번 맞힌 단어"', g2.master === '세 번 맞힌 단어');
    const c3 = await page.evaluate(fn => eval('(' + fn + ')')('#pp-body .pp-tab[data-pptab="score"]'), CONTRAST.toString());
    ok('[12] 학부모 성장 탭 — 대비 4.5 미만 0곳', c3.n === 0, '본 글자 ' + c3.seen + '곳 · 미만 ' + c3.n + '곳');
    c3.bad.forEach(b => note('대비 ' + b.r + ' — "' + b.t + '" ' + b.c + ' / ' + b.b + ' [' + b.cls + ']'));
    await page.screenshot({ path: path.join(OUT, 'parent_score_390.png') }).catch(() => { });
    await ctx.close();
  }

  console.log('\n가짜 서버가 받은 요청 — 읽기 ' + reqs.get + ' · 쓰기 ' + reqs.write + ' (전부 가짜)');
  console.log('콘솔 오류 ' + errs.length + '건');
  errs.slice(0, 6).forEach(e => console.log('   ! ' + e));
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_ux2 실패:', e); process.exit(1); });
