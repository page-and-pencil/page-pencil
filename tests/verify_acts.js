require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 수업 중 활동 칩 (C) — 가짜 반·가짜 수업만 쓴다. 실제 반 데이터는 건드리지 않는다.
//  (j) 수업일마다 활동 칩 하나, 휴강일엔 없음, 보강일엔 있음
//  (k) 기록하면 채움 칩
//  (l) 숙제 완료율에 영향 없음
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const posts = [];
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    posts.push(m + ' ' + r.request().url().split('/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 150)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 150)));

  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 180000 });
  await wait(2000);

  // 가짜 반 — 월·수 수업, 휴강 하루, 보강 하루
  const seed = await page.evaluate(() => {
    const today = ppToday();
    const next = n => ppShiftDate(today, n);
    const DOW = ['일', '월', '화', '수', '목', '금', '토'];
    const dowOf = d => DOW[new Date(d + 'T12:00:00').getDay()];
    // 앞으로 20일 안에서 월·수 날짜를 모은다
    const days = [];
    for (let i = 0; i < 20 && days.length < 4; i++) { const d = next(i); if (dowOf(d) === '월' || dowOf(d) === '수') days.push(d); }
    const skip = days[1];                       // 둘째 수업일을 휴강으로
    let extra = '';
    for (let i = 0; i < 20; i++) { const d = next(i); if (dowOf(d) !== '월' && dowOf(d) !== '수') { extra = d; break; } }
    const c = {
      id: 'wzcls1', name: '보기용 반', active: true, days: ['월', '수'],
      studentIds: [], commonMaterials: {}, skipDates: [skip], extraDates: [extra],
      classActs: [{ id: 'readingn', label: '리딩앤 원서 읽기', days: [] }],
    };
    _cache.globalClasses = (_cache.globalClasses || []).filter(x => x && x.id !== 'wzcls1').concat([c]);
    return { days, skip, extra, today };
  });

  const act = await page.evaluate(s => {
    const c = DB.classes().find(x => x.id === 'wzcls1');
    const skipSet = new Set(c.skipDates || []);
    const dowOf = d => ['일', '월', '화', '수', '목', '금', '토'][new Date(d + 'T12:00:00').getDay()];
    const isDay = d => (c.days || []).includes(dowOf(d)) || (c.extraDates || []).indexOf(d) >= 0;
    const on = d => pgActsOn(c, d, isDay(d), skipSet).length;
    return {
      normal: on(s.days[0]), skip: on(s.skip), extra: on(s.extra),
      offday: on(ppShiftDate(s.days[0], 1) === s.skip ? ppShiftDate(s.days[0], 2) : (dowOf(ppShiftDate(s.days[0], 1)) === '화' ? ppShiftDate(s.days[0], 1) : '')),
      count: pgActsOf(c).length,
    };
  }, seed);
  ok('(j) 수업일에 활동 칩 하나', act.normal === 1, '칩 ' + act.normal + '개');
  ok('(j) 휴강일에는 없다', act.skip === 0);
  ok('(j) 보강일에는 있다', act.extra === 1);

  // 요일을 정하면 그 요일만
  const byDay = await page.evaluate(s => {
    const c = DB.classes().find(x => x.id === 'wzcls1');
    c.classActs = [{ id: 'readingn', label: '리딩앤 원서 읽기', days: ['월'] }];
    const dowOf = d => ['일', '월', '화', '수', '목', '금', '토'][new Date(d + 'T12:00:00').getDay()];
    const mon = s.days.find(d => dowOf(d) === '월') || '';
    const wed = s.days.find(d => dowOf(d) === '수') || '';
    const r = { mon: mon ? pgActsOn(c, mon, true, new Set()).length : -1, wed: wed ? pgActsOn(c, wed, true, new Set()).length : -1 };
    c.classActs = [{ id: 'readingn', label: '리딩앤 원서 읽기', days: [] }];
    return r;
  }, seed);
  ok('(j) 요일을 정하면 그 요일만', byDay.mon === 1 && byDay.wed === 0, '월 ' + byDay.mon + ' · 수 ' + byDay.wed);

  // ── (k) 기록하면 채움 ──
  const done = await page.evaluate(s => {
    const c = DB.classes().find(x => x.id === 'wzcls1');
    const a = pgActsOf(c)[0];
    const d = s.days[0];
    const before = pgActDone('wzcls1', d, a, null);
    _cache.lessons = (_cache.lessons || []).concat([{ id: 'wzles1', classId: 'wzcls1', date: d, sid: 'x', acts: ['readingn'] }]);
    const after = pgActDone('wzcls1', d, a, null);
    // 원서 기록만 있어도 '함' 으로 본다
    _cache.lessons = _cache.lessons.filter(x => x.id !== 'wzles1');
    const byOrt = pgActDone('wzcls1', d, a, new Set(['Frog and Toad']));
    return { before: before.done, after: after.done, byOrt: byOrt.done, why: byOrt.why };
  }, seed);
  ok('(k) 체크하면 채움 칩', done.before === false && done.after === true);
  ok('(k) 원서 기록이 있으면 채움 + 책 이름', done.byOrt === true && done.why === 'Frog and Toad', done.why);

  // ── 캘린더에 실제로 그려지는가 ──
  const cal = await page.evaluate(async s => {
    _cache.lessons = (_cache.lessons || []).concat([{ id: 'wzles2', classId: 'wzcls1', date: s.days[0], sid: 'x', acts: ['readingn'] }]);
    swTab('t-class');
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('__cal')?.remove();
    const holder = document.createElement('div');
    holder.id = '__cal';
    holder.innerHTML = _pgCalHtml('wzcls1');
    document.body.appendChild(holder);
    const cells = [...document.querySelectorAll('#__cal .pg-cell')];
    const pick = ds => cells.find(x => x.dataset.ds === ds);
    const c1 = pick(s.days[0]), c2 = pick(s.skip), c3 = pick(s.extra);
    const n = el => el ? el.querySelectorAll('.pg-act').length : -1;
    const rec = el => el ? el.querySelectorAll('.pg-act.rec').length : -1;
    _cache.lessons = _cache.lessons.filter(x => x.id !== 'wzles2');
    const out = { normal: n(c1), recd: rec(c1), skip: n(c2), extra: n(c3), txt: c1 ? c1.textContent.replace(/\s+/g, ' ').slice(0, 50) : '' };
    holder.remove();
    return out;
  }, seed);
  ok('(j) 캘린더 수업일에 칩', cal.normal === 1, '칩 ' + cal.normal + '개 · ' + cal.txt);
  ok('(k) 기록이 있으면 채움 칩', cal.recd === 1);
  ok('(j) 캘린더 휴강일엔 없음 · 보강일엔 있음', cal.skip === 0 && cal.extra === 1, '휴강 ' + cal.skip + ' · 보강 ' + cal.extra);

  // ── (l) 숙제에 영향 없음 ──
  const hw = await page.evaluate(s => {
    const stu = DB.stus().filter(x => !x.inactive)[0];
    if (!stu) return { skip: true };
    const m0 = ppMonthMetrics(stu.id, s.today.slice(0, 7));
    const c = DB.classes().find(x => x.id === 'wzcls1');
    c.classActs = c.classActs.concat([{ id: 'extra1', label: '보기용 활동', days: [] }]);
    const m1 = ppMonthMetrics(stu.id, s.today.slice(0, 7));
    c.classActs = c.classActs.filter(a => a.id !== 'extra1');
    return { a: JSON.stringify(m0.hw || m0), b: JSON.stringify(m1.hw || m1) };
  }, seed);
  ok('(l) 숙제 수치가 그대로', hw.skip || hw.a === hw.b, hw.skip ? '(학생 없음)' : '같음');

  // ── 클래스 수정 창의 활동 칸 ──
  const ec = await page.evaluate(async () => {
    openEditClass('wzcls1');
    await new Promise(r => setTimeout(r, 400));
    const n0 = document.querySelectorAll('#ec-acts .ec-act').length;
    ecActAdd('readingn');                      // 이미 있으니 늘지 않는다
    const n1 = document.querySelectorAll('#ec-acts .ec-act').length;
    ecActAdd('');
    const n2 = document.querySelectorAll('#ec-acts .ec-act').length;
    ecActDel(n2 - 1);
    const n3 = document.querySelectorAll('#ec-acts .ec-act').length;
    try { closeM('m-edit-class'); } catch (e) { }
    return { n0, n1, n2, n3 };
  });
  ok('C1 클래스 수정에 활동 칸', ec.n0 === 1 && ec.n1 === 1 && ec.n2 === 2 && ec.n3 === 1,
    JSON.stringify(ec));

  await page.evaluate(() => { _cache.globalClasses = (_cache.globalClasses || []).filter(c => c && c.id !== 'wzcls1'); });
  console.log('\n가짜 서버가 받은 저장 ' + posts.length + '건 (전부 가짜): ' + posts.slice(0, 4).join(', '));
  console.log('콘솔 오류 ' + errs.length + '건');
  errs.slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_acts 실패:', e); process.exit(1); });
