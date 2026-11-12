require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 도장·원서 중복·리딩앤 탭·배지·레벨 뱃지 검증. 실데이터 GET 만, 쓰기 전부 차단.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const OUT = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = (process.env.PP_REAL_SID || '');
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const writes = []; const errs = [];
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

  // ───── 1. 도장: 수업으로 처리된 몫은 세지 않는다 ─────
  console.log('── 1  도장판');
  const st = await page.evaluate((sid) => {
    const stu = DB.stus().find(s => s.id === sid);
    const keep = JSON.parse(JSON.stringify(_cache.assignments));
    // 가짜 학생 하나로 규칙만 본다 (실데이터는 건드리지 않는다)
    const probeSid = 'probe-stamp';
    const mk = (id, rows, extra) => ({ id, sid: probeSid, category: 'recur', auto: true, bookId: 'nope', bookTitle: '점검용', date: rows[0].date, schedule: rows, ...extra });
    const d = (n) => ppShiftDate(ppToday(), -n);
    _cache.assignments = [
      mk('p-lesson', [{ date: d(3), unit: 'U1', done: true, doneBy: 'lesson' }, { date: d(2), unit: 'U2', done: true, doneBy: 'lesson' }]),
      mk('p-stu', [{ date: d(1), unit: 'U3', done: true, doneBy: 'student' }]),
    ];
    const r = {
      lessonDay: hwDayStatus(probeSid, d(3)),
      stuDay: hwDayStatus(probeSid, d(1)),
    };
    // createdAt 이 있으면 그 전날은 세지 않는다
    const probe = { id: probeSid, name: '점검', hwChallenge: { goal: 20, reward: 'x', start: d(30), createdAt: d(1) } };
    r.fromCreated = hwChallengeProgress(probe);
    const probe2 = { id: probeSid, name: '점검', hwChallenge: { goal: 20, reward: 'x', start: d(30) } };
    r.noCreated = hwChallengeProgress(probe2);
    _cache.assignments = keep;
    return { lessonTotal: r.lessonDay.total, lessonHalf: r.lessonDay.half, stuHalf: r.stuDay.half, created: r.fromCreated.stamps.length, nocreated: r.noCreated.stamps.length };
  }, SID);
  say(st.lessonTotal === 0 && !st.lessonHalf, "수업으로 처리된 몫(doneBy:'lesson')은 그 날 할 일에서 빠지고 도장도 안 찍힘", 'total=' + st.lessonTotal);
  say(st.stuHalf === true, '학생이 체크한 날은 그대로 도장');
  say(st.created === 1 && st.nocreated === 1, '판 만든 날(createdAt) 이전은 세지 않음', 'createdAt 있음 ' + st.created + '개 / 없음 ' + st.nocreated + '개');

  // ───── 2. 원서 중복 ─────
  console.log('\n── 2  원서 완독 권수');
  const rd = await page.evaluate((sid) => {
    const raw = ppLive(_cache.readings).filter(x => x.sid === sid).length;
    const out = DB.allRds(sid);
    const again = out.filter(x => (x._times || 1) > 1);
    const dupTitle = (() => { const n = s => String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, ''); const by = {}; out.forEach(r => { const k = r.bookId || n(r.title); by[k] = (by[k] || 0) + 1; }); return Object.values(by).filter(v => v > 1).length; })();
    return { raw, uniq: out.length, again: again.length, dupTitle, sample: again.slice(0, 2).map(x => x.title + ' ×' + x._times) };
  }, SID);
  say(rd.uniq < rd.raw, 'readings 줄 수보다 권수가 적다(같은 책을 한 권으로)', rd.raw + '줄 → ' + rd.uniq + '권');
  say(rd.dupTitle === 0, '결과에 같은 책이 두 번 나오지 않음');
  say(rd.again > 0, '다시 읽은 책은 _times 로 남는다', rd.again + '권 · ' + rd.sample.join(' · '));

  // ───── 3·5. 리딩앤 탭 · 레벨 뱃지 ─────
  console.log('\n── 3·5  리딩앤 탭 · 단계 뱃지');
  const ui = await page.evaluate(async (sid) => {
    await previewAsStudent(sid);
    await new Promise(x => setTimeout(x, 2600));
    const tabs = [...document.querySelectorAll('#s-student .stu-bottomnav .stutab')].map(b => (b.querySelector('.snav-lbl') || {}).textContent.trim());
    const lv = document.getElementById('stu-lv-badge');
    const de = document.documentElement;
    return {
      tabs, nTabs: tabs.length,
      lvShown: !!lv && getComputedStyle(lv).display !== 'none',
      lvText: lv ? lv.textContent.replace(/\s+/g, ' ').trim() : '',
      overflow: Math.max(0, de.scrollWidth - de.clientWidth),
      navW: (() => { const n = document.querySelector('#s-student .stu-bottomnav'); return n ? Math.round(n.scrollWidth - n.clientWidth) : -1; })(),
    };
  }, SID);
  say(ui.tabs.some(t => /리딩앤/.test(t)), '하단 탭에 리딩앤', ui.tabs.join(' / '));
  say(ui.nTabs === 6, '탭 6개(오늘·단어·복습·클래스5·오토보카·리딩앤)', ui.nTabs + '개');
  say(ui.navW <= 0, '390px 에서 탭 줄이 넘치지 않음', '탭바 넘침 ' + ui.navW + 'px');
  say(ui.lvShown && /Lv\./.test(ui.lvText), '이름 옆에 단계 뱃지', ui.lvText);

  // ───── 4. 배지 ─────
  console.log('\n── 4  내 배지');
  const bd = await page.evaluate(async () => {
    swStuTab('st-home');
    await new Promise(x => setTimeout(x, 1200));
    const card = document.querySelector('.bdg-card');
    if (!card) return { none: true };
    const de = document.documentElement;
    const out = [];
    card.querySelectorAll('*').forEach(el => { const b = el.getBoundingClientRect(); if (b.width && b.right > de.clientWidth + 1) out.push(el.className); });
    return {
      head: !!card.querySelector('.bdg-title'),
      total: !!card.querySelector('.bdg-total span'),
      chips: card.querySelectorAll('.bdg-chip').length,
      rows: card.querySelectorAll('.bdg-row').length,
      done: card.querySelectorAll('.bdg-row.done').length,
      txt: (card.textContent || '').replace(/\s+/g, ' ').slice(0, 80),
      out: out.length,
    };
  });
  if (bd.none) say(false, '배지 카드가 보여야 함');
  else {
    say(bd.head && bd.total, '머리글 + 전체 진행 막대');
    say(bd.chips > 0, '최근에 딴 배지 칩', bd.chips + '개');
    say(bd.rows > 0 && bd.out === 0, '종류별 줄 · 가로 넘침 없음', bd.rows + '줄 (완료 ' + bd.done + ')');
    console.log('     ' + bd.txt);
    const el = await page.$('.bdg-card');
    await page.setViewportSize({ width: 390, height: 2000 });
    await page.waitForTimeout(400);
    try { await (await page.$('.bdg-card')).screenshot({ path: OUT + '/badges.png' }); } catch (e) { }
    await page.setViewportSize({ width: 390, height: 844 });
  }

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 4).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
