require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// feat/stage-filter 확인 — ① 학습 세트 해석 줄 맞추기 ② 학생 문장 학습 ③ 자료실 수준
// 실DB 는 **읽기만** 한다: rest/v1 로 가는 POST·PATCH·DELETE 는 모두 막고 셈한다.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const OUT = SCR + '/shots_stage';
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));
const BOOKS = { 'mw0l37jcnfvj': '중학영어 1 (동아 윤정미)', 'mw0l57a76u8x': '중학영어 2 (동아 윤정미)', 'mw0l9e8h0mgf': '중학영어 3 (동아 윤정미, 2015 개정)' };
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) { }
const lines = [];
const say = s => { lines.push(String(s)); console.log(String(s)); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 940 }, locale: 'ko-KR', deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  let writes = 0, aiCalls = 0, viewBlocked = false;
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'POST' || m === 'PATCH' || m === 'DELETE') { writes++; return r.abort(); }   // 쓰기는 막는다
    const u = r.request().url();
    if (viewBlocked && u.indexOf('exam_bank_index') >= 0) return r.fulfill({ status: 404, body: '' });
    return r.continue();
  });
  await page.route('**/functions/v1/claude-proxy', r => {
    const b = String(r.request().postData() || '');
    if (b.indexOf('messages') >= 0 || b.indexOf('model') >= 0) aiCalls++;
    return r.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
  });
  const errs = [], badRes = [];
  page.on('response', r => {
    if (r.status() < 400) return;
    const u = r.url();
    // 이 확인 도구가 일부러 막은 것 두 가지 — AI 프록시(400)·뷰 없음(404)
    if (u.indexOf('claude-proxy') >= 0 || u.indexOf('exam_bank_index') >= 0) return;
    badRes.push(r.status() + ' ' + u.slice(0, 90));
  });
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 240000 });
  await wait(2500);
  await page.waitForFunction(() => {
    try { return (_cache.globalTextbooks || []).some(b => b.id === 'mw0l57a76u8x' && b.unitSentKo); } catch (e) { return false; }
  }, null, { timeout: 240000 });

  const has = await page.evaluate(ids => ids.map(id => {
    const b = (_cache.globalTextbooks || []).find(x => x.id === id);
    return { id: id, title: b ? b.title : '', units: b ? Object.keys(b.unitTexts || {}).length : 0, ko: b ? Object.keys(b.unitSentKo || {}).length : 0 };
  }), Object.keys(BOOKS));
  say('■ 라이브에서 받은 교재 (읽기만)');
  has.forEach(h => say('  ' + h.title + ' · 단원 ' + h.units + ' · 줄별 해석 있는 단원 ' + h.ko));
  ok('동아 세 권이 라이브에 있고 줄별 해석을 들고 있다', has.every(h => h.units > 0 && h.ko > 0),
    has.map(h => h.title + ' ' + h.ko + '단원').join(' / '));

  // ── ① 학습 세트 — 실제 교재·단원 칸으로 (change 이벤트) ───────────────
  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); });
  await wait(400);
  const kit = await page.evaluate(async () => {
    lkOpen({}, '', '중2');
    await new Promise(r => setTimeout(r, 300));
    const tb = document.getElementById('lk-tb'), un = document.getElementById('lk-unit');
    tb.value = 'mw0l57a76u8x'; tb.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 300));
    un.value = 'Lesson 5'; un.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    lkFromBook();
    await new Promise(r => setTimeout(r, 200));
    const g = document.getElementById('lk-grade'); g.value = '중2'; g.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    lkBuild();
    await new Promise(r => setTimeout(r, 400));
    if (typeof _lkSaveT !== 'undefined' && _lkSaveT) { clearTimeout(_lkSaveT); }    // 자동 저장 대기 끄기
    const tbk = (_cache.globalTextbooks || []).find(x => x.id === 'mw0l57a76u8x');
    return {
      unit: un.value, head: _lkKit.head, headKo: _lkKit.headKo,
      chunk: (_lkKit.parts.chunk || []).map(c => ({ en: c.en, chunk: c.chunk, ko: c.ko })),
      write: (_lkKit.parts.write || {}).items ? _lkKit.parts.write.items.map(w => ({ ko: w.ko, answer: w.answer })) : [],
      order: (_lkKit.parts.order || {}).lines ? _lkKit.parts.order.lines.map(l => l.tag + ' ' + l.en) : [],
      vocab: (_lkKit.parts.vocab || []).map(v => v.word + (v.ko ? (' ' + v.ko) : '')),
      text: String((tbk.unitTexts || {})['Lesson 5'] || ''), kot: String((tbk.unitSentKo || {})['Lesson 5'] || '')
    };
  });
  const L5t = kit.text.replace(/\r/g, '').split('\n').map(s => s.trim());
  const L5k = kit.kot.replace(/\r/g, '').split('\n').map(s => s.trim());
  ok('단원 고르기가 유지된다 (change 이벤트)', kit.unit === 'Lesson 5', '#lk-unit = ' + kit.unit);
  ok('제목 줄의 해석은 세트 머리에만', kit.head === L5t[0] && kit.headKo === L5k[0],
    '머리 "' + kit.head + '" / 해석 "' + kit.headKo + '"');
  ok('1번 문장 해석이 제목 해석이 아니다 (한 줄 밀림 고침)',
    kit.chunk.length > 0 && kit.chunk[0].ko === L5k[1] && kit.chunk[0].ko !== L5k[0],
    '1번 해석 = ' + (kit.chunk[0] || {}).ko);

  // 모든 문장: 그 문장이 들어 있는 본문 줄의 해석과 짝이 맞는가 (독립 확인)
  const lineOf = (en, tl) => {
    const nee = String(en).replace(/\s+/g, ' ').trim();
    for (let i = 0; i < tl.length; i++) if (tl[i].replace(/\s+/g, ' ').indexOf(nee) >= 0) return i;
    return -1;
  };
  let bad = 0, blank = 0;
  kit.chunk.forEach(c => {
    const i = lineOf(c.en, L5t);
    if (i < 0) { bad++; return; }
    if (!c.ko) { blank++; return; }
    if (String(L5k[i] || '').indexOf(c.ko) < 0) bad++;
  });
  ok('끊어 읽기 모든 문장의 해석이 그 줄의 해석이다', bad === 0 && blank === 0,
    '문장 ' + kit.chunk.length + '개 · 어긋남 ' + bad + ' · 빈 해석 ' + blank);
  let bw = 0;
  kit.write.forEach(w => { if (!w.ko) return; const i = lineOf(w.answer, L5t); if (i < 0 || String(L5k[i] || '').indexOf(w.ko) < 0) bw++; });
  ok('배열 영작의 우리말도 그 문장의 해석이다', bw === 0, '문항 ' + kit.write.length + '개 · 어긋남 ' + bw);

  say('');
  say('■ 중학영어 2 (동아 윤정미) Lesson 5 — 학습 세트');
  say('세트 머리: ' + kit.head + '  (' + kit.headKo + ')');
  say('— 끊어 읽기·해석 칸 앞 8문장 —');
  kit.chunk.slice(0, 8).forEach((c, i) => { say(' ' + (i + 1) + '. ' + c.chunk); say('    해석: ' + (c.ko || '(없음)')); });
  say('— 배열 영작 —');
  kit.write.forEach((w, i) => say(' ' + (i + 1) + '. ' + (w.ko || '(우리말 없음)') + '  → ' + w.answer));
  say('— 문장 순서 —');
  kit.order.forEach(l => say('  ' + l));

  // 한 줄에 두 문장인 단원 (중2 Lesson 6) 도 본다
  const kit6 = await page.evaluate(async () => {
    const un = document.getElementById('lk-unit');
    un.value = 'Lesson 6'; un.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    lkFromBook(); await new Promise(r => setTimeout(r, 200));
    lkBuild(); await new Promise(r => setTimeout(r, 400));
    if (typeof _lkSaveT !== 'undefined' && _lkSaveT) clearTimeout(_lkSaveT);
    const tbk = (_cache.globalTextbooks || []).find(x => x.id === 'mw0l57a76u8x');
    return {
      head: _lkKit.head, headKo: _lkKit.headKo,
      chunk: (_lkKit.parts.chunk || []).map(c => ({ en: c.en, ko: c.ko })),
      text: String((tbk.unitTexts || {})['Lesson 6'] || ''), kot: String((tbk.unitSentKo || {})['Lesson 6'] || '')
    };
  });
  const L6t = kit6.text.replace(/\r/g, '').split('\n').map(s => s.trim());
  const L6k = kit6.kot.replace(/\r/g, '').split('\n').map(s => s.trim());
  let bad6 = 0, blank6 = 0;
  kit6.chunk.forEach(c => {
    const i = lineOf(c.en, L6t);
    if (i < 0) { bad6++; return; }
    if (!c.ko) { blank6++; return; }
    if (String(L6k[i] || '').indexOf(c.ko) < 0) bad6++;
  });
  ok('한 줄에 두 문장인 단원(중2 Lesson 6)도 짝이 맞다', bad6 === 0,
    '문장 ' + kit6.chunk.length + '개 · 어긋남 ' + bad6 + ' · 빈 해석 ' + blank6);
  say('');
  say('■ 중2 Lesson 6 (한 줄에 두 문장이 9줄) 앞 4문장의 해석');
  kit6.chunk.slice(0, 4).forEach((c, i) => say(' ' + (i + 1) + '. ' + c.en + '\n    해석: ' + (c.ko || '(없음)')));

  // 화면 캡처 — 해석 칸
  await page.evaluate(async () => {
    const un = document.getElementById('lk-unit');
    un.value = 'Lesson 5'; un.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 150));
    lkFromBook(); await new Promise(r => setTimeout(r, 150));
    lkBuild(); await new Promise(r => setTimeout(r, 300));
    if (typeof _lkSaveT !== 'undefined' && _lkSaveT) clearTimeout(_lkSaveT);
    const sec = [...document.querySelectorAll('#m-kit .lk-sec-t')].find(x => /끊어 읽기/.test(x.textContent));
    if (sec) sec.scrollIntoView({ block: 'start' });
  });
  await wait(700);
  await page.screenshot({ path: OUT + '/1_kit_ko_1440.png' });
  try { const kitBox = await page.$('#m-kit'); if (kitBox) await kitBox.screenshot({ path: OUT + '/1b_kit_ko_modal.png' }); } catch (e) { say('(학습 세트 창 캡처 건너뜀)'); }
  await page.setViewportSize({ width: 390, height: 844 }); await wait(500);
  await page.screenshot({ path: OUT + '/2_kit_ko_390.png' });
  const ov390 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  await page.setViewportSize({ width: 320, height: 720 }); await wait(500);
  const ov320 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  await page.screenshot({ path: OUT + '/3_kit_ko_320.png' });
  ok('학습 세트 폰 폭에서 가로 넘침 없음', ov390.sw <= ov390.cw + 1 && ov320.sw <= ov320.cw + 1,
    '390 ' + ov390.sw + '/' + ov390.cw + ' · 320 ' + ov320.sw + '/' + ov320.cw);
  await page.evaluate(() => { try { closeM('m-kit'); } catch (e) { } });
  await page.setViewportSize({ width: 1440, height: 940 }); await wait(300);

  // ── ② 학생 문장 학습 (sentLines) — 세 권 모든 단원 ───────────────────
  const sl = await page.evaluate(ids => {
    const out = [];
    ids.forEach(id => {
      const b = (_cache.globalTextbooks || []).find(x => x.id === id);
      if (!b) return;
      Object.keys(b.unitTexts || {}).forEach(u => {
        const rows = sentLines(b, u);
        out.push({
          id: id, title: b.title, unit: u, n: rows.length,
          rows: rows.map(r => ({ en: r.en, ko: r.ko })),
          text: String((b.unitTexts || {})[u] || ''), kot: String((b.unitSentKo || {})[u] || '')
        });
      });
    });
    return out;
  }, Object.keys(BOOKS));
  let sBad = 0, sBlank = 0, sTot = 0, sUnits = 0, worst = '';
  sl.forEach(u => {
    const tl = u.text.replace(/\r/g, '').split('\n').map(s => s.trim());
    const kl = u.kot.replace(/\r/g, '').split('\n').map(s => s.trim());
    let b = 0;
    u.rows.forEach(r => {
      sTot++;
      const i = lineOf(r.en, tl);
      if (i < 0) { sBad++; b++; return; }
      if (!r.ko) { sBlank++; return; }
      if (String(kl[i] || '').indexOf(r.ko) < 0) { sBad++; b++; }
    });
    sUnits++;
    if (b && !worst) worst = u.title + ' ' + u.unit + ' (' + b + '개)';
  });
  ok('학생 문장 학습 — 세 권 모든 단원의 해석이 그 줄의 해석이다', sBad === 0,
    '단원 ' + sUnits + ' · 문장 ' + sTot + ' · 어긋남 ' + sBad + ' · 빈 해석 ' + sBlank + (worst ? (' · ' + worst) : ''));
  const l5s = sl.find(u => u.id === 'mw0l57a76u8x' && u.unit === 'Lesson 5');
  say('');
  say('■ 학생 문장 학습 — 중2 Lesson 5 앞 3문장 (sentLines)');
  (l5s ? l5s.rows.slice(0, 3) : []).forEach((r, i) => say(' ' + (i + 1) + '. ' + r.en + '\n    해석: ' + (r.ko || '(없음)')));
  ok('제목 줄이 다음 문장과 붙지 않는다', !!l5s && l5s.rows.length > 0 && !/Street Art in London Modern/.test(l5s.rows[0].en),
    '첫 줄: ' + (l5s ? l5s.rows[0].en.slice(0, 48) : ''));

  // ── ②-2 학습 세트 제목 줄 — 동아 세 권 전 단원 ────────────────────────
  // 'Who Is in Your Heart?' 처럼 ?·! 로 끝나는 제목이 1번 문장으로 나오던 것.
  const tt = await page.evaluate(ids => {
    const out = [];
    ids.forEach(id => {
      const b = (_cache.globalTextbooks || []).find(x => x.id === id);
      if (!b) return;
      Object.keys(b.unitTexts || {}).forEach(u => {
        const txt = String((b.unitTexts || {})[u] || '');
        if (!txt.trim()) return;
        const p = _lkParse(txt);
        const ko = (typeof ppKoLines === 'function') ? ppKoLines(String((b.unitSentKo || {})[u] || '')) : [];
        const at = (L, si, n) => (typeof ppKoAt === 'function') ? ppKoAt(ko, L, si, n) : '';
        const first = p.sents[0] || null;
        const raw0 = txt.replace(/\r/g, '').split('\n').map(x => x.trim()).filter(Boolean)[0] || '';
        out.push({
          book: b.title, unit: u, raw0: raw0,
          title: p.title, titleLine: p.titleLine,
          headKo: p.titleLine >= 0 ? at(p.titleLine, 0, 1) : '',
          first: first ? first.text : '', firstKo: first ? at(first.line, first.si, first.n) : '',
          ends: /[!?][")'’”]?$/.test(raw0),
          titleish: (typeof _lkTitleish === 'function') ? _lkTitleish(raw0) : false,
        });
      });
    });
    return out;
  }, Object.keys(BOOKS));
  const missed = tt.filter(x => x.titleish && !x.title);                 // 제목 꼴인데 못 뗀 것
  const wrongFirst = tt.filter(x => x.title && x.first === x.title);     // 제목이 1번 문장으로도 남은 것
  const koSame = tt.filter(x => x.title && x.headKo && x.firstKo && x.headKo === x.firstKo); // 해석이 밀린 것
  ok('동아 세 권 전 단원 — 제목 꼴 첫 줄을 모두 제목으로 뗀다', missed.length === 0,
    '단원 ' + tt.length + ' · 제목 있는 단원 ' + tt.filter(x => x.title).length + ' · 못 뗀 것 ' + missed.length +
    (missed.length ? (' · ' + missed[0].book + ' ' + missed[0].unit + ' "' + missed[0].raw0 + '"') : ''));
  ok('제목이 1번 문장으로 남지 않는다', wrongFirst.length === 0, '어긋남 ' + wrongFirst.length);
  ok('제목 해석과 1번 문장 해석이 다르다 (한 줄 밀림 없음)', koSame.length === 0,
    '같은 것 ' + koSame.length + (koSame.length ? (' · ' + koSame[0].book + ' ' + koSame[0].unit) : ''));
  const q1 = tt.filter(x => x.ends && x.title);
  say('');
  say('■ ?·! 로 끝나는 제목 ' + q1.length + '개');
  q1.slice(0, 6).forEach(x => say('  ' + x.book.replace(/ \(.*/, '') + ' ' + x.unit + ' — "' + x.title + '" / 해석 "' + (x.headKo || '(없음)') + '"'));
  say('  1번 문장 보기: ' + (q1[0] ? ('"' + q1[0].first + '" / "' + (q1[0].firstKo || '(없음)') + '"') : '-'));

  // ── ③ 자료실 수준 ────────────────────────────────────────────────────
  // 뷰(exam_bank_index)에는 아직 수준이 없다(SQL 은 Aside 가 실행) → '뷰가 없을 때' 길로
  // 표에서 직접 받아 _ebLight 가 수준을 싣는지까지 함께 본다.
  viewBlocked = true;
  await page.evaluate(() => { swTab('t-data'); switchDataTab('bank'); });
  await wait(600);
  await page.evaluate(() => ebCacheClear());
  await page.waitForFunction(() => { try { return (_ebRows || []).length > 100; } catch (e) { return false; } }, null, { timeout: 300000 });
  await wait(1200);
  const eb = await page.evaluate(() => {
    const rows = _ebRows || [];
    const st = {};
    rows.forEach(r => { const s = String((r.meta || {}).stage || '(없음)'); st[s] = (st[s] || 0) + 1; });
    const sel = document.getElementById('eb-f-stage');
    const sortSel = document.getElementById('eb-f-sort');
    return {
      src: _ebSrc, n: rows.length, st: st,
      stageOpts: sel ? [...sel.options].map(o => o.value + '|' + o.textContent) : null,
      stageShown: sel ? sel.style.display !== 'none' : false,
      sortOpts: sortSel ? [...sortSel.options].map(o => o.value + '|' + o.textContent) : null,
      sample: rows.filter(r => (r.meta || {}).stage).slice(0, 3).map(r => ({ t: r.meta.title, badge: _ebStageBadge(r.meta), line: ebStageLine(r.meta) })),
      why: rows.filter(r => !(r.meta || {}).stage && (r.meta || {}).stageWhy).slice(0, 2).map(r => ({ t: r.meta.title, badge: _ebStageBadge(r.meta), line: ebStageLine(r.meta) })),
      grade: ['P0', 'P1', 'P2', 'P3', 'M1', 'M2', 'M3', 'H1', 'H2'].map(s => s + '→' + ebStageGrade(s) + '(칸:' + ebStageGrade(s, IB_GRADES) + ')').join(' · ')
    };
  });
  ok('표에서 받는 길에서도 meta 에 수준이 실린다', Object.keys(eb.st).some(k => /^(P|M|H)\d$/.test(k)),
    '받은 줄 ' + eb.n + ' · ' + JSON.stringify(eb.st));
  ok('수준 거르기 칸이 보인다', eb.stageShown && eb.stageOpts && eb.stageOpts.length >= 3, (eb.stageOpts || []).join(' / '));
  ok("'측정 안 됨' 선택지가 있다", (eb.stageOpts || []).some(o => o.indexOf('none|') === 0), (eb.stageOpts || []).filter(o => o.indexOf('none|') === 0).join(''));
  ok('정렬 칸에 시리즈·추정 학년순이 있다', (eb.sortOpts || []).some(o => o.indexOf('stage|') === 0), (eb.sortOpts || []).join(' / '));
  say('');
  say('■ 자료실 수준 — 배지와 한 줄');
  eb.sample.forEach(s => say('  [' + s.badge + '] ' + s.t + '\n     → ' + s.line));
  eb.why.forEach(s => say('  [' + s.badge + '] ' + s.t + '\n     → ' + s.line));
  say('  수준→학년: ' + eb.grade);

  // 거르기·정렬이 실제로 듣는가
  const filt = await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change')); };
    set('eb-f-stage', 'M2');
    const a = _ebFiltered();
    set('eb-f-stage', 'none');
    const b = _ebFiltered();
    set('eb-f-stage', '');
    set('eb-f-sort', 'stage');
    const c = _ebFiltered().slice(0, 400);
    set('eb-f-sort', '');
    const d = _ebFiltered();
    return {
      m2: a.length, m2bad: a.filter(r => (r.meta || {}).stage !== 'M2').length,
      none: b.length, nonebad: b.filter(r => (r.meta || {}).stage).length,
      all: d.length,
      sorted: (() => {
        let bad = 0;
        for (let i = 1; i < c.length; i++) {
          const p = c[i - 1].meta || {}, q = c[i].meta || {};
          if (String(p.series || '') !== String(q.series || '')) continue;
          const pg = p.stageG == null ? 99 : Number(p.stageG), qg = q.stageG == null ? 99 : Number(q.stageG);
          if (pg > qg) bad++;
        }
        return bad;
      })(),
      ser: c.slice(0, 8).map(r => (r.meta.series || '(시리즈 없음)') + ' / ' + (r.meta.stage || '—') + ' ' + (r.meta.stageG == null ? '' : r.meta.stageG) + ' / ' + r.meta.title)
    };
  });
  ok('수준으로 거르기 — M2 만 나온다', filt.m2 > 0 && filt.m2bad === 0, 'M2 ' + filt.m2.toLocaleString() + '개 · 섞임 ' + filt.m2bad);
  ok("'측정 안 됨' 으로 거르기", filt.none > 0 && filt.nonebad === 0, '측정 안 됨 ' + filt.none.toLocaleString() + '개 · 섞임 ' + filt.nonebad);
  ok('시리즈 안에서 추정 학년 순으로 정렬된다', filt.sorted === 0, '앞 400줄에서 뒤바뀜 ' + filt.sorted + '곳');
  say('');
  say('■ 시리즈·추정 학년순 앞 8줄');
  filt.ser.forEach(s => say('  ' + s));

  // 배지 누르면 한 줄 (토스트)
  const toastTxt = await page.evaluate(async () => {
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change')); };
    set('eb-f-stage', 'M2');
    await new Promise(r => setTimeout(r, 300));
    const b = document.querySelector('#eb-list .eb-badge.eb-stage');
    if (!b) return { btn: '', toast: '' };
    const t = b.textContent;
    b.click();
    await new Promise(r => setTimeout(r, 300));
    const el = document.getElementById('toast') || document.querySelector('.toast');
    return { btn: t, toast: el ? String(el.textContent || '').trim() : '' };
  });
  ok('카드의 수준 배지를 누르면 한 줄이 뜬다', /내용 측정/.test(toastTxt.toast), '배지 "' + toastTxt.btn + '" → ' + toastTxt.toast);

  await wait(400);
  await page.screenshot({ path: OUT + '/4_eb_stage_1440.png' });
  try { const ebBox = await page.$('#dp-bank'); if (ebBox) await ebBox.screenshot({ path: OUT + '/4b_eb_stage_panel.png' }); } catch (e) { say('(자료실 패널 캡처 건너뜀)'); }
  await page.setViewportSize({ width: 390, height: 844 }); await wait(600);
  await page.screenshot({ path: OUT + '/5_eb_stage_390.png' });
  const eov390 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  await page.setViewportSize({ width: 320, height: 720 }); await wait(600);
  await page.screenshot({ path: OUT + '/6_eb_stage_320.png' });
  const eov320 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok('자료실 폰 폭에서 가로 넘침 없음', eov390.sw <= eov390.cw + 1 && eov320.sw <= eov320.cw + 1,
    '390 ' + eov390.sw + '/' + eov390.cw + ' · 320 ' + eov320.sw + '/' + eov320.cw);
  await page.setViewportSize({ width: 1440, height: 940 }); await wait(300);

  // 상세의 '내용 측정' 한 줄
  const det = await page.evaluate(async () => {
    const r = (_ebRows || []).find(x => (x.meta || {}).stage && (x.meta || {}).stageConf);
    if (!r) return { id: '', line: '' };
    await ebOpenDetail(r.id);
    await new Promise(x => setTimeout(x, 1500));
    const el = document.querySelector('#eb-d-body .eb-stage-note');
    return { id: r.id, title: r.meta.title, line: el ? String(el.textContent || '').trim() : '' };
  });
  ok('자료 상세에도 측정 한 줄이 있다', /내용 측정/.test(det.line), det.title + ' → ' + det.line);
  await wait(300);
  await page.screenshot({ path: OUT + '/7_eb_detail_stage.png' });
  await page.evaluate(() => { try { ebCloseDetail(); } catch (e) { } });

  // ── 마무리 ──
  ok('DB 쓰기 시도 0', writes === 0, '막힌 쓰기 ' + writes + '건');
  ok('AI 호출 0', aiCalls === 0, 'AI ' + aiCalls + '회');
  ok('콘솔 오류 없음 (스텁 제외)', errs.length === 0, errs.slice(0, 3).join(' | '));
  ok('실패한 요청 없음 (스텁 제외)', badRes.length === 0, badRes.slice(0, 3).join(' | '));

  say('');
  say('■ 통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => say('  ✓ ' + p));
  fail.forEach(f => say('  ✗ ' + f));
  fs.writeFileSync(SCR + '/stage_out.txt', lines.join('\n'), 'utf8');
  await browser.close();
})();
