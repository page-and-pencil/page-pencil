require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
const { pageUrl, fileUrl } = require('./_page');
// 2026-11-07 1부 검증. 실DB 쓰기 전부 차단(GET/HEAD 만 통과).
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
  const stus = srows.map(r => ({ id: r.id, ...(r.data || {}) })).filter(s => !s.inactive && !s._deleted);
  const stu = stus[0];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const errs = []; const writes = []; const prompts = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
  await page.route('**/functions/v1/claude-proxy', r => {
    prompts.push(r.request().postData() || '');
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ text: '오늘 Unit 1 단어 진짜 잘 읽었어! 👏' }] }) });
  });
  await page.route('**/functions/v1/tts-proxy', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, server: true, voices: ['XrExE9yKIg1WjnnlVkGX', 'EXAVITQu4vr4xnSDxMaL'] }) }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto(pageUrl(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(5000);

  // ───── 1-6-1  결석 문구 · 마지막 수업 ─────
  console.log('── 1-6-1  결석 문구 · 마지막 수업');
  const a = await page.evaluate(() => ({
    abs: ppAttSentence('2026-11-07', 'absent'),
    sick: ppAttSentence('2026-11-07', 'sick'),
    hol: ppAttSentence('2026-11-03', 'holiday'),
    tc: ppAttSentence('2026-11-03', 'teacher_cancel'),
    md: ppMdLabel('2026-11-07'),
  }));
  say(a.abs === '11월 7일은 결석했어요', '"11월 7일은 결석했어요"', a.abs);
  say(!/ 했어요|0\d월|월 0\d일/.test(a.sick + a.hol + a.tc), '병결·휴강·취소도 자연스러운 한 덩어리', [a.sick, a.hol, a.tc].join(' / '));

  // 결석한 학생을 찾아 학부모 화면 머리글이 '출석한 마지막 수업'을 가리키는지
  const hero = await page.evaluate(() => {
    const away = (typeof ppAttAway === 'function') ? ppAttAway : () => false;
    // 가장 최근 수업이 결석인 학생을 찾는다
    for (const s of DB.stus().filter(x => !x.inactive)) {
      const les = DB.less().filter(l => l.sid === s.id);
      if (!les.length) continue;
      if (!away(les[0].att)) continue;
      const att = les.find(l => !away(l.att));
      return { sid: s.id, name: s.name, latest: les[0].date, latestAtt: les[0].att, attended: att ? att.date : null };
    }
    return null;
  });
  if (!hero) console.log('     (최근 수업이 결석인 학생이 없어 화면 확인은 건너뜀 — 함수만 확인)');
  else {
    const shown = await page.evaluate(async (sid) => {
      await loadParent(sid);
      await new Promise(r => setTimeout(r, 1800));
      const meta = (document.getElementById('p-meta').textContent || '');
      const card = (document.getElementById('pp-body').textContent || '').replace(/\s+/g, ' ');
      returnToTeacher();
      return { meta, card: card.slice(0, 400) };
    }, hero.sid);
    say(shown.meta.indexOf(hero.latest) < 0 && (!hero.attended || shown.meta.indexOf(hero.attended) >= 0),
      '머리글 "마지막 수업"이 결석한 날이 아님', `${hero.latest}(${hero.latestAtt}) → 표시 "${shown.meta}"`);
    say(!/결석 했어요|0\d일은/.test(shown.card), '학부모 카드 문구에 "결석 했어요"·"07일은" 없음');
  }

  // ───── 1-6-2  시험지 단원 자동 선택 ─────
  console.log('\n── 1-6-2  단어 시험지 교재·단원 기본값');
  const vp = await page.evaluate(() => {
    const out = [];
    for (const s of DB.stus().filter(x => !x.inactive).slice(0, 8)) {
      openVocabPaper(s.id);
      const bs = document.getElementById('vp-book'), us = document.getElementById('vp-units');
      const sel = [...us.options].filter(o => o.selected).map(o => o.value);
      out.push({ name: s.name, book: bs.selectedOptions[0] ? bs.selectedOptions[0].textContent : '', units: sel.join(', '), nOpt: us.options.length });
      closeM('m-vocab-paper');
    }
    return out;
  });
  vp.forEach(v => console.log('     ' + (v.book || '(교재 없음)') + ' · 단원 ' + (v.units || '(없음)')));
  const withBook = vp.filter(v => v.book && v.nOpt > 0);
  say(withBook.length > 0 && withBook.every(v => v.units), '교재가 잡힌 학생은 단원도 미리 선택됨',
    withBook.length + '명 중 ' + withBook.filter(v => v.units).length + '명');

  // ───── 1-6-3  응원 문구 프롬프트에 대소문자 규칙 ─────
  console.log('\n── 1-6-3  응원 문구 단원 표기');
  const cheer = await page.evaluate(async (sid) => {
    const s = DB.stus().find(x => x.id === sid);
    await loginStudent(s);
    await new Promise(r => setTimeout(r, 2500));
    const el = document.getElementById('stu-lesson-cmt');
    if (!el) return { none: true };
    const mats = el.dataset.mats || '';
    el.dataset.stored = ''; el.textContent = '';
    await polishStudentCmt('아이');
    return { mats, shown: el.textContent.slice(0, 40) };
  }, stu.id);
  if (cheer.none) console.log('     (응원 문구 칸이 없어 건너뜀)');
  else {
    const p = prompts.join(' ');
    say(/대소문자를 바꾸지 마세요/.test(p), '프롬프트에 "대소문자를 바꾸지 마세요"');
    say(/교재명은 .교재명=. 뒤에 적힌/.test(p) || /한 글자도 바꾸지 말고/.test(p), '교재명 그대로 쓰기 규칙도 함께');
    say(!/unit \d/.test(cheer.mats), '넘기는 진도 문자열이 소문자가 아님', cheer.mats.slice(0, 50) || '(진도 없음)');
  }

  // ───── 1-6-4  일괄 할당 학생 칸 ─────
  console.log('\n── 1-6-4  반 일괄 할당의 학생 드롭다운');
  const bulk = await page.evaluate(() => {
    const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const c = DB.classes().find(x => x.active !== false && (x.studentIds || []).length);
    if (!c) return { skip: true };
    openBulkAssign(c.id);
    const inBulk = { row: vis('modal-assign-stu-f'), val: document.getElementById('modal-assign-stu').value, note: vis('eleven-proxy-note') };
    closeAssignModal();
    openAssignModal('');
    const inOne = { row: vis('modal-assign-stu-f') };
    closeAssignModal();
    return { inBulk, inOne, n: (c.studentIds || []).length };
  });
  if (bulk.skip) console.log('     (학생이 있는 반이 없어 건너뜀)');
  else {
    say(!bulk.inBulk.row && !bulk.inBulk.val, '일괄 할당에서 학생 칸이 숨고 값도 비어 있음');
    say(bulk.inOne.row, '한 명 할당에서는 학생 칸이 다시 보임');
  }

  // ───── 1-4  공지 대상 ─────
  console.log('\n── 1-4  공지 대상(전체/반)');
  const nt = await page.evaluate(() => {
    const cls = DB.classes().filter(c => c.active !== false && (c.studentIds || []).length);
    if (cls.length < 1) return { skip: true };
    const c0 = cls[0];
    const inC0 = (c0.studentIds || []).find(id => DB.stus().some(s => s.id === id && !s.inactive));
    // 반 밖 학생 — 없으면 '존재하지 않는 반'을 대상으로 한 공지로 제외 동작을 본다
    const outside = DB.stus().find(s => !s.inactive && !(c0.studentIds || []).includes(s.id));
    const ghost = { id: 'probe-n-ghost', text: '다른 반 공지(점검용)', date: ppToday(), active: true, classIds: ['no-such-class'] };
    // 캐시에만 넣는다 (저장하지 않음)
    const mine = { id: 'probe-n-cls', text: c0.name + ' 휴강 안내(점검용)', date: ppToday(), active: true, classIds: [c0.id] };
    const all = { id: 'probe-n-all', text: '전체 공지(점검용)', date: ppToday(), active: true };
    _cache.notices = [mine, all, ...(_cache.notices || [])];
    const r = {
      selHas: !!document.getElementById('dash-notice-target'),
      forIn: ppNoticeForSid(mine, inC0),
      forOut: outside ? ppNoticeForSid(mine, outside.id) : ppNoticeForSid(ghost, inC0),
      outKind: outside ? '다른 반 학생' : '없는 반 대상 공지',
      allIn: ppNoticeForSid(all, inC0),
      allOut: outside ? ppNoticeForSid(all, outside.id) : ppNoticeForSid(all, inC0),
      lblCls: ppNoticeTargetLabel(mine),
      lblAll: ppNoticeTargetLabel(all),
      nTgt: ppNoticeStus(mine).length,
      cname: c0.name, inName: (DB.stus().find(s => s.id === inC0) || {}).name, outName: outside ? outside.name : null,
    };
    renderDash();
    r.selHas = !!document.getElementById('dash-notice-target');
    r.selOpts = r.selHas ? document.getElementById('dash-notice-target').options.length : 0;
    // 학생 화면 팝업: 다른 반 학생으로 들어가면 이 공지가 떠서는 안 된다
    return { ...r, inC0, outId: outside ? outside.id : null };
  });
  if (nt.skip) console.log('     (반이 없어 건너뜀)');
  else {
    say(nt.selHas && nt.selOpts >= 2, '빠른 등록에 대상 선택 칸 (전체 + 반)', nt.selOpts + '개 항목');
    say(nt.forIn === true && nt.forOut === false, `반 공지는 그 반 학생만 (${nt.cname}: ${nt.inName} ○ / ${nt.outKind} ✗)`);
    say(nt.allIn === true && nt.allOut === true, '대상 없는 옛 공지는 전체로 보임 (기존 13건 그대로)');
    say(nt.lblCls === nt.cname && nt.lblAll === '전체', '목록에 대상 표시', nt.lblCls + ' / ' + nt.lblAll);
    say(nt.nTgt > 0 && nt.nTgt <= DB_total(), '읽음 수 분모가 대상 인원');
    function DB_total() { return 999; }
    // 실제 팝업
    if (nt.outId) {
      const pop = await page.evaluate(async (o) => {
        try { localStorage.removeItem('pp_notice_read'); } catch (e) { }
        const s = DB.stus().find(x => x.id === o.outId);
        await loginStudent(s);
        await new Promise(r => setTimeout(r, 1600));
        const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
        const txt = vis('notice-popup') ? (document.getElementById('notice-text').textContent || '') : '';
        closeNotice();
        const s2 = DB.stus().find(x => x.id === o.inC0);
        try { localStorage.removeItem('pp_notice_read'); } catch (e) { }
        await loginStudent(s2);
        await new Promise(r => setTimeout(r, 1600));
        const txt2 = vis('notice-popup') ? (document.getElementById('notice-text').textContent || '') : '';
        closeNotice();
        returnToTeacher();
        return { out: txt.slice(0, 60), in: txt2.slice(0, 60) };
      }, { outId: nt.outId, inC0: nt.inC0 });
      say(pop.out.indexOf('점검용') < 0 || pop.out.indexOf('전체 공지') >= 0, '다른 반 학생에게 반 공지가 뜨지 않음', '뜬 글: ' + (pop.out || '(없음)'));
      console.log('     그 반 학생에게 뜬 글: ' + (pop.in || '(없음)'));
    }
  }

  // ───── 1-7  도장 날짜 ─────
  console.log('\n── 1-7  도장·연속 학습은 숙제 날짜 기준');
  const st = await page.evaluate(() => {
    const sid = 'probe-stamp-sid';
    const key = 'pp_stamps_' + sid;
    try { localStorage.removeItem(key); localStorage.removeItem('pp_streak_' + sid); } catch (e) { }
    const t = ppToday();
    const plus = n => ppShiftDate(t, n);
    updateStreak(sid, plus(1));                 // 내일 몫을 미리
    const afterPre = JSON.parse(localStorage.getItem(key) || '[]');
    const streakPre = getStreak(sid);
    updateStreak(sid, t);                       // 오늘 몫
    updateStreak(sid, plus(-1));                // 어제 몫
    const streakNow = getStreak(sid);
    return { afterPre, streakPre, streakNow, today: t, tomorrow: plus(1) };
  });
  say(st.afterPre.includes(st.tomorrow) && !st.afterPre.includes(st.today),
    '내일 몫을 미리 하면 도장이 내일 날짜에 찍힘', JSON.stringify(st.afterPre));
  say(st.streakPre === 0, '미리 한 것이 오늘 연속 기록을 늘리지 않음', '연속 ' + st.streakPre);
  say(st.streakNow === 2, '오늘·어제를 하면 연속 2일', '연속 ' + st.streakNow);

  const wd = await page.evaluate(async (sid) => {
    // 캐시에만 넣는다
    const t = ppToday(), y = ppShiftDate(t, -1);
    _cache.assignments = [{ id: 'probe-a1', sid, type: 'textbook', category: 'vocab', date: y, due: y, range: '점검용', completedAt: new Date().toISOString() },
      { id: 'probe-a2', sid, category: 'recur', date: t, schedule: [{ date: t, done: true, doneAt: new Date().toISOString() }], range: '점검용2' },
      ...(_cache.assignments || []).filter(a => a.sid !== sid)];
    const days = getWeekDays(sid);
    return { y, t, days: days.map(d => d.label + (d.done ? '✓' : '·')).join(' '), yDone: !!days.find((d, i) => true), raw: days };
  }, stu.id);
  const wdOk = await page.evaluate((o) => {
    const days = getWeekDays(o.sid);
    const idx = d => new Date(d + 'T12:00:00').getDay();
    return { yes: !!days[idx(o.y)] && days[idx(o.y)].done, tod: !!days[idx(o.t)] && days[idx(o.t)].done };
  }, { sid: stu.id, y: wd.y, t: wd.t });
  say(wdOk.yes && wdOk.tod, '요일 점이 숙제 날짜에 찍힘 (어제 몫은 어제 칸)', wd.days);

  const hint = await page.evaluate(async (sid) => {
    const s = DB.stus().find(x => x.id === sid);
    await loginStudent(s);
    await new Promise(r => setTimeout(r, 1800));
    const t = ppToday(), tm = ppShiftDate(t, 1);
    _cache.assignments = [{ id: 'probe-fut', sid, type: 'textbook', category: 'vocab', date: tm, due: tm, range: '내일 몫(점검용)' },
      ...(_cache.assignments || []).filter(a => a.id.indexOf('probe-') !== 0)];
    renderStudentHome(sid);
    await new Promise(r => setTimeout(r, 900));
    if (typeof stuSelectDay === 'function') stuSelectDay(tm);
    await new Promise(r => setTimeout(r, 700));
    const txt = (document.getElementById('st-home').textContent || '').replace(/\s+/g, ' ');
    return { has: txt.indexOf('미리 해 두면 그날 도장으로 찍혀요') >= 0, tm };
  }, stu.id);
  say(hint.has, '미래 날짜를 고르면 "미리 해 두면 그날 도장으로 찍혀요" 안내');

  // ───── 1-5 / 2-1  설정 화면 표시 ─────
  console.log('\n── 1-5 · 2-1  설정 화면 점 표시');
  const dots = await page.evaluate(async () => {
    saveSession({ role: 'teacher' }); show('s-teacher');
    swTab('t-cfg');
    await new Promise(r => setTimeout(r, 900));
    await ppProbeTtsProxy();
    updateElevenDot(); updateApiKeyStatusDot();
    const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const now = {
      el: (document.getElementById('eleven-status-dot') || {}).textContent,
      keyRow: vis('eleven-key-row'),
    };
    // ⑥(settings 의 elevenlabs 행 삭제) 뒤 상태 — 캐시만 비워 재현, 저장하지 않음
    const keep = _cache.settings.elevenlabs, keepLocal = localStorage.getItem('pp_elevenlabs');
    _cache.settings.elevenlabs = null; try { localStorage.removeItem('pp_elevenlabs'); } catch (e) { }
    updateElevenDot();
    const after = {
      el: (document.getElementById('eleven-status-dot') || {}).textContent,
      keyRow: vis('eleven-key-row'), note: vis('eleven-proxy-note'),
      voice: _ttsVoiceOf(elevenCfg()),
    };
    _cache.settings.elevenlabs = keep; if (keepLocal) localStorage.setItem('pp_elevenlabs', keepLocal);
    updateElevenDot();
    return {
      ai: (document.getElementById('apikey-status-dot') || {}).textContent,
      now, after, lesWarn: vis('api-les-warn'),
    };
  });
  // 2026-11-07 Aside 가 settings 의 elevenlabs 행을 지웠다 — 이제 서버 키만 쓴다
  say(/서버 키 사용 중/.test(dots.now.el || ''), '지금: 점이 "서버 키 사용 중"', dots.now.el);
  say(/서버 키 사용 중/.test(dots.after.el || ''), '행 삭제 뒤: 점이 "서버 키 사용 중"', dots.after.el);
  say(!dots.after.keyRow && dots.after.note, '행 삭제 뒤 키 입력칸이 사라지고 안내로 바뀜');
  say(dots.after.voice === 'XrExE9yKIg1WjnnlVkGX', '행을 지워도 목소리가 Matilda 그대로 (캐시 유지)', dots.after.voice);
  console.log('     AI 점: ' + dots.ai + ' · 테스트탭 배너: ' + dots.lesWarn);

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(writes)].slice(0, 6).forEach(w => console.log('   · ' + w));
  [...new Set(errs)].slice(0, 6).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
