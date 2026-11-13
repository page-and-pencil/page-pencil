require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 자료실 구분 3개(원서 오디오·교재 음원·교재 단어/워크시트) + 원서는 듣기가 위 — 실제 카탈로그 6,518행으로 확인
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
const secsOf = () => [...document.querySelectorAll('#eb-d-body .eb-sec-t')].map(e => e.textContent.trim());

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();

  let bytes = 0, writes = 0;
  const handleBank = async r => {
    const req = r.request(), url = new URL(req.url());
    const isIdx = url.pathname.endsWith('/exam_bank_index');
    if (req.method() === 'POST') { writes++; return r.fulfill({ status: 201, body: '' }); }
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
  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('bank'); ebResetFilters(); });
  await page.waitForFunction(() => document.querySelectorAll('#eb-list .eb-row').length > 0, null, { timeout: 150000 });
  await wait(800);

  const n0 = await page.evaluate(() => (_ebRows || []).length);
  ok('① 목록 6,518행', n0 === 6518, n0 + '행 · ' + (bytes / 1048576).toFixed(2) + 'MB');

  // ② 구분 드롭다운에 새 세 가지
  const cats = await page.evaluate(() => [...document.getElementById('eb-f-cat').options].map(o => o.value + '|' + o.textContent));
  const want = ['audiobook|원서 · 원서 오디오', 'bookaudio|교재 · 교재 음원', 'bookdocs|교재 · 교재 단어·워크시트'];
  ok('② 구분에 원서·교재 음원·교재 단어/워크시트', want.every(w => cats.indexOf(w) >= 0),
    cats.filter(c => /원서|교재 음원|워크시트/.test(c)).join(' / '));
  ok('③ 날 key 가 그대로 보이는 구분 없음', !cats.some(c => /^(audiobook|bookaudio|bookdocs)\|(audiobook|bookaudio|bookdocs)$/.test(c)));

  // ④ 구분별 개수 + 시리즈 칸
  const counts = {};
  for (const k of ['audiobook', 'bookaudio', 'bookdocs']) {
    counts[k] = await page.evaluate(c => {
      document.getElementById('eb-f-cat').value = c; ebFilterChange();
      const el = document.getElementById('eb-f-series');
      return { cnt: document.getElementById('eb-count').textContent.trim(), vis: el.style.display !== 'none', ns: el.options.length - 1 };
    }, k);
  }
  ok('④ 원서 오디오 172줄 · 시리즈 칸 나옴', /^172/.test(counts.audiobook.cnt) && counts.audiobook.vis && counts.audiobook.ns === 56,
    counts.audiobook.cnt + ' · 시리즈 ' + counts.audiobook.ns + '종');
  ok('⑤ 교재 음원 125줄 · 시리즈 48종', /^125/.test(counts.bookaudio.cnt) && counts.bookaudio.vis && counts.bookaudio.ns === 48,
    counts.bookaudio.cnt + ' · 시리즈 ' + counts.bookaudio.ns + '종');
  ok('⑥ 교재 단어·워크시트 51줄 · 시리즈 15종', /^51/.test(counts.bookdocs.cnt) && counts.bookdocs.vis && counts.bookdocs.ns === 15,
    counts.bookdocs.cnt + ' · 시리즈 ' + counts.bookdocs.ns + '종');

  // ⑦ 시리즈로 거르기 (원서)
  const s7 = await page.evaluate(() => {
    document.getElementById('eb-f-cat').value = 'audiobook'; ebFilterChange();
    const el = document.getElementById('eb-f-series');
    const v = [...el.options].map(o => o.value).find(v2 => /잭|Zack/i.test(v2)) || el.options[1].value;
    el.value = v; ebFilterChange();
    const want = _ebRows.filter(r => (r.meta || {}).cat === 'audiobook' && (r.meta || {}).series === v).length;
    return { v: v, want: want, cnt: document.getElementById('eb-count').textContent.trim() };
  });
  ok('⑦ 원서 시리즈로 거르기', s7.cnt.indexOf(String(s7.want)) === 0 && s7.want > 0, s7.v + ' → ' + s7.cnt + ' (기대 ' + s7.want + '줄)');

  // ⑧ 잭파일 한 권 — 음원만 있는 원서 줄
  const zack = all.find(r => r.data.cat === 'audiobook' && /^Zack/i.test(r.data.title || '') && (r.data.audio || {}).files && r.data.audio.files.length && !(r.data.files || []).length);
  const z = await page.evaluate(async id => {
    ebResetFilters(); await ebOpenDetail(id); await new Promise(r => setTimeout(r, 900));
    const b = document.getElementById('eb-d-body');
    return {
      title: (document.getElementById('eb-d-title') || {}).textContent || '',
      sub: (document.getElementById('eb-d-sub') || {}).textContent || '',
      secs: [...b.querySelectorAll('.eb-sec-t')].map(e => e.textContent.trim()),
      names: b.querySelectorAll('.eb-aub').length, audios: b.querySelectorAll('audio').length, frames: b.querySelectorAll('iframe').length,
      empty: /등록된 문서가 없습니다/.test(b.innerText)
    };
  }, zack.id);
  ok('⑧ 잭파일 한 권 — 듣기만, 빈 문서칸 없음',
    z.secs[0] === '듣기 ' + zack.data.audio.files.length + '개' && !z.secs.some(t => t.indexOf('문서') === 0) && !z.empty && z.names === zack.data.audio.files.length && z.frames === 0,
    z.title + ' · 섹션 [' + z.secs.join(' / ') + '] · 이름 ' + z.names + ' · 재생기 ' + z.frames);
  ok('⑨ 머리글에 구분·시리즈', /원서 오디오/.test(z.sub) && (!zack.data.series || z.sub.indexOf(zack.data.series) >= 0), z.sub.slice(0, 80));

  // ⑩ ▶ 누르면 재생기 1개 + '다음 트랙 ▶'
  const z2 = await page.evaluate(async () => {
    ebAuOpen(0); await new Promise(r => setTimeout(r, 900));
    const b = document.getElementById('eb-d-body');
    const f = b.querySelector('.eb-aubox iframe');
    return { frames: b.querySelectorAll('iframe').length, src: f ? f.src : '', nav: (b.querySelector('.eb-aunav') || {}).innerText || '' };
  });
  ok('⑩ ▶ → 재생기 1개 · 다음 트랙 ▶', z2.frames === 1 && /\/preview/.test(z2.src) && /다음 트랙/.test(z2.nav),
    'iframe ' + z2.frames + ' · ' + z2.nav.replace(/\n/g, ' '));
  await page.screenshot({ path: SCR + '/eb_cats_zack.png' });

  // ⑪ 문서도 있는 원서 줄 — 듣기가 문서보다 위
  const both = all.find(r => r.data.cat === 'audiobook' && (r.data.files || []).length && (r.data.audio || {}).files && r.data.audio.files.length);
  const b1 = await page.evaluate(async id => {
    ebCloseDetail(); await ebOpenDetail(id); await new Promise(r => setTimeout(r, 900));
    return { title: (document.getElementById('eb-d-title') || {}).textContent || '', secs: [...document.querySelectorAll('#eb-d-body .eb-sec-t')].map(e => e.textContent.trim()) };
  }, both.id);
  const iAu = b1.secs.findIndex(t => t.indexOf('듣기') === 0), iDoc = b1.secs.findIndex(t => t.indexOf('문서') === 0 || t.indexOf('기타 자료') === 0);
  ok('⑪ 원서 — 듣기가 문서보다 위', iAu >= 0 && iDoc > iAu, b1.title + ' · [' + b1.secs.join(' / ') + ']');

  // ⑫ 기출은 그대로 문서가 위 + '다음 문항 ▶'
  const exam = all.find(r => ['hakpyeong','suneung','mopyeong','listen'].indexOf(r.data.cat) >= 0 && (r.data.files || []).some(f => f.k !== 'etc') && (r.data.audio || {}).files && r.data.audio.files.length > 2);
  if (!exam) throw new Error('기출+음원 줄을 못 찾음');
  const e1 = await page.evaluate(async id => {
    ebCloseDetail(); await ebOpenDetail(id); await new Promise(r => setTimeout(r, 900));
    ebAuOpen(0); await new Promise(r => setTimeout(r, 600));
    const b = document.getElementById('eb-d-body');
    return {
      title: (document.getElementById('eb-d-title') || {}).textContent || '',
      secs: [...b.querySelectorAll('.eb-sec-t')].map(e2 => e2.textContent.trim()),
      nav: (b.querySelector('.eb-aunav') || {}).innerText || '', frames: b.querySelectorAll('iframe').length
    };
  }, exam.id);
  const jAu = e1.secs.findIndex(t => t.indexOf('듣기') === 0), jDoc = e1.secs.findIndex(t => t.indexOf('문서') === 0);
  ok('⑫ 기출 — 문서가 듣기보다 위 · 다음 문항 ▶', jDoc >= 0 && jAu > jDoc && /다음 문항/.test(e1.nav) && e1.frames === 1,
    e1.title + ' · [' + e1.secs.join(' / ') + '] · ' + e1.nav.replace(/\n/g, ' '));

  // ⑬ 교재 음원 / 교재 단어·워크시트 한 줄씩
  const ba = all.find(r => r.data.cat === 'bookaudio' && (r.data.audio || {}).files && r.data.audio.files.length);
  const bd = all.find(r => r.data.cat === 'bookdocs' && (r.data.files || []).length);
  const r13 = await page.evaluate(async ids => {
    const out = [];
    for (const id of ids) {
      ebCloseDetail(); await ebOpenDetail(id); await new Promise(r => setTimeout(r, 800));
      out.push({ title: (document.getElementById('eb-d-title') || {}).textContent || '', secs: [...document.querySelectorAll('#eb-d-body .eb-sec-t')].map(e2 => e2.textContent.trim()) });
    }
    return out;
  }, [ba.id, bd.id]);
  ok('⑬ 교재 음원 줄 — 듣기 목록이 뜬다', r13[0].secs.some(t => t.indexOf('듣기') === 0), r13[0].title + ' · [' + r13[0].secs.join(' / ') + ']');
  ok('⑭ 교재 단어·워크시트 줄 — 문서 목록이 뜬다', r13[1].secs.some(t => t.indexOf('문서') === 0 || t.indexOf('기타 자료') === 0), r13[1].title + ' · [' + r13[1].secs.join(' / ') + ']');

  // ⑮ 넘침 · 쓰기 0 · 오류 0
  await page.evaluate(async id => { ebCloseDetail(); await ebOpenDetail(id); }, zack.id);
  await wait(900);
  const over = async w => { await page.setViewportSize({ width: w, height: 860 }); await wait(600); return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)); };
  const o1440 = await over(1440), o390 = await over(390), o320 = await over(320);
  await page.screenshot({ path: SCR + '/eb_cats_390.png' });
  ok('⑮ 넘침 0 (1440·390·320)', o1440 === 0 && o390 === 0 && o320 === 0, [o1440, o390, o320].join(' / '));
  ok('⑯ DB 쓰기 0', writes === 0, writes + '회');
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|400/i;
  const mine = errs.filter(e => !skip.test(e));
  ok('⑰ 콘솔 오류 0', mine.length === 0, mine.slice(0, 3).join(' | ') || '0');

  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
