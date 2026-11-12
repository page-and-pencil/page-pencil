require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 진짜 서버로 '문제 은행' 탭을 열어 본다 (표는 있고 0줄).
// 쓰기(POST/PATCH/DELETE)는 모두 가로막고 세기만 한다 — 실DB 는 건드리지 않는다.
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const writes = [], ibReqs = [];
  let ibBytes = 0;
  await page.route('**/rest/v1/**', async r => {
    const req = r.request(), m = req.method();
    if (m !== 'GET' && m !== 'HEAD') {                       // 쓰기는 절대 서버로 보내지 않는다
      writes.push(m + ' ' + req.url().split('/rest/v1/')[1].split('?')[0]);
      return r.fulfill({ status: 201, body: '' });
    }
    if (/\/rest\/v1\/item_bank/.test(req.url())) {
      const res = await r.fetch();
      const body = await res.text();
      ibBytes += Buffer.byteLength(body);
      ibReqs.push(res.status() + ' ' + req.url().split('/rest/v1/')[1].slice(0, 70));
      return r.fulfill({ response: res, body });
    }
    return r.continue();
  });
  await page.route('**/functions/v1/**', r => { if (r.request().method() === 'POST') return r.fulfill({ status: 400, body: '{}' }); return r.continue(); });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(2000);
  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('items'); });
  await wait(6000);
  const r1 = await page.evaluate(() => ({
    rows: (_ibRows || []).length, src: _ibSrc, noTable: _ibNoTable,
    note: (document.getElementById('ib-state') || {}).textContent || '',
    count: (document.getElementById('ib-count') || {}).textContent || '',
    empty: (document.getElementById('ib-list') || {}).textContent || '',
    filters: ['ib-f-skill', 'ib-f-type', 'ib-f-grade'].map(id => (document.getElementById(id) || {}).options.length)
  }));
  ok('① 진짜 서버로 탭이 열린다 (빈 목록)', r1.rows === 0 && r1.noTable === false && /아직 문항이 없습니다/.test(r1.empty),
    '목록 ' + r1.rows + '줄 · 상태 "' + r1.note + '"');
  ok('② 가벼운 뷰(item_bank_index)로 받는다', r1.src === 'view', '_ibSrc=' + r1.src);
  ok('③ 쓰기 0회', writes.length === 0, writes.join(' / ') || '0회');
  ok('④ 받은 양', ibBytes < 2000, ibBytes + 'B · 요청 ' + ibReqs.length + '회');
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|400/i;
  const mine = errs.filter(e => !skip.test(e));
  ok('⑤ 콘솔 오류 0', mine.length === 0, mine.slice(0, 3).join(' | ') || '0');
  await page.screenshot({ path: SCR + '/ib_live_empty.png' });
  console.log('\nitem_bank 요청:'); ibReqs.forEach(x => console.log('  ' + x));
  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
