require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// P2-1 검증. 실데이터 GET 만, 쓰기 전부 차단. 저장 없음.
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = (process.env.PP_REAL_SID || '');
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const writes = [], errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"server":true,"ready":true}' }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await page.waitForTimeout(4500);

  // ───── 1. 회귀: unit1↔unit11, 기존 연결 유지 ─────
  console.log('── 1  회귀');
  const r1 = await page.evaluate(() => {
    const mk = (keys, titles) => ({ units: Object.fromEntries(keys.map(k => [k, []])), unitOrder: keys, unitTitles: titles || {} });
    const a = mk(['Unit 1', 'Unit 11']);
    const b = mk(['DAY 01', 'DAY 10']);
    const c = mk(['Unit 1 New Friends', 'Unit 11 Big or Small']);
    const d = mk(['Lesson 1', 'Lesson 12']);
    return {
      u1: ppMatchUnit(a, 'Unit 1'), u11: ppMatchUnit(a, 'Unit 11'),
      d1: ppMatchUnit(b, 'Day 1'), d10: ppMatchUnit(b, 'Day 10'),
      c1: ppMatchUnit(c, 'Unit 1'), c11: ppMatchUnit(c, 'Unit 11'),
      l1: ppMatchUnit(d, 'Lesson 1'), l12: ppMatchUnit(d, 'Lesson 12'),
      multi: ppMatchUnit(a, 'Unit 1, Unit 11'),
      none: ppMatchUnit(a, ''), none2: ppMatchUnit(a, '없는단원'),
    };
  });
  say(r1.u1.join() === 'Unit 1' && r1.u11.join() === 'Unit 11', 'unit1 이 unit11 에 붙지 않는다', JSON.stringify(r1.u1) + ' / ' + JSON.stringify(r1.u11));
  say(r1.c1.join() === 'Unit 1 New Friends' && r1.c11.join() === 'Unit 11 Big or Small', '소제목이 붙은 키도 번호로 정확히', JSON.stringify(r1.c1));
  say(r1.l1.join() === 'Lesson 1' && r1.l12.join() === 'Lesson 12', 'Lesson 1 이 Lesson 12 에 붙지 않는다');
  say(r1.d1.join() === 'DAY 01' && r1.d10.join() === 'DAY 10', "앞자리 0 무시 — 'Day 1' → 'DAY 01'", JSON.stringify(r1.d1) + ' / ' + JSON.stringify(r1.d10));
  say(r1.multi.length === 2, '쉼표로 여러 단원', JSON.stringify(r1.multi));
  say(!r1.none.length && !r1.none2.length, '빈 값·없는 이름은 빈 배열');

  // ───── 2. 실데이터: 요즘 2 / EFL / Easy Link ─────
  console.log('\n── 2  실데이터 매칭');
  const r2 = await page.evaluate(() => {
    const T = t => (_cache.globalTextbooks || []).find(b => b.title === t);
    const y2 = T('요즘 초등 영단어 2'), p4 = T('EFL Phonics 4'), p1 = T('EFL Phonics 1'), el = T('Easy Link Starter 1'), sl = T('Smart Listening 1.1');
    return {
      y2keys: y2 ? tbUnitKeys(y2).length : -1,
      y2total: y2 ? (y2.totalUnits || 0) : -1,
      y2u5: y2 ? ppMatchUnit(y2, 'Unit 5') : [], y2u5t: y2 ? (y2.unitTitles || {})['Unit 5'] : '',
      p4th: p4 ? ppMatchUnit(p4, 'th') : [], p4sm: p4 ? ppMatchUnit(p4, 'sm~wh') : [], p4ft: p4 ? ppMatchUnit(p4, 'Final test') : [],
      p1ml: p1 ? ppMatchUnit(p1, 'M~O') : [], p1al: p1 ? ppMatchUnit(p1, 'A~L') : [],
      elr: el ? ppMatchUnit(el, 'Review 1-4') : [], elr2: el ? ppMatchUnit(el, 'Review 9-12') : [],
      slr: sl ? ppMatchUnit(sl, 'Review') : [], slu1: sl ? ppMatchUnit(sl, 'Unit 1') : [],
    };
  });
  say(r2.y2keys === 30, '요즘 초등 영단어 2 단원 30개', r2.y2keys + '개 · totalUnits ' + r2.y2total);
  say(r2.y2u5.join() === 'Unit 5' && r2.y2u5t === 'Review Test', 'Unit 5 = Review Test', r2.y2u5t);
  say(r2.p4th.join() === 'Unit 8', "EFL Phonics 4 'th' → Unit 8 (소제목 'ph th wh')", r2.p4th.join());
  say(r2.p4sm.join() === 'Review 2', "'sm~wh' → Review 2", r2.p4sm.join());
  say(r2.p4ft.join() === 'Test', "'Final test' → Test", r2.p4ft.join());
  say(r2.p1ml.join() === 'Unit 5', "EFL Phonics 1 'M~O' → Unit 5 ('Mm Nn Oo')", r2.p1ml.join());
  say(r2.p1al.join() === 'Review 1', "'A~L' → Review 1 ('Aa-Ll')", r2.p1al.join());
  say(r2.elr.join() === 'Review 1' && r2.elr2.join() === 'Review 3', "Easy Link 'Review 1-4'→Review 1 · 'Review 9-12'→Review 3", r2.elr.join() + ' / ' + r2.elr2.join());
  say(!r2.slr.length, 'Smart Listening 1.1 Review 는 교재에 없으므로 연결 안 됨(정상)');
  say(r2.slu1.join() === 'Unit 1 New Friends', '기존 연결은 그대로', r2.slu1.join());

  // ───── 3. 단어장 소급 반영 없음 ─────
  console.log('\n── 3  단어장 소급 반영');
  const r3 = await page.evaluate(() => {
    const src = String(addUnitWordsToVocab);
    return {
      callers: ['saveLes', 'saveLesson', 'addUnitWordsToVocab('].map(x => x),
      onlyOnSave: /materials/.test(src) && !/DB\.less\(\)/.test(src) && !/_cache\.lessons/.test(src),
      body: src.slice(0, 120).replace(/\s+/g, ' '),
    };
  });
  const callSites = await page.evaluate(() => {
    // 어디서 부르는지 — 전역 함수들의 본문에서 찾는다
    const hits = [];
    Object.getOwnPropertyNames(window).forEach(n => {
      try { const f = window[n]; if (typeof f === 'function' && /addUnitWordsToVocab\s*\(/.test(String(f))) hits.push(n); } catch (e) { }
    });
    return hits;
  });
  say(r3.onlyOnSave, 'addUnitWordsToVocab 은 넘겨받은 materials 만 본다 (지난 기록을 훑지 않음)', r3.body);
  say(callSites.length > 0, '부르는 곳: ' + callSites.join(', '));

  // ───── 4. 학생뷰 (보기만) ─────
  console.log('\n── 4  학생뷰 (저장 없음)');
  const r4 = await page.evaluate(async (sid) => {
    await previewAsStudent(sid);
    await new Promise(r => setTimeout(r, 2800));
    swStuTab('st-library');
    await new Promise(r => setTimeout(r, 1800));
    const el = document.getElementById('st-library');
    const txt = (el ? el.textContent : '').replace(/\s+/g, ' ');
    const de = document.documentElement;
    const path = (typeof ppBookPath === 'function') ? ppBookPath(sid) : [];
    const books = [];
    path.forEach(a => { a.now.forEach(x => books.push(x.title + ' ' + x.n + '/' + (x.total || '?'))); a.past.forEach(x => books.push(x.title + ' ' + x.n + '/' + (x.total || '?'))); });
    return {
      y2: books.find(b => b.indexOf('요즘 초등 영단어 2') === 0) || '(없음)',
      efl: books.filter(b => b.indexOf('EFL Phonics') === 0),
      easy: books.filter(b => b.indexOf('Easy Link') === 0),
      shelf: /수업 교재 복습/.test(txt),
      ov: Math.max(0, de.scrollWidth - de.clientWidth),
    };
  }, SID);
  say(/\/30$/.test(r4.y2), '요즘 초등 영단어 2 여정이 30과 기준', r4.y2);
  say(r4.efl.length > 0 || r4.easy.length > 0, 'EFL·Easy Link 가 여정에 보인다', [...r4.efl, ...r4.easy].join(' · ') || '(없음)');
  say(r4.ov === 0, '학생뷰 390px 가로 넘침 0px', '넘침 ' + r4.ov + 'px');

  // ───── 5. 나가기 (체험 모드 복구) ─────
  await page.evaluate(async () => { await returnToTeacher(); await new Promise(r => setTimeout(r, 2000)); });

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단)' + (writes.length ? ' — ' + [...new Set(writes)].join(', ') : '') + ' · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 6).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
