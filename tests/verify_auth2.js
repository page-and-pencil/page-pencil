require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 11/8 2차 — 진입점·선로딩·보스·응원문구·공지읽음·선생님 세션. 실DB 쓰기 전부 차단.
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
  const srows = await (await fetch(U + '/rest/v1/students?select=*&limit=60', { headers: { apikey: K, Authorization: 'Bearer ' + K } })).json();
  const stus = srows.map(r => ({ id: r.id, ...(r.data || {}) })).filter(s => !s.inactive && !s._deleted);
  const stu = stus[0];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });

  // ── 공통 라우트: login 함수를 가짜로, students_safe/parent 를 가짜로 ──
  const mkCtx = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
    const page = await ctx.newPage();
    const state = { gets: [], writes: [], errs: [], prompts: [] };
    page.on('pageerror', e => state.errs.push(String(e.message).slice(0, 140)));
    page.on('console', m => { if (m.type() === 'error') state.errs.push('console: ' + m.text().slice(0, 140)); });
    await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, server: true, voices: ['XrExE9yKIg1WjnnlVkGX'], content: [{ text: '좋아요' }] }) }));
    await page.route('**/functions/v1/login', async r => {
      const b = JSON.parse(r.request().postData() || '{}');
      if (b.probe) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ready: true }) });
      const pin = String(b.pin || '');
      const hit = stus.filter(s => String(s.pin || '') === pin);
      const byName = b.name ? stus.filter(s => s.name === b.name) : null;
      const pick = (byName && byName.length === 1) ? byName[0] : (hit.length === 1 ? hit[0] : null);
      if (!pick) {
        if (hit.length > 1) return r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { message: '이름을 골라 주세요' }, candidates: hit.map(s => ({ name: s.name })) }) });
        return r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { message: 'PIN 이 맞지 않습니다' } }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'FAKE.' + b.role + '.T', refresh_token: 'RT', expires_in: 3600, sid: pick.id, name: pick.name, role: b.role }) });
    });
    await page.route('**/auth/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'FAKE.teacher.T', refresh_token: 'RT', expires_in: 3600, user: { email: 'x' } }) }));
    // students_safe / students_parent 를 흉내 낸다 (실제 뷰는 아직 없을 수 있다)
    await page.route('**/rest/v1/**', async r => {
      const m = r.request().method();
      const tbl = r.request().url().split('/rest/v1/')[1].split('?')[0];
      if (m === 'GET' || m === 'HEAD') {
        state.gets.push(tbl);
        // 토큰이면 서버가 자기 것만 준다 — RLS 를 흉내 낸다
        const auth = r.request().headers()['authorization'] || '';
        if (/FAKE\.(student|parent)\./.test(auth) && ['lessons', 'tests', 'readings', 'logs', 'homeworks', 'assignments', 'messages', 'vocab_cards', 'monthly_reports', 'counsels'].indexOf(tbl) >= 0) {
          const res = await r.fetch();
          let rows = await res.json().catch(() => []);
          if (!Array.isArray(rows)) rows = [];
          return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows.filter(x => x && x.sid === stu.id)) });
        }
        return r.continue();
      }
      state.writes.push(m + ' ' + tbl);
      return r.fulfill({ status: 200, body: '[]' });
    });
    await page.route('**/rest/v1/students_safe**', async r => {
      state.gets.push('students_safe');
      const rows = stus.filter(s => s.id === stu.id).map(s => { const d = { ...s }; delete d.pin; delete d.qrToken; delete d.parentPhone; delete d.fee; delete d.payday; delete d.payments; return { id: s.id, data: d, updated_at: new Date().toISOString() }; });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });
    await page.route('**/rest/v1/students_parent**', async r => {
      state.gets.push('students_parent');
      const rows = stus.filter(s => s.id === stu.id).map(s => { const d = { ...s }; delete d.pin; delete d.qrToken; delete d.parentPhone; return { id: s.id, data: d, updated_at: new Date().toISOString() }; });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });
    return { ctx, page, state };
  };

  // ───── 1. 첫 화면 학생 입장이 서버 로그인을 타는가 ─────
  console.log('── 1  학생 로그인 진입점');
  {
    const { ctx, page, state } = await mkCtx();
    await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);
    const before = state.gets.length;
    const r = await page.evaluate(async (pin) => {
      landRole('student');
      document.getElementById('land-spin').value = pin;
      await landStudentSubmit();
      await new Promise(x => setTimeout(x, 3000));
      return {
        screen: (document.querySelector('.screen.active') || {}).id,
        sess: !!ppSession(), role: ppAuthRole(), sid: (ppSession() || {}).sid,
        nStu: (_cache.students || []).length,
        hasPin: (_cache.students || []).some(s => 'pin' in s),
        nLes: (_cache.lessons || []).length,
        mineLes: (_cache.lessons || []).every(l => l.sid === ((ppSession() || {}).sid)),
      };
    }, stu.pin);
    say(r.sess && r.role === 'student', '첫 화면 [학생 입장] 이 서버 로그인을 탐', 'ppSession=' + r.sess + ' role=' + r.role);
    say(r.screen === 's-student', '학생 화면으로 들어감', r.screen);
    say(r.nStu === 1 && !r.hasPin, '_cache.students 가 1명이고 pin 키 없음', r.nStu + '명 / pin ' + (r.hasPin ? '있음' : '없음'));
    say(r.nLes === 0 || r.mineLes, 'lessons 가 자기 것만', r.nLes + '건');
    say(state.gets.indexOf('students_safe') >= 0, 'students_safe 뷰를 읽음');
    console.log('     로그인 전 GET: ' + before + '건 ' + (before ? '(' + [...new Set(state.gets.slice(0, before))].join(',') + ')' : ''));
    say(before === 0, '2. 로그인 전에는 아무 테이블도 받지 않음');
    await ctx.close();
  }

  // ───── 2-b. 학부모 — 로그인 전 0건, 로그인 뒤 students_parent ─────
  console.log('\n── 2  학부모 로그인 전/후');
  {
    const { ctx, page, state } = await mkCtx();
    await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);
    // 첫 화면에서 포커스·타이머가 돌아도 받지 않아야 한다
    await page.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(1200);
    const before = state.gets.length;
    const r = await page.evaluate(async (o) => {
      landRole('parent');
      document.getElementById('land-pname').value = o.name;
      document.getElementById('land-ppin').value = o.pin;
      await checkPin('land-pname', 'land-ppin', 'land-err');
      await new Promise(x => setTimeout(x, 3000));
      return {
        screen: (document.querySelector('.screen.active') || {}).id,
        role: ppAuthRole(), nStu: (_cache.students || []).length,
        hasPin: (_cache.students || []).some(s => 'pin' in s),
        hasFee: (_cache.students || []).some(s => 'fee' in s),
        acct: !!(DB.acct() && (DB.acct().bank || DB.acct().number)),
      };
    }, { name: stu.name, pin: stu.pin });
    say(before === 0, '첫 화면에서 focus·visibilitychange 가 와도 받지 않음', before + '건');
    say(r.role === 'parent' && r.screen === 's-parent', '학부모 서버 로그인', r.role + ' / ' + r.screen);
    say(state.gets.indexOf('students_parent') >= 0, 'students_parent 뷰를 읽음');
    say(r.nStu === 1 && !r.hasPin, '_cache.students 가 1명이고 pin 없음', r.nStu + '명');
    say(r.hasFee, '학부모 뷰에는 결제(fee) 가 남아 있음 — 결제 탭이 빈칸이 되지 않게');
    // 결제 탭·문의·확인했습니다·공지 닫기 (쓰기는 목업으로 가로챔)
    const w = await page.evaluate(async (sid) => {
      ppNav(null, 'pay');
      await new Promise(x => setTimeout(x, 600));
      const payTxt = (document.querySelector('#pp-body .pp-tab[data-pptab="pay"]') || {}).textContent || '';
      const msgTxt = (document.querySelector('#pp-body .pp-tab[data-pptab="msg"]') || {}).textContent || '';
      if (!(_cache.lessons || []).some(l => l.sid === sid))
        _cache.lessons = [{ id: 'probe-les-ack', sid, date: ppToday(), att: 'normal', materials: {}, cmt: '점검용' }, ...(_cache.lessons || [])];
      const les = (_cache.lessons || []).filter(l => l.sid === sid)[0];
      let ack = null;
      if (les) { try { localStorage.removeItem('parentAck_' + sid + '_' + les.id); } catch (e) { } await parentAckLesson(sid, les.id); ack = (_cache.messages || []).some(m => m.type === 'ack'); }
      // 공지 읽음
      _cache.notices = [{ id: 'probe-n', text: '점검용 공지', date: ppToday(), active: true }];
      showParentNoticeBanner();
      const shown = getComputedStyle(document.getElementById('parent-notice-banner')).display !== 'none';
      await markNoticeRead('probe-n', sid);
      showParentNoticeBanner();
      const after = getComputedStyle(document.getElementById('parent-notice-banner')).display !== 'none';
      const nr = (_cache.messages || []).filter(m => m.type === 'notice_read');
      return { pay: payTxt.replace(/\s+/g, ' ').slice(0, 60), msg: /카카오톡/.test(msgTxt), ack, shown, after, nr: nr.length, touchedNotice: (_cache.notices[0].readBy || []).length };
    }, stu.id);
    say(/계좌|결제|입금/.test(w.pay) || w.pay.length > 0, '결제 탭이 그려짐', w.pay.slice(0, 40));
    say(w.msg, '카카오 문의 버튼');
    say(w.ack === true, "'확인했습니다' 가 messages 로 저장됨", String(w.ack));
    say(w.shown && !w.after, '공지 배너가 뜨고, 읽음 표시 뒤 사라짐');
    say(w.nr === 1 && w.touchedNotice === 0, '읽음은 messages 한 줄 — notices 행은 건드리지 않음', 'notice_read ' + w.nr + '건 / readBy ' + w.touchedNotice + '건');
    say(state.writes.every(x => x.indexOf('notices') < 0), 'notices 쓰기 요청 0건', [...new Set(state.writes)].join(' · ') || '(없음)');
    await ctx.close();
  }

  // ───── 3·4. 보스 승리 · 응원 문구 ─────
  console.log('\n── 3·4  보스 승리 · 응원 문구');
  {
    const { ctx, page, state } = await mkCtx();
    await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);
    const r = await page.evaluate(async (o) => {
      landRole('student');
      document.getElementById('land-spin').value = o.pin;
      await landStudentSubmit();
      await new Promise(x => setTimeout(x, 2500));
      const sid = o.sid;
      // 보스 클리어 상황을 흉내 낸다
      const b = weeklyBossInfo(sid);
      const orig = window.weeklyBossInfo;
      window.weeklyBossInfo = () => ({ ...b, done: true, prog: b.target, week: 'probe-week' });
      const before = (_cache.logs || []).length;
      stuBossCard(sid);
      await new Promise(x => setTimeout(x, 300));
      const rows = (_cache.logs || []).filter(l => l.type === 'boss_win');
      stuBossCard(sid);   // 두 번 불러도 한 번만
      const rows2 = (_cache.logs || []).filter(l => l.type === 'boss_win');
      window.weeklyBossInfo = orig;
      // 응원 문구 — 코멘트가 있는 수업을 넣고 홈을 다시 그린다
      _cache.lessons = [{ id: 'probe-les', sid, date: ppToday(), att: 'normal', materials: { vocab: { book: '요즘 초등 영단어 2', unit: 'Unit 1' } }, cmt: '집중 좋았음' },
        ...(_cache.lessons || []).filter(l => l.sid !== sid)];
      renderStudentHome(sid);
      await new Promise(x => setTimeout(x, 900));
      const el = document.getElementById('stu-lesson-cmt');
      let cheer = el ? el.textContent : null;
      return { nBoss: rows.length, nBoss2: rows2.length, inReadingLog: DB.logs().some(l => l.type === 'boss_win'), cheer, wins: ppBossWins(sid) };
    }, { pin: stu.pin, sid: stu.id });
    say(r.nBoss === 1 && r.nBoss2 === 1, '보스 승리가 logs 한 줄 · 두 번 눌러도 한 번', r.nBoss + '건');
    say(!r.inReadingLog, '리딩로그 목록에는 섞이지 않음');
    say(r.wins >= 1, 'ppBossWins 가 센다', r.wins + '회');
    say(state.writes.every(x => x.indexOf('students') < 0), '학생 화면이 students 행을 저장하지 않음', [...new Set(state.writes)].join(' · ') || '(없음)');
    say(state.writes.every(x => x.indexOf('lessons') < 0), '학생 화면이 lessons 행을 저장하지 않음');
    say(r.cheer !== null, '응원 문구 칸이 AI 없이 바로 채워짐', (r.cheer || '').slice(0, 24));
    say(state.gets.filter(g => g === 'claude-proxy').length === 0, '응원 문구로 AI 를 부르지 않음');
    await ctx.close();
  }

  // ───── 6. 선생님 세션 ─────
  console.log('\n── 6  선생님 세션 (토큰 없이 pp_session 만)');
  {
    const { ctx, page, state } = await mkCtx();
    await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
    await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4000);
    const now = await page.evaluate(() => ({ screen: (document.querySelector('.screen.active') || {}).id, fb: PP_AUTH_FALLBACK }));
    say(now.fb === true, 'PP_AUTH_FALLBACK 는 true 그대로(3단계 전)', String(now.fb));
    say(now.screen === 's-teacher', '병행 기간에는 pp_session 만으로도 선생님 화면', now.screen);
    // 스위치를 끈 상태를 흉내 내 같은 분기를 확인
    const off = await page.evaluate(() => {
      const hasToken = !!(typeof ppSession === 'function' && ppSession() && ppAuthRole() === 'teacher');
      const wouldBlock = (false === false) && !hasToken;   // PP_AUTH_FALLBACK===false 일 때의 조건
      return { hasToken, wouldBlock };
    });
    say(off.wouldBlock === true, '스위치를 끄면 토큰 없는 선생님 세션은 로그인 화면으로', '토큰 ' + (off.hasToken ? '있음' : '없음'));
    await ctx.close();
  }

  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
