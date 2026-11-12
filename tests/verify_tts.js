require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 2-1 tts-proxy 경로 검증. 실DB 쓰기·실제 ElevenLabs·Cloudinary 호출 전부 차단.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };
// 아주 짧은 무음 mp3 (ID3 헤더만) — 재생은 실패해도 '요청 경로'만 보면 된다
const MP3 = Buffer.from('//uQZAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDA', 'base64');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const hits = []; const writes = []; const errs = [];
  let proxyMode = 'ok';   // ok | down | nokey
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  await page.route('**/functions/v1/tts-proxy', async r => {
    const b = JSON.parse(r.request().postData() || '{}');
    if (b.probe) { hits.push('probe'); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, server: proxyMode !== 'nokey', voices: ['XrExE9yKIg1WjnnlVkGX', 'EXAVITQu4vr4xnSDxMaL'] }) }); }
    hits.push('proxy:' + b.mode + ':' + b.voiceId + ':' + (b.wordMode ? 'word' : 'sent') + ':' + String(b.text).slice(0, 12));
    if (proxyMode === 'down') return r.fulfill({ status: 404, body: 'not found' });
    if (b.mode === 'timestamps') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ audio_base64: MP3.toString('base64'), alignment: { characters: String(b.text).split(''), character_start_times_seconds: String(b.text).split('').map((_, i) => i * .1), character_end_times_seconds: String(b.text).split('').map((_, i) => i * .1 + .1) } }) });
    }
    return r.fulfill({ status: 200, contentType: 'audio/mpeg', body: MP3 });
  });
  await page.route('**/api.elevenlabs.io/**', r => { hits.push('DIRECT ' + r.request().url().split('/v1/')[1].split('?')[0]); return r.fulfill({ status: 200, contentType: 'audio/mpeg', body: MP3 }); });
  await page.route('**/api.cloudinary.com/**', r => { hits.push('cloudinary'); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secure_url: 'https://example.invalid/x.mp3' }) }); });
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('file:///' + encodeURI(ROOT + '/index.html'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(4500);

  console.log('── 서버 키 있음 (tts-proxy 정상)');
  // 설정 행에 키가 있으면 부팅 때는 묻지 않는다 (아이 기기 콘솔에 404 를 남기지 않기 위해)
  const hasLocal = await page.evaluate(() => !!(_cache.settings.elevenlabs && _cache.settings.elevenlabs.key));
  say(hasLocal ? !hits.includes('probe') : hits.includes('probe'),
    hasLocal ? '설정 행에 키가 있으면 부팅 때 묻지 않음' : '키가 없으면 부팅 때 probe 1회 (크레딧 0)');
  // 설정 탭을 열면 확인한다
  await page.evaluate(async () => { show('s-teacher'); swTab('t-cfg'); await new Promise(r => setTimeout(r, 1200)); });
  say(hits.includes('probe'), '설정 탭을 열면 probe 1회 (크레딧 0)');

  let r = await page.evaluate(async () => {
    window._ttsVia = '';
    // tts_cache 조회가 캐시 적중하면 생성을 건너뛰므로, 없는 문장으로 부른다
    const txt = 'probe sentence ' + Date.now();
    try { await elevenGetAudioUrl(txt, elevenCfg(), false); } catch (e) { return { err: e.message, via: window._ttsVia }; }
    return { via: window._ttsVia, cfg: JSON.stringify(elevenCfg()).slice(0, 60) };
  });
  say(r.via === 'proxy', '문장 음성이 서버 경유로 생성됨', r.via + (r.err ? ' / ' + r.err : ''));
  say(hits.some(h => h.startsWith('proxy:audio:XrExE9yKIg1WjnnlVkGX')), '목소리는 Matilda 그대로 전달', hits.filter(h => h.startsWith('proxy:'))[0] || '');
  say(!hits.some(h => h.startsWith('DIRECT')), '브라우저가 api.elevenlabs.io 를 직접 부르지 않음');

  r = await page.evaluate(async () => {
    window._ttsVia = '';
    try { await elevenGetAudioUrl('probeword' + Date.now(), elevenCfg(), true); } catch (e) { return { err: e.message, via: window._ttsVia }; }
    return { via: window._ttsVia };
  });
  say(r.via === 'proxy' && hits.some(h => h.indexOf(':word:') >= 0), '단어 모드도 서버 경유 (wordMode 전달)');

  r = await page.evaluate(async () => {
    window._ttsVia = '';
    try { const d = await elevenGetPassageAudio('One. Two three. ' + Date.now(), elevenCfg(), 1); return { via: window._ttsVia, times: (d.times || []).length }; }
    catch (e) { return { err: e.message, via: window._ttsVia }; }
  });
  say(r.via === 'proxy' && r.times > 0, '본문 듣기(타임스탬프)도 서버 경유', 'times ' + r.times + (r.err ? ' / ' + r.err : ''));

  console.log('');
  console.log('── 함수가 내려갔을 때 (404)');
  proxyMode = 'down';
  r = await page.evaluate(async () => {
    _cache.settings.ttsProxy = true;              // 아직 '있다'고 알고 있는 상태
    window._ttsVia = '';
    const hasLocal = !!(_cache.settings.elevenlabs && _cache.settings.elevenlabs.key);
    try { await elevenGetAudioUrl('fallback ' + Date.now(), elevenCfg(), false); }
    catch (e) { return { err: e.message, via: window._ttsVia, hasLocal, flag: _cache.settings.ttsProxy }; }
    return { via: window._ttsVia, flag: _cache.settings.ttsProxy, hasLocal };
  });
  if (r.hasLocal) {
    say(r.via === 'local' && hits.some(h => h.startsWith('DIRECT')), '404 면 이 기기 키로 소리가 계속 난다', r.via);
    say(r.flag === false, '다음 호출부터는 바로 직호출 (헛걸음 안 함)');
  } else {
    // 2026-11-07 에 settings 의 elevenlabs 행을 지웠다 — 폴백할 키가 없는 것이 정상
    say(r.via !== 'local' && !hits.some(h => h.startsWith('DIRECT')), '폴백할 키가 없으면 직호출하지 않고 브라우저 음성으로 넘어간다', r.err || '');
  }

  console.log('\n── 서버 키가 없을 때 (probe server:false)');
  proxyMode = 'nokey';
  r = await page.evaluate(async () => {
    _cache.settings.ttsProxy = undefined;
    await ppProbeTtsProxy();
    return { flag: _cache.settings.ttsProxy, up: _cache.settings.ttsProxyUp, dot: (document.getElementById('eleven-status-dot') || {}).textContent };
  });
  say(r.flag === false && r.up === true, '함수는 살아 있고 키만 없음을 구분', 'ttsProxy=' + r.flag + ' / up=' + r.up);

  console.log('\n호출 기록: ' + [...new Set(hits)].join(' | '));
  console.log('실DB 쓰기 시도 ' + writes.length + '건(전부 차단) · 런타임 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
