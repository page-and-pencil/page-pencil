require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 학생 화면 — 배정된 동형 문제가 '문제만' 보이는지 (정답·해설은 안 보여야 한다)
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push(n + (note ? ' — ' + note : ''));

const ROW = {
  id: 'isotest1', kind: 'iso', title: '동형 문제 시험', createdAt: Date.now(), gradeLevel: '중2',
  isoType: 'm_grammar_pick', isoTypeName: '중등·내신 · 어법 고르기',
  items: [
    { id: 'a', stem: '어법에 맞는 것은?', passage: 'Spanish is one of the most widely (A)[use/used] languages.', choices: ['(A) use', '(A) used'], answer: 1, explain: '수동이므로 used 가 맞다 — 이 해설은 학생에게 보이면 안 된다', intent: '수동태', wrong: ['①은 능동'] },
    { id: 'b', stem: '조건에 맞게 영작하시오.', passage: '조건: 현재완료 사용', choices: [], answerText: 'I have lived here for ten years.', rubric: '현재완료 2점', explain: '현재완료 설명', intent: '현재완료' }
  ]
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  await page.route('**/rest/v1/worksheets**', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: r.request().url().indexOf('id=eq.') >= 0 ? JSON.stringify({ id: 'isotest1', data: null }) : '[]'
  }));
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 150000 });
  await wait(1500);

  // fetch 를 가로채 우리 행을 돌려준다
  const res = await page.evaluate(async row => {
    const of = window.fetch;
    window.fetch = async (u, o) => {
      if (String(u).indexOf('/worksheets?id=eq.') >= 0)
        return new Response(JSON.stringify({ id: row.id, data: row }), { status: 200, headers: { 'content-type': 'application/json' } });
      return of(u, o);
    };
    await openWsView(row.id, 'noasgn', 'nosid');
    await new Promise(r => setTimeout(r, 600));
    window.fetch = of;
    const body = document.getElementById('wsv-body');
    return {
      title: (document.getElementById('wsv-title') || {}).textContent || '',
      sub: (document.getElementById('wsv-sub') || {}).textContent || '',
      secs: [...body.querySelectorAll('.wsv-sec-t')].map(e => e.textContent),
      text: body.innerText,
      lis: body.querySelectorAll('ol li').length,
      blanks: body.querySelectorAll('div[style*="border-bottom"]').length
    };
  }, ROW);
  ok('① 문항이 보인다', res.secs.join(',') === '1번,2번' && res.lis === 2, res.secs.join(',') + ' · 선택지 ' + res.lis);
  ok('② 정답·해설·채점 기준은 안 보인다',
    res.text.indexOf('수동이므로') < 0 && res.text.indexOf('I have lived') < 0 && res.text.indexOf('현재완료 2점') < 0 && res.text.indexOf('능동') < 0,
    res.text.replace(/\n+/g, ' / ').slice(0, 110));
  ok('③ 서술형은 답 쓰는 줄', res.blanks >= 1, '줄 ' + res.blanks);
  ok('④ 제목·유형', /동형 문제 시험/.test(res.title) && /어법 고르기/.test(res.sub), res.title + ' / ' + res.sub);
  const over = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  ok('⑤ 390px 넘침 0', over === 0, String(over));
  await page.screenshot({ path: SCR + '/iso_student_390.png' });
  ok('⑥ 페이지 오류 0', errs.length === 0, errs.slice(0, 2).join(' | ') || '0');

  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
