require('../_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// P1 검증 2 — 스펠·선택지·중간 이탈·별표. 더미 학생만.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = 'p1dummy0001';
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1], K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];
const H = { apikey: K, Authorization: 'Bearer ' + K };
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };
const snap = async () => {
  const rows = await (await fetch(U + '/rest/v1/vocab_cards?select=id,data&sid=eq.' + SID, { headers: H })).json();
  const o = {}; rows.forEach(r => { const d = r.data || {}; o[d.word] = [d.hits || 0, d.misses || 0, d.box || 0, d.lastSeen || '', d.due || ''].join('|'); });
  return o;
};

(async () => {
  const before = await snap();
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error' && !/dictionaryapi/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"server":true,"ready":true}' }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    return ((r.request().postData() || '').indexOf(SID) >= 0) ? r.continue() : r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { window._spoken = []; window.speakWord = w => window._spoken.push(String(w).slice(0, 20)); });

  // 스펠 단계로 바로 들어간다
  const go = (stage) => page.evaluate(async (a) => {
    try { sessionStorage.removeItem('deckState_' + a.sid); } catch (e) { }
    vocabStudyMode = 'all'; vocabStarOnly = false; vocabChunkAll = false; vocabDeckFilter = null;
    await loginStudent(DB.stus().find(s => s.id === a.sid));
    await new Promise(r => setTimeout(r, 900));
    swStuTab('st-vocab'); await new Promise(r => setTimeout(r, 600));
    const b = [...document.querySelectorAll('#st-vocab button')].find(x => /시작/.test(x.textContent));
    if (b) b.click();
    await new Promise(r => setTimeout(r, 400));
    deckState.stages = [a.stage]; deckState.phase = 0; vocabRenderStage();
    await new Promise(r => setTimeout(r, 400));
    return deckState.cards.length;
  }, { sid: SID, stage });

  // ───── 6. 스펠: 엔터 두 번 ─────
  console.log('── 6  스펠 엔터 두 번');
  await go('spell');
  const r6 = await page.evaluate(async () => {
    const card = deckState.cards[deckState.idx];
    const inp = document.getElementById('spell-in');
    inp.value = card.word;
    const ev = () => inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const idx0 = deckState.idx, combo0 = _vgCombo, n0 = deckState.phaseResults.length;
    ev(); await new Promise(r => setTimeout(r, 250));
    const afterFirst = { idx: deckState.idx, combo: _vgCombo, n: deckState.phaseResults.length, answered: deckState._answered, fb: (document.getElementById('spell-fb') || {}).textContent };
    ev(); await new Promise(r => setTimeout(r, 350));
    const afterSecond = { idx: deckState.idx, combo: _vgCombo, n: deckState.phaseResults.length, word: (deckState.cards[deckState.idx] || {}).word };
    return { idx0, combo0, n0, afterFirst, afterSecond, firstWord: card.word };
  });
  say(r6.afterFirst.n === r6.n0 + 1 && r6.afterFirst.answered, '엔터 1번 — 채점 1회', '기록 ' + r6.n0 + '→' + r6.afterFirst.n + ' · ' + r6.afterFirst.fb);
  say(r6.afterSecond.n === r6.afterFirst.n, '엔터 2번 — 또 맞힌 걸로 세지 않는다', '기록 ' + r6.afterSecond.n + '건 (늘지 않음)');
  say(r6.afterSecond.combo === r6.afterFirst.combo, '연속(콤보)이 두 번 오르지 않는다', '콤보 ' + r6.afterFirst.combo + ' → ' + r6.afterSecond.combo);
  say(r6.afterSecond.idx === r6.afterFirst.idx + 1, '엔터 2번째에 다음 문제로 넘어간다', r6.firstWord + ' → ' + r6.afterSecond.word);

  // ───── 7. 스펠 오답 화면 ─────
  console.log('\n── 7  스펠 오답 말투 · 발음 · 채점');
  const r7 = await page.evaluate(async () => {
    window._spoken = [];
    const card = deckState.cards[deckState.idx];
    const inp = document.getElementById('spell-in');
    inp.value = card.word.slice(0, Math.max(1, card.word.length - 2)) + 'zz';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    const fb = document.getElementById('spell-fb');
    const html = fb.innerHTML;
    const col = getComputedStyle(fb).color;
    return { html: html.replace(/\s+/g, ' ').slice(0, 160), col, spoken: window._spoken.length, word: card.word };
  });
  say(!/✗/.test(r7.html) && /다시 나와요/.test(r7.html), 'X 표시 대신 "다시 나와요"', r7.html.slice(0, 70));
  say(r7.spoken > 0, '답한 뒤에 발음한다', r7.spoken + '회');
  say(/text-decoration:underline/.test(r7.html), '틀리기 시작한 자리를 표시한다');

  // 대소문자·부호 무시 채점
  const r7b = await page.evaluate(async () => {
    const out = [];
    const t = (typed, ans) => _spellNorm(typed) === _spellNorm(ans);
    out.push(['Factory', 'factory', t('Factory', 'factory')]);
    out.push(['look  at', 'look at', t('look  at', 'look at')]);
    out.push(["don’t", "don't", t('don\u2019t', "don't")]);
    out.push(['factory!', 'factory', t('factory!', 'factory')]);
    out.push(['factry', 'factory', t('factry', 'factory')]);
    return out;
  });
  const okNorm = r7b.slice(0, 4).every(x => x[2]) && r7b[4][2] === false;
  say(okNorm, '대소문자·띄어쓰기·굽은따옴표·문장부호 무시, 철자 다르면 오답', r7b.map(x => x[0] + '→' + (x[2] ? 'O' : 'X')).join(' '));

  // ───── 8. 4지선다 선택지 ─────
  console.log('\n── 8  4지선다 보기');
  const r8 = await page.evaluate(async () => {
    const card = DB.cards('p1dummy0001').find(c => c.pos === 'noun');
    const runs = [];
    for (let i = 0; i < 4; i++) runs.push(_vgOpts(card, 'meaning').join('|'));
    const opts = _vgOpts(card, 'meaning');
    const posOf = v => (DB.cards('p1dummy0001').find(c => c.meaning === v) || {}).pos;
    const samePos = opts.filter(v => posOf(v) === card.pos).length;
    return { n: opts.length, uniq: new Set(runs).size, samePos, has: opts.includes(card.meaning), opts, word: card.word, pos: card.pos };
  });
  say(r8.n === 4 && r8.has, '보기 4개 + 정답 포함', r8.opts.join(' / '));
  say(r8.uniq > 1, '돌릴 때마다 보기가 달라진다', '4회 중 ' + r8.uniq + '가지');
  say(r8.samePos >= 3, '같은 품사 보기가 섞인다', r8.word + '(' + r8.pos + ') 보기 중 같은 품사 ' + r8.samePos + '개');

  // ───── 9. 별표 ─────
  console.log('\n── 9  별표');
  const r9 = await page.evaluate(async () => {
    await go2();
    async function go2() { }
    const card = deckState.cards[deckState.idx];
    const b = document.getElementById('vc-star');
    const was = !!card.starred;
    if (b) b.click();
    await new Promise(r => setTimeout(r, 600));
    const now = !!(DB.cards('p1dummy0001').find(c => c.id === card.id) || {}).starred;
    return { has: !!b, was, now, word: card.word };
  });
  say(r9.has, '카드에 별표 버튼이 있다');
  say(r9.now !== r9.was, '별표가 켜진다', r9.word + ' ' + r9.was + '→' + r9.now);
  const starSaved = await (async () => { const s = await snap(); return true; })();
  const r9b = await page.evaluate(async () => {
    try { sessionStorage.removeItem('deckState_p1dummy0001'); } catch (e) { }
    vocabStarOnly = true; vocabStudyMode = 'all';
    renderVocabDeck('p1dummy0001');
    await new Promise(r => setTimeout(r, 500));
    const n = (deckState._fullCards || []).length;
    vocabStarOnly = false;
    return n;
  });
  say(r9b >= 1 && r9b < 12, '별표만 모드가 별표 카드만 고른다', r9b + '장');

  // ───── 10. 중간 이탈 후 안 푼 카드 무변화 ─────
  console.log('\n── 10  중간에 나갔다 돌아와 끝내기');
  const base = await snap();
  const r10 = await page.evaluate(async () => {
    try { sessionStorage.removeItem('deckState_p1dummy0001'); } catch (e) { }
    vocabStudyMode = 'all'; vocabStarOnly = false; vocabChunkAll = false;
    renderVocabDeck('p1dummy0001');
    await new Promise(r => setTimeout(r, 500));
    deckState.stages = ['mem']; deckState.phase = 0; vcStartChunks(); vocabRenderStage();
    await new Promise(r => setTimeout(r, 300));
    const answered = [];
    for (let i = 0; i < 3; i++) { answered.push(deckState.cards[deckState.idx].word); memResult(true); await new Promise(r => setTimeout(r, 30)); }
    // 나갔다 돌아오기
    swStuTab('st-home'); await new Promise(r => setTimeout(r, 400));
    swStuTab('st-vocab'); await new Promise(r => setTimeout(r, 500));
    // 남은 카드를 전부 '알아요'로 끝내 결과까지
    for (let i = 0; i < 40; i++) {
      if (document.querySelector('.result-ring')) break;
      if (!deckState.cards[deckState.idx]) {
        const b = [...document.querySelectorAll('#st-vocab button')].find(x => /넘어가기|결과 보기/.test(x.textContent));
        if (b) { b.click(); await new Promise(r => setTimeout(r, 300)); continue; }
        break;
      }
      answered.push(deckState.cards[deckState.idx].word);
      memResult(true); await new Promise(r => setTimeout(r, 30));
    }
    await new Promise(r => setTimeout(r, 1500));
    return { answered: [...new Set(answered)], firstN: Object.keys(deckState._first || {}).length, saved: deckState._savedCount };
  });
  await page.waitForTimeout(1500);
  const after = await snap();
  const changed = Object.keys(after).filter(w => after[w] !== base[w]);
  const untouched = Object.keys(after).filter(w => !r10.answered.includes(w));
  const untouchedChanged = untouched.filter(w => after[w] !== base[w]);
  console.log('     답한 카드 ' + r10.answered.length + '장 · 첫시도 기록 ' + r10.firstN + '장 · 저장 ' + r10.saved + '건');
  say(untouchedChanged.length === 0, '답하지 않은 카드는 hits·misses·box·due·lastSeen 모두 그대로', '안 푼 ' + untouched.length + '장 중 바뀐 것 ' + untouchedChanged.length + '장');
  say(changed.every(w => r10.answered.includes(w)), '바뀐 카드는 전부 답한 카드', '바뀐 ' + changed.length + '장');

  // ───── 11. 오늘의 단어 링 ─────
  const r11 = await page.evaluate(() => {
    const t = ppToday();
    const ring = ppLive(_cache.vocab_cards).filter(c => c.sid === 'p1dummy0001' && ppStudiedToday(c, t)).length;
    const studied = ppLive(_cache.vocab_cards).filter(c => c.sid === 'p1dummy0001' && c.lastSeen === t).length;
    return { ring, studied, all: DB.cards('p1dummy0001').length };
  });
  say(r11.ring === r11.studied, "'오늘의 단어' 링이 실제로 푼 카드만 센다", r11.ring + '/' + r11.all + ' (lastSeen=오늘 ' + r11.studied + ')');

  // ───── 12. 화면 ─────
  console.log('\n── 12  화면');
  for (const w of [320, 390, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(400);
    const o = await page.evaluate(() => {
      const de = document.documentElement;
      const el = document.getElementById('s-student');
      let out = 0;
      (el ? el.querySelectorAll('*') : []).forEach(x => { const b = x.getBoundingClientRect(); if (b.width && b.right > de.clientWidth + 1) out++; });
      return { ov: Math.max(0, de.scrollWidth - de.clientWidth), out };
    });
    say(o.ov === 0 && o.out === 0, w + 'px 가로 넘침 0 · 밖으로 나간 요소 0', '가로 ' + o.ov + 'px · 요소 ' + o.out + '개');
  }

  console.log('\n콘솔 오류 ' + errs.length + '건'); [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
