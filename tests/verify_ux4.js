require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// fix/ux-4 ① 용어 — 선생님·학부모 화면의 '과제'·'미션' 을 '숙제' 로
//   · 선생님 여덟 탭(교재·문제는 13개 하위 화면까지)·학부모 두 탭의 보이는 글에 옛 말 0곳
//   · 왼쪽 메뉴는 '숙제', 검색(Ctrl K)에서 '과제' 로 쳐도 숙제 메뉴가 나온다
//   · 학생 화면은 '퀘스트' 그대로, 문장 속 옛 말 0곳
//   · swTab('t-assign') 과 저장된 숙제 자료는 그대로 열린다
// 가짜 서버만 쓴다. 실제 서버로는 한 건도 나가지 않는다. 이름·교재는 지어낸 것만.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { pageUrl } = require('./_page');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const fs = require('fs');
const OUT = path.join(__dirname, 'shots', 'ux4');
fs.mkdirSync(OUT, { recursive: true });
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };
const note = t => console.log('      · ' + t);

const T = new Date(), pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = ymd(T);
const shift = (ds, d) => { const x = new Date(ds + 'T12:00:00'); x.setDate(x.getDate() + d); return ymd(x); };
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];

const SNAP = {
  students: [
    { id: 'ux4-s1', name: '나봄', grade: '초4', cls: 'ux4-c1', pin: '0001', fee: 200000 },
    { id: 'ux4-s2', name: '이든', grade: '초5', cls: 'ux4-c1', pin: '0002', fee: 0 },
  ],
  globalClasses: [{
    id: 'ux4-c1', name: '보기반 가', active: true, days: DOWS.slice(), studentIds: ['ux4-s1', 'ux4-s2'],
    commonMaterials: { reading: { book: '보기 리딩 1', unit: 'Unit 1', bookId: 'ux4-tb1' } },
  }],
  globalTextbooks: [
    { id: 'ux4-tb1', type: 'textbook', title: '보기 리딩 1', category: '리딩',
      units: Object.fromEntries(Array.from({ length: 8 }, (_, i) => ['Unit ' + (i + 1), [{ word: 'barn', ko: '헛간' }]])) },
    { id: 'ux4-tb2', type: 'textbook', title: '보기 어휘 1', category: '어휘', units: { 'Day 1': [{ word: 'apple', ko: '사과' }] } },
  ],
  library: [{ id: 'ux4-lb1', title: '보기 원서 하나', series: '보기 시리즈', arLevel: '1.2' }],
  lessons: [{ id: 'ux4-l1', sid: 'ux4-s1', classId: 'ux4-c1', date: shift(today, -2), att: 'normal', cmt: '잘했어요',
    materials: { reading: { book: '보기 리딩 1', unit: 'Unit 2', bookId: 'ux4-tb1' } } }],
  assignments: [
    { id: 'ux4-a1', sid: 'ux4-s1', category: 'recur', text: '보기 리딩 1 읽기', bookTitle: '보기 리딩 1', bookId: 'ux4-tb1',
      date: today, due: shift(today, 10),
      schedule: Array.from({ length: 8 }, (_, i) => ({ date: shift(today, i - 2), book: '보기 리딩 1', unit: 'Unit ' + (i + 1), done: i < 2 })) },
    { id: 'ux4-a2', sid: 'ux4-s2', category: 'vocab', text: '보기 어휘 1', bookTitle: '보기 어휘 1', range: 'Day 1', due: today },
  ],
  tests: [{ id: 'ux4-t1', sid: 'ux4-s1', date: shift(today, -5), vocabCorrect: 16, vocabTotal: 20 }],
  readings: [{ id: 'ux4-r1', sid: 'ux4-s1', title: '보기 원서 하나', date: shift(today, -3), arLevel: '1.2', read: true }],
  logs: [{ id: 'ux4-g1', sid: 'ux4-s1', date: shift(today, -3), bookTitle: '보기 원서 하나', read: true }],
  vocab_cards: Array.from({ length: 4 }, (_, i) => ({ id: 'ux4-v' + i, sid: 'ux4-s1', word: 'word' + i, meaning: '보기 뜻', pos: 'n',
    addedDate: shift(today, -4), source: i === 0 ? '과제' : '리딩로그', hits: 1, misses: 0 })),
  notices: [], homeworks: [], textbooks: [], messages: [],
  monthlyReports: [], examSchedules: [], counsels: [], settings: {},
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

// 보이는 글에서 낱말 찾기 — '새로 생긴 것' 의 지난 줄은 뺀다(옛 줄은 고치지 않기로 했다)
const FINDWORD = (sel, words) => {
  const SKIP = '#dash-whatsnew,#cfg-whatsnew,.wn-row,#m-gsearch';
  const root = document.querySelector(sel) || document.body;
  const hits = [];
  const seen = new Set();
  root.querySelectorAll('*').forEach(el => {
    if (el.closest(SKIP)) return;
    const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
    if (!t.trim()) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') return;
    words.forEach(w => {
      if (t.indexOf(w) < 0) return;
      const key = w + '|' + t.trim().slice(0, 30);
      if (seen.has(key)) return;
      seen.add(key);
      hits.push({ w, t: t.trim().replace(/\s+/g, ' ').slice(0, 44), cls: (el.className || '').toString().slice(0, 26) });
    });
  });
  return hits;
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  // ═══ ① 선생님 여덟 탭 (교재·문제는 하위 13개까지) ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'teacher' }, { width: 1366, height: 900 });
    const TABS = ['t-dash', 't-class', 't-stu', 't-assign', 't-tst', 't-bks', 't-les', 't-cfg'];
    const all = [];
    for (const tab of TABS) {
      const hits = await page.evaluate(async (o) => {
        swTab(o.tab); await new Promise(r => setTimeout(r, 700));
        if (o.tab === 't-class') { openClsDetail('ux4-c1'); await new Promise(r => setTimeout(r, 600)); }
        if (o.tab === 't-stu') { loadStuPanel('ux4-s1'); await new Promise(r => setTimeout(r, 800)); }
        return eval('(' + o.fn + ')')('#' + o.tab, ['과제', '미션']);
      }, { tab, fn: FINDWORD.toString() });
      hits.forEach(h => all.push(tab + ' · ' + h.w + ' — "' + h.t + '" [' + h.cls + ']'));
    }
    // 교재·문제 13개 하위 화면
    const dataHits = await page.evaluate(async (fn) => {
      swTab('t-data'); await new Promise(r => setTimeout(r, 700));
      const out = [];
      for (const t of ['library', 'tbook', 'lib', 'word', 'bank', 'make', 'items', 'paper', 'iso', 'kit', 'ws', 'exam', 'master']) {
        switchDataTab(t); await new Promise(r => setTimeout(r, 330));
        eval('(' + fn + ')')('#t-data', ['과제', '미션']).forEach(h => out.push(t + ' · ' + h.w + ' — "' + h.t + '"'));
      }
      return out;
    }, FINDWORD.toString());
    dataHits.forEach(h => all.push('t-data/' + h));
    ok('[①] 선생님 여덟 탭 + 교재·문제 13화면에 옛 말 0곳', all.length === 0, all.length ? (all.length + '곳') : '0곳');
    all.slice(0, 12).forEach(h => note(h));

    const nav = await page.evaluate(() => ({
      nav: [...document.querySelectorAll('#s-teacher .t-sidebar .ntab-lbl')].map(e => e.textContent.trim()),
      sp: [...document.querySelectorAll('#t-stu .sptab')].map(e => e.textContent.trim()),
    }));
    ok("[①] 왼쪽 메뉴에 '숙제' (옛 '과제' 없음)", nav.nav.indexOf('숙제') >= 0 && nav.nav.indexOf('과제') < 0, nav.nav.join(' · '));

    // 저장된 숙제 자료가 그대로 열린다
    const asg = await page.evaluate(async () => {
      swTab('t-assign'); await new Promise(r => setTimeout(r, 900));
      const rows = [...document.querySelectorAll('#assign-live .al-row:not(.al-head) .al-nm')].map(e => e.textContent.trim());
      const head = (document.querySelector('#t-assign .st') || {}).textContent || '';
      const btn = [...document.querySelectorAll('#t-assign button')].map(b => b.textContent.trim()).filter(Boolean);
      return { rows, head: head.trim(), btn };
    });
    ok("[①] swTab('t-assign') 과 저장된 숙제가 그대로 열린다", asg.rows.length >= 2 && asg.rows.some(r => r.indexOf('보기 리딩 1') >= 0),
      '머리 "' + asg.head + '" · 줄 ' + asg.rows.length + '개 (' + asg.rows.join(' / ') + ')');
    ok("[①] 숙제 탭 단추가 새 말", asg.btn.some(b => /숙제 내기/.test(b)) && asg.btn.some(b => /한꺼번에 내기/.test(b)),
      asg.btn.join(' · '));

    // 검색에서 옛 말로도 찾아진다
    const gs = await page.evaluate(async () => {
      openGlobalSearch(); await new Promise(r => setTimeout(r, 300));
      const q = document.getElementById('gs-q'); q.value = '과제'; gsRender();
      await new Promise(r => setTimeout(r, 300));
      const items = [...document.querySelectorAll('#gs-results .gs-item')].map(e => e.innerText.replace(/\s+/g, ' ').trim());
      closeM('m-gsearch');
      return items;
    });
    ok("[①] 검색(Ctrl K)에 '과제' 를 치면 숙제 메뉴가 나온다", gs.some(x => /숙제/.test(x)), gs.slice(0, 3).join(' | ') || '(없음)');

    // 단어 카드 출처 — 저장된 값은 '과제', 보이는 말은 '숙제'
    const src = await page.evaluate(async () => {
      swTab('t-stu'); await new Promise(r => setTimeout(r, 500));
      await loadStuPanel('ux4-s1'); await new Promise(r => setTimeout(r, 300));   // 패널은 비동기로 그려진다 — 끝날 때까지 기다린다
      swSpTab('sp-vocab'); await new Promise(r => setTimeout(r, 800));
      const b = [...document.querySelectorAll('#sp-vocab .sp-vs')].map(e => e.textContent.trim());   // feat/pl-tabs-2: 출처는 알약 대신 표의 '출처' 칸 글자
      const stored = (_cache.vocab_cards || []).map(c => c.source);
      return { badges: b.filter(x => /숙제|과제|리딩로그/.test(x)), stored };
    });
    ok('[①] 단어 카드 출처 — 저장된 값은 그대로, 보이는 말만 숙제',
      src.stored.indexOf('과제') >= 0 && src.badges.indexOf('과제') < 0 && src.badges.indexOf('숙제') >= 0,
      '저장 ' + [...new Set(src.stored)].join(',') + ' · 보임 ' + [...new Set(src.badges)].join(','));
    await page.screenshot({ path: path.join(OUT, 'assign_1366.png') }).catch(() => { });
    await ctx.close();
  }

  // ═══ ② 학부모 두 탭 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'parent', sid: 'ux4-s1' }, { width: 390, height: 780 });
    const hits = await page.evaluate(async (fn) => {
      currentParentSid = 'ux4-s1'; loadParent('ux4-s1');
      await new Promise(r => setTimeout(r, 1500));
      const out = [];
      for (const t of ['les', 'score']) {
        const b = document.querySelector('#s-parent .stu-bottomnav .stutab[data-ppnav="' + t + '"]');
        if (b) b.click();
        await new Promise(r => setTimeout(r, 700));
        document.querySelectorAll('#pp-body details').forEach(d => d.open = true);
        await new Promise(r => setTimeout(r, 300));
        eval('(' + fn + ')')('#pp-body', ['과제', '미션']).forEach(h => out.push(t + ' · ' + h.w + ' — "' + h.t + '"'));
      }
      return out;
    }, FINDWORD.toString());
    ok('[①] 학부모 두 탭에 옛 말 0곳', hits.length === 0, hits.length ? hits.slice(0, 6).join(' | ') : '0곳');
    await ctx.close();
  }

  // ═══ ③ 학생 화면 — '퀘스트' 는 그대로 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'student', sid: 'ux4-s1' }, { width: 390, height: 780 });
    const r = await page.evaluate(async (fn) => {
      currentStudentSid = 'ux4-s1'; renderStudentHome('ux4-s1');
      await new Promise(r => setTimeout(r, 900));
      document.querySelectorAll('#st-home details').forEach(d => d.open = true);
      await new Promise(r => setTimeout(r, 300));
      const hits = eval('(' + fn + ')')('#st-home', ['과제', '미션']);
      return { hits, quest: (document.getElementById('st-home').innerText || '').indexOf('퀘스트') >= 0 };
    }, FINDWORD.toString());
    ok("[①] 학생 화면에 '퀘스트' 는 그대로", r.quest === true);
    ok('[①] 학생 화면 문장에 옛 말 0곳', r.hits.length === 0,
      r.hits.length ? r.hits.slice(0, 6).map(h => h.w + ':"' + h.t + '"').join(' | ') : '0곳');
    await ctx.close();
  }

  // ═══════════════ ② 크기·모서리·창·아이콘 ═══════════════
  // 보이는 글자의 크기 — 11px 미만·0.5px 단위가 남았는지 / 보이는 단추 높이 / 글이 칸 밖으로 삐져나왔는지
  const SIZE = () => {
    const out = { small: [], half: [], btn: [], spill: [] };
    const root = document.querySelector('.screen.active') || document.body;
    root.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none') return;
      const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      if (t && /[0-9A-Za-z가-힣]/.test(t)) {
        const fs = parseFloat(st.fontSize);
        if (fs < 11) out.small.push(fs + 'px "' + t.slice(0, 14) + '" [' + String(el.className).slice(0, 22) + ']');
        else if (Math.abs(fs - Math.round(fs)) > 0.01) out.half.push(fs + 'px "' + t.slice(0, 14) + '" [' + String(el.className).slice(0, 22) + ']');
        if (el.scrollWidth > el.clientWidth + 2 && st.overflowX === 'visible' && st.display !== 'inline' && el.clientWidth > 0)
          out.spill.push('"' + t.slice(0, 14) + '" ' + el.clientWidth + '→' + el.scrollWidth + ' [' + String(el.className).slice(0, 22) + ']');
      }
      if (el.tagName === 'BUTTON' && r.height < 31.5 && el.type !== 'checkbox' && el.type !== 'radio')
        out.btn.push(Math.round(r.height) + 'px "' + (el.textContent || '').trim().slice(0, 12) + '" [' + String(el.className).slice(0, 22) + ']');
    });
    const u = a => [...new Set(a)];
    return { small: u(out.small), half: u(out.half), btn: u(out.btn), spill: u(out.spill),
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  };
  const agg = { small: [], half: [], btn: [], spill: [], over: [] };
  const add = (where, r) => {
    r.small.forEach(x => agg.small.push(where + ' · ' + x)); r.half.forEach(x => agg.half.push(where + ' · ' + x));
    r.btn.forEach(x => agg.btn.push(where + ' · ' + x)); r.spill.forEach(x => agg.spill.push(where + ' · ' + x));
    if (r.over) agg.over.push(where + ' ' + r.over + 'px');
  };
  for (const W of [1366, 1024, 390]) {
    const { ctx, page } = await makePage(browser, { role: 'teacher' }, { width: W, height: 900 });
    for (const tab of ['t-dash', 't-class', 't-stu', 't-assign', 't-tst', 't-bks', 't-les', 't-cfg']) {
      const r = await page.evaluate(async (o) => {
        swTab(o.tab); await new Promise(r => setTimeout(r, 600));
        if (o.tab === 't-class') { openClsDetail('ux4-c1'); await new Promise(r => setTimeout(r, 600)); }
        if (o.tab === 't-stu') { loadStuPanel('ux4-s1'); await new Promise(r => setTimeout(r, 700)); }
        return eval('(' + o.fn + ')')();
      }, { tab, fn: SIZE.toString() });
      add(W + ' ' + tab, r);
    }
    if (W === 1366) {
      for (const t of ['library', 'tbook', 'lib', 'word', 'bank', 'make', 'items', 'paper', 'iso', 'kit', 'ws', 'exam', 'master']) {
        const r = await page.evaluate(async (o) => {
          swTab('t-data'); switchDataTab(o.t); await new Promise(r => setTimeout(r, 450));
          return eval('(' + o.fn + ')')();
        }, { t, fn: SIZE.toString() });
        add('1366 t-data/' + t, r);
      }
      await page.evaluate(async () => { swTab('t-dash'); await new Promise(r => setTimeout(r, 500)); });
      await page.screenshot({ path: path.join(OUT, 'dash_1366.png') }).catch(() => { });
      await page.evaluate(async () => { swTab('t-data'); switchDataTab('items'); await new Promise(r => setTimeout(r, 500)); });
      await page.screenshot({ path: path.join(OUT, 'items_1366.png') }).catch(() => { });

      // 창 58개 — 폭이 넷 중 하나 · × 가 있다
      const mo = await page.evaluate(async () => {
        const out = [];
        for (const m of [...document.querySelectorAll('.mo')]) {
          const d = m.querySelector('.mdl,.mdl-xl');
          const mw = d ? getComputedStyle(d).maxWidth : '';
          out.push({ id: m.id, mw, x: !!m.querySelector('.bx') });
        }
        return out;
      });
      const ALLOWED = ['480px', '720px', '1000px', '1200px'];
      const badW = mo.filter(x => ALLOWED.indexOf(x.mw) < 0), noX = mo.filter(x => !x.x);
      ok('[②] 창 ' + mo.length + '개의 폭이 480·720·1000·1200 중 하나', mo.length >= 58 && badW.length === 0,
        badW.length ? badW.map(x => x.id + ' ' + x.mw).join(', ') : mo.length + '개 모두');
      ok('[②] 창마다 오른쪽 위에 ×', noX.length === 0, noX.length ? noX.map(x => x.id).join(', ') : '모두');

      // 인쇄용 꼴은 건드리지 않았다 — 인쇄 문서를 만드는 함수에 글자 크기 토큰이 섞이지 않았다
      const pr = await page.evaluate(() => {
        const fns = ['makeVocabPaper', '_pbCss', '_pbPrintGo', 'lkPrint', 'isoPrint', 'prPrintTable', 'prPrintDiag', '_wsOpenSheet'];
        return fns.map(f => {
          const src = (typeof window[f] === 'function') ? window[f].toString() : '';
          return { f, has: !!src, tok: /var\(--fs-|var\(--r-card-lg|luIcon\(/.test(src), page: /page-break|@page|break-inside/.test(src) };
        });
      });
      ok('[②] 인쇄 문서를 만드는 함수 8개에 새 토큰·아이콘이 섞이지 않았다(앞과 같은 글자 크기·쪽 나눔)',
        pr.every(x => x.has && !x.tok), pr.map(x => x.f + (x.tok ? '✗' : '')).join(' · '));
    }
    if (W === 390) {
      const m390 = await page.evaluate(async () => {
        const bad = [];
        for (const m of [...document.querySelectorAll('.mo')]) {
          const was = m.style.display; m.classList.add('open'); if (was === 'none') m.style.display = 'flex';
          await new Promise(r => setTimeout(r, 15));
          const d = m.querySelector('.mdl,.mdl-xl');
          if (d) { const b = d.getBoundingClientRect(); if (b.width > 0 && (b.right > innerWidth + 1 || b.left < -1)) bad.push(m.id); }
          m.classList.remove('open'); m.style.display = was;
        }
        return bad;
      });
      ok('[②] 390px — 창이 화면을 넘지 않는다', m390.length === 0, m390.join(', ') || '0개');
      await page.evaluate(async () => { swTab('t-dash'); await new Promise(r => setTimeout(r, 500)); });
      await page.screenshot({ path: path.join(OUT, 'dash_390.png') }).catch(() => { });
    }
    await ctx.close();
  }
  // 학생 세 탭 · 학부모 두 탭
  for (const W of [1366, 390]) {
    {
      const { ctx, page } = await makePage(browser, { role: 'student', sid: 'ux4-s1' }, { width: W, height: 800 });
      for (const t of ['st-home', 'st-vocab', 'st-library']) {
        const r = await page.evaluate(async (o) => {
          currentStudentSid = 'ux4-s1'; if (o.t === 'st-home') renderStudentHome('ux4-s1');
          swStuTab(o.t); await new Promise(r => setTimeout(r, 700));
          return eval('(' + o.fn + ')')();
        }, { t, fn: SIZE.toString() });
        add(W + ' 학생 ' + t, r);
      }
      if (W === 390) await page.screenshot({ path: path.join(OUT, 'student_390.png') }).catch(() => { });
      await ctx.close();
    }
    {
      const { ctx, page } = await makePage(browser, { role: 'parent', sid: 'ux4-s1' }, { width: W, height: 800 });
      for (const t of ['les', 'score']) {
        const r = await page.evaluate(async (o) => {
          currentParentSid = 'ux4-s1'; loadParent('ux4-s1'); await new Promise(r => setTimeout(r, 1200));
          const b = document.querySelector('#s-parent .stu-bottomnav .stutab[data-ppnav="' + o.t + '"]'); if (b) b.click();
          await new Promise(r => setTimeout(r, 600));
          return eval('(' + o.fn + ')')();
        }, { t, fn: SIZE.toString() });
        add(W + ' 학부모 ' + t, r);
      }
      if (W === 390) await page.screenshot({ path: path.join(OUT, 'parent_390.png') }).catch(() => { });
      await ctx.close();
    }
  }
  ok('[②] 보이는 글자 11px 미만 0곳', agg.small.length === 0, agg.small.length + '곳');
  agg.small.slice(0, 8).forEach(note);
  ok('[②] 0.5px 단위 글자 0곳', agg.half.length === 0, agg.half.length + '곳');
  agg.half.slice(0, 8).forEach(note);
  ok('[②] 보이는 단추 높이 32px 미만 0곳 (체크·라디오 제외)', agg.btn.length === 0, agg.btn.length + '곳');
  agg.btn.slice(0, 40).forEach(note);
  ok('[②] 1366·1024·390px 문서 가로 넘침 0', agg.over.length === 0, agg.over.join(', ') || '0');
  ok('[②] 글이 단추·칸 밖으로 삐져나온 곳 0', agg.spill.length === 0, agg.spill.length + '곳');
  agg.spill.slice(0, 8).forEach(note);

  await browser.close();
  ok('콘솔 오류 0건', errs.length === 0, errs.slice(0, 4).join(' | '));
  console.log('\n가짜 서버가 받은 요청: 읽기 ' + reqs.get + '건 · 쓰기 ' + reqs.write + '건 (실제 서버로는 0건)');
  console.log('\n' + pass.length + '/' + (pass.length + fail.length) + ' 통과');
  if (fail.length) { console.log('실패:\n - ' + fail.join('\n - ')); process.exit(1); }
})().catch(e => { console.error('실패:', e); process.exit(1); });
