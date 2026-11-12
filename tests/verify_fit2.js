require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 점수 탭 ②③④ 와 설정 탭을 320 / 390 / 1440 에서 측정. 실DB 쓰기 차단.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1];
const K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];
let bad = 0;

(async () => {
  const srows = await (await fetch(U + '/rest/v1/students?select=*&limit=50', { headers: { apikey: K, Authorization: 'Bearer ' + K } })).json();
  const stu = srows.map(r => ({ id: r.id, ...(r.data || {}) })).filter(s => !s.inactive && !s._deleted)[0];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--mute-audio'] });

  for (const vp of [{ w: 320, h: 760 }, { w: 390, h: 844 }, { w: 1440, h: 900 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR' });
    await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
    const page = await ctx.newPage();
    await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, server: true, voices: ['XrExE9yKIg1WjnnlVkGX'], content: [{ text: '좋아요' }] }) }));
    await page.route('**/rest/v1/**', r => (r.request().method() === 'GET' || r.request().method() === 'HEAD') ? r.continue() : r.fulfill({ status: 200, body: '[]' }));
    await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
    await page.waitForTimeout(4000);
    console.log('\n══ ' + vp.w + 'px');

    const r = await page.evaluate(async (sid) => {
      const stu = DB.stus().find(x => x.id === sid);
      const mk = (id, extra) => ({ id, sid, vocabCorrect: 17, vocabTotal: 20, grammarTotal: 0, readingTotal: 0, listeningTotal: 0, wrongWords: ['brave'], ...extra });
      _cache.tests = [
        mk('p1', { date: '2026-11-06' }),
        mk('p2', { date: '2026-06-28', testKind: 'school', schoolAchv: 'A', vocabCorrect: 46, vocabTotal: 50 }),
        mk('p3', { date: '2025-12-10', testKind: 'school', schoolAchv: 'B', vocabCorrect: 44, vocabTotal: 50 }),
        mk('p4', { date: '2026-09-04', testKind: 'mock', mockGrade: 2, vocabTotal: 0 }),
        mk('p5', { date: '2026-06-04', testKind: 'mock', mockGrade: 3, vocabTotal: 0 }),
        ...(_cache.tests || []).filter(t => t.sid !== sid)];
      stu.neltResults = [{ id: 'n1', date: '2026-05-18', term: '상반기', score: 72, level: 'Level 4' },
                         { id: 'n2', date: '2026-11-07', term: '하반기', score: 78, level: 'Level 5' }];
      await loadParent(sid);
      await new Promise(x => setTimeout(x, 1600));
      ppNav(null, 'score');
      await new Promise(x => setTimeout(x, 500));
      const de = document.documentElement;
      const pane = document.querySelector('#pp-body .pp-tab[data-pptab="score"]');
      const out = [];
      pane.querySelectorAll('*').forEach(el => {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return;
        if (b.right > de.clientWidth + 1) out.push((el.className || el.tagName).toString().slice(0, 30) + ' right=' + Math.round(b.right));
      });
      return { overflow: Math.max(0, de.scrollWidth - de.clientWidth), out: [...new Set(out)].slice(0, 3), cards: [...pane.querySelectorAll('.ct')].map(x => x.textContent.trim()).join('/') };
    }, stu.id);
    const ok = r.overflow === 0 && r.out.length === 0;
    if (!ok) bad++;
    console.log((ok ? '  OK   ' : '  FAIL ') + '점수 탭(①②③④)  넘침 ' + r.overflow + 'px' + (r.out.length ? ' · 밖으로 ' + r.out.join(' / ') : ''));
    console.log('        ' + r.cards);

    const c = await page.evaluate(async () => {
      returnToTeacher();
      saveSession({ role: 'teacher' }); show('s-teacher'); swTab('t-cfg');
      await new Promise(x => setTimeout(x, 900));
      updateAuthModeRow(); updateElevenDot();
      const de = document.documentElement;
      const pane = document.getElementById('t-cfg');
      const out = [];
      pane.querySelectorAll('*').forEach(el => {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return;
        if (b.right > de.clientWidth + 1) out.push((el.id || el.className || el.tagName).toString().slice(0, 30) + ' right=' + Math.round(b.right));
      });
      return { overflow: Math.max(0, de.scrollWidth - de.clientWidth), out: [...new Set(out)].slice(0, 3), row: (document.getElementById('auth-mode-row').textContent || '').replace(/\s+/g, ' ').slice(0, 44) };
    });
    const ok2 = c.overflow === 0 && c.out.length === 0;
    if (!ok2) bad++;
    console.log((ok2 ? '  OK   ' : '  FAIL ') + '설정 탭(로그인 방식 줄)  넘침 ' + c.overflow + 'px' + (c.out.length ? ' · 밖으로 ' + c.out.join(' / ') : ''));
    console.log('        ' + c.row);
    await ctx.close();
  }
  console.log(bad ? '\n넘침 ' + bad + '건' : '\n세 폭 모두 가로 넘침 0 · 화면 밖 요소 0');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
