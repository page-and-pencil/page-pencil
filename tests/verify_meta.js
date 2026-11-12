require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 단어 탭 외부 호출 검증. 실데이터 저장 0. 외부 요청은 전부 가로채서 센다.
// node verify_meta.js before|after   (before = main 코드, after = 이 브랜치)
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SP = ((process.env.PP_TEST_OUT || require('os').tmpdir()) + '/');
const D = require(SP + 'meta_dummy.js');
const MODE = (process.argv[2] || 'after');
const REAL_SID = (process.env.PP_REAL_SID || '');
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 170)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 120)); });

  // 외부 호출 집계
  const C = { dict: 0, mymemory: 0, claude: 0, words: [] };
  const reset = () => { C.dict = 0; C.mymemory = 0; C.claude = 0; C.words.length = 0; };
  // 넓은 루트를 먼저 등록한다 — 아래 구체 루트들이 나중에 등록돼 우선한다
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.route('**api.dictionaryapi.dev/**', r => {
    C.dict++;
    // CORS 로 막히는 환경을 흉내 — fetch 가 던지게 한다
    return r.abort('failed');
  });
  await page.route('**api.mymemory.translated.net/**', r => { C.mymemory++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ responseStatus: 200, responseData: { translatedText: '더미번역' } }) }); });
  await page.route('**/functions/v1/claude-proxy**', r => {
    C.claude++;
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
    const pr = (((b.messages || [])[0] || {}).content || '');
    const m = String(pr).match(/"([A-Za-z'\- ]+)"/);
    if (m) C.words.push(m[1]);
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ text: '{"ko":"에이아이뜻","pos":"noun"}' }] }) });
  });
  await page.route('**api.elevenlabs.io/**', r => r.fulfill({ status: 500, body: '' }));
  let writes = 0, writeBodies = [];
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes++;
    if (writeBodies.length < 40) writeBodies.push((r.request().postData() || '').slice(0, 200));
    return r.fulfill({ status: 200, body: '[]' });     // 쓰기는 전부 차단
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await wait(4000);
  await page.evaluate(() => { window.speakWord = async () => { }; window.speakSmart = async () => true; });
  // 라이브와 같은 상태로 — AI 는 서버 키(claude-proxy) 경유로 켜져 있다
  await page.evaluate(() => { _cache.settings.aiProxy = true; });

  // ───── 1. 학생 A 학생뷰(체험 모드)에서 단어 탭 열기 ─────
  console.log('── 1  학생 A 단어 탭 (' + MODE + ')');
  // 카드는 학생으로 들어간 뒤에 받아진다 → 미리보기부터 들어가고, 그 다음에 세기 시작한다
  const enter = await page.evaluate(async (sid) => {
    await previewAsStudent(sid); await new Promise(r => setTimeout(r, 2800));
    if (typeof loadVocabCards === 'function') await loadVocabCards(sid);
    await new Promise(r => setTimeout(r, 1200));
    const cards = ppLive(_cache.vocab_cards).filter(c => c.sid === sid);
    return { on: ppSandbox(), total: cards.length, noMeaning: cards.filter(c => !c.meaning).length,
      noExample: cards.filter(c => !c.example).length,
      missing: cards.filter(c => !c.meaning || !c.example).length,
      checked: cards.filter(c => c.exampleChecked).length };
  }, REAL_SID);
  console.log('     카드 ' + enter.total + '장 · 뜻 없음 ' + enter.noMeaning + ' · 예문 없음 ' + enter.noExample
    + ' · 보완 대상 ' + enter.missing + ' · exampleChecked 있음 ' + enter.checked);
  say(enter.on, '미리보기는 체험 모드');
  say(enter.total > 0, '학생 A 카드를 받았다', enter.total + '장');
  // 여기서부터가 "단어 탭을 열 때" 생기는 호출이다
  reset();
  const w0 = writes;
  await page.evaluate(async () => {
    _cache.settings.aiProxy = true;   // 라이브처럼 AI(서버 키)가 켜진 상태
    window.__diag={api:String(DB.api()),bookEx:ppLive(_cache.vocab_cards).filter(c=>c.sid===(process.env.PP_REAL_SID || '')&&!c.example).slice(0,5).map(c=>({w:c.word,ex:String(findExampleFromBooks(c.word,'초4')||'').slice(0,40)}))};
    swStuTab('st-vocab');
    await new Promise(r => setTimeout(r, 16000));     // 백그라운드 보완이 돌 시간
  });
  const after1 = { dict: C.dict, mymemory: C.mymemory, claude: C.claude, total: C.dict + C.mymemory + C.claude };
  console.log('     외부 호출: dictionaryapi ' + after1.dict + ' · mymemory ' + after1.mymemory + ' · claude-proxy ' + after1.claude + '  → 합계 ' + after1.total);
  console.log('     쓰기 시도: ' + (writes - w0) + '건');
  const diag=await page.evaluate(()=>window.__diag||{});
  console.log('     [진단] DB.api()="' + diag.api + '" · 원문 예문 표본: ' + (diag.bookEx||[]).map(x=>x.w+'→'+(x.ex?('"'+x.ex+'"'):'없음')).join(' | '));
  if (MODE === 'after') {
    say(after1.total === 0, '단어 탭을 열 때 외부 호출 0', JSON.stringify(after1));
    say(writes - w0 === 0, '체험 모드에서 저장 0건', (writes - w0) + '건');
  } else {
    console.log('     (before 측정 — 통과/실패를 따지지 않는다)');
  }
  fs.writeFileSync(SP + 'meta_count_' + MODE + '.json', JSON.stringify({ mode: MODE, pre: enter, calls: after1, writes: writes - w0 }, null, 1));
  await page.evaluate(async () => { await returnToTeacher(); await new Promise(r => setTimeout(r, 2400)); });

  if (MODE === 'before') {
    console.log('\nbefore 측정 끝 — ' + JSON.stringify(after1));
    await browser.close(); process.exit(0);
  }

  // ───── 2. 더미 카드 3장 ─────
  console.log('\n── 2  더미 카드 3장');
  reset();
  const r2 = await page.evaluate(async (a) => {
    if (typeof loadVocabCards === 'function') await loadVocabCards(a.sid);   // 더미 카드를 받아 둔다
    await new Promise(r => setTimeout(r, 600));
    const cards = ppLive(_cache.vocab_cards).filter(c => c.sid === a.sid);
    const before = cards.map(c => ({ word: c.word, meaning: c.meaning, example: c.example, ck: c.exampleChecked || '' }));
    await fillMissingMeanings(cards.map(c => ({ ...c })));
    const after = ppLive(_cache.vocab_cards).filter(c => c.sid === a.sid)
      .map(c => ({ word: c.word, meaning: c.meaning, example: c.example, ck: c.exampleChecked || '' }));
    return { before, after, n: cards.length };
  }, { sid: D.SID });
  const c2 = { dict: C.dict, mymemory: C.mymemory, claude: C.claude, words: C.words.slice() };
  console.log('     외부 호출: dict ' + c2.dict + ' · mymemory ' + c2.mymemory + ' · claude ' + c2.claude + (c2.words.length ? ' (' + c2.words.join(',') + ')' : ''));
  r2.after.forEach(c => console.log('     ' + c.word.padEnd(14) + ' 뜻="' + c.meaning + '" 예문="' + c.example + '" checked=' + c.ck));
  say(r2.n === 3, '더미 카드 3장', r2.n + '장');
  say(c2.claude === 1 && c2.words.join(',') === 'zznomeaning', '뜻 없는 카드만 AI 를 부른다 (1회)', 'claude ' + c2.claude + '회 · ' + c2.words.join(','));
  say(c2.mymemory === 1, '번역도 뜻 없는 카드에만 (1회)', c2.mymemory + '회');
  say(c2.dict === 1, 'dictionaryapi 도 1회만 (막히면 그 뒤로 0)', c2.dict + '회');
  const hm = r2.after.find(c => c.word === 'zzhasmeaning');
  const both = r2.after.find(c => c.word === 'zzboth');
  say(hm && hm.ck, '뜻 있고 예문 없는 카드 → exampleChecked 적힘', hm ? hm.ck : '없음');
  say(both && !both.ck, '둘 다 있는 카드는 건드리지 않는다', both ? ('checked=' + (both.ck || '없음')) : '?');

  // ───── 3. exampleChecked 30일 ─────
  console.log('\n── 3  exampleChecked 30일');
  const r3 = await page.evaluate(async (a) => {
    if (typeof loadVocabCards === 'function') await loadVocabCards(a.sid);
    const pick = () => ppLive(_cache.vocab_cards).find(c => c.sid === a.sid && c.word === 'zzhasmeaning');
    const today = ppToday();
    const out = {};
    // ① 오늘 찾아본 상태 → 다시 안 찾는다
    let c = pick(); c.exampleChecked = today;
    window.__exCalls = 0;
    const orig = window.findExampleFromBooks;
    window.findExampleFromBooks = function () { window.__exCalls++; return orig.apply(null, arguments); };
    await fillMissingMeanings([{ ...pick() }]);
    out.fresh = window.__exCalls;
    // ② 29일 전 → 아직 안 찾는다
    c = pick(); c.exampleChecked = ppShiftDate(today, -29);
    window.__exCalls = 0;
    await fillMissingMeanings([{ ...pick() }]);
    out.d29 = window.__exCalls;
    // ③ 31일 전 → 다시 찾는다
    c = pick(); c.exampleChecked = ppShiftDate(today, -31);
    window.__exCalls = 0;
    await fillMissingMeanings([{ ...pick() }]);
    out.d31 = window.__exCalls;
    out.ckAfter = pick().exampleChecked;
    out.today = today;
    window.findExampleFromBooks = orig;
    return out;
  }, { sid: D.SID });
  say(r3.fresh === 0, '오늘 찾아봤으면 다시 찾지 않는다', 'findExampleFromBooks ' + r3.fresh + '회');
  say(r3.d29 === 0, '29일 전이면 아직 안 찾는다', r3.d29 + '회');
  say(r3.d31 === 1, '31일 지나면 다시 찾는다', r3.d31 + '회');
  say(r3.ckAfter === r3.today, '다시 찾으면 날짜를 오늘로 갱신', r3.ckAfter);

  // ───── 4. 교재 단어 10개 반영 (syncVocabCards expose) ─────
  console.log('\n── 4  교재 단어 10개 반영');
  reset();
  const r4 = await page.evaluate(async (a) => {
    if (typeof loadVocabCards === 'function') await loadVocabCards(a.sid);
    const tb = (_cache.globalTextbooks || []).find(b => b.id === a.tb);
    const ws = (tb.units['Unit 1'] || []).map(w => ({ word: w.word, ko: w.ko, pos: w.pos, example: '', srcId: tb.id, srcType: 'textbook', srcUnit: 'Unit 1' }));
    const n0 = ppLive(_cache.vocab_cards).filter(c => c.sid === a.sid).length;
    await syncVocabCards(a.sid, ws, [], ppToday(), 'META시험', 'expose');
    await new Promise(r => setTimeout(r, 2500));
    const made = ppLive(_cache.vocab_cards).filter(c => c.sid === a.sid);
    return { n0, n1: made.length, sample: made.filter(c => /^zz(alpha|bravo)$/.test(c.word)).map(c => ({ w: c.word, m: c.meaning, e: c.example })) };
  }, { sid: D.SID, tb: D.TB });
  const c4 = { dict: C.dict, mymemory: C.mymemory, claude: C.claude };
  console.log('     카드 ' + r4.n0 + ' → ' + r4.n1 + '장 · 외부 호출: dict ' + c4.dict + ' · mymemory ' + c4.mymemory + ' · claude ' + c4.claude);
  r4.sample.forEach(s => console.log('     ' + s.w + ' 뜻="' + s.m + '" 예문="' + s.e + '"'));
  say(r4.n1 - r4.n0 === 10, '새 카드 10장 생성', (r4.n1 - r4.n0) + '장');
  say(c4.claude === 0 && c4.mymemory === 0, '뜻이 있는 교재 단어는 AI·번역 호출 0', JSON.stringify(c4));
  say(r4.sample.every(s => s.m), '뜻은 교재 값이 그대로 들어간다', r4.sample.map(s => s.m).join(','));

  // ───── 5. 뜻이 있으면 getWordMetaFull 자체도 외부 0 ─────
  console.log('\n── 5  getWordMetaFull');
  reset();
  const r5 = await page.evaluate(async () => {
    const withKo = await getWordMetaFull('zzprobe', '초4', '이미있는뜻');
    const a = { dict: 0 };
    return { withKo };
  });
  const c5a = { dict: C.dict, mymemory: C.mymemory, claude: C.claude };
  reset();
  const r5b = await page.evaluate(async () => await getWordMetaFull('zzprobe2', '초4', ''));
  const c5b = { dict: C.dict, mymemory: C.mymemory, claude: C.claude };
  say(c5a.dict === 0 && c5a.mymemory === 0 && c5a.claude === 0, 'koHint 가 있으면 외부 호출 0', JSON.stringify(c5a));
  say(r5.withKo.ko === '', 'koHint 가 있으면 ko 를 덮어쓰지 않는다 (빈값 반환)', JSON.stringify(r5.withKo));
  say(c5b.mymemory === 1 && c5b.claude === 1, 'koHint 가 없으면 종전대로 조회한다', JSON.stringify(c5b));

  // ───── 6. dictionaryapi 가 막히면 같은 세션에서 다시 안 부른다 ─────
  console.log('\n── 6  dictionaryapi 재호출 안 함');
  reset();
  const r6 = await page.evaluate(async () => {
    const off0 = (typeof ppDictOff === 'function') ? ppDictOff() : null;
    for (const w of ['zzq1', 'zzq2', 'zzq3']) await getWordMetaFull(w, '초4', '');
    return { off0, off1: (typeof ppDictOff === 'function') ? ppDictOff() : null };
  });
  say(C.dict === 0 && r6.off1 === true, '한 번 막힌 뒤에는 dictionaryapi 를 안 부른다', 'dict ' + C.dict + '회 · 스위치 ' + r6.off1);
  say(errs.filter(e => /dictionaryapi/.test(e)).length === 0, 'dictionaryapi 때문에 콘솔 오류가 쌓이지 않는다', errs.filter(e => /dictionaryapi/.test(e)).length + '건');

  // ───── 7. 폭 ─────
  console.log('\n── 7  화면 폭');
  for (const w of [320, 390, 1440]) {
    await page.setViewportSize({ width: w, height: 860 });
    await wait(400);
    const o = await page.evaluate(async (sid) => {
      await loginStudent(DB.stus().find(s => s.id === sid));
      await new Promise(r => setTimeout(r, 1400));
      swStuTab('st-vocab'); await new Promise(r => setTimeout(r, 1000));
      const inScroller = n => {
        for (let e = n.parentElement; e && e !== document.body; e = e.parentElement) {
          const ox = getComputedStyle(e).overflowX;
          if (ox === 'auto' || ox === 'scroll') return true;
        }
        return false;
      };
      const bad = []; const vw = window.innerWidth;
      document.querySelectorAll('#st-vocab *').forEach(n => {
        const r = n.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') return;
        if (inScroller(n)) return;
        if (r.right > vw + 1.5 || r.left < -1.5) bad.push(n.className + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
      });
      return { bad: bad.slice(0, 4), hscroll: document.documentElement.scrollWidth > vw + 1 };
    }, D.SID);
    say(o.bad.length === 0 && !o.hscroll, w + 'px — 넘침 0', o.bad.length ? o.bad.join(' | ') : '없음');
  }

  console.log('\n오류: ' + (errs.length ? errs.slice(0, 5).join(' | ') : '없음'));
  console.log('쓰기 요청: ' + writes + '건 (전부 차단)');
  console.log('\n' + (fails ? '실패 ' + fails + '건' : '전부 통과'));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
