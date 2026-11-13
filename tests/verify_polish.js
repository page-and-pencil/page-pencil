require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
const { pageUrl, fileUrl } = require('./_page');
// 시험지 다듬기 확인 — 배점·쪽 번호(PDF)·인쇄 단추 자리·장문 묶음·복제/기기 삭제
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));
const t0 = 1762000000000;
const P = 'Reading widely does more than fill a shelf. It teaches a reader to hold two ideas at once, to wait before judging, and to ask what a writer has left unsaid. ';
const mk = (id, o) => Object.assign({
  id, type: 'blank', typeName: '읽기 · 빈칸 추론', skill: 'read', grade: '고2', diff: 3, diffSrc: 'rule',
  stem: '다음 빈칸에 들어갈 말로 가장 적절한 것은?', passage: P, choices: ['keep asking', 'memorize more', 'avoid problems', 'work alone', 'follow rules'],
  answer: 0, explain: '해설', wrong: [], words: 28, points: null,
  src: { kind: 'exam', exam: '2026학년도 9월 모의평가 영어', qno: '31' }, tags: [], star: false, checked: false,
  createdAt: t0, editedAt: t0
}, o);
const seed = [];
const TYPES = ['purpose', 'mood', 'claim', 'gist', 'topic', 'title', 'grammar', 'vocab', 'blank', 'order', 'insert', 'summary', 'irrelevant', 'implicit', 'chart', 'notice', 'bio', 'l_purpose', 'l_gist', 'l_pay'];
TYPES.forEach((t, i) => seed.push(mk('x' + t, { type: t, typeName: '', stem: '[' + t + '] 물음', answer: i % 5, points: (i % 4 === 0) ? 3 : null })));
// 장문 묶음 2개 (long2 2문항 · long3 3문항)
['a', 'b'].forEach((s, si) => {
  const n = si === 0 ? 2 : 3, ty = si === 0 ? 'long2' : 'long3';
  for (let k = 1; k <= n; k++) seed.push(mk('L' + s + k, {
    type: ty, typeName: '', setId: 'set' + s, setOrder: k, passage: P + P,
    stem: '[' + ty + ' ' + k + '] 윗글에 대한 물음', answer: k % 5, points: 2
  }));
});
seed.push(mk('p3a', { points: 3, stem: '3점짜리 빈칸 문항입니다', type: 'blank' }));

