require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 시험 ⑥ — 같은 날 중복 반영을 **양방향**으로, box 숫자까지 확인. 더미 학생만.
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = 'p1dummy0001';
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1], K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];
const H = { apikey: K, Authorization: 'Bearer ' + K };
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };
const snap = async () => {
  const rows = await (await fetch(U + '/rest/v1/vocab_cards?select=data&sid=eq.' + SID, { headers: H })).json();
  const o = {}; rows.forEach(r => { const d = r.data || {}; if (!d._deleted) o[d.word] = { b: d.box || 0, h: d.hits || 0, m: d.misses || 0, by: d.lastSeenBy || '', ls: d.lastSeen || '', due: d.due || '' }; });
  return o;
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    return ((r.request().postData() || '').indexOf(SID) >= 0) ? r.continue() : r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { window.speakWord = async () => { }; });
  await page.evaluate(async (sid) => { await loginStudent(DB.stus().find(s => s.id === sid)); await new Promise(r => setTimeout(r, 900)); }, SID);

  // 반씩 나눠 두 순서를 한 번에 본다
  const half = await page.evaluate((sid) => {
    const cs = DB.cards(sid);
    return { A: cs.slice(0, 6).map(c => c.word), B: cs.slice(6, 12).map(c => c.word) };
  }, SID);
  console.log('A묶음(퀴즈→학습): ' + half.A.join(', '));
  console.log('B묶음(학습→퀴즈): ' + half.B.join(', '));

  const runQuiz = (words) => page.evaluate(async (a) => {
    quizState = null;
    const cards = DB.cards(a.sid).filter(c => a.words.includes(c.word));
    openVocabQuiz(a.sid, { set: { key: 'test:box', label: '순서 시험', cards } });
    await new Promise(r => setTimeout(r, 450));
    [...document.querySelectorAll('#st-vocab button')].find(b => /시작/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 400));
    for (let i = 0; i < 20; i++) {
      if (!quizState || quizState.idx >= quizState.qs.length) break;
      const q = quizState, it = q.qs[q.idx];
      if (it.type === 'spell') { document.getElementById('qz-in').value = it.card.word; qzAnswerSpell(); }
      else qzAnswer(q.cur.right);               // 전부 정답 → box +1 이어야
      await new Promise(r => setTimeout(r, 750));
      if (document.querySelector('.result-ring')) break;
    }
    await new Promise(r => setTimeout(r, 2200));
    return true;
  }, { sid: SID, words });

  const runStudy = (words) => page.evaluate(async (a) => {
    quizState = null;
    try { sessionStorage.removeItem('deckState_' + a.sid); } catch (e) { }
    const cards = DB.cards(a.sid).filter(c => a.words.includes(c.word));
    deckState = { cards: [...cards], idx: 0, phase: 0, phaseResults: [], sessionResults: [], vocabMode: 'advanced',
      mode: 'all', stages: ['mem'], _fullCards: [...cards], chunkSize: 50, chunkAll: true, _firstS: {} };
    vcStartChunks(); vocabRenderStage();
    await new Promise(r => setTimeout(r, 300));
    for (let i = 0; i < 30 && deckState.cards[deckState.idx]; i++) { memResult(true); await new Promise(r => setTimeout(r, 25)); }
    await new Promise(r => setTimeout(r, 2200));
    return deckState._savedCount;
  }, { sid: SID, words });

  const t0 = await snap();
  console.log('\n── 시작 상태: box 전부 ' + [...new Set(Object.values(t0).map(x => x.b))].join(',') + ' ──');

  // ① A묶음: 퀴즈 먼저
  await runQuiz(half.A);
  await page.waitForTimeout(1000);
  const t1 = await snap();
  // ② B묶음: 학습 먼저
  await runStudy(half.B);
  await page.waitForTimeout(1000);
  const t2 = await snap();
  // ③ A묶음: 같은 날 학습 (두 번째)
  await runStudy(half.A);
  await page.waitForTimeout(1000);
  const t3 = await snap();
  // ④ B묶음: 같은 날 퀴즈 (두 번째)
  await runQuiz(half.B);
  await page.waitForTimeout(1200);
  const t4 = await snap();

  console.log('\n| 단어 | 순서 | 시작 box | 1차 뒤 | 2차 뒤 | lastSeenBy |');
  console.log('|---|---|---|---|---|---|');
  half.A.forEach(w => console.log('| ' + w + ' | 퀴즈→학습 | ' + t0[w].b + ' | ' + t1[w].b + ' | ' + t3[w].b + ' | ' + t3[w].by + ' |'));
  half.B.forEach(w => console.log('| ' + w + ' | 학습→퀴즈 | ' + t0[w].b + ' | ' + t2[w].b + ' | ' + t4[w].b + ' | ' + t4[w].by + ' |'));

  const aOk = half.A.every(w => t1[w].b === t0[w].b + 1 && t3[w].b === t1[w].b && t3[w].by === 'quiz');
  const bOk = half.B.every(w => t2[w].b === t0[w].b + 1 && t4[w].b === t2[w].b && t4[w].by === 'study');
  say(aOk, '퀴즈 → 같은 날 학습: box 한 칸만 (lastSeenBy=quiz 유지)',
    half.A.map(w => t0[w].b + '→' + t1[w].b + '→' + t3[w].b).join(' / '));
  say(bOk, '학습 → 같은 날 퀴즈: box 한 칸만 (lastSeenBy=study 유지)',
    half.B.map(w => t0[w].b + '→' + t2[w].b + '→' + t4[w].b).join(' / '));
  const hitsA = half.A.every(w => t3[w].h === t1[w].h && t3[w].m === t1[w].m);
  const hitsB = half.B.every(w => t4[w].h === t2[w].h && t4[w].m === t2[w].m);
  say(hitsA && hitsB, 'hits·misses 도 두 번 오르지 않는다');
  const dueA = half.A.every(w => t3[w].due === t1[w].due);
  const dueB = half.B.every(w => t4[w].due === t2[w].due);
  say(dueA && dueB, 'due(복습 예정일)도 그대로');

  // '오늘의 단어' 링에 퀴즈가 포함되는지
  const ring = await page.evaluate((sid) => {
    const t = ppToday();
    const all = ppLive(_cache.vocab_cards).filter(c => c.sid === sid);
    return { ring: all.filter(c => ppStudiedToday(c, t)).length,
      byQuiz: all.filter(c => c.lastSeen === t && c.lastSeenBy === 'quiz').length,
      byStudy: all.filter(c => c.lastSeen === t && c.lastSeenBy === 'study').length, all: all.length };
  }, SID);
  say(ring.ring === ring.byQuiz + ring.byStudy && ring.byQuiz > 0,
    "'오늘의 단어' 링에 퀴즈도 포함된다 (①)", '링 ' + ring.ring + ' = 퀴즈 ' + ring.byQuiz + ' + 학습 ' + ring.byStudy);

  console.log('\n콘솔 오류 ' + errs.length + '건');
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
