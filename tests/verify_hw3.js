require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// ① 마감일 없는 반복 숙제 ② 캘린더에서 리딩앤·원서읽기 한 칩 ③ 클래스5 색 복구. 실DB 쓰기 차단.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1];
const K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };

(async () => {
  const srows = await (await fetch(U + '/rest/v1/students?select=*&limit=20', { headers: { apikey: K, Authorization: 'Bearer ' + K } })).json();
  const sid = srows.map(r => ({ id: r.id, ...(r.data || {}) })).filter(s => !s.inactive && !s._deleted)[0].id;
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(o => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher', sid: o })); } catch (e) { } }, sid);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
  let writes = 0;
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes++; return r.fulfill({ status: 200, body: '[]' });
  });
  const BASE = 'file:///' + encodeURI(ROOT + '/index.html');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(4000);

  // ── ① 마감일 없는 반복 숙제 ──
  const open = await page.evaluate(async (sid) => {
    openAssignModal(sid);
    document.getElementById('modal-assign-cat').value = 'recur'; modalAssignCatChange();
    const hint = document.getElementById('modal-assign-extra').textContent || '';
    document.getElementById('modal-assign-date').value = ppToday();
    document.getElementById('modal-assign-due').value = '';      // 마감일 비움
    document.getElementById('rc-app').value = '클래스5';
    document.getElementById('rc-days').value = 'daily';
    const had = new Set((_cache.assignments || []).map(x => x.id));
    await saveModalAssignment();
    const a = (_cache.assignments || []).find(x => !had.has(x.id));
    return { hint: /마감일을 비우면 끝 없이/.test(hint), id: a.id, openEnded: !!a.openEnded, n: (a.schedule || []).length, last: a.schedule[a.schedule.length - 1].date, today: ppToday(), plus90: _pgAddDays(ppToday(), 90) };
  }, sid);
  console.log('── ① 마감일 없는 반복 숙제');
  say(open.hint, '모달에 안내 문구');
  say(open.openEnded, 'openEnded 표식');
  say(open.n >= 85 && open.last <= open.plus90, '3개월치 먼저 생성', open.n + '일 · ~' + open.last);

  // 끝이 가까워지면 자동으로 더 채우는지 (일정을 잘라 두고 유지 함수 호출)
  const grow = await page.evaluate((o) => {
    const a = (_cache.assignments || []).find(x => x.id === o.id);
    a.schedule = a.schedule.filter(s => s.date <= _pgAddDays(ppToday(), 10));   // 남은 날 10일로 줄임
    const before = a.schedule.length, lastBefore = a.schedule[a.schedule.length - 1].date;
    recurAutoMaintain();
    const a2 = (_cache.assignments || []).find(x => x.id === o.id);
    const dates = a2.schedule.map(s => s.date);
    return { before, lastBefore, after: a2.schedule.length, last: a2.schedule[a2.schedule.length - 1].date, due: a2.due, dup: dates.length !== new Set(dates).size, sorted: dates.every((d, i, ar) => !i || ar[i - 1] <= d) };
  }, open);
  say(grow.after > grow.before && grow.last > grow.lastBefore, '끝이 가까우면 자동으로 이어 붙임', grow.before + '일(~' + grow.lastBefore + ') → ' + grow.after + '일(~' + grow.last + ')');
  say(!grow.dup && grow.sorted && grow.due === grow.last, '중복 없음 · 날짜순 · 마감일 갱신');

  // 마감일을 넣으면 종전대로 (끝 없음 아님)
  const fixed = await page.evaluate(async (sid) => {
    openAssignModal(sid);
    document.getElementById('modal-assign-cat').value = 'recur'; modalAssignCatChange();
    document.getElementById('modal-assign-date').value = ppToday();
    document.getElementById('modal-assign-due').value = _pgAddDays(ppToday(), 6);
    document.getElementById('rc-app').value = '클래스5';
    const had = new Set((_cache.assignments || []).map(x => x.id));
    await saveModalAssignment();
    const a = (_cache.assignments || []).find(x => !had.has(x.id));
    return { openEnded: !!a.openEnded, n: (a.schedule || []).length, id: a.id };
  }, sid);
  say(!fixed.openEnded && fixed.n === 7, '마감일을 넣으면 종전대로 7일', fixed.n + '일');

  // ── ②③ 캘린더 칩: 앱 숙제 색·묶기 ──
  const cal = await page.evaluate(async (o) => {
    // 같은 날 '리딩앤' 과 '원서 읽기' 두 건을 만든다 (실제 데이터와 같은 상황)
    const d = _pgAddDays(ppToday(), 1);
    const mk = (title) => ({ id: uid(), sid: o.sid, type: 'recur', category: 'recur', recurRule: 'daily', date: d, due: d, bookTitle: title, schedule: [{ date: d, book: title, unit: '' }] });
    _cache.assignments.unshift(mk('리딩앤'), mk('주말 원서 읽기'));
    _hwCalStuId = o.sid;
    swTab('t-assign'); renderAssignCal();
    await new Promise(r => setTimeout(r, 600));
    const cell = [...document.querySelectorAll('#assign-cal .pg-cell')].find(c => (c.getAttribute('onclick') || '').includes(d));
    const chips = cell ? [...cell.querySelectorAll('.pg-chip')] : [];
    const info = chips.map(c => ({ t: (c.textContent || '').trim(), col: (c.getAttribute('style') || '').match(/--pgc:([^;"]+)/)?.[1], tip: c.getAttribute('title') || '' }));
    // 클래스5 반복 숙제의 칩 색
    const c5 = (_cache.assignments || []).find(x => x.id === o.c5id);
    const d5 = c5.schedule[0].date;
    const cell5 = [...document.querySelectorAll('#assign-cal .pg-cell')].find(c => (c.getAttribute('onclick') || '').includes(d5));
    const chip5 = cell5 ? [...cell5.querySelectorAll('.pg-chip')].map(c => ({ t: (c.textContent || '').trim(), col: (c.getAttribute('style') || '').match(/--pgc:([^;"]+)/)?.[1] })) : [];
    const legend = (document.getElementById('assign-cal').textContent || '').replace(/\s+/g, ' ');
    return { info, chip5, legend, d };
  }, { sid, c5id: fixed.id });
  console.log('\n── ② 리딩앤 · 원서 읽기 (같은 날 두 건)');
  const rn = cal.info.filter(x => x.t.includes('리딩앤'));
  say(rn.length === 1, '한 칩으로 묶임', cal.info.map(x => x.t).join(' | ') || '(칩 없음)');
  say(rn.length === 1 && /[0-9]+건을 한 칩으로/.test(rn[0].tip), '묶였다는 설명이 툴팁에', (rn[0] ? rn[0].tip.split('\n')[0] : ''));
  say(rn.length === 1 && rn[0].col === '#7C4DD6', '앱 숙제 색(보라)', rn[0] && rn[0].col);

  console.log('\n── ③ 클래스5 칩 색');
  const c5chip = cal.chip5.filter(x => x.t.includes('클래스5'));
  say(c5chip.length >= 1 && c5chip[0].col === '#7C4DD6', '반복으로 만든 클래스5도 보라', c5chip[0] && (c5chip[0].t + ' / ' + c5chip[0].col));
  say(/앱 숙제\(클래스5·리딩앤\)/.test(cal.legend), '범례가 앱 숙제로');

  console.log('\n실DB 쓰기 시도 ' + writes + '건 (전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
