require('../_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// P2 뜻 쓰기(kspell) 검증. 더미 학생만.
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = 'p1dummy0001';
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error' && !/dictionaryapi/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"server":true,"ready":true}' }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    return ((r.request().postData() || '').indexOf(SID) >= 0) ? r.continue() : r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { window.speakWord = () => { }; });

  // ───── 1. 후보 만들기 ─────
  console.log('── 1  정답 후보 만들기');
  const c1 = await page.evaluate(() => ({
    a: kspCandidates('(달걀을) 휘저어 익힌'),
    b: kspCandidates('배(과일)'),
    c: kspCandidates('~할 수 없다'),
    d: kspCandidates('빠른, 신속한; 날쌘'),
    e: kspCandidates('고치다 / 수리하다'),
  }));
  say(c1.a.includes('휘저어 익힌'), "'(달걀을) 휘저어 익힌' → '휘저어 익힌'", JSON.stringify(c1.a));
  say(c1.b.includes('배'), "'배(과일)' → '배'", JSON.stringify(c1.b));
  say(c1.c.includes('할 수 없다'), "'~할 수 없다' → '할 수 없다'", JSON.stringify(c1.c));
  say(c1.d.includes('빠른') && c1.d.includes('신속한') && c1.d.includes('날쌘'), ", ; 로 나눈 뜻이 각각 후보", JSON.stringify(c1.d));
  say(c1.e.includes('고치다') && c1.e.includes('수리하다'), "/ 로 나눈 뜻이 각각 후보", JSON.stringify(c1.e));

  // ───── 2. 채점 규칙 ─────
  console.log('\n── 2  채점');
  const cases = [
    ['조깅하다', '조깅', 'ok', '끝말만 다름 (조깅 = 조깅하다)'],
    ['조깅', '조깅하다', 'ok', '끝말만 다름 (반대 방향)'],
    ['빠르다', '빠른', 'ok', '빠른 = 빠르다'],
    ['배', '배(과일)', 'ok', '괄호 무시'],
    ['할 수 없다', '~할 수 없다', 'ok', '물결표 무시'],
    ['할수없다', '~할 수 없다', 'ok', '띄어쓰기 무시'],
    ['휘저어익힌', '(달걀을) 휘저어 익힌', 'ok', '괄호+띄어쓰기 무시'],
    ['신속한', '빠른, 신속한; 날쌘', 'ok', '여러 뜻 중 하나'],
    ['공장!', '공장', 'ok', '문장부호 무시'],
    ['공원', '공장', 'no', '한 글자만 맞음 — 오답 (핵심 2자 이상이어야 거의)'],
    ['조심스럽다', '조심스러운', 'near', 'ㅂ불규칙은 정답까지는 아니고 "거의" — 한 번 더 기회 (한계)'],
    ['긴', '공장', 'no', '1음절은 억지로 맞추지 않는다 (산↔사다 오인식 방지)'],
    ['공장장', '공장', 'near', '핵심 두 글자 맞음 — 거의'],
    ['하늘', '공장', 'no', '완전 오답'],
    ['', '공장', 'no', '빈 입력'],
  ];
  const got = await page.evaluate(cs => cs.map(([t, m]) => kspGrade(t, m).r), cases);
  cases.forEach(([t, m, want, label], i) => {
    say(got[i] === want, label, `"${t}" vs "${m}" → ${got[i]} (기대 ${want})`);
  });

  // ───── 3. 화면 동작 ─────
  console.log('\n── 3  화면');
  const enter = () => page.evaluate(() => {
    const i = document.getElementById('ksp-in');
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  const r3 = await page.evaluate(async (sid) => {
    try { sessionStorage.removeItem('deckState_' + sid); } catch (e) { }
    vocabStudyMode = 'all'; vocabStarOnly = false; vocabChunkAll = true; vocabDeckFilter = null;
    await loginStudent(DB.stus().find(s => s.id === sid));
    await new Promise(r => setTimeout(r, 900));
    swStuTab('st-vocab'); await new Promise(r => setTimeout(r, 600));
    const b = [...document.querySelectorAll('#st-vocab button')].find(x => /시작/.test(x.textContent));
    if (b) b.click();
    await new Promise(r => setTimeout(r, 400));
    deckState.stages = ['kspell']; deckState.phase = 0; vcStartChunks(); vocabRenderStage();
    await new Promise(r => setTimeout(r, 400));
    return { has: !!document.getElementById('ksp-in'), word: deckState.cards[deckState.idx].word, meaning: deckState.cards[deckState.idx].meaning, bar: /뜻 쓰기/.test((document.getElementById('st-vocab') || {}).textContent || '') };
  }, SID);
  say(r3.has && r3.bar, '뜻 쓰기 화면이 뜬다', r3.word + ' → ' + r3.meaning);

  // 조합 중(IME) 엔터는 무시
  const r4 = await page.evaluate(async () => {
    const i = document.getElementById('ksp-in');
    i.value = '공';
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }));
    await new Promise(r => setTimeout(r, 200));
    const during = { answered: !!deckState._kAnswered, fb: (document.getElementById('ksp-fb') || {}).textContent };
    // keyCode 229 (안드로이드 일부) 도 무시
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, keyCode: 229 }));
    await new Promise(r => setTimeout(r, 200));
    const during2 = { answered: !!deckState._kAnswered };
    return { during, during2 };
  });
  say(!r4.during.answered && !r4.during2.answered, '조합 중(isComposing·keyCode 229) 엔터는 무시한다', '채점 안 됨 ✓');

  // 정답 입력 → 엔터 → 다음
  const r5 = await page.evaluate(async () => {
    const card = deckState.cards[deckState.idx];
    const i = document.getElementById('ksp-in');
    i.value = card.meaning;
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    const a = { fb: (document.getElementById('ksp-fb') || {}).textContent, idx: deckState.idx, answered: !!deckState._kAnswered };
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    return { a, idx2: deckState.idx, word2: (deckState.cards[deckState.idx] || {}).word, n: deckState.phaseResults.length };
  });
  say(/정답/.test(r5.a.fb), '정답 판정', r5.a.fb.slice(0, 30));
  say(r5.idx2 === r5.a.idx + 1, '엔터 두 번째에 다음 문제로', '카드 ' + (r5.a.idx + 1) + ' → ' + (r5.idx2 + 1));
  say(r5.n === 1, '엔터를 또 쳐도 기록이 늘지 않는다', r5.n + '건');

  // 거의 맞음 → 한 번 더
  const r6 = await page.evaluate(async () => {
    const card = deckState.cards[deckState.idx];
    const i = document.getElementById('ksp-in');
    const m = String(card.meaning || '');
    i.value = m.slice(0, 2) + '짜';            // 앞 두 글자만 맞게
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    const first = { fb: (document.getElementById('ksp-fb') || {}).textContent, answered: !!deckState._kAnswered, val: i.value };
    i.value = '전혀다른말';
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    return { first, second: { fb: (document.getElementById('ksp-fb') || {}).textContent, answered: !!deckState._kAnswered }, meaning: m };
  });
  say(/거의 맞았어요/.test(r6.first.fb) && !r6.first.answered, "'거의 맞았어요' + 한 번 더 입력 기회", r6.first.fb.slice(0, 40));
  say(r6.first.val === '', '입력칸이 비워진다');
  say(r6.second.answered && /다시 나와요/.test(r6.second.fb), '두 번째도 틀리면 정답을 보여 주고 다음 라운드에', r6.second.fb.replace(/\s+/g, ' ').slice(0, 50));

  // 뜻 빈 카드는 건너뛴다
  const r7 = await page.evaluate(async () => {
    const card = deckState.cards[deckState.idx];
    const keep = card.meaning;
    card.meaning = '';
    const before = deckState.idx;
    renderKspellCard(document.getElementById('st-vocab'));
    await new Promise(r => setTimeout(r, 300));
    const after = deckState.idx;
    card.meaning = keep;
    return { before, after };
  });
  say(r7.after > r7.before, '뜻이 빈 카드는 건너뛴다', r7.before + ' → ' + r7.after);

  // 프리셋에는 없다
  const r8 = await page.evaluate(() => ({
    presets: Object.values(VOCAB_PRESETS).flat(),
    rot: [0, 1, 2, 3, 4, 5, 6].flatMap(d => vocabStagesForDay('p1dummy0001', d)),
    has: !!VOCAB_STAGES.kspell,
  }));
  say(r8.has, 'VOCAB_STAGES 에 kspell 이 있다');
  say(!r8.presets.includes('kspell') && !r8.rot.includes('kspell'), '프리셋·요일 로테이션에는 들어가지 않는다');

  // 입력칸이 키보드에 가리지 않는지 (작은 화면에서 화면 안에 있는지)
  console.log('\n── 4  작은 화면 입력칸');
  for (const w of [320, 390]) {
    await page.setViewportSize({ width: w, height: 480 });   // 키보드가 올라온 높이를 흉내
    await page.waitForTimeout(500);
    const o = await page.evaluate(async () => {
      renderKspellCard(document.getElementById('st-vocab'));
      await new Promise(r => setTimeout(r, 400));
      const i = document.getElementById('ksp-in');
      if (!i) return { ok: false };
      const b = i.getBoundingClientRect();
      const de = document.documentElement;
      return { ok: true, top: Math.round(b.top), bottom: Math.round(b.bottom), vh: de.clientHeight, ov: Math.max(0, de.scrollWidth - de.clientWidth) };
    });
    say(o.ok && o.top >= 0 && o.bottom <= o.vh + 1, w + 'px(키보드 높이 480) 입력칸이 화면 안에 있다', '입력칸 ' + o.top + '~' + o.bottom + 'px / 화면 ' + o.vh + 'px');
    say(o.ov === 0, w + 'px 가로 넘침 0px');
  }

  console.log('\n콘솔 오류 ' + errs.length + '건'); [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
