require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 1) 자료 DB 칸별 스크롤  2) 동형 자동 저장  3) 지문 길이 지시
// AI 와 worksheets 저장은 모두 가짜로 받는다 — 진짜 돈·DB 를 쓰지 않는다.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const { examCatalog, catalogPath, isFake } = require('./_catalog');
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));

const all = examCatalog();                    // 없으면 tests/fixtures 의 가짜 30줄
const nowIso = new Date().toISOString();
const DB = new Map(all.map(r => [r.id, { id: r.id, data: r.data, updated_at: nowIso }]));
const META = ['cat', 'title', 'path', 'note', 'level', 'grade', 'term', 'school', 'region', 'city', 'series', 'year', 'month', 'round'];
const lightRow = r => {
  const d = r.data || {};
  const f2 = Array.isArray(d.files) ? d.files : [];
  const au = (d.audio && Array.isArray(d.audio.files)) ? d.audio.files : [];
  const meta = {};
  META.forEach(k => { const v = d[k]; if (v !== '' && v !== null && v !== undefined) meta[k] = v; });
  return { id: r.id, updated_at: r.updated_at, meta, nfiles: f2.length, kinds: [...new Set(f2.map(f => (f && f.k) || '').filter(Boolean))].sort().join(','), naudio: au.length, extaud: !!d.extAudio };
};

