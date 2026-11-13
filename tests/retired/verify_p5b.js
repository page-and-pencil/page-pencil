require('../_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// P5 추가 확인: ① 세션 0건 → '0일 · 0분'  ② 리포트 게임 한 줄  ③ kspGrade 끝말(조깅/빠르다)
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..', '..');
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
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    const b = r.request().postData() || '';
    return (b.indexOf(SID) >= 0) ? r.continue() : r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { window.speakWord = async () => { }; });

  // ───── 1. 기록 0건 → '0일 · 0분' ─────
  console.log('── 1  학습 기록 0건일 때 표시');
  const r1 = await page.evaluate((sid) => {
    const rep = ppVocabReport(sid);
    const html = rpReportHtml(sid);
    const m = html.replace(/<[^>]*>/g, '|').match(/\|(\d+일 · [^|]+)\|/);
    return { days: rep.days, ms: rep.ms, msText: ppMsText(rep.ms), msText0: ppMsText(0),
      msText20s: ppMsText(20000), msText30s: ppMsText(30000), msText90s: ppMsText(90000), shown: m ? m[1] : '',
      sess: (_cache.logs || []).filter(l => l.sid === sid && l.type === 'vocab_session' && !l._deleted).length };
  }, SID);
  say(r1.sess === 0, '세션 기록 0건인 상태', r1.sess + '건');
  say(r1.msText === '0분', "0건이면 '0분'", r1.days + '일 · ' + r1.msText);
  say(r1.shown === '0일 · 0분', "요약에 '0일 · 0분'으로 나온다", "'" + r1.shown + "'");
  say(r1.msText20s === '1분 미만' && r1.msText30s === '1분' && r1.msText90s === '2분', "20초→'1분 미만' · 30초→'1분' · 90초→'2분' (ms>0 동작은 그대로)", r1.msText20s + ' / ' + r1.msText30s + ' / ' + r1.msText90s);

  // ───── 2. kspGrade 끝말 — 크래시 '단어 보고 뜻 입력' ─────
  console.log('\n── 2  kspGrade 끝말 (조깅 / 빠르다)');
  const r2 = await page.evaluate(async (sid) => {
    // 함수 자체
    const direct = {
      jog: kspGrade('조깅', '조깅하다'),
      fast: kspGrade('빠르다', '빠른'),
      jogRev: kspGrade('조깅하다', '조깅하다'),
      bad: kspGrade('수영', '조깅하다'),
    };
    // 게임 안에서
    await loginStudent(DB.stus().find(s => s.id === sid));
    await new Promise(r => setTimeout(r, 1000));
    gmState = null; quizState = null; wnState = null;
    openGameCrash(sid);
    await new Promise(r => setTimeout(r, 350));
    document.getElementById('gm-mode-ko').checked = true;
    _gmStart();
    await new Promise(r => setTimeout(r, 250));
    const poolHas = { jog: !!gmState.pool.find(c => c.word === 'jog'), fast: !!gmState.pool.find(c => c.word === 'fast') };
    const steps = [];
    for (const [w, typed] of [['jog', '조깅'], ['fast', '빠르다']]) {
      gmState.cur = gmState.pool.find(c => c.word === w);
      const t = document.getElementById('gm-fall');
      if (t) t.textContent = gmState.cur.word;
      const h0 = gmState.hits, l0 = gmState.lives;
      const i = document.getElementById('gm-in'); i.value = typed; crashType();
      await new Promise(r => setTimeout(r, 300));
      steps.push({ word: w, meaning: (gmState.pool.find(c => c.word === w) || {}).meaning, typed,
        hitUp: gmState.hits - h0, livesSame: gmState.lives === l0 });
    }
    // 아예 다른 뜻은 오답이고, 목숨도 안 깎인다
    gmState.cur = gmState.pool.find(c => c.word === 'jog');
    const h1 = gmState.hits, l1 = gmState.lives;
    const i3 = document.getElementById('gm-in'); i3.value = '수영'; crashType();
    await new Promise(r => setTimeout(r, 250));
    const wrong = { hitUp: gmState.hits - h1, livesSame: gmState.lives === l1, msg: document.getElementById('gm-msg').textContent };
    _gmLeave();
    return { direct, poolHas, steps, wrong };
  }, SID);
  say(r2.poolHas.jog && r2.poolHas.fast, '더미에 jog(조깅하다) · fast(빠른) 카드가 들어 있다');
  say(r2.direct.jog.r === 'ok', "kspGrade('조깅','조깅하다') = 정답", JSON.stringify(r2.direct.jog));
  say(r2.direct.fast.r === 'ok', "kspGrade('빠르다','빠른') = 정답", JSON.stringify(r2.direct.fast));
  say(r2.direct.jogRev.r === 'ok', "kspGrade('조깅하다','조깅하다') = 정답");
  say(r2.direct.bad.r === 'no', "kspGrade('수영','조깅하다') = 오답", JSON.stringify(r2.direct.bad));
  r2.steps.forEach(s => say(s.hitUp === 1 && s.livesSame,
    "크래시에서 '" + s.typed + "' → " + s.word + '(' + s.meaning + ') 정답 처리', '맞힘 +' + s.hitUp + ' · 목숨 그대로 ' + s.livesSame));
  say(r2.wrong.hitUp === 0 && r2.wrong.livesSame, "'수영'은 오답이고 목숨은 그대로", '안내: ' + r2.wrong.msg);

  // ───── 3. 리포트 게임 한 줄 ─────
  console.log('\n── 3  리포트 게임 한 줄');
  const r3 = await page.evaluate(async (sid) => {
    // 게임 한 판 (매칭) — 기록을 남겨 리포트에 뜨는지 본다
    gmState = null; openGameMatch(sid); await new Promise(r => setTimeout(r, 320)); _gmStart();
    await new Promise(r => setTimeout(r, 140));
    for (const id of gmState.lcol.slice()) { gmPick('l', id); gmPick('r', id); await new Promise(r => setTimeout(r, 12)); }
    await new Promise(r => setTimeout(r, 700));
    const score = gmState.score;
    await returnToTeacher(); await new Promise(r => setTimeout(r, 2200));
    const sum = ppGameSummary(sid, 30);
    const html = rpReportHtml(sid);
    const txt = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const line = (txt.match(/🎮 게임 ([^·]*판[^|]*?)(앱 학습 전|세트별|$)/) || [])[1] || (txt.match(/🎮 게임 ([^\n]{0,120})/) || [])[1] || '';
    const sets = ppVocabSets(sid);
    return { score, sum, line: line.trim().slice(0, 140),
      inSets: JSON.stringify(sets).indexOf('vocab_game') >= 0 || sets.some(s => /게임|매칭|크래시|1분/.test(s.label)),
      setLabels: sets.map(s => s.label) };
  }, SID);
  await page.waitForTimeout(1000);
  const played = r3.sum.filter(g => g.plays);
  say(played.length === 1 && played[0].game === 'match', '게임 요약이 판 수를 센다', JSON.stringify(played.map(g => ({ g: g.game, plays: g.plays, text: g.text }))));
  say(played[0] && played[0].best === r3.score, '최고 기록이 이번 판 점수', played[0].best + ' = ' + r3.score);
  say(/타임어택 매칭/.test(r3.line) && /1판/.test(r3.line), '리포트에 게임 한 줄이 나온다', r3.line);
  say(!r3.inSets, '세트별 표에는 게임이 섞이지 않는다 (게임 1행이 있는 상태에서 확인)', '세트: ' + (r3.setLabels.join(' · ') || '(없음)'));
  const gl = await games();
  say(gl.length === 1, '게임 기록 1행', JSON.stringify(gl.map(d => ({ game: d.game, score: d.score }))));

  // ───── 4. 카드 그대로 ─────
  console.log('\n── 4  단어 카드');
  const snap1 = await cardSnap();
  const diff = Object.keys(snap0).filter(w => snap0[w] !== snap1[w]);
  say(diff.length === 0, '카드가 그대로다', diff.length ? diff.join(', ') : Object.keys(snap1).length + '장 동일');

  // ───── 5. 320/390/1440 — 리포트 게임 줄 ─────
  console.log('\n── 5  리포트 폭');
  for (const w of [320, 390, 1440]) {
    await page.setViewportSize({ width: w, height: 860 });
    await page.waitForTimeout(400);
    const o = await page.evaluate(async (sid) => {
      const host = document.getElementById('sp-vocab');
      if (host) { renderSpVocab(sid); }
      await new Promise(r => setTimeout(r, 400));
      const bad = [];
      const vw = window.innerWidth;
      document.querySelectorAll('#sp-vocab *').forEach(n => {
        const r = n.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') return;
        if (r.right > vw + 1.5 || r.left < -1.5) bad.push(n.className + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
      });
      return { bad: bad.slice(0, 5), hscroll: document.documentElement.scrollWidth > vw + 1 };
    }, SID);
    say(o.bad.length === 0 && !o.hscroll, w + 'px — 넘침 0', o.bad.length ? o.bad.join(' | ') : '없음');
  }

  console.log('\n오류: ' + (errs.length ? errs.slice(0, 6).join(' | ') : '없음'));
  console.log('\n' + (fails ? '실패 ' + fails + '건' : '전부 통과'));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
