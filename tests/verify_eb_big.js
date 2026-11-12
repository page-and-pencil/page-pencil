require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 실제 분량(6,139행)으로 — 전송량·속도·화면
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const CAT = (process.env.PP_EXAM_CATALOG || '');
const wait = ms => new Promise(r => setTimeout(r, ms));

const all = JSON.parse(fs.readFileSync(CAT, 'utf8'));
const now = new Date().toISOString();
const DB = new Map(all.map(r => [r.id, { id: r.id, data: r.data, updated_at: now }]));
function lightRow(r) {
  const d = r.data || {};
  const f2 = Array.isArray(d.files) ? d.files : [];
  const au = (d.audio && Array.isArray(d.audio.files)) ? d.audio.files : [];
  const meta = {};
  ['cat','title','path','note','level','grade','term','school','region','city','year','month','round','_deleted']
    .forEach(k => { const v = d[k]; if (v !== '' && v !== null && v !== undefined) meta[k] = v; });
  return {
    id: r.id, updated_at: r.updated_at, meta: meta, nfiles: f2.length,
    kinds: [...new Set(f2.map(f => (f && f.k) || '').filter(Boolean))].sort().join(','),
    naudio: au.length, extaud: !!d.extAudio
  };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();

  let bytes = 0, calls = 0;
  const handleBank = async r => {
    const req = r.request(), url = new URL(req.url());
    const isIdx = url.pathname.endsWith('/exam_bank_index');
    if (req.method() === 'POST') return r.fulfill({ status: 201, body: '' });
    const sel = url.searchParams.get('select') || '';
    const total = DB.size;
    if (sel === 'updated_at') {
      const rows2 = [...DB.values()].map(x => x.updated_at).sort().reverse().slice(0, 1).map(u => ({ updated_at: u }));
      const body2 = JSON.stringify(rows2);
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + total, 'access-control-expose-headers': 'content-range' }, body: body2 });
    }
    const limit = +(url.searchParams.get('limit') || 1000), off = +(url.searchParams.get('offset') || 0);
    let rows = [...DB.values()];
    const idq = url.searchParams.get('id');
    if (idq && idq.startsWith('eq.')) rows = rows.filter(x => x.id === decodeURIComponent(idq.slice(3)));
    else if (idq && idq.startsWith('in.(')) {
      const ids = idq.slice(4, -1).split(',').map(decodeURIComponent);
      rows = rows.filter(x => ids.indexOf(x.id) >= 0);
    } else rows = rows.slice(off, off + limit);
    let out;
    if (isIdx) {
      out = rows.map(lightRow);
      if (sel === 'id,updated_at') out = out.map(x => ({ id: x.id, updated_at: x.updated_at }));
    } else if (sel === 'data') out = rows.map(x => ({ data: x.data }));
    else if (sel === 'id,updated_at') out = rows.map(x => ({ id: x.id, updated_at: x.updated_at }));
    else out = rows;
    const body = JSON.stringify(out);
    bytes += Buffer.byteLength(body); calls++;
    return r.fulfill({ status: 200, contentType: 'application/json', body: body });
  };
  await page.route('**/rest/v1/**', r => {
    if (/\/rest\/v1\/exam_bank/.test(r.request().url())) return handleBank(r);
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**drive.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body style="font:14px sans-serif;padding:40px;text-align:center">드라이브 미리보기 (시험용 가짜 화면)</body></html>' }));
  await page.route('**drive.usercontent.google.com/**', r => r.fulfill({ status: 200, contentType: 'audio/mpeg', body: '' }));
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 });
  await wait(2500);

  const t0 = Date.now();
  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('bank'); });
  await page.waitForFunction(() => document.querySelectorAll('#eb-list .eb-row').length > 0, null, { timeout: 120000 });
  const firstMs = Date.now() - t0;
  const info = await page.evaluate(() => ({
    rows: (_ebRows || []).length,
    shown: document.querySelectorAll('#eb-list .eb-row').length,
    cnt: (document.getElementById('eb-count') || {}).textContent || '',
    cats: document.getElementById('eb-f-cat').options.length,
    schools: document.getElementById('eb-f-school').options.length
  }));
  console.log('첫 열기: ' + firstMs + 'ms · 받은 바이트 ' + (bytes / 1048576).toFixed(2) + 'MB (' + calls + '회)');
  console.log('목록 ' + info.rows.toLocaleString() + '행 · 화면에 ' + info.shown + '개 · "' + info.cnt + '" · 구분 ' + (info.cats - 1) + '종 · 학교 ' + (info.schools - 1) + '곳');

  // 거르기 속도
  const ft = await page.evaluate(async () => {
    const t = performance.now();
    document.getElementById('eb-f-q').value = '영어'; ebFilterChange();
    const a = performance.now() - t;
    const n = document.querySelectorAll('#eb-list .eb-row').length;
    const cnt = (document.getElementById('eb-count') || {}).textContent;
    const t2 = performance.now();
    ebResetFilters();
    return { ms: Math.round(a), ms2: Math.round(performance.now() - t2), n: n, cnt: cnt };
  });
  console.log('검색 "영어": ' + ft.ms + 'ms · ' + ft.cnt + ' · 초기화 ' + ft.ms2 + 'ms');

  // 두 번째 열기 (캐시)
  const b1 = bytes;
  await page.evaluate(async () => { switchDataTab('tbook'); await new Promise(r => setTimeout(r, 300)); switchDataTab('bank'); await new Promise(r => setTimeout(r, 1200)); });
  console.log('두 번째 열기: 받은 바이트 ' + (bytes - b1) + ' (0 이어야 함)');
  // 강제 최신화 (바뀐 것 없음)
  const b2 = bytes;
  await page.evaluate(async () => { await ebRefresh(); });
  console.log('지금 최신화(바뀐 것 없음): ' + ((bytes - b2) / 1024).toFixed(0) + 'KB');

  // 화면 찍기
  await page.evaluate(() => { document.getElementById('eb-f-q').value = '2026'; ebFilterChange(); });
  await wait(600);
  await page.screenshot({ path: SCR + '/eb_list_1440.png' });
  await page.evaluate(async () => {
    const row = (_ebRows || []).find(r => r.naudio > 3 && r.nfiles > 1);
    await ebOpenDetail(row.id);
  });
  await wait(1500);
  await page.screenshot({ path: SCR + '/eb_detail_1440.png' });
  await page.evaluate(() => { document.querySelector('#eb-d-body .eb-file').click(); });
  await wait(1200);
  await page.screenshot({ path: SCR + '/eb_view_1440.png' });
  await page.evaluate(() => { ebViewClose(); ebCloseDetail(); });

  await page.setViewportSize({ width: 390, height: 860 });
  await wait(800);
  await page.screenshot({ path: SCR + '/eb_list_390.png' });
  await page.evaluate(async () => { const row = (_ebRows || []).find(r => r.naudio > 3); await ebOpenDetail(row.id); });
  await wait(1200);
  await page.screenshot({ path: SCR + '/eb_detail_390.png' });

  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon/i;
  const mine = errs.filter(e => !skip.test(e) && e.indexOf('400') < 0);
  console.log('콘솔 오류(우리 것): ' + (mine.length ? mine.slice(0, 3).join(' | ') : '0'));
  await browser.close();
})();
