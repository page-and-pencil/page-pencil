require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// P5 복습 게임 검증. 더미 학생(p1dummy0001)만 건드린다.
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = 'p1dummy0001';
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1], K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };
const get = async (t, q) => (await (await fetch(U + '/rest/v1/' + t + '?' + q, { headers: H })).json());
const cardSnap = async () => {
  const rows = await get('vocab_cards', 'select=data&sid=eq.' + SID); const o = {};
  rows.forEach(r => { const d = r.data || {}; if (!d._deleted) o[d.word] = [d.hits || 0, d.misses || 0, d.box || 0, d.lastSeen || '', d.lastSeenBy || '', d.due || ''].join('|'); });
  return o;
};
const games = async () => (await get('logs', 'select=data&sid=eq.' + SID)).map(r => r.data).filter(d => d && !d._deleted && d.type === 'vocab_game');

(async () => {
  const snap0 = await cardSnap();
  console.log('카드 ' + Object.keys(snap0).length + '장 스냅샷\n');

  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error' && !/dictionaryapi|favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  let writes = 0;
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    const b = r.request().postData() || '';
    if (b.indexOf(SID) >= 0) { writes++; return r.continue(); }
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { window.speakWord = async () => { }; });

  // ───── 1. 타임어택 매칭 ─────
  console.log('── 1  타임어택 매칭');
  const r1 = await page.evaluate(async (sid) => {
    await loginStudent(DB.stus().find(s => s.id === sid));
    await new Promise(r => setTimeout(r, 900));
    gmState = null; quizState = null; wnState = null;
    openGameMatch(sid);
    await new Promise(r => setTimeout(r, 450));
    const introOk = !!document.querySelector('#st-vocab button[onclick="_gmStart()"]');
    const n = gmState.n, pairs = gmState.pairs.length;
    _gmStart();
    await new Promise(r => setTimeout(r, 260));
    const tiles = document.querySelectorAll('#st-vocab .gm-tile').length;
    const cols = document.querySelectorAll('#st-vocab .gm-tile').length ? document.querySelectorAll('#st-vocab [style*="flex-direction:column"]').length : 0;
    // 일부러 한 번 틀린다 (벌점 +1초)
    const a = gmState.lcol[0], b = gmState.rcol.find(id => id !== a);
    gmPick('l', a); gmPick('r', b);
    await new Promise(r => setTimeout(r, 120));
    const afterWrong = { wrong: gmState.wrong, penalty: gmState.penalty, matched: gmState.matched.length };
    // 나머지 전부 맞춘다
    for (const id of gmState.lcol.slice()) { gmPick('l', id); gmPick('r', id); await new Promise(r => setTimeout(r, 15)); }
    await new Promise(r => setTimeout(r, 500));
    const g = gmState;
    return { introOk, n, pairs, tiles, cols, afterWrong,
      phase: g.phase, wrong: g.wrong, penalty: g.penalty, ms: g.ms, score: g.score,
      isBest: g.isBest, prevBest: g.prevBest, matched: g.matched.length,
      scoreTxt: ppGameScoreText('match', g.score),
      badge: /최고 기록!/.test(document.getElementById('st-vocab').innerHTML) };
  }, SID);
  await page.waitForTimeout(1200);
  say(r1.introOk, '시작 화면이 뜬다');
  say(r1.n === 6 && r1.pairs === 6, '6쌍', r1.n + '쌍');
  say(r1.tiles === 12, '타일 12개', r1.tiles + '개');
  say(r1.cols >= 2, '2열로 놓인다', r1.cols + '열');
  say(r1.afterWrong.wrong === 1 && r1.afterWrong.penalty === 1000, '틀리면 벌점 +1초', '벌점 ' + r1.afterWrong.penalty + 'ms');
  say(r1.afterWrong.matched === 0, '틀린 짝은 짝지어지지 않는다');
  say(r1.matched === 6 && r1.phase === 'done', '6짝 다 맞추면 끝', r1.matched + '짝');
  say(r1.score === r1.ms + 1000, '점수 = 걸린 시간 + 벌점', r1.ms + ' + 1000 = ' + r1.score);
  say(r1.isBest && r1.badge, '첫 판은 최고 기록 배지', '이전 최고 ' + r1.prevBest);
  let gl = await games();
  say(gl.filter(d => d.game === 'match').length === 1, '매칭 기록 1행', JSON.stringify(gl.filter(d => d.game === 'match').map(d => ({ score: d.score, ms: d.ms, n: d.n, setKey: d.setKey }))));
  say(gl.length === 1, '기록은 한 판에 1행', gl.length + '행');
  console.log('     점수 표기: ' + r1.scoreTxt);

  // 두 번째 판 — 더 느리면(벌점 3회) 최고 기록 아님
  const r1b = await page.evaluate(async (sid) => {
    openGameMatch(sid); await new Promise(r => setTimeout(r, 300)); _gmStart();
    await new Promise(r => setTimeout(r, 150));
    for (let k = 0; k < 3; k++) { const a = gmState.lcol[k], b = gmState.rcol.find(id => id !== a); gmPick('l', a); gmPick('r', b); await new Promise(r => setTimeout(r, 25)); }
    for (const id of gmState.lcol.slice()) { gmPick('l', id); gmPick('r', id); await new Promise(r => setTimeout(r, 15)); }
    await new Promise(r => setTimeout(r, 450));
    return { score: gmState.score, penalty: gmState.penalty, isBest: gmState.isBest, prevBest: gmState.prevBest, badge: /최고 기록!/.test(document.getElementById('st-vocab').innerHTML) };
  }, SID);
  await page.waitForTimeout(900);
  say(r1b.penalty === 3000, '벌점 3회 = +3초', r1b.penalty + 'ms');
  say(!r1b.isBest && !r1b.badge, '느린 판에는 배지 없음', '이번 ' + r1b.score + ' vs 최고 ' + r1b.prevBest);

  // ───── 2. 크래시 ─────
  console.log('\n── 2  크래시');
  const r2 = await page.evaluate(async (sid) => {
    gmState = null;
    openGameCrash(sid); await new Promise(r => setTimeout(r, 350));
    const koBoxOff = document.getElementById('gm-mode-ko') && !document.getElementById('gm-mode-ko').checked;
    _gmStart(); await new Promise(r => setTimeout(r, 200));
    const g0 = { mode: gmState.mode, lives: gmState.lives, dur: gmState.dur, hasLane: !!document.getElementById('gm-lane'), hasIn: !!document.getElementById('gm-in') };
    const speeds = [];
    // 맞히기 3번 — 뜻이 떨어지고 영어로 입력
    for (let k = 0; k < 3; k++) {
      speeds.push(gmState.dur);
      const i = document.getElementById('gm-in'); i.value = gmState.cur.word; crashType();
      await new Promise(r => setTimeout(r, 260));
    }
    const afterHits = { hits: gmState.hits, lives: gmState.lives, dur: gmState.dur };
    // 틀려도 목숨은 그대로
    const i2 = document.getElementById('gm-in'); i2.value = 'zzzqqq'; crashType();
    await new Promise(r => setTimeout(r, 120));
    const afterWrongType = { hits: gmState.hits, lives: gmState.lives };
    // 바닥에 닿은 것처럼 3번 — 목숨 3 → 0
    const livesTrail = [];
    for (let k = 0; k < 3; k++) { _crashMiss(); livesTrail.push(gmState.lives); await new Promise(r => setTimeout(r, 60)); }
    await new Promise(r => setTimeout(r, 400));
    const g = gmState;
    return { koBoxOff, g0, speeds, afterHits, afterWrongType, livesTrail,
      phase: g.phase, hits: g.hits, score: g.score, missed: g.missed.slice(), ms: g.ms,
      shownMissed: (document.getElementById('st-vocab').innerHTML.match(/놓친 단어 (\d+)개/) || [])[1] };
  }, SID);
  await page.waitForTimeout(1200);
  say(r2.koBoxOff, "'단어 보고 뜻 입력'은 기본 꺼짐");
  say(r2.g0.mode === 'en' && r2.g0.lives === 3, '목숨 3개 · 뜻→영어 모드', JSON.stringify(r2.g0));
  say(r2.g0.hasLane && r2.g0.hasIn, '떨어지는 칸과 입력칸이 있다');
  say(r2.speeds[0] === 9000 && r2.speeds[1] === 8280 && r2.speeds[2] === 7618, '맞힐 때마다 빨라진다', r2.speeds.join(' → ') + ' → ' + r2.afterHits.dur + 'ms');
  say(r2.afterHits.hits === 3 && r2.afterHits.lives === 3, '맞히면 목숨은 안 줄어든다', '맞힘 ' + r2.afterHits.hits + ' · 목숨 ' + r2.afterHits.lives);
  say(r2.afterWrongType.lives === 3 && r2.afterWrongType.hits === 3, '오타에는 목숨 안 깎임');
  say(r2.livesTrail.join(',') === '2,1,0', '바닥에 닿으면 목숨 1개씩', r2.livesTrail.join(' → '));
  say(r2.phase === 'done' && r2.score === 3, '목숨 0이면 끝 · 점수 = 맞힌 수', r2.score + '개');
  say(r2.missed.length === 3 && r2.shownMissed === '3', '놓친 단어가 끝 화면에 나온다', r2.missed.join(' / '));
  gl = await games();
  say(gl.filter(d => d.game === 'crash').length === 1, '크래시 기록 1행', JSON.stringify(gl.filter(d => d.game === 'crash').map(d => ({ score: d.score, n: d.n }))));

  // 뜻 입력 모드 (kspGrade)
  const r2b = await page.evaluate(async (sid) => {
    gmState = null; openGameCrash(sid); await new Promise(r => setTimeout(r, 300));
    document.getElementById('gm-mode-ko').checked = true;
    _gmStart(); await new Promise(r => setTimeout(r, 200));
    const mode = gmState.mode, shown = document.getElementById('gm-fall').textContent, want = gmState.cur.word;
    const i = document.getElementById('gm-in'); i.value = gmState.cur.meaning; crashType();
    await new Promise(r => setTimeout(r, 280));
    const hit1 = gmState.hits;
    // 끝말만 다른 답도 정답 (kspGrade 'ok')
    const m = gmState.cur.meaning, stem = String(m).split(/[,;/·]/)[0].replace(/하다$/, '');
    const i2 = document.getElementById('gm-in'); i2.value = stem; crashType();
    await new Promise(r => setTimeout(r, 280));
    const hit2 = gmState.hits;
    const ph = gmState.phase;
    _gmLeave();
    return { mode, shown, want, hit1, hit2, ph, stem, m };
  }, SID);
  say(r2b.mode === 'ko' && r2b.shown === r2b.want, "'단어 보고 뜻 입력'에서는 영어 단어가 떨어진다", r2b.shown);
  say(r2b.hit1 === 1, '뜻을 맞히면 점수', '맞힘 ' + r2b.hit1);
  say(r2b.hit2 === 2, '끝말만 다른 답도 정답(kspGrade)', '"' + r2b.m + '" ← "' + r2b.stem + '"');

  // 390px · 키보드 300px 가정 — 떨어지는 칸과 입력칸이 화면 안에 남는가
  console.log('\n── 3  390px 키보드 올라온 상태');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const r3 = await page.evaluate(async (sid) => {
    gmState = null; openGameCrash(sid); await new Promise(r => setTimeout(r, 350));
    _gmStart(); await new Promise(r => setTimeout(r, 300));
    const before = { h: document.getElementById('gm-crash').getBoundingClientRect().height };
    // 키보드 300px 올라온 상태를 흉내 낸다 (visualViewport 를 갈아 끼운다)
    Object.defineProperty(window, 'visualViewport', { configurable: true,
      value: { height: 844 - 300, offsetTop: 0, addEventListener() { }, removeEventListener() { } } });
    _gmFit(); await new Promise(r => setTimeout(r, 120));
    const L = document.getElementById('gm-crash').getBoundingClientRect();
    const lane = document.getElementById('gm-lane').getBoundingClientRect();
    const inp = document.getElementById('gm-in').getBoundingClientRect();
    const fall = document.getElementById('gm-fall').getBoundingClientRect();
    const laneH = gmState.laneH;
    _gmLeave();
    return { before, layerH: L.height, laneBottom: Math.round(lane.bottom), laneH: Math.round(lane.height),
      inpBottom: Math.round(inp.bottom), inpTop: Math.round(inp.top), fallW: Math.round(fall.width), fallTop: Math.round(fall.top), innerLaneH: laneH, vis: 544 };
  }, SID);
  say(Math.round(r3.layerH) === 544, '보이는 높이에 맞춰 줄어든다', '844 → ' + Math.round(r3.layerH) + 'px');
  say(r3.inpBottom <= 544 + 1, '입력칸이 화면 안', '입력칸 아래끝 ' + r3.inpBottom + ' ≤ 544');
  say(r3.laneBottom <= 544 + 1 && r3.laneH >= 96, '떨어지는 칸이 화면 안', '레인 아래끝 ' + r3.laneBottom + ' · 높이 ' + r3.laneH);
  say(r3.innerLaneH > 0 && r3.innerLaneH <= r3.laneH, '떨어지는 거리도 레인 안', '낙하 ' + r3.innerLaneH + ' ≤ ' + r3.laneH);
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.waitForTimeout(500);

  // ───── 4. 1분 퀴즈 (선생님 수업 도구) ─────
  console.log('\n── 4  1분 퀴즈');
  const r4 = await page.evaluate(async (sid) => {
    await returnToTeacher(); await new Promise(r => setTimeout(r, 2000));
    openMinuteQuiz(sid); await new Promise(r => setTimeout(r, 300));
    const introOk = !!document.querySelector('#mq-layer button[onclick="_mqStart()"]');
    _mqStart(); await new Promise(r => setTimeout(r, 260));
    const opts = document.querySelectorAll('#mq-layer .mq-opt').length;
    const word = document.querySelector('#mq-layer .mq-word').textContent;
    const trail = [];
    mqAnswer(mqState.right); trail.push(mqState.score); await new Promise(r => setTimeout(r, 480));
    const wrongIdx = mqState.opts.findIndex((o, i) => i !== mqState.right);
    mqAnswer(wrongIdx); trail.push(mqState.score); await new Promise(r => setTimeout(r, 800));
    mqAnswer(-1); trail.push(mqState.score); await new Promise(r => setTimeout(r, 800));
    const st = { score: mqState.score, ok: mqState.ok, no: mqState.no, pass: mqState.pass, n: mqState.n, left: mqState.left };
    _mqGiveUp(); await new Promise(r => setTimeout(r, 200));
    const askOk = !!document.querySelector('#mq-layer button[onclick="mqSave(true)"]');
    const askTxt = (document.getElementById('mq-layer').textContent.match(/이 기록을 .*? 학생 기록에 남길까요\?/) || [])[0] || '';
    const focused = document.activeElement && document.activeElement.id === 'mq-save';
    await mqSave(true); await new Promise(r => setTimeout(r, 900));
    return { introOk, opts, word, trail, st, askOk, askTxt, focused, layerGone: !document.getElementById('mq-layer') };
  }, SID);
  await page.waitForTimeout(1200);
  say(r4.introOk, '시작 화면이 뜬다');
  say(r4.opts === 4, '보기 4개', r4.opts + '개');
  say(r4.trail.join(',') === '10,0,-5', '정답 +10 · 오답 −10 · 패스 −5', r4.trail.join(' → '));
  say(r4.st.ok === 1 && r4.st.no === 1 && r4.st.pass === 1 && r4.st.n === 3, '집계가 맞다', JSON.stringify(r4.st));
  say(r4.st.left > 0 && r4.st.left <= 60, '60초 타이머가 돈다', '남은 ' + r4.st.left + '초');
  say(r4.askOk && /학생 기록에 남길까요/.test(r4.askTxt), '끝에 저장할지 묻는다', r4.askTxt);
  say(r4.focused, '기본은 저장 (기록 남기기에 포커스)');
  say(r4.layerGone, '저장 뒤 화면이 닫힌다');
  gl = await games();
  const mq = gl.filter(d => d.game === 'minute');
  say(mq.length === 1 && mq[0].score === -5, '1분 퀴즈 기록 1행 (−5점)', JSON.stringify(mq.map(d => ({ score: d.score, n: d.n, ms: d.ms }))));

  // 안 남기기
  const before5 = (await games()).length;
  const r4b = await page.evaluate(async (sid) => {
    openMinuteQuiz(sid); await new Promise(r => setTimeout(r, 250));
    _mqStart(); await new Promise(r => setTimeout(r, 200));
    mqAnswer(mqState.right); await new Promise(r => setTimeout(r, 480));
    _mqGiveUp(); await new Promise(r => setTimeout(r, 150));
    await mqSave(false); await new Promise(r => setTimeout(r, 600));
    return { gone: !document.getElementById('mq-layer') };
  }, SID);
  await page.waitForTimeout(900);
  say(r4b.gone && (await games()).length === before5, "'안 남기기'를 누르면 저장 0", before5 + '행 그대로');

  // ───── 5. 체험 모드 ─────
  console.log('\n── 5  체험 모드');
  const before6 = (await games()).length;
  const r5 = await page.evaluate(async (sid) => {
    await previewAsStudent(sid); await new Promise(r => setTimeout(r, 2600));
    const sandOn = ppSandbox();
    gmState = null; openGameMatch(sid); await new Promise(r => setTimeout(r, 350)); _gmStart();
    await new Promise(r => setTimeout(r, 150));
    for (const id of gmState.lcol.slice()) { gmPick('l', id); gmPick('r', id); await new Promise(r => setTimeout(r, 12)); }
    await new Promise(r => setTimeout(r, 600));
    const inCache = (_cache.logs || []).filter(l => l.sid === sid && l.type === 'vocab_game').length;
    await returnToTeacher(); await new Promise(r => setTimeout(r, 2200));
    return { sandOn, inCache };
  }, SID);
  await page.waitForTimeout(1000);
  say(r5.sandOn, '미리보기는 체험 모드');
  say((await games()).length === before6, '체험 모드 게임 저장 0건', before6 + '행 그대로');

  // ───── 6. 카드가 그대로인가 ─────
  console.log('\n── 6  단어 카드');
  const snap1 = await cardSnap();
  const diff = Object.keys(snap0).filter(w => snap0[w] !== snap1[w]);
  say(diff.length === 0, '게임은 카드(hits·misses·box·lastSeen·due)를 바꾸지 않는다', diff.length ? diff.join(', ') : Object.keys(snap1).length + '장 모두 동일');

  // ───── 7. 홈 보너스 · 첫 화면 길이 ─────
  console.log('\n── 7  홈 보너스 칸');
  const r7 = await page.evaluate(async (sid) => {
    await loginStudent(DB.stus().find(s => s.id === sid));
    await new Promise(r => setTimeout(r, 1200));
    swStuTab('st-home'); await new Promise(r => setTimeout(r, 700));
    const det = [...document.querySelectorAll('#st-home details')].find(d => /보너스/.test(d.querySelector('summary') ? d.querySelector('summary').textContent : ''));
    const openByDefault = det ? det.open : null;
    const rowsHidden = document.querySelectorAll('#st-home .gm-row').length;
    if (det) det.open = true;
    await new Promise(r => setTimeout(r, 200));
    const rows = [...document.querySelectorAll('#st-home .gm-row')];
    return { openByDefault, rowsHidden, n: rows.length,
      labels: rows.map(b => b.textContent.replace(/\s+/g, ' ').trim()),
      disabled: rows.map(b => b.disabled) };
  }, SID);
  say(r7.openByDefault === false, "'🎮 보너스 · 내 기록'은 접힌 채 (첫 화면 길이 그대로)");
  say(r7.n === 3, '게임 3개가 보너스 안에 있다', r7.n + '개');
  say(r7.disabled.join(',') === 'false,false,true', '1분 퀴즈는 수업 도구라 학생은 기록만', JSON.stringify(r7.disabled));
  r7.labels.forEach(l => console.log('     ' + l));

  // ───── 8. 320 / 390 / 1440 ─────
  console.log('\n── 8  화면 폭');
  for (const w of [320, 390, 1440]) {
    await page.setViewportSize({ width: w, height: 860 });
    await page.waitForTimeout(400);
    const o = await page.evaluate(async (sid) => {
      const bad = [];
      const scan = (tag) => {
        const vw = window.innerWidth;
        document.querySelectorAll('#st-vocab *, #mq-layer *').forEach(n => {
          const r = n.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          const cs = getComputedStyle(n);
          if (cs.visibility === 'hidden' || cs.display === 'none') return;
          if (r.right > vw + 1.5 || r.left < -1.5) bad.push(tag + ': ' + n.className + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
        });
        return document.documentElement.scrollWidth > vw + 1;
      };
      let hscroll = false;
      gmState = null; openGameMatch(sid); await new Promise(r => setTimeout(r, 300)); _gmStart(); await new Promise(r => setTimeout(r, 250));
      hscroll = scan('매칭') || hscroll;
      gmState = null; openGameCrash(sid); await new Promise(r => setTimeout(r, 300)); _gmStart(); await new Promise(r => setTimeout(r, 300));
      hscroll = scan('크래시') || hscroll;
      _gmLeave(); swStuTab('st-home'); await new Promise(r => setTimeout(r, 300));
      await returnToTeacher(); await new Promise(r => setTimeout(r, 2000));
      openMinuteQuiz(sid); await new Promise(r => setTimeout(r, 250)); _mqStart(); await new Promise(r => setTimeout(r, 250));
      hscroll = scan('1분퀴즈') || hscroll;
      const cols = getComputedStyle(document.querySelector('#mq-layer .mq-opts')).gridTemplateColumns.split(' ').length;
      _mqClose();
      await loginStudent(DB.stus().find(s => s.id === sid)); await new Promise(r => setTimeout(r, 1400));
      return { bad: bad.slice(0, 6), hscroll, cols };
    }, SID);
    say(o.bad.length === 0 && !o.hscroll, w + 'px — 넘침 0 · 가로 스크롤 없음', o.bad.length ? o.bad.join(' | ') : (w < 560 ? '1분퀴즈 보기 ' + o.cols + '열' : '1분퀴즈 보기 ' + o.cols + '열'));
  }

  console.log('\n오류: ' + (errs.length ? errs.slice(0, 6).join(' | ') : '없음'));
  console.log('쓰기 요청(더미): ' + writes + '건');
  console.log('\n' + (fails ? '실패 ' + fails + '건' : '전부 통과'));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
