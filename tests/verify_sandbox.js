require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 1) 도장판 정리  2) 체험 모드(학생 기록 보존)  3) 도장은 전부 완료한 날만.
// 실데이터 GET 만. 모든 쓰기는 차단하되 '시도했는지'를 기록해 체험 모드를 검증한다.
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = (process.env.PP_REAL_SID || '');
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const writes = [], errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"server":true,"ready":true}' }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(4500);

  // ───── 3. 도장은 전부 완료한 날만 ─────
  console.log('── 3  도장 계산');
  const st = await page.evaluate(() => {
    const keep = JSON.parse(JSON.stringify(_cache.assignments));
    const sid = 'probe-stamp';
    const d = n => ppShiftDate(ppToday(), -n);
    const mk = (id, rows) => ({ id, sid, category: 'recur', auto: true, bookId: 'nope', bookTitle: '점검용', date: rows[0].date, schedule: rows });
    _cache.assignments = [
      // 하루에 숙제 2개 — 하나만 한 날(절반) / 둘 다 한 날(전부) / 수업으로 처리된 날
      mk('p-half', [{ date: d(3), unit: 'A', done: true, doneBy: 'student' }, { date: d(2), unit: 'B', done: true, doneBy: 'student' }, { date: d(1), unit: 'C', done: true, doneBy: 'lesson' }]),
      mk('p-b', [{ date: d(3), unit: 'X', done: false }, { date: d(2), unit: 'Y', done: true, doneBy: 'student' }]),
    ];
    const r = {
      half: hwDayStatus(sid, d(3)),   // 2개 중 1개 → 절반
      full: hwDayStatus(sid, d(2)),   // 2개 중 2개 → 전부
      lesson: hwDayStatus(sid, d(1)), // 수업 처리분뿐 → 할 일 0
    };
    const probe = { id: sid, name: '점검', hwChallenge: { goal: 20, reward: 'x', start: d(10), createdAt: d(10) } };
    const p = hwChallengeProgress(probe);
    _cache.assignments = keep;
    return { half: r.half, full: r.full, lesson: r.lesson, stamps: p.stamps, fullDays: p.fullDays };
  });
  console.log('   절반 한 날 ' + st.half.done + '/' + st.half.total + ' · 전부 한 날 ' + st.full.done + '/' + st.full.total + ' · 수업 처리분뿐 ' + st.lesson.done + '/' + st.lesson.total);
  say(st.stamps.length === 1, '도장은 전부 한 날에만 1개 (절반만 한 날은 0)', '도장 ' + st.stamps.length + '개 ' + st.stamps.join(','));
  say(st.fullDays.length === st.stamps.length, '⭐(fullDays)와 도장 수가 같다 — 두 등급이 없어졌다');

  // ───── 1. 실학생 도장판 정리 ─────
  console.log('\n── 1  도장판 정리');
  const bd = await page.evaluate((sid) => {
    const s = DB.stus().find(x => x.id === sid);
    const p = hwChallengeProgress(s);
    return { cfg: s.hwChallenge, p: { total: p.total, count: p.count, goal: p.goal, rounds: p.rounds, roundNo: p.roundNo, pending: p.pendingGifts }, log: (s.hwChallengeLog || []).length };
  }, SID);
  console.log('   설정 ' + JSON.stringify(bd.cfg));
  say(bd.cfg.createdAt === '2026-11-08' && bd.cfg.start === '2026-11-08', '오늘부터 새 판 (과거 소급 없음)', 'start=' + bd.cfg.start + ' createdAt=' + bd.cfg.createdAt);
  say(bd.p.total === 0 && bd.p.count === 0, '도장 0부터', '누적 ' + bd.p.total + ' · 현재 판 ' + bd.p.count + '/' + bd.p.goal);
  say(bd.p.pending === 0, '전달할 선물 0 (모두 증정 완료)');
  say(bd.log === 5 && bd.p.roundNo === 6, '지난 기록 5건 유지 · 통산 6번째 판', '기록 ' + bd.log + '건 · ' + bd.p.roundNo + '번째 판');

  // ───── 2. 체험 모드 ─────
  console.log('\n── 2  체험 모드');
  // 캐시가 아니라 **서버 값**을 기준으로 비교한다 (선생님 화면에서는 단어카드를 아직 받지 않아 0장이다)
  const snap = (sid) => page.evaluate(async (sid) => {
    const cards = await supaFetchBySid('vocab_cards', sid);
    const logs = await supaFetchBySid('logs', sid);
    const key = o => [o.id, o.box || 0, o.hits || 0, o.misses || 0, o.lastSeen || '', o.due || '', o._probe || ''].join('|');
    return {
      cards: cards.length, logs: logs.length,
      studied: cards.filter(c => (c.box || 0) > 0 || c.lastSeen).length,
      sig: cards.map(key).sort().join(';').length + ':' + cards.map(key).sort().join(';').slice(0, 40000).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7),
    };
  }, sid);
  const before = await snap(SID);
  Object.assign(before, await page.evaluate(() => ({
    sand: ppSandbox(),
    role: (typeof ppAuthRole === 'function') ? ppAuthRole() : '',
    rt: !!localStorage.getItem('pp_auth_rt'),
    sess: localStorage.getItem('pp_session') || '',
    lsKeys: Object.keys(localStorage).filter(k => k.indexOf('pp_') === 0).sort().join(','),
  })));
  console.log('   들어가기 전(서버): 단어카드 ' + before.cards + '장(학습기록 ' + before.studied + ') · 로그 ' + before.logs + '건');
  say(!before.sand, '평소에는 체험 모드가 꺼져 있다');

  const inSb = await page.evaluate(async (sid) => {
    await tryStudentVocab(sid);
    await new Promise(r => setTimeout(r, 2800));
    const bar = document.getElementById('_teacher-preview-bar');
    const pane = document.querySelector('#s-student .panel.active');
    const de = document.documentElement;
    return {
      sand: ppSandbox(),
      bar: bar ? bar.textContent.replace(/\s+/g, ' ').trim() : '(없음)',
      tab: pane ? pane.id : '',
      ov: Math.max(0, de.scrollWidth - de.clientWidth),
    };
  }, SID);
  say(inSb.sand, '체험 모드로 들어간다');
  say(inSb.tab === 'st-vocab', '단어 탭이 바로 열린다', inSb.tab);
  say(/체험 모드/.test(inSb.bar), '상단 띠가 체험 모드라고 알린다', inSb.bar.slice(0, 60));
  say(inSb.ov === 0, '390px 가로 넘침 0px', '넘침 ' + inSb.ov + 'px');

  // 체험 중 실제로 쓰기를 시도해 본다 — 서버로 나가면 안 된다
  const nBefore = writes.length;
  const probe = await page.evaluate(async (sid) => {
    const card = DB.cards(sid)[0];
    const before = card ? JSON.stringify(card) : '';
    // 학생 앱이 하는 저장을 그대로 호출
    const ci = (_cache.vocab_cards || []).findIndex(c => c.id === (card || {}).id);
    const studied = { ...(card || {}), box: 6, hits: (card && card.hits || 0) + 99, misses: 0, lastSeen: ppToday(), lastSeenBy: 'study', due: '2027-01-01', _probe: 1 };
    if (ci >= 0) _cache.vocab_cards[ci] = studied;   // 학생 앱이 하는 그대로 (renderVocabResult)
    const ok1 = await supaUpsert('vocab_cards', card ? card.id : 'x', studied, sid);
    const ok2 = await supaUpsert('logs', 'probe-log', { id: 'probe-log', sid, date: ppToday(), _probe: 1 }, sid);
    const ok3 = await supaUpsert('students', sid, { ...(DB.stus().find(s => s.id === sid)), _probe: 1 });
    return { ok: !!(ok1 && ok2 && ok3), before };
  }, SID);
  say(writes.length === nBefore, '체험 중에는 DB 쓰기가 서버로 나가지 않는다', '체험 중 서버 쓰기 ' + (writes.length - nBefore) + '건');
  say(probe.ok, '쓰기 함수는 평소처럼 성공을 돌려준다 (화면이 멈추지 않게)');

  // 나가기 — 캐시가 서버 값으로 되돌아와야 한다
  const after = await page.evaluate(async (sid) => {
    await returnToTeacher();
    await new Promise(r => setTimeout(r, 2500));
    return {
      sand: ppSandbox(),
      cards: DB.cards(sid).length,
      studied: DB.cards(sid).filter(c => (c.box || 0) > 0 || c.lastSeen).length,
      logs: DB.logs().filter(l => l.sid === sid).length,
      probeCard: DB.cards(sid).filter(c => c._probe).length,
      probeLog: DB.logs().filter(l => l._probe).length,
      probeStu: (DB.stus().find(s => s.id === sid) || {})._probe ? 1 : 0,
      screen: document.getElementById('s-teacher') && document.getElementById('s-teacher').classList.contains('active'),
      bar: !!document.getElementById('_teacher-preview-bar'),
      role: (typeof ppAuthRole === 'function') ? ppAuthRole() : '',
      rt: !!localStorage.getItem('pp_auth_rt'),
      sess: localStorage.getItem('pp_session') || '',
      lsKeys: Object.keys(localStorage).filter(k => k.indexOf('pp_') === 0).sort().join(','),
    };
  }, SID);
  say(after.role === before.role && after.rt === before.rt, '선생님 세션이 그대로 돌아왔다 (학생 토큰은 남지 않는다)',
    '역할 "' + before.role + '"→"' + after.role + '" · 학생토큰 ' + before.rt + '→' + after.rt);
  say(after.lsKeys === before.lsKeys, '이 기기의 pp_ 저장값도 들어가기 전과 같다',
    before.lsKeys + '  →  ' + after.lsKeys);
  say(!after.sand, '나가면 체험 모드가 꺼진다');
  say(after.screen && !after.bar, '선생님 화면으로 돌아온다');
  say(after.probeCard === 0 && after.probeLog === 0 && after.probeStu === 0, '체험 중 바꾼 값이 캐시에서 사라졌다 (서버 값으로 복구)',
    '남은 흔적 카드 ' + after.probeCard + ' · 로그 ' + after.probeLog + ' · 학생 ' + after.probeStu);
  // 서버 값이 한 글자도 안 바뀜어야 한다
  const srv = await snap(SID);
  console.log('   나온 뒤(서버): 단어카드 ' + srv.cards + '장(학습기록 ' + srv.studied + ') · 로그 ' + srv.logs + '건');
  say(srv.cards === before.cards && srv.logs === before.logs && srv.studied === before.studied,
    '서버의 단어카드 · 학습기록 · 로그 수가 그대로다',
    '카드 ' + before.cards + '→' + srv.cards + ' · 학습 ' + before.studied + '→' + srv.studied + ' · 로그 ' + before.logs + '→' + srv.logs);
  say(srv.sig === before.sig, '카드 한 장 한 장의 단계·학습일·정답수가 전부 같다', before.sig + ' → ' + srv.sig);
  say(after.cards > 0, '나간 뒤 캐시도 서버 값으로 채워져 있다', '캐시 카드 ' + after.cards + '장');

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단)' + (writes.length ? ' — ' + [...new Set(writes)].join(', ') : '') + ' · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
