require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// B-2 병행 로그인 검증. 실DB 쓰기 전부 차단. login 함수는 가짜로 응답한다.
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
  const page = await ctx.newPage();
  const errs = []; const writes = []; const seenAuth = [];
  let mode = 'off';              // off=함수 없음(404) | ok | bad=401 | many=409
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });

  await page.route('**/functions/v1/login', async r => {
    const b = JSON.parse(r.request().postData() || '{}');
    if (b.probe) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ready: true }) });
    if (mode === 'off') return r.fulfill({ status: 404, body: 'not found' });
    if (mode === 'bad') return r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { message: '이름 또는 PIN 이 맞지 않습니다' } }) });
    if (mode === 'many') return r.fulfill({
      status: 409, contentType: 'application/json',
      body: JSON.stringify({ error: { message: '같은 PIN 인 학생이 여럿입니다 — 이름을 골라 주세요' }, candidates: [{ name: '가더미' }, { name: '나더미' }] }),
    });
    return r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ access_token: 'FAKE.' + b.role + '.TOKEN', refresh_token: 'RT1', expires_in: 3600, sid: b.sid || global.__sid, name: global.__name, role: b.role }),
    });
  });
  await page.route('**/auth/v1/**', async r => {
    const u = r.request().url();
    if (u.indexOf('grant_type=password') >= 0) {
      const b = JSON.parse(r.request().postData() || '{}');
      if (mode !== 'ok') return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant' }) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'FAKE.teacher.TOKEN', refresh_token: 'RT-T', expires_in: 3600, user: { email: b.email } }) });
    }
    if (u.indexOf('grant_type=refresh_token') >= 0)
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'FAKE.refreshed.TOKEN', refresh_token: 'RT2', expires_in: 3600 }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/functions/v1/tts-proxy', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, server: true, voices: ['XrExE9yKIg1WjnnlVkGX'] }) }));
  await page.route('**/functions/v1/claude-proxy', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ text: '좋아요' }] }) }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    const auth = (r.request().headers()['authorization'] || '').slice(0, 24);
    seenAuth.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0] + ' | ' + auth);
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 200, body: '[]' });
  });

  global.__sid = stu.id; global.__name = stu.name;
  await page.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  await page.goto('file:///' + encodeURI(ROOT + '/index.html'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(4500);

  // ───── 헤더 ─────
  console.log('── B-2-1  요청 헤더');
  let h = await page.evaluate(() => ({ anon: ppHeaders().Authorization.slice(0, 14), spread: ({ ...SUPA_HEADERS }).Authorization.slice(0, 14) }));
  say(h.anon.indexOf(('Bearer ' + K.slice(0, 3))) === 0 && h.spread.indexOf(('Bearer ' + K.slice(0, 3))) === 0, '토큰이 없으면 공개 anon 키', h.anon);
  h = await page.evaluate(async () => {
    await ppLoginTeacher('x@y.z', 'nope');     // mode=off 라 실패
    return { after: ppHeaders().Authorization.slice(0, 14), sess: !!ppSession() };
  });
  say(!h.sess, '로그인 실패하면 세션이 생기지 않음');

  // ───── 선생님: Auth 성공 ─────
  console.log('\n── B-2-2  선생님 로그인');
  mode = 'ok';
  const t = await page.evaluate(async () => {
    const r = await ppLoginTeacher('jikgyeol@gmail.com', 'whatever');
    return {
      ok: !!r, token: ppAccessToken().slice(0, 14), role: ppAuthRole(),
      hdr: ppHeaders().Authorization.slice(0, 20), spread: ({ ...SUPA_HEADERS }).Authorization.slice(0, 20),
    };
  });
  say(t.ok && t.role === 'teacher', 'Auth 로그인 성공 → 세션 저장', t.role);
  say(t.hdr === 'Bearer FAKE.teacher.' && t.spread === 'Bearer FAKE.teacher.', '이후 모든 요청이 토큰으로 나감 (복사본 포함)', t.hdr);

  const row = await page.evaluate(async () => { swTab('t-cfg'); await new Promise(r => setTimeout(r, 700)); updateAuthModeRow(); return (document.getElementById('auth-mode-row').textContent || '').replace(/\s+/g, ' '); });
  say(/서버\(Supabase Auth\)/.test(row), 'B-2-7 설정 탭에 "로그인 방식: 서버"', row.slice(0, 50));

  // 401 이면 한 번 갱신하고 다시 보낸다
  let once = true;
  await page.route('**/rest/v1/probe401**', r => {
    if (once) { once = false; return r.fulfill({ status: 401, body: '{}' }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  const retry = await page.evaluate(async () => {
    const r = await ppFetch(SUPA_URL + '/rest/v1/probe401?select=id', { headers: SUPA_HEADERS });
    return { status: r.status, token: ppAccessToken().slice(0, 16) };
  });
  say(retry.status === 200 && retry.token === 'FAKE.refreshed.T', '401 이면 토큰을 갱신하고 한 번 더 보냄', retry.token);

  await page.evaluate(async () => { await ppLogout(); });
  say(await page.evaluate(() => !ppSession() && ppHeaders().Authorization.indexOf(('Bearer ' + K.slice(0, 3))) === 0), 'B-2-6 로그아웃하면 토큰 폐기 → 다시 anon');

  // ───── 학생 로그인 ─────
  console.log('\n── B-2-3  학생·학부모 로그인');
  const stuOk = await page.evaluate(async (o) => {
    saveSession({ role: 'teacher' }); show('s-land');
    landRole('student');
    pinInput = String(o.pin || '0000').split('');
    await checkStudentPin();
    await new Promise(r => setTimeout(r, 2000));
    return { screen: (document.querySelector('.screen.active') || {}).id, token: ppAccessToken().slice(0, 14), role: ppAuthRole(), sid: (ppSession() || {}).sid };
  }, { pin: stu.pin });
  say(stuOk.screen === 's-student' && stuOk.role === 'student', '학생: 서버 로그인으로 들어감', stuOk.screen + ' / ' + stuOk.role);
  say(stuOk.sid === stu.id, '세션에 그 학생 sid', stuOk.sid);
  // 학생 토큰이면 students_safe 를 읽는다
  const safeHit = await page.evaluate(async () => { seen = []; await loadAllData(true); return 1; }).catch(() => 0);
  await page.waitForTimeout(1500);
  say(seenAuth.some(x => x.indexOf('students_safe') >= 0), 'B-2-4 학생 토큰이면 students_safe 뷰를 읽음',
    (seenAuth.filter(x => x.indexOf('students') >= 0).slice(-1)[0] || ''));
  // 학부모 토큰이면 students_parent (결제 탭이 fee·payday·payments 를 쓴다)
  const parTbl = await page.evaluate(async () => {
    const keep = _ppAuth;
    _ppAuth = { ...(_ppAuth || {}), role: 'parent' };
    await loadAllData(true);
    _ppAuth = keep;
    return 1;
  }).then(() => seenAuth.filter(x => x.indexOf('students_parent') >= 0)[0] || '(없음)').catch(e => 'ERR ' + e.message);
  say(parTbl !== '(없음)', '학부모 토큰이면 students_parent 뷰를 읽음', parTbl);
  // 뷰가 아직 없으면(404) 원본으로 한 번 더 — 학생 화면이 비지 않게
  say(seenAuth.some(x => x.indexOf('GET students |') >= 0), '뷰가 없으면 students 원본으로 폴백',
    seenAuth.filter(x => x.indexOf('GET students |') >= 0).slice(-1)[0] || '');

  await page.evaluate(async () => { await ppLogout(); clearSession(); });

  // PIN 틀림(401)은 폴백하지 않는다
  mode = 'bad';
  const hard = await page.evaluate(async (o) => {
    show('s-land'); landRole('student');
    pinInput = String(o.pin || '0000').split('');
    await checkStudentPin();
    await new Promise(r => setTimeout(r, 1200));
    return { screen: (document.querySelector('.screen.active') || {}).id, err: (document.getElementById('stupin-err').textContent || '') };
  }, { pin: stu.pin });
  say(hard.screen !== 's-student' && /맞지 않/.test(hard.err), '서버가 "틀렸다"고 하면 옛 방식으로 넘어가지 않음', hard.err);

  // 같은 PIN 이 여럿(409) → 이름 고르기
  mode = 'many';
  const many = await page.evaluate(async (o) => {
    show('s-land'); landRole('student');
    pinInput = String(o.pin || '0000').split('');
    await checkStudentPin();
    await new Promise(r => setTimeout(r, 1000));
    const sel = document.getElementById('stupin-name-sel-val');
    return { shown: getComputedStyle(document.getElementById('stupin-name-sel')).display !== 'none', opts: [...sel.options].map(x => x.value).filter(Boolean) };
  }, { pin: stu.pin });
  say(many.shown && many.opts.join(',') === '가더미,나더미', '같은 PIN 이 여럿이면 이름 목록을 받아 고르게 함', many.opts.join(','));

  // 함수가 없으면(404) 옛 방식으로
  mode = 'off';
  const fb = await page.evaluate(async (o) => {
    window._ppLoginFnOff = false;
    show('s-land'); landRole('student');
    pinInput = String(o.pin || '0000').split('');
    await checkStudentPin();
    await new Promise(r => setTimeout(r, 2000));
    return { screen: (document.querySelector('.screen.active') || {}).id, sess: !!ppSession() };
  }, { pin: stu.pin });
  say(fb.screen === 's-student' && !fb.sess, '함수가 없으면 지금 방식으로 들어감(폴백)', fb.screen);

  // ───── QR 토큰 ─────
  console.log('\n── B-2-5  QR 토큰');
  const qr = await page.evaluate(async (sid) => {
    await ppLogout(); clearSession(); saveSession({ role: 'teacher' }); show('s-teacher');
    const s = DB.stus().find(x => x.id === sid);
    const had = s.qrToken; delete s.qrToken;
    swTab('t-cfg');
    await new Promise(r => setTimeout(r, 600));
    const sel = document.getElementById('qr-stu-sel'); if (sel) sel.value = sid;
    renderQRCode();
    await new Promise(r => setTimeout(r, 900));
    const txt1 = (document.getElementById('qr-result').textContent || '');
    const tok = (DB.stus().find(x => x.id === sid) || {}).qrToken || '';
    renderQRCode();
    const txt2 = (document.getElementById('qr-result').textContent || '');
    const link = (txt2.match(/https:\/\/\S+/) || [''])[0];
    if (had) s.qrToken = had; else delete s.qrToken;
    return { tok, len: tok.length, hasT: /\?t=/.test(txt2), noPin: link.indexOf('?pin=') < 0, link, note: /곧 막힙니다/.test(txt2), first: txt1.slice(0, 20), dump: txt2.replace(/\s+/g,' ').slice(0, 220) };
  }, stu.id);
  say(qr.len === 32, '토큰이 없으면 32자 무작위 토큰을 만들어 저장', qr.len + '자');
  say(qr.hasT && qr.noPin, '링크가 ?t=토큰 (PIN 이 주소에 없음)', qr.link);
  say(qr.note, '"옛 링크는 곧 막혀요" 안내');

  // 폴백 스위치
  const sw = await page.evaluate(() => PP_AUTH_FALLBACK);
  say(sw === true, 'B-3-2 폴백 스위치 PP_AUTH_FALLBACK 가 지금은 true(병행)', String(sw));

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(writes)].slice(0, 6).forEach(w => console.log('   · ' + w));
  [...new Set(errs)].slice(0, 6).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
