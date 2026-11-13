require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
const { pageUrl, fileUrl } = require('./_page');
// A부 학부모 점수 탭 검증 — 블록 조합 5가지 + 390px 캡처. 실DB 쓰기 전부 차단.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const OUT = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1];
const K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srows = await (await fetch(U + '/rest/v1/students?select=*&limit=50', { headers: { apikey: K, Authorization: 'Bearer ' + K } })).json();
  const stu = srows.map(r => ({ id: r.id, ...(r.data || {}) })).filter(s => !s.inactive && !s._deleted)[0];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = []; const writes = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, server: true, content: [{ text: '좋아요' }] }) }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto(pageUrl(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(4500);

  const run = async (label, kinds) => {
    const r = await page.evaluate(async (o) => {
      const sid = o.sid;
      const stu = DB.stus().find(x => x.id === sid);
      // 캐시에만 넣는다 — 저장하지 않는다
      const mk = (id, extra) => ({ id, sid, date: extra.date, vocabCorrect: 17, vocabTotal: 20, grammarCorrect: 0, grammarTotal: 0, readingCorrect: 0, readingTotal: 0, listeningCorrect: 0, listeningTotal: 0, allWords: [], wrongWords: ['brave', 'whisper'], ...extra });
      const rows = [];
      if (o.kinds.indexOf('in') >= 0) {
        rows.push(mk('probe-in1', { date: '2026-11-06' }));
        rows.push(mk('probe-in2', { date: '2026-10-20', vocabCorrect: 18 }));
      }
      if (o.kinds.indexOf('school') >= 0) {
        rows.push(mk('probe-sc1', { date: '2026-06-28', testKind: 'school', schoolAchv: 'A', vocabCorrect: 46, vocabTotal: 50 }));
        rows.push(mk('probe-sc2', { date: '2025-12-10', testKind: 'school', schoolAchv: 'B', vocabCorrect: 44, vocabTotal: 50 }));
      }
      if (o.kinds.indexOf('mock') >= 0) {
        rows.push(mk('probe-mk1', { date: '2026-09-04', testKind: 'mock', mockGrade: 2, vocabTotal: 0 }));
        rows.push(mk('probe-mk2', { date: '2026-06-04', testKind: 'mock', mockGrade: 3, vocabTotal: 0 }));
      }
      _cache.tests = [...rows, ...(_cache.tests || []).filter(t => t.sid !== sid)];
      const keepNelt = stu.neltResults;
      stu.neltResults = (o.kinds.indexOf('nelt') >= 0)
        ? [{ id: 'pn1', date: '2026-05-18', term: '상반기', score: 72, level: 'Level 4' },
           { id: 'pn2', date: '2026-11-07', term: '하반기', score: 78, level: 'Level 5' }]
        : [];
      await loadParent(sid);
      await new Promise(r => setTimeout(r, 1600));
      ppNav(null, 'score');
      await new Promise(r => setTimeout(r, 500));
      const pane = document.querySelector('#pp-body .pp-tab[data-pptab="score"]');
      const txt = (pane.textContent || '').replace(/\s+/g, ' ');
      const de = document.documentElement;
      const titles = [...pane.querySelectorAll('.ct')].map(e => e.textContent.trim());
      stu.neltResults = keepNelt;
      return { txt, titles, overflow: Math.max(0, de.scrollWidth - de.clientWidth), empty: txt.indexOf('아직 테스트 기록이 없어요') >= 0 };
    }, { sid: stu.id, kinds });
    // 학부모 화면은 안쪽 컨테이너가 스크롤한다 — 세로를 늘려 전체가 보이게 한 뒤 찍는다
    await page.setViewportSize({ width: 390, height: 3200 });
    await page.waitForTimeout(400);
    try {
      const el = await page.$('#pp-body .pp-tab[data-pptab="score"]');
      await el.screenshot({ path: OUT + '/score-' + label + '.png' });
    } catch (e) { await page.screenshot({ path: OUT + '/score-' + label + '.png' }); }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    console.log('\n── ' + label + '  [' + kinds.join(',') + ']');
    console.log('   카드: ' + r.titles.join(' / '));
    console.log('   넘침 ' + r.overflow + 'px · 빈 상태 ' + (r.empty ? '표시' : '없음'));
    return r;
  };

  const a = await run('1-자체만', ['in']);
  say(a.titles.indexOf('학교 내신') < 0 && a.titles.indexOf('모의고사') < 0 && a.titles.indexOf('NELT') < 0, '자체만: ②③④ 숨김');
  say(!a.empty, '자체만: 빈 상태 안 뜸');

  const b = await run('2-자체+내신', ['in', 'school']);
  say(b.titles.indexOf('학교 내신') >= 0 && b.titles.indexOf('모의고사') < 0, '자체+내신: ②만 보임');
  say(/성취도|A/.test(b.txt) && /2026-1학기/.test(b.txt), '내신: 학기 표기와 성취도', (b.txt.match(/2026-1학기[^·]*/) || [''])[0].slice(0, 40));
  say(!/▲|▼/.test(b.txt.split('학교 내신')[1] || ''), '내신 블록에 증감(▲▼) 없음');
  say(/학교·학년마다 범위가 달라/.test(b.txt), '내신: 비교하지 않는다는 안내');

  const c = await run('3-모의+NELT', ['mock', 'nelt']);
  say(c.titles.indexOf('모의고사') >= 0 && c.titles.indexOf('NELT') >= 0 && c.titles.indexOf('학교 내신') < 0, '모의+NELT: ③④만 보임');
  say(/1등급이 가장 높아요/.test(c.txt), '모의고사: "1등급이 가장 높아요" 머리글');
  say(/2026-09 2등급|2026-09.*2.*등급/.test(c.txt), '모의고사: 회차 칩', (c.txt.match(/2026-09[^N]{0,16}/) || [''])[0]);
  say(/78점/.test(c.txt) && /Level 5/.test(c.txt) && /▲6/.test(c.txt), 'NELT: 점수·레벨·▲6');
  say(!c.empty, '자체 기록이 없어도 ③④ 가 있으면 빈 상태 안 뜸');

  const d = await run('4-전부', ['in', 'school', 'mock', 'nelt']);
  const order = d.titles.filter(t => ['최근 테스트', '학교 내신', '모의고사', 'NELT'].indexOf(t) >= 0);
  say(order.join('>') === '최근 테스트>학교 내신>모의고사>NELT', '순서 ①→②→③→④', order.join(' > '));
  say(!/불합격|우수|양호/.test(d.txt), '판정 말(불합격·우수·양호) 없음');

  const e = await run('5-아무것도없음', []);
  say(e.empty, '네 블록이 다 비면 "아직 테스트 기록이 없어요"');

  // 인쇄 리포트 한 줄 요약
  console.log('\n── A-6  인쇄 리포트');
  const pr = await page.evaluate(async (sid) => {
    const stu = DB.stus().find(x => x.id === sid);
    _cache.tests = [
      { id: 'probe-sc1', sid, date: '2026-11-06', testKind: 'school', schoolAchv: 'A', vocabCorrect: 46, vocabTotal: 50 },
      { id: 'probe-mk1', sid, date: '2026-11-04', testKind: 'mock', mockGrade: 2, vocabTotal: 0 },
      { id: 'probe-in1', sid, date: '2026-11-05', vocabCorrect: 17, vocabTotal: 20, wrongWords: ['brave'] },
      ...(_cache.tests || []).filter(t => t.sid !== sid)];
    stu.neltResults = [{ id: 'pn2', date: '2026-11-07', term: '하반기', score: 78, level: 'Level 5' }];
    const html = _pPrintOtherScores(sid, stu, d => String(d || '').startsWith('2026-11'));
    const htmlOut = _pPrintOtherScores(sid, stu, d => String(d || '').startsWith('2026-01'));
    return { html: html.replace(/\s+/g, ' '), outOfScope: htmlOut };
  }, stu.id);
  say(/학교 내신/.test(pr.html) && /성취도 A/.test(pr.html) && /92%/.test(pr.html), '인쇄: 내신 한 줄', (pr.html.match(/학교 내신[^<]*<\/td><td[^>]*>([^<]*)/) || [])[1]);
  say(/2등급/.test(pr.html) && /1등급이 가장 높아요/.test(pr.html), '인쇄: 모의고사 한 줄');
  say(/NELT/.test(pr.html) && /78점/.test(pr.html) && /Level 5/.test(pr.html), '인쇄: NELT 한 줄');
  say(pr.outOfScope === '', '그 달에 기록이 없으면 섹션 자체가 없음');

  console.log('\n캡처 5장 → ' + OUT);
  console.log('실DB 쓰기 시도 ' + writes.length + '건(전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 5).forEach(x => console.log('   ! ' + x));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
