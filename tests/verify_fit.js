require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
const { pageUrl, fileUrl } = require('./_page');
// 이번에 바꾼 UI 네 곳의 가로 넘침 측정 (320 / 390 / 1440). 실DB 쓰기 차단.
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
  // 스크롤바를 숨기지 않아야 실제 넘침이 보인다
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--mute-audio'] });

  for (const vp of [{ w: 320, h: 760 }, { w: 390, h: 844 }, { w: 1440, h: 900 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR' });
    await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
    const page = await ctx.newPage();
    await page.route('**/functions/v1/tts-proxy', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, server: true, voices: ['XrExE9yKIg1WjnnlVkGX'] }) }));
    await page.route('**/functions/v1/claude-proxy', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ text: '좋아요' }] }) }));
    await page.route('**/rest/v1/**', r => (r.request().method() === 'GET' || r.request().method() === 'HEAD') ? r.continue() : r.fulfill({ status: 200, body: '[]' }));
    await page.goto(pageUrl(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
    await page.waitForTimeout(4000);
    console.log('\n══ ' + vp.w + 'px');

    const measure = async (label, setup) => {
      const r = await page.evaluate(async (o) => {
        // eslint-disable-next-line no-new-func
        await new Function('return (' + o.fn + ')()')();
        await new Promise(r => setTimeout(r, 900));
        const de = document.documentElement;
        const overflow = Math.max(0, de.scrollWidth - de.clientWidth);
        // 화면 밖으로 나간 요소
        const out = [];
        document.querySelectorAll('.screen.active *, .mdl.open *, #m-add-assign *').forEach(el => {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) return;
          if (b.right > de.clientWidth + 1 || b.left < -1) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return;
            out.push((el.id || el.className || el.tagName).toString().slice(0, 40) + ' right=' + Math.round(b.right));
          }
        });
        return { overflow, out: [...new Set(out)].slice(0, 4) };
      }, { fn: setup.toString() });
      const ok = r.overflow === 0 && r.out.length === 0;
      if (!ok) bad++;
      console.log((ok ? '  OK   ' : '  FAIL ') + label + '  넘침 ' + r.overflow + 'px' + (r.out.length ? ' · 밖으로 ' + r.out.join(' / ') : ''));
    };

    await measure('설정 탭 (ElevenLabs 카드)', () => { show('s-teacher'); swTab('t-cfg'); updateElevenDot(); });
    await measure('대시보드 (공지 대상 선택)', () => { swTab('t-dash'); renderDash(); });
    await measure('반 일괄 할당 모달', () => {
      swTab('t-cls');
      const c = DB.classes().find(x => x.active !== false && (x.studentIds || []).length);
      if (c) openBulkAssign(c.id);
    });
    await page.evaluate(() => { try { closeAssignModal(); } catch (e) { } });
    await measure('학생 홈 (미래 날짜 안내)', async () => {
      const sid = DB.stus().filter(s => !s.inactive)[0].id;
      await loginStudent(DB.stus().find(s => s.id === sid));
      await new Promise(r => setTimeout(r, 1500));
      const tm = ppShiftDate(ppToday(), 1);
      _cache.assignments = [{ id: 'probe-fit', sid, type: 'textbook', category: 'vocab', date: tm, due: tm, range: '내일 몫(점검용 아주 긴 범위 문자열 테스트)' },
        ...(_cache.assignments || []).filter(a => String(a.id).indexOf('probe-') !== 0)];
      renderStudentHome(sid);
      await new Promise(r => setTimeout(r, 700));
      if (typeof stuSelectDay === 'function') stuSelectDay(tm);
    });
    await measure('학부모 화면 (결석 문구)', async () => {
      try { returnToTeacher(); } catch (e) { }
      const sid = DB.stus().filter(s => !s.inactive)[0].id;
      const t = ppToday();
      _cache.lessons = [{ id: 'probe-les-abs', sid, date: t, att: 'absent', materials: {}, cmt: '' }, ...(_cache.lessons || []).filter(l => l.sid !== sid)];
      await loadParent(sid);
    });
    await ctx.close();
  }
  console.log(bad ? '\n넘침 ' + bad + '건' : '\n세 폭 모두 가로 넘침 0 · 화면 밖 요소 0');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
