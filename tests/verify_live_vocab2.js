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

  const hit = { dict: 0, mymemory: 0, claude: 0, el11: 0, tts: 0, ttsProbe: 0 };
  let writes = 0;
  const writeUrls = [], failed = [];
  page.on('requestfailed', r => failed.push(r.url().slice(0, 110) + '  [' + ((r.failure() || {}).errorText || '?') + ']'));
  page.on('response', r => { if (r.status() >= 400) failed.push('HTTP ' + r.status() + '  ' + r.url().slice(0, 110)); });
  page.on('request', r => {
    const u = r.url();
    if (u.indexOf('api.dictionaryapi.dev') >= 0) hit.dict++;
    else if (u.indexOf('mymemory.translated.net') >= 0) hit.mymemory++;
    else if (u.indexOf('/functions/v1/claude-proxy') >= 0) hit.claude++;
    else if (u.indexOf('api.elevenlabs.io') >= 0) hit.el11++;
  });
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

  console.log('[0] 라이브 열기');
  await page.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const ver = await page.evaluate(() => {
    const s = [...document.querySelectorAll('script[src]')].map(x => x.getAttribute('src'));
    return s.filter(x => /\.js\?v=/.test(x)).join(' ');
  });
  say(/db\.js\?v=20261111c/.test(ver) && /teacher\.js\?v=20261111c/.test(ver), '배포된 버전이 새 것', ver);
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.vocab_cards || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(2500);

  const base = await page.evaluate(sid => {
    const mine = ppLive(_cache.vocab_cards).filter(c => c.sid === sid);
    return {
      all: mine.length,
      noMean: mine.filter(c => !c.meaning).length,
      noEx: mine.filter(c => !c.example).length,
      missing: mine.filter(c => !c.meaning || !c.example).length,
      checked: mine.filter(c => c.exampleChecked).length
    };
  }, SID);
  console.log('');
  console.log('[1] 실학생 단어 카드: 전체 ' + base.all + '장 · 뜻 없음 ' + base.noMean + ' · 예문 없음 ' + base.noEx +
    ' · 뜻이나 예문 빈 카드 ' + base.missing + '장 (예전엔 이 ' + base.missing + '장마다 사전·번역·AI 를 불렀다)');

  const before = JSON.parse(JSON.stringify(hit));

  console.log('');
  console.log('[2] 실학생 학생뷰(체험 모드) 단어 탭 열기');
  const sb = await page.evaluate(async sid => {
    await previewAsStudent(sid);
    await new Promise(r => setTimeout(r, 2500));
    return { sandbox: typeof ppSandbox === 'function' ? !!ppSandbox() : null };
  }, SID);
  say(sb.sandbox === true, '체험 모드로 들어갔다 (실데이터 저장 차단)');

  await page.evaluate(() => { swStuTab('st-vocab'); });
  await wait(12000);
  const d1 = { dict: hit.dict - before.dict, mymemory: hit.mymemory - before.mymemory, claude: hit.claude - before.claude };
  const shown = await page.evaluate(() => {
    const el = document.getElementById('st-vocab');
    return { on: el && el.classList.contains('active'), len: (el ? el.textContent : '').replace(/\s+/g, ' ').trim().length, head: (el ? el.textContent : '').replace(/\s+/g, ' ').trim().slice(0, 80) };
  });
  say(shown.on && shown.len > 50, '단어 탭이 떴다', shown.head);
  say(d1.dict === 0 && d1.mymemory === 0 && d1.claude === 0,
    '단어 탭 처음 열 때 외부 호출 0',
    'dictionaryapi ' + d1.dict + ' · mymemory ' + d1.mymemory + ' · claude-proxy ' + d1.claude);

  console.log('');
  console.log('[3] 다른 탭 갔다가 단어 탭 다시 열기 x2');
  const mid = JSON.parse(JSON.stringify(hit));
  await page.evaluate(async () => {
    for (let i = 0; i < 2; i++) {
      swStuTab('st-home'); await new Promise(r => setTimeout(r, 1200));
      swStuTab('st-vocab'); await new Promise(r => setTimeout(r, 3000));
    }
  });
  await wait(8000);
  const d2 = { dict: hit.dict - mid.dict, mymemory: hit.mymemory - mid.mymemory, claude: hit.claude - mid.claude };
  say(d2.dict === 0 && d2.mymemory === 0 && d2.claude === 0,
    '두 번 더 열어도 외부 호출 0',
    'dictionaryapi ' + d2.dict + ' · mymemory ' + d2.mymemory + ' · claude-proxy ' + d2.claude);

  console.log('');
  console.log('[4] Sing Together 노래 화면');
  const song = await page.evaluate(async a => {
    openUnitRead(a.tb, a.u);
    await new Promise(r => setTimeout(r, 8000));
    const S = typeof _songState !== 'undefined' ? _songState : null;
    let state = -9;
    if (S && S.player) { try { S.player.mute(); S.player.playVideo(); } catch (e) { } }
    for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 400)); try { state = S.player.getPlayerState(); } catch (e) { } if (state === 1) break; }
    return {
      iframe: !!document.querySelector('#unit-read-audio iframe'),
      lines: S ? (S.lines || []).length : 0,
      words: document.querySelectorAll('#song-lrc .lrc-w').length,
      chips: document.querySelectorAll('.song-chip').length,
      state: state
    };
  }, { tb: REAL_TB, u: UNIT });
  say(song.iframe && song.lines > 0 && song.state === 1, '노래가 앱 안에서 그대로 뜨고 재생된다',
    '가사 ' + song.lines + '줄 · 밑줄 ' + song.words + '곳 · 칩 ' + song.chips + '개 · 상태 ' + song.state);

  const pre = JSON.parse(JSON.stringify(hit));
  const tap = await page.evaluate(async () => {
    const S = _songState;
    document.querySelector('#song-lrc .lrc-w').click();
    await new Promise(r => setTimeout(r, 900));
    const paused = S.player.getPlayerState();
    await new Promise(r => setTimeout(r, 4200));
    return { paused: paused, later: S.player.getPlayerState(), word: document.getElementById('uwp-word').textContent };
  });
  say(tap.paused === 2 && tap.later === 2, '가사 단어를 누르면 멈추고 그대로 있다',
    '단어 "' + tap.word + '" · 상태 ' + tap.paused + ' -> ' + tap.later);
  const d3 = { dict: hit.dict - pre.dict, mymemory: hit.mymemory - pre.mymemory, claude: hit.claude - pre.claude };
  console.log('       (단어 하나 눌렀을 때: dictionaryapi ' + d3.dict + ' · mymemory ' + d3.mymemory + ' · claude-proxy ' + d3.claude + ' — 누른 그 단어 발음·뜻이라 정상)');

  await page.evaluate(async () => { ppSongDestroy(); closeM('m-unit-read'); await new Promise(r => setTimeout(r, 800)); });

  console.log('');
  console.log('[5] 비용 · 실데이터 · 콘솔');
  say(writes === 0, '실데이터 쓰기 0건', writeUrls.slice(0, 3).join(' | ') || '없음');
  say(hit.el11 === 0 && hit.tts === 0, 'ElevenLabs·음성 생성 0회', 'elevenlabs ' + hit.el11 + ' · 생성 ' + hit.tts + ' · 사용량조회 ' + hit.ttsProbe);
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached to the DOM|lrclib|dictionaryapi/i;
  const mine = errs.filter(e => !skip.test(e));
  say(mine.length === 0, '우리 코드 콘솔 오류 0 (외부 사전·유튜브 잡음 제외)', mine.slice(0, 4).join(' | ') || '없음');
  console.log('  실패한 요청 전체 (' + failed.length + '건):');
  failed.forEach(f => console.log('    - ' + f));

  console.log('');
  console.log('합계: ' + pass + ' 통과 / ' + fail + ' 실패');
  console.log('전체 누적 외부 호출: dictionaryapi ' + hit.dict + ' · mymemory ' + hit.mymemory + ' · claude-proxy ' + hit.claude);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
