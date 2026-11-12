require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 2차 확인 — ① 학생 복습 화면 히어로에 노래 ② 단어 누르면 노래 잠깐 멈춤
// 가사 글자는 찍지 않는다(줄 수만). 실데이터 쓰기는 전부 막는다.
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const REAL_TB = 'singtogetherc096ob';
const SID = (process.env.PP_REAL_SID || '');           // 실학생 — 미리보기(체험 모드)로만 본다
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

  let writes = 0, writeTargets = [], el11 = 0, ttsProxy = 0, probes = 0, lrclib = 0, aiProbe = 0;
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    const body = String(r.request().postData() || '');
    writes++; writeTargets.push((body.match(/"id":"([^"]{0,24})/) || [, '?'])[1]);
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**api.elevenlabs.io/**', r => { el11++; return r.fulfill({ status: 500, body: '' }); });
  await page.route('**/functions/v1/tts-proxy**', r => {
    const b = String(r.request().postData() || '');
    if (b.indexOf('"probe"') < 0) ttsProxy++; else probes++;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ month: '2026-11', used: 0, calls: 0, cap: 6000 }) });
  });
  await page.route('**lrclib.net/**', r => { lrclib++; return r.continue(); });
  await page.route('**/functions/v1/claude-proxy**', r => {
    const b = String(r.request().postData() || '');
    if (b === '{}') { aiProbe++; return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'model: Field required' } }) }); }
    return r.fulfill({ status: 500, body: '' });
  });

  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 200)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 });
  await wait(2500);

  // ───────── 1. 기록된 곡 이름 → 교재 단원 매칭 (공용 ppMatchUnit)
  console.log('\n[1] 수업 기록의 곡 이름이 교재 단원에 붙나');
  const t1 = await page.evaluate((tbid) => {
    const g = (_cache.globalTextbooks || []).find(x => x.id === tbid);
    const names = ['Top Of The World', 'Close to You', 'You Are My Sunshine', ''];
    return names.map(n => {
      const ks = ppMatchUnit(g, n) || [];
      const uk = ks.find(u => ppSongVid(g, u)) || '';
      return { n: n, uk: uk };
    });
  }, REAL_TB);
  t1.forEach(r => {
    if (r.n) say(!!r.uk, '기록 "' + r.n + '" → 교재 단원', r.uk || '못 찾음');
  });
  say(!t1[3].uk, '단원이 비어 있는 기록은 노래로 띄우지 않는다');

  // ───────── 2. 실학생 복습 화면 히어로에 노래 줄
  console.log('\n[2] 학생(실학생) 복습 화면 — 지난 수업 복습 히어로');
  const t2 = await page.evaluate(async (sid) => {
    await previewAsStudent(sid);
    await new Promise(r => setTimeout(r, 2500));
    swStuTab('st-library');
    await new Promise(r => setTimeout(r, 1800));
    // 실학생의 실제 직전 수업(2026-11-05)에는 노래가 없다 → 기억 속에만 두 줄을 끼워 넣어
    // ① 펜슬다운 노래 수업이 직전이면 히어로에 뜨는지 ② 게임 같은 활동만 있는 수업은
    // 히어로를 가로채지 않는지 확인한다. DB 에는 쓰지 않는다(_cache 만 건드리고 끝에 되돌림).
    window.__inj = ['__t_game', '__t_song'];
    _cache.lessons.push({ id: '__t_song', sid: sid, date: '2026-11-09', materials: { pencil_down: { book: 'Sing Together', unit: 'Top Of The World' } } });
    _cache.lessons.push({ id: '__t_game', sid: sid, date: '2026-11-10', materials: { pencil_down: { book: 'Game', unit: '단어 빙고' } } });
    renderStudentLibrary(sid);
    await new Promise(r => setTimeout(r, 1200));
    const panel = document.getElementById('st-library');
    const hero = [...panel.querySelectorAll('div')].find(d => (d.textContent || '').indexOf('지난 수업 복습') >= 0
      && (d.textContent || '').length < 1200);
    const out = { sandbox: ppSandbox(), hero: !!hero, heroTxt: '', songBtn: '', rows: 0 };
    if (!hero) return out;
    out.heroTxt = (hero.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const b = [...hero.querySelectorAll('button')].find(x => (x.textContent || '').indexOf('노래') >= 0);
    out.songBtn = b ? (b.getAttribute('onclick') || '') : '';
    out.rows = hero.querySelectorAll('button,span[title]').length;
    return out;
  }, SID);
  say(t2.sandbox, '학생 미리보기는 체험 모드');
  say(t2.hero, '히어로가 그려진다', t2.heroTxt);
  say(/openUnitRead\('singtogetherc096ob'/.test(t2.songBtn), '히어로에 노래 버튼이 있다', t2.songBtn.slice(0, 70));
  say(t2.heroTxt.indexOf('빙고') < 0 && t2.heroTxt.indexOf('Sing Together') >= 0,
    '게임만 있는 수업은 히어로를 가로채지 않는다', t2.heroTxt.slice(0, 90));

  // ───────── 3. 히어로 버튼으로 열어 재생
  console.log('\n[3] 히어로 노래 버튼 → 앱 안 재생');
  const t3 = await page.evaluate(async () => {
    const panel = document.getElementById('st-library');
    const hero = [...panel.querySelectorAll('div')].find(d => (d.textContent || '').indexOf('지난 수업 복습') >= 0 && (d.textContent || '').length < 1200);
    const b = [...hero.querySelectorAll('button')].find(x => (x.textContent || '').indexOf('노래') >= 0);
    b.click();
    await new Promise(r => setTimeout(r, 6000));
    const S = _songState;
    return {
      open: document.getElementById('m-unit-read').classList.contains('open'),
      iframe: !!document.querySelector('#unit-read-audio iframe'),
      unit: S ? S.unitKey : '',
      lines: S ? (S.lines || []).length : 0,
      words: document.querySelectorAll('#song-lrc .lrc-w').length,
      saveBtn: [...document.querySelectorAll('.song-sbtn')].some(x => x.textContent.indexOf('보정 저장') >= 0),
    };
  });
  say(t3.open && t3.iframe, '앱 안에서 열린다', '단원 ' + t3.unit + ' · 가사 ' + t3.lines + '줄');
  say(t3.saveBtn === false, '학생에게는 보정 저장 버튼이 없다');

  // ───────── 4. 단어를 누르면 잠깐 멈추고 다시 켜진다
  console.log('\n[4] 단어 누름 → 노래 잠깐 멈춤 → 되살아남');
  const t4 = await page.evaluate(async () => {
    const S = _songState;
    try { S.player.mute(); S.player.playVideo(); } catch (e) { }
    for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 400)); if (S.player.getPlayerState() === 1) break; }
    const before = S.player.getPlayerState();
    const w = document.querySelector('#song-lrc .lrc-w') || document.querySelector('.song-chip');
    const kind = document.querySelector('#song-lrc .lrc-w') ? '가사 속 단어' : '단어 칩';
    if (w) w.click();
    await new Promise(r => setTimeout(r, 900));
    const paused = S.player.getPlayerState();
    const popup = document.getElementById('unit-word-popup');
    const popupOn = popup && popup.style.display === 'block';
    const ducked = !!S.duck;
    await new Promise(r => setTimeout(r, 3200));
    const after = S.player.getPlayerState();
    return { kind: kind, before: before, paused: paused, popupOn: popupOn, ducked: ducked, after: after, duckLeft: !!_songState.duck };
  });
  say(t4.before === 1, '누르기 전에 재생 중이었다', '상태 ' + t4.before);
  say(t4.paused === 2, t4.kind + '을 누르면 노래가 멈춘다', '상태 ' + t4.paused + ' · 뜻 풍선 ' + (t4.popupOn ? '뜸' : '안 뜸'));
  say(t4.popupOn, '뜻 풍선이 뜬다');
  say(t4.after === 1, '2.8초 뒤 노래가 이어진다', '상태 ' + t4.after + ' · 예약 남음 ' + t4.duckLeft);

  // ───────── 5. 손으로 멈춘 노래는 단어를 눌러도 저절로 켜지지 않는다
  console.log('\n[5] 손으로 멈춘 노래는 되살아나지 않는다');
  const t5 = await page.evaluate(async () => {
    const S = _songState;
    try { S.player.pauseVideo(); } catch (e) { }
    await new Promise(r => setTimeout(r, 700));
    const st0 = S.player.getPlayerState();
    const w = document.querySelector('#song-lrc .lrc-w') || document.querySelector('.song-chip');
    if (w) w.click();
    await new Promise(r => setTimeout(r, 3600));
    return { st0: st0, st1: S.player.getPlayerState(), duck: !!S.duck };
  });
  say(t5.st0 === 2 && t5.st1 === 2, '멈춰 있던 노래는 그대로 멈춰 있다', '상태 ' + t5.st0 + ' → ' + t5.st1);
  say(t5.duck === false, '되살림 예약이 걸리지 않는다');

  // ───────── 6. 예약 뒤 창을 닫으면 소리가 되살아나지 않는다
  console.log('\n[6] 되살림 예약 뒤 창을 닫아도 소리가 없다');
  const t6 = await page.evaluate(async () => {
    const S = _songState;
    try { S.player.mute(); S.player.playVideo(); } catch (e) { }
    for (let i = 0; i < 15; i++) { await new Promise(r => setTimeout(r, 400)); if (S.player.getPlayerState() === 1) break; }
    const w = document.querySelector('#song-lrc .lrc-w') || document.querySelector('.song-chip');
    if (w) w.click();                                  // 멈춤 + 2.8초 뒤 되살림 예약
    await new Promise(r => setTimeout(r, 600));
    closeM('m-unit-read');                             // 예약이 살아 있는 동안 닫는다
    await new Promise(r => setTimeout(r, 3400));
    return { state: _songState, iframe: !!document.querySelector('#unit-read-audio iframe') };
  });
  say(t6.state === null && !t6.iframe, '창을 닫으면 플레이어가 사라지고 되살아나지 않는다');

  // ───────── 7. 유튜브 아닌 단원 원문 읽기 + 단어 팝업 그대로
  console.log('\n[7] 유튜브 아닌 교재 단원은 예전과 같다');
  const t7 = await page.evaluate(async () => {
    await returnToTeacher();
    await new Promise(r => setTimeout(r, 1500));
    const g = (_cache.globalTextbooks || []).find(x => !x.songBook && x.unitTexts && Object.keys(x.unitTexts).length
      && Object.keys(x.unitTexts).some(u => (x.units || {})[u] && x.units[u].length));
    const uk = Object.keys(g.unitTexts).find(u => (g.units || {})[u] && g.units[u].length);
    openUnitRead(g.id, uk);
    await new Promise(r => setTimeout(r, 1200));
    const body = document.getElementById('unit-read-body');
    const spans = body.querySelectorAll('span[onclick^="showUnitWordPopup"]');
    const out = {
      book: g.title, unit: uk,
      songState: _songState,
      words: spans.length,
      readText: String(window._urReadText || '').length,
      // 출판사 음원이 있는 단원은 <audio>, 없으면 '▶ 듣기' 버튼 — 둘 중 하나가 있어야 한다
      tts: (() => {
        const b = document.getElementById('tts-play-btn');
        const a = document.querySelector('#unit-read-audio audio');
        return a ? '출판사 음원' : ((b && b.offsetParent !== null) ? '브라우저 음성 듣기' : '');
      })(),
      songPane: !!body.querySelector('.song-pane'),
    };
    if (spans.length) { spans[0].click(); await new Promise(r => setTimeout(r, 400)); }
    const p = document.getElementById('unit-word-popup');
    out.popupOn = p && p.style.display === 'block';
    closeM('m-unit-read');
    return out;
  });
  say(t7.songState === null && !t7.songPane, '노래 패널이 끼어들지 않는다', t7.book + ' / ' + t7.unit);
  say(t7.words > 0 && t7.popupOn, '단어 팝업이 그대로 뜬다', t7.words + '곳');
  say(!!t7.tts && t7.readText > 0, '듣기 자리·읽을 글이 그대로다', t7.tts + ' · 읽을 글 ' + t7.readText + '자');

  // [7b] 사전 발음 조회(api.dictionaryapi.dev)는 단어를 누를 때마다 나던 기존 잡음인가
  const dictBefore = errs.filter(e => /dictionaryapi|ERR_FAILED/i.test(e)).length;
  await page.evaluate(async () => { await speakWord('survey'); });   // 팝업·노래 없이 발음만
  await wait(1800);
  const dictAfter = errs.filter(e => /dictionaryapi|ERR_FAILED/i.test(e)).length;
  console.log('  (참고) 팝업 없이 발음만 불렀을 때 사전 조회 오류 ' + (dictAfter - dictBefore) + '건 증가'
    + ' — api.dictionaryapi.dev 는 speakWord(db.js)가 발음을 찾는 곳이라 이번 수정과 무관하고, 들쭉날쭉 실패한다');

  // ───────── 8. 폭별 넘침 · 비용 · 오류
  console.log('\n[8] 폭 · 비용 · 콘솔');
  const sizes = [[320, 700], [390, 780]];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await wait(600);
    const ov = await page.evaluate(async (sid) => {
      await previewAsStudent(sid);
      await new Promise(r => setTimeout(r, 2200));
      swStuTab('st-library');
      await new Promise(r => setTimeout(r, 1600));
      const over = document.documentElement.scrollWidth > window.innerWidth + 1;
      const panel = document.getElementById('st-library');
      const hero = [...panel.querySelectorAll('div')].find(d => (d.textContent || '').indexOf('지난 수업 복습') >= 0 && (d.textContent || '').length < 1200);
      const btn = hero ? [...hero.querySelectorAll('button')].find(x => (x.textContent || '').indexOf('노래') >= 0) : null;
      const r = btn ? btn.getBoundingClientRect() : null;
      await returnToTeacher();
      await new Promise(r2 => setTimeout(r2, 1200));
      return { over: over, btn: !!btn, right: r ? Math.round(r.right) : 0 };
    }, SID);
    say(!ov.over && ov.btn && ov.right <= w, w + 'px — 가로 넘침 없음, 노래 버튼이 화면 안', '버튼 오른쪽 ' + ov.right + 'px');
  }
  // 걸러내는 것: 유튜브·구글 도메인, 부팅 때 도는 AI 키 확인(일부러 400), 사전 발음 조회(기존 잡음)
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached to the DOM|dictionaryapi|ERR_FAILED/i;
  const dict = errs.filter(e => /dictionaryapi|ERR_FAILED/i.test(e)).length;
  const mine = errs.filter(e => !skip.test(e) && !(e.indexOf('400') >= 0 && aiProbe > 0));
  say(el11 === 0 && ttsProxy === 0, 'ElevenLabs·음성 생성 0회', 'elevenlabs ' + el11 + ' · 생성 ' + ttsProxy + ' · 사용량조회 ' + probes);
  say(writes === 0, '실데이터 쓰기 0건', writeTargets.join(',') || '없음');
  say(mine.length === 0, '우리 코드 콘솔 오류 0', mine.slice(0, 3).join(' | ') || '없음');
  console.log('  (참고) lrclib 호출 ' + lrclib + '회 · 사전 발음 조회 실패 ' + dict + '건 · 그 밖 외부 오류 ' + (errs.length - mine.length - dict) + '건');

  console.log('\n합계: ' + pass + ' 통과 / ' + fail + ' 실패');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
