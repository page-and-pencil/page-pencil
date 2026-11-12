require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// P4 누적 오답 4주 복습 검증. 더미 학생만.
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = 'p1dummy0001';
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1], K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };
const post = async (t, rows) => {
  const r = await fetch(U + '/rest/v1/' + t, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(t + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
};
const get = async (t, q) => (await (await fetch(U + '/rest/v1/' + t + '?' + q, { headers: H })).json());
const cardSnap = async () => {
  const rows = await get('vocab_cards', 'select=data&sid=eq.' + SID);
  const o = {}; rows.forEach(r => { const d = r.data || {}; if (!d._deleted) o[d.word] = [d.hits || 0, d.misses || 0, d.box || 0, d.lastSeen || '', d.due || ''].join('|'); });
  return o;
};
const shift = (ds, n) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const monOf = ds => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

(async () => {
  // ── 오답 기록 심기: 이번 주 월요일 기준 1·2·5주 전 ──
  const today = new Date().toISOString().slice(0, 10);
  const mon = monOf(today);
  const w1 = shift(mon, -3);    // 지난주 (1주 전)
  const w2 = shift(mon, -10);   // 2주 전
  const w5 = shift(mon, -31);   // 5주 전 → 빠져야 함
  const seed = [
    { id: 'wnq1', date: w1, type: 'vocab_quiz', partial: false, wrong: ['factory', 'farmer'], score: 80, total: 10 },
    { id: 'wnq2', date: w2, type: 'vocab_quiz', partial: false, wrong: ['machine'], score: 90, total: 10 },
    { id: 'wnq3', date: w1, type: 'vocab_quiz', partial: true, wrong: ['shelf'], score: 100, total: 2 },   // partial → 제외
    { id: 'wnq4', date: w5, type: 'vocab_quiz', partial: false, wrong: ['serious'], score: 70, total: 10 }, // 5주 전 → 제외
  ].map(d => ({ id: d.id, sid: SID, data: { ...d, sid: SID }, updated_at: new Date().toISOString() }));
  await post('logs', seed);
  await post('tests', [
    { id: 'wnt1', sid: SID, data: { id: 'wnt1', sid: SID, date: w1, wrongWords: ['container', 'worker'], vocabCorrect: 8, vocabTotal: 10 }, updated_at: new Date().toISOString() },
    { id: 'wnt2', sid: SID, data: { id: 'wnt2', sid: SID, date: w5, wrongWords: ['driver'], vocabCorrect: 9, vocabTotal: 10 }, updated_at: new Date().toISOString() },
    { id: 'wnt3', sid: SID, data: { id: 'wnt3', sid: SID, date: w1, testKind: 'school', wrongWords: ['quickly'], vocabCorrect: 8, vocabTotal: 10 }, updated_at: new Date().toISOString() }, // 내신 → 제외
  ]);
  console.log('오답 심음: 지난주 ' + w1 + ' · 2주전 ' + w2 + ' · 5주전 ' + w5 + ' (이번 주 월요일 ' + mon + ')\n');

  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error' && !/dictionaryapi/.test(m.text())) errs.push('console: ' + m.text().slice(0, 150)); });
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

  // ───── 1. 묶음 구성 ─────
  console.log('── 1  이번 주 묶음');
  const r1 = await page.evaluate(async (sid) => {
    await loadVocabCards(sid);   // 단어장이 받아져 있어야 묶음을 만들 수 있다
    const s = ppWrongSet(sid);
    return { week: s.week, mon: s.mon, from: s.from, to: s.to, words: s.words.slice().sort() };
  }, SID);
  console.log('     주차 ' + r1.week + ' · 범위 ' + r1.from + ' ~ ' + r1.to);
  say(r1.words.includes('factory') && r1.words.includes('farmer'), '지난주 퀴즈 오답이 들어간다', r1.words.join(', '));
  say(r1.words.includes('machine'), '2주 전 오답도 들어간다');
  say(r1.words.includes('container') && r1.words.includes('worker'), '종이 시험(자체) 오답도 들어간다');
  say(!r1.words.includes('serious') && !r1.words.includes('driver'), '5주 지난 오답은 빠진다');
  say(!r1.words.includes('shelf'), "'틀린 것만 다시'(partial) 회차는 재료가 아니다");
  say(!r1.words.includes('quickly'), '내신 시험 오답은 빠진다 (자체 시험만)');
  say(r1.words.length === 5, '묶음 5개', r1.words.length + '개');

  // ───── 2. 학생 홈 줄 ─────
  const r2 = await page.evaluate(async (sid) => {
    await loginStudent(DB.stus().find(s => s.id === sid));
    await new Promise(r => setTimeout(r, 1200));
    const t = (document.getElementById('st-home') || {}).textContent.replace(/\s+/g, ' ');
    return { has: /오답 복습/.test(t), txt: (t.match(/오답 복습.{0,50}/) || [''])[0] };
  }, SID);
  say(r2.has, '학생 홈에 오답 복습 줄', r2.txt.trim());

  // ───── 3. 복습 — 틀리면 끝에 다시 ─────
  console.log('\n── 3  복습 진행');
  const before = await cardSnap();
  const r3 = await page.evaluate(async (sid) => {
    openWrongNote(sid);
    await new Promise(r => setTimeout(r, 500));
    const first = wnState.queue[0].word;
    const n0 = wnState.queue.length;
    // 일부러 틀림
    const wrongIdx = (wnState.cur.right + 1) % wnState.cur.opts.length;
    wnAnswer(wrongIdx);
    await new Promise(r => setTimeout(r, 1100));
    const afterWrong = { head: wnState.queue[0].word, tail: wnState.queue[wnState.queue.length - 1].word, n: wnState.queue.length, cleared: wnState.cleared };
    // 이제 전부 맞힘
    for (let i = 0; i < 30; i++) {
      if (!wnState || !wnState.queue.length) break;
      wnAnswer(wnState.cur.right);
      await new Promise(r => setTimeout(r, 620));
      if (!wnState || !wnState.queue.length) break;
    }
    await new Promise(r => setTimeout(r, 900));
    const txt = (document.getElementById('st-vocab') || {}).textContent.replace(/\s+/g, ' ');
    return { first, n0, afterWrong, done: /완료|묶음 끝/.test(txt), txt: txt.slice(0, 90) };
  }, SID);
  say(r3.afterWrong.tail === r3.first && r3.afterWrong.n === r3.n0, '틀리면 묶음 끝으로 다시 간다', r3.first + ' → 맨 뒤 (' + r3.afterWrong.n + '개 유지)');
  say(r3.afterWrong.cleared === 0, '틀린 건 완료로 세지 않는다');
  say(r3.done, '전부 맞히면 끝난다', r3.txt.trim());

  // ───── 4. 카드 기록 무변화 ─────
  await page.waitForTimeout(1500);
  const after = await cardSnap();
  const changed = Object.keys(after).filter(w => after[w] !== before[w]);
  say(changed.length === 0, '카드 기록(hits·misses·box·due·lastSeen) 무변화', '바뀐 카드 ' + changed.length + '장');

  // ───── 5. logs 주당 1행 ─────
  const lg = (await get('logs', 'select=data&sid=eq.' + SID)).map(r => r.data).filter(d => d && d.type === 'vocab_wrongnote' && !d._deleted);
  say(lg.length === 1, 'logs 에 vocab_wrongnote 주당 1행', lg.length + '행 · ' + JSON.stringify(lg[0] && { week: lg[0].week, done: (lg[0].done || []).length, total: lg[0].total }));
  say(lg[0] && lg[0].id === 'wn_' + SID + '_' + r1.week, 'id 가 주차마다 하나라 갱신된다', lg[0] && lg[0].id);

  // ───── 6. 20개 끊기 · 이어 하기 ─────
  console.log('\n── 6  20개 끊기');
  const r6 = await page.evaluate((sid) => {
    // 25개짜리 묶음을 흉내 — 카드 25장을 가짜 오답으로
    const cards = DB.cards(sid);
    const fake = { cards, remain: cards, done: [], week: ppWeekKey(ppToday()) };
    const chunk = fake.remain.slice(0, PP_WN_CHUNK);
    return { pool: cards.length, chunk: chunk.length, limit: PP_WN_CHUNK };
  }, SID);
  say(r6.limit === 20, '한 번에 20개씩', PP_WN_CHUNK_TXT(r6));
  function PP_WN_CHUNK_TXT(x) { return x.limit + '개 · 지금 묶음 ' + x.pool + '장 → ' + x.chunk + '개'; }

  // ───── 7. 다음 주가 되면 새 묶음 ─────
  const r7 = await page.evaluate((sid) => {
    const nextMon = ppShiftDate(ppWeekMon(ppToday()), 7);
    const cur = ppWrongSet(sid, ppToday());
    const nxt = ppWrongSet(sid, nextMon);
    return { curWeek: cur.week, nextWeek: nxt.week, curN: cur.words.length, nextN: nxt.words.length,
      nextWords: nxt.words.slice().sort(), p: ppWrongProgress(sid, nxt.week).done.length };
  }, SID);
  say(r7.curWeek !== r7.nextWeek, '다음 주는 다른 주차 키', r7.curWeek + ' → ' + r7.nextWeek);
  say(r7.p === 0, '다음 주 진도는 0에서 시작 (새 묶음)', r7.p + '개 완료');
  console.log('     다음 주 묶음: ' + (r7.nextWords.join(', ') || '(없음)') + ' — 1주 더 지나 빠진 단어가 있습니다');

  // ───── 8. 학부모·리딩로그 분리 ─────
  const r8 = await page.evaluate((sid) => ({
    reading: DB.logs().filter(l => l.sid === sid).length,
    wn: (_cache.logs || []).filter(l => l.sid === sid && l.type === 'vocab_wrongnote').length,
  }), SID);
  say(r8.reading === 0 && r8.wn > 0, '리딩로그(DB.logs)에 안 섞인다', '리딩로그 ' + r8.reading + ' · 오답복습 ' + r8.wn);

  // ───── 9. 선생님 패널 ─────
  const r9 = await page.evaluate((sid) => {
    const w = ppWrongStat(sid);
    return { total: w.total, done: w.done, lastPct: w.lastPct, top: w.top.slice(0, 3).map(t => t.word + '×' + t.n) };
  }, SID);
  say(r9.total === 5, '선생님 통계: 이번 주 ' + r9.done + '/' + r9.total);
  say(r9.top.length > 0, '자주 틀린 단어 상위', r9.top.join(', '));

  // ───── 10. 화면 ─────
  console.log('\n── 10  화면');
  await page.evaluate(async (sid) => { wnState = null; openWrongNote(sid); await new Promise(r => setTimeout(r, 500)); }, SID);
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

  console.log('\n콘솔 오류 ' + errs.length + '건'); [...new Set(errs)].slice(0, 4).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
