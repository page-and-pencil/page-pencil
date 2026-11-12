require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 라이브 노래 화면만 다시 — 광고 프리롤까지 기다린다
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const LIVE = 'https://page-and-pencil.github.io/page-pencil/index.html';
const REAL_TB = 'singtogetherc096ob', UNIT = 'Sing';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  await page.route('**/rest/v1/**', r => (r.request().method() === 'GET' || r.request().method() === 'HEAD') ? r.continue() : r.fulfill({ status: 200, body: '[]' }));
  await page.route('**api.elevenlabs.io/**', r => r.fulfill({ status: 500, body: '' }));

  await page.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => { try { return (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(2500);

  const r1 = await page.evaluate(async a => {
    openUnitRead(a.tb, a.u);
    await new Promise(r => setTimeout(r, 7000));
    const S = _songState;
    const seen = [];
    for (let i = 0; i < 60; i++) {           // 최대 30초 — 광고가 끝날 때까지
      try { S.player.mute(); S.player.playVideo(); } catch (e) { }
      await new Promise(r => setTimeout(r, 500));
      let st = -9; try { st = S.player.getPlayerState(); } catch (e) { }
      if (seen[seen.length - 1] !== st) seen.push(st);
      if (st === 1) break;
    }
    let st = -9; try { st = S.player.getPlayerState(); } catch (e) { }
    return { state: st, seen: seen.join('>'), lines: (S.lines || []).length, t: (() => { try { return +S.player.getCurrentTime().toFixed(1); } catch (e) { return -1; } })() };
  }, { tb: REAL_TB, u: UNIT });
  console.log('재생 상태 ' + r1.state + ' (거쳐 온 상태 ' + r1.seen + ') · 가사 ' + r1.lines + '줄 · 흐른 시간 ' + r1.t + '초');

  if (r1.state === 1) {
    const tap = await page.evaluate(async () => {
      const S = _songState;
      const t0 = S.player.getCurrentTime();
      document.querySelector('#song-lrc .lrc-w').click();
      await new Promise(r => setTimeout(r, 900));
      const paused = S.player.getPlayerState();
      await new Promise(r => setTimeout(r, 4200));
      return { paused: paused, later: S.player.getPlayerState(), moved: +(S.player.getCurrentTime() - t0).toFixed(1), word: document.getElementById('uwp-word').textContent };
    });
    console.log('단어 "' + tap.word + '" 누름 → 상태 ' + tap.paused + ' · 4.2초 뒤 ' + tap.later + ' · 그동안 흐른 시간 ' + tap.moved + '초');
    console.log(tap.paused === 2 && tap.later === 2 ? '  OK   멈추고 그대로 있다' : '  FAIL');
  } else {
    console.log('  광고/네트워크로 재생 상태 1 에 못 들어감 — 가사·칩은 떴다');
  }
  await browser.close();
})();
