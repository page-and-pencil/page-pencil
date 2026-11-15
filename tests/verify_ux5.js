require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// fix/ux-5 — 문제 은행 줄 단추 32px · 그날 창 닫기 · 좁은 칸 '숙 n/m' · 작은 누름 자리 · 손가락 기기 · 숙제 표 줄 높이 · 창 아래 단추
// 가짜 서버만 쓴다. 실제 서버로는 한 건도 나가지 않는다. 이름·교재·문항은 지어낸 것만.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { pageUrl } = require('./_page');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const fs = require('fs');
const OUT = path.join(__dirname, 'shots', 'ux5');
fs.mkdirSync(OUT, { recursive: true });
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };
const note = t => console.log('      · ' + t);

const T = new Date(), pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = ymd(T);
const shift = (ds, d) => { const x = new Date(ds + 'T12:00:00'); x.setDate(x.getDate() + d); return ymd(x); };
const YESTERDAY = shift(today, -1);
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
const WINDOW = Array.from({ length: 21 }, (_, i) => shift(today, i - 10));

const SNAP = {
  students: [{ id: 'u5-s1', name: '나봄', grade: '초4', cls: 'u5-c1', pin: '0001', fee: 0 },
             { id: 'u5-s2', name: '이든', grade: '초5', cls: 'u5-c1', pin: '0002', fee: 0 }],
  globalClasses: [{ id: 'u5-c1', name: '보기반 가', active: true, days: DOWS.slice(), studentIds: ['u5-s1', 'u5-s2'],
    commonMaterials: { reading: { book: '보기 리딩 1', unit: 'Unit 1', bookId: 'u5-tb1' } } }],
  globalTextbooks: [{ id: 'u5-tb1', type: 'textbook', title: '보기 리딩 1', category: '리딩',
    units: Object.fromEntries(Array.from({ length: 30 }, (_, i) => ['Unit ' + (i + 1), [{ word: 'barn', ko: '헛간' }]])) }],
  library: [], tests: [], readings: [], logs: [], vocab_cards: [],
  lessons: [{ id: 'u5-l1', sid: 'u5-s1', classId: 'u5-c1', date: shift(today, -3), att: 'normal', cmt: '',
    materials: { reading: { book: '보기 리딩 1', unit: 'Unit 3', bookId: 'u5-tb1' } } }],
  assignments: [
    { id: 'u5-a1', sid: 'u5-s1', category: 'recur', text: '보기 리딩 1 읽기', bookTitle: '보기 리딩 1', bookId: 'u5-tb1',
      date: today, due: shift(today, 10),
      schedule: WINDOW.map((d, i) => ({ date: d, book: '보기 리딩 1', unit: 'Unit ' + (i + 1), done: d < YESTERDAY })) },
    { id: 'u5-a2', sid: 'u5-s1', category: 'class5', text: '클래스5', bookTitle: '보기 클래스5', date: today, due: shift(today, 10),
      schedule: WINDOW.map((d, i) => ({ date: d, book: '보기 클래스5', unit: '과 ' + (i + 1), done: d < YESTERDAY })) },
    { id: 'u5-a3', sid: 'u5-s2', category: 'vocab', text: '보기 어휘 1', bookTitle: '보기 어휘 1', range: 'Day 1', due: today },
  ],
};
const ITEMS = [1, 2, 3].map(i => ({ id: 'u5-q' + i, updated_at: '2026-11-13T00:00:00.000Z',
  meta: { grade: '중1', area: 'reading', type: 'main', stem: '보기 문항 ' + i + ' — 글의 주제로 알맞은 것은?', preview: 'A sample passage ' + i + '.',
    tags: ['보기'], words: 80, src: { exam: '보기 시험' }, star: i === 1 ? true : null } }));

