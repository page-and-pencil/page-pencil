require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 기출·자료실 확인 — 표가 아직 없으므로 exam_bank REST 를 가짜로 받아 준다(실 DB 접근 0)
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const { examCatalog, catalogPath, isFake } = require('./_catalog');
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function say(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? '  OK   ' : '  FAIL ') + what + (detail ? '  — ' + detail : ''));
}

// ── 표본 30행 (듣기 있는 것·학교 정기고사·EBS 링크가 섞이도록 고른다)
const all = examCatalog();                    // 없으면 tests/fixtures 의 가짜 30줄
const pick = [];
const want = [
  r => (r.data.audio && (r.data.audio.files || []).length > 5),       // 드라이브 mp3 많은 것
  r => !!r.data.extAudio,                                             // EBS 링크
  r => r.data.cat === 'school',
  r => r.data.cat === 'suneung',
  r => r.data.cat === 'elt'
];
want.forEach(f => all.filter(f).slice(0, 6).forEach(r => { if (!pick.find(x => x.id === r.id)) pick.push(r); }));
all.slice(0, 40).forEach(r => { if (pick.length < 30 && !pick.find(x => x.id === r.id)) pick.push(r); });
const SAMPLE = pick.slice(0, 30);
fs.writeFileSync(SCR + '/eb_sample30.json', JSON.stringify(SAMPLE), 'utf8');

