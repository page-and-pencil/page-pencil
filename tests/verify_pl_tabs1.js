require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 숙제 탭·테스트 탭도 대시보드 꼴 (feat/pl-tabs-1, 2026-11-15 Todd 결정)
//   상자 대신 제목 줄과 가는 선 · 색은 상태와 주 단추에만 · 굵기 400·600
// 가짜 서버만 쓴다. 이름·반·교재는 지어낸 것만. 실제 서버로는 한 건도 나가지 않는다.
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };
const OUT = process.env.PP_TEST_OUT ? path.join(process.env.PP_TEST_OUT, 'pltabs') : path.join(__dirname, 'shots', 'pltabs');
fs.mkdirSync(OUT, { recursive: true });

const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = ymd(new Date());
const shift = (ds, d) => { const x = new Date(ds + 'T12:00:00'); x.setDate(x.getDate() + d); return ymd(x); };
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
const WIN = Array.from({ length: 15 }, (_, i) => shift(today, i - 7));
const UNITS = Array.from({ length: 20 }, (_, i) => 'Unit ' + (i + 1));

const D = {
  students: [
    { id: 'pt-s1', name: '나봄', grade: '초4', pin: '0001', fee: 0 },
    { id: 'pt-s2', name: '다온', grade: '중1', pin: '0002', fee: 0 },
  ],
  classes: [{ id: 'pt-c1', name: '보기반 가', active: true, days: DOWS.slice(), studentIds: ['pt-s1', 'pt-s2'],
    commonMaterials: { reading: { book: '보기 리딩 1', unit: 'Unit 1', bookId: 'pt-tb1' } } }],
  global_textbooks: [{ id: 'pt-tb1', type: 'textbook', title: '보기 리딩 1', category: '리딩', units: Object.fromEntries(UNITS.map(u => [u, [{ word: 'barn' }]])) }],
  lessons: [],
  assignments: [
    // 반복 — 지난 주에 안 한 날이 있다 (밀림) · 오늘 몫 아직
    { id: 'pt-a1', sid: 'pt-s1', category: 'recur', text: '보기 리딩 1 매일', bookTitle: '보기 리딩 1', date: WIN[0], due: WIN[14],
      schedule: WIN.map((d, i) => ({ date: d, book: '보기 리딩 1', unit: 'Unit ' + (i + 1), done: d < today && i % 3 !== 0, doneBy: 'student' })) },
    // 클래스5 — 밀린 날 없음 · 오늘 몫 아직
    { id: 'pt-a2', sid: 'pt-s2', category: 'class5', text: '클래스5', bookTitle: '보기 클래스5', date: WIN[0], due: WIN[14],
      schedule: WIN.map((d, i) => ({ date: d, book: '보기 클래스5', unit: '과 ' + (i + 1), done: d < today, doneBy: 'student' })) },
    // 단건 — 오늘 마감 · 학생이 올렸고 아직 확인 안 함
    { id: 'pt-a3', sid: 'pt-s2', category: 'grammar', text: '보기 어법', bookTitle: '보기 어법 1', range: 'p.10', date: shift(today, -2), due: today },
  ],
  homeworks: [{ id: 'pt-h1', sid: 'pt-s2', assignmentId: 'pt-a3', submitted: true, checked: false, date: today }],
  tests: [],
};
const TESTS = [];
for (let i = 0; i < 12; i++) TESTS.push({ id: 'pt-t' + i, sid: i % 2 ? 'pt-s2' : 'pt-s1', date: shift(today, -i), attempt: 1, absent: false, passPct: 90,
  vocabCorrect: i === 1 ? 6 : 9, vocabTotal: 10, grammarCorrect: 8, grammarTotal: 10, readingCorrect: i === 2 ? 7 : 0, readingTotal: i === 2 ? 10 : 0,
  listeningCorrect: 0, listeningTotal: 0, allWords: ['barn', 'calm'], wrongWords: i === 1 ? ['barn', 'calm', 'vast', 'enormous', 'quickly', 'slowly'] : [], grammarWeak: '', cmt: '' });
