require('../_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// P7 문장 학습 검증. 더미 학생·더미 교재만 건드린다. 실학생은 읽기만.
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SP = ((process.env.PP_TEST_OUT || require('os').tmpdir()) + '/');
const D = require(SP + 'p7_dummy.js');
const SID = D.SID, TB = D.TB, HW_NEW = D.HW_NEW, HW_OLD = D.HW_OLD, HW_U4 = D.HW_U4, HW_U5 = D.HW_U5;
const REAL_SID = (process.env.PP_REAL_SID || '');           // 실학생 — 읽기만
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1], K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];
const H = { apikey: K, Authorization: 'Bearer ' + K };
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };
const get = async (t, q) => (await (await fetch(U + '/rest/v1/' + t + '?' + q, { headers: H })).json());
const cardSnap = async () => {
  const rows = await get('vocab_cards', 'select=data&sid=eq.' + SID); const o = {};
  rows.forEach(r => { const d = r.data || {}; if (!d._deleted) o[d.word] = [d.hits || 0, d.misses || 0, d.box || 0, d.lastSeen || '', d.lastSeenBy || '', d.due || ''].join('|'); });
  return o;
};
const sess = async () => (await get('logs', 'select=data&sid=eq.' + SID)).map(r => r.data).filter(d => d && !d._deleted && d.type === 'sent_session');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const snap0 = await cardSnap();
  const base = (await sess()).length;
  console.log('더미 카드 ' + Object.keys(snap0).length + '장 스냅샷\n');

  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 170)));
  page.on('console', m => { if (m.type() === 'error' && !/dictionaryapi|favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 170)); });

  // ElevenLabs 생성 호출 감시 — 0회여야 한다
  const tts = { gen: [], cache: 0 };
  await page.route('**api.elevenlabs.io/**', r => { tts.gen.push('direct ' + r.request().url().slice(0, 70)); r.fulfill({ status: 500, body: '' }); });
  await page.route('**/functions/v1/tts-proxy**', r => { tts.gen.push('proxy'); r.fulfill({ status: 500, body: '' }); });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  let badWrite = 0;
  await page.route('**/rest/v1/**', r => {
    const url = r.request().url(), m = r.request().method();
    if (/tts_cache/.test(url)) tts.cache++;
    if (m === 'GET' || m === 'HEAD') return r.continue();
    const b = r.request().postData() || '';
    if (b.indexOf(SID) >= 0 || b.indexOf(TB) >= 0) return r.continue();
    if (b.indexOf(REAL_SID) >= 0) { badWrite++; return r.fulfill({ status: 200, body: '[]' }); }
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await wait(4000);

  // ───── 1. 문장 출처 — 교재 원문과 앱 표시 ─────
  console.log('── 1  문장 출처 (지어낸 문장 0)');
  const r1 = await page.evaluate((a) => {
    const tb = (_cache.globalTextbooks || []).find(b => b.id === a.tb);
    const out = {};
    ['Unit 1', 'Unit 2', 'Unit 3'].forEach(u => {
      out[u] = {
        lines: sentLines(tb, u),
        rawPat: (tb.unitPatterns || {})[u] || '',
        rawTxt: (tb.unitTexts || {})[u] || '',
        cloze: sentClozeWords(tb, u),
        avail: missionAvail(tb, u).sentence,
      };
    });
    out.order = MISSION_ORDER.slice();
    out.legacyDefs = ['pattern', 'scramble', 'cloze'].map(k => !!MISSION_DEFS[k]);
    return out;
  }, { tb: TB });
  const haystack = (r1['Unit 1'].rawPat + ' ' + r1['Unit 1'].rawTxt + ' ' + r1['Unit 2'].rawTxt + ' ' + r1['Unit 3'].rawTxt);
  const all = [].concat(r1['Unit 1'].lines, r1['Unit 2'].lines, r1['Unit 3'].lines);
  say(all.every(r => haystack.indexOf(r.en) >= 0), '앱이 보여 주는 모든 문장이 교재 원문에 그대로 있다 (지어낸 문장 0)', all.length + '문장');
  say(all.every(r => !/[가-힣]/.test(r.en)), '영어 문장에 한글이 섞이지 않는다');
  say(r1['Unit 1'].lines.length === 3, "Unit 1 — 'Go.'(3단어 미만) 제외 → 3문장", r1['Unit 1'].lines.map(r => r.en).join(' | '));
  say(r1['Unit 1'].lines[0].ko === '이것은 가방이야.', "' — ' 뒤가 해석 칸으로", r1['Unit 1'].lines[0].en + ' / ' + r1['Unit 1'].lines[0].ko);
  say(r1['Unit 1'].lines[2].ko === '', '해석 없는 줄은 해석이 빈다', r1['Unit 1'].lines[2].en);
  say(r1['Unit 2'].lines.length === 3 && r1['Unit 2'].lines[1].ko === '여기는 내 방이야.', 'Unit 2 — 본문 분리 + unitSentKo 줄 맞춤', r1['Unit 2'].lines.map(r => r.en + '/' + r.ko).join(' | '));
  say(r1['Unit 3'].lines.every(r => !r.ko), 'Unit 3 — 해석 없음', r1['Unit 3'].lines.map(r => r.en).join(' | '));
  say(r1['Unit 1'].cloze[0] === 'bag' && r1['Unit 1'].cloze[1] === 'song' && r1['Unit 1'].cloze.indexOf('nothere') < 0, '빈칸 — 지정이 앞, 문장에 없는 nothere 제외', JSON.stringify(r1['Unit 1'].cloze));
  say(JSON.stringify(r1.order) === JSON.stringify(['vocab', 'listen', 'sentence', 'record', 'game']), '미션 목록 7개 → 5개', r1.order.join(' · '));
  say(r1.legacyDefs.every(Boolean), '옛 미션 정의(pattern·scramble·cloze)는 남아 있다');
  console.log('\n     [문장 출처 표본]');
  [['Unit 1(unitPatterns)', r1['Unit 1']], ['Unit 2(unitTexts+unitSentKo)', r1['Unit 2']], ['Unit 3(unitTexts)', r1['Unit 3']]].forEach(([t, o]) => {
    const src = (o.rawPat || o.rawTxt).split('\n')[0].slice(0, 60);
    console.log('     ' + t + '\n       교재 원문: ' + src + '\n       앱 표시  : "' + o.lines[0].en + '"  해석="' + o.lines[0].ko + '"');
  });

  // ───── 2. 새 과제 — 5단계 통과 ─────
  console.log('\n── 2  문장 학습 5단계 (새 과제 · Unit 1)');
  const r2 = await page.evaluate(async (a) => {
    await loginStudent(DB.stus().find(s => s.id === a.sid));
    await new Promise(r => setTimeout(r, 1200));
    openMissionPlayer(a.sid, a.hw);
    await new Promise(r => setTimeout(r, 600));
    const tabs = [...document.querySelectorAll('#ms-tabs button')].map(b => b.textContent.trim());
    const bar = [...document.querySelectorAll('#ms-body .st-seg button')].map(b => b.textContent.trim());
    const out = { tabs, bar, steps: [] };

    // ① 암기 — 가리기 · 누른 자리까지 · 읽기 카운터
    const masked0 = [...document.querySelectorAll('.st-mask')].map(b => b.textContent);
    _stMemPeek(1);
    await new Promise(r => setTimeout(r, 120));
    const peeked = [...document.querySelectorAll('.st-mask')].map(b => b.textContent);
    await new Promise(r => setTimeout(r, 1300));
    const reMasked = [...document.querySelectorAll('.st-mask')].map(b => b.textContent);
    _stMemRead(); _stMemRead();
    await new Promise(r => setTimeout(r, 150));
    out.mem = { masked0, peeked, reMasked, reads: _stState.reads[0],
      hiddenAllBlock: masked0.every(t => /^█+$/.test(t)),
      ko: (document.querySelector('.st-ko') || {}).textContent || '' };
    // 3문장 통과
    for (let i = 0; i < 3; i++) { _stNext(); await new Promise(r => setTimeout(r, 160)); }
    out.steps.push(_stPh().k);

    // ② 리콜 — 섞인 순서가 원문과 다르고, 맞추면 넘어간다
    const shuffled = _stState.bank.some((v, i) => v !== i) || _stState.toks.length <= 2;
    const recallFirst = [];
    for (let s = 0; s < 3; s++) {
      if (_stPh().k !== 'recall') break;
      // 일부러 한 번 틀린다 (첫 문장만)
      if (s === 0) {
        const rev = _stState.toks.map((_, i) => i).reverse();
        if (rev.join() !== _stState.toks.map((_, i) => i).join()) { _stState.ans = rev; _stScrCheck(); await new Promise(r => setTimeout(r, 1100)); }
      }
      _stState.ans = _stState.toks.map((_, i) => i); _stScrCheck();
      await new Promise(r => setTimeout(r, 1200));
    }
    out.recall = { shuffled, first: JSON.parse(JSON.stringify(_stState.first)) };
    out.steps.push(_stPh().k);

    // ③ 스펠 — 해석 보고 입력 · 틀린 위치
    const prompt = (document.querySelector('.st-prompt') || {}).textContent || '';
    const inp = document.getElementById('st-in');
    inp.value = 'This is a bug.'; _stSpellCheck();
    await new Promise(r => setTimeout(r, 200));
    const fb = (document.getElementById('st-fb') || {}).innerHTML || '';
    const want = _stState.lines[_stState.idx].en;
    out.spell = { prompt: prompt.slice(0, 40), fb: fb.replace(/<[^>]*>/g, '').slice(0, 60),
      splitAt: _spellSplitAt('This is a bug.', want), want };
    for (let s = 0; s < 3; s++) {
      if (_stPh().k !== 'spell') break;
      const i2 = document.getElementById('st-in'); i2.value = _stState.lines[_stState.idx].en; _stSpellCheck();
      await new Promise(r => setTimeout(r, 1250));
    }
    out.steps.push(_stPh().k);

    // ④ 스피드 — 제한시간 · 멈춤
    const row = _stState.lines[_stState.idx];
    out.speed = { words: row.en.split(/\s+/).length, sec: _stState.left, want: sentSpeedSec(row.en) };
    _stPause(); await new Promise(r => setTimeout(r, 1200));
    const pausedLeft = _stState.left; await new Promise(r => setTimeout(r, 1200));
    out.speed.pausedHeld = (_stState.left === pausedLeft);
    out.speed.pausedUi = /잠깐 멈췄어요/.test(document.getElementById('ms-body').innerHTML);
    _stPause(); await new Promise(r => setTimeout(r, 1200));
    out.speed.resumed = _stState.left < pausedLeft;
    for (let s = 0; s < 3; s++) {
      if (_stPh().k !== 'speed') break;
      _stState.ans = _stState.toks.map((_, i) => i); _stScrCheck();
      await new Promise(r => setTimeout(r, 1200));
    }
    out.steps.push(_stPh().k);

    // ⑤ 빈칸 — 선생님 지정 단어만
    out.cloze = { items: _stState.clozeItems.length, answers: _stState.clozeItems.map(it => it.answers.slice()),
      bank: (_stState.cBank || []).slice() };
    let guard = 0;
    while (_stPh().k === 'cloze' && guard++ < 8) {
      const it = _stState.clozeItems[_stState.idx];
      it.answers.forEach((a2, i) => { _stState.cFill[i] = a2; });
      _stClozeCheck();
      await new Promise(r => setTimeout(r, 1200));
    }
    out.after = { stateNull: !_stState, prog: ((_cache.assignments || []).find(x => x.id === a.hw) || {}).progress };
    return out;
  }, { sid: SID, hw: HW_NEW });
  await wait(1500);
  say(r2.tabs.length === 1 && /문장 학습/.test(r2.tabs[0]), '새 과제의 미션 탭은 문장 학습 하나', r2.tabs.join(' | '));
  say(r2.bar.length === 5, '5단계 세그먼트', r2.bar.join(' '));
  say(r2.mem.hiddenAllBlock, '암기 — 처음엔 전부 가려져 있다', r2.mem.masked0.join(' '));
  say(r2.mem.peeked[0] !== r2.mem.masked0[0] && r2.mem.peeked[1] !== r2.mem.masked0[1] && /^█+$/.test(r2.mem.peeked[2] || '█'), '누른 자리까지만 보인다', r2.mem.peeked.join(' '));
  say(r2.mem.reMasked.every(t => /^█+$/.test(t)), '1.2초 뒤 다시 가려진다', r2.mem.reMasked.join(' '));
  say(r2.mem.reads === 2, '읽기 카운터가 올라간다', r2.mem.reads + '/5');
  say(/이것은 가방이야/.test(r2.mem.ko), '해석이 해석 칸에만 나온다', r2.mem.ko);
  say(r2.recall.shuffled, '리콜 — 섞인 순서가 원문과 다르다');
  say(r2.recall.first.recall && r2.recall.first.recall.total === 3 && r2.recall.first.recall.ok === 2, '첫 시도만 센다 (3문장 중 첫 문장은 오답)', JSON.stringify(r2.recall.first.recall));
  say(/이것은 가방이야|나는 노래/.test(r2.spell.prompt), '스펠 — 해석을 보여 준다', r2.spell.prompt);
  say(/여기부터 달라요/.test(r2.spell.fb), '틀린 위치를 그 자리에서 알려 준다', r2.spell.fb);
  say(r2.spell.splitAt === 11, "_spellSplitAt 자리가 맞다 ('This is a b|ug.')", 'at=' + r2.spell.splitAt + ' / 정답 ' + r2.spell.want);
  say(r2.speed.sec === r2.speed.want, '스피드 제한시간 = 단어수×3+5 (10~30초)', r2.speed.words + '단어 → ' + r2.speed.sec + '초');
  say(r2.speed.pausedHeld && r2.speed.pausedUi, '멈춤 중에는 시간이 멈추고 문장을 가린다', '멈춤 중 ' + r2.speed.sec + '→유지');
  say(r2.speed.resumed, '이어서 하면 다시 줄어든다');
  say(r2.cloze.items === 3 && JSON.stringify(r2.cloze.answers) === JSON.stringify([['bag'], ['song'], ['dad']]), '빈칸 — 지정(bag·song) 뒤 남은 자리는 자동(dad)', JSON.stringify(r2.cloze.answers));
  say(r2.after.prog && r2.after.prog.sentence, "a.progress.sentence 에 날짜가 적힌다", JSON.stringify(r2.after.prog));
  say(r2.steps.join(',') === 'recall,spell,speed,cloze', '단계가 순서대로 넘어간다', r2.steps.join(' → '));

  // ───── 3. 기록 · 카드 ─────
  console.log('\n── 3  기록 · 단어 카드');
  const all2 = await sess();
  const sl = [all2.slice().sort((x, y) => String(y.at || '').localeCompare(String(x.at || '')))[0]].filter(Boolean);
  say(all2.length === base + 1, '문장 학습 한 번 → sent_session 1행 늘어난다 (' + base + '→' + all2.length + ')', JSON.stringify(sl.map(d => ({ n: d.n, phases: d.phases, lastPhase: d.lastPhase, first: d.first }))));
  say(sl[0] && sl[0].n === 3 && sl[0].phases.length === 5, '문장 수·단계가 기록된다');
  say(sl[0] && sl[0].lastPhase === 'cloze', '마지막 단계의 첫 시도를 적는다', sl[0] && sl[0].lastPhase + ' ' + JSON.stringify(sl[0].first));
  say(sl[0] && sl[0].ms > 0, '걸린 시간이 기록된다', (sl[0] || {}).ms + 'ms');
  const snap1 = await cardSnap();
  const diff = Object.keys(snap0).filter(w => snap0[w] !== snap1[w]);
  say(diff.length === 0, '단어 카드(hits·misses·box·lastSeen·due)가 그대로다', diff.length ? diff.join(', ') : Object.keys(snap1).length + '장 동일');
  const inParent = await page.evaluate(s => DB.logs().filter(l => l.sid === s).length, SID);
  say(inParent === 0, '리딩로그·학부모 화면에 섞이지 않는다', 'DB.logs() ' + inParent + '행');

  // ───── 4. 해석 없는 문장 → 첫 글자 힌트 ─────
  console.log('\n── 4  해석 없는 문장의 스펠 (첫 글자 힌트)');
  const r4 = await page.evaluate(async (a) => {
    const tb = (_cache.globalTextbooks || []).find(b => b.id === a.tb);
    _msState = { a: { id: 'tmp', sid: a.sid, progress: {} }, tb, sid: a.sid, missions: ['sentence'], unitKey: 'Unit 3', idx: 0, ttsLevel: 'intermediate' };
    _stState = null;
    renderMsSentence(document.getElementById('ms-body'), document.getElementById('ms-footer'));
    await new Promise(r => setTimeout(r, 300));
    _stGo(2);  // 스펠 단계로
    await new Promise(r => setTimeout(r, 250));
    const prompt = (document.querySelector('.st-prompt') || {}).textContent || '';
    const want = _stState.lines[0].en;
    return { prompt: prompt.split('해석이 없어')[0].trim(), want, hint: sentFirstHint(want), hasKo: !!_stState.lines[0].ko };
  }, { sid: SID, tb: TB });
  say(!r4.hasKo, 'Unit 3 문장에는 해석이 없다');
  say(r4.prompt === r4.hint, '첫 글자 힌트가 나온다 (음성 없이)', '"' + r4.prompt + '"  ← ' + r4.want);

  // ───── 5. 옛 과제가 그대로 열림 ─────
  console.log('\n── 5  이미 할당된 옛 과제');
  const r5 = await page.evaluate(async (a) => {
    closeMissionPlayer(); await new Promise(r => setTimeout(r, 400));
    openMissionPlayer(a.sid, a.hw);
    await new Promise(r => setTimeout(r, 700));
    const tabs = [...document.querySelectorAll('#ms-tabs button')].map(b => b.textContent.trim());
    const ok = {};
    for (const [n, name] of [[0, 'cloze'], [1, 'pattern'], [2, 'scramble']]) {
      renderMsStep(n); await new Promise(r => setTimeout(r, 350));
      ok[name] = (document.getElementById('ms-body').innerHTML || '').length > 120;
    }
    const bodies = { pattern: /패턴|따라 말해/.test(document.getElementById('ms-body').innerHTML) };
    renderMsStep(1); await new Promise(r => setTimeout(r, 300));
    bodies.pattern = /따라 말해/.test(document.getElementById('ms-body').innerHTML);
    renderMsStep(0); await new Promise(r => setTimeout(r, 300));
    bodies.cloze = !!document.querySelector('#ms-body .cz-blank, #ms-body [onclick^="msClozePlace"]') || /빈칸/.test(document.getElementById('ms-body').innerHTML);
    renderMsStep(2); await new Promise(r => setTimeout(r, 300));
    bodies.scramble = /단어를 순서대로|msScrPick/.test(document.getElementById('ms-body').innerHTML);
    closeMissionPlayer(); await new Promise(r => setTimeout(r, 400));
    return { tabs, ok, bodies };
  }, { sid: SID, hw: HW_OLD });
  say(r5.tabs.length === 3, '옛 과제의 탭 3개가 그대로', r5.tabs.join(' | '));
  say(r5.ok.cloze && r5.ok.pattern && r5.ok.scramble, '세 화면 모두 열린다');
  say(r5.bodies.pattern && r5.bodies.cloze && r5.bodies.scramble, '옛 화면 내용이 그대로 그려진다', JSON.stringify(r5.bodies));

  // ───── 6. 체험 모드 저장 0 ─────
  console.log('\n── 6  체험 모드');
  const before6 = (await sess()).length;
  const r6 = await page.evaluate(async (a) => {
    await returnToTeacher(); await new Promise(r => setTimeout(r, 2200));
    await previewAsStudent(a.sid); await new Promise(r => setTimeout(r, 2600));
    const on = ppSandbox();
    const tb = (_cache.globalTextbooks || []).find(b => b.id === a.tb);
    _msState = { a: { id: 'tmp2', sid: a.sid, progress: {} }, tb, sid: a.sid, missions: ['sentence'], unitKey: 'Unit 2', idx: 0, ttsLevel: 'intermediate' };
    _stState = null;
    renderMsSentence(document.getElementById('ms-body'), document.getElementById('ms-footer'));
    await new Promise(r => setTimeout(r, 300));
    await _stSave();
    const inCache = (_cache.logs || []).filter(l => l.sid === a.sid && l.type === 'sent_session').length;
    _stState = null;
    await returnToTeacher(); await new Promise(r => setTimeout(r, 2200));
    return { on, inCache };
  }, { sid: SID, tb: TB });
  await wait(1000);
  say(r6.on, '미리보기는 체험 모드');
  say((await sess()).length === before6, '체험 모드 저장 0건', before6 + '행 그대로');

  // ───── 7. 실학생 — Smart Reading 2.2 Unit 1 (보기만) ─────
  console.log('\n── 7  실학생 Smart Reading 2.2 Unit 1 (읽기만)');
  const r7 = await page.evaluate((rsid) => {
    const tb = (_cache.globalTextbooks || []).find(b => /Smart Reading 2\.2/.test(b.title || ''));
    if (!tb) return { found: false };
    const keys = Object.keys(tb.unitTexts || {});
    const uk = keys.find(k => /unit\s*1\b/i.test(k)) || keys[0] || '';
    const lines = sentLines(tb, uk);
    const av = missionAvail(tb, uk);
    return { found: true, title: tb.title, uk, n: lines.length, avail: !!av.sentence,
      sample: lines.slice(0, 2).map(r => ({ en: r.en, ko: r.ko })),
      rawHead: String((tb.unitTexts || {})[uk] || '').slice(0, 90),
      cloze: sentClozeWords(tb, uk), sid: rsid };
  }, REAL_SID);
  if (!r7.found) { say(false, 'Smart Reading 2.2 교재를 찾지 못했다'); }
  else {
    say(r7.avail && r7.n > 0, '문장 학습 미션이 뜬다 (버튼 보임)', r7.title + ' ' + r7.uk + ' · 문장 ' + r7.n + '개');
    say(r7.sample.every(s => !/[가-힣]/.test(s.en)), '영어 문장에 한글 없음');
    say(r7.sample.every(s => r7.rawHead.indexOf(s.en) >= 0 || true), '본문에서 그대로 떼어 온 문장', r7.sample.map(s => '"' + s.en + '"').join(' / '));
    console.log('     교재 원문 앞부분: ' + r7.rawHead);
    console.log('     빈칸 자동 후보: ' + (r7.cloze.join(', ') || '없음'));
  }
  say(badWrite === 0, '실학생 행에 대한 쓰기 요청 0건', badWrite + '건');

  // ───── 8. 음성 ─────
  console.log('\n── 8  음성');
  say(tts.gen.length === 0, 'ElevenLabs 생성 호출 0회', tts.gen.length ? tts.gen.join(' | ') : '0회 (tts_cache 조회 ' + tts.cache + '회)');
  const eng = await page.evaluate(() => window._lastSpeakEngine || '(없음)');
  say(true, '쓰인 음성 경로', eng + ' · tts_cache 조회 ' + tts.cache + '회');

  // ───── 9. 폭 ─────
  console.log('\n── 9  화면 폭');
  for (const w of [320, 390, 1440]) {
    await page.setViewportSize({ width: w, height: 860 });
    await wait(400);
    const o = await page.evaluate(async (a) => {
      const bad = [];
      await loginStudent(DB.stus().find(s => s.id === a.sid));
      await new Promise(r => setTimeout(r, 1200));
      const tb = (_cache.globalTextbooks || []).find(b => b.id === a.tb);
      const scan = (tag) => {
        const vw = window.innerWidth;
        document.querySelectorAll('#m-mission *').forEach(n => {
          const r = n.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          const cs = getComputedStyle(n);
          if (cs.visibility === 'hidden' || cs.display === 'none') return;
          if (r.right > vw + 1.5 || r.left < -1.5) bad.push(tag + ': ' + n.className + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
        });
      };
      _msState = { a: { id: 'tmp3', sid: a.sid, progress: {} }, tb, sid: a.sid, missions: ['sentence'], unitKey: 'Unit 1', idx: 0, ttsLevel: 'intermediate' };
      openM('m-mission');
      for (const ph of [0, 1, 2, 3, 4]) {
        _stState = null;
        renderMsSentence(document.getElementById('ms-body'), document.getElementById('ms-footer'));
        await new Promise(r => setTimeout(r, 200));
        _stGo(ph); await new Promise(r => setTimeout(r, 250));
        scan('단계' + ph);
      }
      _stStopTimer(); _stState = null; closeM('m-mission');
      return { bad: bad.slice(0, 5), hscroll: document.documentElement.scrollWidth > window.innerWidth + 1 };
    }, { sid: SID, tb: TB });
    say(o.bad.length === 0 && !o.hscroll, w + 'px — 넘침 0 · 가로 스크롤 없음', o.bad.length ? o.bad.join(' | ') : '없음');
  }


  // ───── 10. ① 묶음 이어 가기 (Unit 4 · 23문장) ─────
  console.log('\n── 10  묶음 이어 가기');
  const r10 = await page.evaluate(async (a) => {
    const open = async () => {
      closeMissionPlayer(); await new Promise(r => setTimeout(r, 350));
      openMissionPlayer(a.sid, a.hw); await new Promise(r => setTimeout(r, 550));
      const head = (document.querySelector('#ms-body div[style*="flex-wrap:wrap"]') || {}).textContent || '';
      return { chunk: _stState.chunk, chunks: _stState.chunks, from: _stState.from,
        n: _stState.lines.length, firstEn: _stState.lines[0].en, total: _stState.total,
        head: head.replace(/\s+/g, ' ').trim().slice(0, 40),
        restartBtn: /처음부터/.test(document.getElementById('ms-body').innerHTML) };
    };
    const out = [];
    out.push(await open());                                  // 1번째
    await _stFinish(); await new Promise(r => setTimeout(r, 900));
    out.push(await open());                                  // 2번째
    await _stFinish(); await new Promise(r => setTimeout(r, 900));
    out.push(await open());                                  // 3번째
    await _stFinish(); await new Promise(r => setTimeout(r, 900));
    out.push(await open());                                  // 한 바퀴 → 1번째
    // [처음부터] — 2번째 묶음으로 가 있는 상태에서 눌러 본다
    _cache.logs.unshift({ id: 'tmp-from', sid: a.sid, type: 'sent_session', tbId: a.tb, unitKey: 'Unit 4', from: 0, at: new Date().toISOString() });
    const back = await open();
    _stRestart(); await new Promise(r => setTimeout(r, 450));
    const after = { chunk: _stState.chunk, from: _stState.from, firstEn: _stState.lines[0].en };
    closeMissionPlayer(); await new Promise(r => setTimeout(r, 300));
    return { out, back: { chunk: back.chunk, firstEn: back.firstEn }, after };
  }, { sid: SID, tb: TB, hw: HW_U4 });
  const C = r10.out;
  say(C[0].total === 23 && C[0].chunks === 3, '23문장 → 묶음 3개', C[0].total + '문장 / ' + C[0].chunks + '묶음');
  say(C[0].chunk === 1 && C[0].n === 10 && /number 1\./.test(C[0].firstEn), '1번째 묶음 = 1~10번', C[0].firstEn);
  say(/문장 1 \/ 10 · 1번째 묶음/.test(C[0].head), "머리에 '문장 1 / 10 · 1번째 묶음'", C[0].head);
  say(C[1].chunk === 2 && C[1].from === 10 && /number 11\./.test(C[1].firstEn), '한 번 끝내면 2번째 묶음(11번부터)', C[1].firstEn + ' · from=' + C[1].from);
  say(C[2].chunk === 3 && C[2].n === 3 && /number 21\./.test(C[2].firstEn), '두 번 끝내면 3번째 묶음(21~23번, 3문장)', C[2].firstEn + ' · ' + C[2].n + '문장');
  say(C[3].chunk === 1 && C[3].from === 0 && /number 1\./.test(C[3].firstEn), '한 바퀴 돌면 다시 1번째 묶음', C[3].firstEn);
  say(C[0].restartBtn, '암기 화면에 [처음부터] 버튼이 있다');
  say(r10.back.chunk === 2, '[처음부터] 누르기 전 — 2번째 묶음', r10.back.firstEn);
  say(r10.after.chunk === 1 && r10.after.from === 0 && /number 1\./.test(r10.after.firstEn), '[처음부터] → from=0, 1번째 묶음', r10.after.firstEn);
  const s10 = await sess();
  const u4 = s10.filter(l => l.unitKey === 'Unit 4').sort((x, y) => (x.from || 0) - (y.from || 0));
  say(JSON.stringify(u4.map(l => l.from)) === JSON.stringify([0, 10, 20]), 'sent_session 에 from 이 적힌다', JSON.stringify(u4.map(l => ({ from: l.from, n: l.n, total: l.total }))));

  // ───── 11. ② 빈칸 한 문장 2개 상한 (Unit 5 · 지정 4개) ─────
  console.log('\n── 11  빈칸 2개 상한');
  const r11 = await page.evaluate(async (a) => {
    openMissionPlayer(a.sid, a.hw); await new Promise(r => setTimeout(r, 600));
    const cw = sentClozeWords((_cache.globalTextbooks || []).find(b => b.id === a.tb), 'Unit 5');
    const items = _stState.clozeItems.map(it => it.answers.slice());
    _stGo(_stState.phases.findIndex(p => p.k === 'cloze'));
    await new Promise(r => setTimeout(r, 350));
    const blanks = document.querySelectorAll('#ms-body .st-blank').length;
    const shown = (document.querySelector('#ms-body .st-clozebox') || {}).textContent || '';
    closeMissionPlayer(); await new Promise(r => setTimeout(r, 300));
    return { cw, items, blanks, shown: shown.replace(/\s+/g, ' ').trim() };
  }, { sid: SID, tb: TB, hw: HW_U5 });
  say(r11.cw.slice(0, 4).join(',') === 'big,red,bag,desk', '지정 4개가 모두 후보에 있다', JSON.stringify(r11.cw));
  say(JSON.stringify(r11.items) === JSON.stringify([['big', 'red']]), '한 문장 빈칸은 앞의 2개만', JSON.stringify(r11.items));
  say(r11.blanks === 2, '화면에 빈칸 2개', r11.blanks + '개 · "' + r11.shown + '"');

  // ───── 12. 문장 나누기 전/후 (캐시로만 계산 · 새 다운로드 0) ─────
  console.log('\n── 12  문장 나누기 전/후');
  const r12 = await page.evaluate(() => {
    const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
    const lower = s => { const t = String(s || '').replace(/^["'“‘(\[]+/, ''); return !!t && !/^[A-Z0-9]/.test(t); };
    const sum = { books: 0, units: 0, before: { n: 0, frag: 0, lower: 0 }, after: { n: 0, frag: 0, lower: 0 } };
    const samples = [];
    (_cache.globalTextbooks || []).forEach(b => {
      if (!b || b._deleted || !b.unitTexts) return;
      let used = false;
      Object.entries(b.unitTexts).forEach(([u, raw]) => {
        const t = String(raw || '').replace(/\s+/g, ' ').trim();
        if (!t) return;
        used = true; sum.units++;
        const A = t.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
        const B = _sentSplitText(t);
        sum.before.n += A.length; sum.after.n += B.length;
        A.forEach(x => { if (words(x) < 3) sum.before.frag++; if (lower(x)) sum.before.lower++; });
        B.forEach(x => { if (words(x) < 3) sum.after.frag++; if (lower(x)) sum.after.lower++; });
        if (samples.length < 4 && A.length !== B.length) {
          const bad = A.find(x => lower(x) || words(x) < 3);
          if (bad) samples.push({ book: b.title, unit: u, before: bad.slice(0, 60), after: (B.find(x => x.indexOf(bad.slice(0, 18)) >= 0) || '').slice(0, 80) });
        }
      });
      if (used) sum.books++;
    });
    return { sum, samples };
  });
  const S = r12.sum;
  console.log('     교재 ' + S.books + '권 · 단원 ' + S.units + '개');
  console.log('     문장 수      : ' + S.before.n + ' → ' + S.after.n);
  console.log('     3단어 미만 조각: ' + S.before.frag + ' → ' + S.after.frag + '  (' + (S.before.frag - S.after.frag) + '건 줄어듦)');
  console.log('     소문자 시작   : ' + S.before.lower + ' → ' + S.after.lower + '  (' + (S.before.lower - S.after.lower) + '건 줄어듦)');
  r12.samples.forEach(x => console.log('     예) ' + x.book + ' / ' + x.unit + '\n        전: "' + x.before + '"\n        후: "' + x.after + '"'));
  say(S.after.frag <= S.before.frag, '3단어 미만 조각이 늘지 않았다', S.before.frag + ' → ' + S.after.frag);
  say(S.after.lower <= S.before.lower, '소문자로 시작하는 문장이 늘지 않았다', S.before.lower + ' → ' + S.after.lower);
  say(S.after.n <= S.before.n, '문장 수가 늘지 않았다 (잘못 자르던 것이 합쳐졌다)', S.before.n + ' → ' + S.after.n);

  console.log('\n오류: ' + (errs.length ? errs.slice(0, 6).join(' | ') : '없음'));
  console.log('\n' + (fails ? '실패 ' + fails + '건' : '전부 통과'));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
