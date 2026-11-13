require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 2차 확인 — 탭 이름 '자료실' · 기타 자료 묶음 · 합쳐진 폴더 · 시리즈 거르기 (실제 카탈로그 6,074행)
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const { examCatalog, catalogPath, isFake } = require('./_catalog');
const wait = ms => new Promise(r => setTimeout(r, ms));

const all = examCatalog();                    // 없으면 tests/fixtures 의 가짜 30줄
const now = new Date().toISOString();
const DB = new Map(all.map(r => [r.id, { id: r.id, data: r.data, updated_at: now }]));

// 서버 쪽 뷰(exam_bank_index)와 똑같이 — supabase/exam_bank.sql 의 meta 와 같은 필드
const META = ['cat', 'title', 'path', 'note', 'level', 'grade', 'term', 'school', 'region', 'city', 'series', 'year', 'month', 'round'];
function lightRow(r) {
  const d = r.data || {};
  const f2 = Array.isArray(d.files) ? d.files : [];
  const au = (d.audio && Array.isArray(d.audio.files)) ? d.audio.files : [];
  const meta = {};
  META.forEach(k => { const v = d[k]; if (v !== '' && v !== null && v !== undefined) meta[k] = v; });
  return {
    id: r.id, updated_at: r.updated_at, meta: meta, nfiles: f2.length,
    kinds: [...new Set(f2.map(f => (f && f.k) || '').filter(Boolean))].sort().join(','),
    naudio: au.length, extaud: !!d.extAudio
  };
}

