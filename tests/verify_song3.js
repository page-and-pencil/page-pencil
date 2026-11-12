require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 3차 확인 — ① 단어를 누르면 노래가 멈추고 저절로 다시 틀리지 않는다 ② 히어로는 활동 제외로 돌아갔다
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const REAL_TB = 'singtogetherc096ob', UNIT = 'Sing';
const SID = (process.env.PP_REAL_SID || '');
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

  let writes = 0, el11 = 0, ttsProxy = 0, probes = 0, aiProbe = 0;
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes++;
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**api.elevenlabs.io/**', r => { el11++; return r.fulfill({ status: 500, body: '' }); });
  await page.route('**/functions/v1/tts-proxy**', r => {
    const b = String(r.request().postData() || '');
    if (b.indexOf('"probe"') < 0) ttsProxy++; else probes++;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ month: '2026-11', used: 0, calls: 0, cap: 6000 }) });
  });
  await page.route('**/functions/v1/claude-proxy**', r => {
    const b = String(r.request().postData() || '');
    if (b === '{}') { aiProbe++; return r.fulfill({ status: 400, contentType: 'application/json', body: '{}' }); }
    return r.fulfill({ status: 500, body: '' });
  });

  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 200)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 });
  await wait(2500);

  // ───────── 1. 노래 열고 재생
  console.log('\n[1] 노래 열고 재생');
  const t1 = await page.evaluate(async (a) => {
    openUnitRead(a.tb, a.u);
    await new Promise(r => setTimeout(r, 6500));
    const S = _songState;
    if (S && S.player) { try { S.player.mute(); S.player.playVideo(); } catch (e) { } }
    for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 400)); if (S.player.getPlayerState() === 1) break; }
    return { iframe: !!document.querySelector('#unit-read-audio iframe'), lines: (S.lines || []).length, state: S.player.getPlayerState(), words: document.querySelectorAll('#song-lrc .lrc-w').length, chips: document.querySelectorAll('.song-chip').length };
  }, { tb: REAL_TB, u: UNIT });
  say(t1.iframe && t1.lines > 0 && t1.state === 1, '앱 안에서 재생 중', '가사 ' + t1.lines + '줄 · 밑줄 ' + t1.words + '곳 · 칩 ' + t1.chips + '개');

  // ───────── 2. 가사 밑줄 단어 → 멈추고 그대로 멈춰 있다
  console.log('\n[2] 가사 속 단어를 누르면 멈추고, 저절로 다시 틀리지 않는다');
  const t2 = await page.evaluate(async () => {
    const S = _songState;
    const t0 = S.player.getCurrentTime();
    document.querySelector('#song-lrc .lrc-w').click();
    await new Promise(r => setTimeout(r, 900));
    const paused = S.player.getPlayerState();
    const popup = document.getElementById('unit-word-popup');
    const popupOn = popup && popup.style.display === 'block';
    const timer = !!S.timer;
    await new Promise(r => setTimeout(r, 4200));          // 예전 자동 재생(2.8초)보다 길게 기다린다
    const later = S.player.getPlayerState();
    const t1 = S.player.getCurrentTime();
    return { paused: paused, popupOn: popupOn, timer: timer, later: later, moved: +(t1 - t0).toFixed(1), word: document.getElementById('uwp-word').textContent };
  });
  say(t2.paused === 2, '누르자마자 노래가 멈춘다', '상태 ' + t2.paused + ' · 단어 "' + t2.word + '"');
  say(t2.popupOn, '뜻 풍선이 뜬다');
  say(t2.timer === false, '가사 따라가기 타이머도 멈춘다');
  say(t2.later === 2, '4초를 더 기다려도 멈춘 채로 있다 (자동 재생 없음)', '상태 ' + t2.later + ' · 그동안 흐른 시간 ' + t2.moved + '초');

  // ───────── 3. 학생이 ▶ 로 다시 재생하면 가사 강조가 다시 따라간다
  console.log('\n[3] 다시 재생하면 가사가 다시 따라간다');
  const t3 = await page.evaluate(async () => {
    const S = _songState;
    const cur0 = S.cur;
    try { S.player.seekTo(Math.max(0, S.lines[3].t - S.offset + 0.4), true); S.player.playVideo(); } catch (e) { }   // 인트로가 아니라 가사가 나오는 자리로
    await new Promise(r => setTimeout(r, 3000));
    return { state: S.player.getPlayerState(), timer: !!S.timer, cur0: cur0, cur1: S.cur, on: document.querySelectorAll('#song-lrc .lrc-l.on').length };
  });
  say(t3.state === 1 && t3.timer, '다시 재생되고 타이머가 돈다');
  say(t3.on === 1, '지금 줄 강조가 한 줄 켜져 있다', '줄 ' + t3.cur0 + ' → ' + t3.cur1);

  // ───────── 4. 단어 칩도 같다
  console.log('\n[4] 단어 칩을 눌러도 멈춘다');
  const t4 = await page.evaluate(async () => {
    const S = _songState;
    document.querySelector('.song-chip').click();
    await new Promise(r => setTimeout(r, 900));
    const paused = S.player.getPlayerState();
    await new Promise(r => setTimeout(r, 3600));
    return { paused: paused, later: S.player.getPlayerState(), word: document.getElementById('uwp-word').textContent };
  });
  say(t4.paused === 2 && t4.later === 2, '칩을 눌러도 멈추고 그대로 있다', '단어 "' + t4.word + '" · 상태 ' + t4.paused + ' → ' + t4.later);

  // ───────── 5. 히어로는 활동 제외로 돌아갔다
  console.log('\n[5] 학생 복습 히어로 — 활동(펜슬다운) 제외');
  const t5 = await page.evaluate(async (sid) => {
    closeM('m-unit-read');
    await previewAsStudent(sid);
    await new Promise(r => setTimeout(r, 2500));
    swStuTab('st-library');
    await new Promise(r => setTimeout(r, 1800));
    // 노래 수업을 가장 최신으로 끼워 넣어도 히어로가 그걸 집지 않아야 한다 (DB 에는 쓰지 않는다)
    _cache.lessons.push({ id: '__t_song', sid: sid, date: '2026-11-30', materials: { pencil_down: { book: 'Sing Together', unit: 'Top Of The World' } } });
    renderStudentLibrary(sid);
    await new Promise(r => setTimeout(r, 1200));
    const panel = document.getElementById('st-library');
    const hero = [...panel.querySelectorAll('div')].find(d => (d.textContent || '').indexOf('지난 수업 복습') >= 0 && (d.textContent || '').length < 1500);
    const txt = hero ? (hero.textContent || '').replace(/\s+/g, ' ').trim() : '';
    const songBtn = hero ? [...hero.querySelectorAll('button')].some(b => (b.textContent || '').indexOf('노래') >= 0) : false;
    // 책장(내 책장)에는 그대로 노래 버튼이 있어야 한다
    const card = [...panel.querySelectorAll('.shelf-card')].find(c => (c.textContent || '').indexOf('Sing Together') >= 0);
    if (card && !card.classList.contains('on')) { card.click(); await new Promise(r => setTimeout(r, 1200)); }
    const shelfSongs = [...panel.querySelectorAll('button')].filter(b => (b.textContent || '').indexOf('노래') >= 0).length;
    const shelfCard = !!card;
    _cache.lessons = _cache.lessons.filter(l => l.id !== '__t_song');
    return { shelfCard: shelfCard, hero: !!hero, txt: txt.slice(0, 120), songBtn: songBtn, shelfSongs: shelfSongs, date: (txt.match(/20\d\d-\d\d-\d\d/) || [''])[0] };
  }, SID);
  say(t5.hero && !t5.songBtn, '히어로는 노래(활동)를 띄우지 않는다', t5.txt);
  say(t5.date !== '2026-11-30', '끼워 넣은 노래 수업을 집지 않는다', '히어로 날짜 ' + t5.date);
  say(t5.shelfCard && t5.shelfSongs > 0, '내 책장(수업 교재 복습)에서 Sing Together 를 펼치면 노래 버튼이 있다', t5.shelfSongs + '개');

  // ───────── 6. 비용 · 콘솔
  console.log('\n[6] 비용 · 콘솔');
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached to the DOM|dictionaryapi|ERR_FAILED/i;
  const mine = errs.filter(e => !skip.test(e) && !(e.indexOf('400') >= 0 && aiProbe > 0));
  say(el11 === 0 && ttsProxy === 0, 'ElevenLabs·음성 생성 0회', 'elevenlabs ' + el11 + ' · 생성 ' + ttsProxy + ' · 사용량조회 ' + probes);
  say(writes === 0, '실데이터 쓰기 0건');
  say(mine.length === 0, '우리 코드 콘솔 오류 0', mine.slice(0, 3).join(' | ') || '없음');

  console.log('\n합계: ' + pass + ' 통과 / ' + fail + ' 실패');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
