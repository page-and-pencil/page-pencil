require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 서버 제한(무료 한도 초과) — 402·읽기만 됨·일시 정지일 때.
// 가짜 서버만 쓴다. 실제 서버로는 한 건도 나가지 않는다.
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { pageUrl } = require('./_page');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };

// 가짜 자료 (실제 학생 이름·id 는 쓰지 않는다)
const SNAP = {
  students: [
    { id: 'lx-stu-1', name: '가온', grade: '중1', cls: 'lx-cls-1', pin: '0001', fee: 0 },
    { id: 'lx-stu-2', name: '나봄', grade: '중2', cls: 'lx-cls-1', pin: '0002', fee: 0 },
  ],
  globalClasses: [{ id: 'lx-cls-1', name: '보기반 A', active: true, studentIds: ['lx-stu-1', 'lx-stu-2'] }],
  globalTextbooks: [{ id: 'lx-tb-1', type: 'textbook', title: '보기 리딩 1', units: { 'Unit 1': [{ word: 'curious', ko: '호기심 있는' }] } }],
  library: [],
  lessons: [{ id: 'lx-les-1', sid: 'lx-stu-1', date: '2026-11-10', att: '출석', materials: [], cmt: '보기 수업' }],
  assignments: [{
    id: 'lx-asg-1', sid: 'lx-stu-1', type: 'vocab', category: 'vocab',
    date: '2026-11-13', due: '2026-11-13', title: '보기 숙제', items: [],
  }],
  tests: [], readings: [], logs: [], notices: [], homeworks: [], textbooks: [], messages: [],
  monthlyReports: [], examSchedules: [], counsels: [], vocab_cards: [],
  settings: { acct: { name: '보기 학원' }, cloud: { name: 'drwys3bkz', preset: 'pp_unsigned' } },
};

// 가짜 서버 — mode 로 무엇을 돌려줄지 바꾼다
let mode = '402', reqs = { get: 0, write: 0 }, failCount = 0;
function serve(route) {
  const req = route.request();
  const m = req.method();
  const isWrite = m !== 'GET' && m !== 'HEAD';
  if (isWrite) reqs.write++; else reqs.get++;
  if (mode === '402') return route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ message: 'exceed_egress_quota' }) });
  if (mode === 'writefail' && isWrite) return route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ message: 'exceed_egress_quota' }) });
  if (mode === 'net') { failCount++; return route.abort(); }
  if (mode === '500') return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  const t = (new URL(req.url()).pathname.split('/rest/v1/')[1] || '').split('?')[0];
  const rows = ({
    students: SNAP.students, classes: SNAP.globalClasses,
    global_textbooks: SNAP.globalTextbooks, lessons: SNAP.lessons, assignments: SNAP.assignments,
  })[t] || [];
  return route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(isWrite ? [] : rows.map(d => ({ id: d.id, sid: d.sid || null, data: d, updated_at: '2026-11-13T00:00:00.000Z' }))),
  });
}

// 글자와 바탕의 대비 (WCAG) — 4.5 아래면 읽히지 않는다
const CONTRAST_FN = () => {
  window.__ppLum = c => {
    const n = String(c || '').match(/[\d.]+/g) || [0, 0, 0];
    const [r, g, b] = n.slice(0, 3).map(Number).map(v => v / 255)
      .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  window.__ppBg = el => {
    let n = el;
    while (n && n.nodeType === 1) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(c)) return c;
      n = n.parentElement;
    }
    return 'rgb(255, 255, 255)';
  };
  window.__ppRatio = sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const a = window.__ppLum(getComputedStyle(el).color), b = window.__ppLum(window.__ppBg(el));
    const hi = Math.max(a, b), lo = Math.min(a, b);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
};