let reqs = { get: 0, write: 0 };
function serve(route) {
  const req = route.request();
  const isWrite = req.method() !== 'GET' && req.method() !== 'HEAD';
  if (isWrite) reqs.write++; else reqs.get++;
  const t = (new URL(req.url()).pathname.split('/rest/v1/')[1] || '').split('?')[0];
  const rows = ({ students: SNAP.students, classes: SNAP.globalClasses, global_textbooks: SNAP.globalTextbooks,
    lessons: SNAP.lessons, assignments: SNAP.assignments })[t] || [];
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(isWrite ? [] : rows.map(d => ({ id: d.id, sid: d.sid || null, data: d, updated_at: '2026-11-13T00:00:00.000Z' }))) });
}
const errs = [];
async function makePage(browser, vp, extra) {
  const ctx = await browser.newContext(Object.assign({ viewport: vp, locale: 'ko-KR' }, extra || {}));
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
const openCal = (page, ds) => page.evaluate(async (d) => {
  swTab('t-class'); await new Promise(r => setTimeout(r, 500));
  openClsDetail('u5-c1'); await new Promise(r => setTimeout(r, 500));
  _pgCalMonth = d.slice(0, 7); renderClsLessons('u5-c1');
  await new Promise(r => setTimeout(r, 700));
}, ds);

// 32px 에 못 미치는 누름 자리 — 단추·링크·onclick 이 달린 작은 것 (체크·라디오, 마우스 기기의 캘린더 줄 제외)
const SMALL = () => {
  const root = document.querySelector('.screen.active') || document.body;
  const out = [];
  root.querySelectorAll('button,a[href],[onclick]').forEach(el => {
    if (el.matches('input[type=checkbox],input[type=radio]')) return;
    if (el.closest('.pg-hw-row,.pg-chip,.pg-hw-head,.pg-hw-more,.pg-cell,.pg-dot')) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.height >= 31.5) return;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || st.display === 'inline' && el.tagName === 'A') return;
    // 큰 줄 전체가 눌리는 것(행·카드)은 누름 자리가 넓다 — 폭 220px 넘는 것은 뺀다
    if (el.tagName !== 'BUTTON' && r.width > 220) return;
    out.push(Math.round(r.height) + 'px "' + (el.textContent || '').trim().slice(0, 12) + '" [' + String(el.className).slice(0, 22) + ']');
  });
  return [...new Set(out)];
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  // ═══ ① 1366px ═══
  {
    const { ctx, page } = await makePage(browser, { width: 1366, height: 900 });
    // [1] 문제 은행 — 가짜 문항 셋
    const ib = await page.evaluate(async (items) => {
      swTab('t-data'); switchDataTab('items'); await new Promise(r => setTimeout(r, 700));
      _ibRows = items; renderItemList(); await new Promise(r => setTimeout(r, 400));
      const cards = document.querySelectorAll('#ib-list .ib-card').length;
      const btns = [...document.querySelectorAll('#dp-items button')].filter(b => b.offsetParent);
      const small = btns.filter(b => b.getBoundingClientRect().height < 31.5).map(b => Math.round(b.getBoundingClientRect().height) + 'px "' + b.textContent.trim().slice(0, 8) + '" [' + b.className + ']');
      const icons = [...document.querySelectorAll('#ib-list .ib-c-h .ib-ic')].filter(b => !b.classList.contains('ib-ic-l'))
        .map(b => ({ w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height), a: b.getAttribute('aria-label') || '' }));
      const head = document.querySelector('#ib-list .ib-card .ib-c-h');
      const rowsOne = head ? new Set([...head.querySelectorAll('.ib-ic')].map(b => Math.round(b.getBoundingClientRect().top))).size : 0;
      return { cards, n: btns.length, small, icons, rowsOne };
    }, ITEMS);
    ok('[1] 문제 은행(문항 셋) — 보이는 단추 32px 미만 0곳', ib.cards === 3 && ib.small.length === 0,
      '카드 ' + ib.cards + ' · 단추 ' + ib.n + '개 · 미만 ' + ib.small.length);
    ib.small.slice(0, 6).forEach(note);
    ok('[1] ☆·⋯ 는 32x32 아이콘 단추에 이름(aria-label)', ib.icons.length >= 6 && ib.icons.every(x => x.w >= 32 && x.h >= 32 && x.a),
      ib.icons.slice(0, 3).map(x => x.w + 'x' + x.h + ' ' + x.a).join(' · '));
    ok('[1] 카드의 줄 단추는 한 줄', ib.rowsOne === 1, ib.rowsOne + '줄');
    const card = await page.$('#ib-list .ib-card');
    if (card) await card.screenshot({ path: path.join(OUT, 'ib_card_1366.png') }).catch(() => { });

    // [2] 그날 창 — Esc · 바깥 · swTab · 다른 창 · [수업 기록]
    await openCal(page, today);
    const sh = await page.evaluate(async (ds) => {
      const has = () => !!document.getElementById('pg-daysheet');
      const out = {};
      pgDaySheet(ds); out.open = has();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await new Promise(r => setTimeout(r, 50)); out.esc = !has();
      pgDaySheet(ds); document.getElementById('pg-daysheet').click(); await new Promise(r => setTimeout(r, 50)); out.out = !has();
      pgDaySheet(ds); swTab('t-dash'); await new Promise(r => setTimeout(r, 300)); out.tab = !has();
      pgDaySheet(ds); openM('m-trash'); await new Promise(r => setTimeout(r, 100)); out.mo = !has(); closeM('m-trash');
      const m2 = document.getElementById('m-word-img'); pgDaySheet(ds); m2.classList.add('open'); await new Promise(r => setTimeout(r, 100));
      out.mo2 = !has(); m2.classList.remove('open');
      swTab('t-class'); await new Promise(r => setTimeout(r, 400)); openClsDetail('u5-c1'); await new Promise(r => setTimeout(r, 500));
      pgDaySheet(ds);
      const b = [...document.querySelectorAll('#pg-daysheet button')].find(x => x.textContent.trim() === '수업 기록');
      if (b) b.click(); await new Promise(r => setTimeout(r, 700));
      out.rec = !has() && !!document.querySelector('#cls-record-col.open');
      return out;
    }, today);
    ok('[2] 그날 창 — Esc 로 닫힌다', sh.open && sh.esc);
    ok('[2] 그날 창 — 바깥(어두운 자리)을 누르면 닫힌다', sh.out);
    ok('[2] 그날 창 — 탭을 바꾸면 닫힌다', sh.tab);
    ok('[2] 그날 창 — 다른 창이 열리면 닫힌다 (openM · class 로 열기 둘 다)', sh.mo && sh.mo2);
    ok('[2] [수업 기록] 을 누르면 창이 닫힌 뒤 기록이 열린다', sh.rec);
    await page.evaluate(() => { try { closeClsRecord(); } catch (e) { } });

    // [4] 숙제 꼴 그림 — 체크 네모와 줄
    const sw = await page.evaluate(() => {
      const ly = [...document.querySelectorAll('.pg-ly-b')].find(b => /숙제/.test(b.textContent));
      const s = ly && ly.querySelector('svg.pg-hwsw');
      const key = document.querySelector('.pg-key-line svg.pg-hwsw');
      return { ly: !!s, rect: s ? !!s.querySelector('rect') && !!s.querySelector('path') && !!s.querySelector('line') : false, key: !!key,
        w: s ? Math.round(s.getBoundingClientRect().width) : 0 };
    });
    ok('[4] 숙제 단추와 범례 그림이 체크 네모와 줄(☑ ─)', sw.ly && sw.rect && sw.key && sw.w >= 16, '폭 ' + sw.w + 'px');

    // [7] 숙제 표 줄 높이
    const al = await page.evaluate(async () => {
      swTab('t-assign'); await new Promise(r => setTimeout(r, 900));
      const rows = [...document.querySelectorAll('#assign-live .al-row:not(.al-head)')];
      const ib = [...document.querySelectorAll('#assign-live .al-ib')].map(b => Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height));
      return { n: rows.length, maxH: Math.max(...rows.map(r => r.getBoundingClientRect().height)), ib: [...new Set(ib)], aria: [...document.querySelectorAll('#assign-live .al-ib')].every(b => b.getAttribute('aria-label') && b.title) };
    });
    ok('[7] 숙제 표 줄 높이 56px 이하', al.n > 0 && al.maxH <= 56, '가장 높은 줄 ' + Math.round(al.maxH) + 'px · 줄 ' + al.n + '개');
    ok('[7] [일정]·[수정] 은 32x32 아이콘 단추 (title·aria-label)', al.ib.length === 1 && al.ib[0] === '32x32' && al.aria, al.ib.join(','));
    const live = await page.$('#assign-live');
    if (live) await live.screenshot({ path: path.join(OUT, 'assign_table_1366.png') }).catch(() => { });

    // [5] 선생님 여덟 탭 — 32px 미만 누름 자리
    const small = [];
    for (const tab of ['t-dash', 't-class', 't-stu', 't-assign', 't-tst', 't-bks', 't-les', 't-cfg']) {
      const r = await page.evaluate(async (o) => {
        swTab(o.tab); await new Promise(r => setTimeout(r, 650));
        if (o.tab === 't-class') { openClsDetail('u5-c1'); await new Promise(r => setTimeout(r, 600)); }
        if (o.tab === 't-stu') { loadStuPanel('u5-s1'); await new Promise(r => setTimeout(r, 700)); swSpTab('sp-books'); await new Promise(r => setTimeout(r, 400)); }
        return eval('(' + o.fn + ')')();
      }, { tab, fn: SMALL.toString() });
      r.forEach(x => small.push(tab + ' · ' + x));
    }
    ok('[5] 선생님 여덟 탭 — 32px 미만 누름 자리 0곳', small.length === 0, small.length + '곳');
    small.slice(0, 12).forEach(note);

    // [5] '클래스 만들기' — 반이 있으면 없고, 없으면 있다
    const mk = await page.evaluate(async () => {
      const find = () => [...document.querySelectorAll('#dash-today button,#dash-today span')].some(b => b.textContent.trim() === '클래스 만들기');
      const keep = _cache.globalClasses.map(c => Object.assign({}, c));
      _cache.globalClasses.forEach(c => { c.days = ['_'];});            // 오늘 수업은 없게, 반은 있게
      renderDash(); await new Promise(r => setTimeout(r, 400));
      const withCls = find();
      const save = _cache.globalClasses; _cache.globalClasses = [];
      renderDash(); await new Promise(r => setTimeout(r, 400));
      const noCls = find();
      _cache.globalClasses = keep; renderDash();
      return { withCls, noCls };
    });
    ok("[5] 반이 있으면 '클래스 만들기' 가 없다", mk.withCls === false);
    ok("[5] 반이 없으면 '클래스 만들기' 가 있다", mk.noCls === true);

    // [8] 창 아래 단추 — [취소] 다음 주 단추 · 읽기만 하는 창은 [닫기]
    const mo = await page.evaluate(() => {
      const bad = [], ro = [];
      document.querySelectorAll('.mo').forEach(m => {
        const groups = new Map();
        m.querySelectorAll('button').forEach(b => { if (b.classList.contains('bx')) return; const p = b.parentElement; if (!groups.has(p)) groups.set(p, []); groups.get(p).push(b); });
        groups.forEach(bs => {
          if (getComputedStyle(bs[0].parentElement).flexDirection === 'column') return;    // 세로로 늘어선 고르기 줄은 뺀다
          const ci = bs.findIndex(b => b.textContent.trim() === '취소');
          if (ci < 0) return;
          const pi = bs.findIndex(b => b.classList.contains('bt') || b.classList.contains('bp'));
          if (pi >= 0 && ci > pi) bad.push(m.id);
        });
        if (m.hasAttribute('data-ro')) ro.push({ id: m.id, ok: !!m.querySelector('.mo-foot button') && m.querySelector('.mo-foot button').textContent.trim() === '닫기' });
      });
      return { bad, ro };
    });
    ok('[8] 아래 단추 줄은 [취소] 다음 주 단추', mo.bad.length === 0, mo.bad.join(', ') || '모두');
    ok('[8] 읽기만 하는 창 ' + mo.ro.length + '개는 아래에 [닫기] 하나', mo.ro.length >= 9 && mo.ro.every(x => x.ok), mo.ro.filter(x => !x.ok).map(x => x.id).join(', ') || '모두');
    await ctx.close();
  }

  // ═══ ② 390px — 밀린 날 '숙 n/m' 이 잘리지 않는다 ═══
  {
    const { ctx, page } = await makePage(browser, { width: 390, height: 800 });
    await openCal(page, YESTERDAY);
    const r = await page.evaluate((ds) => {
      const h = document.querySelector('.pg-cal-card .pg-cell[data-ds="' + ds + '"] .pg-hw-head');
      if (!h) return { found: false };
      return { found: true, txt: h.innerText.replace(/\s+/g, ' ').trim(), cut: h.scrollWidth > h.clientWidth + 1, late: h.classList.contains('late'),
        color: getComputedStyle(h).color };
    }, YESTERDAY);
    ok("[3] 390px — 밀린 날 칸에 '숙 n/m' 이 잘리지 않고 다 보인다", r.found && /^숙 \d+\/\d+$/.test(r.txt) && !r.cut,
      r.found ? '"' + r.txt + '"' : '칸 없음');
    ok('[3] 밀림은 글 대신 색으로', r.found && r.late && r.color !== 'rgb(95, 102, 114)', r.color);
    const cal = await page.$('.pg-cal-card');
    if (cal) await cal.screenshot({ path: path.join(OUT, 'cal_390.png') }).catch(() => { });
    await ctx.close();
  }

  // ═══ ③ 손가락 기기를 흉내 낸 800px — 날 칸을 누르면 그날 창 ═══
  {
    const { ctx, page } = await makePage(browser, { width: 800, height: 1000 }, { hasTouch: true, isMobile: true });
    await openCal(page, today);
    const r = await page.evaluate(async (ds) => {
      const coarse = matchMedia('(pointer:coarse)').matches;
      const cell = document.querySelector('.pg-cal-card .pg-cell[data-ds="' + ds + '"]');
      const row = cell && cell.querySelector('.pg-hw-row');
      const pe = row ? getComputedStyle(row).pointerEvents : '';
      cell.click(); await new Promise(r => setTimeout(r, 300));
      return { coarse, open: !!document.getElementById('pg-daysheet'), pe };
    }, today);
    ok('[6] 손가락 기기 800px — 날 칸을 누르면 그날 창이 열린다', r.coarse && r.open, 'coarse=' + r.coarse);
    ok('[6] 손가락 기기에서는 칸 안 줄을 바로 누르지 않는다', r.pe === 'none', 'pointer-events ' + r.pe);
    await ctx.close();
  }

  await browser.close();
  ok('콘솔 오류 0건', errs.length === 0, errs.slice(0, 4).join(' | '));
  console.log('\n가짜 서버가 받은 요청: 읽기 ' + reqs.get + '건 · 쓰기 ' + reqs.write + '건 (실제 서버로는 0건)');
  console.log('\n' + pass.length + '/' + (pass.length + fail.length) + ' 통과');
  if (fail.length) { console.log('실패:\n - ' + fail.join('\n - ')); process.exit(1); }
})().catch(e => { console.error('실패:', e); process.exit(1); });
