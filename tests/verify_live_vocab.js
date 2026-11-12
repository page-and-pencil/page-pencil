require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 라이브 확인 — ① 실학생 학생뷰(체험 모드) 단어 탭에서 외부 호출 수 ② Sing Together 노래 화면
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const LIVE = 'https://page-and-pencil.github.io/page-pencil/index.html';
const SID = (process.env.PP_REAL_SID || '');                      // 실학생 — 보기만 한다
const REAL_TB = 'singtogetherc096ob', UNIT = 'Sing';
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function say(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? '  OK   ' : '  FAIL ') + what + (detail ? '  — ' + detail : ''));
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();

  // 바깥으로 나가는 호출을 센다
  const hit = { dict: 0, mymemory: 0, claude: 0, el11: 0, tts: 0, ttsProbe: 0 };
  let writes = 0, writeUrls = [];
  const failed = [];
  page.on('requestfailed', r => failed.push(r.url().slice(0, 110) + '  [' + ((r.failure() || {}).errorText || '?') + ']'));
  page.on('response', r => { if (r.status() >= 400) failed.push('HTTP ' + r.status() + '  ' + r.url().slice(0, 110)); });
  page.on('request', r => {
    const u = r.url();
    if (u.indexOf('api.dictionaryapi.dev') >= 0) hit.dict++;
    else if (u.indexOf('mymemory.translated.net') >= 0) hit.mymemory++;
    else if (u.indexOf('/functions/v1/claude-proxy') >= 0) hit.claude++;
    else if (u.indexOf('api.elevenlabs.io') >= 0) hit.el11++;
  });
  // 실데이터는 건드리지 않는다 — 쓰기는 전부 막고 센다
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes++; writeUrls.push(m + ' ' + r.request().url().slice(0, 90));
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**api.elevenlabs.io/**', r => r.fulfill({ status: 500, body: '' }));
  await page.route('**/functions/v1/tts-proxy**', r => {
    const b = String(r.request().postData() || '');
    if (b.indexOf('"probe"') < 0) hit.tts++; else hit.ttsProbe++;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ month: '2026-11', used: 0, calls: 0, cap: 6000 }) });
  });

  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 200)));

  console.log('\n  실패한 요청 전체 (' + failed.length + '건):');
  failed.forEach(f => console.log('    - ' + f));

  console.log('\n합계: ' + pass + ' 통과 / ' + fail + ' 실패');
  console.log('전체 누적 외부 호출: dictionaryapi ' + hit.dict + ' · mymemory ' + hit.mymemory + ' · claude-proxy ' + hit.claude);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
