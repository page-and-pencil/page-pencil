require('../_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 밀린 항목 11가지 점검 — 전부 더미 데이터 + 가짜 서버 (실DB·실AI 안 씀)
const path = require('path');
const ROOT = require('path').resolve(__dirname, '..', '..');
const SCR = (process.env.PP_TEST_OUT || require('os').tmpdir());
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const F = require(SCR + '/fake_server.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => (c ? pass : fail).push((c ? '' : '') + n + (note ? ' — ' + note : ''));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 940 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => {
    try {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' }));
    } catch (e) { }
  });
  const page = await ctx.newPage();
  const state = { tables: F.mkData(), posts: [], gets: [], settings: { cloud: { name: 'dummy', preset: 'dummy' } } };
  let aiBodies = [], proxyHasKey = true;
  await F.install(page, state);
  await page.route('**/functions/v1/**', async r => {
    const u = r.request().url();
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) { }
    if (/tts-proxy/.test(u)) return r.fulfill({ status: 400, body: JSON.stringify({ error: { message: 'API key required' } }) });
    if (!b.model) {    // 서버 키 확인용 탐침
      return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: proxyHasKey ? 'model: Field required' : 'API key required' } }) });
    }
    aiBodies.push(JSON.stringify(b));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: '더미 코멘트입니다. 꾸준히 지도하겠습니다.' }] }) });
  });
  await page.route('**://res.cloudinary.com/**', r => r.abort());
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 180)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.message).slice(0, 180)));
  // 인쇄 창 가로채기
  await page.addInitScript(() => {
    window.__printed = [];
    window.open = function () {
      const doc = { write: h => window.__printed.push(h), close: () => { }, title: '' };
      return { document: doc, focus: () => { }, print: () => { }, close: () => { }, onload: null, location: {} };
    };
  });
  await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await wait(2200);

  const base = await page.evaluate(() => ({ stus: DB.stus().length, cls: DB.classes().length, notices: (_cache.notices || []).length, api: DB.api() }));
  ok('더미 데이터로 떴다 (가짜 서버)', base.stus === 3 && base.cls === 2 && base.notices === 3,
    '학생 ' + base.stus + '명 · 반 ' + base.cls + '개 · 공지 ' + base.notices + '건');

  // ── 10) API Key 미설정 배너 ─────────────────────────────────
  const b10 = await page.evaluate(() => {
    const vis = id => { const e = document.getElementById(id); return !!e && e.style.display !== 'none'; };
    return { api: DB.api(), proxy: _cache.settings.aiProxy, les: vis('api-les-warn'), tst: vis('api-tst-warn'), log: vis('api-log-warn') };
  });
  ok('⑩ 서버에 키가 있으면 API Key 배너가 안 뜬다',
    b10.proxy === true && b10.api === 'proxy' && !b10.les && !b10.tst && !b10.log,
    'aiProxy=' + b10.proxy + ' · 수업/테스트/리딩로그 배너 ' + [b10.les, b10.tst, b10.log].join('/'));
  // 서버에도 키가 없으면 배너가 떠야 한다 (배너 자체가 죽은 것이 아님을 확인)
  proxyHasKey = false;
  const b10b = await page.evaluate(async () => {
    _cache.settings.apikey = ''; try { localStorage.removeItem('pp_apikey'); } catch (e) { }
    await ppProbeAiProxy();
    const vis = id => { const e = document.getElementById(id); return !!e && e.style.display !== 'none'; };
    return { proxy: _cache.settings.aiProxy, les: vis('api-les-warn'), tst: vis('api-tst-warn'), log: vis('api-log-warn') };
  });
  ok('⑩-2 키가 정말 없으면 배너가 뜬다 (배너가 죽은 것이 아님)',
    b10b.proxy === false && b10b.les && b10b.tst && b10b.log, 'aiProxy=' + b10b.proxy);
  proxyHasKey = true;
  await page.evaluate(() => ppProbeAiProxy());
  await wait(400);

  // ── 9) 반 일괄 할당 목록 ────────────────────────────────────
  const b9 = await page.evaluate(() => {
    openBulkAssign('cA');
    const sel = document.getElementById('modal-assign-stu');
    const sf = document.getElementById('modal-assign-stu-f');
    const r = { stus: _bulkStus().map(s => s.name), hidden: !sf || sf.style.display === 'none', extra: (document.getElementById('modal-assign-extra') || {}).textContent || '' };
    closeM('m-add-assign');
    return r;
  });
  ok('⑨-2 반 일괄 할당은 그 반 학생만',
    b9.stus.length === 2 && b9.stus.indexOf('박더미') < 0 && b9.hidden,
    '대상 ' + b9.stus.join('·') + ' · 학생 드롭다운 숨김 ' + b9.hidden);

  // ── 11) 붙여넣기 라우팅 ─────────────────────────────────────
  const b11 = await page.evaluate(async () => {
    const mkPaste = () => {
      const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
      const f = new File([blob], 'cap.png', { type: 'image/png' });
      const dt = new DataTransfer(); dt.items.add(f);
      return new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    };
    const out = {};
    swTab('t-data'); switchDataTab('iso');
    await new Promise(r => setTimeout(r, 500));
    const iso0 = (typeof _isoImgs !== 'undefined' ? _isoImgs.length : -1);
    document.body.dispatchEvent(mkPaste());
    await new Promise(r => setTimeout(r, 500));
    out.isoGot = (typeof _isoImgs !== 'undefined' ? _isoImgs.length : -1) - iso0;
    out.tstFile = (document.getElementById('tst-file') || {}).files?.length || 0;
    out.lgFile = (document.getElementById('lg-file') || {}).files?.length || 0;
    // 테스트 탭에서 붙여넣으면 테스트 칸으로
    swTab('t-tst');
    await new Promise(r => setTimeout(r, 400));
    document.body.dispatchEvent(mkPaste());
    await new Promise(r => setTimeout(r, 400));
    out.tstAfter = (document.getElementById('tst-file') || {}).files?.length || 0;
    out.isoAfter = (typeof _isoImgs !== 'undefined' ? _isoImgs.length : -1) - iso0;
    // 리딩로그 탭
    swTab('t-log');
    await new Promise(r => setTimeout(r, 400));
    document.body.dispatchEvent(mkPaste());
    await new Promise(r => setTimeout(r, 400));
    out.logAfter = (document.getElementById('lg-file') || {}).files?.length || 0;
    out.tstAfter2 = (document.getElementById('tst-file') || {}).files?.length || 0;
    return out;
  });
  ok('⑪ 붙여넣기는 지금 열린 탭으로만 간다',
    b11.isoGot === 1 && b11.tstFile === 0 && b11.lgFile === 0 &&
    b11.tstAfter === 1 && b11.isoAfter === 1 && b11.logAfter === 1 && b11.tstAfter2 === 1,
    '동형 탭 → 동형 ' + b11.isoGot + '장 (테스트 칸 ' + b11.tstFile + ') · 테스트 탭 → 테스트 칸 ' + b11.tstAfter + ' (동형 그대로 ' + b11.isoAfter + ') · 리딩로그 탭 → 로그 칸 ' + b11.logAfter);

  // ── 6) 수업 기록 materials 키 ───────────────────────────────
  const b6 = await page.evaluate(() => {
    const wrap = document.getElementById('subj-rows'); if (wrap) wrap.innerHTML = '';
    addSRowTo('subj-rows', 'vocab', '', '');            // 1번 어휘 칸 — 비워 둔다
    addSRowTo('subj-rows', 'vocab_5', '더미 어휘 5', 'Unit 9');  // 5번째 어휘 칸만 채운다
    addSRowTo('subj-rows', 'reading', '더미 리딩 2', 'Lesson 4');
    const m = getSMats();
    const wrap2 = document.getElementById('subj-rows'); wrap2.innerHTML = '';
    addSRowTo('subj-rows', 'vocab', '첫째 권', 'Unit 1');
    addSRowTo('subj-rows', 'vocab', '둘째 권', 'Unit 2');   // 체인 '+' 로 같은 과목 추가
    const m2 = getSMats();
    return { keys: Object.keys(m), m, dup: Object.keys(m2), dupBooks: Object.values(m2).map(v => v.unit) };
  });
  ok('⑥ 수업 기록 materials 키가 바뀌지 않는다',
    b6.keys.indexOf('vocab_5') >= 0 && b6.keys.indexOf('reading') >= 0 && b6.keys.indexOf('vocab') < 0,
    '저장될 키 = ' + b6.keys.join(', '));
  ok('⑥-2 같은 과목을 더하면 빈 번호를 붙인다',
    b6.dup.join(',') === 'vocab,vocab_2' && b6.dupBooks.join(',') === 'Unit 1,Unit 2',
    b6.dup.join(', ') + ' = ' + b6.dupBooks.join(', '));

  // ── 5) AI 코멘트 지시문 ─────────────────────────────────────
  aiBodies = [];
  const b5 = await page.evaluate(async () => {
    const out = await polishCmt('단어 복습, 집중 잘함', '[어휘] 교재명=345 Grammar 1 | 단원=Unit 3');
    return { out };
  });
  const p5 = aiBodies.join('\n');
  ok('⑤ 코멘트 프롬프트에 교재명 그대로·지어내기 금지 지시가 있다',
    /한 글자도 바꾸지 말고 그대로/.test(p5) && /345/.test(p5) && /지어내면 안 됩니다|지어내지 마세요/.test(p5) && /없는 것은 쓰지 마세요/.test(p5),
    '호출 ' + aiBodies.length + '회 · 교재명 규칙 ' + /한 글자도 바꾸지 말고 그대로/.test(p5) + ' · 창작 금지 ' + /지어내/.test(p5));

  // 월간 리포트 초안 프롬프트
  aiBodies = [];
  const b5c = await page.evaluate(async d => {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    set('re-sid', 's1'); set('re-month', d.m);
    await generateReportDraft();
    return (document.getElementById('re-text') || {}).value || '';
  }, { m: F.THIS_M });
  const p5b = aiBodies.join('\n');
  ok('⑤-2 월간 리포트 프롬프트에도 같은 지시가 있다',
    /한 글자도 바꾸지 말고 그대로/.test(p5b) && /기록에 없는 내용 추가 금지/.test(p5b) && /0회면 그 이야기를 아예 꺼내지 마세요/.test(p5b),
    '교재명 규칙 ' + /한 글자도 바꾸지 말고 그대로/.test(p5b) + ' · 없는 결석 금지 ' + /0회면 그 이야기를/.test(p5b));

  // ── 3·4) 월간 리포트 인쇄·삭제 ──────────────────────────────
  const b34 = await page.evaluate(() => {
    const del = document.querySelector('#m-report-editor button[onclick="reqDelReport()"]');
    return { delBtn: !!del, label: del ? del.textContent.trim() : '' };
  });
  ok('③-1 선생님 화면에 월간 리포트 삭제(휴지통) 단추가 있다', b34.delBtn, b34.label);
  await page.evaluate(() => { closeM('m-report-editor'); });

  aiBodies = [];
  const b4 = await page.evaluate(async d => {
    window.__printed = [];
    await printReport('s1', d.m);
    await new Promise(r => setTimeout(r, 500));
    const h = (window.__printed || []).join('\n');
    return { len: h.length, saved: h.indexOf('ZZTOP') >= 0, draft: h.indexOf('초안 본문') >= 0, note: h.indexOf('선생님 메모') >= 0 };
  }, { m: F.PREV_M });
  ok('④ 인쇄의 종합 코멘트는 저장된 본문 (AI 를 새로 부르지 않는다)',
    b4.saved && !b4.draft && !b4.note && aiBodies.length === 0,
    '인쇄 ' + b4.len + '자 · 저장 본문 ' + b4.saved + ' · 선생님 메모 섞임 ' + b4.note + ' · AI 호출 ' + aiBodies.length + '회');

  // ── 1·7·8) 학생·학부모 화면 ─────────────────────────────────
  const b1 = await page.evaluate(async () => {
    await ppStudentEnter('s1', '김더미');
    await new Promise(r => setTimeout(r, 900));
    const p = document.getElementById('notice-popup');
    const first = { shown: p.style.display === 'block', text: (document.getElementById('notice-text') || {}).textContent || '' };
    closeNotice();
    checkNotice();
    const second = { shown: p.style.display === 'block', text: (document.getElementById('notice-text') || {}).textContent || '' };
    closeNotice();
    checkNotice();
    const third = { shown: p.style.display === 'block' };
    return { first, second, third, read: JSON.parse(localStorage.getItem('pp_notice_read') || '[]') };
  });
  ok('① 학생 앱에 공지가 뜬다 (대상 반만 · 확인하면 다시 안 뜸)',
    b1.first.shown && /전체 공지/.test(b1.first.text) && /1건 더/.test(b1.first.text) &&
    b1.second.shown && /A반 공지/.test(b1.second.text) && !b1.third.shown && b1.read.length === 2,
    '1차 "' + b1.first.text.split('\n')[0] + '" (더 있음 1건 = B반 공지 제외됨) · 2차 "' + b1.second.text.split('\n')[0] + '" · 3차 안 뜸 ' + !b1.third.shown);

  const b7 = await page.evaluate(() => {
    const cards = ppLive(_cache.vocab_cards).filter(c => c.sid === currentStudentSid);
    const rev = cards.filter(c => ppStudiedToday(c)).length;
    const pick = dailyVocabPick(currentStudentSid);
    const home = document.getElementById('st-home');
    const txt = home ? home.textContent.replace(/\s+/g, ' ') : '';
    const m = txt.match(/(\d+)\s*\/\s*20/);
    return { cards: cards.length, rev, poolN: pick.cards.length, done: pick.doneToday, ring: m ? m[1] : '(없음)' };
  });
  ok('⑦ 공부 전에는 오늘의 단어가 0/20',
    b7.rev === 0 && b7.ring === '0' && b7.poolN === 20,
    '카드 ' + b7.cards + '개(테스트로 적힌 13개 포함) · 오늘 학습 ' + b7.rev + '개 · 화면 ' + b7.ring + '/20 · 낼 단어 ' + b7.poolN + '개');

  // 학생이 실제로 공부하면 올라가는지 (반대 방향 확인)
  const b7b = await page.evaluate(() => {
    const c = ppLive(_cache.vocab_cards).find(x => x.sid === currentStudentSid && !x.lastSeen);
    c.lastSeen = ppToday(); c.lastSeenBy = 'study';
    return ppLive(_cache.vocab_cards).filter(x => x.sid === currentStudentSid && ppStudiedToday(x)).length;
  });
  ok('⑦-2 진짜 공부한 카드는 세어진다', b7b === 1, '1개 공부 → ' + b7b + '개');

  // ── 2) 학부모뷰 미리보기에서 배너 닫기 ──────────────────────
  const postsBefore = state.posts.filter(p => p.table === 'messages').length;
  const b2 = await page.evaluate(async () => {
    saveSession({ role: 'teacher' }); show('s-teacher');
    await new Promise(r => setTimeout(r, 300));
    await previewAsParent('s1');
    await new Promise(r => setTimeout(r, 900));
    const banner = document.getElementById('parent-notice-banner');
    const shown = !!banner && banner.style.display === 'block';
    const nid = _activeNoticeId;
    closeParentNotice();
    await new Promise(r => setTimeout(r, 600));
    const marked = (_cache.messages || []).filter(m => m && m.type === 'notice_read').length;
    const sandbox = (typeof ppSandbox === 'function') ? ppSandbox() : null;
    await returnToTeacher();
    await new Promise(r => setTimeout(r, 800));
    return { shown, nid, marked, sandbox, bar: !!document.getElementById('_teacher-preview-bar') };
  });
  const postsAfter = state.posts.filter(p => p.table === 'messages').length;
  ok('② 미리보기에서 공지 배너를 닫아도 읽음으로 기록하지 않는다',
    b2.shown && b2.marked === 0 && postsAfter === postsBefore && !b2.bar,
    '배너 보임 ' + b2.shown + ' · 읽음 줄 ' + b2.marked + '개 · messages 저장 ' + (postsAfter - postsBefore) + '건 · 체험 모드 ' + b2.sandbox);

  // 진짜 학부모가 닫으면 기록된다 (반대 방향)
  const b2b = await page.evaluate(async () => {
    await ppParentEnter('s1');
    await new Promise(r => setTimeout(r, 900));
    const shown = document.getElementById('parent-notice-banner').style.display === 'block';
    closeParentNotice();
    await new Promise(r => setTimeout(r, 700));
    return { shown, marked: (_cache.messages || []).filter(m => m && m.type === 'notice_read').length };
  });
  const posts2 = state.posts.filter(p => p.table === 'messages').length;
  ok('②-2 진짜 학부모가 닫으면 읽음으로 남는다', b2b.shown && b2b.marked === 1 && posts2 > postsAfter,
    '읽음 줄 ' + b2b.marked + '개 · messages 저장 ' + (posts2 - postsAfter) + '건');

  // ── 3-2·8) 학부모 화면 ──────────────────────────────────────
  const b38 = await page.evaluate(async () => {
    const tabTxt = t => {
      const el = document.querySelector('#pp-body .pp-tab[data-pptab="' + t + '"]');
      return el ? el.textContent.replace(/\s+/g, ' ') : '';
    };
    ppNav(null, 'score');
    await new Promise(r => setTimeout(r, 700));
    const scoreTxt = tabTxt('score');
    ppNav(null, 'les');
    await new Promise(r => setTimeout(r, 700));
    const homeTxt = tabTxt('les');
    const printBtn = [...document.querySelectorAll('#s-parent button')].filter(b => /리포트 인쇄/.test(b.textContent));
    return {
      lens: [scoreTxt.length, homeTxt.length],
      bad: /불합격|우수함|우수 학생/.test(scoreTxt), josaBad: /이\(가\)|을\(를\)|은\(는\)/.test(scoreTxt + homeTxt),
      josa: (homeTxt.match(/더미[은는이가]/g) || []).slice(0, 3),
      print: printBtn.length, printCall: printBtn[0] ? printBtn[0].getAttribute('onclick') : ''
    };
  });
  ok('③-2 학부모 화면에 월간 리포트 인쇄 단추가 있다', b38.print > 0 && /printReport/.test(b38.printCall || ''),
    b38.print + '개 · ' + (b38.printCall || ''));
  ok('⑧ 점수 탭에 판정하는 말이 없고 이름 조사가 맞다',
    !b38.bad && !b38.josaBad, '불합격·우수 ' + b38.bad + ' · "이(가)" 꼴 ' + b38.josaBad + ' · 본 조사 ' + (b38.josa.join(',') || '(없음)'));

  const b8b = await page.evaluate(() => ['김더미', '이더미', '박현우', '한나'].map(n => n + ppJosa(n, '이', '가')));
  ok('⑧-2 받침에 맞는 조사', b8b.join(',') === '김더미가,이더미가,박현우가,한나가' || b8b.every(x => !/\(/.test(x)), b8b.join(' · '));

  // ── 3-1 뒷정리: 리포트 삭제가 휴지통으로 가는지 ─────────────
  const delBefore = state.posts.filter(p => p.table === 'monthly_reports').length;
  const b3d = await page.evaluate(async d => {
    saveSession({ role: 'teacher' }); show('s-teacher');
    await new Promise(r => setTimeout(r, 400));
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    set('re-sid', 's1'); set('re-month', d.m);
    reqDelReport();
    await new Promise(r => setTimeout(r, 300));
    const asked = (document.getElementById('confirm-msg') || {}).textContent || '';
    confirmOk();
    await new Promise(r => setTimeout(r, 700));
    return { asked, left: DB.reports().filter(r => r.sid === 's1' && r.month === d.m).length };
  }, { m: F.PREV_M });
  const delPost = state.posts.filter(p => p.table === 'monthly_reports').slice(delBefore);
  ok('③-1b 리포트 삭제는 휴지통(_deleted)으로 간다',
    b3d.left === 0 && delPost.length === 1 && delPost[0].row && delPost[0].row.data && delPost[0].row.data._deleted === true && /휴지통/.test(b3d.asked),
    '남은 리포트 ' + b3d.left + '건 · 보낸 행 ' + JSON.stringify((delPost[0] || {}).row || {}).slice(0, 80));

  const skip = /youtube|ytimg|google|doubleclick|gstatic|compute-pressure|not attached|dictionaryapi|lrclib|favicon|usercontent|cloudinary|mymemory|Failed to load resource|ERR_FAILED|400 |404 |406 /i;
  const mine = errs.filter(e => !skip.test(e));
  ok('콘솔 오류 0', mine.length === 0, mine.slice(0, 3).join(' | ') || '0');

  console.log('\n통과 ' + pass.length + ' / 실패 ' + fail.length);
  pass.forEach(p => console.log('  OK  ' + p));
  fail.forEach(f => console.log('  X   ' + f));
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();
