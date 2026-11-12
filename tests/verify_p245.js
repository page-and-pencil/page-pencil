require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// P2-4(ppReviewCover) · P2-5(단원 점검) 검증. 읽기만, 저장 0건.
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const writes = [], errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error' && !/dictionaryapi/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
  let gets = 0;
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"server":true,"ready":true}' }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') { gets++; return r.continue(); }
    writes.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await page.waitForTimeout(4500);

  // ───── P2-4 ─────
  console.log('── P2-4  ppReviewCover');
  const r1 = await page.evaluate(() => {
    const T = t => (_cache.globalTextbooks || []).find(b => b.title === t);
    const row = (t, k) => {
      const tb = T(t); if (!tb) return null;
      const cov = ppReviewCover(tb, k);
      const n = cov.reduce((a, x) => a + (((tb.units || {})[x]) || []).length, 0);
      return { book: t, unit: k, cov, n, label: ppUnitLabel(tb, k), words: ppUnitWords(tb.id, [k]).length };
    };
    return {
      y5: row('요즘 초등 영단어 2', 'Unit 5'),
      y30: row('요즘 초등 영단어 2', 'Unit 30'),
      el2: row('Easy Link Starter 1', 'Review 2'),
      dr1: row('단어가 읽기다 Level 2', 'Review Test 1'),
      // 자동 대상 아님
      test: (() => { const tb = T('EFL Phonics 4'); return tb ? ppReviewCover(tb, 'Test') : null; })(),
      chal: (() => { const tb = T('EFL Phonics 4'); return tb ? ppReviewCover(tb, 'Challenge') : null; })(),
      proj: (() => { const tb = T('Easy Link Starter 1'); return tb ? ppReviewCover(tb, 'Project 1') : null; })(),
      // 보통 단원은 그대로
      plain: (() => { const tb = T('요즘 초등 영단어 2'); return tb ? { cov: ppReviewCover(tb, 'Unit 1'), words: ppUnitWords(tb.id, ['Unit 1']).length } : null; })(),
    };
  });
  console.log('\n| 교재 | Review 단원 | 덮는 단원 | 단어 수 |');
  console.log('|---|---|---|---|');
  [r1.y5, r1.y30, r1.el2, r1.dr1].forEach(x => {
    if (!x) return;
    const range = x.cov.length > 1 ? x.cov[0] + '~' + x.cov[x.cov.length - 1] : (x.cov[0] || '—');
    console.log('| ' + x.book + ' | ' + x.unit + ' | ' + range + ' (' + x.cov.length + '과) | ' + x.n + ' |');
  });
  say(r1.y5 && r1.y5.cov.join() === 'Unit 1,Unit 2,Unit 3,Unit 4' && r1.y5.n === 36, '요즘2 Unit 5 → Unit 1~4 · 36단어', r1.y5 && r1.y5.n + '단어');
  say(r1.y30 && r1.y30.cov.join() === 'Unit 26,Unit 27,Unit 28,Unit 29', '요즘2 Unit 30 → Unit 26~29', r1.y30 && r1.y30.cov.join(','));
  say(r1.el2 && r1.el2.cov.join() === 'Lesson 5,Lesson 6,Lesson 7,Lesson 8', 'Easy Link Starter 1 Review 2 → Lesson 5~8', r1.el2 && r1.el2.cov.join(','));
  say(r1.dr1 && r1.dr1.cov.length === 5, '단어가 읽기다 Level 2 Review Test 1 → DAY 01~05', r1.dr1 && r1.dr1.cov.join(','));
  say(!(r1.test || []).length && !(r1.chal || []).length && !(r1.proj || []).length, 'Test·Challenge·Project 는 자동 대상이 아니다');
  say(r1.y5 && r1.y5.words === 36, '시험지 단원 선택(ppUnitWords)이 Review 에서 36단어를 낸다', r1.y5 && r1.y5.words + '단어');
  say(r1.plain && !r1.plain.cov.length && r1.plain.words === 9, '보통 단원은 그대로 (Unit 1 = 9단어)', r1.plain && r1.plain.words + '단어');
  say(/Unit 1~Unit 4 · 36단어/.test(r1.y5.label), '표기: ' + r1.y5.label);

  // 단어장 반영에는 안 쓴다
  const r1b = await page.evaluate(() => /ppUnitsForWords|ppReviewCover/.test(String(addUnitWordsToVocab)));
  say(!r1b, 'addUnitWordsToVocab(단어장 반영)에는 쓰지 않는다');

  // 시험지 만들기 (저장 안 함)
  const nW = writes.length;
  const r1c = await page.evaluate(async () => {
    const tb = (_cache.globalTextbooks || []).find(b => b.title === '요즘 초등 영단어 2');
    const stu = DB.stus().find(s => !s.inactive);
    openVocabPaper(stu.id);
    await new Promise(r => setTimeout(r, 700));
    document.getElementById('vp-book').value = tb.id; vpBookChange();
    const opts = [...document.getElementById('vp-units').options].map(o => o.textContent);
    [...document.getElementById('vp-units').options].forEach(o => { o.selected = o.value === 'Unit 5'; });
    document.getElementById('vp-new').value = 20;
    document.getElementById('vp-wrong').value = 0;
    document.getElementById('vp-past').value = 0;
    return { opt5: opts.find(o => o.indexOf('Unit 5') === 0), opt1: opts.find(o => o.indexOf('Unit 1 ') === 0 || o === 'Unit 1') };
  });
  console.log('     단원 목록 표기: "' + r1c.opt5 + '"');
  say(/Review Test \(Unit 1~Unit 4 · 36단어\)/.test(r1c.opt5 || ''), '시험지 단원 목록에 덮는 범위가 보인다', r1c.opt5);
  const pop = ctx.waitForEvent('page');
  await page.evaluate(() => makeVocabPaper());
  const w = await pop; await w.waitForLoadState('domcontentloaded'); await w.waitForTimeout(600);
  const made = await w.evaluate(() => ({ n: document.querySelectorAll('.ak div').length, head: (document.querySelector('.pass') || {}).textContent }));
  await w.close();
  say(made.n > 0, 'Review 단원으로 시험지가 만들어진다 (앞 단원 단어)', made.n + '문항 · ' + (made.head || '').trim());
  say(writes.length === nW, '시험지는 저장하지 않는다', '쓰기 ' + (writes.length - nW) + '건');

  // ───── P2-5 ─────
  console.log('\n── P2-5  단원 점검');
  const getsBefore = gets;
  const r2 = await page.evaluate(async () => {
    const r = ppUnitAudit();
    openUnitAudit();
    await new Promise(x => setTimeout(x, 600));
    const body = document.getElementById('unit-audit-body');
    const sum = document.getElementById('unit-audit-sum');
    const de = document.documentElement;
    return {
      cnt: r.cnt, books: r.books,
      cards: body ? body.querySelectorAll('details').length : 0,
      bookCards: body ? [...body.querySelectorAll('details')].filter(d => d.querySelector('button[onclick*="openTbookUnits"]')).length : 0,
      serCard: body ? [...body.querySelectorAll('details')].filter(d => /시리즈/.test(d.textContent)).length : 0,
      openBtn: body ? body.querySelectorAll('button[onclick*="openTbookUnits"]').length : 0,
      sum: sum ? sum.textContent.replace(/\s+/g, ' ').trim() : '',
      eList: (r.serGap||[]).map(g => g.series + '(' + g.n + '권 중 ' + g.wi.length + ')'),
      fList: Object.values(r.rows).flatMap(x => x.items.filter(i => i.k === 'f').map(i => x.title + ' — ' + i.msg)),
      ov: Math.max(0, de.scrollWidth - de.clientWidth),
    };
  });
  console.log('     ' + r2.sum);
  console.log('     a=' + r2.cnt.a + ' b=' + r2.cnt.b + ' c=' + r2.cnt.c + ' d=' + r2.cnt.d + ' e=' + r2.cnt.e + ' f=' + r2.cnt.f + ' · 교재 ' + r2.books + '권');
  say(gets === getsBefore, '새로 받지 않는다 (전송량 0)', 'GET ' + (gets - getsBefore) + '건');
  say(r2.cnt.a === 0 && r2.cnt.b === 0 && r2.cnt.c === 0 && r2.cnt.d === 0, 'a~d 0건', 'a' + r2.cnt.a + ' b' + r2.cnt.b + ' c' + r2.cnt.c + ' d' + r2.cnt.d);
  say(r2.cnt.f === 10, 'f(연결 안 되는 기록) 10건', r2.cnt.f + '건');
  say(r2.bookCards > 0 && r2.openBtn === r2.bookCards, '교재별 접히는 목록 + 교재 열기 버튼', r2.bookCards + '권 · 버튼 ' + r2.openBtn + '개');
  say(r2.serCard === 1, '시리즈 참고는 맨 아래 한 덩이', r2.serCard + '개');
  say(r2.ov === 0, '1440px 가로 넘침 0px');
  console.log('\n     e(시리즈 참고) ' + r2.cnt.e + '건: ' + r2.eList.slice(0, 12).join(', ') + (r2.eList.length > 12 ? ' 외 ' + (r2.eList.length - 12) : ''));
  console.log('     f 목록:');
  r2.fList.forEach(x => console.log('       · ' + x));

  for (const vw of [320, 390]) {
    await page.setViewportSize({ width: vw, height: 900 });
    await page.waitForTimeout(400);
    const o = await page.evaluate(() => {
      const de = document.documentElement; let out = 0;
      document.querySelectorAll('#m-unit-audit .mdl *').forEach(x => {
        const st = getComputedStyle(x); if (st.display === 'none' || x.offsetParent === null) return;
        const b = x.getBoundingClientRect(); if (b.width && b.right > de.clientWidth + 1) out++;
      });
      return { ov: Math.max(0, de.scrollWidth - de.clientWidth), out };
    });
    say(o.ov === 0 && o.out === 0, vw + 'px 점검 창 넘침 0', '가로 ' + o.ov + 'px · 요소 ' + o.out + '개');
  }

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
