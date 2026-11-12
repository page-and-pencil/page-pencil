require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 저장 실패 상태 — '저장 실패 · 다시 저장' 이 뜨고, 눌러서 다시 저장하면 되살아난다
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 800 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  let mode = 'fail', posts = 0;
  await page.route('**/rest/v1/worksheets**', r => {
    if (r.request().method() !== 'POST') return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    posts++;
    return mode === 'fail' ? r.fulfill({ status: 500, body: '{"message":"boom"}' }) : r.fulfill({ status: 201, body: '' });
  });
  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 });
  await wait(1500);
  await page.evaluate(() => {
    show('s-teacher'); swTab('t-data'); switchDataTab('iso'); isoNew();
    _isoCfg.type = 'blank';
    _isoItems = [{ id: 'a1', type: 'blank', typeName: '읽기 · 빈칸 추론', stem: '발문', passage: 'p '.repeat(30), choices: ['a', 'b', 'c', 'd', 'e'], answer: 1, explain: '해설', wrong: [], check: false, checkNote: '' }];
    _isoRender();
  });
  await page.evaluate(() => _isoAutoSave(false));
  await wait(900);
  const s1 = await page.evaluate(() => { const e = document.getElementById('iso-stat'); return { t: e.textContent, cls: e.className, click: typeof e.onclick === 'function' }; });
  ok('① 저장 실패 상태', s1.t === '저장 실패 · 다시 저장' && /err/.test(s1.cls) && s1.click, '"' + s1.t + '" · ' + s1.cls);

  const kept = await page.evaluate(async () => {
    const list = await idbGet('pp_iso_sets'); const last = await idbGet('pp_iso_last');
    return { n: (list || []).length, has: (list || []).some(x => x.id === last && (x.items || []).length === 1) };
  });
  ok('② 실패해도 기기에는 남아 있다', kept.has, '보관함 ' + kept.n + '묶음');

  mode = 'ok';
  await page.evaluate(() => document.getElementById('iso-stat').click());
  await wait(1200);
  const s2 = await page.evaluate(() => document.getElementById('iso-stat').textContent);
  ok('③ 눌러서 다시 저장하면 저장됨', /^저장됨 \d\d:\d\d$/.test(s2) && posts >= 2, '"' + s2 + '"');

  console.log('\nPOST ' + posts + '회(전부 가짜)');
  console.log('통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