async function makePage(browser, opts) {
  const o = opts || {};
  const ctx = await browser.newContext({ viewport: o.vp || { width: 1440, height: 950 }, locale: 'ko-KR' });
  await ctx.addInitScript(sess => {
    try { localStorage.setItem('pp_session', JSON.stringify(sess)); localStorage.removeItem('pp_limited_at'); } catch (e) { }
  }, o.sess || { role: 'teacher' });
  const page = await ctx.newPage();
  await page.route('**/rest/v1/**', serve);
  // 엣지 함수도 같은 꼴로 — 402 일 때만 402 (앱은 뜰 때 tts-proxy·claude-proxy 에 '살아 있나' 를 묻는다)
  await page.route('**/functions/v1/**', r => {
    if (mode === '402') return r.fulfill({ status: 402, contentType: 'application/json', body: '{"message":"exceed_egress_quota"}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false,"server":false}' });
  });
  return { ctx, page };
}

// 스냅샷을 기기에 심는다 (앱이 쓰는 모양 그대로)
async function seedSnap(page, role, sid) {
  await page.evaluate(async o => {
    await idbSet('pp_cache_v2', { at: Date.now(), role: o.role, sid: o.sid, cache: o.cache });
  }, { role: role, sid: sid || '', cache: SNAP });
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const errs = [];

  // ── ① 모두 402 + 스냅샷 있음 — 세 역할 화면이 자료와 함께 열리고 띠가 보인다 ──
  const roles = [
    { role: 'teacher', screen: 's-teacher', sid: '', bar: '보기만 됩니다' },
    { role: 'student', screen: 's-student', sid: 'lx-stu-1', bar: '앱 점검 중이에요' },
    { role: 'parent', screen: 's-parent', sid: 'lx-stu-1', bar: '앱 점검 중입니다' },
  ];
  for (const r of roles) {
    mode = '200';
    const { ctx, page } = await makePage(browser, { sess: { role: r.role, sid: r.sid } });
    page.on('pageerror', e => errs.push(r.role + ' PAGEERROR ' + String(e.message).slice(0, 120)));
    await page.goto(pageUrl(null, null, true), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => typeof idbSet === 'function', null, { timeout: 60000 });
    await seedSnap(page, r.role, r.sid);
    mode = '402';                                  // 이제부터 서버가 다 막는다
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => (typeof _cache !== 'undefined') && (_cache.students || []).length > 0, null, { timeout: 60000 })
      .catch(() => { });
    await wait(1500);
    const st = await page.evaluate(() => ({
      limited: typeof ppLimited === 'function' ? ppLimited() : null,
      stus: (_cache.students || []).length,
      bar: (document.querySelector('.screen.active .pp-limit-bar') || {}).textContent || '',
      screen: (document.querySelector('.screen.active') || {}).id || '',
      note: document.body.innerText.indexOf('자료가 없습니다') >= 0,
      limScreen: !!document.getElementById('pp-limit-screen'),
    }));
    ok('[1] ' + r.role + ' — 제한 중으로 알아채고 기기 자료로 연다',
      st.limited === true && st.stus === 2 && !st.limScreen,
      '학생 ' + st.stus + '명 · 화면 ' + st.screen);
    ok('[4] ' + r.role + ' 띠가 맨 위에 보인다', st.bar.indexOf(r.bar) >= 0, '"' + st.bar.slice(0, 34) + '"');
    ok('[2] ' + r.role + " '자료가 없습니다' 가 뜨지 않는다", st.note === false);
    if (r.role === 'teacher') {
      // ── ③ 스냅샷이 빈 값으로 덮이지 않는다 ──
      const snap = await page.evaluate(async () => {
        const s = await idbGet('pp_cache_v2');
        return { n: ((s || {}).cache || {}).students ? s.cache.students.length : -1 };
      });
      ok('[2] 402 뒤에도 스냅샷이 그대로다 (빈 값으로 저장되지 않는다)', snap.n === 2, '학생 ' + snap.n + '명');
      // ── ② 수업 기록 [저장] 이 꺼져 있고, 눌러도 서버 요청 0건·_cache 그대로 ──
      const before = { w: reqs.write };
      const sv = await page.evaluate(async () => {
        swTab('t-les');
        await new Promise(r => setTimeout(r, 400));
        const b = [...document.querySelectorAll('button[onclick]')].find(x => /saveLes\(/.test(x.getAttribute('onclick') || ''));
        const was = (_cache.lessons || []).length;
        const dis = !!(b && b.disabled);
        if (b) { b.disabled = false; b.click(); }          // 꺼져 있어도 일부러 눌러 본다
        await new Promise(r => setTimeout(r, 900));
        return { dis, was, now: (_cache.lessons || []).length, toast: (document.getElementById('toast') || {}).textContent || '' };
      });
      ok('[3] 수업 기록 [저장] 이 꺼져 있다', sv.dis === true);
      ok('[3] 눌러도 _cache·서버가 그대로다', sv.now === sv.was && reqs.write === before.w,
        '수업 ' + sv.was + '→' + sv.now + ' · 쓰기 요청 ' + (reqs.write - before.w) + '건');
      ok('[3] 왜 안 되는지 알린다', /저장되지 않아요/.test(sv.toast), '"' + sv.toast.slice(0, 30) + '"');
      // ── ⑦ 기기 보관 문항·시험지 인쇄 ──
      const dev = await page.evaluate(async () => {
        const row = {
          id: 'lx-item-1', type: 'blank', grade: '중2', stem: '보기 문항입니다',
          passage: 'Sample only.', choices: ['a', 'b', 'c', 'd', 'e'], answer: 0,
          src: { kind: 'exam', keep: true },
        };
        await idbSet('pp_item_keep', [_ibNorm(row)]);
        await ibLoad(true);
        swTab('t-data'); switchDataTab('items');
        await new Promise(r => setTimeout(r, 700));
        const n = document.querySelectorAll('#ib-list .ib-card').length;
        let printed = '';
        const realOpen = window.open;
        window.open = () => ({ document: { write: h => { printed += h; }, close() { } }, focus() { }, print() { }, close() { } });
        try { if (typeof ibPrintOne === 'function') ibPrintOne('lx-item-1'); } catch (e) { }
        window.open = realOpen;
        return { n, printed: printed.length };
      });
      ok('[2] 기기 보관 문항이 제한 중에도 보인다', dev.n >= 1, '목록 ' + dev.n + '개');
      // 삭제처럼 물어보는 창 — [삭제] 가 꺼지고 왜 안 되는지 한 줄이 뜬다
      const cf = await page.evaluate(async () => {
        let ran = false;
        askConfirm('수업 기록 삭제', '이 수업 기록을 삭제할까요?', '삭제', 'bd', () => { ran = true; });
        await new Promise(r => setTimeout(r, 300));
        const btn = document.getElementById('confirm-ok-btn');
        const note = (document.querySelector('#m-confirm .pp-limit-note') || {}).textContent || '';
        if (btn) btn.click();
        await new Promise(r => setTimeout(r, 300));
        try { closeM('m-confirm'); } catch (e) { }
        return { dis: !!(btn && btn.disabled), note, ran };
      });
      // 띠·안내 줄의 글자와 바탕 대비 (320px 에서 두 줄이 되어도 같다)
      const con = await page.evaluate(async fn => {
        eval('(' + fn + ')()');
        askConfirm('수업 기록 삭제', '이 수업 기록을 삭제할까요?', '삭제', 'bd', () => { });
        await new Promise(r => setTimeout(r, 300));
        const bar = document.querySelector('.screen.active .pp-limit-bar');
        return { bar: window.__ppRatio('.screen.active .pp-limit-bar'), note: window.__ppRatio('#m-confirm .pp-limit-note'),
          lines: bar ? Math.round(bar.getBoundingClientRect().height) : 0 };
      }, CONTRAST_FN.toString());
      await page.setViewportSize({ width: 320, height: 760 });
      await wait(400);
      const con320 = await page.evaluate(() => {
        const bar = document.querySelector('.screen.active .pp-limit-bar');
        return { bar: window.__ppRatio('.screen.active .pp-limit-bar'),
          h: bar ? Math.round(bar.getBoundingClientRect().height) : 0,
          cut: bar ? (bar.scrollHeight - bar.clientHeight) : -1 };
      });
      await page.setViewportSize({ width: 1440, height: 950 });
      await page.evaluate(() => { try { closeM('m-confirm'); } catch (e) { } });
      ok('[4] 띠·안내 줄의 글자와 바탕 대비가 4.5 이상',
        con.bar >= 4.5 && con.note >= 4.5 && con320.bar >= 4.5,
        '띠 ' + con.bar + ':1 · 안내 줄 ' + con.note + ':1 · 320px 띠 ' + con320.bar + ':1');
      ok('[4] 320px 에서 두 줄이 되어도 잘리지 않는다', con320.cut <= 0 && con320.h >= 30,
        '높이 ' + con320.h + 'px · 잘림 ' + con320.cut + 'px');
      ok('[3] 삭제 확인 창의 [삭제] 가 꺼지고 한 줄이 뜬다',
        cf.dis === true && /저장되지 않아요/.test(cf.note) && cf.ran === false, '"' + cf.note.slice(0, 28) + '"');
    }
    if (r.role === 'student') {
      const before = { w: reqs.write };
      const chk = await page.evaluate(async () => {
        const a = (_cache.assignments || [])[0];
        const was = !!(a && a.completedAt);
        await completeAssignment('lx-stu-1', 'lx-asg-1');
        await new Promise(r => setTimeout(r, 600));
        const a2 = (_cache.assignments || [])[0];
        return { was, now: !!(a2 && a2.completedAt), toast: (document.getElementById('toast') || {}).textContent || '' };
      });
      ok('[3] 학생 숙제 체크가 되지 않고 알린다',
        chk.was === false && chk.now === false && reqs.write === before.w && /저장되지 않아요/.test(chk.toast),
        '쓰기 요청 ' + (reqs.write - before.w) + '건 · "' + chk.toast.slice(0, 24) + '"');
    }
    await ctx.close();
  }

  // ── ② 스냅샷이 없으면 안내 한 화면 ──
  {
    mode = '402';
    const { ctx, page } = await makePage(browser, { sess: { role: 'teacher' } });
    await page.goto(pageUrl(null, null, true), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await wait(4000);
    const st = await page.evaluate(() => ({
      limScreen: !!document.getElementById('pp-limit-screen'),
      txt: (document.getElementById('pp-limit-screen') || {}).innerText || '',
      stus: (_cache.students || []).length,
      empty: document.body.innerText.indexOf('자료가 없습니다') >= 0,
    }));
    const conS = await page.evaluate(fn => {
      eval('(' + fn + ')()');
      return { t: window.__ppRatio('#pp-limit-screen .pp-limit-t'), s: window.__ppRatio('#pp-limit-screen .pp-limit-s'),
        s2: window.__ppRatio('#pp-limit-screen .pp-limit-s2') };
    }, CONTRAST_FN.toString());
    ok('[4] 안내 화면의 글자 대비도 4.5 이상',
      conS.t >= 4.5 && conS.s >= 4.5 && conS.s2 >= 4.5,
      '제목 ' + conS.t + ':1 · 본문 ' + conS.s + ':1 · 아래줄 ' + conS.s2 + ':1');
    ok('[2] 스냅샷이 없으면 안내 한 화면만 보인다',
      st.limScreen === true && st.stus === 0 && st.empty === false, '"' + st.txt.replace(/\s+/g, ' ').slice(0, 40) + '"');
    await ctx.close();
  }

  // ── ④ 쓰기만 막힐 때 — 첫 쓰기에서 제한 중으로 바뀌고 화면이 되돌아간다 ──
  {
    mode = '200';
    const { ctx, page } = await makePage(browser, { sess: { role: 'student', sid: 'lx-stu-1' } });
    await page.goto(pageUrl(null, null, true), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => (typeof _cache !== 'undefined') && (_cache.students || []).length > 0, null, { timeout: 60000 });
    await wait(800);
    const was = await page.evaluate(() => (typeof ppLimited === 'function') ? ppLimited() : null);
    mode = 'writefail';
    const r = await page.evaluate(async () => {
      await completeAssignment('lx-stu-1', 'lx-asg-1');
      await new Promise(x => setTimeout(x, 900));
      const a = (_cache.assignments || []).find(x => x.id === 'lx-asg-1');
      return {
        limited: ppLimited(), done: !!(a && a.completedAt),
        bar: !!document.querySelector('.screen.active .pp-limit-bar'),
        toast: (document.getElementById('toast') || {}).textContent || '',
      };
    });
    ok('[1] 읽기는 되고 쓰기만 막힐 때 — 첫 쓰기 실패에서 제한 중으로',
      was === false && r.limited === true, '앞 ' + was + ' → 뒤 ' + r.limited);
    ok('[3] 체크가 되돌아가고 띠가 생긴다', r.done === false && r.bar === true, '"' + r.toast.slice(0, 30) + '"');

    // ── ⑥ 다시 200 이면 띠가 사라지고 저장된다 ──
    mode = '200';
    const back = await page.evaluate(async () => {
      const okNow = await ppLimitProbe();
      await new Promise(x => setTimeout(x, 300));
      const before = ppLimited();
      await completeAssignment('lx-stu-1', 'lx-asg-1');
      await new Promise(x => setTimeout(x, 700));
      const a = (_cache.assignments || []).find(x => x.id === 'lx-asg-1');
      return { okNow, before, done: !!(a && a.completedAt), bar: !!document.querySelector('.screen.active .pp-limit-bar') };
    });
    ok('[1] 200 이 한 번 오면 풀린다', back.okNow === true && back.before === false);
    ok('[4] 띠가 사라지고 저장이 된다', back.bar === false && back.done === true);
    await ctx.close();
  }

  // ── ⑤ 연결 실패 3번 → 제한 중 · 5xx 한 번으로는 아니다 ──
  {
    mode = '200';
    const { ctx, page } = await makePage(browser, { sess: { role: 'teacher' } });
    await page.goto(pageUrl(null, null, true), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => (typeof _cache !== 'undefined') && (_cache.students || []).length > 0, null, { timeout: 60000 });
    const one = await page.evaluate(async () => {
      const u = SUPA_URL + '/rest/v1/lessons?select=id&limit=1';
      await fetch(u, { headers: SUPA_HEADERS }).catch(() => { });
      return ppLimited();
    });
    mode = '500';
    const after500 = await page.evaluate(async () => {
      const u = SUPA_URL + '/rest/v1/lessons?select=id&limit=1';
      await fetch(u, { headers: SUPA_HEADERS }).catch(() => { });
      return ppLimited();
    });
    ok('[1] 5xx 한 번으로는 제한 중이 되지 않는다', one === false && after500 === false);
    const after3 = await page.evaluate(async () => {
      const u = SUPA_URL + '/rest/v1/lessons?select=id&limit=1';
      for (let i = 0; i < 2; i++) await fetch(u, { headers: SUPA_HEADERS }).catch(() => { });
      return ppLimited();
    });
    ok('[1] 잇따른 5xx·연결 실패 세 번이면 제한 중', after3 === true);
    mode = 'net';
    const netOff = await page.evaluate(async () => { ppLimitOff(); return ppLimited(); });
    const after3net = await page.evaluate(async () => {
      const u = SUPA_URL + '/rest/v1/lessons?select=id&limit=1';
      for (let i = 0; i < 3; i++) await fetch(u, { headers: SUPA_HEADERS }).catch(() => { });
      return ppLimited();
    });
    ok('[1] 연결 실패 세 번도 같다', netOff === false && after3net === true);
    // 제한 중에는 더 보내지 않는다
    const sent = reqs.get;
    await page.evaluate(async () => {
      const u = SUPA_URL + '/rest/v1/lessons?select=id&limit=1';
      for (let i = 0; i < 5; i++) await fetch(u, { headers: SUPA_HEADERS }).catch(() => { });
    });
    ok('[1] 제한 중에는 더 보내지 않는다', reqs.get === sent, '그 사이 나간 요청 ' + (reqs.get - sent) + '건');
    await ctx.close();
  }

  console.log('\n가짜 서버가 받은 요청 — 읽기 ' + reqs.get + ' · 쓰기 ' + reqs.write + ' (전부 가짜)');
  console.log('콘솔 오류 ' + errs.length + '건');
  errs.slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_limited 실패:', e); process.exit(1); });
