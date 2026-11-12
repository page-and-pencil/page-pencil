require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 월간 리포트 인쇄 미리보기 — 리브랜딩 뒤 이름·색 확인. 실DB 쓰기 차단, 저장 버튼 안 누름.
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
  const srows = await (await fetch(U + '/rest/v1/students?select=*&limit=20', { headers: { apikey: K, Authorization: 'Bearer ' + K } })).json();
  const stu = srows.map(r => ({ id: r.id, ...(r.data || {}) })).filter(s => !s.inactive && !s._deleted)[0];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(o => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher', sid: o })); } catch (e) { } }, stu.id);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    return (m === 'GET' || m === 'HEAD') ? r.continue() : r.fulfill({ status: 200, body: '[]' });
  });
  const BASE = 'file:///' + encodeURI(ROOT + '/index.html');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(4000);

  const html = await page.evaluate(async (o) => {
    const month = (typeof ppToday === 'function' ? ppToday() : '2026-11-06').slice(0, 7);
    const row = { _id: 'probe', sid: o.sid, month, status: 'sent', final: '이번 달도 꾸준히 참여했습니다.', metrics: ppMonthMetrics(DB.stus().find(s => s.id === o.sid), month) };
    const i = (_cache.monthlyReports || []).findIndex(r => r.sid === o.sid && r.month === month);
    if (i >= 0) _cache.monthlyReports[i] = row; else _cache.monthlyReports.push(row);
    let out = '';
    const open = window.open;
    window.open = () => ({ document: { write: h => { out = h; }, close: () => { } }, print: () => { }, close: () => { } });
    await printReport(o.sid, month);
    window.open = open;
    return out;
  }, { sid: stu.id });

  fs.writeFileSync(OUT + '/print_preview.html', html, 'utf8');
  console.log('── 인쇄 미리보기 HTML');
  say(html.indexOf('직결영어') >= 0, '머리글·바닥글이 직결영어', (html.match(/직결영어/g) || []).length + '곳');
  say(html.indexOf('Page & Pencil') < 0, '옛 이름 없음');
  say(html.indexOf('기준이 다른') < 0 && html.indexOf('배운 것이 바로 쓰이는 영어') >= 0, '한 줄 소개 교체됨');
  say(html.indexOf('--accent:#1B5E4A') >= 0, '인쇄용 토큰이 새 초록', html.match(/--accent:#[0-9A-Fa-f]{6}/)[0]);
  say(!/#3B5BDB|#2B48B8|#0CA4C9|#0B8DAE|rgba\(12,164,201/.test(html), '옛 파랑·하늘색 없음',
    (html.match(/#3B5BDB|#2B48B8|#0CA4C9|#0B8DAE|rgba\(12,164,201/g) || []).join(',') || '없음');

  // 3폭 스크린샷
  const p2 = await ctx.newPage();
  await p2.setContent(html, { waitUntil: 'domcontentloaded' });
  for (const w of [320, 390, 1440]) {
    await p2.setViewportSize({ width: w, height: 1000 });
    await p2.waitForTimeout(400);
    const over = await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await p2.screenshot({ path: `${ROOT}/design_shots/print-${w}.png`, fullPage: true });
    say(over <= 0, `인쇄본 ${w}px 가로 넘침 없음`, over + 'px');
  }
  console.log('\n콘솔 오류 ' + errs.length + '건');
  console.log(fails ? '실패 ' + fails + '건' : '전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
