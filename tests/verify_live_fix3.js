require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 라이브 확인 — 자료실 듣기(드라이브 재생기 하나씩) · 동형 탭 (AI 는 부르지 않는다)
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const LIVE = 'https://page-and-pencil.github.io/page-pencil/';
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  let dl = 0, ai = 0;
  page.on('request', r => {
    const u = r.url();
    if (/drive\.usercontent\.google\.com/.test(u)) dl++;
    if (/claude-proxy/.test(u) && r.method() === 'POST') ai++;
  });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 150)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 150)));
  await page.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(2500);

  ok('① 동형 문제 탭이 라이브에 있다', await page.evaluate(() => !!document.getElementById('dtab-iso') && !!document.getElementById('dp-iso')));

  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('bank'); });
  await page.waitForFunction(() => document.querySelectorAll('#eb-list .eb-row').length > 0, null, { timeout: 180000 });
  const row = await page.evaluate(() => {
    const r = (_ebRows || []).filter(x => x.naudio > 3).sort((a, b) => b.naudio - a.naudio)[0];
    return r ? { id: r.id, title: (r.meta || {}).title, n: r.naudio } : null;
  });
  ok('② 듣기 많은 자료를 찾았다', !!row, row ? (row.title + ' · 음원 ' + row.n + '개') : '없음');

  const a1 = await page.evaluate(async id => {
    await ebOpenDetail(id); await new Promise(r => setTimeout(r, 2000));
    const b = document.getElementById('eb-d-body');
    return { names: b.querySelectorAll('.eb-aub').length, audios: b.querySelectorAll('audio').length, frames: b.querySelectorAll('iframe').length, playAll: /전체 이어 듣기/.test(b.innerText) };
  }, row.id);
  ok('③ 처음엔 이름만 — <audio> 0 · 재생기 0', a1.names === row.n && a1.audios === 0 && a1.frames === 0,
    '이름 ' + a1.names + ' · audio ' + a1.audios + ' · iframe ' + a1.frames);
  ok('④ 전체 이어 듣기 없음', !a1.playAll);

  const a2 = await page.evaluate(async () => {
    ebAuOpen(0); await new Promise(r => setTimeout(r, 2500));
    const b = document.getElementById('eb-d-body');
    const f = b.querySelector('.eb-aubox iframe');
    return { frames: b.querySelectorAll('iframe').length, src: f ? f.src : '', next: /다음 문항/.test(b.innerText) };
  });
  ok('⑤ ▶ → 드라이브 재생기 1개 · 다음 문항 단추', a2.frames === 1 && /\/preview/.test(a2.src) && a2.next, a2.src.slice(0, 86));
  await page.screenshot({ path: SCR + '/eb_audio_live.png' });

  const a3 = await page.evaluate(async () => {
    ebAuOpen(2); await new Promise(r => setTimeout(r, 1500));
    const b = document.getElementById('eb-d-body');
    return { frames: b.querySelectorAll('iframe').length, idx: _ebAuIdx };
  });
  ok('⑥ 다른 것을 열면 하나만 남는다', a3.frames === 1 && a3.idx === 2, 'iframe ' + a3.frames);
  ok('⑦ 드라이브 직접 내려받기 0회', dl === 0, dl + '회');
  ok('⑧ AI 호출 0회 (확인 중에는 안 부른다)', ai === 0, ai + '회');

  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent/i;
  const mine = errs.filter(e => !skip.test(e) && e.indexOf('400') < 0);
  ok('⑨ 콘솔 오류 0', mine.length === 0, mine.slice(0, 3).join(' | ') || '0');

  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
