require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 단어 시험지 새 양식 검증. 실데이터 GET 만, 쓰기 전부 차단.
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const OUT = __dirname + '/shots';
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = (process.env.PP_REAL_SID || '');
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
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
  await page.waitForTimeout(3500);

  const setup = (title, units, n) => page.evaluate((a) => {
    const tb = (_cache.globalTextbooks || []).find(b => b.title === a.title);
    document.getElementById('vp-book').value = tb.id; vpBookChange();
    [...document.getElementById('vp-units').options].forEach(o => { o.selected = a.units.includes(o.value); });
    document.getElementById('vp-new').value = a.n;
    document.getElementById('vp-wrong').value = 0;
    document.getElementById('vp-past').value = 0;
    return ['vp-t-def', 'vp-t-cloze', 'vp-t-ko', 'vp-t-en', 'vp-t-mc']
      .map(id => id.replace('vp-t-', '') + '=' + (document.getElementById(id).value || '자동')).join(' ');
  }, { title, units, n });

  // ───── 1. 기본값: 영영풀이형 ─────
  console.log('── 1  양식 기본값');
  const st = await page.evaluate((sid) => {
    openVocabPaper(sid);
    const on = [...document.querySelectorAll('#vp-preset-row [data-vp-preset]')].filter(b => b.classList.contains('bt')).map(b => b.dataset.vpPreset);
    return { preset: ppPaperPreset(), on, note: (document.getElementById('vp-preset-note').textContent || '').slice(0, 44) };
  }, SID);
  const f0 = await setup('요즘 초등 영단어 2', ['Unit 26', 'Unit 27', 'Unit 28'], 24);
  say(st.preset === 'def' && st.on.join() === 'def', '열면 영영풀이형이 기본으로 선택됨', '선택 ' + st.on.join() + ' · 유형칸 ' + f0);
  console.log('     안내: ' + st.note);

  // ───── 2. 시험지 ─────
  console.log('\n── 2  영영풀이형 시험지');
  const pop = ctx.waitForEvent('page');
  await page.evaluate(() => makeVocabPaper());
  const w = await pop; await w.waitForLoadState('domcontentloaded'); await w.waitForTimeout(700);
  const r = await w.evaluate(() => {
    const sheet = document.querySelectorAll('.sheet')[0];
    const secs = [...sheet.querySelectorAll('.sec .st')].map(s => s.textContent.replace(/\s+/g, ' ').trim());
    const tbl = document.querySelector('.dft');
    const trs = tbl ? [...tbl.querySelectorAll('tbody tr')] : [];
    const cloze = [...document.querySelectorAll('.sent')];
    const ak = [...document.querySelectorAll('.ak div')].map(d => d.textContent.replace(/\s+/g, ' ').trim());
    const de = document.documentElement;
    return {
      secs,
      th: tbl ? [...tbl.querySelectorAll('thead th')].map(t => t.textContent.trim()) : [],
      rows: trs.length,
      filled: trs.filter(tr => tr.children[3].textContent.trim()).length,
      blankCols: trs.every(tr => !tr.children[1].textContent.trim() && !tr.children[2].textContent.trim() && !tr.children[4].textContent.trim()),
      r1: trs.length ? [...trs[0].children].map(t => t.textContent.trim()) : [],
      bank: document.querySelectorAll('.bank span').length,
      cloze: cloze.length,
      noBlank: cloze.filter(s => !s.querySelector('u')).length,
      ak: ak.length, akS: ak.slice(0, 3),
      head: (document.querySelector('h1') || {}).textContent.replace(/\s+/g, ' ').trim(),
      pass: (document.querySelector('.pass') || {}).textContent.replace(/\s+/g, ' ').trim(),
      ov: Math.max(0, de.scrollWidth - de.clientWidth),
    };
  });
  console.log('     머리글: ' + r.head);
  console.log('     ' + r.pass);
  r.secs.forEach(s => console.log('     · ' + s));
  say(r.th.join('|') === '|Word|PoS|English Definition|Korean Definition', '표 머리글이 Word · PoS · English Definition · Korean Definition', r.th.join(' | '));
  say(r.rows > 0 && r.filled === r.rows, '영영풀이 칸은 전부 채워져 있음', r.filled + '/' + r.rows + '행');
  say(r.blankCols, '단어 · 품사 · 한국어 뜻 칸은 전부 비어 있음 (학생이 쓴다)');
  console.log('     첫 줄: ' + JSON.stringify(r.r1));
  say(r.cloze > 0, '예문 빈칸 문항이 있다', r.cloze + '문항');
  say(r.noBlank === 0, '모든 예문에 빈칸(밑줄)이 뚫렸다', '빈칸 없는 문장 ' + r.noBlank + '개');
  say(r.bank === r.cloze, '빈칸 수와 보기 단어 수가 같다', '보기 ' + r.bank + '개 / 문항 ' + r.cloze + '개');
  say(r.ak === r.rows + r.cloze, '정답지 문항 수 = 표 + 빈칸', r.ak + '개');
  console.log('     정답 예: ' + r.akS.join(' / '));
  say(!/A. 한국어 뜻을 쓰세요|알맞은 영어 단어를 쓰세요|알맞은 뜻을 골라/.test(r.secs.join()), '단순 한영 짝 맞추기 유형이 섞이지 않았다');
  say(r.ov === 0, '인쇄 미리보기 가로 넘침 0px', '넘침 ' + r.ov + 'px');
  await w.screenshot({ path: OUT + '/paper-def.png', fullPage: true });

  // ───── 3. 쓰기형 (예전 방식) ─────
  console.log('\n── 3  쓰기형');
  await page.evaluate((sid) => openVocabPaper(sid), SID);
  await setup('요즘 초등 영단어 2', ['Unit 26'], 9);
  const f2 = await page.evaluate(() => { vpPreset('write'); return ['vp-t-def', 'vp-t-cloze', 'vp-t-ko', 'vp-t-en', 'vp-t-mc'].map(id => id.replace('vp-t-', '') + '=' + (document.getElementById(id).value || '자동')).join(' '); });
  const pop2 = ctx.waitForEvent('page');
  await page.evaluate(() => makeVocabPaper());
  const w2 = await pop2; await w2.waitForLoadState('domcontentloaded'); await w2.waitForTimeout(500);
  const r2 = await w2.evaluate(() => ({ sec: [...document.querySelectorAll('.sec .st')].map(s => s.textContent.replace(/\s+/g, ' ').trim()), tbl: !!document.querySelector('.dft'), q: document.querySelectorAll('.q').length }));
  say(!r2.tbl && r2.q > 0, '쓰기형은 예전처럼 뜻/단어 쓰기로만 나온다', f2 + ' → ' + r2.sec.join(' / '));

  // ───── 4. 영영의미 없는 교재로 넘어가기 ─────
  console.log('\n── 4  영영의미가 모자란 단원');
  await page.evaluate((sid) => openVocabPaper(sid), SID);
  await page.evaluate(() => vpPreset('def'));
  const f3 = await setup('초등 천일문 보카앤스토리', ['Day 1'], 24);
  const pop3 = ctx.waitForEvent('page');
  await page.evaluate(() => makeVocabPaper());
  const w3 = await pop3; await w3.waitForLoadState('domcontentloaded'); await w3.waitForTimeout(500);
  const r3 = await w3.evaluate(() => {
    const trs = [...document.querySelectorAll('.dft tbody tr')];
    return {
      head: (document.querySelector('h1') || {}).textContent.replace(/\s+/g, ' ').trim(),
      rows: trs.length, empty: trs.filter(tr => !tr.children[3].textContent.trim()).length,
      ak: document.querySelectorAll('.ak div').length,
      nq: parseInt(((document.querySelector('.pass') || {}).textContent || '').match(/(\d+)문항/)[1], 10),
      sec: [...document.querySelectorAll('.sec .st')].map(s => s.textContent.replace(/\s+/g, ' ').trim()),
    };
  });
  say(r3.empty === 0, '영영의미가 빈 단어는 표에 들어가지 않았다', '빈 칸 ' + r3.empty + '행 / 표 ' + r3.rows + '행');
  say(r3.ak === r3.nq, '모든 문항에 정답이 있다 (버려진 문항 없음)', r3.nq + '문항 · 정답 ' + r3.ak + '개');
  console.log('     ' + r3.head);
  r3.sec.forEach(s => console.log('     · ' + s));

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
