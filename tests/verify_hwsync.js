require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 1) 학생/학부모 숙제 완료 표시 일치  2) 과제 할당 교재명 검색. 읽기만, 쓰기 전부 차단.
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = (process.env.PP_REAL_SID || '');
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const writes = [], errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"server":true,"ready":true}' }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(4000);

  // ───── 1. 오늘 몫 기준이 학생·학부모에서 같은가 ─────
  console.log('── 1  학생 · 학부모 완료 표시');
  const a = await page.evaluate((sid) => {
    const today = ppToday();
    const rows = ppLive(_cache.assignments).filter(x => x.sid === sid && (x.schedule || []).length).map(x => {
      const sch = (x.category === 'recur' && x.auto && typeof recurRebase === 'function') ? (recurRebase(x) || x.schedule) : (x.schedule || []);
      const t = sch.find(s => s.date === today);
      return {
        title: x.bookTitle || x.range || x.id,
        stu: t ? (t.done ? '완료' : '미완료') : '오늘 몫 없음',   // 학생 화면이 보는 것 = 오늘 칸
        par: hwPendingNow(x) ? '남은 숙제' : '안 뜸',             // 학부모 숙제 목록
        overdue: hwOverdueDays(x),
      };
    });
    return { today, rows };
  }, SID);
  console.log('   오늘 ' + a.today);
  a.rows.forEach(r => console.log('   · ' + r.title.padEnd(22) + ' 학생=' + r.stu.padEnd(9) + ' 학부모=' + r.par.padEnd(8) + (r.overdue ? ' 밀린 ' + r.overdue + '일' : '')));
  const bad = a.rows.filter(r => (r.stu === '완료' || r.stu === '오늘 몫 없음') && r.par === '남은 숙제');
  say(bad.length === 0, '학생이 오늘 몫을 끝낸 숙제가 학부모에게 남은 숙제로 남지 않는다', bad.map(x => x.title).join(', ') || '어긋난 숙제 0건');
  const rn = a.rows.find(r => /리딩앤 원서/.test(r.title));
  say(rn && rn.stu === '완료' && rn.par === '안 뜸', "'리딩앤 원서 읽기'(오늘 완료)가 양쪽에서 완료", rn ? '학생=' + rn.stu + ' 학부모=' + rn.par + ' 밀린 ' + rn.overdue + '일' : '없음');

  // 학부모 화면 실제 그림
  const par = await page.evaluate(async (sid) => {
    const stu = DB.stus().find(s => s.id === sid);
    show('s-parent'); window.currentParentStudent = stu;
    if (typeof renderParentHome === 'function') renderParentHome();
    await new Promise(r => setTimeout(r, 2200));
    const el = document.getElementById('s-parent');
    const t = (el ? el.textContent : '').replace(/\s+/g, ' ');
    const de = document.documentElement;
    const over = []; (el ? el.querySelectorAll('*') : []).forEach(x => { const b = x.getBoundingClientRect(); if (b.width && b.right > de.clientWidth + 1) over.push(x.className); });
    return { hw: (t.match(/숙제[\s\S]{0,180}/) || [''])[0], ov: Math.max(0, de.scrollWidth - de.clientWidth), over: over.length };
  }, SID);
  console.log('   학부모 숙제 칸: ' + par.hw.slice(0, 170));
  say(par.ov === 0 && par.over === 0, '학부모 390px 넘침 0', '가로 ' + par.ov + 'px · 밖으로 나간 요소 ' + par.over + '개');

  // ───── 2. 과제 할당 교재명 검색 ─────
  console.log('\n── 2  과제 할당 교재명 검색');
  await page.setViewportSize({ width: 1440, height: 980 });
  const s = await page.evaluate(async (sid) => {
    show('s-teacher'); if (typeof openAssignModal === 'function') openAssignModal(sid);
    else { const b = [...document.querySelectorAll('[onclick*="AddAssign"],[onclick*="openAssign"]')][0]; if (b) b.click(); }
    await new Promise(r => setTimeout(r, 700));
    const inp = document.getElementById('modal-assign-book'), dd = document.getElementById('modal-assign-book-dd');
    const cat = document.getElementById('modal-assign-cat');
    const run = (q, c) => {
      if (cat && c != null) cat.value = c;
      inp.value = q; modalAssignBookSearch();
      return {
        q, cat: c, open: dd.style.display !== 'none',
        hits: [...dd.querySelectorAll('div')].map(d => d.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
      };
    };
    return {
      modal: !!inp,
      a: run('요즘', 'vocab'),
      b: run('천일문', 'vocab'),
      c: run('Read It', 'reading'),
      d: run('ort', 'book'),
      e: run('ㅋㅋㅋ없는교재', 'vocab'),
    };
  }, SID);
  say(s.modal, '과제 할당 모달이 열린다');
  [s.a, s.b, s.c, s.d].forEach(r => {
    say(r.open && r.hits.length > 0, `'${r.q}' (구분 ${r.cat}) 검색 결과가 뜬다`, (r.hits[0] || '결과 없음'));
    r.hits.slice(0, 3).forEach(h => console.log('     · ' + h));
  });
  say(!s.e.open, '없는 이름은 목록을 열지 않는다');
  say(/요즘 초등 영단어/.test(s.a.hits[0] || ''), "'요즘' → 요즘 초등 영단어가 맨 위", s.a.hits[0] || '');
  say(/어휘/.test(s.a.hits[0] || ''), '결과에 종류(어휘/원서…)가 함께 보인다', s.a.hits[0] || '');

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단)' + (writes.length ? ' — ' + [...new Set(writes)].join(', ') : '') + ' · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 4).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
