require('../_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 학습 세트 다듬기 확인 — 실제 '중학영어 2 (동아 윤정미) Lesson 5' 본문으로
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..', '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));
const L5 = JSON.parse(fs.readFileSync(SCR + '/l5.json', 'utf8'));
const DIALOG = "Shopping for a Friend\nYuna: Let's make a team for the school festival.\nMinho: That sounds great. What should we prepare first?\nYuna: We need to buy some paper and paint at the stationery store.\nMinho: I will bring my brother's camera for the photo booth.";

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  let aiCalls = 0;
  await page.route('**/rest/v1/item_bank**', r => r.request().method() === 'POST' ? r.fulfill({ status: 201, body: '' })
    : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0', 'access-control-expose-headers': 'content-range' }, body: '[]' }));
  await page.route('**/rest/v1/worksheets**', r => r.request().method() === 'POST'
    ? r.fulfill({ status: 201, body: '' })
    : r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/functions/v1/claude-proxy', r => { if (r.request().method() === 'POST') aiCalls++; return r.fulfill({ status: 400, body: '{}' }); });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));
  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(1800);
  const ai0 = aiCalls;

  // 라이브에서 받은 Lesson 5 를 화면 캐시에만 넣는다 (DB 에는 쓰지 않는다)
  await page.evaluate(d => {
    _cache.globalTextbooks = (_cache.globalTextbooks || []).filter(b => b.id !== 'dongaE2').concat([{
      id: 'dongaE2', title: '중학영어 2 (동아 윤정미)', cat: '내신',
      unitTexts: { 'Lesson 5': d.text, 'Lesson 6': d.dialog },
      units: { 'Lesson 5': d.words },
      unitTitles: { 'Lesson 5': 'Street Art' },
      unitPatterns: { 'Lesson 5': '관계대명사 that 을 넣어 쓰기\nbe going to 로 미래를 나타내기' }
    }]);
    show('s-teacher');
  }, { text: L5.text, words: L5.words, dialog: DIALOG });
  await wait(600);

  // ① 단원 고르기 — 값만 넣지 않고 실제 change 이벤트를 일으킨다
  const pick = await page.evaluate(async () => {
    const log = [];
    lkOpen({}, '', '중2');
    await new Promise(r => setTimeout(r, 300));
    const tb = document.getElementById('lk-tb'), un = document.getElementById('lk-unit');
    tb.value = 'dongaE2'; tb.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 300));
    log.push('교재 change 뒤 단원 칸 = ' + [...un.options].map(o => o.value).filter(Boolean).join(', '));
    un.value = 'Lesson 5'; un.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 300));
    log.push('단원 change 뒤 #lk-unit.value=' + un.value + ' · _lkKit.src.unit=' + _lkKit.src.unit);
    document.getElementById('lk-grade').value = '중2'; document.getElementById('lk-grade').dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    log.push('학년 change 뒤 #lk-unit.value=' + un.value + ' (예전엔 여기서 지워졌다)');
    lkFromBook();
    await new Promise(r => setTimeout(r, 400));
    log.push('본문 가져오기 → ' + (_lkKit.passage || '').length + '자');
    return { log, after: un.value, len: (_lkKit.passage || '').length, unit: _lkKit.src.unit, title: _lkKit.title };
  });
  ok('① 단원을 고르면 선택이 남는다 (실제 change 이벤트)',
    pick.after === 'Lesson 5' && pick.unit === 'Lesson 5' && pick.len > 1500,
    pick.log.join(' | '));

  // ② 들어가는 길
  const entry = await page.evaluate(() => {
    const ws = [...document.querySelectorAll('#dp-ws button')].find(b => /학습 세트 만들기/.test(b.textContent));
    const ue = [...document.querySelectorAll('#m-tbook-detail button')].find(b => /^📘 학습 세트$/.test(b.textContent.trim()));
    return { ws: !!ws, wsCall: ws ? ws.getAttribute('onclick') : '', ue: !!ue, ueCall: ue ? ue.getAttribute('onclick') : '' };
  });
  ok('② 들어가는 단추 두 곳', entry.ws && entry.ue && /lkOpen/.test(entry.wsCall) && /lkFromUnitEditor/.test(entry.ueCall),
    '저장된 워크시트 탭: ' + entry.wsCall + ' · 단원 편집기: ' + entry.ueCall);

  // ②-2 단원 편집기 단추가 실제로 그 단원 본문으로 세트를 연다
  const ue2 = await page.evaluate(async d => {
    closeM('m-kit');
    document.getElementById('tu-tb-id').value = 'dongaE2';
    try { _tuCurUnit = 'Lesson 5'; } catch (e) { }
    document.getElementById('tu-unit-text').value = d.text;
    lkFromUnitEditor();
    await new Promise(r => setTimeout(r, 400));
    const un = document.getElementById('lk-unit');
    return { open: document.getElementById('m-kit').style.display !== 'none',
      tb: (document.getElementById('lk-tb') || {}).value, unit: un ? un.value : '',
      src: _lkKit.src.unit, len: (_lkKit.passage || '').length, title: _lkKit.title };
  }, { text: L5.text });
  ok('②-2 단원 편집기 단추가 그 단원 본문으로 바로 연다',
    ue2.open && ue2.tb === 'dongaE2' && ue2.unit === 'Lesson 5' && ue2.src === 'Lesson 5' && ue2.len > 1500,
    '교재/단원 칸 ' + ue2.tb + '/' + ue2.unit + ' · ' + ue2.len + '자 · "' + ue2.title + '"');

  // ③ 제목 줄·문장 나누기
  const parse = await page.evaluate(d => {
    const p = _lkParse(d.text), dg = _lkParse(d.dialog);
    return { title: p.title, n: p.sents.length, first: p.sents[0].text,
      hasTitle: p.sents.some(s => /^Street Art in London$/.test(s.text)),
      dgTitle: dg.title, dgN: dg.sents.length,
      dgSpk: dg.sents.slice(0, 3).map(s => (s.spk || '-') + '|' + s.text.slice(0, 24)) };
  }, { text: L5.text, dialog: DIALOG });
  ok('③ 마침표 없는 첫 줄은 제목으로 떼고 문장 목록에 넣지 않는다',
    parse.title === 'Street Art in London' && !parse.hasTitle && parse.n >= 25,
    '제목 "' + parse.title + '" · 문장 ' + parse.n + '개 · 첫 문장 "' + parse.first.slice(0, 34) + '…"');
  ok('④ 화자 표기는 따로 들고 문장 앞에 둔다 (ppParseDialog)',
    parse.dgTitle === 'Shopping for a Friend' && parse.dgSpk[0].indexOf('Yuna|') === 0 && parse.dgSpk[1].indexOf('Minho|') === 0,
    parse.dgSpk.join(' · '));

  // ⑤ 본문에서 뽑을 때의 거르기 (고유명사·초등 기본 낱말·원형)
  const filt = await page.evaluate(d => {
    const mid = _lkWordsOf(d.text, 'mid'), elem = _lkWordsOf(d.text, 'elem');
    return { midN: mid.length, elemN: elem.length,
      proper: mid.filter(w => ['london', 'stik', 'shoreditch', 'banksy', 'ben'].indexOf(w) >= 0),
      basic: mid.filter(w => ['street', 'art', 'today', 'see', 'place', 'people', 'city', 'cities'].indexOf(w) >= 0),
      elemHasBasic: elem.filter(w => ['street', 'art', 'today', 'place'].indexOf(w) >= 0),
      lemma: ['paintings', 'bodies', 'making', 'created', 'cities', 'telling'].map(w => w + '→' + _lkBaseW(w)) };
  }, { text: L5.text });
  ok('⑤ 고유명사는 뺀다', filt.proper.length === 0, '검사한 5개(London·STIK·Shoreditch·Banksy·Ben) 중 ' + filt.proper.length + '개만 들어옴');
  ok('⑥ 초등 기본 낱말은 중1 이상에서 뺀다 (초등은 남긴다)',
    filt.basic.length === 0 && filt.elemHasBasic.length > 0,
    '중2 목록 ' + filt.midN + '개 (기본 낱말 0) · 초등 목록 ' + filt.elemN + '개 (기본 낱말 ' + filt.elemHasBasic.length + '개 남음)');
  const lj = filt.lemma.join(' ');
  ok('⑦ 변화형은 원형으로 (DB 에 없는 꼴은 본문 그대로)',
    /paintings→painting/.test(lj) && /bodies→body/.test(lj) && /cities→city/.test(lj) && /making→make/.test(lj) && /created→create/.test(lj) && /telling→tell/.test(lj),
    filt.lemma.join(' · '));

  // ⑧ 만들기 (중2)
  const made = await page.evaluate(async () => {
    lkOpen({}, '', '중2');
    await new Promise(r => setTimeout(r, 250));
    const tb = document.getElementById('lk-tb'); tb.value = 'dongaE2'; tb.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 250));
    const un = document.getElementById('lk-unit'); un.value = 'Lesson 5'; un.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    lkFromBook();
    document.getElementById('lk-grade').value = '중2'; lkCfgChange();
    lkBuild();
    await new Promise(r => setTimeout(r, 600));
    const p = _lkKit.parts;
    return {
      vocab: p.vocab.map(v => ({ w: v.word, ko: v.ko, from: v.from })),
      chunk: p.chunk.map(c => c.chunk), chunkN: p.chunk.length,
      order: (p.order.lines || []).map(l => l.tag + ' ' + l.en), orderAns: p.order.answer,
      cloze: p.cloze.mode, head: _lkKit.head, writeMode: p.write.mode
    };
  });
  const unitN = made.vocab.filter(v => v.from === 'unit').length;
  const short = made.chunk.filter(c => c.split(/\s+/).filter(x => x !== '/').length <= 6);
  ok('⑧ 단어장 — 단원 단어를 본문 순서대로 먼저',
    made.vocab.length === 20 && unitN >= 15 && made.vocab.slice(0, 10).every(v => v.from === 'unit'),
    '20개 중 단원 단어 ' + unitN + '개 · 본문에서 더 뽑은 것 ' + (20 - unitN) + '개 · 뜻 없음 ' + made.vocab.filter(v => !v.ko).length + '개');
  ok('⑨ 끊어 읽기 — 빈 조각 없음 · 여섯 낱말 이하는 안 끊음',
    made.chunk.every(c => !/\/\s*\//.test(c) && !/^\s*\//.test(c) && !/\/\s*$/.test(c)) &&
    short.every(c => c.indexOf('/') < 0),
    made.chunkN + '문장 · 빈 조각 0 · 여섯 낱말 이하 ' + short.length + '문장 그대로');
  const one = made.chunk.filter(c => c.indexOf('/') >= 0 && c.split(' / ')
    .some((p, k) => p.trim().split(/\s+/).length < 2 && !(k === 0 && /[,;:]$/.test(p.trim()))));
  ok('⑨-2 한 낱말짜리 토막이 생기지 않는다 (맨 앞 "Today," 꼴만 둔다)', one.length === 0, one.slice(0, 2).join(' | ') || '0개');
  ok('⑩ be going to · one of · used to 의 to/of 앞에서는 끊지 않는다',
    !made.chunk.some(c => /going\s*\/\s*to|one\s*\/\s*of|used\s*\/\s*to|lot\s*\/\s*of|kind\s*\/\s*of/.test(c)),
    '해당 표현이 든 ' + made.chunk.filter(c => /going to|one of|used to|lot of|kind of/.test(c)).length + '문장 모두 안 끊김');
  ok('⑪ 문장 순서 — 문장을 자르지 않고 제목도 넣지 않는다',
    made.order.length >= 3 && made.order.every(l => /[.!?]["'”’)]?$/.test(l.trim())) && !made.order.some(l => /Street Art in London/.test(l)),
    made.order.length + '문장 · 가장 긴 줄 ' + Math.max.apply(null, made.order.map(l => l.length)) + '자');
  ok('⑫ 본문 제목을 세트 머리에 둔다', made.head === 'Street Art in London', '"' + made.head + '"');

  // ⑬ 미리보기에서도 문장을 자르지 않는다
  const prev = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#lk-body .lk-wrap')].map(r => r.textContent.trim().replace(/^[ⓐⓑⓒⓓⓔⓕ]\s*/, ''));
    return { rows, cut: rows.filter(r => !/[.!?]["'”’)]?$/.test(r)).length,
      ws: rows.length ? getComputedStyle(document.querySelector('#lk-body .lk-wrap')).whiteSpace : '' };
  });
  ok('⑬ 미리보기 문장 순서 — 잘린 줄 0 · 길면 줄바꿈', prev.rows.length >= 3 && prev.cut === 0 && prev.ws === 'normal',
    prev.rows.length + '줄 · 잘린 줄 ' + prev.cut + ' · white-space:' + prev.ws);

  // ⑭ 끊어 읽기 손으로 고치기
  const edit = await page.evaluate(async () => {
    const el = document.querySelector('#lk-body .lk-ed');
    const before = _lkKit.parts.chunk[0].chunk;
    el.innerText = 'Modern street art / comes in many different forms,/ and it makes cities colorful and lively.';
    el.dispatchEvent(new Event('blur'));
    await new Promise(r => setTimeout(r, 300));
    return { before, now: _lkKit.parts.chunk[0].chunk };
  });
  ok('⑭ 끊은 자리를 눌러서 고칠 수 있다 (고치면 자동 저장)',
    /forms, \/ and it makes/.test(edit.now) && !/\/\//.test(edit.now),
    '고친 뒤 "' + edit.now.slice(0, 56) + '…"');

  // ⑮ 조건 영작 — 단원 문법 포인트
  const cond = await page.evaluate(async () => {
    document.getElementById('lk-grade').value = '고1'; lkCfgChange();
    lkBuild();
    await new Promise(r => setTimeout(r, 500));
    const w = _lkKit.parts.write;
    return { mode: w.mode, conds: (w.items || []).map(x => (x.cond || []).join(' · ')) };
  });
  ok('⑮ 조건 영작에 단원 문법 포인트가 들어간다',
    cond.mode === 'cond' && cond.conds.length >= 2 && /관계대명사 that/.test(cond.conds[0]) && /be going to/.test(cond.conds[0]),
    cond.conds[0] || '(없음)');

  // ⑯ 문법 포인트가 없는 교재는 지금처럼
  const cond2 = await page.evaluate(async d => {
    _cache.globalTextbooks.push({ id: 'noPat', title: '문법 포인트 없는 교재', unitTexts: { U1: d.text }, units: {} });
    lkOpen({}, '', '고1');
    await new Promise(r => setTimeout(r, 250));
    const tb = document.getElementById('lk-tb'); tb.value = 'noPat'; tb.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 250));
    const un = document.getElementById('lk-unit'); un.value = 'U1'; un.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    lkFromBook(); lkBuild();
    await new Promise(r => setTimeout(r, 500));
    return (_lkKit.parts.write.items || []).map(x => (x.cond || []).join(' · '));
  }, { text: L5.text });
  ok('⑯ 문법 포인트가 없으면 지금처럼', cond2.length > 0 && /본문에 나온 표현/.test(cond2[0]), cond2[0] || '(없음)');

  // ⑰ 대화 단원 — 화자 표기는 문장 앞에만, 빈칸·배열 대상에서는 뺀다
  const dlg = await page.evaluate(async () => {
    lkOpen({}, '', '중2');
    await new Promise(r => setTimeout(r, 250));
    const tb = document.getElementById('lk-tb'); tb.value = 'dongaE2'; tb.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 250));
    const un = document.getElementById('lk-unit'); un.value = 'Lesson 6'; un.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 200));
    lkFromBook();
    document.getElementById('lk-grade').value = '중2'; lkCfgChange();
    lkBuild();
    await new Promise(r => setTimeout(r, 500));
    const p = _lkKit.parts;
    return { head: _lkKit.head, spk: (p.chunk || []).filter(c => c.spk).length,
      chunk0: (p.chunk[0] || {}).spk + ' / ' + (p.chunk[0] || {}).chunk,
      clozePre: /^Yuna:/.test(String(p.cloze.text || '')),
      clozeBlanks: (p.cloze.blanks || []).map(b => b.answer),
      writeN: (p.write.items || []).length,
      writeAns: (p.write.items || []).map(x => x.answer),
      writeWords: (p.write.items || []).map(x => (x.words || []).join(' ')) };
  });
  ok('⑰ 대화 단원 — 화자 표기는 문장 앞에만 남고 빈칸·배열 대상에서는 뺀다',
    dlg.head === 'Shopping for a Friend' && dlg.spk >= 4 && dlg.clozePre &&
    dlg.clozeBlanks.every(a => !/(Yuna|Minho)/.test(a)) &&
    dlg.writeN > 0 && dlg.writeAns.every(a => !/^(Yuna|Minho):/.test(a)) && dlg.writeWords.every(w => !/(Yuna|Minho):/.test(w)),
    '화자 ' + dlg.spk + '줄 · 빈칸 답 ' + dlg.clozeBlanks.length + '개에 화자 없음 · 배열 ' + dlg.writeN + '문항에 화자 없음');

  ok('⑱ 여기까지 AI 호출 0회', aiCalls === ai0, (aiCalls - ai0) + '회');
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|400 |404 |406 |500 |Failed to load resource/i;
  const mineErr = errs.filter(e => !skip.test(e));
  ok('⑲ 콘솔 오류 0', mineErr.length === 0, mineErr.slice(0, 3).join(' | ') || '0');

  // ── 보고용 출력 ───────────────────────────────────────────────────
  console.log('\n=== 중학영어 2 (동아 윤정미) Lesson 5 · 중2 ===');
  console.log('[세트 머리 제목] ' + made.head);
  console.log('\n[단어장 20개]');
  made.vocab.forEach((v, i) => {
    const tag = v.from === 'unit' ? '단원 단어' : (v.from === 'db' ? '앱 단어 DB' : '뜻 없음');
    console.log('  ' + String(i + 1).padStart(2) + '. ' + String(v.w).padEnd(14) + (v.ko || '—') + '  [' + tag + ']');
  });
  console.log('\n[끊어 읽기 앞 8문장]');
  made.chunk.slice(0, 8).forEach((c, i) => console.log('  ' + (i + 1) + '. ' + c));
  console.log('\n[문장 순서]');
  made.order.forEach(l => console.log('  ' + l));
  console.log('  정답 ' + made.orderAns);
  console.log('\n[조건 영작 조건 (고1)]');
  cond.conds.forEach((c, i) => console.log('  ' + (i + 1) + '. ' + c));
  console.log('\n[대화 단원 Lesson 6 첫 줄] ' + dlg.chunk0);
  console.log('\n[단원 고르기 확인 기록]');
  pick.log.forEach(l => console.log('  · ' + l));

  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
