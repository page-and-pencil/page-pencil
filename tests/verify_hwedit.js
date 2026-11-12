require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 숙제 자유 수정 검증 — 날짜별 일정 줄 수정·삭제·추가, 완료 표시 보존, 구분 직접 입력.
// 실DB 쓰기는 전부 차단(화면·캐시만).
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

  // 매일 7일치 클래스5 하나 만들고, 2일차를 완료로 표시
  const made = await page.evaluate(async (sid) => {
    const add = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return ppYmd(x); };
    const today = ppToday();
    openAssignModal(sid);
    document.getElementById('modal-assign-cat').value = 'recur'; modalAssignCatChange();
    document.getElementById('modal-assign-date').value = today;
    document.getElementById('modal-assign-due').value = add(today, 6);
    document.getElementById('rc-app').value = '클래스5';
    document.getElementById('rc-days').value = 'daily';
    const had = new Set((_cache.assignments || []).map(x => x.id));
    await saveModalAssignment();
    const a = (_cache.assignments || []).find(x => !had.has(x.id));
    a.schedule[1].done = true; a.schedule[1].doneBy = 'teacher'; a.schedule[1].doneAt = new Date().toISOString();
    a.auto = true;   // 자동 진행이 켜진 과제가 손편집으로 꺼지는지도 같이 본다
    return { aid: a.id, today, d1: a.schedule[1].date, n: a.schedule.length };
  }, sid);
  console.log('준비: 매일 클래스5 ' + made.n + '일 · 2일차(' + made.d1 + ') 완료 표시 · 자동 진행 켬\n');

  // ── 1. 수정 모달에 일정이 뜨는가 ──
  const ed = await page.evaluate((o) => {
    openEditAssignModal(o.aid);
    const host = document.getElementById('c5-rows');
    const rows = host ? [...host.querySelectorAll('.c5-row')] : [];
    const extra = document.getElementById('modal-assign-extra');
    return {
      n: rows.length,
      dates: rows.map(r => r.querySelector('[data-c5="date"]')?.value),
      books: [...new Set(rows.map(r => r.querySelector('[data-c5="book"]')?.value))],
      editable: rows.length ? rows[0].querySelector('[data-c5="date"]')?.type : '',
      hasAdd: /줄 추가/.test(extra.textContent || ''),
      warn: /자동 진행.*꺼집니다/.test(extra.textContent || ''),
      doneTxt: /완료 1일/.test(extra.textContent || ''),
    };
  }, made);
  console.log('── 수정 모달의 날짜별 일정');
  say(ed.n === 7, '7줄 그대로 뜸', ed.n + '줄');
  say(ed.editable === 'date', '날짜가 입력칸 (전에는 못 고치는 라벨)', ed.editable);
  say(ed.books.length === 1 && ed.books[0] === '클래스5', '내용 칸에 현재 값');
  say(ed.hasAdd && ed.doneTxt, '줄 추가 버튼 · 완료 일수 표시');
  say(ed.warn, '자동 진행이 꺼진다는 경고');

  // ── 2. 자유 수정: 날짜 바꾸기 · 내용 바꾸기 · 줄 삭제 · 줄 추가 ──
  const saved = await page.evaluate(async (o) => {
    const host = document.getElementById('c5-rows');
    const rows = () => [...host.querySelectorAll('.c5-row')];
    const add = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return ppYmd(x); };
    rows()[0].querySelector('[data-c5="book"]').value = '오토보카';        // 내용 변경
    rows()[0].querySelector('[data-c5="unit"]').value = 'Day 1';
    rows()[2].querySelector('[data-c5="date"]').value = add(o.today, 20);  // 날짜 변경
    rows()[6].querySelector('button').click();                             // 마지막 줄 삭제
    addC5Row();                                                            // 줄 추가
    const last = rows()[rows().length - 1];
    last.querySelector('[data-c5="book"]').value = '리딩앤';
    await saveModalAssignment();
    const a = (_cache.assignments || []).find(x => x.id === o.aid);
    return {
      n: (a.schedule || []).length, first: a.schedule[0], date: a.date, due: a.due, auto: !!a.auto,
      moved: a.schedule.find(s => s.date === add(o.today, 20)),
      done: a.schedule.find(s => s.date === o.d1),
      added: a.schedule.find(s => s.book === '리딩앤'),
      sorted: a.schedule.every((s, i, ar) => !i || ar[i - 1].date <= s.date),
      shown: getComputedStyle(document.getElementById('m-add-assign')).display !== 'none',
      due20: add(o.today, 20),
    };
  }, made);
  console.log('\n── 자유 수정 저장');
  say(saved.n === 7, '7줄 (1줄 빼고 1줄 더함)', saved.n + '줄');
  say(saved.first.book === '오토보카' && saved.first.unit === 'Day 1', '내용·유닛 바뀜', saved.first.book + ' / ' + saved.first.unit);
  say(!!saved.moved, '옮긴 날짜가 반영됨');
  say(saved.done && saved.done.done === true && saved.done.doneBy === 'teacher', '날짜 그대로인 줄의 완료 표시 유지');
  say(!!saved.added, '추가한 줄 들어감');
  say(saved.sorted && saved.date === saved.first.date && saved.due === saved.due20, '날짜순 정렬 · 시작·마감 갱신', saved.date + ' ~ ' + saved.due);
  say(saved.auto === false, '자동 진행이 꺼짐 (손편집 우선)');
  say(!saved.shown, '저장 후 모달 닫힘');

  // ── 3. 일정을 전부 지우면 막는다 ──
  const guard = await page.evaluate(async (o) => {
    openEditAssignModal(o.aid);
    [...document.querySelectorAll('#c5-rows .c5-row')].forEach(r => r.querySelector('button').click());
    await saveModalAssignment();
    const a = (_cache.assignments || []).find(x => x.id === o.aid);
    return { n: (a.schedule || []).length, shown: getComputedStyle(document.getElementById('m-add-assign')).display !== 'none' };
  }, made);
  console.log('\n── 일정을 전부 지웠을 때');
  say(guard.n > 0 && guard.shown, '막고 모달을 연 채로 둠 (과제가 빈 껍데기가 되지 않게)', guard.n + '줄 유지');
  await page.evaluate(() => closeM('m-add-assign'));

  // ── 4. 구분 직접 입력 ──
  const cust = await page.evaluate(async (sid) => {
    openAssignModal(sid);
    const sel = document.getElementById('modal-assign-cat');
    const has = [...sel.options].some(o => o.value === '__custom__');
    sel.value = '__custom__'; modalAssignCatChange();
    const inp = document.getElementById('modal-assign-cat-custom');
    const shown = inp && inp.style.display !== 'none';
    inp.value = '스피킹';
    document.getElementById('modal-assign-book').value = '발표 준비';
    document.getElementById('modal-assign-range').value = '자기소개 1분';
    const had = new Set((_cache.assignments || []).map(x => x.id));
    await saveModalAssignment();
    const a = (_cache.assignments || []).find(x => !had.has(x.id));
    // 다시 열었을 때 그 구분이 남아 있는지
    openEditAssignModal(a.id);
    const back = document.getElementById('modal-assign-cat').value;
    closeM('m-add-assign');
    return { has, shown, cat: a && a.category, book: a && a.bookTitle, back };
  }, sid);
  console.log('\n── 구분 직접 입력');
  say(cust.has && cust.shown, '직접 입력 칸이 생김');
  say(cust.cat === '스피킹', '입력한 구분으로 저장', cust.cat);
  say(cust.back === '스피킹', '수정으로 다시 열어도 그 구분 유지', cust.back);

  console.log('\n실DB 쓰기 시도 ' + writes + '건 (전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