let NO_TESTS = false;
const writes = { by: {}, n: 0 };
const serve = r => {
  const req = r.request();
  const t = (new URL(req.url()).pathname.split('/rest/v1/')[1] || '').split('?')[0];
  if (req.method() !== 'GET' && req.method() !== 'HEAD') {
    writes.n++; writes.by[t] = (writes.by[t] || 0) + 1;
    if (t === 'tests') { try { writes.lastTest = JSON.parse(req.postData() || 'null'); } catch (e) { } }
    return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  }
  const rows = t === 'tests' ? (NO_TESTS ? [] : TESTS) : D[t];
  if (rows) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows.map(x => ({ id: x.id, sid: x.sid || null, updated_at: '2026-11-15T00:00:00Z', data: x }))) });
  return r.continue();
};

// 탭 안을 재는 도구 — 그림자·dash-stat·그림 문자·굵기·바탕·작은 누름 자리·한쪽 굵은 선
// skipSel(숙제 캘린더) 안은 바탕·그림 문자·굵기를 세지 않는다 — 지침 [4] '달력 안은 손대지 않는다'
const MEASURE = ({ sel, skipSel }) => {
  const root = document.querySelector(sel);
  const skip = skipSel ? [...document.querySelectorAll(skipSel)] : [];
  const inSkip = e => skip.some(s => s.contains(e));
  const vis = e => { if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const all = [...root.querySelectorAll('*')].filter(vis);
  const nm = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const shadow = all.filter(e => getComputedStyle(e).boxShadow !== 'none').map(nm);
  const bgs = new Map();
  all.filter(e => !inSkip(e)).forEach(e => { const c = getComputedStyle(e).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && !/, 0\)$/.test(c)) bgs.set(c, (bgs.get(c) || 0) + 1); });
  const own = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  const emo = all.filter(e => !inSkip(e) && /\p{Extended_Pictographic}/u.test(own(e))).map(e => nm(e) + ' "' + own(e).slice(0, 16) + '"');
  const w = new Map(), odd = [];
  all.forEach(e => { if (!own(e) || inSkip(e)) return; const fw = getComputedStyle(e).fontWeight; w.set(fw, (w.get(fw) || 0) + 1); if (fw !== '400' && fw !== '600' && odd.length < 6) odd.push(fw + ' ' + nm(e) + ' "' + own(e).slice(0, 12) + '"'); });
  const clk = e => e.matches('button,a[href],summary,select,input,textarea,[onclick]');
  const small = all.filter(e => {
    if (!clk(e) || inSkip(e)) return false;
    if (e.matches('input[type=checkbox],input[type=radio]') && e.closest('label')) { const lb = e.closest('label').getBoundingClientRect(); if (lb.height >= 32) return false; }
    const b = e.getBoundingClientRect(); if (b.height >= 32 && b.width >= 32) return false;
    for (let p = e.parentElement; p && p !== root; p = p.parentElement) if (clk(p)) { const pb = p.getBoundingClientRect(); if (pb.height >= 32) return false; }
    return true;
  }).map(e => nm(e) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
  const side = all.filter(e => { const cs = getComputedStyle(e); const L = cs.borderLeftStyle === 'none' ? 0 : parseFloat(cs.borderLeftWidth) || 0;
    if (L < 2) return false; const o = Math.max(...['Top', 'Right', 'Bottom'].map(k => cs['border' + k + 'Style'] === 'none' ? 0 : parseFloat(cs['border' + k + 'Width']) || 0)); return L > o + 1.5; }).map(nm);
  return { shadow, bgs: [...bgs.entries()], emo, w: [...w.entries()], odd, small, side, stat: root.querySelectorAll('.dash-stat').length };
};
const judge = (tab, m) => {
  ok(tab + ' — 그림자 0 · .dash-stat 0 · 한쪽 굵은 선 0', m.shadow.length === 0 && m.stat === 0 && m.side.length === 0,
    '그림자 ' + m.shadow.slice(0, 3).join(',') + ' · dash-stat ' + m.stat + ' · 한쪽 선 ' + m.side.slice(0, 3).join(','));
  ok(tab + ' — 그림 문자 0', m.emo.length === 0, m.emo.slice(0, 4).join(' | '));
  ok(tab + ' — 굵기 400·600 뿐', m.w.every(([x]) => x === '400' || x === '600'), m.w.map(([x, n]) => x + '×' + n).join(' · ') + (m.odd.length ? ' | ' + m.odd.join(' | ') : ''));
  ok(tab + ' — 바탕색 다섯 가지 이하', m.bgs.length <= 5, m.bgs.map(([k, n]) => k + '×' + n).join(' · '));
  ok(tab + ' — 32px 미만 누름 자리 0곳', m.small.length === 0, m.small.slice(0, 6).join(' · '));
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const errs = [];
  const mk = async (vp) => {
    const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR' });
    await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); localStorage.setItem('pp_lastBackup', new Date().toISOString().slice(0, 7)); } catch (e) { } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    await page.route('**/rest/v1/**', serve);
    await page.route('**/functions/v1/**', r => r.fulfill({ status: 400, contentType: 'application/json', body: '{}' }));
    await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
    await wait(1500);
    return { ctx, page };
  };
  // 앱이 뜰 때 하는 동기화 쓰기는 세지 않는다 — 여기서부터 센다
  const settle = async () => { for (let t = 0, last = writes.n, still = 0; t < 12000 && still < 2500; t += 200) { await wait(200); if (writes.n === last) still += 200; else { last = writes.n; still = 0; } } };

  // ═══ ① 숙제 탭 1366x800 ═══
  {
    const { ctx, page } = await mk({ width: 1366, height: 800 });
    await page.evaluate(async () => { swTab('t-assign'); await new Promise(r => setTimeout(r, 700)); });
    await settle();
    judge('숙제', await page.evaluate(MEASURE, { sel: '#t-assign', skipSel: '#assign-cal' }));
    const head = await page.evaluate(() => ({ sum: document.getElementById('assign-sum').textContent, btn: (document.querySelector('#t-assign .pl-head-btn') || {}).textContent,
      cells: [...document.querySelectorAll('#assign-stats .pl-stat')].map(c => c.querySelector('.pl-stat-l').textContent + ' ' + c.querySelector('.pl-num').textContent),
      words: /오늘 마감|미제출/.test(document.getElementById('t-assign').innerText),
      chips: document.querySelectorAll('#assign-live [onclick*="alSetFilter"]').length,
      ssub: /반·학생에게 숙제를 내고/.test(document.getElementById('t-assign').innerText) }));
    ok("머리 한 줄 '진행 중 n건 · 오늘 몫 n건 · 밀림 n건' · [+ 숙제 내기] · 늘 같은 설명 글 없음", /^진행 중 \d+건 · 오늘 몫 \d+건 · 밀림 \d+건/.test(head.sum) && /숙제 내기/.test(head.btn) && !head.ssub, head.sum);
    ok("숫자 줄 네 칸 (진행 중 · 오늘 몫 · 밀림 · 확인 대기)", head.cells.map(x => x.replace(/ \d+$/, '')).join(',') === '진행 중,오늘 몫,밀림,확인 대기', head.cells.join(' | '));
    ok("'오늘 마감'·'미제출' 글 0곳 · 표 안 거르기 칩 0", !head.words && head.chips === 0, '칩 ' + head.chips);
    await page.screenshot({ path: path.join(OUT, 'assign_1366.png') });
    // 밀림 칸 → 밀린 숙제만
    await page.click('#assign-stats .pl-stat[data-k="late"]'); await wait(300);
    const late = await page.evaluate(() => { const rows = [...document.querySelectorAll('#assign-live .al-row:not(.al-head)')].filter(r => !r.closest('.al-done-b'));
      return { n: rows.length, allLate: rows.every(r => r.querySelector('.al-late.bad')), on: document.querySelector('#assign-stats .pl-stat[data-k="late"]').classList.contains('on'),
        bg: getComputedStyle(document.querySelector('#assign-stats .pl-stat[data-k="late"]')).backgroundColor }; });
    ok("'밀림' 을 누르면 표에 밀린 숙제만 · 그 칸이 고른 표시", late.n >= 1 && late.allLate && late.on && late.bg !== 'rgba(0, 0, 0, 0)', JSON.stringify(late));
    await page.click('#assign-stats .pl-stat[data-k="check"]'); await wait(300);
    const chk = await page.evaluate(() => [...document.querySelectorAll('#assign-live .al-row:not(.al-head) .al-nm')].map(e => e.textContent));
    ok("'확인 대기' 를 누르면 확인할 숙제만", chk.length === 1 && /어법/.test(chk[0]), chk.join(','));
    await page.click('#assign-stats .pl-stat[data-k="check"]'); await wait(200);
    // 오늘 숙제 — 체크 네모로 완료
    const before = await page.evaluate(() => ({ today: document.querySelector('#assign-stats .pl-stat[data-k="today"] .pl-num').textContent, dash: hwDayCount('pt-s1', ppToday()) }));
    const n0 = writes.n;
    const rowSel = '#assign-list .asg-row:not(.done) .pl-cb';
    const tgt = await page.evaluate(sel => { const b = document.querySelector(sel); const r = b.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), t: b.closest('.asg-row').querySelector('.pl-row-t').textContent }; }, rowSel);
    await page.click(rowSel); await wait(600);
    const after = await page.evaluate(async () => { const o = { today: document.querySelector('#assign-stats .pl-stat[data-k="today"] .pl-num').textContent, dash: hwDayCount('pt-s1', ppToday()) };
      swTab('t-dash'); await new Promise(r => setTimeout(r, 500));
      const tr = [...document.querySelectorAll('#dash-weekheat tbody tr')].find(t => /나봄/.test(t.textContent));
      const th = [...document.querySelectorAll('#dash-weekheat thead th')]; const ti = th.findIndex(h => h.classList.contains('today'));
      o.dashCell = tr && ti > 0 ? tr.children[ti].textContent.replace(/[^0-9/]/g, '') : '';
      swTab('t-assign'); await new Promise(r => setTimeout(r, 400)); return o; });
    ok('오늘 숙제 체크 네모(32px) — 누르면 완료가 바뀌고 쓰기 1건 · 숫자 줄과 대시보드 이번 주 숙제가 같이 바뀐다',
      tgt.h >= 32 && tgt.w >= 32 && writes.n - n0 === 1 && Number(after.today) === Number(before.today) - 1 && after.dash.done === before.dash.done + 1 && after.dashCell === after.dash.done + '/' + after.dash.total,
      '"' + tgt.t + '" ' + tgt.w + 'x' + tgt.h + ' · 쓰기 ' + (writes.n - n0) + ' · 오늘 몫 ' + before.today + '→' + after.today + ' · 대시보드 ' + before.dash.done + '/' + before.dash.total + '→' + after.dashCell);
    // ⋯ — 세 항목, '이 날 빼기' 는 전과 같이
    await page.click('#assign-list .asg-row .pl-more'); await wait(200);
    const menu = await page.evaluate(() => [...document.querySelectorAll('#pl-menu .pl-menu-i')].map(b => b.textContent + (b.disabled ? '(꺼짐)' : '')));
    ok("⋯ 에 '이 날 빼기 · 기록 리셋 · 삭제'", menu.join(',') === '이 날 빼기,기록 리셋,삭제', menu.join(','));
    const n1 = writes.n;
    const aid = await page.evaluate(() => { const b = document.querySelector('#assign-list .asg-row .pl-more'); return /asgMenu\(this,'([^']+)'/.exec(b.getAttribute('onclick'))[1]; });
    await page.click('#pl-menu .pl-menu-i:first-child'); await wait(300);
    await page.evaluate(() => { const b = [...document.querySelectorAll('#m-confirm button')].find(x => /빼기/.test(x.textContent)); if (b) b.click(); }); await wait(600);
    const gone = await page.evaluate(aid => !(_cache.assignments.find(a => a.id === aid).schedule || []).some(x => x.date === ppToday()), aid);
    ok("'이 날 빼기' — 확인 창 뒤 그 날 몫이 빠진다 (쓰기 1건)", gone && writes.n - n1 === 1, '쓰기 ' + (writes.n - n1));
    // 390
    await page.setViewportSize({ width: 390, height: 780 }); await wait(400);
    const m390 = await page.evaluate(() => { const c = [...document.querySelectorAll('#assign-stats .pl-stat')].map(x => { const b = x.getBoundingClientRect(); return Math.round(b.top) + ',' + Math.round(b.left); });
      return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, tops: new Set(c.map(x => x.split(',')[0])).size, lefts: new Set(c.map(x => x.split(',')[1])).size, n: c.length }; });
    ok('숙제 390x780 — 가로 넘침 0 · 숫자 줄 2x2', m390.over === 0 && m390.n === 4 && m390.tops === 2 && m390.lefts === 2, JSON.stringify(m390));
    judge('숙제 390', await page.evaluate(MEASURE, { sel: '#t-assign', skipSel: '#assign-cal' }));
    await page.screenshot({ path: path.join(OUT, 'assign_390.png') });
    await ctx.close();
  }

  // ═══ ② 테스트 탭 1366x800 ═══
  {
    const { ctx, page } = await mk({ width: 1366, height: 800 });
    await page.evaluate(async () => { swTab('t-tst'); await new Promise(r => setTimeout(r, 700)); });
    await settle();
    judge('테스트', await page.evaluate(MEASURE, { sel: '#t-tst' }));
    const first = await page.evaluate(() => { const r = document.querySelector('#tst-list tbody tr'); const b = r ? r.getBoundingClientRect() : null;
      return { vis: !!b && b.bottom <= innerHeight && b.top >= 0, formHidden: document.getElementById('tst-form').hidden, sum: document.getElementById('tst-sum').textContent,
        cells: [...document.querySelectorAll('#tst-stats .pl-stat .pl-stat-l')].map(e => e.textContent),
        head: [...document.querySelectorAll('#tst-list thead th')].map(e => e.textContent), bad: document.querySelectorAll('#tst-list td.bad').length,
        wr: (() => { const td = document.querySelector('#tst-list td.tst-wr[title*="enormous"]'); return td ? { h: Math.round(td.getBoundingClientRect().height), title: td.title } : null; })() }; });
    ok("기록이 있으면 첫 화면에 목록 첫 줄 · 입력은 접혀 있다", first.vis && first.formHidden, JSON.stringify({ vis: first.vis, hidden: first.formHidden }));
    ok("머리 '이번 달 n건 · 단어 평균 n%' · 숫자 줄 네 칸", /^이번 달 \d+건 · 단어 평균 \d+%/.test(first.sum) && first.cells.join(',') === '이번 달 테스트,단어 평균,응시 학생,보완 필요', first.sum + ' | ' + first.cells.join(','));
    ok('테스트 기록 표 — 날짜·학생·종류·단어·어법·리딩·리스닝·틀린 단어 · 통과 기준 미달 단어 점수만 --badt · 틀린 단어 한 줄+title', first.head.slice(0, 8).join(',') === '날짜,학생,종류,단어,어법,리딩,리스닝,틀린 단어' && first.bad === 1 && !!first.wr && first.wr.h <= 44,
      first.head.join(',') + ' · 미달 ' + first.bad + ' · ' + JSON.stringify(first.wr));
    await page.screenshot({ path: path.join(OUT, 'tst_1366.png') });
    // 보완 필요 — 누르면 미달만, 다시 누르면 풀린다
    await page.click('#tst-stats .pl-stat[data-k="low"]'); await wait(300);
    const low = await page.evaluate(() => ({ n: document.querySelectorAll('#tst-list tbody tr').length, on: document.querySelector('#tst-stats .pl-stat[data-k="low"]').classList.contains('on') }));
    await page.click('#tst-stats .pl-stat[data-k="low"]'); await wait(300);
    const low2 = await page.evaluate(() => document.querySelectorAll('#tst-list tbody tr').length);
    ok("'보완 필요' 를 누르면 미달 기록만, 다시 누르면 풀린다", low.n === 1 && low.on && low2 === 10, low.n + '줄 → ' + low2 + '줄');
    // [+ 결과 입력] → 저장 → 목록에 줄 · 저장 값은 전과 같다
    await page.click('#t-tst .pl-head-btn'); await wait(300);
    const opened = await page.evaluate(() => { const f = document.getElementById('tst-form'); const r = document.getElementById('tst-form-sec').getBoundingClientRect(); return { open: !f.hidden, top: Math.round(r.top) }; });
    await page.screenshot({ path: path.join(OUT, 'tst_form_open.png') });
    await page.evaluate(() => { const v = (i, x) => { const e = document.getElementById(i); e.value = x; }; v('ts-stu', 'pt-s2'); v('ts-date', ppToday()); v('ts-kind', 'school'); tsKindChange(); v('ts-achv', 'B'); v('ts-vc', '8'); v('ts-vt', '10'); v('ts-wr', 'barn, calm'); });
    const nT = (writes.by.tests || 0);
    await page.evaluate(async () => { await saveTst(); await new Promise(r => setTimeout(r, 500)); });
    const saved = await page.evaluate(() => { const t = _cache.tests[0]; const r = document.getElementById('tst-row-' + t.id);
      return { keys: Object.keys(t).sort().join(','), kind: t.testKind, achv: t.schoolAchv, vc: t.vocabCorrect, vt: t.vocabTotal, gt: t.grammarTotal, wr: t.wrongWords, row: !!r, formHidden: document.getElementById('tst-form').hidden }; });
    const KEYS = 'absent,allWords,attempt,cmt,date,grammarCorrect,grammarTotal,grammarWeak,id,listeningCorrect,listeningTotal,passPct,photoUrl,readingCorrect,readingTotal,schoolAchv,sid,testKind,vocabCorrect,vocabTotal,wrongWords';
    ok('[+ 결과 입력] 으로 펼쳐 저장 — 목록에 줄이 생기고 입력이 접힌다 · 저장 값(testKind 등)이 전과 같다',
      opened.open && opened.top <= 200 && saved.row && saved.formHidden && saved.keys === KEYS && saved.kind === 'school' && saved.achv === 'B' && saved.vc === 8 && saved.vt === 10 && saved.gt === 0 && (writes.by.tests || 0) - nT === 1,
      JSON.stringify(saved) + ' · 펼친 자리 ' + opened.top + 'px');
    // [수정] — 그 기록 값으로, 리딩 점수가 있으면 리딩 구역이 펼쳐진다
    await page.evaluate(() => tstEditInline('pt-t2')); await wait(300);
    const ed = await page.evaluate(() => ({ open: !document.getElementById('tst-form').hidden, vc: document.getElementById('ts-vc').value, rc: document.getElementById('ts-rc').value,
      rd: document.getElementById('ts-fold-rd').open, ls: document.getElementById('ts-fold-ls').open, title: document.getElementById('tst-form-title').textContent }));
    ok('[수정] 은 그 기록 값으로 펼쳐지고, 리딩 점수가 있으면 리딩 구역이 펼쳐진다', ed.open && ed.vc === '9' && ed.rc === '7' && ed.rd && !ed.ls, JSON.stringify(ed));
    await page.evaluate(() => { document.getElementById('ts-vc').value = '10'; });
    const nT2 = (writes.by.tests || 0), len0 = await page.evaluate(() => _cache.tests.length);
    await page.evaluate(async () => { await saveTst(); await new Promise(r => setTimeout(r, 400)); });
    const ed2 = await page.evaluate(() => { const t = _cache.tests.find(x => x.id === 'pt-t2'); return { vc: t.vocabCorrect, rc: t.readingCorrect, len: _cache.tests.length, attempt: t.attempt, hidden: document.getElementById('tst-form').hidden }; });
    ok('[수정] 저장은 그 기록을 고친다 (새 줄 아님)', ed2.vc === 10 && ed2.rc === 7 && ed2.len === len0 && ed2.hidden && (writes.by.tests || 0) - nT2 === 1, JSON.stringify(ed2));
    // 390
    await page.setViewportSize({ width: 390, height: 780 }); await wait(400);
    const m390 = await page.evaluate(() => { const c = [...document.querySelectorAll('#tst-stats .pl-stat')].map(x => { const b = x.getBoundingClientRect(); return Math.round(b.top) + ',' + Math.round(b.left); });
      return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, tops: new Set(c.map(x => x.split(',')[0])).size, lefts: new Set(c.map(x => x.split(',')[1])).size, n: c.length }; });
    ok('테스트 390x780 — 가로 넘침 0 · 숫자 줄 2x2', m390.over === 0 && m390.n === 4 && m390.tops === 2 && m390.lefts === 2, JSON.stringify(m390));
    judge('테스트 390', await page.evaluate(MEASURE, { sel: '#t-tst' }));
    await page.screenshot({ path: path.join(OUT, 'tst_390.png') });
    await ctx.close();
  }

  // ═══ ③ 기록이 없으면 입력이 펼쳐져 있다 ═══
  {
    NO_TESTS = true;
    const { ctx, page } = await mk({ width: 1366, height: 800 });
    const r = await page.evaluate(async () => { swTab('t-tst'); await new Promise(r => setTimeout(r, 600)); return { open: !document.getElementById('tst-form').hidden, sum: document.getElementById('tst-sum').textContent }; });
    ok("기록이 없으면 입력이 펼쳐져 있다 · 머리 '이번 달 기록 없음'", r.open && r.sum === '이번 달 기록 없음', JSON.stringify(r));
    await ctx.close();
    NO_TESTS = false;
  }

  console.log('\n콘솔 오류 ' + errs.length + '건' + (errs.length ? '\n  ' + errs.slice(0, 5).join('\n  ') : ''));
  ok('콘솔 오류 없음', errs.length === 0);
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_pl_tabs1 실패:', e); process.exit(1); });
