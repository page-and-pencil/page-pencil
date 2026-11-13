require('./_guard_assert');
const { fakeTables } = require('./_fake');                 // 막음 장치 없이는 돌지 않는다
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
  // 쓰는 표는 **모두** 가짜로 (item_bank 까지) — 저장 실패를 흉내 내는 것은 worksheets 뿐이다
  const fake = await fakeTables(page, ['worksheets', 'item_bank', 'item_bank_index'], {
    on: (table, m, body, r) => {
      if (table !== 'worksheets' || m !== 'POST') return null;
      posts++;
      return mode === 'fail' ? r.fulfill({ status: 500, body: '{"message":"boom"}' }) : null;
    },
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
  // 저장됨 뒤에 '· 은행 n문항' 이 붙게 바뀌었다 (앱 쪽 변화)
  ok('③ 눌러서 다시 저장하면 저장됨', /^저장됨 \d\d:\d\d( · .+)?$/.test(s2) && posts >= 2, '"' + s2 + '"');

  console.log('\nPOST ' + posts + '회(전부 가짜)');
  console.log('통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
