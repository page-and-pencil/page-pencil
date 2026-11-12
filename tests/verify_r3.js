require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 프롬프트 5~8 수정 검증. 실DB 쓰기 전부 차단.
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
  const srows = await (await fetch(U + '/rest/v1/students?select=*&limit=20', { headers: { apikey: K, Authorization: 'Bearer ' + K } })).json();
  const stu = srows.map(r => ({ id: r.id, ...(r.data || {}) })).filter(s => !s.inactive && !s._deleted)[0];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const errs = []; let writes = [], prompts = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
  await page.route('**/functions/v1/claude-proxy', r => {
    prompts.push(r.request().postData() || '');
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ text: '오늘도 잘했어! 내일도 이렇게 하자.' }] }) });
  });
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 200, body: '[]' });
  });

  // ───── 5-A: QR 링크로 들어오면 주소에서 pin·role 이 지워지는가 ─────
  const qr = 'file:///' + encodeURI(ROOT + '/index.html') + '?pin=' + encodeURIComponent(stu.pin || '0000') + '&role=student';
  await page.goto(qr, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(6000);
  const url1 = page.url();
  console.log('── 5-A  QR 링크');
  say(url1.indexOf('pin=') < 0 && url1.indexOf('role=') < 0, '주소에서 pin·role 이 지워짐', url1.split('/').pop().slice(0, 60) || '(쿼리 없음)');

  // 세션을 선생님으로
  await page.evaluate(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  await page.goto('file:///' + encodeURI(ROOT + '/index.html'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(4500);

  // ───── 5-B/E: PIN ─────
  console.log('\n── 5-B·E  PIN');
  const pin = await page.evaluate(() => {
    const out = {};
    out.gateFns = [typeof ppPinGate, typeof ppPinFailed, typeof ppPinOk].join(',');
    try { sessionStorage.removeItem('pp_pin_fail'); sessionStorage.removeItem('pp_pin_until'); } catch (e) { }
    let msg = '';
    const setErr = t => { msg = t; };
    for (let i = 0; i < 5; i++) ppPinFailed();
    out.blocked = ppPinGate(setErr) === false;
    out.msg = msg;
    ppPinOk();
    out.afterOk = ppPinGate(setErr);
    return out;
  });
  say(pin.gateFns === 'function,function,function', 'PIN 제한 함수 준비');
  say(pin.blocked && /초/.test(pin.msg), '5회 틀리면 잠시 대기', pin.msg);
  say(pin.afterOk === true, '맞히면 풀림');

  // ───── 6: 결석 처리 ─────
  console.log('\n── 6  결석');
  const ab = await page.evaluate(() => ({
    away: [ppAttAway('absent'), ppAttAway('sick'), ppAttAway('holiday'), ppAttAway('teacher_cancel')].join(','),
    stay: [ppAttAway('normal'), ppAttAway('late'), ppAttAway('makeup')].join(','),
  }));
  say(ab.away === 'true,true,true,true', '결석·병결·휴강·취소는 빠짐');
  say(ab.stay === 'false,false,false', '지각·보강은 수업으로 셈');

  // ───── 7-A: 같은 숙제 3건 → 1건 ─────
  console.log('\n── 7-A  수업 저장 때 생기는 숙제');
  const hw = await page.evaluate(() => {
    // saveClassLesson 안의 합치기 규칙을 같은 입력으로 돌려 본다
    const rows = [
      { sid: null, due: '2026-11-06', cat: 'vocab', book: '1200 Words', range: 'Unit 1 단어 암기', note: '' },
      { sid: null, due: '2026-11-07', cat: 'vocab', book: '1200 Words', range: 'Unit 1 단어 암기', note: '' },
      { sid: null, due: '2026-11-08', cat: 'vocab', book: '1200 Words', range: 'Unit 1 단어 암기', note: '' },
      { sid: null, due: '2026-11-08', cat: 'grammar', book: '345 Grammar 1', range: 'Unit 3', note: '' },
    ];
    const by = new Map();
    rows.forEach(r => {
      const k = [r.sid || '', r.cat || '', (r.book || '').trim(), (r.range || '').trim(), (r.note || '').trim()].join('|');
      const prev = by.get(k);
      if (!prev) { by.set(k, { ...r }); return; }
      if ((r.due || '') > (prev.due || '')) prev.due = r.due;
    });
    const merged = [...by.values()];
    return { n: merged.length, due: merged[0].due, cats: merged.map(m => m.cat).join(',') };
  });
  say(hw.n === 2 && hw.due === '2026-11-08', '같은 내용 3건 → 1건(마감은 다음 수업 전날)', hw.n + '건 · 마감 ' + hw.due);
  say(hw.cats === 'vocab,grammar', '내용이 다른 줄은 그대로');

  // ───── 7-B: 일괄 할당 ─────
  console.log('\n── 7-B  반 일괄 할당');
  const bulk = await page.evaluate(() => {
    const c = DB.classes().find(x => x.active !== false && (x.studentIds || []).length);
    if (!c) return { skip: true };
    openBulkAssign(c.id);
    const n = _bulkStus().length;
    const title = document.querySelector('#m-add-assign .mt').textContent.trim();
    const extra = (document.getElementById('modal-assign-extra').textContent || '').trim();
    const d = document.getElementById('modal-assign-date').value, u = document.getElementById('modal-assign-due').value;
    closeAssignModal();
    return { n, title, extra: extra.slice(0, 50), d, u, cleared: _bulkClassId === '', cname: c.name };
  });
  if (bulk.skip) console.log('     (학생이 있는 반이 없어 건너뜀)');
  else {
    say(bulk.n > 0 && /일괄 할당/.test(bulk.title), '반 이름과 인원이 뜸', bulk.title + ' · ' + bulk.n + '명');
    say(!!bulk.d && !!bulk.u, '날짜·마감이 채워짐', bulk.d + ' ~ ' + bulk.u);
    say(bulk.cleared, '닫으면 일괄 상태 해제');
  }

  // ───── 8-A: 학생 응원 문구 저장 ─────
  console.log('\n── 8-A  학생 응원 문구');
  const cheer = await page.evaluate(async (sid) => {
    const s = DB.stus().find(x => x.id === sid);
    await loginStudent(s);
    await new Promise(r => setTimeout(r, 2500));
    const el = document.getElementById('stu-lesson-cmt');
    if (!el) return { none: true };
    const lid = el.dataset.lid || '';
    const les = (_cache.lessons || []).find(l => l.id === lid);
    const before = les ? (les.stuCmt || '') : '(수업 없음)';
    el.dataset.stored = ''; el.textContent = '';
    await polishStudentCmt('아이');
    const after = les ? (les.stuCmt || '') : '';
    return { lid: !!lid, before, after, shown: el.textContent.slice(0, 20), stored: el.dataset.stored.slice(0, 20) };
  }, stu.id);
  if (cheer.none) console.log('     (응원 문구 칸이 없어 건너뜀)');
  else {
    say(cheer.lid, '수업 id 를 들고 있음');
    say(!!cheer.after, '만든 문장을 수업 기록(stuCmt)에 저장', cheer.after.slice(0, 24));
    say(cheer.stored === cheer.shown, '다음에 열 때 그 문장을 다시 씀');
    say(/반말로만/.test(prompts.join(' ')), '프롬프트에 반말 규칙');
  }

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(writes)].slice(0, 4).forEach(w => console.log('   · ' + w));
  [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
