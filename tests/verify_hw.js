require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 매일 반복 클래스5 넣기 + 숙제 삭제 검증. 실DB 쓰기는 전부 차단(화면·캐시만 확인).
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

  // ── 1. 과제 추가 → 반복 → 앱 숙제 UI ──
  const ui = await page.evaluate((sid) => {
    openAssignModal(sid);
    const cat = document.getElementById('modal-assign-cat'); cat.value = 'recur'; modalAssignCatChange();
    const t = document.getElementById('rc-type');
    const vis = id => { const e = document.getElementById(id); return !!e && e.style.display !== 'none'; };
    return {
      opts: [...t.options].map(o => o.value + ':' + o.textContent.trim()),
      def: t.value, app: vis('rc-app-wrap'), fixed: vis('rc-fixed-wrap'), book: vis('rc-book-wrap'),
      apps: [...(document.getElementById('rc-app') || { options: [] }).options].map(o => o.value),
      days: [...document.getElementById('rc-days').options].map(o => o.value), daysDef: document.getElementById('rc-days').value,
    };
  }, sid);
  console.log('── 과제 추가 → 구분 "반복"');
  say(ui.def === 'app' && ui.opts[0].startsWith('app:'), '유형 첫 칸이 앱 숙제', ui.opts[0]);
  say(ui.app && !ui.fixed && !ui.book, '앱 고르는 칸만 보임');
  say(ui.apps.join(',') === '클래스5,오토보카,리딩앤', '앱 세 가지', ui.apps.join(','));
  say(ui.daysDef === 'daily', '반복 요일 기본값이 매일');

  // ── 2. 매일 7일치 클래스5 할당 ──
  const made = await page.evaluate(async (sid) => {
    const add = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return ppYmd(x); };
    const today = ppToday();
    document.getElementById('modal-assign-date').value = today;
    document.getElementById('modal-assign-due').value = add(today, 6);
    document.getElementById('rc-app').value = '클래스5';
    document.getElementById('rc-days').value = 'daily';
    const before = (_cache.assignments || []).length;
    const had = new Set((_cache.assignments || []).map(x => x.id));
    await saveModalAssignment();
    // DB.assigns() 가 _cache 배열을 제자리 정렬하므로 [0] 이 새 것이라는 보장이 없다 — id 로 찾는다
    const a = (_cache.assignments || []).find(x => !had.has(x.id));
    return { added: (_cache.assignments || []).length - before, a: a && { id: a.id, cat: a.category, title: a.bookTitle, n: (a.schedule || []).length, first: a.schedule[0], last: a.schedule[a.schedule.length - 1], auto: !!a.auto }, today, end: add(today, 6) };
  }, sid);
  console.log('\n── 매일 반복 클래스5 7일치');
  say(made.added === 1 && made.a.cat === 'recur', '반복 과제로 만들어짐', made.a && made.a.cat);
  say(made.a.n === 7, '7일치 일정', made.a.n + '일 (' + made.a.first.date + ' ~ ' + made.a.last.date + ')');
  say(made.a.title === '클래스5' && made.a.first.book === '클래스5', '제목·일정 모두 클래스5');
  say(made.a.first.date === made.today && made.a.last.date === made.end, '시작·종료 날짜가 입력대로');

  // ── 3. 학생 화면에서 앱 숙제로 보이는지 ──
  const stu = await page.evaluate(async (sid) => {
    await loadParent(sid); // 캐시 그대로 두고 학생 화면으로
    const s = DB.stus().find(x => x.id === sid);
    await loginStudent(s);
    await new Promise(r => setTimeout(r, 1200));
    swStuTab('st-home');
    await new Promise(r => setTimeout(r, 1200));
    const host = document.getElementById('st-home');
    const card = [...host.querySelectorAll('.hw-check-card')].find(c => (c.textContent || '').includes('클래스5'));
    if (!card) return { found: false, txt: (host.textContent || '').replace(/\s+/g, ' ').slice(0, 120) };
    const btn = card.querySelector('button[onclick*="openHwApp"]');
    return { found: true, cls: card.className, icon: (card.querySelector('.hw-ico') || {}).textContent, btn: btn ? btn.getAttribute('onclick') : null, label: btn ? btn.textContent.trim() : '' };
  }, sid);
  console.log('\n── 학생 화면');
  say(stu.found, '오늘 할 일에 클래스5 카드', stu.found ? '' : stu.txt);
  say(stu.found && stu.icon === '🎮', '아이콘이 🎮 (반복 🔁 아님)', stu.icon);
  say(stu.found && /hw-k-app/.test(stu.cls), '앱 숙제 색으로 표시', stu.cls);
  say(stu.found && /openHwApp\('class5'/.test(stu.btn || ''), '클래스5 열기 버튼', stu.label);

  // ── 4. 주말만 규칙 ──
  const we = await page.evaluate(() => {
    const today = ppToday();
    const add = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return ppYmd(x); };
    const sch = buildRecurSchedule({ rule: 'weekend', start: today, end: add(today, 13), text: '클래스5' });
    const dow = sch.map(s => ['일', '월', '화', '수', '목', '금', '토'][new Date(s.date + 'T12:00:00').getDay()]);
    return { n: sch.length, dow: [...new Set(dow)].join(',') };
  });
  console.log('\n── 반복 요일 "주말만" (2주)');
  say(we.n === 4 && we.dow.split(',').every(d => d === '토' || d === '일'), '토·일만 4일', we.n + '일 · ' + we.dow);

  // ── 5. 삭제: 하루만 빼기 → 전체 삭제 ──
  const del = await page.evaluate(async (o) => {
    show('s-teacher'); swTab('t-assign');
    await new Promise(r => setTimeout(r, 800));
    // 학생 화면으로 다녀오면서 캐시를 다시 읽어 와(서버 저장은 차단돼 있다) 아까 만든 건 사라졌다.
    // 삭제 검증용으로 같은 방식으로 한 건 더 만든다.
    openAssignModal(o.sid);
    document.getElementById('modal-assign-cat').value = 'recur'; modalAssignCatChange();
    const add = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return ppYmd(x); };
    document.getElementById('modal-assign-date').value = o.today;
    document.getElementById('modal-assign-due').value = add(o.today, 6);
    document.getElementById('rc-app').value = '클래스5';
    document.getElementById('rc-days').value = 'daily';
    const had = new Set((_cache.assignments || []).map(x => x.id));
    await saveModalAssignment();
    const fresh = (_cache.assignments || []).find(x => !had.has(x.id));
    o = { ...o, aid: fresh.id };
    swTab('t-assign');
    await new Promise(r => setTimeout(r, 800));
    const row = [...document.querySelectorAll('#t-assign .assign-item')].find(x => (x.textContent || '').includes('클래스5'));
    const btns = row ? [...row.querySelectorAll('button')].map(b => b.textContent.trim()) : [];
    deleteSchedDay(o.aid, o.today); confirmOk();
    await new Promise(r => setTimeout(r, 700));
    const a1 = (_cache.assignments || []).find(x => x.id === o.aid);
    const after1 = { n: (a1.schedule || []).length, date: a1.date };
    deleteAssign(o.aid);
    const msg = document.getElementById('confirm-msg').textContent;
    confirmOk();
    await new Promise(r => setTimeout(r, 700));
    return { btns, after1, msg, gone: !(_cache.assignments || []).some(x => x.id === o.aid) };
  }, { aid: made.a.id, today: made.today, sid });
  console.log('\n── 과제 탭에서 삭제');
  say(del.btns.includes('이 날 빼기') && del.btns.includes('삭제'), '줄에 버튼이 생김', del.btns.join(' · '));
  say(del.after1.n === 6 && del.after1.date !== made.today, '하루만 빼기 → 6일 · 시작일 갱신', del.after1.n + '일 · 시작 ' + del.after1.date);
  say(/6일치를 통째로/.test(del.msg), '전체 삭제 전에 며칠치인지 알림', del.msg.split('\n')[0].slice(0, 46));
  say(del.gone, '전체 삭제됨');

  // ── 6. 클래스5 구분 안내 ──
  const c5 = await page.evaluate((sid) => {
    openAssignModal(sid);
    const cat = document.getElementById('modal-assign-cat'); cat.value = 'class5'; modalAssignCatChange();
    return (document.getElementById('modal-assign-extra').textContent || '').replace(/\s+/g, ' ');
  }, sid);
  console.log('\n── 구분 "클래스5" 안내');
  say(/매일 클래스5 접속.*반복.*앱 숙제/.test(c5), '반복으로 가는 길 안내', c5.slice(40, 130));

  console.log('\n실DB 쓰기 시도 ' + writes + '건 (전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
