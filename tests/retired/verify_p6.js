require('../_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// P6 리포트·설정·리셋 검증. 더미 학생/숙제만.
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = 'p1dummy0001', HWID = 'p6dummyhw01';
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1], K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };
const post = async (t, rows) => { const r = await fetch(U + '/rest/v1/' + t, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) }); if (!r.ok) throw new Error(t + ' ' + r.status + ' ' + (await r.text()).slice(0, 180)); };
const get = async (t, q) => (await (await fetch(U + '/rest/v1/' + t + '?' + q, { headers: H })).json());
const cardSnap = async () => { const rows = await get('vocab_cards', 'select=data&sid=eq.' + SID); const o = {}; rows.forEach(r => { const d = r.data || {}; if (!d._deleted) o[d.word] = [d.hits || 0, d.misses || 0, d.box || 0, d.lastSeen || '', d.due || ''].join('|'); }); return o; };
const today = new Date().toISOString().slice(0, 10);

(async () => {
  // 더미 숙제 (단어 숙제 · 목표 90점 1회 · 오늘 몫)
  await post('assignments', [{ id: HWID, sid: SID, data: {
    id: HWID, sid: SID, type: 'vocab', category: 'vocab', date: today, due: today,
    bookTitle: 'P6 더미 단어 숙제', words: ['factory', 'farmer', 'machine'],
    quizGoal: 90, quizTimes: 1,
    schedule: [{ date: today, book: 'P6 더미 단어 숙제', unit: '' }],
  }, updated_at: new Date().toISOString() }]);
  console.log('더미 숙제 생성 (목표 90점 1회)\n');

  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = []; let gets = 0;
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error' && !/dictionaryapi/.test(m.text())) errs.push('console: ' + m.text().slice(0, 150)); });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') { gets++; return r.continue(); }
    const b = r.request().postData() || '';
    return (b.indexOf(SID) >= 0 || b.indexOf(HWID) >= 0) ? r.continue() : r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { window.speakWord = async () => { }; });

  // ───── 1. 학습 세션 로그 ─────
  console.log('── 1  학습 세션 기록');
  const r1 = await page.evaluate(async (sid) => {
    await loginStudent(DB.stus().find(s => s.id === sid));
    await new Promise(r => setTimeout(r, 1000));
    try { sessionStorage.removeItem('deckState_' + sid); } catch (e) { }
    vocabStudyMode = 'all'; vocabStarOnly = false; vocabChunkAll = true; vocabDeckFilter = null; quizState = null; wnState = null;
    renderVocabDeck(sid);
    await new Promise(r => setTimeout(r, 500));
    deckState.stages = ['mem']; deckState.phase = 0; vcStartChunks(); vocabRenderStage();
    await new Promise(r => setTimeout(r, 300));
    for (let i = 0; i < 6 && deckState.cards[deckState.idx]; i++) { memResult(true); await new Promise(r => setTimeout(r, 25)); }
    // 나머지는 안 풀고 결과로
    await renderVocabResult(document.getElementById('st-vocab'));
    await new Promise(r => setTimeout(r, 2200));
    return true;
  }, SID);
  await page.waitForTimeout(1200);
  let lg = (await get('logs', 'select=data&sid=eq.' + SID)).map(r => r.data).filter(d => d && !d._deleted);
  const sess = lg.filter(d => d.type === 'vocab_session');
  say(sess.length === 1, '세션 로그 1행', JSON.stringify(sess[0] && { setKey: sess[0].setKey, n: sess[0].n, ms: sess[0].ms, stages: sess[0].stages }));
  say(sess[0] && sess[0].n === 6, '답한 카드 수가 맞다', (sess[0] || {}).n + '장');
  say(sess[0] && sess[0].ms > 0, '학습 시간이 기록된다', (sess[0] || {}).ms + 'ms');

  // ───── 2. 체험 모드에서는 저장 안 함 ─────
  const before2 = sess.length;
  const r2 = await page.evaluate(async (sid) => {
    await returnToTeacher(); await new Promise(r => setTimeout(r, 1800));
    await previewAsStudent(sid); await new Promise(r => setTimeout(r, 2600));
    const sandOn = ppSandbox();
    try { sessionStorage.removeItem('deckState_' + sid); } catch (e) { }
    vocabChunkAll = true; renderVocabDeck(sid);
    await new Promise(r => setTimeout(r, 500));
    deckState.stages = ['mem']; deckState.phase = 0; vcStartChunks(); vocabRenderStage();
    await new Promise(r => setTimeout(r, 300));
    for (let i = 0; i < 4 && deckState.cards[deckState.idx]; i++) { memResult(true); await new Promise(r => setTimeout(r, 25)); }
    await renderVocabResult(document.getElementById('st-vocab'));
    await new Promise(r => setTimeout(r, 1800));
    await returnToTeacher(); await new Promise(r => setTimeout(r, 2000));
    return { sandOn };
  }, SID);
  await page.waitForTimeout(1000);
  lg = (await get('logs', 'select=data&sid=eq.' + SID)).map(r => r.data).filter(d => d && !d._deleted);
  say(r2.sandOn, '미리보기는 체험 모드');
  say(lg.filter(d => d.type === 'vocab_session').length === before2, '체험 모드 세션 저장 0건', lg.filter(d => d.type === 'vocab_session').length + '행 (그대로)');

  // ───── 3. 세트별 표 숫자가 logs 와 일치 ─────
  console.log('\n── 3  세트별 표');
  const r3 = await page.evaluate((sid) => {
    const sets = ppVocabSets(sid);
    const raw = (_cache.logs || []).filter(l => l.sid === sid && !l._deleted && l.type === 'vocab_session');
    return { sets: sets.map(s => ({ key: s.key, label: s.label, sessions: s.sessions, ms: s.ms, n: s.n, tries: s.tries, best: s.best })), rawN: raw.length, rawMs: raw.reduce((t, l) => t + (l.ms || 0), 0) };
  }, SID);
  const tot = r3.sets.reduce((t, s) => t + s.sessions, 0);
  const totMs = r3.sets.reduce((t, s) => t + s.ms, 0);
  say(tot === r3.rawN && totMs === r3.rawMs, '세트별 합계 = logs 합계', '세션 ' + tot + '/' + r3.rawN + ' · 시간 ' + totMs + '/' + r3.rawMs + 'ms');
  console.log('     ' + r3.sets.map(s => s.label + '(학습 ' + s.sessions + '회)').join(' · '));

  // ───── 4. 퀴즈 + 목표 달성 숙제 자동 완료 ─────
  console.log('\n── 4  퀴즈 · 숙제 자동 완료');
  const r4 = await page.evaluate(async (a) => {
    await loginStudent(DB.stus().find(s => s.id === a.sid));
    await new Promise(r => setTimeout(r, 1000));
    const hw = (_cache.assignments || []).find(x => x.id === a.hw);
    const cards = DB.cards(a.sid).filter(c => (hw.words || []).includes(c.word));
    quizState = null;
    openVocabQuiz(a.sid, { set: { key: 'hw:' + a.hw, label: '더미 숙제', cards } });
    await new Promise(r => setTimeout(r, 450));
    [...document.querySelectorAll('#st-vocab button')].find(b => /시작/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 400));
    for (let i = 0; i < 10; i++) {
      if (!quizState || quizState.idx >= quizState.qs.length) break;
      const q = quizState, it = q.qs[q.idx];
      if (it.type === 'spell') { document.getElementById('qz-in').value = it.card.word; qzAnswerSpell(); }
      else qzAnswer(q.cur.right);
      await new Promise(r => setTimeout(r, 700));
      if (document.querySelector('.result-ring')) break;
    }
    await new Promise(r => setTimeout(r, 2500));
    const ring = document.querySelector('.result-ring');
    const hw2 = (_cache.assignments || []).find(x => x.id === a.hw);
    return { score: ring ? ring.textContent.trim() : '', done: !!(hw2.schedule || []).find(s => s.date === a.today && s.done) };
  }, { sid: SID, hw: HWID, today });
  say(r4.score === '100점', '퀴즈 100점', r4.score);
  say(r4.done, 'quizGoal(90점 1회) 달성 → 숙제 자동 완료 ✓');

  // ───── 5. 그래프 ─────
  console.log('\n── 5  점수 추이 그래프');
  const r5 = await page.evaluate(async (a) => {
    await returnToTeacher(); await new Promise(r => setTimeout(r, 2000));
    await loadVocabCards(a.sid);
    const trend = ppQuizTrend(a.sid, 'hw:' + a.hw, 20);
    const svg = rpTrendSvg(a.sid, 'hw:' + a.hw);
    return { n: trend.length, scores: trend.map(t => t.score), svg: /\<svg/.test(svg), goalLine: /stroke-dasharray/.test(svg), pts: (svg.match(/<circle/g) || []).length, label: ppSetLabel('hw:' + a.hw) };
  }, { sid: SID, hw: HWID });
  say(r5.svg && r5.goalLine, '인라인 SVG + 목표 점수 선', '점 ' + r5.pts + '개');
  say(r5.n === r5.pts && r5.n > 0, '회차 수 = 점 개수', r5.n + '회차 ' + r5.scores.join(','));
  say(/숙제/.test(r5.label), '세트 이름이 숙제로 보인다', r5.label);

  // ───── 6. 리포트 요약 ─────
  const r6 = await page.evaluate((sid) => {
    const r = ppVocabReport(sid);
    return { days: r.days, ms: r.ms, tries: r.quizTries, best: r.quizBest, last: r.quizLast, cards: r.cards, dist: r.dist, msText: ppMsText(r.ms) };
  }, SID);
  say(r6.days >= 1 && r6.tries >= 1, '요약: 학습 ' + r6.days + '일 ' + r6.msText + ' · 퀴즈 ' + r6.tries + '회 최고 ' + r6.best);
  say(r6.dist.fresh + r6.dist.learning + r6.dist.long === r6.cards, '카드 분포 합 = 전체', JSON.stringify(r6.dist) + ' = ' + r6.cards);

  // ───── 7. 설정 저장 → 학생 화면 반영 ─────
  console.log('\n── 7  설정 저장');
  const r7 = await page.evaluate(async (sid) => {
    show('s-teacher'); swTab('t-stu');
    await loadStuPanel(sid); await new Promise(r => setTimeout(r, 900));
    swSpTab('sp-vocab'); await new Promise(r => setTimeout(r, 700));
    const has = { report: !!document.querySelector('details summary') && /단어 리포트/.test(document.getElementById('sp-vocab').textContent),
      chunk: !!document.getElementById('qz-chunk'), sec: !!document.getElementById('qz-sec') };
    if (document.getElementById('qz-chunk')) document.getElementById('qz-chunk').value = '5';
    if (document.getElementById('qz-sec')) document.getElementById('qz-sec').value = '5';
    await saveQuizCfg(sid);
    await new Promise(r => setTimeout(r, 1200));
    return { has, chunk: vcChunkSize(sid), sec: ppQuizCfg(sid).sec };
  }, SID);
  say(r7.has.report, '학생 패널에 📊 단어 리포트');
  say(r7.has.chunk, '같은 섹션에 구간 크기 입력란');
  say(r7.chunk === 5 && r7.sec === 5, '저장 뒤 설정이 반영된다', '구간 ' + r7.chunk + '장 · ' + r7.sec + '초');
  const r7b = await page.evaluate(async (sid) => {
    await loginStudent(DB.stus().find(s => s.id === sid));
    await new Promise(r => setTimeout(r, 900));
    try { sessionStorage.removeItem('deckState_' + sid); } catch (e) { }
    vocabChunkAll = false; vocabStudyMode = 'all'; renderVocabDeck(sid);
    await new Promise(r => setTimeout(r, 500));
    const chunks = (deckState._chunks || []).map(c => c.length);
    await returnToTeacher(); await new Promise(r => setTimeout(r, 1500));
    return chunks;
  }, SID);
  say(r7b[0] === 5, '학생 화면 구간이 5장으로', r7b.join('+'));

  // ───── 8. 학습기록 리셋 ─────
  console.log('\n── 8  학습기록 리셋');
  const beforeReset = await cardSnap();
  const r8 = await page.evaluate(async (a) => {
    const orig = window.askConfirm;
    window.askConfirm = (t, msg, ok, cls, fn) => { window._msg = msg; fn(); };
    await hwResetProgress(a.hw);
    await new Promise(r => setTimeout(r, 1500));
    window.askConfirm = orig;
    const hw = (_cache.assignments || []).find(x => x.id === a.hw);
    return { msg: window._msg, done: !!(hw.schedule || []).find(s => s.date === a.today && s.done), resetAt: !!hw.resetAt };
  }, { hw: HWID, today });
  say(/완료 표시만 지워요\. 단어 카드 기록은 그대로예요\./.test(r8.msg || ''), '확인창 문구', r8.msg);
  say(!r8.done && r8.resetAt, '완료 표시만 지우고 resetAt 기록');
  await page.waitForTimeout(1200);
  const afterReset = await cardSnap();
  const changed = Object.keys(afterReset).filter(w => afterReset[w] !== beforeReset[w]);
  say(changed.length === 0, '카드 기록 무변화', '바뀐 카드 ' + changed.length + '장');
  const r8b = await page.evaluate((a) => {
    const sets = ppVocabSets(a.sid).filter(s => s.key === 'hw:' + a.hw);
    return { trend: ppQuizTrend(a.sid, 'hw:' + a.hw, 20).length, sets: sets.length ? sets[0].tries : -1 };
  }, { sid: SID, hw: HWID });
  say(r8b.trend === 0 && r8b.sets <= 0, 'resetAt 이후 기록만 센다 (리셋 전 퀴즈는 빠짐)', '추이 ' + r8b.trend + '회차 · 세트 응시 ' + r8b.sets);

  // ───── 9. 추가 수신 0 ─────
  const g0 = gets;
  await page.evaluate((sid) => { ppVocabReport(sid); ppVocabSets(sid); ppQuizTrend(sid, 'daily', 20); }, SID);
  say(gets === g0, '리포트 계산에 새 수신 0건', 'GET ' + (gets - g0) + '건');

  // ───── 10. 화면 ─────
  console.log('\n── 10  화면');
  await page.evaluate(async (sid) => { show('s-teacher'); swTab('t-stu'); await loadStuPanel(sid); await new Promise(r => setTimeout(r, 700)); swSpTab('sp-vocab'); await new Promise(r => setTimeout(r, 600)); }, SID);
  for (const w of [320, 390, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(500);
    const o = await page.evaluate(() => {
      const de = document.documentElement; let out = 0;
      document.querySelectorAll('#sp-vocab *').forEach(x => {
        const st = getComputedStyle(x); if (st.display === 'none' || x.offsetParent === null) return;
        const b = x.getBoundingClientRect(); if (b.width && b.right > de.clientWidth + 1) out++;
      });
      return { ov: Math.max(0, de.scrollWidth - de.clientWidth), out };
    });
    say(o.ov === 0 && o.out === 0, w + 'px 넘침 0', '가로 ' + o.ov + 'px · 요소 ' + o.out + '개');
  }

  console.log('\n콘솔 오류 ' + errs.length + '건'); [...new Set(errs)].slice(0, 4).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