const ANALYZE = {
  type: 'blank', typeName: '빈칸 추론', stem: '다음 빈칸에 들어갈 말로 가장 적절한 것은?',
  passage: 'Original passage about memory and attention. '.repeat(10),
  choices: ['a', 'b', 'c', 'd', 'e'], answer: 2, evidence: 'Attention is the gate.',
  points: ['주제문 자리 빈칸'], words: 175, level: '고1 수준', distractors: '지문 단어 재활용'
};
const mkItems = n => Array.from({ length: n }, (_, i) => ({
  stem: '다음 빈칸에 들어갈 말로 가장 적절한 것은? (' + (i + 1) + ')',
  passage: 'Sample passage number ' + (i + 1) + ' about curiosity and learning. '.repeat(4),
  choices: ['keep asking questions', 'memorize more facts', 'avoid hard problems', 'work alone always', 'follow the rules'],
  answer: i % 5, explain: '글의 핵심은 "keep asking questions" 이다.', intent: '주제문 재진술 확인',
  wrong: ['① 정답', '② 지문 단어 재활용']
}));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 760 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();

  let saves = [], genPrompts = [], aiCalls = 0, ibPosts = 0;
  const arm = async p => {
    await p.route('**/functions/v1/claude-proxy', async r => {
      let body = {};
      try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
      if (!body.model) return r.fulfill({ status: 400, contentType: 'application/json', body: '{"error":{"message":"model 이 없습니다"}}' });
      aiCalls++;
      const txt = JSON.stringify(body);
      const kind = /학생처럼 풀어라/.test(txt) ? 'verify' : (/분석해서 JSON/.test(txt) ? 'analyze' : 'generate');
      let out;
      if (kind === 'analyze') out = JSON.stringify(ANALYZE);
      else if (kind === 'generate') {
        genPrompts.push(JSON.parse(r.request().postData()).messages[0].content[0].text);
        const m = txt.match(/새 문항 (\d+)개/);
        out = JSON.stringify(mkItems(m ? +m[1] : 3));
      } else {
        const nos = [...new Set((txt.match(/\\"no\\":(\d+)/g) || []).map(x => +x.replace(/\D/g, '')))];
        out = JSON.stringify((nos.length ? nos : [1]).map(no => ({ no, answer: (no - 1) % 5, evidence: '근거 문장', alt: false, why: '' })));
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: out }], usage: { input_tokens: 1200, output_tokens: 2300 } }) });
    });
    await p.route('**/rest/v1/worksheets**', async r => {
      const m = r.request().method();
      if (m === 'POST') { try { saves.push(JSON.parse(r.request().postData() || '{}')); } catch (e) { saves.push({}); } return r.fulfill({ status: 201, body: '' }); }
      if (m === 'DELETE') return r.fulfill({ status: 204, body: '' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await p.route('**/rest/v1/item_bank**', async r => {
      if (r.request().method() === 'POST') { ibPosts++; return r.fulfill({ status: 201, body: '' }); }
      return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await p.route('**/rest/v1/exam_bank**', async r => {
      const req = r.request(), url = new URL(req.url());
      if (req.method() === 'POST') return r.fulfill({ status: 201, body: '' });
      const isIdx = url.pathname.endsWith('/exam_bank_index');
      const sel = url.searchParams.get('select') || '';
      if (sel === 'updated_at') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + DB.size, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify([{ updated_at: nowIso }]) });
      const limit = +(url.searchParams.get('limit') || 1000), off = +(url.searchParams.get('offset') || 0);
      let rows = [...DB.values()];
      const idq = url.searchParams.get('id');
      if (idq && idq.startsWith('eq.')) rows = rows.filter(x => x.id === decodeURIComponent(idq.slice(3)));
      else if (idq && idq.startsWith('in.(')) { const ids = idq.slice(4, -1).split(',').map(decodeURIComponent); rows = rows.filter(x => ids.indexOf(x.id) >= 0); }
      else rows = rows.slice(off, off + limit);
      let out;
      if (isIdx) { out = rows.map(lightRow); if (sel === 'id,updated_at') out = out.map(x => ({ id: x.id, updated_at: x.updated_at })); }
      else if (sel === 'data') out = rows.map(x => ({ data: x.data }));
      else if (sel === 'id,updated_at') out = rows.map(x => ({ id: x.id, updated_at: x.updated_at }));
      else out = rows;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
    });
    await p.route('**drive.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>drive</body></html>' }));
  };
  await arm(page);
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));

  const boot = async () => {
    await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 });
    await wait(1800);
  };
  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await boot();

  // ── 2) 동형 자동 저장 ──────────────────────────────────────────────────
  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('iso'); isoNew(); });
  await wait(600);
  await page.evaluate(() => {
    document.getElementById('iso-text').value = '다음 빈칸에 들어갈 말로 가장 적절한 것은? (원본 문항 글)';
    isoTextChange();
    document.getElementById('iso-n').value = '5';
    document.getElementById('iso-type').value = 'blank';
    document.getElementById('iso-passage').value = 'new';
    isoCfgChange();
  });
  await page.evaluate(() => isoGenerate());
  await page.waitForFunction(() => document.querySelectorAll('#iso-list .iso-card').length > 0, null, { timeout: 60000 });
  await wait(2200);
  const g1 = await page.evaluate(() => ({
    n: document.querySelectorAll('#iso-list .iso-card').length,
    stat: (document.getElementById('iso-stat') || {}).textContent || '',
    title: (document.getElementById('iso-title') || {}).value || '',
    top: Math.round(document.getElementById('dp-iso').scrollTop),
    firstTop: Math.round(document.querySelector('#iso-list .iso-card').getBoundingClientRect().top - document.getElementById('dp-iso').getBoundingClientRect().top),
    shortTag: [...document.querySelectorAll('.iso-len')].map(e => e.textContent).join(','),
    saveBtn: (document.getElementById('iso-save') || {}).textContent || ''
  }));
  ok('① 만든 직후 자동 저장', saves.length === 1 && /^저장됨 \d\d:\d\d( · 은행 \d+문항)?$/.test(g1.stat), '저장 ' + saves.length + '회 · 상태 "' + g1.stat + '"');
  ok('② 제목을 알아서 붙임', /^빈칸 추론 5문항 · \d\d-\d\d \d\d:\d\d$/.test(g1.title), '"' + g1.title + '"');
  ok('③ 저장된 것은 문항뿐 (원본 글·이미지 없음)',
    saves[0] && saves[0].data && saves[0].data.kind === 'iso' && (saves[0].data.items || []).length === 5 &&
    !JSON.stringify(saves[0]).includes('원본 문항 글'),
    'items ' + ((saves[0] && saves[0].data && saves[0].data.items) || []).length + '개');
  ok('④ 첫 문항이 보이게 내려감', g1.top > 0 && g1.firstTop >= -4 && g1.firstTop < 120, 'scrollTop ' + g1.top + ' · 첫 카드 위치 ' + g1.firstTop);
  ok('⑤ 지문 길이 표시 (짧음)', /짧음/.test(g1.shortTag), g1.shortTag || '(없음)');
  ok('⑥ 저장 단추는 [지금 저장]', g1.saveBtn.trim() === '지금 저장', g1.saveBtn.trim());

  // 지문 길이 지시 문구
  const lenLine = (genPrompts[0] || '').split('\n').filter(l => /지문 길이/.test(l) || /단어로 쓴다/.test(l)).join(' / ');
  ok('⑦ 지문 길이를 숫자로 지시', /175단어/.test(lenLine) && /158~193단어/.test(lenLine), lenLine.slice(0, 120));

  // 고치기 — 1.5초 모아서 한 번
  const before = saves.length;
  await page.evaluate(() => { isoSetAnswer(0, 3); isoMove(1, 1); });
  await wait(700);
  const mid = saves.length;
  await wait(1800);
  const after = saves.length;
  const stat2 = await page.evaluate(() => (document.getElementById('iso-stat') || {}).textContent || '');
  ok('⑧ 고치기는 1.5초 모아 한 번', mid === before && after === before + 1 && /^저장됨 \d\d:\d\d( · 은행 \d+문항)?$/.test(stat2),
    '0.7초 뒤 ' + (mid - before) + '회 · 2.5초 뒤 ' + (after - before) + '회 · "' + stat2 + '"');

  // 새로고침 뒤 되살리기
  const idBefore = await page.evaluate(() => _isoRowId);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await boot();
  const r1 = await page.evaluate(async () => {
    show('s-teacher'); swTab('t-data'); switchDataTab('iso');
    await new Promise(r => setTimeout(r, 1500));
    return { n: _isoItems.length, id: _isoRowId, title: (document.getElementById('iso-title') || {}).value || '', ans: (_isoItems[0] || {}).answer };
  });
  ok('⑨ 새로고침 뒤 마지막 작업 되살림', r1.n === 5 && r1.id === idBefore && r1.ans === 3, '문항 ' + r1.n + '개 · 같은 묶음 ' + (r1.id === idBefore) + ' · 고친 정답 ' + r1.ans);

  // 원문 지문 묶음 — 서버에 안 올리고 기기에만
  const beforeKeep = saves.length;
  await page.evaluate(() => { isoNew(); document.getElementById('iso-text').value = '원본 지문 문항'; isoTextChange(); document.getElementById('iso-n').value = '2'; document.getElementById('iso-type').value = 'blank'; document.getElementById('iso-passage').value = 'keep'; isoCfgChange(); });
  await page.evaluate(() => isoGenerate());
  await page.waitForFunction(() => document.querySelectorAll('#iso-list .iso-card').length === 2, null, { timeout: 60000 });
  await wait(2200);
  const k1 = await page.evaluate(() => ({
    stat: (document.getElementById('iso-stat') || {}).textContent || '',
    note: (document.getElementById('iso-nosave') || {}).textContent || '',
    noteVis: (document.getElementById('iso-nosave') || {}).style.display !== 'none',
    saveVis: (document.getElementById('iso-save') || {}).style.display !== 'none',
    keep: _isoItems.every(it => it.srcKeep)
  }));
  ok('⑩ 원문 지문 묶음은 서버 저장 0회', saves.length === beforeKeep && k1.keep, '저장 ' + (saves.length - beforeKeep) + '회');
  ok('⑪ 기기 보관 안내', /기기에만 보관/.test(k1.stat) && k1.noteVis && /기기에만 보관/.test(k1.note) && k1.saveVis, '"' + k1.stat + '" · 안내 ' + k1.noteVis + ' · 지금저장 ' + k1.saveVis);
  const k2 = await page.evaluate(async () => { await isoSave(); return (document.getElementById('iso-stat') || {}).textContent || ''; });
  ok('⑫ [지금 저장] 을 눌러도 서버엔 안 올라감', saves.length === beforeKeep && /기기에만 보관/.test(k2), '저장 ' + (saves.length - beforeKeep) + '회');
  const pr = await page.evaluate(() => { let opened = false; const o = window.open; window.open = () => { opened = true; return { document: { write() { }, close() { } } }; }; try { isoPrint('q'); } catch (e) { } window.open = o; return opened; });
  ok('⑬ 원문 지문 묶음도 인쇄는 된다', pr === true);

  // 문항 0개 · 새로 시작 · 체험 모드
  const before0 = saves.length;
  await page.evaluate(() => { isoNew(); });
  await wait(400);
  await page.evaluate(() => { _isoItems = [{ id: 'x', type: 'blank', typeName: '읽기 · 빈칸 추론', stem: 's', passage: 'p p p', choices: ['a', 'b'], answer: 0, explain: 'e', wrong: [], check: false, checkNote: '' }]; _isoRender(); isoDel(0); });
  await wait(2000);
  const z = await page.evaluate(() => ({ n: _isoItems.length, stat: (document.getElementById('iso-stat') || {}).textContent || '' }));
  ok('⑭ 문항 0개면 저장하지 않음', saves.length === before0 && z.n === 0 && z.stat === '', '저장 ' + (saves.length - before0) + '회 · 상태 "' + z.stat + '"');
  const sb = await page.evaluate(async () => {
    const real = window.ppSandbox; window.ppSandbox = () => true;
    _isoItems = [{ id: 'y', type: 'blank', typeName: '읽기 · 빈칸 추론', stem: 's', passage: 'p', choices: ['a', 'b'], answer: 0, explain: 'e', wrong: [], check: false }];
    const r = await _isoAutoSave(true);
    const st = (document.getElementById('iso-stat') || {}).textContent || '';
    window.ppSandbox = real; _isoItems = []; _isoRender();
    return { r, st };
  });
  ok('⑮ 체험 모드에서는 저장 안 함', saves.length === before0 && sb.r === false && /체험 모드/.test(sb.st), '"' + sb.st + '"');

  // 새로 시작 뒤 새로고침 → 되살리지 않는다
  await page.evaluate(() => isoNew());
  await wait(500);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await boot();
  const r2 = await page.evaluate(async () => { show('s-teacher'); swTab('t-data'); switchDataTab('iso'); await new Promise(r => setTimeout(r, 1500)); return _isoItems.length; });
  ok('⑯ [새로 시작] 뒤에는 되살리지 않음', r2 === 0, '문항 ' + r2 + '개');

  // ── 1) 칸별 스크롤 ────────────────────────────────────────────────────
  await page.setViewportSize({ width: 1440, height: 430 });
  // 동형 칸에 내용 채우기 (AI 없이)
  await page.evaluate(() => {
    _isoItems = Array.from({ length: 6 }, (_, i) => ({
      id: 'f' + i, type: 'blank', typeName: '읽기 · 빈칸 추론', stem: '발문 ' + (i + 1),
      passage: 'Long passage text for scrolling test. '.repeat(14), choices: ['a', 'b', 'c', 'd', 'e'],
      answer: i % 5, explain: '해설', intent: '의도', wrong: [], check: false, checkNote: '', srcWords: 175
    }));
    _isoRender();
  });
  const tabs = [['tbook', '교재'], ['lib', '원서'], ['word', '어휘'], ['ws', '저장된 워크시트'], ['iso', '동형 문제'], ['exam', '시험 일정'], ['master', '백업·일괄'], ['bank', '자료실']];
  const rows = [];
  for (const [t, nm] of tabs) {
    await page.evaluate(x => { show('s-teacher'); swTab('t-data'); switchDataTab(x); }, t);
    if (t === 'bank') { await page.waitForFunction(() => document.querySelectorAll('#eb-list .eb-row').length > 0, null, { timeout: 150000 }); }
    await wait(1400);
    const r = await page.evaluate(() => {
      const p = [...document.querySelectorAll('#t-data > div[id^="dp-"]')].find(e => e.offsetParent !== null);
      if (!p) return { panel: '(없음)' };
      const pr = p.getBoundingClientRect();
      const scs = [p, ...p.querySelectorAll('*')].filter(e => {
        const s = getComputedStyle(e);
        return /(auto|scroll)/.test(s.overflowY) && (e.scrollHeight - e.clientHeight) > 4;
      });
      const over = p.scrollHeight - p.clientHeight;
      let moved = 0;
      scs.forEach(s => { s.scrollTop = 0; const a = s.scrollTop; s.scrollTop = s.scrollHeight; moved += s.scrollTop - a; });
      const inScroller = e => scs.some(s => s !== e && s.contains(e));
      const vis = [...p.querySelectorAll('*')].filter(e => e.offsetParent !== null && e.getBoundingClientRect().height > 0 && !inScroller(e));
      const maxBottom = vis.length ? Math.max(...vis.map(e => e.getBoundingClientRect().bottom)) : pr.bottom;
      return {
        panel: p.id, h: Math.round(pr.height), content: Math.round(p.scrollHeight), overflow: over > 4,
        scroller: scs.length ? scs.map(s => s.id ? ('#' + s.id) : ('.' + String(s.className || '').split(' ')[0])).join('+') : '(없음)',
        moved: Math.round(moved), reach: maxBottom <= pr.bottom + 8, cut: Math.round(maxBottom - pr.bottom)
      };
    });
    rows.push({ tab: nm, ...r });
  }
  const bad = rows.filter(r => !r.reach);
  ok('⑰ 모든 자료 DB 칸이 끝까지 스크롤된다', bad.length === 0, bad.length ? bad.map(b => b.tab + '(' + b.panel + ' 잘림 ' + b.cut + 'px)').join(' / ') : rows.length + '칸');

  // 자료실 — 미리보기 창·재생기 열어 둔 채 목록 스크롤
  const zrow = all.find(r => r.data.cat === 'audiobook' && (r.data.audio || {}).files && r.data.audio.files.length > 3);
  const m1 = await page.evaluate(async id => {
    const p = document.getElementById('dp-bank');
    p.scrollTop = 0;
    await ebOpenDetail(id); await new Promise(r => setTimeout(r, 1200));
    ebAuOpen(0); await new Promise(r => setTimeout(r, 900));
    p.scrollTop = 600;
    const withOpen = p.scrollTop;
    const body = document.getElementById('eb-d-body');
    const bodyScroll = body ? (body.scrollHeight - body.clientHeight > 4) : false;
    ebCloseDetail(); await new Promise(r => setTimeout(r, 500));
    p.scrollTop = 900;
    return { withOpen: Math.round(withOpen), afterClose: Math.round(p.scrollTop), frames: document.querySelectorAll('#eb-d-body iframe').length, bodyScroll };
  }, zrow.id);
  ok('⑱ 미리보기·재생기 열려 있어도 목록이 스크롤된다', m1.withOpen > 100 && m1.afterClose > 100,
    '열린 채 ' + m1.withOpen + 'px · 닫은 뒤 ' + m1.afterClose + 'px · 닫을 때 재생기 ' + m1.frames + '개');

  // ── 넘침 · 오류 ───────────────────────────────────────────────────────
  const over = async w => { await page.setViewportSize({ width: w, height: 800 }); await wait(700); return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)); };
  await page.evaluate(() => switchDataTab('iso'));
  await wait(600);
  const o1440 = await over(1440), o390 = await over(390), o320 = await over(320);
  await page.screenshot({ path: SCR + '/iso_auto_320.png' });
  ok('⑲ 넘침 0 (1440·390·320)', o1440 === 0 && o390 === 0 && o320 === 0, [o1440, o390, o320].join(' / '));
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|400/i;
  const mine = errs.filter(e => !skip.test(e));
  ok('⑳ 콘솔 오류 0', mine.length === 0, mine.slice(0, 3).join(' | ') || '0');

  console.log('\n── 자료 DB 칸별 스크롤 ──');
  console.log('탭              패널  내용   넘침  스크롤되는 칸        움직임  끝까지');
  rows.forEach(r => console.log(
    (r.tab + '                ').slice(0, 16) +
    String(r.h).padStart(4) + String(r.content).padStart(6) + '   ' + (r.overflow ? 'O' : '-') + '    ' +
    (r.scroller + '                    ').slice(0, 20) + String(r.moved).padStart(5) + 'px  ' + (r.reach ? 'O' : 'X(' + r.cut + 'px)')));
  console.log('\nAI 호출 ' + aiCalls + '회(전부 가짜) · worksheets 저장 ' + saves.length + '회(전부 가짜)');
  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
