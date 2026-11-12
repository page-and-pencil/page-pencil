require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 대화문 화자 표기 검증. 실데이터는 읽기만(저장 0), 더미 교재는 끝나면 휴지통.
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const REAL_SID = (process.env.PP_REAL_SID || '');           // 실학생 — 보기만
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1], K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];
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
  page.on('console', m => { if (m.type() === 'error' && !/dictionaryapi|favicon|WebAudio|decodeAudio/.test(m.text())) errs.push('console: ' + m.text().slice(0, 170)); });

  // ElevenLabs 생성 호출 감시 — 호출 수와 보낸 글자 수를 센다
  const el = { calls: [] };
  const grab = r => {
    let body = '';
    try { body = r.request().postData() || ''; } catch (e) { }
    let txt = '';
    try { txt = (JSON.parse(body) || {}).text || ''; } catch (e) { txt = body.slice(0, 200); }
    el.calls.push({ url: r.request().url().slice(0, 80), chars: txt.length, text: txt });
    return r.fulfill({ status: 500, body: '' });
  };
  await page.route('**api.elevenlabs.io/**', grab);
  await page.route('**/functions/v1/tts-proxy**', grab);
  await page.route('**api.cloudinary.com/**', r => r.fulfill({ status: 500, body: '' }));
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  let cacheHit = false, cacheGets = 0;
  let writes = 0, badWrite = 0;
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes++;
    const b = r.request().postData() || '';
    if (b.indexOf(REAL_SID) >= 0) badWrite++;
    return r.fulfill({ status: 200, body: '[]' });     // 쓰기는 모두 막는다
  });
  // tts_cache 전용 루트는 '나중에' 등록해야 위의 넓은 루트보다 먼저 잡힌다
  await page.route('**/rest/v1/tts_cache**', r => {
    cacheGets++;
    if (r.request().method() !== 'GET') return r.fulfill({ status: 200, body: '[]' });
    return r.fulfill({ status: 200, contentType: 'application/json',
      body: cacheHit ? JSON.stringify([{ id: 'x', data: { url: 'https://example.invalid/a.mp3', times: [{ s: 0, e: 1 }], voice: 'v', chars: 1 } }]) : '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await wait(4000);

  // ───── 1. 범위 점검 (캐시로만 계산) ─────
  console.log('── 1  범위 점검');
  const r1 = await page.evaluate(() => {
    const books = {}, near = [], fmtCnt = { 1: 0, 2: 0, 12: 0 };
    let units = 0;
    (_cache.globalTextbooks || []).forEach(b => {
      if (!b || b._deleted) return;
      const maps = [['unitTexts', b.unitTexts || {}], ['unitPatterns', b.unitPatterns || {}]];
      maps.forEach(([which, m]) => {
        Object.entries(m).forEach(([u, raw]) => {
          const t = String(raw || '').trim(); if (!t) return;
          const p = ppParseDialog(t);
          if (p.dialog) {
            units++; fmtCnt[p.fmt] = (fmtCnt[p.fmt] || 0) + 1;
            const key = b.title || b.id;
            books[key] = books[key] || { fmt: new Set(), units: 0, kinds: new Set(), which: new Set() };
            books[key].units++; books[key].fmt.add(p.fmt); books[key].which.add(which);
            p.kinds.forEach(k => books[key].kinds.add(k));
          } else if (p.labeled >= 1) {
            near.push({ book: b.title || b.id, unit: u, which: which, kinds: p.kinds.join(','), labeled: p.labeled,
              why: (p.kinds.length < 2 ? '라벨 1종류' : '라벨 줄 ' + p.labeled + '개(3개 미만)'),
              head: t.replace(/\s+/g, ' ').slice(0, 60) });
          }
        });
      });
    });
    const list = Object.entries(books).map(([title, v]) => ({ title, units: v.units, fmt: [...v.fmt].join('+'), kinds: [...v.kinds].sort().join(''), which: [...v.which].join('+') }))
      .sort((a, b) => b.units - a.units);
    // 요청받은 교재 확인
    const probe = {};
    ['Smart Listening 1.1', 'Smart Listening 1.2', 'Smart Reading 3.3', 'Hands on History 2', 'Wonderful WORLD MASTER 3'].forEach(t => {
      const b = (_cache.globalTextbooks || []).find(x => (x.title || '') === t) || (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf(t) === 0);
      if (!b) { probe[t] = { found: false }; return; }
      const ks = Object.keys(b.unitTexts || {});
      let dlg = 0, plain = 0;
      ks.forEach(u => { (ppParseDialog(b.unitTexts[u]).dialog ? dlg++ : plain++); });
      probe[t] = { found: true, units: ks.length, dlg, plain, hasAudio: Object.keys(b.unitAudio || {}).length };
    });
    const s11=(_cache.globalTextbooks||[]).find(x=>(x.title||'').indexOf('Smart Listening 1.1')===0);
    if(s11){const k=Object.keys(s11.unitTexts||{})[0];const t11=String((s11.unitTexts||{})[k]||'');probe._s11={unit:k,head:t11.split(String.fromCharCode(10)).join(' / ').slice(0,150),parse:ppParseDialog(t11)};}
    return { bookCount: list.length, units, fmtCnt, list: list.slice(0, 20), near: near.slice(0, 20), nearAll: near.length, probe };
  });
  console.log('     대화문 교재 ' + r1.bookCount + '권 · 단원 ' + r1.units + '개');
  console.log('     형식별: 형식1(B/G/M/W) ' + (r1.fmtCnt[1] || 0) + '단원 · 형식2(이름:) ' + (r1.fmtCnt[2] || 0) + '단원 · 섞임 ' + (r1.fmtCnt[12] || 0) + '단원');
  r1.list.forEach(x => console.log('       ' + x.title + ' — ' + x.units + '단원 · 형식' + x.fmt + ' · 라벨 ' + x.kinds + ' · ' + x.which));
  console.log('     오탐 의심(걸릴 뻔한 것) ' + r1.nearAll + '건' + (r1.nearAll ? ':' : ''));
  r1.near.slice(0, 8).forEach(x => console.log('       ' + x.book + ' / ' + x.unit + ' [' + x.which + '] ' + x.why + ' (' + x.kinds + ') — "' + x.head + '"'));
  Object.entries(r1.probe).forEach(([t, v]) => console.log('     [' + t + '] ' + (v.found ? ('단원 ' + v.units + ' · 대화문 ' + v.dlg + ' · 보통 ' + v.plain + ' · unitAudio ' + v.hasAudio) : '교재 없음')));
  say(r1.units > 0, '대화문으로 판정된 단원이 있다', r1.units + '단원');
  say(r1.probe['Hands on History 2'].found ? r1.probe['Hands on History 2'].dlg === 0 : true, 'Hands on History 2 — 대화문 0 (오탐 없음)', JSON.stringify(r1.probe['Hands on History 2']));
  say(r1.probe['Wonderful WORLD MASTER 3'].found ? r1.probe['Wonderful WORLD MASTER 3'].dlg === 0 : true, 'Wonderful WORLD MASTER 3 — 대화문 0 (오탐 없음)', JSON.stringify(r1.probe['Wonderful WORLD MASTER 3']));
  say(r1.probe['Smart Listening 1.2'].found && r1.probe['Smart Listening 1.2'].dlg > 0, 'Smart Listening 1.2 — 대화문으로 잡힌다', JSON.stringify(r1.probe['Smart Listening 1.2']));
  if(r1.probe._s11)console.log('     → 1.1 표본 [' + r1.probe._s11.unit + '] "' + r1.probe._s11.head + '"  (라벨 ' + r1.probe._s11.parse.labeled + '줄 / ' + r1.probe._s11.parse.kinds.length + '종류)');
  console.log('     → Smart Listening 1.1: ' + (r1.probe['Smart Listening 1.1'].found ? ('대화문 ' + r1.probe['Smart Listening 1.1'].dlg + ' / ' + r1.probe['Smart Listening 1.1'].units + '단원') : '교재 없음'));

  // ───── 2. TTS 로 가는 텍스트 · 화면 배지 ─────
  console.log('\n── 2  TTS 텍스트와 화면 배지');
  const r2 = await page.evaluate(() => {
    const pick = (title, unitHint) => {
      const b = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf(title) === 0);
      if (!b) return null;
      const ks = Object.keys(b.unitTexts || {});
      const u = ks.find(k => new RegExp('unit\\s*' + unitHint + '\\b', 'i').test(k)) || ks[0];
      return { book: b.title, unit: u, raw: b.unitTexts[u] };
    };
    const out = [];
    [['Smart Listening 1.2', 1], ['Smart Reading 3.3', 4], ['Smart Reading 3.3', 15]].forEach(([t, n]) => {
      const x = pick(t, n); if (!x) return;
      const p = ppParseDialog(x.raw);
      const tts = ppDialogText(x.raw);
      // 화면
      const host = document.createElement('div'); host.id = 'dlgtest'; document.body.appendChild(host);
      host.innerHTML = ttsSentHtml(x.raw, [], 'dt-', 'intermediate');
      const badges = [...host.querySelectorAll('.dlg-spk')].map(e => e.textContent);
      const spans = [...host.querySelectorAll('[id^="dt-"]')].map(e => e.textContent);
      // 하이라이트 위치: 라벨 제거 전/후 같은 문장을 가리키는가
      const oldSents = ttsSplitSents(x.raw);
      const newSents = ttsSplitSents(tts);
      const sameSeq = oldSents.length === newSents.length
        && oldSents.every((s, i) => ppStripSpeaker(s).text === newSents[i]);
      const spanOk = spans.length === newSents.length && spans.every((s, i) => s.trim() === newSents[i]);
      host.remove();
      out.push({ book: x.book, unit: x.unit, dialog: p.dialog, fmt: p.fmt, kinds: p.kinds.join(','),
        rawHead: String(x.raw).replace(/\s+/g, ' ').slice(0, 72),
        ttsHead: tts.replace(/\s+/g, ' ').slice(0, 72),
        labelsInTts: (tts.match(/(^|\n)\s*(?:[BGMW]\s+[A-Z]|[A-Z][a-zA-Z]{1,11}:\s)/g) || []).length,
        badges: badges.slice(0, 4), badgeN: badges.length, sents: newSents.length, sameSeq, spanOk,
        chars: { raw: String(x.raw).length, tts: tts.length } });
    });
    return out;
  });
  r2.forEach(x => {
    console.log('     [' + x.book + ' / ' + x.unit + ']');
    console.log('       전: ' + x.rawHead);
    console.log('       후: ' + x.ttsHead);
    console.log('       배지 ' + x.badgeN + '개: ' + x.badges.join(' · ') + ' · 문장 ' + x.sents + '개 · 글자 ' + x.chars.raw + '→' + x.chars.tts);
    say(x.dialog, x.book + ' ' + x.unit + ' — 대화문으로 판정', '형식' + x.fmt + ' 라벨=' + x.kinds);
    say(x.labelsInTts === 0, x.book + ' ' + x.unit + ' — TTS 텍스트에 화자 표기 0개', x.labelsInTts + '개');
    say(x.badgeN > 0, x.book + ' ' + x.unit + ' — 화면에 배지', x.badges.join(' · '));
    say(x.sameSeq, x.book + ' ' + x.unit + ' — 문장 번호가 라벨 제거 전과 같은 문장을 가리킨다');
    say(x.spanOk, x.book + ' ' + x.unit + ' — 화면 문장 span 과 음성 문장 순서가 같다');
  });

  // ───── 3. 오탐 0 — 원문 그대로 ─────
  console.log('\n── 3  오탐 (원문 그대로여야 한다)');
  const r3 = await page.evaluate(() => {
    const out = [];
    ['Hands on History 2', 'Wonderful WORLD MASTER 3'].forEach(t => {
      const b = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf(t) === 0);
      if (!b) { out.push({ title: t, found: false }); return; }
      let changed = 0, n = 0, prosCons = 0;
      Object.entries(b.unitTexts || {}).forEach(([u, raw]) => {
        n++;
        if (ppDialogText(raw) !== raw) changed++;
        if (/(^|\n)\s*(Pros|Cons|Dr|Dear)\b/.test(String(raw))) prosCons++;
      });
      out.push({ title: b.title, found: true, n, changed, prosCons });
    });
    return out;
  });
  r3.forEach(x => {
    if (!x.found) { console.log('     [' + x.title + '] 교재 없음'); return; }
    say(x.changed === 0, x.title + ' — ' + x.n + '단원 모두 원문 그대로 (Pros:/Cons:/Dr/Dear 있는 단원 ' + x.prosCons + '개)', '바뀐 단원 ' + x.changed + '개');
  });

  // ───── 4. 문장 학습 — 타일·스펠·빈칸에 라벨 0 ─────
  console.log('\n── 4  문장 학습');
  const r4 = await page.evaluate(() => {
    const b = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 1.2') === 0);
    if (!b) return { found: false };
    const ks = Object.keys(b.unitTexts || {});
    const u = ks.find(k => /unit\s*1\b/i.test(k)) || ks[0];
    const lines = sentLines(b, u);
    const cloze = sentClozeWords(b, u);
    const hasLabel = s => /(^|\s)[BGMW]\s+[A-Z]/.test(s) || /^[A-Z][a-zA-Z]{1,11}:/.test(s);
    return { found: true, book: b.title, unit: u, n: lines.length,
      sample: lines.slice(0, 3).map(r => ({ en: r.en, spk: r.spk, label: r.label })),
      badLines: lines.filter(r => hasLabel(r.en)).map(r => r.en).slice(0, 4),
      tiles: lines.slice(0, 3).map(r => r.en.split(/\s+/)),
      hints: lines.slice(0, 2).map(r => sentFirstHint(r.en)),
      cloze: cloze.slice(0, 8), badCloze: cloze.filter(w => /^[BGMW]$/.test(w)),
      withSpk: lines.filter(r => r.spk).length };
  });
  if (!r4.found) say(false, 'Smart Listening 1.2 를 찾지 못했다');
  else {
    console.log('     [' + r4.book + ' / ' + r4.unit + '] 문장 ' + r4.n + '개 · 화자 붙은 문장 ' + r4.withSpk + '개');
    r4.sample.forEach(s => console.log('       ' + (s.label ? '[' + s.label + '] ' : '') + '"' + s.en + '"'));
    say(r4.badLines.length === 0, '문장 목록(스펠 정답)에 라벨 0', r4.badLines.length ? r4.badLines.join(' | ') : '없음');
    say(r4.tiles.every(t => t.every(w => !/^[BGMW]$/.test(w))), '어순 배열 타일에 라벨 0', JSON.stringify(r4.tiles[0]));
    say(r4.badCloze.length === 0, '빈칸 후보에 라벨 0', JSON.stringify(r4.cloze));
    say(r4.hints.every(h => !/^[BGMW]\s/.test(h)), '첫 글자 힌트에 라벨 0', r4.hints[0]);
    say(r4.withSpk > 0, '화자는 배지로 따로 들고 있다', r4.sample.map(s => s.label).filter(Boolean).join(' · '));
  }

  // ───── 5. ElevenLabs 호출 수·글자 수 ─────
  console.log('\n── 5  음성 호출');
  el.calls.length = 0;
  const cFixed = await page.evaluate(async () => {
    const b = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 1.2') === 0);
    const ks = Object.keys(b.unitTexts || {});
    const u = ks.find(k => /unit\s*1\b/i.test(k)) || ks[0];
    return { text: b.unitTexts[u], unit: u, book: b.title };
  });
  // (가) 캐시에 이미 있는 단원 → 생성 0회
  cacheHit = true;
  const hitRes = await page.evaluate(async (t) => {
    try { const d = await elevenGetPassageAudio(t, { key: 'x', voiceId: 'v' }, 1); return { ok: true, url: String(d.url).slice(0, 28) }; }
    catch (e) { return { ok: false, why: String(e.message).slice(0, 60) }; }
  }, cFixed.text);
  const afterHit = el.calls.length;
  say(afterHit === 0 && hitRes.ok, '이미 캐시 있는 단원 — ElevenLabs 생성 0회', '호출 ' + afterHit + '회 · ' + JSON.stringify(hitRes));
  // (나) 캐시에 없는 단원 → 생성 1회, 보낸 글자 수
  cacheHit = false; el.calls.length = 0;
  await page.evaluate(async (t) => {
    try { await elevenGetPassageAudio(t, { key: 'x', voiceId: 'v' }, 1); } catch (e) { }
  }, cFixed.text);
  const gen = el.calls.slice();
  say(gen.length === 1, '캐시 없는 단원 — ElevenLabs 생성 1회', gen.length + '회');
  if (gen[0]) {
    const lab = (gen[0].text.match(/(^|\n)\s*(?:[BGMW]\s+[A-Z]|[A-Z][a-zA-Z]{1,11}:\s)/g) || []).length;
    say(lab === 0, '생성에 보낸 텍스트에 화자 표기 0개', lab + '개');
    console.log('     보낸 글자 수: ' + gen[0].chars + '자 (원문 ' + cFixed.text.length + '자)');
    console.log('     보낸 텍스트 앞부분: ' + gen[0].text.replace(/\s+/g, ' ').slice(0, 90));
  }

  // ───── 6. 실학생 학생뷰(체험 모드) — Smart Listening 1.2 듣기, 보기만 ─────
  console.log('\n── 6  실학생 학생뷰 (체험 모드 · 보기만)');
  const w0 = writes;
  el.calls.length = 0;
  const r6 = await page.evaluate(async (a) => {
    await previewAsStudent(a.sid); await new Promise(r => setTimeout(r, 2800));
    const on = ppSandbox();
    const b = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 1.2') === 0);
    const ks = Object.keys(b.unitTexts || {});
    const u = ks.find(k => /unit\s*1\b/i.test(k)) || ks[0];
    // 듣기 미션 화면을 그린다 (소리는 내지 않는다)
    _msState = { a: { id: 'tmpdlg', sid: a.sid, progress: {} }, tb: b, sid: a.sid, missions: ['listen'], unitKey: u, idx: 0, ttsLevel: 'intermediate' };
    openM('m-mission');
    renderMsListen(document.getElementById('ms-body'), document.getElementById('ms-footer'));
    await new Promise(r => setTimeout(r, 500));
    const html = document.getElementById('ms-body').innerHTML;
    const badges = [...document.querySelectorAll('#ms-body .dlg-spk')].map(e => e.textContent);
    const bodyText = (document.getElementById('ms-body').textContent || '').replace(/\s+/g, ' ');
    const labelsOnScreen = (bodyText.match(/\s[BGMW]\s[A-Z]/g) || []).length;
    closeMissionPlayer(); await new Promise(r => setTimeout(r, 400));
    await returnToTeacher(); await new Promise(r => setTimeout(r, 2400));
    return { on, unit: u, badges: badges.slice(0, 5), badgeN: badges.length, labelsOnScreen, head: bodyText.slice(0, 110) };
  }, { sid: REAL_SID });
  say(r6.on, '미리보기는 체험 모드');
  say(r6.badgeN > 0, '듣기 화면에 화자 배지', r6.badges.join(' · '));
  say(r6.labelsOnScreen === 0, '본문에서 화자 글자가 빠졌다', r6.labelsOnScreen + '개');
  say(el.calls.length === 0, '화면만 그릴 때 음성 생성 0회', el.calls.length + '회');
  say(writes === w0 && badWrite === 0, '실학생 관련 저장 0건', '쓰기 ' + (writes - w0) + '건 · 실학생 행 ' + badWrite + '건');
  console.log('     화면 앞부분: ' + r6.head);

  // ───── 7. 폭 ─────
  console.log('\n── 7  화면 폭');
  for (const w of [320, 390, 1440]) {
    await page.setViewportSize({ width: w, height: 860 });
    await wait(400);
    const o = await page.evaluate(async () => {
      const b = (_cache.globalTextbooks || []).find(x => (x.title || '').indexOf('Smart Listening 1.2') === 0);
      const ks = Object.keys(b.unitTexts || {});
      const u = ks.find(k => /unit\s*1\b/i.test(k)) || ks[0];
      _msState = { a: { id: 'tmpdlg2', sid: 'x', progress: {} }, tb: b, sid: 'x', missions: ['listen'], unitKey: u, idx: 0, ttsLevel: 'intermediate' };
      openM('m-mission');
      renderMsListen(document.getElementById('ms-body'), document.getElementById('ms-footer'));
      await new Promise(r => setTimeout(r, 350));
      const bad = [];
      const vw = window.innerWidth;
      document.querySelectorAll('#m-mission *').forEach(n => {
        const r = n.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') return;
        if (r.right > vw + 1.5 || r.left < -1.5) bad.push(n.className + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
      });
      closeM('m-mission');
      return { bad: bad.slice(0, 4), hscroll: document.documentElement.scrollWidth > vw + 1 };
    });
    say(o.bad.length === 0 && !o.hscroll, w + 'px — 넘침 0', o.bad.length ? o.bad.join(' | ') : '없음');
  }

  console.log('\n오류: ' + (errs.length ? errs.slice(0, 6).join(' | ') : '없음'));
  console.log('쓰기 요청: 전부 차단 (' + writes + '건 시도, 실학생 행 ' + badWrite + '건)');
  console.log('\n' + (fails ? '실패 ' + fails + '건' : '전부 통과'));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