function pdfStreams(buf) {
  const out = []; let i = 0;
  while (true) {
    const a = buf.indexOf('stream', i); if (a < 0) break;
    let s = a + 6; if (buf[s] === 0x0d) s++; if (buf[s] === 0x0a) s++;
    const b = buf.indexOf('endstream', s); if (b < 0) break;
    try { out.push(zlib.inflateSync(buf.slice(s, b)).toString('latin1')); } catch (e) { }
    i = b + 9;
  }
  return out;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); ['pp_ib_filters', 'pp_item_basket', 'pp_paper_frames'].forEach(k => localStorage.removeItem(k)); } catch (e) { } });
  const page = await ctx.newPage();
  const DB = new Map(seed.map(d => [d.id, { id: d.id, data: d, updated_at: '2026-11-12T00:00:00+00:00' }]));
  const wsDB = new Map();
  let wsPosts = [], aiCalls = 0;
  const light = r => {
    const d = r.data || {}, p = String(d.passage || '');
    const m = { ...d, preview: p.slice(0, 180), hasPassage: !!d.passage };
    delete m.passage; delete m.explain; delete m.wrong; delete m.id;
    return { id: r.id, updated_at: r.updated_at, meta: m };
  };
  await page.route('**/rest/v1/item_bank**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST') return r.fulfill({ status: 201, body: '' });
    const sel = url.searchParams.get('select') || '';
    if (sel === 'updated_at') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + DB.size, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify([{ updated_at: '2026-11-12T00:00:00+00:00' }]) });
    let rows = [...DB.values()];
    const idq = url.searchParams.get('id');
    if (idq && idq.startsWith('eq.')) rows = rows.filter(x => x.id === decodeURIComponent(idq.slice(3)));
    else if (idq && idq.startsWith('in.(')) { const ids = idq.slice(4, -1).split(',').map(decodeURIComponent); rows = rows.filter(x => ids.indexOf(x.id) >= 0); }
    const out = sel.indexOf('meta') >= 0 ? rows.map(light) : sel === 'data' ? rows.map(x => ({ data: x.data }))
      : sel === 'id,data' ? rows.map(x => ({ id: x.id, data: x.data })) : rows.map(x => ({ id: x.id, updated_at: x.updated_at }));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await page.route('**/rest/v1/worksheets**', async r => {
    if (r.request().method() === 'POST') {
      let row = {}; try { row = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
      wsPosts.push(row); if (row && row.id) wsDB.set(row.id, { id: row.id, data: row.data, updated_at: new Date().toISOString() });
      return r.fulfill({ status: 201, body: '' });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...wsDB.values()]) });
  });
  await page.route('**/functions/v1/claude-proxy', r => { if (r.request().method() === 'POST') aiCalls++; return r.fulfill({ status: 400, body: '{}' }); });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));
  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(1800);
  const aiBoot = aiCalls;
  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('items'); });
  await page.waitForFunction(() => document.querySelectorAll('#ib-list .ib-card').length > 0, null, { timeout: 60000 });
  await wait(800);

  // ── 1) 배점 기본값 ──────────────────────────────────────────────────
  const pt = await page.evaluate(async () => {
    await pbOpen(['p3a', 'xpurpose', 'xmood', 'Lb1', 'Lb2', 'Lb3']);
    await new Promise(r => setTimeout(r, 1200));
    document.getElementById('pb-h-exam').value = '2026학년도 1학기 중간고사'; pbHeader('exam', '2026학년도 1학기 중간고사');
    const vals = [...document.querySelectorAll('#pb-list .pb-pt input')].map(i => i.value);
    return { vals, sum: document.getElementById('pb-sum').innerText, pt: [_pbPt('p3a'), _pbPt('xmood'), _pbPt('Lb1')] };
  });
  ok('① 배점 칸이 문항의 배점으로 채워진다 (없으면 2)',
    pt.pt[0] === 3 && pt.pt[1] === 2 && pt.pt[2] === 2 && pt.vals[0] === '3' && pt.vals.filter(v => v === '2').length >= 4,
    '칸 ' + pt.vals.join(',') + ' · p3a ' + pt.pt[0] + '점');
  ok('② 배점 합계를 문항 수 옆에 보인다', /문항 6 ?개 · 배점 14 ?점/.test(pt.sum.replace(/\s+/g, ' ')), pt.sum.replace(/\s+/g, ' ').slice(0, 60));

  // ── 2) 인쇄 HTML ────────────────────────────────────────────────────
  await page.evaluate(() => {
    window.__printed = [];
    window.open = () => { let buf = ''; return { document: { write(s) { buf += s; }, close() { window.__printed.push(buf); } } }; };
  });
  await page.evaluate(async () => {        // 여러 쪽이 되도록 문항을 더 담는다
    const more = ['xpurpose', 'xmood', 'xclaim', 'xgist', 'xtopic', 'xtitle', 'xgrammar', 'xvocab', 'xblank', 'xorder',
      'xinsert', 'xsummary', 'xirrelevant', 'ximplicit', 'xchart', 'xnotice', 'xbio', 'La1', 'La2'];
    more.forEach(id => { if (!_pbSlots.some(s2 => s2.id === id)) _pbSlots.push({ id: id }); });
    await _pbLoadData(more); _pbSortSets(); _pbRender();
    pbSetFormat('suneung'); pbPrint('q');
  });
  await wait(500);
  const html = (await page.evaluate(() => window.__printed))[0];
  fs.writeFileSync(SCR + '/polish_suneung.html', html, 'utf8');
  ok('③ [3점] 이 찍힌다', /3점짜리 빈칸 문항입니다 <b>\[3점\]<\/b>/.test(html), (html.match(/\[3점\]/g) || []).length + '곳');
  ok('④ 쪽 번호는 @page 여백 상자로 · 빈 상자 없음',
    /@bottom-center\{content:"[^"]*직결영어[^"]*" counter\(page\)/.test(html) && !/class="bx"/.test(html) && !/class="foot"/.test(html),
    (html.match(/@bottom-center\{[^}]*\}/) || ['(없음)'])[0].slice(0, 90));

  // PDF 로 뽑아 쪽 번호가 실제로 찍히는지 본다
  const p2 = await ctx.newPage();
  await p2.goto(fileUrl(SCR + '/polish_suneung.html'));
  await wait(600);
  const pdfPath = SCR + '/polish_suneung.pdf';
  await p2.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  // 견주기용 — 같은 HTML 에서 @bottom-center 만 뺀 것
  const ctrlPath = SCR + '/polish_ctrl.html';
  fs.writeFileSync(ctrlPath, html.replace(/@bottom-center\{[^}]*\}/, ''), 'utf8');
  const p3 = await ctx.newPage();
  await p3.goto(fileUrl(ctrlPath));
  await wait(400);
  await p3.pdf({ path: SCR + '/polish_ctrl.pdf', preferCSSPageSize: true, printBackground: true });
  const rawOn = fs.readFileSync(pdfPath), rawOff = fs.readFileSync(SCR + '/polish_ctrl.pdf');
  const pages = (rawOn.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  const footOf = buf => pdfStreams(buf).filter(x => /\.3333 \.3333 \.3333 RG/.test(x) && /1 0 0 -1 [\d.]+ 10[5-9]\d Tm/.test(x));
  const fOn = footOf(rawOn), fOff = footOf(rawOff);
  // 쪽 번호는 바닥 글 다음에 오는 따로 된 글자 묶음이다 (ET BT … <glyph> Tj)
  const RE_NO = new RegExp('ET\\nBT\\n\\/F\\d+ [\\d.]+ Tf\\n1 0 0 -1 [\\d.]+ 10[5-9]\\d Tm\\n<([0-9A-Fa-f]+)> Tj');
  const lastGlyph = x => { const m = x.match(RE_NO); return m ? m[1] : ''; };
  const nums = fOn.map(lastGlyph);
  ok('⑤ PDF 쪽마다 바닥 글 + 쪽 번호', pages >= 2 && fOn.length === pages && fOff.length === 0 && nums[0] && nums[1] && nums[0] !== nums[1] && new Set(nums).size === nums.length,
    pages + '쪽 · 바닥 글 ' + fOn.length + '쪽 (규칙 뺀 것 ' + fOff.length + ') · 쪽 번호 글리프 ' + nums.join(',') + ' (쪽마다 다름)');
  await p3.close();

  // PDF 를 그림으로 떠 본다 (pdf.js)
  let shot = '';
  try {
    const p4 = await ctx.newPage();
    await p4.goto('about:blank');
    await p4.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' });
    const b64 = fs.readFileSync(pdfPath).toString('base64');
    await p4.evaluate(async d => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const raw = atob(d), arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
      const pg = await pdf.getPage(1);
      const vp = pg.getViewport({ scale: 1.4 });
      const c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height; c.id = 'cv';
      document.body.style.margin = '0'; document.body.appendChild(c);
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    }, b64);
    await p4.setViewportSize({ width: 840, height: 1200 });
    await p4.locator('#cv').screenshot({ path: SCR + '/polish_pdf_page1.png' });
    // 쪽 번호가 보이게 아래쪽만 크게
    const box = await p4.locator('#cv').boundingBox();
    await p4.screenshot({ path: SCR + '/polish_pdf_foot.png', clip: { x: 0, y: Math.max(0, box.height - 110), width: Math.min(840, box.width), height: 110 } });
    shot = 'polish_pdf_page1.png · polish_pdf_foot.png';
    await p4.close();
  } catch (e) { shot = '(pdf.js 를 불러오지 못해 그림은 못 떴습니다: ' + String(e.message).slice(0, 60) + ')'; }
  ok('⑥ PDF 그림 뜨기', !!shot, shot);
  await p2.close();

  // ── 3) 화면용 [인쇄] 단추가 머리말을 가리지 않는다 ─────────────────
  const p5 = await ctx.newPage();
  await p5.setViewportSize({ width: 900, height: 1100 });
  await p5.goto(fileUrl(SCR + '/polish_suneung.html'));
  await wait(400);
  const hit = await p5.evaluate(() => {
    const b = document.querySelector('.noprint').getBoundingClientRect();
    const h = document.querySelector('.sh-n').getBoundingClientRect();
    const over = !(b.right < h.left || b.left > h.right || b.bottom < h.top || b.top > h.bottom);
    return { over, b: [Math.round(b.top), Math.round(b.right)], h: [Math.round(h.top), Math.round(h.right)] };
  });
  await p5.emulateMedia({ media: 'print' });
  const inPrint = await p5.evaluate(() => getComputedStyle(document.querySelector('.noprint')).display);
  await p5.screenshot({ path: SCR + '/polish_screen_btn.png' });
  await p5.close();
  ok('⑦ [인쇄] 단추가 수험 번호 칸을 가리지 않는다 · 인쇄엔 안 나온다', !hit.over && inPrint === 'none',
    '단추 ' + hit.b.join(',') + ' · 수험번호 ' + hit.h.join(',') + ' · 인쇄 display=' + inPrint);

  // ── 4) 자동 구성 — 장문 묶음 통째로 ────────────────────────────────
  const aiBefore = aiCalls;
  const comp = await page.evaluate(async () => {
    document.getElementById('pb-frame').value = 'suneung28'; pbCfgChange();
    await pbCompose(); await new Promise(r => setTimeout(r, 900));
    const ids = _pbSlots.map(s => s.id || ('(빈칸:' + s.type + ')'));
    const la = ids.filter(x => /^La/.test(x)), lb = ids.filter(x => /^Lb/.test(x));
    const iA = ids.indexOf('La1'), iB = ids.indexOf('Lb1');
    return {
      n: _pbSlots.length, ids, la, lb,
      aSeq: iA >= 0 && ids[iA + 1] === 'La2',
      bSeq: iB >= 0 && ids[iB + 1] === 'Lb2' && ids[iB + 2] === 'Lb3',
      tail: ids.slice(-8)
    };
  });
  ok('⑧ 장문 묶음은 통째로 · 문항 수만큼 번호를 차지한다',
    comp.la.length === 2 && comp.lb.length === 3 && comp.aSeq && comp.bSeq && aiCalls === aiBefore,
    'long2 ' + comp.la.join('·') + ' / long3 ' + comp.lb.join('·') + ' · 끝 8칸 ' + comp.tail.join(' '));

  // ── 5) 복제 · 기기 보관분 삭제 ─────────────────────────────────────
  const dup = await page.evaluate(async () => {
    await pbOpen(['xpurpose', 'xmood']);
    await new Promise(r => setTimeout(r, 900));
    await _pbSave(true);
    const first = _pbPaper.id, title0 = _pbPaper.title;
    await pbDuplicate();
    await new Promise(r => setTimeout(r, 900));
    return { first, title0, second: _pbPaper.id, title1: _pbPaper.title, n: (_cache.worksheets || []).filter(w => w.kind === 'paper').length };
  });
  ok('⑨ 시험지 복제 (원본은 그대로)', dup.first !== dup.second && /복사본/.test(dup.title1) && dup.n >= 2,
    '원본 "' + dup.title0 + '" · 사본 "' + dup.title1 + '" · 시험지 ' + dup.n + '장');
  const del = await page.evaluate(async () => {
    await idbSet('pp_paper_dev', [{ id: 'devpaper1', kind: 'paper', title: '기기 보관 시험지', itemIds: ['xmood'], createdAt: Date.now() }]);
    switchDataTab('ws');
    await new Promise(r => setTimeout(r, 1500));
    const card = [...document.querySelectorAll('#ws-cards .bcard')].find(c => /기기 보관 시험지/.test(c.innerText));
    const btn = card ? card.querySelector('.bcard-acts button') : null;
    const had = !!btn;
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 400));
    document.getElementById('confirm-ok-btn').click();
    await new Promise(r => setTimeout(r, 900));
    const left = (await idbGet('pp_paper_dev')) || [];
    return { had, left: left.length };
  });
  ok('⑩ 기기 보관 시험지에 삭제 단추', del.had && del.left === 0, '단추 ' + (del.had ? '있음' : '없음') + ' · 남은 ' + del.left + '장');

  // ── 6) 내신형은 2단 그대로 ─────────────────────────────────────────
  const na = await page.evaluate(() => {
    window.__printed = [];
    pbSetFormat('naesin'); pbPrint('q');
    return window.__printed[0];
  });
  ok('⑪ 내신형은 2단 그대로', /column-count:2/.test(na) && /학년도·학기/.test(na));

  const over = async w => { await page.setViewportSize({ width: w, height: 844 }); await wait(600); return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)); };
  const o390 = await over(390), o320 = await over(320);
  ok('⑫ 넘침 0 (390·320)', o390 === 0 && o320 === 0, o390 + ' / ' + o320);
  ok('⑬ AI 호출 0회', aiCalls === aiBoot, (aiCalls - aiBoot) + '회');
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|400|404/i;
  const mine = errs.filter(e => !skip.test(e));
  ok('⑭ 콘솔 오류 0', mine.length === 0, mine.slice(0, 3).join(' | ') || '0');

  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
