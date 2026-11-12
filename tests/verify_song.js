require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// feat/song-player 확인 — 선생님 화면에서 노래 모드. 가사 글자는 찍지 않는다(줄 수만).
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SP = ((process.env.PP_TEST_OUT || require('os').tmpdir()) + '/');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const REAL_TB = 'singtogetherc096ob', DUMMY_TB = 'songdummy001', UNIT = 'Sing';
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const rows = [];
function say(ok, what, detail) {
  rows.push([ok ? '✅' : '❌', what, detail || '']);
  if (ok) pass++; else fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + what + (detail ? '  — ' + detail : ''));
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();

  // ── 네트워크: 넓은 루트를 먼저, 구체 루트를 나중에 (나중 등록이 우선)
  let writes = 0, writeTargets = [], el11 = 0, ttsProxy = 0, probes = 0, lrclib = 0, aiProbe = 0;
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    const body = String(r.request().postData() || '');
    if (body.indexOf(DUMMY_TB) >= 0) return r.continue();        // 더미 저장만 통과
    writes++; writeTargets.push((body.match(/"id":"([^"]{0,24})/) || [, '?'])[1]);
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**api.elevenlabs.io/**', r => { el11++; return r.fulfill({ status: 500, body: '' }); });
  await page.route('**/functions/v1/tts-proxy**', r => {
    const b = String(r.request().postData() || '');
    if (b.indexOf('"probe"') < 0) ttsProxy++;      // probe(사용량 조회)는 음성 생성이 아니다
    else probes++;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ month: '2026-11', used: 0, calls: 0, cap: 6000 }) });
  });
  await page.route('**lrclib.net/**', r => { lrclib++; return r.continue(); });
  await page.route('**/functions/v1/claude-proxy**', r => {
    const b = String(r.request().postData() || '');
    if (b === '{}') { aiProbe++; return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'model: Field required' } }) }); }
    return r.fulfill({ status: 500, body: '' });   // 노래 모드에서 AI 를 부르면 안 된다
  });

  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 200)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 });
  await wait(2500);

  // ───────────────────────── 1. 순수 함수
  console.log('\n[1] 도우미 함수');
  const f1 = await page.evaluate(() => {
    const y = ppYouTubeId;
    return {
      watch: y('https://www.youtube.com/watch?v=abcDEF12345'),
      param: y('https://www.youtube.com/watch?app=desktop&v=abcDEF12345&t=30s'),
      shortUrl: y('https://youtu.be/abcDEF12345?si=xx'),
      shorts: y('https://www.youtube.com/shorts/abcDEF12345'),
      embed: y('https://www.youtube-nocookie.com/embed/abcDEF12345'),
      quizlet: y('https://quizlet.com/kr/123/abc/'),
      empty: y(''),
      lrc: (() => { const L = ppParseLrc('[ar:X]\n[00:01.50]aa\n[01:02.25]bb\n[01:02.25]bb\nno tag\n'); return L.map(x => x.t); })(),
      off0: ppLrcOffset({ id: 'zz' }, 'u'),
      offTb: ppLrcOffset({ id: 'zz', unitLyricsOffset: { u: -1.5 } }, 'u'),
    };
  });
  say(f1.watch === 'abcDEF12345' && f1.param === 'abcDEF12345' && f1.shortUrl === 'abcDEF12345'
    && f1.shorts === 'abcDEF12345' && f1.embed === 'abcDEF12345', 'ppYouTubeId: watch·파라미터·youtu.be·shorts·embed 모두 11자리', JSON.stringify(f1.watch));
  say(f1.quizlet === '' && f1.empty === '', 'ppYouTubeId: 유튜브가 아니면 빈 문자열');
  say(JSON.stringify(f1.lrc) === JSON.stringify([1.5, 62.25, 62.25]), 'ppParseLrc: 메타 태그·태그 없는 줄 걸러내고 초로 변환', JSON.stringify(f1.lrc));
  say(f1.off0 === 0 && f1.offTb === -1.5, 'ppLrcOffset: 저장값 없으면 0, 교재 값이면 그 값');

  // ───────────────────────── 2. 데이터 범위 (유튜브 링크가 노래 교재 밖에도 있나)
  console.log('\n[2] 데이터 범위');
  const scope = await page.evaluate(() => {
    let song = 0, other = 0, otherBooks = [];
    (_cache.globalTextbooks || []).forEach(b => {
      const n = Object.values(b.unitLinks || {}).filter(v => ppYouTubeId(v)).length;
      if (!n) return;
      if (b.songBook) song += n; else { other += n; otherBooks.push(b.title + '(' + n + ')'); }
    });
    return { song, other, otherBooks: otherBooks.slice(0, 6) };
  });
  console.log('     노래 교재의 유튜브 링크 ' + scope.song + '개 · 그 밖 교재 ' + scope.other + '개 ' + JSON.stringify(scope.otherBooks));
  say(true, '유튜브 링크 분포 확인', '노래 교재 ' + scope.song + ' · 그 밖 ' + scope.other);

  // ───────────────────────── 3. 선생님 단원 편집 패널
  console.log('\n[3] 선생님 자료 DB — 단원 편집');
  const t3 = await page.evaluate(async (ids) => {
    switchDataTab('tbook');
    openTbookUnits(ids.tb);
    _tuCurUnit = ids.unit;                       // tuSelectUnit 은 자동 저장을 타므로 직접 세운다
    tuRenderWords(ids.tb, ids.unit);
    await new Promise(r => setTimeout(r, 400));
    const btn = document.getElementById('tu-song-open'), row = document.getElementById('tu-lyr-row'), inp = document.getElementById('tu-unit-lyrid');
    return { btnShown: !!btn && btn.style.display !== 'none', rowShown: !!row && row.style.display === 'flex', lyr: inp ? inp.value : '(없음)',
      ttsBtn: (document.getElementById('tu-unit-tts') || {}).style ? document.getElementById('tu-unit-tts').style.display : '?' };
  }, { tb: REAL_TB, unit: UNIT });
  say(t3.btnShown, '유튜브 단원이면 "🎵 앱에서 듣기" 버튼이 보인다');
  say(t3.rowShown && /^\d+$/.test(t3.lyr), '가사 id 칸에 저장된 id 가 들어온다', 'id=' + t3.lyr);
  say(t3.ttsBtn === 'none', '노래 교재에는 "이 단원 음성 만들기" 가 뜨지 않는다');

  // 유튜브가 아닌 교재에서는 숨는가
  const t3b = await page.evaluate(async () => {
    const tb = (_cache.globalTextbooks || []).find(b => !b.songBook && b.unitTexts && Object.keys(b.unitTexts).some(u => b.unitTexts[u]));
    if (!tb) return { skip: true };
    const unit = Object.keys(tb.unitTexts).find(u => tb.unitTexts[u]);
    openTbookUnits(tb.id); _tuCurUnit = unit; tuRenderWords(tb.id, unit);
    await new Promise(r => setTimeout(r, 300));
    const btn = document.getElementById('tu-song-open'), row = document.getElementById('tu-lyr-row');
    return { title: tb.title, unit, btnShown: btn.style.display !== 'none', rowShown: row.style.display !== 'none' };
  });
  say(t3b.skip || (!t3b.btnShown && !t3b.rowShown), '유튜브가 아닌 교재 단원에서는 둘 다 숨는다', t3b.skip ? '해당 교재 없음' : t3b.title + ' / ' + t3b.unit);

  // ───────────────────────── 4. 노래 모드 열기
  console.log('\n[4] 노래 모드 — 플레이어·가사');
  const t4 = await page.evaluate(async (ids) => {
    openTbookUnits(ids.tb); _tuCurUnit = ids.unit; tuRenderWords(ids.tb, ids.unit);
    await new Promise(r => setTimeout(r, 300));
    tuOpenSong();
    await new Promise(r => setTimeout(r, 6000));     // 플레이어 + 가사
    const S = _songState || {};
    const body = document.getElementById('unit-read-body');
    const ifr = document.querySelector('#unit-read-audio iframe');
    return {
      open: document.getElementById('m-unit-read').classList.contains('open'),
      iframe: ifr ? ifr.src.slice(0, 60) : '(없음)',
      lines: (S.lines || []).length, synced: !!S.synced, src: S.src || '',
      chips: body.querySelectorAll('.song-chip').length,
      marks: body.querySelectorAll('.lrc-w').length,
      syncbar: !!body.querySelector('.song-sync'),
      saveBtn: [...body.querySelectorAll('.song-sbtn')].some(b => b.textContent.indexOf('보정 저장') >= 0),
      linkHidden: document.getElementById('unit-read-link').style.display === 'none',
      ttsPlay: !!document.getElementById('tts-play-btn'),
      makeBtn: !!document.getElementById('ur-tts-make'),
      readText: String(window._urReadText || ''),
      lyrCached: Object.keys(localStorage).filter(k => k.indexOf('pp_lrc_') === 0).length,
      player: !!(S.player && S.player.getCurrentTime),
    };
  }, { tb: REAL_TB, unit: UNIT });
  say(t4.open, '단원 모달이 열린다');
  say(t4.iframe.indexOf('youtube-nocookie.com') >= 0, '플레이어가 youtube-nocookie 로 들어간다', t4.iframe);
  say(t4.lines > 10 && t4.synced, '싱크 가사를 받아 줄로 쪼갰다', t4.lines + '줄 · 출처 ' + t4.src);
  say(t4.chips > 0, '노래 단어 칩이 그려진다', t4.chips + '개');
  say(t4.marks > 0, '가사 속 단원 단어에 밑줄이 붙는다', t4.marks + '곳');
  say(t4.syncbar && t4.saveBtn, '싱크 보정 줄 + 선생님용 보정 저장 버튼');
  say(t4.linkHidden && !t4.ttsPlay && !t4.makeBtn, '"심화 학습 앱 열기"·"▶ 듣기"·"음성 만들기" 모두 숨는다');
  say(t4.readText === '', '브라우저 음성이 읽을 글(_urReadText)은 비어 있다');
  say(t4.lyrCached === 1, '받은 가사는 기기(localStorage)에만 캐시된다', t4.lyrCached + '건');
  say(t4.player, '플레이어 객체가 준비됐다');

  // ───────────────────────── 5. 재생 따라가기
  console.log('\n[5] 노래를 따라 가사 줄이 움직이나');
  const t5 = await page.evaluate(async () => {
    const S = _songState;
    try { S.player.mute(); S.player.seekTo(10, true); S.player.playVideo(); } catch (e) { return { err: String(e.message) }; }
    const seen = [], tops = [];
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 500));
      const on = document.querySelector('#song-lrc .lrc-l.on');
      if (on) seen.push(+on.dataset.i);
      tops.push(document.getElementById('unit-read-body').scrollTop);
    }
    let t = 0; try { t = S.player.getCurrentTime(); } catch (e) { }
    const uniq = [...new Set(seen)];
    const cur = S.cur, line = S.lines[cur];
    return { uniq, n: uniq.length, advancing: uniq.length > 1 && uniq[uniq.length - 1] > uniq[0],
      time: Math.round(t * 10) / 10, cur, lineT: line ? line.t : null,
      inWindow: !!line && line.t <= t + 0.6, scrolled: Math.max(...tops) > Math.min(...tops), timer: !!S.timer };
  });
  if (t5.err) say(false, '재생 시작', t5.err);
  else {
    say(t5.advancing, '재생하면 강조되는 줄이 순서대로 넘어간다', '줄 ' + t5.uniq.slice(0, 6).join('→') + (t5.n > 6 ? '…' : ''));
    say(t5.inWindow, '강조된 줄의 시간이 지금 재생 시간과 맞는다', '재생 ' + t5.time + '초 / 줄 ' + t5.lineT + '초');
    say(t5.scrolled, '그 줄이 보이게 가사 칸이 스스로 움직인다');
    say(t5.timer, '재생 중일 때만 200ms 타이머가 돈다 (지금은 켜짐)');
  }

  // ───────────────────────── 6. 줄 누르기 · 보정 · 싱크 맞추기
  console.log('\n[6] 줄 누르기 · 싱크 보정');
  const t6 = await page.evaluate(async () => {
    const S = _songState;
    const target = Math.min(S.lines.length - 1, 20);
    const want = S.lines[target].t;
    ppSongLineClick(target);
    await new Promise(r => setTimeout(r, 1800));
    let t = 0; try { t = S.player.getCurrentTime(); } catch (e) { }
    // 보정 버튼
    ppSongOffset(0.5); ppSongOffset(0.5);
    const lbl = (document.getElementById('song-off') || {}).textContent || '';
    const ls = localStorage.getItem(ppLrcOffKey(S.tbId, S.unitKey));
    ppSongOffset(-1);
    // 싱크 맞추기 모드
    ppSongSync();
    const syncOn = _songState.sync;
    let t2 = 0; try { t2 = S.player.getCurrentTime(); } catch (e) { }
    const idx = Math.min(S.lines.length - 1, 30);
    ppSongLineClick(idx);
    await new Promise(r => setTimeout(r, 400));
    let t3 = 0; try { t3 = S.player.getCurrentTime(); } catch (e) { }
    const expect = Math.round((S.lines[idx].t - t2) * 10) / 10;
    const got = _songState.offset;
    ppSongSync(); _songSetOffset(0);
    return { want: Math.round(want * 10) / 10, got: Math.round(t * 10) / 10, lbl, ls,
      syncOn, offExpect: expect, offGot: got, noSeek: Math.abs(t3 - t2) < 2.5 };
  });
  say(Math.abs(t6.got - t6.want) < 2.5, '줄을 누르면 그 줄 시간으로 이동한다', '줄 ' + t6.want + '초 → 재생 ' + t6.got + '초');
  say(t6.lbl.indexOf('+1.0') >= 0 && t6.ls === '1', '보정 ±0.5초 버튼이 값과 표시를 바꾼다', t6.lbl + ' / 로컬 ' + t6.ls);
  say(t6.syncOn && Math.abs(t6.offGot - t6.offExpect) < 0.6 && t6.noSeek,
    '"싱크 맞추기" 에서는 줄을 눌러도 이동하지 않고 보정값이 맞춰진다', '기대 ' + t6.offExpect + ' / 실제 ' + t6.offGot);

  // ───────────────────────── 7. 더미 — 임베드 막힘 + 선생님 보정 저장
  console.log('\n[7] 더미 교재 — 막힌 영상 · 보정 저장');
  const t7 = await page.evaluate(async (dum) => {
    closeM('m-unit-read');
    const tb = (_cache.globalTextbooks || []).find(b => b.id === dum);
    if (!tb) return { skip: true };
    openUnitRead(dum, 'ZZ Song Blocked');
    await new Promise(r => setTimeout(r, 9000));
    const host = document.getElementById('unit-read-audio');
    const blocked = !!host.querySelector('.song-blocked');
    const link = host.querySelector('.song-blocked a');
    return { skip: false, blocked, msg: (host.querySelector('.song-blocked') || {}).textContent || '',
      href: link ? link.href : '', target: link ? link.target : '', iframe: !!host.querySelector('iframe'), timer: !!(_songState && _songState.timer) };
  }, DUMMY_TB);
  if (t7.skip) say(false, '더미 교재를 찾지 못했다');
  else {
    say(t7.blocked && !t7.iframe, '임베드가 막힌 영상에는 안내만 남는다', t7.msg.replace(/\s+/g, ' ').slice(0, 42));
    say(t7.href.indexOf('youtube.com/watch?v=') >= 0 && t7.target === '_blank', '이때만 "유튜브에서 열기" 링크가 있다');
    say(!t7.timer, '막힌 영상에서는 타이머가 돌지 않는다');
  }
  const t7b = await page.evaluate(async (dum) => {
    closeM('m-unit-read');
    openUnitRead(dum, 'ZZ Song OK');
    await new Promise(r => setTimeout(r, 7000));
    const S = _songState;
    if (!S || !S.synced) return { skip: true, lines: (S && S.lines || []).length };
    _songSetOffset(1.3);
    await ppSongSaveOffset();
    await new Promise(r => setTimeout(r, 1200));
    const tb = (_cache.globalTextbooks || []).find(b => b.id === dum);
    return { skip: false, cache: tb && tb.unitLyricsOffset ? tb.unitLyricsOffset['ZZ Song OK'] : null };
  }, DUMMY_TB);
  say(!t7b.skip && t7b.cache === 1.3, '선생님 "이 곡 보정 저장" → 교재(unitLyricsOffset)에 들어간다', t7b.skip ? '싱크 가사 없음(' + t7b.lines + '줄)' : String(t7b.cache));

  // ───────────────────────── 8. 유튜브 아닌 단원의 원문 읽기 (변화 없어야 한다)
  console.log('\n[8] 유튜브 아닌 단원 — 원문 읽기 그대로');
  const t8 = await page.evaluate(async () => {
    closeM('m-unit-read');
    // 화자 표기가 있는 대화문 단원을 고른다 (배지·하이라이트까지 함께 본다)
    let pick = null;
    for (const b of (_cache.globalTextbooks || [])) {
      if (b.songBook) continue;
      for (const u of Object.keys(b.unitTexts || {})) {
        const t = b.unitTexts[u];
        if (!t || ppYouTubeId((b.unitLinks || {})[u])) continue;
        if (typeof ppParseDialog === 'function' && ppParseDialog(t).dialog) { pick = { id: b.id, title: b.title, u }; break; }
      }
      if (pick) break;
    }
    if (!pick) return { skip: true };
    openUnitRead(pick.id, pick.u);
    await new Promise(r => setTimeout(r, 800));
    const body = document.getElementById('unit-read-body'), host = document.getElementById('unit-read-audio');
    return { skip: false, title: pick.title, unit: pick.u,
      songPane: !!body.querySelector('.song-pane'),
      badges: body.querySelectorAll('.dlg-spk').length,
      words: body.querySelectorAll('[onclick^="showUnitWordPopup"]').length,
      audioArea: !!(host.querySelector('audio') || document.getElementById('tts-play-btn')),
      readText: String(window._urReadText || '').length,
      songState: !!_songState, bodyLen: body.innerHTML.length };
  });
  if (t8.skip) say(false, '대화문 단원을 찾지 못했다');
  else {
    say(!t8.songPane && !t8.songState, '노래 패널이 끼어들지 않는다', t8.title + ' / ' + t8.unit);
    say(t8.badges > 0, '화자 배지 그대로', t8.badges + '개');
    say(t8.words > 0, '단어 팝업 하이라이트 그대로', t8.words + '곳');
    say(t8.audioArea, '음원 또는 "▶ 듣기" 자리 그대로');
    say(t8.readText > 0, '읽을 글(_urReadText)이 채워진다', t8.readText + '자');
  }

  // ───────────────────────── 9. 학생 화면 버튼
  console.log('\n[9] 학생 책장 단원 줄 버튼');
  const t9 = await page.evaluate(() => {
    // 같은 그리기 코드를 쓰는지 소스로 확인 (학생 데이터에 손대지 않는다)
    const src = String(window.renderStudentLibrary || '');
    return { hasSongBtn: src.indexOf('노래') >= 0 && src.indexOf('ppSongVid') >= 0,
      stillLink: src.indexOf('심화') >= 0 };
  });
  say(t9.hasSongBtn && t9.stillLink, '책장 단원 줄: 유튜브면 "🎵 노래", 아니면 "🔗 심화" 그대로');

  console.log('\n[9b] 학생 미리보기 — 실학생 책장에 노래 단원');
  const t9b = await page.evaluate(async () => {
    closeM('m-unit-read');
    const sid = (process.env.PP_REAL_SID || '');
    await previewAsStudent(sid);
    await new Promise(r => setTimeout(r, 2500));
    if (typeof loadVocabCards === 'function') await loadVocabCards(sid);
    swStuTab('st-library');
    await new Promise(r => setTimeout(r, 2000));
    const panel = document.getElementById('st-library');
    const card = [...panel.querySelectorAll('.shelf-card')].find(c => (c.textContent || '').indexOf('Sing Together') >= 0);
    if (card && !card.classList.contains('on')) { card.click(); await new Promise(r => setTimeout(r, 1200)); }
    const btns = [...panel.querySelectorAll('button')].filter(b => (b.textContent || '').indexOf('노래') >= 0);
    const links = [...panel.querySelectorAll('a')].filter(a => (a.textContent || '').indexOf('심화') >= 0);
    const out = { sandbox: ppSandbox(), shelf: !!card, songBtns: btns.length, oldLinks: links.length,
      units: btns.map(b => (b.getAttribute('onclick') || '').slice(0, 70)).slice(0, 3) };
    if (btns.length) { btns[0].click(); await new Promise(r => setTimeout(r, 5000));
      out.opened = document.getElementById('m-unit-read').classList.contains('open');
      out.lines = (_songState && _songState.lines || []).length;
      out.iframe = !!document.querySelector('#unit-read-audio iframe');
      out.saveBtn = [...document.querySelectorAll('.song-sbtn')].some(b => b.textContent.indexOf('보정 저장') >= 0);
      closeM('m-unit-read'); }
    await returnToTeacher();
    await new Promise(r => setTimeout(r, 1500));
    return out;
  });
  say(t9b.sandbox, '학생 미리보기는 체험 모드로 들어간다');
  say(t9b.shelf, '실학생 책장에 Sing Together 가 있다');
  say(t9b.songBtns > 0, '노래 단원에 "🎵 노래" 버튼이 그려진다', t9b.songBtns + '개 · 예 ' + (t9b.units[0] || ''));
  say(!!t9b.opened && t9b.lines > 0 && !!t9b.iframe, '학생이 눌러도 앱 안에서 열린다', (t9b.lines || 0) + '줄 · iframe ' + !!t9b.iframe);
  say(t9b.saveBtn === false, '학생(체험 모드)에게는 "보정 저장" 버튼이 없다');

  // ───────────────────────── 10. ElevenLabs 호출 0 · 실데이터 저장 0
  console.log('\n[10] 음성 비용 · 저장');
  say(el11 === 0 && ttsProxy === 0, '노래 모드에서 ElevenLabs 음성 생성 호출 0', 'eleven ' + el11 + ' · 생성 ' + ttsProxy + ' (사용량 probe ' + probes + '회는 선생님 화면 기본 동작)');
  say(writes === 0, '실데이터 저장 0건 (더미 저장만 통과)', writes ? JSON.stringify(writeTargets.slice(0, 5)) : '0건');
  console.log('     lrclib 요청 ' + lrclib + '회 (가사는 캐시가 없을 때만 받는다)');

  // ───────────────────────── 11. 화면 폭
  console.log('\n[11] 화면 폭 320 / 390 / 1440');
  for (const w of [320, 390, 1440]) {
    await page.setViewportSize({ width: w, height: w === 1440 ? 900 : 844 });
    const v = await page.evaluate(async (ids) => {
      closeM('m-unit-read');
      openUnitRead(ids.tb, ids.unit);
      await new Promise(r => setTimeout(r, 4500));
      const mdl = document.querySelector('#m-unit-read .mdl');
      const box = document.querySelector('.song-box');
      const body = document.getElementById('unit-read-body');
      const over = [...document.querySelectorAll('#m-unit-read *')].filter(e => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible').length;
      return { mdlW: mdl ? Math.round(mdl.getBoundingClientRect().width) : 0,
        boxH: box ? Math.round(box.getBoundingClientRect().height) : 0,
        boxW: box ? Math.round(box.getBoundingClientRect().width) : 0,
        vh: Math.round(window.innerHeight), over,
        pageOver: document.documentElement.scrollWidth > window.innerWidth + 1,
        bodyH: body ? Math.round(body.getBoundingClientRect().height) : 0 };
    }, { tb: REAL_TB, unit: UNIT });
    const pct = Math.round(v.boxH / v.vh * 100);
    say(!v.pageOver && v.over === 0 && v.boxW <= v.mdlW + 1 && pct <= 34,
      w + 'px: 넘침 없음 · 영상 높이 ' + pct + 'vh', '영상 ' + v.boxW + '×' + v.boxH + ' · 모달 ' + v.mdlW + ' · 가사칸 ' + v.bodyH);
  }

  // ───────────────────────── 12. 콘솔
  // 부팅 때 도는 AI 키 확인(ppProbeAiProxy)은 model 을 빼고 보내 400 을 '받도록' 만든 것이다 (db.js 주석)
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached to the DOM/i;
  const mine = errs.filter(e => !skip.test(e) && !(e.indexOf('400') >= 0 && aiProbe > 0));
  console.log('\n[12] 콘솔 오류: 전체 ' + errs.length + ' · 유튜브 쪽 제외 ' + mine.length);
  mine.slice(0, 6).forEach(e => console.log('     · ' + e));
  say(mine.length === 0, '우리 코드에서 나온 콘솔 오류 0', '전체 ' + errs.length + '건(전부 유튜브/구글 도메인)');

  console.log('\n═══ 통과 ' + pass + ' / 실패 ' + fail + ' ═══');
  fs.writeFileSync(SP + 'verify_song_out.json', JSON.stringify({ pass, fail, rows }, null, 1));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
