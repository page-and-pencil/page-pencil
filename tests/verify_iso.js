require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 동형 문제 — 화면·흐름 확인 (AI 는 가짜 응답으로, 저장도 가짜로 — 진짜 돈·DB를 쓰지 않는다)
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));

const ANALYZE = {
  type: 'blank', typeName: '빈칸 추론', stem: '다음 빈칸에 들어갈 말로 가장 적절한 것은?',
  passage: 'Original passage about memory and attention...', choices: ['a', 'b', 'c', 'd', 'e'], answer: 2,
  evidence: 'Attention is the gate.', points: ['주제문 자리 빈칸'], words: 120, level: '고1 수준', distractors: '지문 단어 재활용'
};
const mkItems = (n, essay) => Array.from({ length: n }, (_, i) => essay ? ({
  stem: '다음 조건에 맞게 영작하시오. (' + (i + 1) + ')', passage: '조건: 현재완료를 쓸 것',
  choices: [], answerText: 'I have lived here for ten years.', rubric: '현재완료 2점, 어순 2점, 철자 1점',
  explain: '현재완료는 과거부터 지금까지 이어지는 일을 나타낸다.', intent: '현재완료 쓰임 확인'
}) : ({
  stem: '다음 빈칸에 들어갈 말로 가장 적절한 것은? (' + (i + 1) + ')',
  passage: 'Sample passage number ' + (i + 1) + ' about curiosity and learning. '.repeat(3),
  choices: ['keep asking questions', 'memorize more facts', 'avoid hard problems', 'work alone always', 'follow the rules'],
  answer: i % 5, explain: '글의 핵심은 "keep asking questions" 이다.', intent: '주제문 재진술 확인',
  wrong: ['① 정답', '② 지문 단어 재활용']
}));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();

  let aiCalls = [], saved = null, verifyShift = false;
  await page.route('**/functions/v1/claude-proxy', async r => {
    let body = {};
    try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
    const txt = JSON.stringify(body).slice(0, 4000);
    if (!body.model) return r.fulfill({ status: 400, contentType: 'application/json', body: '{"error":{"message":"model 이 없습니다"}}' }); // 부팅 때의 살아있나 확인 — 세지 않는다
    aiCalls.push({ model: body.model, hasImg: /"type":"image"/.test(txt), kind: /학생처럼 풀어라/.test(txt) ? 'verify' : (/분석해서 JSON/.test(txt) ? 'analyze' : 'generate') });
    const kind = aiCalls[aiCalls.length - 1].kind;
    let out;
    if (kind === 'analyze') out = JSON.stringify(ANALYZE);
    else if (kind === 'generate') {
      const m = txt.match(/새 문항 (\d+)개/);
      const n = m ? +m[1] : 3;
      out = JSON.stringify(mkItems(n, /조건 영작|서술형 요약|고쳐 쓰기|배열 영작/.test(txt)));
    } else {
      const nos = (txt.match(/\\"no\\":(\d+)/g) || []).map(x => +x.replace(/\D/g, ''));
      const list = nos.length ? [...new Set(nos)] : [1];
      out = JSON.stringify(list.map(no => ({
        no: no, answer: (verifyShift && no === 1) ? 4 : ((no - 1) % 5), evidence: '근거 문장', alt: false, why: '다른 선택지도 맞을 수 있음'
      })));
    }
    return r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text: out }], usage: { input_tokens: 1234, output_tokens: 2345 } })
    });
  });
  await page.route('**/rest/v1/worksheets**', async r => {
    const m = r.request().method();
    if (m === 'POST') { try { saved = JSON.parse(r.request().postData() || '{}'); } catch (e) { } return r.fulfill({ status: 201, body: '' }); }
    if (m === 'DELETE') return r.fulfill({ status: 204, body: '' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 });
  await wait(2000);

  // ① 탭이 생겼는지 + 학생 화면엔 없는지
  const t = await page.evaluate(() => ({
    label: (document.getElementById('dtab-iso') || {}).textContent || '',
    inTeacher: !!(document.getElementById('dp-iso') || {}).closest && !!document.getElementById('dp-iso').closest('#s-teacher'),
    inStudent: !!document.querySelector('#s-student #dp-iso'),
    may: typeof isoMayUse === 'function' ? isoMayUse() : null
  }));
  ok('① 동형 문제 탭', t.label.trim() === '동형 문제' && t.inTeacher && !t.inStudent && t.may === true, JSON.stringify(t));

  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('iso'); });
  await wait(600);

  // ② 유형 사전
  const d = await page.evaluate(() => ({
    types: Object.keys(ISO_TYPES).length,
    nos: Object.keys(ISO_HS_NO).length,
    no31: ISO_HS_NO[31], no29: ISO_HS_NO[29], no19: ISO_HS_NO[19], no5: ISO_HS_NO[5],
    allHaveW: Object.values(ISO_TYPES).filter(x => x.iso !== false).every(x => x.w && x.w.length > 10),
    opts: document.getElementById('iso-type').options.length
  }));
  ok('② 유형 사전', d.types >= 45 && d.nos === 45 && d.no31 === 'blank' && d.no29 === 'grammar' && d.allHaveW,
    '유형 ' + d.types + '종 · 번호 ' + d.nos + '개 · 31→' + d.no31 + ' · 29→' + d.no29 + ' · 19→' + d.no19 + ' · 칸 ' + (d.opts - 1));

  // ③ 번호로 유형 자동 제안
  const s3 = await page.evaluate(() => {
    document.getElementById('iso-qno').value = '31'; isoQnoChange();
    return { type: _isoCfg.type, hint: document.getElementById('iso-type-hint').textContent, w: document.getElementById('iso-type-w').textContent.slice(0, 40) };
  });
  ok('③ 번호 → 유형 자동', s3.type === 'blank' && /빈칸/.test(s3.hint), s3.hint.slice(0, 60));

  // ④ 이미지 붙여넣기 (가짜 1x1 png) → 분석·생성·검증 3회
  await page.evaluate(async () => {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    await isoAddImage(new File([arr], 'q31.png', { type: 'image/png' }));
    document.getElementById('iso-n').value = '3'; isoCfgChange();
  });
  await page.evaluate(() => isoGenerate());
  await page.waitForFunction(() => document.querySelectorAll('#iso-list .iso-card').length > 0, null, { timeout: 60000 });
  await wait(800);
  const g = await page.evaluate(() => ({
    n: document.querySelectorAll('#iso-list .iso-card').length,
    warn: document.querySelectorAll('#iso-list .iso-card.iso-warn').length,
    head: document.getElementById('iso-head').textContent,
    cost: document.getElementById('iso-cost').textContent
  }));
  ok('④ 이미지 → 3문항 (호출 3회)', g.n === 3 && aiCalls.length === 3 && aiCalls[0].hasImg && aiCalls.map(c => c.kind).join(',') === 'analyze,generate,verify',
    g.n + '문항 · ' + aiCalls.map(c => c.kind).join('→') + ' · ' + g.head);
  ok('⑤ 비용 표시', /호출 3회/.test(g.cost) && /토큰/.test(g.cost), g.cost);
  ok('⑥ 모델은 워크시트 스튜디오와 같은 것', aiCalls.every(c => c.model === 'claude-opus-4-8'), aiCalls[0].model);

  // ⑦ 검증 불일치 → '확인 필요'
  verifyShift = true; aiCalls = [];
  await page.evaluate(() => isoGenerate());
  await page.waitForFunction(() => document.querySelectorAll('#iso-list .iso-card.iso-warn').length > 0, null, { timeout: 60000 });
  const w2 = await page.evaluate(() => ({
    warn: document.querySelectorAll('#iso-list .iso-card.iso-warn').length,
    note: (document.querySelector('#iso-list .iso-note') || {}).textContent || '',
    badge: (document.querySelector('#iso-list .iso-badge') || {}).textContent || ''
  }));
  ok('⑦ 검증 불일치 → 확인 필요', w2.warn >= 1 && /확인 필요/.test(w2.badge) && /다시 풀었을 때/.test(w2.note), w2.note.slice(0, 70));

  // ⑧ 그 문항만 다시 만들기 (2회 호출)
  verifyShift = false; aiCalls = [];
  await page.evaluate(() => isoRegen(0));
  await page.waitForFunction(() => !_isoBusy, null, { timeout: 60000 });
  await wait(400);
  const rg = await page.evaluate(() => ({ warn: document.querySelectorAll('#iso-list .iso-card.iso-warn').length, n: _isoItems.length }));
  ok('⑧ 한 문항만 다시 만들기', aiCalls.length === 2 && rg.n === 3 && rg.warn === 0, '호출 ' + aiCalls.map(c => c.kind).join('→') + ' · 확인 필요 ' + rg.warn);

  // ⑨ 인라인 편집 · 정답 바꾸기 · 순서 · 삭제
  const ed = await page.evaluate(() => {
    const first = document.querySelector('#iso-list .iso-card .iso-ed');
    first.innerText = '고친 발문입니다'; first.dispatchEvent(new Event('blur'));
    isoSetAnswer(0, 3);
    const before = _isoItems[1].id; isoMove(0, 1);
    const afterSwap = _isoItems[0].id === before;
    const n0 = _isoItems.length; isoDel(2);
    return { stem: _isoItems.find(x => x.stem === '고친 발문입니다') ? 'ok' : 'no', ans: _isoItems[1].answer, swap: afterSwap, del: n0 - _isoItems.length };
  });
  ok('⑨ 편집·정답·순서·삭제', ed.stem === 'ok' && ed.ans === 3 && ed.swap && ed.del === 1,
    JSON.stringify(ed));

  // ⑩ 인쇄 — 문제지 / 정답·해설지
  const [pq] = await Promise.all([ctx.waitForEvent('page'), page.evaluate(() => { document.getElementById('iso-title').value = '동형 시험지'; isoPrint('q'); })]);
  await pq.waitForLoadState('domcontentloaded');
  const qh = await pq.evaluate(() => ({ h: document.body.innerText.slice(0, 200), ok: document.querySelectorAll('.qc li.ok').length, q: document.querySelectorAll('.q').length }));
  await pq.close();
  const [pa] = await Promise.all([ctx.waitForEvent('page'), page.evaluate(() => { document.getElementById('iso-cols').value = '2'; isoPrint('a'); })]);
  await pa.waitForLoadState('domcontentloaded');
  const ah = await pa.evaluate(() => ({ ok: document.querySelectorAll('.qc li.ok').length, ans: document.querySelectorAll('.qa').length, two: getComputedStyle(document.querySelector('.wrap')).columnCount, t: document.title }));
  await pa.screenshot({ path: SCR + '/iso_print_a.png', fullPage: true });
  await pa.close();
  ok('⑩ 문제지에는 정답 표시 없음', qh.ok === 0 && qh.q === 2 && /직결영어/.test(qh.h) && /이름/.test(qh.h), '문항 ' + qh.q + '개 · 머리말 ' + qh.h.split('\n')[1]);
  ok('⑪ 정답·해설지 · 2단', ah.ok >= 1 && ah.ans >= 2 && ah.two === '2', '정답 표시 ' + ah.ok + ' · 해설 줄 ' + ah.ans + ' · 단 ' + ah.two);

  // ⑫ 저장 — 원본 이미지·원본 글이 저장되지 않는지
  await page.evaluate(() => isoSave());
  await wait(900);
  const sv = JSON.stringify(saved || {});
  ok('⑫ 저장 내용에 원본이 없다', !!saved && !/base64|"imgs"|iVBOR/.test(sv) && /"kind":"iso"/.test(sv) && /"items":\[/.test(sv),
    saved ? ('크기 ' + Math.round(sv.length / 1024) + 'KB · kind=' + (saved.data || {}).kind + ' · 문항 ' + ((saved.data || {}).items || []).length) : '저장 안 됨');

  // ⑬ 저장된 워크시트에서 다시 열기
  const re = await page.evaluate(async id => {
    switchDataTab('iso'); isoNew();
    const n0 = _isoItems.length;
    isoOpenSaved(id);
    await new Promise(r => setTimeout(r, 400));
    return { n0: n0, n: _isoItems.length, title: document.getElementById('iso-title').value, cards: document.querySelectorAll('#iso-list .iso-card').length };
  }, (saved && saved.id) || '');
  ok('⑬ 저장 후 다시 열기', re.n0 === 0 && re.n === 2 && re.cards === 2 && re.title === '동형 시험지', JSON.stringify(re));

  // ⑭ 체험 모드·학생에서는 안 보인다
  const gate = await page.evaluate(() => {
    const before = isoMayUse();
    let inSandbox = null;
    try { PP_SANDBOX = true; inSandbox = isoMayUse(); PP_SANDBOX = false; } catch (e) { inSandbox = 'n/a'; }
    return { before: before, inSandbox: inSandbox };
  });
  ok('⑭ 체험 모드에서는 쓸 수 없다', gate.before === true && (gate.inSandbox === false || gate.inSandbox === 'n/a'), JSON.stringify(gate));

  // ⑮ 화면 넘침
  const over = async w => { await page.setViewportSize({ width: w, height: 880 }); await wait(700); return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)); };
  const o1440 = await over(1440); await page.screenshot({ path: SCR + '/iso_1440.png' });
  const o390 = await over(390); await page.screenshot({ path: SCR + '/iso_390.png' });
  const o320 = await over(320); await page.screenshot({ path: SCR + '/iso_320.png' });
  ok('⑮ 넘침 0 (1440·390·320)', o1440 === 0 && o390 === 0 && o320 === 0, [o1440, o390, o320].join(' / '));

  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent/i;
  const mine = errs.filter(e => !skip.test(e) && e.indexOf('400') < 0);
  ok('⑯ 콘솔 오류 0', mine.length === 0, mine.slice(0, 3).join(' | ') || '0');

  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
