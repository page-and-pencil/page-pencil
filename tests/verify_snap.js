require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 스냅샷 부팅 — 역할·학생이 바뀔 때 다른 사람 데이터가 보이지 않는지, 로그아웃이 스냅샷을 지우는지,
// 스냅샷 부팅 뒤에도 학생 단어장·원서 본문 데이터가 온전한지. 한 컨텍스트(= 한 기기) 안에서 확인.
// 실DB 쓰기는 전부 차단.
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
  const srows = await (await fetch(U + '/rest/v1/students?select=*&limit=60', { headers: { apikey: K, Authorization: 'Bearer ' + K } })).json();
  const stus = srows.map(r => ({ id: r.id, ...(r.data || {}) })).filter(s => !s.inactive && !s._deleted);
  const A = stus[0];
  if (!A) { console.log('활성 학생이 없습니다'); process.exit(1); }
  // 지금 DB의 활성 학생은 1명이다. '다른 학생의 스냅샷' 은 가짜 스냅샷(IndexedDB 로컬 쓰기)으로 만든다
  // — 실제 학생 두 명보다 오히려 또렷하다: 침입자 이름·단어카드를 심어 두고 한 번이라도 보이는지 본다.
  const SPY = '스냅샷침입자';
  console.log('활성 학생 1명 + 가짜 타인 스냅샷으로 확인 (이름 생략)\n');

  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 860 }, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 130)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 130)); });
  let full = 0, bytes = 0;
  page.on('requestfinished', async req => {
    const u = req.url(); if (u.indexOf(U) !== 0) return;
    let s = {}; try { s = await req.sizes(); } catch (e) { }
    bytes += s.responseBodySize || 0;
    if (/global_textbooks\?limit=/.test(u)) full++;
  });
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    return (m === 'GET' || m === 'HEAD') ? r.continue() : r.fulfill({ status: 200, body: '[]' });
  });
  const BASE = 'file:///' + encodeURI(ROOT + '/index.html');

  // 세션을 심고 다시 열기 — 부팅 동안 화면에 뜬 이름을 50ms 마다 모은다(한순간도 놓치지 않게)
  const boot = async (sess, watchSel) => {
    await page.evaluate(o => localStorage.setItem('pp_session', JSON.stringify(o)), sess);
    full = 0; bytes = 0;
    const seen = new Set();
    const nav = page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const t0 = Date.now();
    const poll = (async () => {
      while (Date.now() - t0 < 9000) {
        try {
          const v = await page.evaluate(s => {
            const el = document.querySelector(s);
            const vis = el && el.offsetParent !== null;
            return vis ? (el.textContent || '').trim() : null;
          }, watchSel);
          if (v) seen.add(v);
        } catch (e) { }
        await new Promise(r => setTimeout(r, 50));
      }
    })();
    await nav;
    await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
    await poll;
    return { full, bytes, seen: [...seen] };
  };

  // localStorage 를 쓰려면 먼저 문서 origin 이 있어야 한다 (about:blank 에서는 SecurityError).
  // 세션 없이 열면 로그인 화면이고 데이터는 받지 않는다 — 측정에 섞이지 않는다.
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });

  // ── A. 선생님으로 콜드 부팅 → 스냅샷은 '선생님' 것 ──
  let r = await boot({ role: 'teacher' }, '#sp-stu-name');
  const owner1 = await page.evaluate(async () => { const s = await idbGet('pp_cache_v2'); return s ? { role: s.role, sid: s.sid } : null; });
  console.log('── 선생님 콜드 부팅');
  say(r.full === 1, '교재 전체 1회 (스냅샷 없음)', kb(r.bytes));
  say(owner1 && owner1.role === 'teacher' && !owner1.sid, '스냅샷에 주인(선생님) 표시', JSON.stringify(owner1));

  // ── B. 같은 기기에서 학생 A 로 전환 ──
  r = await boot({ role: 'student', sid: A.id }, '#stu-name-badge');
  console.log('\n── 선생님 → 학생A 전환');
  say(r.full === 1, '선생님 스냅샷을 쓰지 않고 전체 로드', '교재 전체 ' + r.full + '회 · ' + kb(r.bytes));
  say(r.seen.every(n => n === A.name), '부팅 중 화면에 뜬 이름이 A 뿐', r.seen.map(n => n === A.name ? 'A' : '[' + n + ']').join(',') || '(표시 없음)');

  // ── C. 학생 A 로 다시 열기 (스냅샷 부팅) ──
  const beforeData = await page.evaluate(() => ({
    tbUnits: (_cache.globalTextbooks || []).filter(b => b.units && Object.keys(b.units).length).length,
    tbTexts: (_cache.globalTextbooks || []).filter(b => b.unitTexts && Object.keys(b.unitTexts).length).length,
    libTexts: (_cache.library || []).filter(b => b.unitTexts && Object.keys(b.unitTexts).length).length,
    cards: (_cache.vocab_cards || []).length,
  }));
  r = await boot({ role: 'student', sid: A.id }, '#stu-name-badge');
  const afterData = await page.evaluate(() => ({
    tbUnits: (_cache.globalTextbooks || []).filter(b => b.units && Object.keys(b.units).length).length,
    tbTexts: (_cache.globalTextbooks || []).filter(b => b.unitTexts && Object.keys(b.unitTexts).length).length,
    libTexts: (_cache.library || []).filter(b => b.unitTexts && Object.keys(b.unitTexts).length).length,
    cards: (_cache.vocab_cards || []).length,
    foreign: (_cache.vocab_cards || []).filter(c => c.sid && c.sid !== (loadSession() || {}).sid).length,
  }));
  console.log('\n── 학생A 다시 열기 (스냅샷 부팅)');
  say(r.full === 0, '교재 전체를 받지 않음', kb(r.bytes));
  say(r.seen.every(n => n === A.name), '화면 이름은 A 뿐');
  say(afterData.tbUnits === beforeData.tbUnits && afterData.tbTexts === beforeData.tbTexts && afterData.libTexts === beforeData.libTexts,
    '단어 목록(units)·본문(unitTexts) 그대로',
    `교재 units ${afterData.tbUnits}권 · 교재 본문 ${afterData.tbTexts}권 · 원서 본문 ${afterData.libTexts}권`);
  say(afterData.foreign === 0, '남의 단어카드 없음', '내 카드 ' + afterData.cards + '개');

  // 학생 화면 실제 렌더 — 단어장·원서 탭
  const panels = await page.evaluate(async () => {
    const out = {};
    for (const t of ['st-vocab', 'st-library', 'st-home']) {
      try { swStuTab(t); } catch (e) { out[t] = 'ERR ' + e.message; continue; }
      await new Promise(r => setTimeout(r, 900));
      const p = document.getElementById(t);
      out[t] = p ? (p.textContent || '').replace(/\s+/g, ' ').trim().length : 'no panel';
    }
    return out;
  });
  say(Object.values(panels).every(v => typeof v === 'number' && v > 50), '단어장·원서·홈 탭이 내용과 함께 그려짐', JSON.stringify(panels));

  // ── D. 다른 학생의 스냅샷이 남아 있을 때 ──
  await page.evaluate(async (o) => {
    const snap = { at: Date.now(), role: 'student', sid: 'probe-other-sid', cache: {
      students: [{ id: 'probe-other-sid', name: o.spy, grade: '6학년', pin: '0000' }],
      lessons: [{ id: 'probe-les', sid: 'probe-other-sid', date: '2026-11-01', materials: {}, cmt: o.spy + ' 수업' }],
      tests: [], readings: [], logs: [], notices: [], homeworks: [], assignments: [], textbooks: [],
      messages: [], library: [], globalTextbooks: [], globalClasses: [], monthlyReports: [],
      examSchedules: [], learningGoals: [], counsels: [], settings: {},
      vocab_cards: [{ id: 'probe-card', sid: 'probe-other-sid', word: 'trespass', meaning: '침입하다' }],
      _tbStamps: { x: '2026-01-01' },
    } };
    await idbSet('pp_cache_v2', snap);
  }, { spy: SPY });
  r = await boot({ role: 'student', sid: A.id }, '#stu-name-badge');
  const spyState = await page.evaluate((spy) => ({
    inCache: (_cache.students || []).some(s => s.name === spy),
    spyCards: (_cache.vocab_cards || []).filter(c => c.sid === 'probe-other-sid').length,
    foreign: (_cache.vocab_cards || []).filter(c => c.sid && c.sid !== (loadSession() || {}).sid).length,
    onScreen: (document.body.textContent || '').indexOf(spy) >= 0,
  }), SPY);
  console.log('\n── 다른 학생의 스냅샷이 남아 있을 때 (학생A 로 부팅)');
  say(r.full === 1, '남의 스냅샷을 쓰지 않고 전체 로드', '교재 전체 ' + r.full + '회');
  say(r.seen.every(n => n === A.name), '부팅 중 화면에 뜬 이름이 A 뿐', r.seen.map(n => n === A.name ? 'A' : '!!' + n + '!!').join(',') || '(표시 없음)');
  say(!spyState.inCache && !spyState.onScreen, '침입자 데이터가 캐시·화면에 한 번도 없음');
  say(spyState.spyCards === 0 && spyState.foreign === 0, '남의 단어카드 없음');

  // ── E. 학부모(A) 전환 → 다시 열기 ──
  r = await boot({ role: 'parent', sid: A.id }, '#p-name');
  console.log('\n── 학생 → 학부모(A) 전환');
  say(r.full === 1, '학생 스냅샷을 쓰지 않고 전체 로드');
  say(r.seen.every(n => n === A.name), '화면 이름은 A 뿐', r.seen.join(',') || '(표시 없음)');
  r = await boot({ role: 'parent', sid: A.id }, '#p-name');
  console.log('\n── 학부모(A) 다시 열기 (스냅샷 부팅)');
  say(r.full === 0, '교재 전체를 받지 않음', kb(r.bytes));
  say(r.seen.every(n => n === A.name), '화면 이름은 A 뿐');

  // ── F. 로그아웃 → 스냅샷 삭제 ──
  await page.evaluate(() => clearSession());
  await page.waitForTimeout(900);
  const gone = await page.evaluate(async () => (await idbGet('pp_cache_v2')) == null);
  console.log('\n── 로그아웃');
  say(gone, '스냅샷이 지워짐');
  r = await boot({ role: 'parent', sid: A.id }, '#p-name');
  say(r.full === 1, '로그아웃 뒤 첫 부팅은 전체 로드', '교재 전체 ' + r.full + '회');

  console.log('\n콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 6).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await ctx.close(); await browser.close();
  process.exit(fails ? 1 : 0);
})();
