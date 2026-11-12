require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 건너뛴 두 항목(1-6-1 화면 · 1-6-3 프롬프트)을 캐시에만 넣은 가짜 기록으로 확인.
// 실DB 쓰기 전부 차단.
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
  const srows = await (await fetch(U + '/rest/v1/students?select=*&limit=50', { headers: { apikey: K, Authorization: 'Bearer ' + K } })).json();
  const stu = srows.map(r => ({ id: r.id, ...(r.data || {}) })).filter(s => !s.inactive && !s._deleted)[0];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = []; const writes = []; const prompts = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
  await page.route('**/functions/v1/claude-proxy', r => {
    prompts.push(r.request().postData() || '');
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ text: '오늘 Unit 1 단어 진짜 잘 읽었어! 👏' }] }) });
  });
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('file:///' + encodeURI(ROOT + '/index.html'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(4500);

  // ── 1-6-1: 가장 최근 수업이 '결석'인 상황을 캐시에만 만든다 ──
  console.log('── 1-6-1  학부모 화면 (결석일이 가장 최근일 때)');
  const r1 = await page.evaluate(async (sid) => {
    const t = ppToday(), y = ppShiftDate(t, -7);
    _cache.lessons = [
      { id: 'probe-les-abs', sid, date: t, att: 'absent', materials: {}, cmt: '' },
      { id: 'probe-les-ok', sid, date: y, att: 'normal', materials: { vocab: { book: '요즘 초등 영단어 2', unit: 'Unit 1' } }, cmt: '집중 좋았음' },
      ...(_cache.lessons || []).filter(l => l.sid !== sid),
    ];
    await loadParent(sid);
    await new Promise(r => setTimeout(r, 1800));
    const meta = document.getElementById('p-meta').textContent || '';
    const body = (document.getElementById('pp-body').textContent || '').replace(/\s+/g, ' ');
    return { meta, t, y, line: (body.match(/\d+월 \d+일은[^.]{0,30}/) || [])[0] || '', body: body.slice(0, 200) };
  }, stu.id);
  console.log('     머리글: ' + r1.meta);
  console.log('     카드 문구: ' + (r1.line || '(못 찾음)'));
  say(r1.meta.indexOf(r1.y) >= 0 && r1.meta.indexOf(r1.t) < 0, '머리글이 출석한 수업일(' + r1.y + ')을 가리킴');
  say(/결석했어요/.test(r1.line) && !/ 했어요/.test(r1.line), '"결석했어요" 로 붙어 나옴');
  say(!/월 0\d일/.test(r1.line), '날짜에 0 이 없음');

  // ── 1-6-3: 응원 문구 프롬프트 ──
  console.log('\n── 1-6-3  학생 응원 문구 프롬프트·표기');
  const r2 = await page.evaluate(async (sid) => {
    returnToTeacher();
    // 응원 문구 칸은 '선생님 코멘트가 있는 수업'이 있을 때만 뜬다 — 그 상황을 캐시에만 만든다
    const t = ppToday();
    _cache.lessons = [
      { id: 'probe-les-cheer', sid, date: t, att: 'normal',
        materials: { vocab: { book: '요즘 초등 영단어 2', unit: 'Unit 1' } }, cmt: '집중 좋았고 발음도 또렷했음' },
      ...(_cache.lessons || []).filter(l => l.sid !== sid),
    ];
    const s = DB.stus().find(x => x.id === sid);
    await loginStudent(s);
    await new Promise(r => setTimeout(r, 2200));
    const el = document.getElementById('stu-lesson-cmt');
    if (!el) return { none: true, home: (document.getElementById('st-home').textContent || '').slice(0, 120) };
    const mats = el.dataset.mats || '';
    el.dataset.stored = ''; el.textContent = '';
    await polishStudentCmt('아이');
    return { mats, shown: el.textContent.slice(0, 50) };
  }, stu.id);
  if (r2.none) say(false, '응원 문구 칸이 떠야 함', r2.home);
  else {
    // 2026-11-08: 학생 화면은 AI 를 부르지 않는다. 문구는 선생님이 저장할 때 만든다.
    // 부팅 때의 '서버 키 있나' 확인(빈 본문)은 제외하고 센다
    const real = prompts.filter(x => /"messages"/.test(x || ''));
    say(real.length === 0, '학생 화면이 AI 를 부르지 않음(저장해 둔 문장만 읽음)', real.length + '회');
    const tp = await page.evaluate(async () => {
      const calls = [];
      const orig = window.callClaudeProxy;
      window.callClaudeProxy = async (b) => { calls.push(JSON.stringify(b)); return { content: [{ text: '좋아 👍' }] }; };
      await polishStuCmt_teacher('집중 좋았음', '[어휘] 교재명=요즘 초등 영단어 2 | 단원=Unit 1', '아이');
      window.callClaudeProxy = orig;
      return calls.join(' ');
    });
    say(/대소문자를 바꾸지 마세요/.test(tp), '선생님 쪽 프롬프트에 "대소문자를 바꾸지 마세요"');
    say(/한 글자도 바꾸지 말고/.test(tp), '교재명 그대로 쓰기 규칙도 함께');
    say(/Unit 1/.test(r2.mats), '넘기는 진도가 원래 대소문자', r2.mats.slice(0, 60));
    console.log('     보여 준 문장: ' + r2.shown);
  }

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
