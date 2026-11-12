require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// egress 다이어트 동작 검증 — 교재 라이트 동기화의 정상·예외 경로. 쓰기는 전부 차단.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1];
const K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];
let fails = 0;
const say = (p, label, extra) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + label + (extra ? '  — ' + extra : '')); };
const kb = b => b >= 1048576 ? (b / 1048576).toFixed(2) + 'MB' : (b / 1024).toFixed(1) + 'KB';

(async () => {
  const srows = await (await fetch(U + '/rest/v1/students?select=*&limit=20', { headers: { apikey: K, Authorization: 'Bearer ' + K } })).json();
  const sid = srows.map(r => ({ id: r.id, ...(r.data || {}) })).filter(s => !s.inactive && !s._deleted)[0].id;
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(o => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher', sid: o })); } catch (e) { } }, sid);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 130)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 130)); });

  // 요청 기록 + 교재 라이트 질의를 상황별로 가로채기 위한 모드
  let mode = 'normal';
  const log = [];
  let bytes = 0;
  page.on('requestfinished', async req => {
    const u = req.url(); if (u.indexOf(U) !== 0) return;
    let s = {}; try { s = await req.sizes(); } catch (e) { }
    bytes += s.responseBodySize || 0;
    const q = decodeURIComponent(u.replace(U + '/rest/v1/', ''));
    log.push(/global_textbooks\?select=id,updated_at/.test(q) ? 'TB-STAMP'
      : /global_textbooks\?select=\*&id=in\./.test(q) ? 'TB-ROWS:' + (q.match(/in\.\(([^)]*)\)/) || [, ''])[1].split(',').length
        : /global_textbooks\?limit=/.test(q) ? 'TB-FULL'
          : /global_textbooks/.test(q) ? 'TB-OTHER' : 'other');
  });
  await page.route('**/rest/v1/global_textbooks?select=id,updated_at*', r => {
    if (mode === 'fail') return r.fulfill({ status: 500, body: 'boom' });
    if (mode === 'empty') return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return r.continue();
  });
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    return (m === 'GET' || m === 'HEAD') ? r.continue() : r.fulfill({ status: 200, body: '[]' });
  });

  const state = () => page.evaluate(() => ({
    tb: (_cache.globalTextbooks || []).length, lib: (_cache.library || []).length,
    stamps: Object.keys(_cache._tbStamps || {}).length,
  }));
  const bg = async () => {   // 백그라운드 갱신 1회 강제
    log.length = 0; bytes = 0;
    await page.evaluate(() => { _lastLoadAt = 0; _bgRefreshing = false; });
    await page.evaluate(() => _refreshIfStale(1));
    await page.waitForTimeout(6000);
    return { reqs: log.filter(x => x !== 'other'), bytes };
  };

  // ── 콜드 로드 ──
  await page.goto('file:///' + encodeURI(ROOT + '/index.html'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(7000);
  const cold = await state();
  console.log('\n── 콜드 로드');
  say(log.filter(x => x === 'TB-FULL').length === 1, '교재 전체를 한 번만 받음', 'TB-FULL ' + log.filter(x => x === 'TB-FULL').length + '회 · ' + kb(bytes));
  say(cold.stamps > 0 && cold.stamps >= cold.tb + cold.lib, '변경 확인 기준(_tbStamps) 생성', cold.stamps + '행 / 교재 ' + cold.tb + ' + 원서 ' + cold.lib);

  // ── 변경 없는 백그라운드 갱신 ──
  let r = await bg();
  const after1 = await state();
  console.log('\n── 백그라운드 갱신 (교재 변경 없음)');
  say(!r.reqs.includes('TB-FULL'), '교재 전체를 받지 않음', r.reqs.join(' ') || '(교재 요청 없음)');
  say(r.reqs.filter(x => x === 'TB-STAMP').length === 1, 'id,updated_at 확인만 1회');
  say(!r.reqs.some(x => x.startsWith('TB-ROWS')), '바뀐 행 요청 없음');
  say(after1.tb === cold.tb && after1.lib === cold.lib, '교재·원서 수 그대로', after1.tb + ' / ' + after1.lib);
  say(r.bytes < 120000, '전송량 100KB 미만', kb(r.bytes));

  // ── 한 권이 바뀐 것처럼 ──
  const victim = await page.evaluate(() => { const id = Object.keys(_cache._tbStamps)[0]; _cache._tbStamps[id] = '2000-01-01T00:00:00Z'; return id; });
  r = await bg();
  const after2 = await state();
  console.log('\n── 백그라운드 갱신 (한 권 변경)');
  say(r.reqs.includes('TB-ROWS:1'), '바뀐 한 권만 다시 받음', r.reqs.join(' '));
  say(!r.reqs.includes('TB-FULL'), '전체 재수신 없음');
  say(after2.tb === cold.tb && after2.lib === cold.lib, '목록 수 유지', after2.tb + ' / ' + after2.lib);
  say(r.bytes < 120000, '전송량 100KB 미만', kb(r.bytes));

  // ── 하드 삭제된 책 (응답에 없는 id) ──
  await page.evaluate(() => {
    _cache._tbStamps['probe-gone-id'] = '2026-01-01T00:00:00Z';
    _cache.globalTextbooks.push({ id: 'probe-gone-id', type: 'textbook', title: '없어진 책(검증용)' });
  });
  const before3 = await state();
  r = await bg();
  const after3 = await state();
  console.log('\n── 서버에서 사라진 책');
  say(after3.tb === before3.tb - 1, '캐시에서 제거됨', before3.tb + ' → ' + after3.tb);
  say(await page.evaluate(() => !(_cache.globalTextbooks || []).some(b => b.id === 'probe-gone-id')), '그 책만 빠짐');

  // ── 예외: 확인 질의가 실패(500) ──
  mode = 'fail';
  const before4 = await state();
  r = await bg();
  const after4 = await state();
  console.log('\n── 확인 질의 실패(500)');
  say(after4.tb === before4.tb && after4.lib === before4.lib, '캐시를 건드리지 않음', before4.tb + ' → ' + after4.tb);
  say(after4.stamps === before4.stamps, '기준도 그대로');

  // ── 예외: 빈 응답 ──
  mode = 'empty';
  r = await bg();
  const after5 = await state();
  console.log('\n── 확인 질의가 0행');
  say(after5.tb === before4.tb && after5.lib === before4.lib, '전부 삭제로 읽지 않음', before4.tb + ' → ' + after5.tb);
  say(after5.stamps === before4.stamps, '기준도 그대로');
  mode = 'normal';

  // ── 학부모: 30초 폴링이 사라졌는지 + 복귀 시 최신화 ──
  await page.evaluate(o => loadParent(o), sid);
  await page.waitForTimeout(1500);
  log.length = 0; bytes = 0;
  await page.waitForTimeout(40000);                     // 30초 폴링이 남아 있으면 이 사이에 돈다
  console.log('\n── 학부모 화면 40초 대기');
  say(log.length === 0, '주기 폴링 없음', log.length + '건 요청');
  await page.evaluate(() => { _lastLoadAt = Date.now() - 180000; _bgRefreshing = false; });  // 3분 전 데이터
  log.length = 0; bytes = 0;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(6000);
  const onParent = await page.evaluate(() => document.getElementById('s-parent')?.classList.contains('active'));
  console.log('\n── 앱으로 돌아왔을 때 (3분 지난 데이터)');
  say(log.length > 0, '최신화가 돈다', log.length + '건 · ' + kb(bytes));
  say(!log.includes('TB-FULL'), '그래도 교재 전체는 안 받음');
  say(onParent, '학부모 화면이 그대로 보인다');

  console.log('\n콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await ctx.close(); await browser.close();
  process.exit(fails ? 1 : 0);
})();