const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();

  let bytes = 0;
  const handleBank = async r => {
    const req = r.request(), url = new URL(req.url());
    const isIdx = url.pathname.endsWith('/exam_bank_index');
    if (req.method() === 'POST') return r.fulfill({ status: 201, body: '' });
    const sel = url.searchParams.get('select') || '';
    if (sel === 'updated_at') {
      const mx = [...DB.values()].map(x => x.updated_at).sort().reverse()[0];
      return r.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'content-range': '0-0/' + DB.size, 'access-control-expose-headers': 'content-range' },
        body: JSON.stringify([{ updated_at: mx }])
      });
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
    bytes += Buffer.byteLength(body);
    return r.fulfill({ status: 200, contentType: 'application/json', body: body });
  };
  await page.route('**/rest/v1/**', r => {
    if (/\/rest\/v1\/exam_bank/.test(r.request().url())) return handleBank(r);
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**drive.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>drive</body></html>' }));
  await page.route('**drive.usercontent.google.com/**', r => r.fulfill({ status: 200, contentType: 'audio/mpeg', body: '' }));
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 160)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 });
  await wait(2000);

  // ① 탭 이름
  const tabTxt = await page.evaluate(() => (document.getElementById('dtab-bank') || {}).textContent || '');
  ok('① 탭 이름이 자료실', tabTxt.trim() === '자료실', '"' + tabTxt.trim() + '"');

  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('bank'); });
  await page.waitForFunction(() => document.querySelectorAll('#eb-list .eb-row').length > 0, null, { timeout: 120000 });
  const n0 = await page.evaluate(() => (_ebRows || []).length);
  ok('② 목록 6,074행', n0 === 6074, n0 + '행 · ' + (bytes / 1048576).toFixed(2) + 'MB');

  // ③ 시리즈 칸은 처음엔 숨어 있다
  const s0 = await page.evaluate(() => {
    const el = document.getElementById('eb-f-series');
    return { has: !!el, vis: el ? el.style.display !== 'none' : false };
  });
  ok('③ 시리즈 칸 — 구분 전체일 땐 숨김', s0.has && !s0.vis);

  // ④ 교재 구분을 고르면 시리즈 칸이 나온다
  const s1 = await page.evaluate(() => {
    document.getElementById('eb-f-cat').value = 'elt'; ebFilterChange();
    const el = document.getElementById('eb-f-series');
    return {
      vis: el.style.display !== 'none', n: el.options.length - 1,
      first: (el.options[1] || {}).value || '', cnt: document.getElementById('eb-count').textContent
    };
  });
  ok('④ 교재 구분 → 시리즈 칸 나옴', s1.vis && s1.n === 9, '시리즈 ' + s1.n + '종 · ' + s1.cnt);

  // ⑤ 시리즈로 거르면 그 시리즈만
  const s2 = await page.evaluate(() => {
    const el = document.getElementById('eb-f-series');
    const v = el.options[1].value;
    el.value = v; ebFilterChange();
    const rows = _ebRows.filter(r => (r.meta || {}).cat === 'elt' && (r.meta || {}).series === v);
    return { v: v, want: rows.length, cnt: document.getElementById('eb-count').textContent };
  });
  ok('⑤ 시리즈로 거르기', s2.cnt.indexOf(s2.want.toLocaleString()) === 0, s2.v + ' → ' + s2.cnt + ' (기대 ' + s2.want.toLocaleString() + ')');

  // ⑥ 기출 구분으로 바꾸면 시리즈 칸이 사라지고 거르기도 풀린다
  const s3 = await page.evaluate(() => {
    document.getElementById('eb-f-cat').value = 'hakpyeong'; ebFilterChange();
    const el = document.getElementById('eb-f-series');
    return { vis: el.style.display !== 'none', f: _ebF.series, cnt: document.getElementById('eb-count').textContent };
  });
  ok('⑥ 기출 구분 → 시리즈 칸 숨고 풀림', !s3.vis && s3.f === '', s3.cnt);

  // ⑦ 합쳐진 시험 — 기타 자료 묶음 + 합쳐진 폴더 단추
  const merged = all.find(r => (r.data.extraFolders || []).length && (r.data.files || []).some(f => f.k === 'q'));
  const s4 = await page.evaluate(async id => {
    ebResetFilters();
    await ebOpenDetail(id);
    await new Promise(r => setTimeout(r, 900));
    const secs = [...document.querySelectorAll('#eb-d-body .eb-sec-t')].map(e => e.textContent.trim());
    const btns = [...document.querySelectorAll('#eb-d-body a.btn')].map(e => e.textContent.trim());
    const etcSec = [...document.querySelectorAll('#eb-d-body .eb-sec')].find(s => /기타 자료/.test((s.querySelector('.eb-sec-t') || {}).textContent || ''));
    return {
      secs: secs, btns: btns,
      nEtc: etcSec ? etcSec.querySelectorAll('.eb-file').length : 0,
      docSec: secs.find(t => t.indexOf('문서') === 0) || ''
    };
  }, merged.id);
  const wantEtc = merged.data.files.filter(f => f.k === 'etc').length;
  const wantDoc = merged.data.files.filter(f => f.k !== 'etc').length;
  ok('⑦ 기타 자료 묶음', s4.secs.some(t => t === '기타 자료 ' + wantEtc + '개') && s4.nEtc === wantEtc,
    s4.secs.join(' / ') + ' · 기타 ' + s4.nEtc + '개');
  ok('⑧ 문서 묶음에는 기타가 빠짐', s4.docSec === '문서 ' + wantDoc + '개', s4.docSec);
  ok('⑨ 합쳐진 폴더 열기 단추', s4.btns.some(t => /합쳐진 폴더/.test(t)),
    s4.btns.join(' | ') + ' (extraFolders ' + merged.data.extraFolders.length + '개)');

  // ⑩ 전부 기타인 출판사 자료 — 빈 '문서 0개'가 뜨지 않는다
  const pubRow = all.find(r => (r.data.files || []).length > 1 && (r.data.files || []).every(f => f.k === 'etc'));
  const s5 = await page.evaluate(async id => {
    ebCloseDetail();
    await ebOpenDetail(id);
    await new Promise(r => setTimeout(r, 900));
    return {
      secs: [...document.querySelectorAll('#eb-d-body .eb-sec-t')].map(e => e.textContent.trim()),
      sub: (document.getElementById('eb-d-sub') || {}).textContent || ''
    };
  }, pubRow.id);
  ok('⑩ 전부 기타면 빈 문서칸 없음', !s5.secs.some(t => t.indexOf('문서') === 0) && s5.secs.some(t => /기타 자료/.test(t)), s5.secs.join(' / '));
  ok('⑪ 상세 머리글에 시리즈', !pubRow.data.series || s5.sub.indexOf(pubRow.data.series) >= 0, s5.sub.slice(0, 90));

  // ⑫ 캐시에서 다시 열어도 거르기 칸이 채워져 있다
  await page.evaluate(() => { ebCloseDetail(); });
  const s6 = await page.reload({ waitUntil: 'domcontentloaded' }).then(async () => {
    await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 });
    await wait(1500);
    const b0 = bytes;
    await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('bank'); });
    await page.waitForFunction(() => document.querySelectorAll('#eb-list .eb-row').length > 0, null, { timeout: 60000 });
    await wait(1200);
    return page.evaluate(() => ({
      cats: document.getElementById('eb-f-cat').options.length - 1,
      schools: document.getElementById('eb-f-school').options.length - 1,
      rows: document.querySelectorAll('#eb-list .eb-row').length
    })).then(x => ({ ...x, used: bytes - b0 }));
  });
  ok('⑫ 캐시로 다시 열어도 거르기 칸이 참', s6.cats > 5 && s6.schools > 5,
    '구분 ' + s6.cats + '종 · 학교 ' + s6.schools + '곳 · 받은 바이트 ' + s6.used);

  // ⑬ 화면 넘침
  const over = async w => {
    await page.setViewportSize({ width: w, height: 860 });
    await wait(700);
    return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  };
  const o1440 = await over(1440), o390 = await over(390), o320 = await over(320);
  ok('⑬ 넘침 0 (1440·390·320)', o1440 === 0 && o390 === 0 && o320 === 0, [o1440, o390, o320].join(' / '));
  await page.screenshot({ path: SCR + '/eb2_list_390.png' });
  await page.evaluate(async id => { await ebOpenDetail(id); }, merged.id);
  await wait(1200);
  const o390d = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  ok('⑭ 상세 모달 넘침 0 (390)', o390d === 0, String(o390d));
  await page.screenshot({ path: SCR + '/eb2_detail_390.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await wait(600);
  await page.screenshot({ path: SCR + '/eb2_detail_1440.png' });

  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon/i;
  const mine = errs.filter(e => !skip.test(e) && e.indexOf('400') < 0);
  ok('⑮ 콘솔 오류 0', mine.length === 0, mine.slice(0, 3).join(' | ') || '0');

  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
