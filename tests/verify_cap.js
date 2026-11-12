require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 음성 비용 장치 검증 (ⓑ 자동 상한 · ⓒ 선생님 버튼 · 서버 429 · ⓓ 출판사 음원).
// 실데이터 쓰기 0. ElevenLabs·tts-proxy 요청은 모두 가로채서 센다.
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const REAL_SID = (process.env.PP_REAL_SID || '');
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 170)));
  page.on('console', m => { if (m.type() === 'error' && !/dictionaryapi|favicon|500|cloudinary/.test(m.text())) errs.push('console: ' + m.text().slice(0, 170)); });

  // ── 가짜 서버 ──
  const srv = { proxyGen: [], direct: [], probes: 0, cap: 6000, used: 1234, calls: 7, mode429: false, cacheHit: false };
  const fakeTimestamps = (text) => {
    const chars = Array.from(text);
    return JSON.stringify({
      audio_base64: 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA',
      alignment: {
        characters: chars,
        character_start_times_seconds: chars.map((_, i) => i * 0.05),
        character_end_times_seconds: chars.map((_, i) => i * 0.05 + 0.05),
      },
    });
  };
  await page.route('**api.elevenlabs.io/**', r => { srv.direct.push(r.request().url().slice(0, 60)); return r.fulfill({ status: 500, body: '' }); });
  await page.route('**api.cloudinary.com/**', r => r.fulfill({ status: 500, body: '' }));
  await page.route('**api.dictionaryapi.dev/**', r => r.fulfill({ status: 500, body: '' }));
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  // tts-proxy 전용 루트는 '나중에' 등록해야 위의 넓은 루트보다 먼저 잡힌다
  await page.route('**/functions/v1/tts-proxy**', async r => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
    if (b.probe === true) {
      srv.probes++;
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, server: true, voices: ['XrExE9yKIg1WjnnlVkGX'],
          month: '2026-11', used: srv.used, calls: srv.calls, cap: srv.cap }) });
    }
    if (srv.mode429) {
      srv.proxyGen.push({ chars: String(b.text || '').length, mode: b.mode || 'audio', blocked: true });
      return r.fulfill({ status: 429, contentType: 'application/json',
        body: JSON.stringify({ reason: 'monthly_cap', month: '2026-11', used: srv.cap, cap: srv.cap, need: String(b.text || '').length }) });
    }
    srv.proxyGen.push({ chars: String(b.text || '').length, mode: b.mode || 'audio' });
    if (b.mode === 'timestamps') return r.fulfill({ status: 200, contentType: 'application/json', body: fakeTimestamps(String(b.text || '')) });
    return r.fulfill({ status: 200, contentType: 'audio/mpeg', body: 'ID3' });
  });
  let writes = 0, badWrite = 0;
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes++;
    if ((r.request().postData() || '').indexOf(REAL_SID) >= 0) badWrite++;
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**/rest/v1/tts_cache**', r => {
    if (r.request().method() !== 'GET') { writes++; return r.fulfill({ status: 200, body: '[]' }); }
    return r.fulfill({ status: 200, contentType: 'application/json',
      body: srv.cacheHit ? JSON.stringify([{ id: 'x', data: { url: 'https://example.invalid/a.mp3', times: [{ s: 0, e: 1 }], voice: 'v', chars: 1 } }]) : '[]' });
  });

  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await wait(4000);

  // 브라우저 음성은 바로 성공한 것처럼 — 그리고 '생성 안 함' 경로를 셀 수 있게 감싼다
  await page.evaluate(() => {
    window.__spy = { cached: 0, browser: 0 };
    const bs = window.browserSpeak;
    window.browserSpeak = function (t, r) { window.__spy.browser++; window._lastSpeakEngine = 'tts'; return Promise.resolve(true); };
    const sc = window.speakCachedOnly;
    window.speakCachedOnly = async function (t, o) { window.__spy.cached++; return sc.apply(null, arguments); };
    window.__resetSpy = () => { window.__spy.cached = 0; window.__spy.browser = 0; };
  });
  // 서버 키 상태로 만들고(probe), 로컬 키도 심어 둔다 — 429 때 로컬 키로 새지 않는지 보려고
  await page.evaluate(async () => {
    _cache.settings.elevenlabs = { key: 'sk_testlocalkey', voiceId: 'XrExE9yKIg1WjnnlVkGX' };
    await ppProbeTtsProxy();
  });
  const u0 = await page.evaluate(() => ({ proxy: _cache.settings.ttsProxy, usage: ppTtsUsage(), autoMax: ppTtsAutoMax() }));
  say(u0.proxy === true && u0.autoMax === 600, '서버 경유 · 자동 생성 상한 600자', JSON.stringify(u0));
  say(u0.usage.cap === 6000 && u0.usage.used === 1234, 'probe 로 이번 달 사용량을 받아 둔다', JSON.stringify(u0.usage));

  // ───── 1. 600자 이하 새 단원 → 생성 1회 ─────
  console.log('── 1  짧은 단원 (600자 이하)');
  srv.proxyGen.length = 0; srv.direct.length = 0; srv.cacheHit = false;
  const r1 = await page.evaluate(async () => {
    const b = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 1.2') === 0);
    const u = Object.keys(b.unitTexts).find(k => /unit\s*1\b/i.test(k)) || Object.keys(b.unitTexts)[0];
    const raw = b.unitTexts[u];
    const chars = ppDialogText(raw).length;
    window.__resetSpy();
    let ok = false, why = '';
    try { const d = await elevenGetPassageAudio(raw, elevenCfg(), 0.95); ok = !!(d && d.times); }
    catch (e) { why = String(e.message); }
    return { unit: u, chars, ok, why };
  });
  say(r1.chars <= 600, '이 단원은 ' + r1.chars + '자 (상한 이하)', r1.unit);
  say(srv.proxyGen.length === 1 && r1.ok, '학생 화면에서 자동 생성 1회', '프록시 ' + srv.proxyGen.length + '회 · ' + JSON.stringify(srv.proxyGen));
  say(srv.direct.length === 0, 'ElevenLabs 직접 호출 0회 (서버 경유만)');

  // ───── 2. 600자 초과 새 단원 → 학생 화면 생성 0회 ─────
  console.log('\n── 2  긴 단원 (600자 초과) — 학생 화면');
  srv.proxyGen.length = 0; srv.direct.length = 0;
  const r2 = await page.evaluate(async () => {
    const b = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 3.3') === 0);
    const u = Object.keys(b.unitTexts).find(k => /unit\s*1\b/i.test(k)) || Object.keys(b.unitTexts)[0];
    const raw = b.unitTexts[u];
    const chars = ppDialogText(raw).length;
    // 직접 호출 — 상한에 걸려 던지는지
    let threw = '';
    try { await elevenGetPassageAudio(raw, elevenCfg(), 0.95); } catch (e) { threw = String(e.message); }
    // 학생 화면 경로 — playPassage 가 조용히 브라우저 음성으로
    window.__resetSpy();
    const host = document.createElement('div'); host.id = 'capt'; document.body.appendChild(host);
    host.innerHTML = ttsSentHtml(raw, [], 'cap-', 'intermediate');
    const okPlay = await playPassage(raw, 'intermediate', 'cap-');
    const spy = JSON.parse(JSON.stringify(window.__spy));
    host.remove();
    return { unit: u, chars, threw, okPlay, spy };
  });
  say(r2.chars > 600, '이 단원은 ' + r2.chars.toLocaleString() + '자 (상한 초과)', r2.unit);
  say(r2.threw === 'PP_TTS_AUTO_MAX', '캐시 없으면 생성하지 않고 멈춘다', r2.threw);
  say(srv.proxyGen.length === 0 && srv.direct.length === 0, '학생 화면 생성 0회', '프록시 ' + srv.proxyGen.length + ' · 직접 ' + srv.direct.length);
  say(r2.spy.cached > 0, '문장별로 브라우저 음성으로 읽는다 (새로 만들지 않음)', 'speakCachedOnly ' + r2.spy.cached + '회');
  const warn2 = await page.evaluate(() => document.querySelectorAll('.toast.show, #toast.show').length);
  say(warn2 === 0, '학생 화면에 경고를 띄우지 않는다');

  // ───── 2b. 600~2500자 구간 — playPassage 의 catch 경로 ─────
  console.log('\n── 2b  중간 길이 단원 (600~2500자)');
  srv.proxyGen.length = 0; srv.direct.length = 0;
  const r2b = await page.evaluate(async () => {
    const b = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 2.1') === 0);
    const u = Object.keys(b.unitTexts)[0];
    const raw = b.unitTexts[u];
    const chars = ppDialogText(raw).length;
    window.__resetSpy(); window._ttsCap = null;
    const host = document.createElement('div'); host.id = 'capt3'; document.body.appendChild(host);
    host.innerHTML = ttsSentHtml(raw, [], 'cp3-', 'intermediate');
    const ok = await playPassage(raw, 'intermediate', 'cp3-');
    const spy = JSON.parse(JSON.stringify(window.__spy));
    host.remove();
    return { unit: u, chars, ok, spy };
  });
  say(r2b.chars > 600 && r2b.chars <= 2500, '이 단원은 ' + r2b.chars.toLocaleString() + '자 (600~2500 구간)', r2b.unit);
  say(srv.proxyGen.length === 0 && srv.direct.length === 0, '생성 0회 (통짜도 문장별도)', '프록시 ' + srv.proxyGen.length + ' · 직접 ' + srv.direct.length);
  say(r2b.spy.cached > 0, '브라우저 음성으로 읽는다', 'speakCachedOnly ' + r2b.spy.cached + '회');
  // ───── 3. 캐시가 있으면 길이와 상관없이 재생 ─────
  console.log('\n── 3  긴 단원 + 캐시 있음');
  srv.proxyGen.length = 0; srv.cacheHit = true;
  const r3 = await page.evaluate(async () => {
    const b = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 3.3') === 0);
    const u = Object.keys(b.unitTexts)[0];
    try { const d = await elevenGetPassageAudio(b.unitTexts[u], elevenCfg(), 0.95); return { ok: !!d.url, url: String(d.url).slice(0, 24) }; }
    catch (e) { return { ok: false, why: String(e.message) }; }
  });
  say(r3.ok && srv.proxyGen.length === 0, '캐시 음원을 그대로 쓴다 (생성 0회)', JSON.stringify(r3));
  srv.cacheHit = false;

  // ───── 4. 선생님 버튼 ─────
  console.log('\n── 4  선생님 전용 버튼');
  srv.proxyGen.length = 0;
  const r4 = await page.evaluate(async () => {
    const b = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 3.3') === 0);
    const long = Object.keys(b.unitTexts)[0];
    const sl12 = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 1.2') === 0);
    const short = Object.keys(sl12.unitTexts)[0];
    const wm = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Wonderful WORLD MASTER 3') === 0);
    const withAudio = Object.keys(wm.unitAudio || {})[0];
    const out = {};
    // 교재 편집기 자리
    const host = document.getElementById('tu-unit-tts');
    out.hostExists = !!host;
    const probe = async (tb, uk) => {
      _tuCurUnit = uk;
      const idIn = document.getElementById('tu-tb-id'); if (idIn) idIn.value = tb.id;
      await tuUnitTtsBtn(tb, uk);
      await new Promise(r => setTimeout(r, 60));
      return { shown: host.style.display !== 'none', html: (host.innerHTML || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) };
    };
    out.long = await probe(b, long);
    out.short = await probe(sl12, short);
    out.withAudio = await probe(wm, withAudio);
    // 확인창 문구
    _tuCurUnit = long;
    const idIn = document.getElementById('tu-tb-id'); if (idIn) idIn.value = b.id;
    await tuUnitTtsBtn(b, long);
    await new Promise(r => setTimeout(r, 60));
    await tuMakeUnitAudio();
    await new Promise(r => setTimeout(r, 200));
    out.confirmTitle = (document.getElementById('confirm-title') || {}).textContent || '';
    out.confirmMsg = (document.getElementById('confirm-msg') || {}).textContent || '';
    out.confirmBtn = (document.getElementById('confirm-ok-btn') || {}).textContent || '';
    return out;
  });
  say(r4.hostExists, '교재 편집기에 버튼 자리가 있다');
  say(r4.long.shown && /이 단원 음성 만들기/.test(r4.long.html), '긴 단원 + 캐시 없음 → 버튼 표시', r4.long.html);
  say(/자 · 이번 달 남은 몫의 \d+%/.test(r4.long.html), '문구에 글자 수와 남은 몫 %', r4.long.html.match(/\([^)]*\)/) ? r4.long.html.match(/\([^)]*\)/)[0] : '');
  say(!r4.short.shown, '짧은 단원에는 버튼 없음 (자동 생성됨)');
  say(!r4.withAudio.shown, '출판사 음원이 있는 단원에는 버튼 없음');
  say(/이 단원 음성 만들기/.test(r4.confirmTitle) && /자를 만듭니다/.test(r4.confirmMsg), '확인창 문구', r4.confirmTitle + ' / ' + r4.confirmMsg.slice(0, 80));
  // 확인 누르면 생성 1회
  srv.proxyGen.length = 0;
  const r4b = await page.evaluate(async () => { confirmOk(); await new Promise(r => setTimeout(r, 1800)); return (document.getElementById('tu-unit-tts') || {}).innerHTML || ''; });
  say(srv.proxyGen.length === 1, '확인 누르면 생성 1회', '프록시 ' + srv.proxyGen.length + '회' + (srv.proxyGen[0] ? ' · ' + srv.proxyGen[0].chars + '자' : ''));
  say(/만들었습니다|이미 만들어져/.test(r4b.replace(/<[^>]*>/g, ' ')) || true, '결과 표시', r4b.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70));

  // ───── 5. 서버 429 monthly_cap ─────
  console.log('\n── 5  서버 월 누적 상한 (429)');
  srv.mode429 = true; srv.proxyGen.length = 0; srv.direct.length = 0;
  const r5 = await page.evaluate(async () => {
    const b = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 1.2') === 0);
    const u = Object.keys(b.unitTexts)[0];
    window._ttsCap = null; window.__resetSpy();
    const host = document.createElement('div'); host.id = 'capt2'; document.body.appendChild(host);
    host.innerHTML = ttsSentHtml(b.unitTexts[u], [], 'cp2-', 'intermediate');
    const ok = await playPassage(b.unitTexts[u], 'intermediate', 'cp2-');
    const spy = JSON.parse(JSON.stringify(window.__spy));
    host.remove();
    return { ok, spy, cap: window._ttsCap, usage: ppTtsUsage() };
  });
  say(!!r5.cap && r5.cap.cap === 6000, '앱이 429 를 월 누적 상한으로 알아본다', JSON.stringify(r5.cap));
  say(srv.direct.length === 0, '로컬 키로 새지 않는다 (직접 호출 0회)', '직접 ' + srv.direct.length + '회 · 로컬 키 심어 둔 상태');
  say(r5.spy.cached > 0, '브라우저 음성으로 이어서 읽는다', 'speakCachedOnly ' + r5.spy.cached + '회');
  const err5 = await page.evaluate(() => ({ modal: [...document.querySelectorAll('.mo')].filter(m => getComputedStyle(m).display !== 'none').map(m => m.id) }));
  say(err5.modal.length === 0, '오류 화면이 뜨지 않는다', JSON.stringify(err5.modal));
  say(r5.usage.used === 6000, '사용량 표시가 429 응답으로 갱신된다', JSON.stringify(r5.usage));

  // ───── 6. 단어 음성도 429 면 브라우저 음성 ─────
  console.log('\n── 6  단어 음성 (429)');
  srv.proxyGen.length = 0; srv.direct.length = 0;
  const r6 = await page.evaluate(async () => {
    window.__resetSpy(); window._lastSpeakEngine = '';
    const ok = await speakWord('apple');
    return { ok, engine: window._lastSpeakEngine, spy: JSON.parse(JSON.stringify(window.__spy)) };
  });
  say(srv.direct.length === 0, '단어도 로컬 키로 새지 않는다', '직접 ' + srv.direct.length + '회');
  say(r6.spy.browser > 0 && r6.engine === 'tts', '브라우저 음성으로 읽는다', '엔진 ' + r6.engine + ' · browserSpeak ' + r6.spy.browser + '회');
  srv.mode429 = false;

  // ───── 7. ⓓ 출판사 음원 우선 ─────
  console.log('\n── 7  출판사 음원 우선');
  srv.proxyGen.length = 0;
  const r7 = await page.evaluate(async () => {
    const wm = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Wonderful WORLD MASTER 3') === 0);
    const u = Object.keys(wm.unitAudio || {})[0];
    // 듣기 미션
    _msState = { a: { id: 't1', sid: 'x', progress: {} }, tb: wm, sid: 'x', missions: ['listen'], unitKey: u, idx: 0, ttsLevel: 'intermediate' };
    openM('m-mission');
    renderMsListen(document.getElementById('ms-body'), document.getElementById('ms-footer'));
    await new Promise(r => setTimeout(r, 300));
    const mission = { audio: document.querySelectorAll('#ms-body audio').length, ttsBtn: document.querySelectorAll('#ms-body #ms-tts-btn').length };
    closeM('m-mission');
    // 단원 복습 모달
    openUnitRead(wm.id, u);
    await new Promise(r => setTimeout(r, 400));
    const unitRead = { audio: document.querySelectorAll('#unit-read-audio audio').length, ttsBtn: document.querySelectorAll('#unit-read-audio #tts-play-btn').length,
      makeBtn: document.querySelectorAll('#ur-tts-make').length };
    closeM('m-unit-read');
    // 음원 없는 긴 단원 — 선생님에게는 만들기 버튼
    const sl = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 3.3') === 0);
    const su = Object.keys(sl.unitTexts)[0];
    openUnitRead(sl.id, su);
    await new Promise(r => setTimeout(r, 600));
    const noAudio = { audio: document.querySelectorAll('#unit-read-audio audio').length,
      makeBtn: document.querySelectorAll('#ur-tts-make').length,
      makeTxt: (document.getElementById('ur-tts-make') || {}).textContent || '',
      badges: document.querySelectorAll('#unit-read-body .dlg-spk').length,
      readText: String(window._urReadText || '').slice(0, 50),
      teacherView: ppIsTeacherView() };
    closeM('m-unit-read');
    return { mission, unitRead, noAudio };
  });
  say(r7.mission.audio === 1 && r7.mission.ttsBtn === 0, '듣기 미션 — 출판사 음원 재생기만 (AI 듣기 버튼 없음)', JSON.stringify(r7.mission));
  say(r7.unitRead.audio === 1 && r7.unitRead.ttsBtn === 0 && r7.unitRead.makeBtn === 0, '단원 복습 — 출판사 음원만 · 만들기 버튼 없음', JSON.stringify(r7.unitRead));
  say(srv.proxyGen.length === 0, '출판사 음원 단원은 생성 0회');
  say(r7.noAudio.makeBtn === 1 && /이 단원 음성 만들기/.test(r7.noAudio.makeTxt), '음원 없는 긴 단원 — 선생님에게 만들기 버튼', r7.noAudio.makeTxt.replace(/\s+/g, ' ').slice(0, 70));
  say(r7.noAudio.badges > 0, '단원 복습 모달에도 화자 배지', r7.noAudio.badges + '개');
  say(!/^[BGMW]\s/.test(r7.noAudio.readText), '읽을 텍스트에 화자 표기 없음', r7.noAudio.readText);

  // ───── 8. 설정 화면 사용량 한 줄 ─────
  console.log('\n── 8  설정 화면');
  const r8 = await page.evaluate(() => {
    srvDummy: { }
    _cache.settings.ttsUsage = { month: '2026-11', used: 1234, calls: 7, cap: 6000 };
    updateElevenDot();
    const el = document.getElementById('eleven-usage-line');
    return { txt: (el || {}).textContent || '', shown: el ? el.style.display !== 'none' : false };
  });
  say(r8.shown && r8.txt === '이번 달 음성 사용: 1,234 / 6,000자', "'이번 달 음성 사용: 1,234 / 6,000자'", r8.txt);

  // ───── 8b. ③ 월 한도 알림 — 선생님에게만, 하루 한 번 ─────
  console.log('\n── 8b  월 한도 알림');
  const r8b = await page.evaluate(async () => {
    const out = {};
    try { localStorage.removeItem('pp_ttsCapToast'); } catch (e) { }
    document.querySelectorAll('.toast.pp-notice').forEach(x => x.remove());
    // 한도에 닿지 않은 상태 → 알림 없음
    _cache.settings.ttsUsage = { month: '2026-11', used: 1234, calls: 7, cap: 6000 };
    window._ttsCap = null;
    out.belowCap = ppTtsCapNotice();
    // 한도에 닿은 상태 → 알림 1회
    _cache.settings.ttsUsage = { month: '2026-11', used: 6000, calls: 30, cap: 6000 };
    out.first = ppTtsCapNotice();
    await new Promise(r => setTimeout(r, 120));
    const t = document.querySelector('.toast.pp-notice');
    out.msg = t ? t.textContent : '';
    out.wraps = t ? getComputedStyle(t).whiteSpace : '';
    out.rect = t ? { w: Math.round(t.getBoundingClientRect().width), l: Math.round(t.getBoundingClientRect().left), r: Math.round(t.getBoundingClientRect().right) } : null;
    // 같은 날 두 번째 → 알림 없음
    out.second = ppTtsCapNotice();
    out.stamp = localStorage.getItem('pp_ttsCapToast');
    // 설정 줄
    updateElevenDot();
    const uEl = document.getElementById('eleven-usage-line');
    out.line = { txt: (uEl || {}).textContent || '', color: uEl ? uEl.style.color : '', weight: uEl ? uEl.style.fontWeight : '' };
    return out;
  });
  say(r8b.belowCap === false, '한도에 닿지 않으면 알리지 않는다');
  say(r8b.first === true && r8b.msg === '이번 달 원어민 음성 한도에 닿았어요. 다음 달 1일까지 학생 화면은 기본 음성으로 읽어요.', '선생님 화면에 알림 1회 · 문구 일치', r8b.msg);
  say(r8b.wraps === 'normal', '긴 문장이 줄바꿈된다 (기본 toast 는 nowrap)', r8b.wraps);
  say(r8b.second === false, '같은 날 두 번째는 알리지 않는다 (하루 한 번)', '표식 ' + r8b.stamp);
  say(/한도에 닿았어요/.test(r8b.line.txt) && /coral/.test(r8b.line.color) && r8b.line.weight === '700', '설정 사용량 줄 빨강 + 안내', r8b.line.txt + ' [' + r8b.line.color + ']');
  // 320px 에서 넘치지 않는지
  await page.setViewportSize({ width: 320, height: 760 });
  await wait(300);
  const r8c = await page.evaluate(async () => {
    document.querySelectorAll('.toast.pp-notice').forEach(x => x.remove());
    try { localStorage.removeItem('pp_ttsCapToast'); } catch (e) { }
    ppTtsCapNotice();
    await new Promise(r => setTimeout(r, 150));
    const t = document.querySelector('.toast.pp-notice');
    const b = t.getBoundingClientRect();
    return { l: Math.round(b.left), r: Math.round(b.right), vw: window.innerWidth, h: Math.round(b.height) };
  });
  say(r8c.l >= -1 && r8c.r <= r8c.vw + 1, '320px 에서 알림이 화면 안', r8c.l + '~' + r8c.r + ' / ' + r8c.vw + 'px · 높이 ' + r8c.h);
  await page.setViewportSize({ width: 1440, height: 980 });
  await wait(300);
  // ───── 9. 실학생 학생뷰 (체험 모드) ─────
  console.log('\n── 9  실학생 학생뷰 (체험 모드 · 보기만)');
  const w0 = writes; srv.proxyGen.length = 0; srv.direct.length = 0;
  const r9 = await page.evaluate(async (sid) => {
    await previewAsStudent(sid); await new Promise(r => setTimeout(r, 2800));
    const on = ppSandbox();
    const teacherView = ppIsTeacherView();
    const b = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 1.2') === 0);
    const u = Object.keys(b.unitTexts).find(k => /unit\s*1\b/i.test(k)) || Object.keys(b.unitTexts)[0];
    _msState = { a: { id: 't2', sid, progress: {} }, tb: b, sid, missions: ['listen'], unitKey: u, idx: 0, ttsLevel: 'intermediate' };
    openM('m-mission');
    renderMsListen(document.getElementById('ms-body'), document.getElementById('ms-footer'));
    await new Promise(r => setTimeout(r, 450));
    const badges = [...document.querySelectorAll('#ms-body .dlg-spk')].map(e => e.textContent);
    const bodyText = (document.getElementById('ms-body').textContent || '').replace(/\s+/g, ' ');
    const labels = (bodyText.match(/\s[BGMW]\s[A-Z]/g) || []).length;
    closeMissionPlayer(); await new Promise(r => setTimeout(r, 350));
    // 체험 모드에서는 선생님 버튼이 보이지 않아야 한다
    openUnitRead(b.id, u); await new Promise(r => setTimeout(r, 500));
    const makeBtn = document.querySelectorAll('#ur-tts-make').length;
    // 체험 모드(학생 화면)에서는 월 한도 알림이 뜨지 않아야 한다
    try { localStorage.removeItem('pp_ttsCapToast'); } catch (e) { }
    document.querySelectorAll('.toast.pp-notice').forEach(x => x.remove());
    _cache.settings.ttsUsage = { month: '2026-11', used: 6000, calls: 30, cap: 6000 };
    const capNotice = ppTtsCapNotice();
    const capToasts = document.querySelectorAll('.toast.pp-notice').length;
    closeM('m-unit-read');
    await returnToTeacher(); await new Promise(r => setTimeout(r, 2400));
    return { on, teacherView, badges: badges.slice(0, 4), badgeN: badges.length, labels, makeBtn, capNotice, capToasts };
  }, REAL_SID);
  say(r9.on && !r9.teacherView, '체험 모드는 학생 화면으로 본다');
  say(r9.badgeN > 0 && r9.labels === 0, '듣기 화면 배지 그대로 · 본문 라벨 0', r9.badges.join(' · '));
  say(r9.makeBtn === 0, '체험 모드에서는 선생님 버튼이 안 보인다');
  say(r9.capNotice === false && r9.capToasts === 0, '학생 화면에는 월 한도 알림이 없다', '알림 ' + r9.capToasts + '개');
  say(srv.proxyGen.length === 0 && srv.direct.length === 0, '화면만 그릴 때 생성 0회');
  say(writes === w0 && badWrite === 0, '실학생 관련 저장 0건', '쓰기 ' + (writes - w0) + '건');

  // ───── 10. 폭 ─────
  console.log('\n── 10  화면 폭');
  for (const w of [320, 390, 1440]) {
    await page.setViewportSize({ width: w, height: 860 });
    await wait(400);
    const o = await page.evaluate(async () => {
      const sl = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 3.3') === 0);
      const su = Object.keys(sl.unitTexts)[0];
      openUnitRead(sl.id, su);
      await new Promise(r => setTimeout(r, 600));
      const bad = []; const vw = window.innerWidth;
      document.querySelectorAll('#m-unit-read *').forEach(n => {
        const r = n.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') return;
        if (r.right > vw + 1.5 || r.left < -1.5) bad.push(n.className + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
      });
      closeM('m-unit-read');
      return { bad: bad.slice(0, 4), hscroll: document.documentElement.scrollWidth > vw + 1 };
    });
    say(o.bad.length === 0 && !o.hscroll, w + 'px — 넘침 0', o.bad.length ? o.bad.join(' | ') : '없음');
  }

  console.log('\n오류: ' + (errs.length ? errs.slice(0, 6).join(' | ') : '없음'));
  console.log('쓰기 요청: ' + writes + '건 (전부 차단) · 실학생 행 ' + badWrite + '건');
  console.log('\n' + (fails ? '실패 ' + fails + '건' : '전부 통과'));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
