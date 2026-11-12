require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 넣은 어휘 반복 숙제가 학생·학부모 화면에 제대로 뜨는지. 읽기만, 쓰기 전부 차단.
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
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(4000);

  const d = await page.evaluate((sid) => {
    const today = ppToday();
    const vs = ppLive(_cache.assignments).filter(a => a.sid === sid && a.category === 'recur' && a.auto
      && /요즘 초등 영단어 2|초등 천일문 보카앤스토리/.test(a.bookTitle || ''));
    return {
      today,
      rows: vs.map(a => {
        const sch = recurRebase(a) || a.schedule;
        const t = sch.find(s => s.date === today);
        return {
          title: a.bookTitle, n: sch.length, from: sch[0].date, to: sch[sch.length - 1].date,
          today: t ? (t.unit + (t.done ? ' [완료' + (t.doneBy ? '·' + t.doneBy : '') + ']' : ' [미완료]')) : '오늘 몫 없음',
          doneByLesson: sch.filter(s => s.doneBy === 'lesson').map(s => s.date + ' ' + s.unit),
          first3: sch.slice(0, 3).map(s => s.date + ' ' + s.unit),
          pending: hwPendingNow(a), overdue: hwOverdueDays(a),
        };
      }),
    };
  }, SID);
  console.log('오늘 ' + d.today);
  d.rows.forEach(r => {
    console.log('\n■ ' + r.title + '  ' + r.n + '일치 (' + r.from + '~' + r.to + ')');
    console.log('   첫 3칸: ' + r.first3.join(' · '));
    console.log('   오늘: ' + r.today + '  · 학부모 남은숙제=' + r.pending + ' · 밀린 ' + r.overdue + '일');
    if (r.doneByLesson.length) console.log('   수업으로 처리됨: ' + r.doneByLesson.join(' · '));
  });
  say(d.rows.length === 2, '어휘 반복 숙제 2건이 보인다', d.rows.length + '건');
  const v2 = d.rows.find(r => /요즘/.test(r.title)), v3 = d.rows.find(r => /천일문/.test(r.title));
  say(v2 && v2.first3.join() === '2026-11-07 Unit 28,2026-11-08 Unit 29', '요즘2는 11/7 Unit 28 · 11/8 Unit 29', v2 ? v2.first3.join(' · ') : '없음');
  // 11/5 수업에서 Day 1 을 이미 나갔다 → 자동 진행(recurRebase)이 그 몫을 빼고 Day 2 부터 다시 깐다
  say(v3 && v3.first3[0] === '2026-11-09 Day 2', '천일문은 수업에서 나간 Day 1 을 건너뛰고 11/9 Day 2부터', v3 ? v3.first3[0] : '없음');
  say(v3 && v3.n > 100, '단원이 끝날 때까지 쭉 이어진다', v3 ? v3.n + '일치 → ' + v3.to : '없음');

  // 학생 화면 오늘의 퀘스트
  const stu = await page.evaluate(async (sid) => {
    await previewAsStudent(sid); await new Promise(r => setTimeout(r, 2600));
    const t = document.getElementById('st-home').textContent.replace(/\s+/g, ' ');
    const de = document.documentElement;
    return { has: /Unit 29/.test(t), txt: (t.match(/.{0,46}Unit 29.{0,30}/) || [''])[0], ov: Math.max(0, de.scrollWidth - de.clientWidth) };
  }, SID);
  say(stu.has, "학생 '오늘의 퀘스트'에 Unit 29가 떴다", stu.txt.trim());
  say(stu.ov === 0, '390px 가로 넘침 0px', '넘침 ' + stu.ov + 'px');

  // 학부모 화면
  const par = await page.evaluate(async (sid) => {
    const stu = DB.stus().find(s => s.id === sid);
    show('s-parent'); window.currentParentStudent = stu; if (typeof renderParentHome === 'function') renderParentHome();
    await new Promise(r => setTimeout(r, 1800));
    const t = (document.getElementById('s-parent') || {}).textContent || '';
    const de = document.documentElement;
    return { txt: t.replace(/\s+/g, ' ').match(/숙제.{0,120}/)?.[0] || '(숙제 블록 없음)', ov: Math.max(0, de.scrollWidth - de.clientWidth) };
  }, SID);
  console.log('\n학부모 숙제 블록: ' + par.txt);
  say(par.ov === 0, '학부모 390px 가로 넘침 0px', '넘침 ' + par.ov + 'px');

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 4).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
