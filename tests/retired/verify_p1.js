require('../_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// P1 검증 — 더미 학생으로만. 실학생 행에는 쓰지 않는다.
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = 'p1dummy0001';
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const writes = [], errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"server":true,"ready":true}' }));
  await page.route('**/rest/v1/**', async r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    const body = r.request().postData() || '';
    const url = r.request().url();
    writes.push({ m, t: url.split('/rest/v1/')[1].split('?')[0], mine: body.indexOf(SID) >= 0, n: body.length });
    // 더미 학생 것만 실제로 보낸다. 다른 건 전부 막는다.
    if (body.indexOf(SID) >= 0) return r.continue();
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await page.waitForTimeout(4000);

  // 발음 호출 세기 (오디오 대신 스텁)
  await page.evaluate(() => { window._spoken = []; const o = window.speakWord; window.speakWord = function (w) { window._spoken.push(String(w).slice(0, 20)); }; window._origSpeak = o; });

  const dummyOk = await page.evaluate((sid) => !!(_cache.students || []).find(s => s.id === sid), SID);
  say(dummyOk, '더미 학생 테스트_P1 을 읽었다');

  const enter = async (mode, starOnly, chunkAll) => page.evaluate(async (a) => {
    try { sessionStorage.removeItem('deckState_' + a.sid); } catch (e) { }
    vocabStudyMode = a.mode; vocabStarOnly = !!a.starOnly; vocabChunkAll = !!a.chunkAll; vocabDeckFilter = null;
    const stu = DB.stus().find(s => s.id === a.sid);
    await loginStudent(stu);
    await new Promise(r => setTimeout(r, 900));
    swStuTab('st-vocab');
    await new Promise(r => setTimeout(r, 700));
    // 시작 화면이면 시작 버튼
    const b = [...document.querySelectorAll('#st-vocab button')].find(x => /시작/.test(x.textContent));
    if (b) b.click();
    await new Promise(r => setTimeout(r, 500));
    return { stages: deckState.stages, chunks: (deckState._chunks || []).map(c => c.length), cards: deckState.cards.length };
  }, { sid: SID, mode, starOnly, chunkAll });

  // ───── 1. 구간 분할 ─────
  console.log('\n── 1  구간 분할 (12장, 구간 8)');
  const s1 = await enter('all', false, false);
  say(s1.chunks.join(',') === '8,4', '12장이 8+4 로 쪼개짐', s1.chunks.join(' + '));
  say(s1.cards === 8, '첫 구간은 8장', s1.cards + '장');
  console.log('     스테이지: ' + (s1.stages || []).join(' → '));

  // ───── 2. 암기: 들어오자마자 발음하지 않는다 ─────
  console.log('\n── 2  발음 타이밍');
  const sp = await page.evaluate(async () => {
    window._spoken = [];
    swStuTab('st-vocab');
    await new Promise(r => setTimeout(r, 600));
    const before = window._spoken.length;
    const deck = document.querySelector('.vc-deck'); if (deck) flipMemCard(deck);
    await new Promise(r => setTimeout(r, 400));
    return { before, after: window._spoken.length, words: window._spoken.slice(0, 3) };
  });
  say(sp.before === 0, '암기 카드에 들어와도 바로 발음하지 않는다', '진입 직후 발음 ' + sp.before + '회');
  say(sp.after > 0, '뒤집으면 발음한다', '뒤집은 뒤 ' + sp.after + '회 ' + sp.words.join(','));

  // ───── 3. 전부 '몰라요' → 다음 라운드에 다시 ─────
  console.log('\n── 3  모르는 카드는 다음 라운드에');
  const r3 = await page.evaluate(async () => {
    const seen = [];
    for (let i = 0; i < 40; i++) {
      const card = deckState.cards[deckState.idx];
      if (!card) break;
      const head = (document.querySelector('#st-vocab') || {}).textContent || '';
      if (/내일 다시 만나요/.test(head)) break;
      seen.push({ r: deckState.round, w: card.word });
      memResult(false);
      await new Promise(r => setTimeout(r, 30));
      if (deckState.round >= 3 && deckState.idx === 0 && i > 8) { }
      if (/내일 다시 만나요/.test((document.querySelector('#st-vocab') || {}).textContent || '')) break;
    }
    const txt = (document.querySelector('#st-vocab') || {}).textContent || '';
    return {
      r1: seen.filter(x => x.r === 1).length, r2: seen.filter(x => x.r === 2).length, r3: seen.filter(x => x.r === 3).length,
      sameSet: JSON.stringify(seen.filter(x => x.r === 1).map(x => x.w).sort()) === JSON.stringify(seen.filter(x => x.r === 2).map(x => x.w).sort()),
      carry: /내일 다시 만나요/.test(txt),
      carryBtn: !!([...document.querySelectorAll('#st-vocab button')].find(b => /다음 구간으로 넘어가기|결과 보기/.test(b.textContent))),
      noBlame: !/못했|틀렸|실패|X /.test(txt),
      round: deckState.round,
    };
  });
  say(r3.r1 === 8 && r3.r2 === 8, '1라운드 8장 → 2라운드에 같은 8장', 'r1=' + r3.r1 + ' r2=' + r3.r2 + ' r3=' + r3.r3);
  say(r3.sameSet, '2라운드 카드가 1라운드와 같은 단어들');
  say(r3.carry && r3.carryBtn, '3라운드를 넘기면 넘어가기 버튼', '라운드 ' + r3.round);
  say(r3.noBlame, '지적하는 말투가 없다');

  // ───── 4. 첫 시도만 기록 ─────
  console.log('\n── 4  첫 시도만 기록');
  const r4 = await page.evaluate(async () => {
    // 1라운드에서 틀린 카드를 2라운드에서 맞혀도 첫 시도(오답)가 유지되는지
    const first = JSON.parse(JSON.stringify(deckState._first || {}));
    const n = Object.keys(first).length;
    const allWrong = Object.values(first).every(v => v === false);
    // 넘어가기 → 다음 구간
    const b = [...document.querySelectorAll('#st-vocab button')].find(x => /다음 구간으로 넘어가기/.test(x.textContent));
    if (b) b.click();
    await new Promise(r => setTimeout(r, 400));
    return { n, allWrong, ci: deckState.ci, cards: deckState.cards.length };
  });
  say(r4.n === 8 && r4.allWrong, '첫 구간 8장이 모두 첫 시도 오답으로 한 번씩만 기록', '기록 ' + r4.n + '장');
  say(r4.ci === 1 && r4.cards === 4, '다음 구간(4장)으로 넘어감', '구간 ' + (r4.ci + 1) + ' · ' + r4.cards + '장');

  // ───── 5. 2구간은 다 맞히고 결과까지 ─────
  console.log('\n── 5  결과 · 저장');
  const nBefore = writes.length;
  const r5 = await page.evaluate(async () => {
    for (let i = 0; i < 30; i++) {
      if (!deckState.cards[deckState.idx]) break;
      if (/정답|% /.test((document.querySelector('.result-ring') || {}).textContent || '')) break;
      memResult(true);
      await new Promise(r => setTimeout(r, 30));
      if (document.querySelector('.result-ring')) break;
      // 다음 스테이지 전환 화면이면 진행
      const nx = [...document.querySelectorAll('#st-vocab button')].find(b => /다음:|시작/.test(b.textContent));
      if (nx) { nx.click(); await new Promise(r => setTimeout(r, 400)); }
    }
    return { stage: deckState.phase, hasResult: !!document.querySelector('.result-ring') };
  });
  await page.waitForTimeout(2500);
  const res = await page.evaluate(() => {
    const ring = document.querySelector('.result-ring');
    const el = document.getElementById('st-vocab');
    return {
      pct: ring ? ring.textContent.trim() : '(결과화면 아님)',
      txt: (el ? el.textContent : '').replace(/\s+/g, ' ').slice(0, 150),
      saved: deckState._savedCount,
      firstN: Object.keys(deckState._first || {}).length,
    };
  });
  console.log('     결과: ' + res.pct + ' · 첫시도 기록 ' + res.firstN + '장 · 저장 ' + res.saved + '건');
  const myWrites = writes.slice(nBefore).filter(w => w.mine && w.t === 'vocab_cards');
  say(myWrites.length <= 12, '저장은 답한 카드 수를 넘지 않는다', myWrites.length + '건 · ' + Math.round(myWrites.reduce((a, c) => a + c.n, 0) / 1024 * 10) / 10 + 'KB');

  console.log('\n실DB 쓰기: 더미 ' + writes.filter(w => w.mine).length + '건 통과 · 그 밖 ' + writes.filter(w => !w.mine).length + '건 차단');
  console.log('콘솔 오류 ' + errs.length + '건'); [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
