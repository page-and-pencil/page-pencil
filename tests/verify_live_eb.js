require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 라이브 확인 — 배포된 페이지가 진짜 Supabase 뷰에서 자료실을 받아오는지 (읽기만 한다)
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const LIVE = 'https://page-and-pencil.github.io/page-pencil/';
const MERGED = '1SlqPty9z8jEpaxo-dIyDtim_6QE5JCOA';
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();

  let ebBytes = 0, ebCalls = 0, writes = [];
  page.on('response', async res => {
    const u = res.url();
    if (/\/rest\/v1\/exam_bank/.test(u)) {
      ebCalls++;
      try { ebBytes += Buffer.byteLength(await res.text()); } catch (e) { }
    }
  });
  page.on('request', r => {
    const m = r.method();
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && /supabase\.co/.test(r.url())) writes.push(m + ' ' + r.url().slice(0, 110));
  });
  // 드라이브는 비공개라 이 세션에선 열리지 않는다 — 주소만 본다
  await page.route('**drive.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>drive</body></html>' }));
  await page.route('**drive.usercontent.google.com/**', r => r.fulfill({ status: 200, contentType: 'audio/mpeg', body: '' }));
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));

  await page.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(2500);
  ok('① 부팅 때 자료실을 받지 않는다', ebCalls === 0, ebCalls + '회');

  const t0 = Date.now();
  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('bank'); });
  await page.waitForFunction(() => document.querySelectorAll('#eb-list .eb-row').length > 0, null, { timeout: 180000 });
  await wait(1500);
  const ms = Date.now() - t0;
  const info = await page.evaluate(() => ({
    rows: (_ebRows || []).length, src: _ebSrc, note: _ebNote,
    cnt: (document.getElementById('eb-count') || {}).textContent || '',
    state: (document.getElementById('eb-state') || {}).textContent || '',
    shown: document.querySelectorAll('#eb-list .eb-row').length,
    cats: document.getElementById('eb-f-cat').options.length - 1
  }));
  ok('② 진짜 뷰에서 6,074행', info.rows === 6074 && info.src === 'view',
    info.rows + '행 · ' + info.src + ' · ' + (ebBytes / 1048576).toFixed(2) + 'MB · ' + ms + 'ms · 구분 ' + info.cats + '종');
  ok('③ 뷰 폴백 안내 없음', !info.note, info.note || '(없음)');

  // 시리즈
  const s1 = await page.evaluate(() => {
    document.getElementById('eb-f-cat').value = 'elt'; ebFilterChange();
    const el = document.getElementById('eb-f-series');
    return { vis: el.style.display !== 'none', n: el.options.length - 1, cnt: document.getElementById('eb-count').textContent };
  });
  ok('④ 시리즈 칸', s1.vis && s1.n === 9, '시리즈 ' + s1.n + '종 · ' + s1.cnt);

  // 합쳐진 시험 상세
  const b0 = ebBytes;
  const d = await page.evaluate(async id => {
    ebResetFilters();
    await ebOpenDetail(id);
    await new Promise(r => setTimeout(r, 1500));
    const secs = [...document.querySelectorAll('#eb-d-body .eb-sec-t')].map(e => e.textContent.trim());
    const links = [...document.querySelectorAll('#eb-d-body a.btn')].map(e => ({ t: e.textContent.trim(), h: e.getAttribute('href') }));
    const f1 = document.querySelector('#eb-d-body .eb-file');
    return {
      title: (document.getElementById('eb-d-title') || {}).textContent || '',
      sub: (document.getElementById('eb-d-sub') || {}).textContent || '',
      secs: secs, links: links.map(x => x.t), hrefs: links.map(x => x.h),
      nAu: document.querySelectorAll('#eb-d-body audio').length,
      firstFile: f1 ? f1.textContent.trim().slice(0, 50) : ''
    };
  }, MERGED);
  ok('⑤ 상세 한 줄만 더 받는다', (ebBytes - b0) < 80000, ((ebBytes - b0) / 1024).toFixed(0) + 'KB');
  ok('⑥ 기타 자료 묶음 + 합쳐진 폴더', d.secs.some(t => /기타 자료/.test(t)) && d.links.some(t => /합쳐진 폴더/.test(t)),
    d.secs.join(' / ') + ' · ' + d.links.join(' | '));
  ok('⑦ 주소에 자료 계정이 붙는다', d.hrefs.every(h => !h || /authuser=/.test(h)), d.hrefs.filter(Boolean)[0] || '');

  // 미리보기 주소
  const v = await page.evaluate(async () => {
    document.querySelector('#eb-d-body .eb-file').click();
    await new Promise(r => setTimeout(r, 1200));
    const f = document.getElementById('eb-view-frame');
    return { open: !!document.getElementById('m-eb-view').classList.contains('open'), src: f ? f.src : '' };
  });
  ok('⑧ 미리보기 주소', v.open && /drive\.google\.com\/file\/d\/.+\/preview/.test(v.src) && /authuser=/.test(v.src), v.src.slice(0, 110));

  // 쓰기 0 · 오류 0
  ok('⑨ Supabase 에 쓴 것 0', writes.length === 0, writes.slice(0, 2).join(' | ') || '0건');
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent/i;
  const mine = errs.filter(e => !skip.test(e));
  ok('⑩ 콘솔 오류 0', mine.length === 0, mine.slice(0, 3).join(' | ') || '0');

  await page.evaluate(() => { ebViewClose(); ebCloseDetail(); });
  await wait(500);
  await page.screenshot({ path: SCR + '/eb_live_1440.png' });

  // 학생·학부모·체험 모드에서는 안 보인다
  const gate = await page.evaluate(() => {
    const panel = document.getElementById('dp-bank');
    const inTeacher = !!(panel && panel.closest('#s-teacher'));
    let sandboxHidden = null;
    try { sandboxHidden = (typeof ppSandbox === 'function'); } catch (e) { }
    return { inTeacher: inTeacher, hasSandbox: sandboxHidden, may: (typeof ebMayUse === 'function') ? ebMayUse() : null };
  });
  ok('⑪ 선생님 화면 안에만 있다', gate.inTeacher && gate.may === true, JSON.stringify(gate));

  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
