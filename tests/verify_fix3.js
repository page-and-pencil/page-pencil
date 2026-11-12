require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 확인 — ① 자료실 듣기(드라이브 재생기 하나씩) ② 동형 ② 원문 지문은 저장 막기
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const CAT = (process.env.PP_EXAM_CATALOG || '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));

const all = JSON.parse(fs.readFileSync(CAT, 'utf8'));
const now = new Date().toISOString();
const DB = new Map(all.map(r => [r.id, { id: r.id, data: r.data, updated_at: now }]));
const META = ['cat', 'title', 'path', 'note', 'level', 'grade', 'term', 'school', 'region', 'city', 'series', 'year', 'month', 'round'];
function lightRow(r) {
  const d = r.data || {};
  const f2 = Array.isArray(d.files) ? d.files : [];
  const au = (d.audio && Array.isArray(d.audio.files)) ? d.audio.files : [];
  const meta = {};
  META.forEach(k => { const v = d[k]; if (v !== '' && v !== null && v !== undefined) meta[k] = v; });
  return { id: r.id, updated_at: r.updated_at, meta, nfiles: f2.length, kinds: [...new Set(f2.map(f => (f && f.k) || '').filter(Boolean))].sort().join(','), naudio: au.length, extaud: !!d.extAudio };
}
const driveRow = all.find(r => ((r.data.audio || {}).files || []).length > 3 && !r.data.extAudio);
// 지금 카탈로그에는 extAudio 행이 없어서, 같은 모양으로 하나 만들어 끼운다
const extRow = { id: 'exttest1', data: { ...JSON.parse(JSON.stringify(driveRow.data)), title: 'EBS 링크 시험용', audio: { files: [] }, extAudio: 'https://wdown.ebsi.co.kr/test/eng_mp3.mp3' } };
DB.set(extRow.id, { id: extRow.id, data: extRow.data, updated_at: now });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();

  const handleBank = async r => {
    const req = r.request(), url = new URL(req.url());
    const isIdx = url.pathname.endsWith('/exam_bank_index');
    if (req.method() === 'POST') return r.fulfill({ status: 201, body: '' });
    const sel = url.searchParams.get('select') || '';
    if (sel === 'updated_at') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + DB.size, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify([{ updated_at: now }]) });
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
  };
  await page.route('**/rest/v1/**', r => {
    if (/\/rest\/v1\/exam_bank/.test(r.request().url())) return handleBank(r);
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**drive.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>drive player</body></html>' }));
  // 드라이브 직접 내려받기는 라이브처럼 막힌 것으로 둔다 — 코드가 아예 안 불러야 한다
  let dlHits = 0;
  await page.route('**drive.usercontent.google.com/**', r => { dlHits++; return r.fulfill({ status: 403, body: '' }); });
  // 동형: AI 와 저장은 가짜로
  let savedCount = 0;
  await page.route('**/functions/v1/claude-proxy', async r => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
    if (!b.model) return r.fulfill({ status: 400, contentType: 'application/json', body: '{"error":{"message":"model 이 없습니다"}}' });
    const txt = JSON.stringify(b).slice(0, 3000);
    let out;
    if (/학생처럼 풀어라/.test(txt)) {
      const nos = (txt.match(/\\"no\\":(\d+)/g) || []).map(x => +x.replace(/\D/g, ''));
      out = JSON.stringify([...new Set(nos.length ? nos : [1])].map(no => ({ no, answer: (no - 1) % 5, evidence: 'ev', alt: false })));
    } else if (/분석해서 JSON/.test(txt)) out = JSON.stringify({ type: 'blank', stem: '발문', passage: 'orig', choices: ['a', 'b', 'c', 'd', 'e'], answer: 1, words: 120 });
    else out = JSON.stringify([0, 1].map(i => ({ stem: '발문 ' + (i + 1), passage: 'p '.repeat(20), choices: ['a', 'b', 'c', 'd', 'e'], answer: i % 5, explain: '해설', intent: '의도' })));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: out }], usage: { input_tokens: 10, output_tokens: 10 } }) });
  });
  await page.route('**/rest/v1/worksheets**', r => {
    if (r.request().method() === 'POST') { savedCount++; return r.fulfill({ status: 201, body: '' }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 150)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 150)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 });
  await wait(2000);
  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('bank'); });
  await page.waitForFunction(() => document.querySelectorAll('#eb-list .eb-row').length > 0, null, { timeout: 120000 });

  // ── 드라이브 음원 ─────────────────────────────────────────────
  const a1 = await page.evaluate(async id => {
    await ebOpenDetail(id); await new Promise(r => setTimeout(r, 1200));
    const b = document.getElementById('eb-d-body');
    return {
      names: b.querySelectorAll('.eb-aub').length,
      audios: b.querySelectorAll('audio').length,
      frames: b.querySelectorAll('iframe').length,
      playAll: /전체 이어 듣기/.test(b.innerText),
      rep: b.querySelectorAll('.eb-rep').length,
      firstName: (b.querySelector('.eb-aun') || {}).textContent || ''
    };
  }, driveRow.id);
  ok('① 처음엔 이름만 (오디오·재생기 0)', a1.names > 3 && a1.audios === 0 && a1.frames === 0,
    '이름 ' + a1.names + '개 · audio ' + a1.audios + ' · iframe ' + a1.frames + ' · "' + a1.firstName.slice(0, 34) + '"');
  ok('② 전체 이어 듣기·반복 없음', !a1.playAll && a1.rep === 0, '이어듣기 ' + a1.playAll + ' · 반복 ' + a1.rep);

  const a2 = await page.evaluate(async () => {
    ebAuOpen(0); await new Promise(r => setTimeout(r, 500));
    const b = document.getElementById('eb-d-body');
    const f = b.querySelector('.eb-aubox iframe');
    return {
      frames: b.querySelectorAll('iframe').length, src: f ? f.src : '',
      next: /다음 문항/.test(b.innerText), on: b.querySelectorAll('.eb-aub.on').length
    };
  });
  ok('③ ▶ 누르면 드라이브 재생기 1개', a2.frames === 1 && /\/preview/.test(a2.src) && /authuser=/.test(a2.src) && a2.on === 1,
    a2.src.slice(0, 80));
  ok('④ 다음 문항 ▶ 단추', a2.next, String(a2.next));

  const a3 = await page.evaluate(async () => {
    ebAuOpen(1); await new Promise(r => setTimeout(r, 500));
    const b = document.getElementById('eb-d-body');
    return { frames: b.querySelectorAll('iframe').length, on: b.querySelectorAll('.eb-aub.on').length, idx: _ebAuIdx };
  });
  ok('⑤ 다른 것을 열면 앞의 것은 닫힌다', a3.frames === 1 && a3.on === 1 && a3.idx === 1, 'iframe ' + a3.frames + ' · 켜진 줄 ' + a3.on);

  const a4 = await page.evaluate(async () => {
    ebAuOpen(1); await new Promise(r => setTimeout(r, 300));          // 같은 것 다시 → 닫기
    const b = document.getElementById('eb-d-body');
    const o = { frames: b.querySelectorAll('iframe').length, idx: _ebAuIdx };
    ebAuOpen(0); await new Promise(r => setTimeout(r, 300));
    ebCloseDetail(); await new Promise(r => setTimeout(r, 300));
    o.afterClose = document.querySelectorAll('#eb-d-body iframe').length;
    return o;
  });
  ok('⑥ 같은 것 다시 누르면 닫힘 · 상세를 닫으면 재생기도 닫힘', a4.frames === 0 && a4.idx === -1 && a4.afterClose === 0,
    'iframe ' + a4.frames + ' → 상세 닫은 뒤 ' + a4.afterClose);
  ok('⑦ 드라이브 직접 내려받기를 아예 안 부른다', dlHits === 0, dlHits + '회');

  // ── EBS 링크(extAudio) 는 그대로 ──────────────────────────────
  const e1 = await page.evaluate(async id => {
    await ebOpenDetail(id); await new Promise(r => setTimeout(r, 1200));
    const b = document.getElementById('eb-d-body');
    const au = b.querySelector('audio');
    return { audios: b.querySelectorAll('audio').length, src: au ? au.getAttribute('src') : '', names: b.querySelectorAll('.eb-aub').length };
  }, extRow.id);
  ok('⑧ EBS 링크는 지금 그대로 <audio>', e1.audios === 1 && /^https?:/.test(e1.src) && !/drive/.test(e1.src),
    e1.src.slice(0, 70) + ' · 드라이브 목록 ' + e1.names);
  await page.screenshot({ path: SCR + '/eb_audio_new.png' });
  await page.evaluate(() => ebCloseDetail());

  // ── 동형: ② 원본 지문 유지 → 저장 막힘 ────────────────────────
  await page.evaluate(() => { switchDataTab('iso'); isoNew(); });
  await page.evaluate(async () => {
    document.getElementById('iso-text').value = '원본 문항 글';
    isoTextChange();
    document.getElementById('iso-passage').value = 'keep';
    document.getElementById('iso-n').value = '2';
    isoCfgChange();
  });
  await page.evaluate(() => isoGenerate());
  await page.waitForFunction(() => !_isoBusy && _isoItems.length > 0, null, { timeout: 90000 });
  await wait(500);
  const k = await page.evaluate(async () => {
    const sb = document.getElementById('iso-save'), ns = document.getElementById('iso-nosave');
    const before = { save: sb.style.display, note: ns.style.display, text: ns.textContent };
    await isoSave();
    await new Promise(r => setTimeout(r, 600));
    return { ...before, toast: (document.getElementById('toast') || {}).textContent || '' };
  });
  ok('⑨ ② 원문 지문 — 저장 단추 숨김 · 안내 보임', k.save === 'none' && k.note !== 'none' && /저장하지 않아요/.test(k.text), k.text);
  ok('⑩ 저장을 불러도 저장되지 않는다', savedCount === 0 && /인쇄로만/.test(k.toast), '저장 ' + savedCount + '회 · "' + k.toast + '"');

  // ① 새 지문은 그대로 저장된다
  const n1 = await page.evaluate(async () => {
    isoNew();
    document.getElementById('iso-type').value = 'blank';
    document.getElementById('iso-passage').value = 'new';
    document.getElementById('iso-n').value = '2';
    isoCfgChange();
    await isoGenerate();
    await new Promise(r => setTimeout(r, 500));
    const sb = document.getElementById('iso-save');
    document.getElementById('iso-title').value = '새 지문 시험';
    await isoSave();
    await new Promise(r => setTimeout(r, 600));
    return { save: sb.style.display, toast: (document.getElementById('toast') || {}).textContent || '' };
  });
  ok('⑪ ① 새 지문은 지금처럼 저장된다', n1.save !== 'none' && savedCount === 1, '저장 ' + savedCount + '회 · "' + n1.toast + '"');

  const over = async w => { await page.setViewportSize({ width: w, height: 880 }); await wait(600); return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)); };
  const o1 = await over(1440), o2 = await over(390), o3 = await over(320);
  ok('⑫ 넘침 0 (1440·390·320)', o1 === 0 && o2 === 0 && o3 === 0, [o1, o2, o3].join(' / '));

  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|403/i;
  const mine = errs.filter(e => !skip.test(e) && e.indexOf('400') < 0);
  ok('⑬ 콘솔 오류 0', mine.length === 0, mine.slice(0, 3).join(' | ') || '0');

  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
