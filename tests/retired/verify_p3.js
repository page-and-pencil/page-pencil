require('../_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// P3 스피드 테스트 검증. 더미 학생만. 실학생에는 쓰지 않는다.
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = 'p1dummy0001';
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1], K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];
const H = { apikey: K, Authorization: 'Bearer ' + K };
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };
const cardSnap = async () => {
  const rows = await (await fetch(U + '/rest/v1/vocab_cards?select=data&sid=eq.' + SID, { headers: H })).json();
  const o = {}; rows.forEach(r => { const d = r.data || {}; o[d.word] = { h: d.hits || 0, m: d.misses || 0, b: d.box || 0, ls: d.lastSeen || '', by: d.lastSeenBy || '' }; });
  return o;
};
const quizLogs = async () => {
  const rows = await (await fetch(U + '/rest/v1/logs?select=data&sid=eq.' + SID, { headers: H })).json();
  return rows.map(r => r.data).filter(d => d && d.type === 'vocab_quiz' && !d._deleted);
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = []; let ttsCalls = 0, ttsCache = 0;
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error' && !/dictionaryapi/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
  page.on('request', r => {
    const u = r.url();
    if (/api\.elevenlabs\.io|functions\/v1\/tts-proxy/.test(u)) ttsCalls++;
    if (/tts_cache/.test(u)) ttsCache++;
  });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"server":true,"ready":true}' }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    return ((r.request().postData() || '').indexOf(SID) >= 0) ? r.continue() : r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { window._spoke = []; window.speakWord = async w => { window._spoke.push(String(w)); }; });

  const enterStudent = () => page.evaluate(async (sid) => {
    await loginStudent(DB.stus().find(s => s.id === sid));
    await new Promise(r => setTimeout(r, 1000));
  }, SID);

  // ───── 1. 홈 줄 · 묶음 고르기 ─────
  console.log('── 1  홈 줄 · 단어 묶음');
  await enterStudent();
  const r1 = await page.evaluate((sid) => {
    const set = ppQuizSet(sid);
    const home = (document.getElementById('st-home') || {}).textContent || '';
    return { set: set && { key: set.key, label: set.label, n: set.cards.length, why: set.why }, row: /단어 테스트/.test(home), txt: (home.replace(/\s+/g, ' ').match(/단어 테스트.{0,60}/) || [''])[0] };
  }, SID);
  say(!!r1.set, '단어 묶음을 고른다', r1.set ? r1.set.why + ' · ' + r1.set.label + ' · ' + r1.set.n + '장' : '없음');
  say(r1.row, '홈에 단어 테스트 줄이 보인다', r1.txt.trim());

  // ───── 2. 기본 설정 ─────
  const r2 = await page.evaluate((sid) => ppQuizCfg(sid), SID);
  say(r2.types.join() === 'mc,mcr' && r2.sec === 7 && r2.n === 10 && r2.require === '' && r2.goalTimes === 1,
    '기본값: 뜻 고르기+단어 고르기 · 7초 · 10문항 · 조건 없음', JSON.stringify(r2));

  // ───── 3. 전체 한 회차 (일부 오답) ─────
  console.log('\n── 3  한 회차');
  const before = await cardSnap();
  const r3 = await page.evaluate(async (sid) => {
    openVocabQuiz(sid);
    await new Promise(r => setTimeout(r, 400));
    const intro = (document.getElementById('st-vocab') || {}).textContent || '';
    document.querySelector('#st-vocab button').click();     // 시작
    await new Promise(r => setTimeout(r, 400));
    const seen = [];
    for (let i = 0; i < 30; i++) {
      if (!quizState || quizState.idx >= quizState.qs.length) break;
      const q = quizState, cur = q.cur, it = q.qs[q.idx];
      seen.push(it.type);
      if (it.type === 'spell') { document.getElementById('qz-in').value = (q.idx % 3 === 0) ? 'zzz' : it.card.word; qzAnswerSpell(); }
      else qzAnswer((q.idx % 3 === 0) ? ((cur.right + 1) % cur.opts.length) : cur.right);   // 3문항마다 일부러 틀림
      await new Promise(r => setTimeout(r, 1100));
      if (document.querySelector('.result-ring')) break;
    }
    await new Promise(r => setTimeout(r, 2200));
    const ring = document.querySelector('.result-ring');
    return { intro: intro.replace(/\s+/g, ' ').slice(0, 90), types: [...new Set(seen)], n: seen.length, score: ring ? ring.textContent.trim() : '(없음)', txt: (document.getElementById('st-vocab') || {}).textContent.replace(/\s+/g, ' ').slice(0, 160) };
  }, SID);
  console.log('     ' + r3.intro);
  say(r3.n === 10, '10문항', r3.n + '문항');
  say(r3.types.every(t => t === 'mc' || t === 'mcr'), '기본 유형만 나온다', r3.types.join(','));
  say(/점$/.test(r3.score), '결과 점수', r3.score);
  await page.waitForTimeout(1200);
  const logs1 = await quizLogs();
  say(logs1.length === 1 && !logs1[0].partial, 'logs 에 vocab_quiz 1행 (전체 회차)', JSON.stringify({ score: logs1[0] && logs1[0].score, total: logs1[0] && logs1[0].total, attempt: logs1[0] && logs1[0].attempt, pauses: logs1[0] && logs1[0].pauses }));
  const after1 = await cardSnap();
  const quizMarked = Object.keys(after1).filter(w => after1[w].by === 'quiz');
  say(quizMarked.length > 0, '퀴즈가 카드에 lastSeenBy=quiz 로 반영', quizMarked.length + '장');

  // ───── 4. 틀린 것만 다시 → 점수 합산, 카드 기록 불변 ─────
  console.log('\n── 4  틀린 것만 다시');
  const beforeRetry = await cardSnap();
  const r4 = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll('#st-vocab button')].find(b => /틀린 .*개만 다시/.test(b.textContent));
    if (!btn) return { none: true };
    const base = { total: quizState.answers.length, correct: quizState.answers.filter(a => a.ok).length };
    btn.click();
    await new Promise(r => setTimeout(r, 500));
    const n = quizState.qs.length;
    for (let i = 0; i < 20; i++) {
      if (!quizState || quizState.idx >= quizState.qs.length) break;
      const q = quizState, it = q.qs[q.idx];
      if (it.type === 'spell') { document.getElementById('qz-in').value = it.card.word; qzAnswerSpell(); }
      else qzAnswer(q.cur.right);     // 이번엔 전부 맞힘
      await new Promise(r => setTimeout(r, 900));
      if (document.querySelector('.result-ring')) break;
    }
    await new Promise(r => setTimeout(r, 2000));
    const ring = document.querySelector('.result-ring');
    return { base, n, score: ring ? ring.textContent.trim() : '', partial: quizState && quizState.partial };
  });
  if (r4.none) say(false, '틀린 것만 다시 버튼이 있어야 함');
  else {
    const expect = Math.round((r4.base.correct + r4.n) / r4.base.total * 100) + '점';
    say(r4.score === expect, '점수 합산 (' + r4.base.correct + '+' + r4.n + ')/' + r4.base.total, r4.score + ' (기대 ' + expect + ')');
  }
  await page.waitForTimeout(1200);
  const afterRetry = await cardSnap();
  const changedInRetry = Object.keys(afterRetry).filter(w => JSON.stringify(afterRetry[w]) !== JSON.stringify(beforeRetry[w]));
  say(changedInRetry.length === 0, '재응시는 카드 기록을 바꾸지 않는다', '바뀐 카드 ' + changedInRetry.length + '장');
  const logs2 = await quizLogs();
  say(logs2.filter(l => l.partial).length === 1, "'직전 오답만' 회차는 partial:true 로 기록", logs2.length + '행');

  // ───── 5. 퀴즈 → 같은 날 학습 세션: box 한 칸만 ─────
  console.log('\n── 5  같은 날 중복 반영');
  const beforeStudy = await cardSnap();
  const r5 = await page.evaluate(async (sid) => {
    try { sessionStorage.removeItem('deckState_' + sid); } catch (e) { }
    vocabStudyMode = 'all'; vocabStarOnly = false; vocabChunkAll = true; vocabDeckFilter = null;
    quizState = null;
    renderVocabDeck(sid);
    await new Promise(r => setTimeout(r, 500));
    deckState.stages = ['mem']; deckState.phase = 0; vcStartChunks(); vocabRenderStage();
    await new Promise(r => setTimeout(r, 300));
    const done = [];
    for (let i = 0; i < 30 && deckState.cards[deckState.idx]; i++) { done.push(deckState.cards[deckState.idx].word); memResult(true); await new Promise(r => setTimeout(r, 25)); }
    await new Promise(r => setTimeout(r, 2200));
    return { done: [...new Set(done)], saved: deckState._savedCount };
  }, SID);
  await page.waitForTimeout(1200);
  const afterStudy = await cardSnap();
  const quizCards = Object.keys(beforeStudy).filter(w => beforeStudy[w].by === 'quiz');
  const bumpedTwice = quizCards.filter(w => afterStudy[w].b !== beforeStudy[w].b || afterStudy[w].h !== beforeStudy[w].h);
  say(bumpedTwice.length === 0, '퀴즈가 반영한 카드는 학습 세션이 다시 올리지 않는다 (box 한 칸만)',
    '퀴즈 카드 ' + quizCards.length + '장 중 또 바뀐 것 ' + bumpedTwice.length + '장');
  const freshCards = Object.keys(beforeStudy).filter(w => !beforeStudy[w].ls);
  const freshBumped = freshCards.filter(w => afterStudy[w].b > 0);
  say(freshCards.length === 0 || freshBumped.length > 0, '퀴즈에 안 나온 카드는 학습이 정상 반영', freshCards.length + '장 중 ' + freshBumped.length + '장');

  // ───── 6. 멈춤 ─────
  console.log('\n── 6  멈춤');
  const r6 = await page.evaluate(async (sid) => {
    quizState = null;
    openVocabQuiz(sid, { set: { key: 'test:pause', label: '멈춤 시험', cards: DB.cards(sid).slice(0, 5) } });
    await new Promise(r => setTimeout(r, 400));
    [...document.querySelectorAll('#st-vocab button')].find(b => /시작/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 400));
    const leftBefore = quizState.left;
    qzPause();
    await new Promise(r => setTimeout(r, 700));
    const body = document.getElementById('qz-body'), pz = document.getElementById('qz-paused');
    const hidden = body && getComputedStyle(body).display === 'none' && pz && getComputedStyle(pz).display !== 'none';
    const leftAfter = quizState.left;
    qzResume();
    await new Promise(r => setTimeout(r, 300));
    const resumed = getComputedStyle(document.getElementById('qz-body')).display !== 'none';
    return { hidden, frozen: Math.abs(leftAfter - leftBefore) < 0.35, pauses: quizState.pauses, resumed };
  }, SID);
  say(r6.hidden, '멈춤 중 문제·보기가 가려진다');
  say(r6.frozen, '멈춤 중 타이머가 멈춘다');
  say(r6.resumed, '이어서 하기로 돌아온다');
  say(r6.pauses === 1, '멈춘 횟수를 센다', r6.pauses + '회');

  // ───── 7. 시간 초과 = 오답 ─────
  console.log('\n── 7  시간 초과 · 유형별 시간');
  const r7 = await page.evaluate(async () => {
    const q = quizState;
    const n0 = q.answers.length;
    q.left = 0.15;                       // 곧 만료
    await new Promise(r => setTimeout(r, 900));
    const a = q.answers[n0];
    return { rec: !!a, timeout: a && a.timeout, ok: a && a.ok, word: a && a.word };
  });
  say(r7.rec && r7.timeout && !r7.ok, '시간 초과는 오답으로 기록', r7.word + ' timeout=' + r7.timeout);
  const r7b = await page.evaluate(() => ({ spell: _qzSecFor('spell', 7), mc: _qzSecFor('mc', 7) }));
  say(r7b.spell === 14 && r7b.mc === 7, '철자 쓰기는 기본 시간의 2배', 'spell ' + r7b.spell + '초 / mc ' + r7b.mc + '초');

  // ───── 8. 듣기 재응시 음성 ─────
  console.log('\n── 8  듣고 고르기 음성');
  const t0 = ttsCalls;
  const r8 = await page.evaluate(async (sid) => {
    quizState = null;
    const stu = DB.stus().find(s => s.id === sid);
    stu.vocabQuiz = { types: ['listen'], n: 3, sec: 7, goal: 90, goalTimes: 1, require: '' };
    openVocabQuiz(sid, { set: { key: 'test:listen', label: '듣기 시험', cards: DB.cards(sid).slice(0, 3) } });
    await new Promise(r => setTimeout(r, 400));
    [...document.querySelectorAll('#st-vocab button')].find(b => /시작/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 600));
    window._spoke = [];
    for (let i = 0; i < 6; i++) {
      if (!quizState || quizState.idx >= quizState.qs.length) break;
      qzAnswer(quizState.cur.right); await new Promise(r => setTimeout(r, 800));
      if (document.querySelector('.result-ring')) break;
    }
    await new Promise(r => setTimeout(r, 1800));
    const first = window._spoke.slice();
    // 재응시
    window._spoke = [];
    quizState.partial = false; quizState.pool = DB.cards(sid).slice(0, 3); quizState.n = 3;
    _qzBuild(); quizState.t0 = Date.now(); renderQuizCard();
    await new Promise(r => setTimeout(r, 800));
    for (let i = 0; i < 6; i++) {
      if (!quizState || quizState.idx >= quizState.qs.length) break;
      qzAnswer(quizState.cur.right); await new Promise(r => setTimeout(r, 800));
      if (document.querySelector('.result-ring')) break;
    }
    await new Promise(r => setTimeout(r, 1500));
    return { first, second: window._spoke.slice() };
  }, SID);
  say(r8.first.length > 0 && r8.second.length > 0, '듣기 문항에서 단어를 읽어 준다', '1차 ' + r8.first.length + '회 · 재응시 ' + r8.second.length + '회');
  say(ttsCalls === t0, '재응시에 ElevenLabs 새 생성이 없다', 'TTS 생성 호출 ' + (ttsCalls - t0) + '건 (캐시 조회 ' + ttsCache + '건)');

  // ───── 9. 단어 3개짜리 묶음 보기 채우기 ─────
  console.log('\n── 9  단어 3개 묶음');
  const r9 = await page.evaluate(async (sid) => {
    const cards = DB.cards(sid).slice(0, 3);
    quizState = null;
    openVocabQuiz(sid, { set: { key: 'test:3', label: '세 단어', cards } });
    await new Promise(r => setTimeout(r, 400));
    [...document.querySelectorAll('#st-vocab button')].find(b => /시작/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 400));
    const opts = quizState.cur ? quizState.cur.opts : [];
    return { n: quizState.n, qs: quizState.qs.length, opts: opts.length, uniq: new Set(opts).size, right: quizState.cur && quizState.cur.right >= 0 };
  }, SID);
  say(r9.n === 3 && r9.qs === 3, '단어가 적으면 문항 수도 줄인다', r9.qs + '문항');
  say(r9.opts === 4 && r9.uniq === 4 && r9.right, '보기 4개를 학생 단어장에서 채운다', '보기 ' + r9.opts + '개 (중복 없음)');

  // ───── 10. tests·리딩로그 무변화 ─────
  console.log('\n── 10  다른 기록에 안 섞임');
  const r10 = await page.evaluate((sid) => ({
    logs: DB.logs().filter(l => l.sid === sid).length,
    quiz: (_cache.logs || []).filter(l => l.sid === sid && l.type === 'vocab_quiz').length,
    tests: DB.tsts().filter(t => t.sid === sid).length,
  }), SID);
  say(r10.logs === 0 && r10.quiz > 0, '리딩로그(DB.logs)에 안 섞인다', '리딩로그 ' + r10.logs + ' · 퀴즈기록 ' + r10.quiz);
  say(r10.tests === 0, '자체 시험(tests)에 안 들어간다', r10.tests + '건');

  // ───── 11. 화면 ─────
  console.log('\n── 11  화면');
  for (const w of [320, 390, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(400);
    const o = await page.evaluate(() => {
      const de = document.documentElement; let out = 0;
      document.querySelectorAll('#st-vocab *, #st-home *').forEach(x => {
        const st = getComputedStyle(x); if (st.display === 'none' || x.offsetParent === null) return;
        const b = x.getBoundingClientRect(); if (b.width && b.right > de.clientWidth + 1) out++;
      });
      return { ov: Math.max(0, de.scrollWidth - de.clientWidth), out };
    });
    say(o.ov === 0 && o.out === 0, w + 'px 넘침 0', '가로 ' + o.ov + 'px · 요소 ' + o.out + '개');
  }

  console.log('\n콘솔 오류 ' + errs.length + '건'); [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