// ── 가짜 서버 상태
const DB = new Map();                       // id → {id,data,updated_at}
let posted = 0, postBatches = [];
function lightRow(r) {
  const d = r.data || {};
  const fs2 = Array.isArray(d.files) ? d.files : [];
  const au = (d.audio && Array.isArray(d.audio.files)) ? d.audio.files : [];
  const meta = {};
  ['cat','title','path','note','level','grade','term','school','region','city','year','month','round','_deleted']
    .forEach(k => { const v = d[k]; if (v !== '' && v !== null && v !== undefined) meta[k] = v; });
  return {
    id: r.id, updated_at: r.updated_at, meta: meta, nfiles: fs2.length,
    kinds: [...new Set(fs2.map(f => (f && f.k) || '').filter(Boolean))].sort().join(','),
    naudio: au.length, extaud: !!d.extAudio
  };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();

  let realWrites = 0, bankGetsBeforeTab = 0, tabOpened = false;
  const opened = [];
  await page.exposeFunction('_markOpen', u => opened.push(u));
  await page.addInitScript(() => {
    const o = window.open;
    window.open = function (u) { try { window._markOpen(String(u)); } catch (e) { } return { focus() { } }; };
  });

  const handleBank = async r => {
    const req = r.request(), url = new URL(req.url()), m = req.method();
    const isIdx = url.pathname.endsWith('/exam_bank_index');
    if (!tabOpened) bankGetsBeforeTab++;
    if (m === 'POST') {
      const body = JSON.parse(req.postData() || '[]');
      postBatches.push(body.length);
      body.forEach(x => DB.set(x.id, { id: x.id, data: x.data, updated_at: x.updated_at }));
      posted += body.length;
      return r.fulfill({ status: 201, body: '' });
    }
    const sel = url.searchParams.get('select') || '';
    const total = DB.size;
    if (sel === 'updated_at') {
      const rows2 = [...DB.values()].map(x => x.updated_at).sort().reverse().slice(0, 1).map(u => ({ updated_at: u }));
      const body2 = JSON.stringify(rows2);
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + total, 'access-control-expose-headers': 'content-range' }, body: body2 });
    }
    const limit = +(url.searchParams.get('limit') || 1000), off = +(url.searchParams.get('offset') || 0);
    let rows = [...DB.values()].sort((a, b) => a.id.localeCompare(b.id));
    const idq = url.searchParams.get('id');
    if (idq && idq.startsWith('eq.')) rows = rows.filter(x => x.id === decodeURIComponent(idq.slice(3)));
    else if (idq && idq.startsWith('in.(')) {
      const ids = idq.slice(4, -1).split(',').map(decodeURIComponent);
      rows = rows.filter(x => ids.indexOf(x.id) >= 0);
    } else rows = rows.slice(off, off + limit);
    let out;
    if (isIdx) {
      out = rows.map(lightRow).filter(x => !(x.meta && x.meta._deleted));
      if (sel === 'id,updated_at') out = out.map(x => ({ id: x.id, updated_at: x.updated_at }));
    } else if (sel === 'data') out = rows.map(x => ({ data: x.data }));
    else if (sel === 'id,updated_at') out = rows.map(x => ({ id: x.id, updated_at: x.updated_at }));
    else out = rows;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  };
  await page.route('**/rest/v1/**', r => {
    if (/\/rest\/v1\/exam_bank/.test(r.request().url())) return handleBank(r);
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    realWrites++;
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.route('**api.elevenlabs.io/**', r => r.fulfill({ status: 500, body: '' }));
  await page.route('**drive.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>drive mock</body></html>' }));
  await page.route('**drive.usercontent.google.com/**', r => r.fulfill({ status: 200, contentType: 'audio/mpeg', body: '' }));

  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 200)));

  console.log('[0] 앱 열기 — 부팅 때는 자료실을 받지 않아야 한다');
  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 });
  await wait(3000);
  say(bankGetsBeforeTab === 0, '부팅·로그인 때 exam_bank 요청 0건', bankGetsBeforeTab + '건');

  console.log('');
  console.log('[1] 자료 DB → 기출문제 탭');
  await page.evaluate(() => { show('s-teacher'); swTab('t-data'); });
  await wait(600);
  tabOpened = true;
  await page.evaluate(() => switchDataTab('bank'));
  await wait(2500);
  const t1 = await page.evaluate(() => ({
    vis: getComputedStyle(document.getElementById('dp-bank')).display !== 'none',
    tab: !!document.getElementById('dtab-bank'),
    anchor: !!document.querySelector('.dtabs a[href*="spreadsheets"]'),
    empty: (document.getElementById('eb-list') || {}).textContent || ''
  }));
  say(t1.tab && t1.vis, '기출문제 탭이 버튼으로 바뀌고 패널이 열린다');
  say(!t1.anchor, '탭 줄의 시트 바로가기는 없어졌다 (⋯ 메뉴로 옮김)');
  say(/카탈로그 가져오기/.test(t1.empty), '자료가 없을 때 안내가 보인다', t1.empty.replace(/\s+/g, ' ').slice(0, 60));

  console.log('');
  console.log('[2] 카탈로그 가져오기 (표본 30행)');
  await page.setInputFiles('#eb-import-file', SCR + '/eb_sample30.json');
  await page.waitForFunction(() => {
    const b = document.getElementById('eb-import-close');
    return b && b.style.display !== 'none';
  }, null, { timeout: 60000 });
  const prog = await page.evaluate(() => (document.getElementById('eb-import-prog') || {}).textContent || '');
  say(posted === 30, '30행을 올렸다', '올린 행 ' + posted + ' · 묶음 ' + JSON.stringify(postBatches) + ' (50개씩)');
  say(/끝났습니다/.test(prog), '진행 표시가 끝났다고 알린다', prog.replace(/\s+/g, ' ').slice(0, 70));
  await page.evaluate(() => closeM('m-eb-import'));
  await wait(2500);

  const t2 = await page.evaluate(() => ({
    rows: document.querySelectorAll('#eb-list .eb-row').length,
    cnt: (document.getElementById('eb-count') || {}).textContent || '',
    first: (document.querySelector('#eb-list .eb-title') || {}).textContent || '',
    pills: (document.querySelector('#eb-list .eb-kinds') || {}).textContent || '',
    state: (document.getElementById('eb-state') || {}).textContent || ''
  }));
  say(t2.rows === 30, '목록에 30건이 보인다', t2.rows + '건 · ' + t2.cnt + ' · "' + t2.first + '" ' + t2.pills);

  console.log('');
  console.log('[3] 거르기');
  const f1 = await page.evaluate(async () => {
    const sel = document.getElementById('eb-f-cat');
    const opt = [...sel.options].find(o => o.value === 'school');
    sel.value = 'school'; ebFilterChange(); await new Promise(r => setTimeout(r, 400));
    return { label: opt ? opt.textContent : '', rows: document.querySelectorAll('#eb-list .eb-row').length };
  });
  say(f1.rows > 0, '구분 = 학교 정기고사', f1.rows + '건 · 보기 이름 "' + f1.label + '"');
  const f2 = await page.evaluate(async () => {
    ebResetFilters();
    document.getElementById('eb-f-audio').checked = true; ebFilterChange();
    await new Promise(r => setTimeout(r, 400));
    const n = document.querySelectorAll('#eb-list .eb-row').length;
    const pills = [...document.querySelectorAll('#eb-list .eb-row')].every(r => /듣기/.test(r.textContent));
    return { n: n, pills: pills };
  });
  say(f2.n > 0 && f2.pills, '듣기 있음만 걸러진다', f2.n + '건 모두 듣기 표시 있음');
  const f3 = await page.evaluate(async () => {
    ebResetFilters();
    document.getElementById('eb-f-q').value = '수능'; ebFilterChange();
    await new Promise(r => setTimeout(r, 400));
    const rows = [...document.querySelectorAll('#eb-list .eb-row')];
    return { n: rows.length, all: rows.every(r => /수능/.test(r.textContent)) };
  });
  say(f3.n > 0 && f3.all, '검색어 "수능"', f3.n + '건');
  const f4 = await page.evaluate(async () => {
    ebResetFilters();
    document.getElementById('eb-f-y1').value = '2026'; ebFilterChange();
    await new Promise(r => setTimeout(r, 400));
    return document.querySelectorAll('#eb-list .eb-row').length;
  });
  say(f4 > 0, '2026년 이후만', f4 + '건');
  // 기억되는지 — 다른 탭 갔다 오기
  const f5 = await page.evaluate(async () => {
    switchDataTab('tbook'); await new Promise(r => setTimeout(r, 500));
    switchDataTab('bank'); await new Promise(r => setTimeout(r, 1200));
    return { y1: document.getElementById('eb-f-y1').value, rows: document.querySelectorAll('#eb-list .eb-row').length };
  });
  say(f5.y1 === '2026', '탭을 나갔다 와도 거르기가 기억된다', '연도 ' + f5.y1 + ' · ' + f5.rows + '건');
  await page.evaluate(() => ebResetFilters());
  await wait(400);

  console.log('');
  console.log('[4] 상세 · 미리보기 · 새 탭 · 듣기');
  const d1 = await page.evaluate(async () => {
    // 듣기 있는 자료를 연다
    const rows = [...document.querySelectorAll('#eb-list .eb-row')];
    const r = rows.find(x => /듣기 \d/.test(x.textContent)) || rows[0];
    r.click();
    await new Promise(r2 => setTimeout(r2, 1500));
    const body = document.getElementById('eb-d-body');
    return {
      open: document.getElementById('m-eb-detail').classList.contains('open'),
      title: (document.getElementById('eb-d-title') || {}).textContent || '',
      sub: (document.getElementById('eb-d-sub') || {}).textContent || '',
      files: body.querySelectorAll('.eb-file').length,
      audios: body.querySelectorAll('audio').length,
      au0: (body.querySelector('audio') || {}).getAttribute ? body.querySelector('audio').getAttribute('src') : '',
      folder: !!body.querySelector('a[href*="/drive/folders/"]'),
      seq: !!body.querySelector('button[onclick="ebPlayAll()"]')
    };
  });
  say(d1.open && d1.files > 0, '상세가 열리고 문서 버튼이 있다', '"' + d1.title + '" · 문서 ' + d1.files + '개 · 음원 ' + d1.audios + '개');
  say(/authuser=/.test(d1.au0) && /drive\.usercontent\.google\.com\/download/.test(d1.au0), '음원 주소가 드라이브 직접 재생 주소다', d1.au0.slice(0, 95));
  say(d1.folder && d1.seq, '폴더 열기 · 전체 이어 듣기 버튼이 있다');
  say(/· /.test(d1.sub), '머리글에 구분·학년·연도가 보인다', d1.sub.slice(0, 70));

  const d2 = await page.evaluate(async () => {
    document.querySelector('#eb-d-body .eb-file').click();
    await new Promise(r => setTimeout(r, 900));
    const f = document.getElementById('eb-view-frame');
    return { open: document.getElementById('m-eb-view').classList.contains('open'), src: f.getAttribute('src'), title: (document.getElementById('eb-view-title') || {}).textContent || '' };
  });
  say(d2.open && /drive\.google\.com\/file\/d\/.*\/preview/.test(d2.src) && /authuser=/.test(d2.src),
    '미리보기가 드라이브 preview 주소로 열린다', d2.src.slice(0, 95));
  await page.evaluate(() => ebViewNewTab());
  await wait(400);
  say(opened.some(u => /\/view\?/.test(u) && /authuser=/.test(u)), "'인쇄 · 새 탭' 이 view 주소를 새 탭으로 연다", (opened[opened.length - 1] || '').slice(0, 95));
  await page.evaluate(() => ebViewClose());
  await wait(300);

  // EBS 링크가 있는 자료
  const d3 = await page.evaluate(async () => {
    ebCloseDetail();
    await new Promise(r => setTimeout(r, 300));
    const row = (_ebRows || []).find(r => r.extaud);
    if (!row) return { skip: true };
    await ebOpenDetail(row.id);
    await new Promise(r => setTimeout(r, 1200));
    const a = [...document.querySelectorAll('#eb-d-body audio')].map(x => x.getAttribute('src'));
    return { skip: false, ext: a.find(x => /ebsi|ebs\./i.test(x)) || '', n: a.length };
  });
  say(d3.skip || !!d3.ext, 'EBS 음원 링크는 그대로 재생기에 붙는다', d3.skip ? '표본에 없음' : d3.ext.slice(0, 80));

  // mp3 가 막혔을 때 드라이브 재생기로 바뀌는지
  const d4 = await page.evaluate(async () => {
    ebCloseDetail(); await new Promise(r => setTimeout(r, 300));
    const row = (_ebRows || []).find(r => r.naudio > 0);
    if (!row) return { skip: true };
    await ebOpenDetail(row.id);
    await new Promise(r => setTimeout(r, 1200));
    ebAudioFail(0, 'FAKEID');
    await new Promise(r => setTimeout(r, 300));
    const box = document.getElementById('eb-au-box-0');
    return { skip: false, iframe: !!box.querySelector('iframe'), link: !!box.querySelector('a[href*="/view"]') };
  });
  say(d4.skip || (d4.iframe && d4.link), '음원이 막히면 드라이브 재생기 + 새 탭 링크로 바뀐다');
  await page.evaluate(() => ebCloseDetail());
  await wait(300);

  console.log('');
  console.log('[5] 즐겨찾기 · 최근 본');
  const s1 = await page.evaluate(async () => {
    const id = (_ebRows || [])[0].id;
    ebToggleFav(id); await new Promise(r => setTimeout(r, 400));
    ebOnly('fav'); await new Promise(r => setTimeout(r, 400));
    const n = document.querySelectorAll('#eb-list .eb-row').length;
    ebOnly('fav'); ebOnly('recent'); await new Promise(r => setTimeout(r, 400));
    const rec = document.querySelectorAll('#eb-list .eb-row').length;
    ebOnly('recent');
    return { fav: n, rec: rec, stored: JSON.parse(localStorage.getItem('pp_eb_fav') || '[]').length, recs: JSON.parse(localStorage.getItem('pp_eb_recent') || '[]').length };
  });
  say(s1.fav === 1 && s1.stored === 1, '즐겨찾기 1건이 기기에 남는다');
  say(s1.rec > 0 && s1.recs > 0 && s1.recs <= 10, '최근 본 목록이 쌓인다 (최대 10)', s1.recs + '건');

  console.log('');
  console.log('[6] 두 번째부터는 바뀐 것만 받는다');
  const before = await page.evaluate(() => ({ at: _ebAt }));
  let idxCalls = 0;
  page.on('request', r => { if (/exam_bank_index/.test(r.url())) idxCalls++; });
  const r1 = await page.evaluate(async () => { switchDataTab('tbook'); await new Promise(r => setTimeout(r, 300)); switchDataTab('bank'); await new Promise(r => setTimeout(r, 1500)); return _ebAt; });
  say(idxCalls === 0, '12시간 안에 다시 열면 아무것도 받지 않는다', '요청 ' + idxCalls + '건');
  const r2 = await page.evaluate(async () => { await ebRefresh(); return { rows: (_ebRows || []).length }; });
  await wait(600);
  say(r2.rows === 30, '"지금 최신화" 는 바뀐 것만 확인하고 목록을 지킨다', r2.rows + '건 · 요청 ' + idxCalls + '건');

  // 한 건이 바뀌면 그 한 건만 받아 온다
  const victim = [...DB.values()][3];
  victim.data = { ...victim.data, title: victim.data.title + ' (고침)', note: '시험용 메모' };
  victim.updated_at = new Date(Date.now() + 60000).toISOString();
  const b3 = postBatches.length;
  const r3 = await page.evaluate(async () => {
    await ebRefresh();
    const row = (_ebRows || []).find(r => /고침/.test((r.meta || {}).title || ''));
    return { hit: !!row, title: row ? row.meta.title : '', n: (_ebRows || []).length };
  });
  say(r3.hit && r3.n === 30, '바뀐 한 건만 받아 목록에 반영된다', '"' + r3.title + '" · ' + r3.n + '건');

  console.log('');
  console.log('[7] 학생·학부모·체험 모드에서는 안 보인다');
  const g1 = await page.evaluate(() => {
    const t = document.getElementById('s-teacher');
    return { inTeacher: !!(t && t.contains(document.getElementById('dp-bank'))), may: ebMayUse() };
  });
  say(g1.inTeacher, '자료실 패널은 선생님 화면 안에만 있다');
  const g2 = await page.evaluate(async () => {
    const was = ebMayUse();
    await previewAsStudent((process.env.PP_REAL_SID || ''));
    await new Promise(r => setTimeout(r, 2500));
    const may = ebMayUse();
    const panel = document.getElementById('dp-bank');
    const vis = panel && panel.offsetParent !== null;
    return { was: was, may: may, vis: !!vis, sandbox: ppSandbox() };
  });
  say(g2.was && !g2.may && !g2.vis, '체험 모드(학생뷰)에서는 자료실을 쓰지 않는다', '체험 ' + g2.sandbox + ' · 사용가능 ' + g2.may + ' · 화면표시 ' + g2.vis);

  console.log('');
  console.log('[8] 화면 폭 · 콘솔');
  await page.evaluate(async () => { try { await returnToTeacher(); } catch (e) { } });
  await wait(1500);
  for (const w of [320, 390, 1440]) {
    await page.setViewportSize({ width: w, height: 860 });
    await page.evaluate(() => { show('s-teacher'); swTab('t-data'); switchDataTab('bank'); });
    await wait(900);
    const ov = await page.evaluate(() => {
      const d = document.documentElement;
      const wide = [...document.querySelectorAll('#dp-bank *')].filter(e => e.getBoundingClientRect().right > d.clientWidth + 1).length;
      return { scroll: d.scrollWidth > d.clientWidth + 1, wide: wide };
    });
    say(!ov.scroll && ov.wide === 0, w + 'px 가로 넘침 없음', '문서 넘침 ' + ov.scroll + ' · 넘친 요소 ' + ov.wide);
  }
  // 상세 모달도
  await page.setViewportSize({ width: 390, height: 860 });
  const mv = await page.evaluate(async () => {
    await ebOpenDetail((_ebRows || [])[0].id);
    await new Promise(r => setTimeout(r, 1200));
    const d = document.documentElement;
    const wide = [...document.querySelectorAll('#m-eb-detail *')].filter(e => e.getBoundingClientRect().right > d.clientWidth + 1).length;
    ebCloseDetail();
    return wide;
  });
  say(mv === 0, '390px 에서 상세 모달 넘침 없음', '넘친 요소 ' + mv);

  say(realWrites === 0, '우리 표(exam_bank 말고)에 쓰기 0건', realWrites + '건');
  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon/i;
  const mine = errs.filter(e => !skip.test(e) && !(e.indexOf('400') >= 0));
  say(mine.length === 0, '우리 코드 콘솔 오류 0', mine.slice(0, 4).join(' | ') || '없음');

  console.log('');
  console.log('합계: ' + pass + ' 통과 / ' + fail + ' 실패');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
