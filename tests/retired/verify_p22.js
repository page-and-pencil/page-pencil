require('../_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// P2-2·P2-3 검증. 교재 편집기는 더미 교재로만, 실학생은 보기만.
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const TBID = 'p2dummytb01';
const SID = (process.env.PP_REAL_SID || '');
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const blocked = [], errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error' && !/dictionaryapi/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"server":true,"ready":true}' }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    const body = r.request().postData() || '';
    if (body.indexOf(TBID) >= 0) return r.continue();          // 더미 교재만 실제 저장
    blocked.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await page.waitForTimeout(4000);

  // ───── P2-3 ① 넣을 위치: 'Unit 3' 을 번호 자리에 ─────
  console.log('── P2-3 ①  빈 단원 · 넣을 위치');
  const r1 = await page.evaluate(async (tb) => {
    openTbookUnits(tb);
    await new Promise(r => setTimeout(r, 700));
    const sel = document.getElementById('tu-new-unit-pos');
    const opts = sel ? [...sel.options].map(o => o.value) : [];
    document.getElementById('tu-new-unit-name').value = 'Unit 3';
    document.getElementById('tu-new-unit-subtitle').value = '';
    if (sel) sel.value = 'auto';
    tuCreateUnit();
    await new Promise(r => setTimeout(r, 1200));
    const b = (_cache.globalTextbooks || []).find(x => x.id === tb);
    return { opts, order: tbUnitKeys(b), hasPos: !!sel };
  }, TBID);
  say(r1.hasPos, '[넣을 위치] 선택이 생겼다', r1.opts.join(' / '));
  say(r1.order.join(',') === 'Unit 1,Unit 2,Unit 3,Unit 4', "'Unit 3' 이 번호 순서 자리에 들어간다", r1.order.join(', '));

  // ───── P2-3 ② 빈 단원 추가 (Review·Test) ─────
  const r2 = await page.evaluate(async (tb) => {
    document.getElementById('tu-new-unit-name').value = 'Unit 5';
    document.getElementById('tu-new-unit-subtitle').value = '';
    const sel = document.getElementById('tu-new-unit-pos'); if (sel) sel.value = 'auto';
    tuCreateEmptyUnit();
    await new Promise(r => setTimeout(r, 1200));
    const b = (_cache.globalTextbooks || []).find(x => x.id === tb);
    return { order: tbUnitKeys(b), title: (b.unitTitles || {})['Unit 5'], nv: (b.unitNoVocab || {})['Unit 5'], words: ((b.units || {})['Unit 5'] || []).length };
  }, TBID);
  say(r2.order.join(',') === 'Unit 1,Unit 2,Unit 3,Unit 4,Unit 5', '빈 단원이 번호 자리에 들어간다', r2.order.join(', '));
  say(r2.title === 'Review Test' && r2.words === 0, "소제목 'Review Test' · 단어 0개", r2.title + ' · ' + r2.words + '단어');
  say(!!r2.nv, 'unitNoVocab 표식이 붙는다', String(r2.nv).slice(0, 30));

  // ───── P2-3 ③ CSV: unit 만 있고 word 가 빈 줄 ─────
  console.log('\n── P2-3 ③  CSV 빈 단원');
  const r3 = await page.evaluate(async (tb) => {
    // tuImportCsvRaw 의 파싱부와 같은 입력을 tuWordlistMerge 로 흘려보낸다
    const csv = 'unit,word,ko,pos\nUnit 6,epsilon,엡실론,noun\nUnit 7,,,\nUnit 8,zeta,제타,noun\n';
    const rows = _ppCsvRows(csv);
    const head = rows[0].map(h => String(h).trim().toLowerCase());
    const iU = head.indexOf('unit'), iW = head.indexOf('word'), iK = head.indexOf('ko'), iP = head.indexOf('pos');
    const units = {}; let skipped = 0;
    rows.slice(1).forEach(r => {
      const word = String(r[iW] || '').trim();
      const unitCell = iU >= 0 ? String(r[iU] || '').trim() : '';
      if (!word || !/^[a-zA-Z]/.test(word)) {
        if (unitCell && !(unitCell in units)) { units[unitCell] = []; } else skipped++;
        return;
      }
      (units[unitCell] = units[unitCell] || []).push({ word, ko: String(r[iK] || '').trim(), pos: String(r[iP] || '').trim(), example: '' });
    });
    const empty = Object.values(units).filter(v => !v.length).length;
    // 실제 병합
    window._askAuto = true;
    const origAsk = window.askConfirm;
    window.askConfirm = (t, msg, ok, cls, fn) => { window._lastAsk = msg; fn(); };
    tuWordlistMerge(tb, units);
    await new Promise(r => setTimeout(r, 1500));
    window.askConfirm = origAsk;
    const b = (_cache.globalTextbooks || []).find(x => x.id === tb);
    return { parsed: Object.keys(units), empty, msg: (window._lastAsk || '').replace(/\s+/g, ' ').slice(0, 180), order: tbUnitKeys(b), u7: ((b.units || {})['Unit 7'] || []).length, nv7: (b.unitNoVocab || {})['Unit 7'] };
  }, TBID);
  say(r3.parsed.join(',') === 'Unit 6,Unit 7,Unit 8' && r3.empty === 1, "unit 만 있는 줄이 빈 단원으로 잡힌다", r3.parsed.join(', ') + ' · 빈 ' + r3.empty + '개');
  say(/빈 단원 1개/.test(r3.msg), '확인창에 빈 단원 수가 따로 나온다', r3.msg.slice(0, 80));
  say(r3.order.includes('Unit 7') && r3.u7 === 0, "'Unit 7' 이 단어 0개 단원으로 만들어졌다", r3.order.join(', '));
  say(!!r3.nv7, '빈 단원에 unitNoVocab 표식', String(r3.nv7).slice(0, 30));

  // ───── P2-2 복습 탭 (실학생, 보기만) ─────
  console.log('\n── P2-2  복습 탭 (실학생 보기만)');
  const r4 = await page.evaluate(async (sid) => {
    await previewAsStudent(sid);
    await new Promise(r => setTimeout(r, 3000));
    swStuTab('st-library');
    await new Promise(r => setTimeout(r, 2200));
    const el = document.getElementById('st-library');
    const txt = (el ? el.textContent : '').replace(/\s+/g, ' ');
    const de = document.documentElement;
    // 책장의 교재별 단원 수
    const books = [...document.querySelectorAll('#tb-shelf-panel [onclick^="openUnitReview"]')].length;
    return {
      sand: ppSandbox(),
      shelf: /수업 교재 복습/.test(txt),
      reviewBtns: books,
      hasReviewTest: /Review Test/.test(txt),
      ov: Math.max(0, de.scrollWidth - de.clientWidth),
    };
  }, SID);
  say(r4.sand, '체험 모드(저장 안 됨)로 들어갔다');
  say(r4.shelf, "'수업 교재 복습' 이 보인다");
  say(!r4.hasReviewTest, 'Review Test(본문 없는 단원)는 복습 탭에 안 보인다');
  say(r4.ov === 0, '1440px 가로 넘침 0px');

  // 교재별 단원 수 전/후 비교
  const cnt = await page.evaluate((sid) => {
    const out = {};
    // 지금 화면의 책장 패널 안 단원 행 수를 교재별로
    document.querySelectorAll('#tb-shelf-panel').forEach(p => { });
    // 계산으로 직접
    const myCards = ppLive(_cache.vocab_cards).filter(c => c.sid === sid && c.srcType === 'textbook' && c.srcId);
    const byId = {}; (_cache.globalTextbooks || []).forEach(b => { if (b) byId[b.id] = b; });
    const lesUnits = {};
    DB.less().filter(l => l.sid === sid).forEach(l => Object.values(l.materials || {}).forEach(v => {
      if (!v || !v.book || !v.unit) return;
      const tb = (v.bookId && byId[v.bookId]) || (_cache.globalTextbooks || []).find(b => b.title === v.book);
      if (!tb) return;
      const m = lesUnits[tb.id] || (lesUnits[tb.id] = {});
      ppMatchUnit(tb, v.unit).forEach(k => { m[k] = l.date || ''; });
    }));
    const hasStuff = (tb, k) => !!((tb.unitTexts && tb.unitTexts[k]) || (tb.unitAudio && tb.unitAudio[k]) || (tb.unitLinks && tb.unitLinks[k]));
    Object.keys(lesUnits).forEach(id => {
      const tb = byId[id]; if (!tb) return;
      const cards = [...new Set(myCards.filter(c => c.srcId === id && c.srcUnit).map(c => c.srcUnit))];
      const before = cards.filter(k => hasStuff(tb, k)).length;
      const after = [...new Set([...cards, ...Object.keys(lesUnits[id])])].filter(k => hasStuff(tb, k)).length;
      if (before !== after) out[tb.title] = before + ' → ' + after;
    });
    return out;
  }, SID);
  console.log('   단원 수가 바뀐 교재:');
  const keys = Object.keys(cnt);
  if (!keys.length) console.log('     (없음 — 수업 기록 단원이 이미 카드로 덮여 있음)');
  keys.forEach(k => console.log('     ' + k.padEnd(28) + cnt[k]));

  await page.evaluate(async () => { await returnToTeacher(); await new Promise(r => setTimeout(r, 2000)); });

  // 화면 확인은 design_audit.js 가 맡는다
  console.log('\n더미 교재 밖 쓰기 시도 ' + blocked.length + '건(전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
