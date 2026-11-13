require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
const { pageUrl, fileUrl } = require('./_page');
// 프롬프트 1·2 수정 검증. 실DB 쓰기 전부 차단.
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
  const sid = srows.map(r => ({ id: r.id, ...(r.data || {}) })).filter(s => !s.inactive && !s._deleted)[0].id;
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(o => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher', sid: o })); } catch (e) { } }, sid);
  const page = await ctx.newPage();
  const errs = []; let prompts = [], writes = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
  await page.route('**/functions/v1/claude-proxy', r => {
    const body = r.request().postData() || '';
    prompts.push(body);
    const ask = /진도 정보가 없습니다/.test(body)
      ? '오늘도 집중해서 참여했습니다.'                       // 진도 없음 분기 → 정상 코멘트
      : '진도 정보가 없어서 교재명과 단원을 알 수 없습니다. 진도 정보를 함께 입력해 주시면 바로 코멘트를 작성해 드리겠습니다.';
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ text: ask }] }) });
  });
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto(pageUrl(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(4500);

  // ───── 1-A ─────
  console.log('── 1-A  AI 되묻는 문장이 학부모에게 가지 않는지');
  const a = await page.evaluate(async () => {
    const noMats = await polishCmt('집중도 좋음', '');          // 진도 없음
    const withMats = await polishCmt('집중도 좋음', '[어법] 교재명=345 Grammar 1 | 단원=Unit 3');
    return { noMats, withMats, local: polishCmtLocal('집중도 좋음') };
  });
  const p0 = prompts[0] || '', p1 = prompts[1] || '';
  say(/진도 정보가 없습니다/.test(p0) && /되묻는 문장/.test(p0), '진도 없으면 다른 프롬프트로 보냄');
  say(!/진도 정보를 활용해/.test(p0), '진도 요구 지시가 빠짐');
  say(a.noMats && !/입력해 주시면|알 수 없습니다|작성해 드리겠/.test(a.noMats), '진도 없을 때 코멘트가 정상', a.noMats.slice(0, 40));
  say(a.withMats === a.local, '되묻는 응답은 로컬 문장으로 대체됨', a.withMats.slice(0, 40));
  say(/교재명=345 Grammar 1/.test(p1), '진도 있으면 종전 프롬프트');

  // ───── 2-A ─────
  console.log('\n── 2-A  새 할당 창');
  const b = await page.evaluate(async (sid) => {
    const tgt = (_cache.assignments || []).find(x => x.sid === sid && (x.schedule || []).length);
    openEditAssignModal(tgt.id);
    const t1 = { title: document.querySelector('#m-add-assign .mt').textContent.trim(), btn: document.getElementById('assign-save-btn').textContent.trim(), rows: document.querySelectorAll('#c5-rows .c5-row').length };
    closeAssignModal();                       // [취소]·× 와 같은 경로
    const t2 = { editId: _editAssignId };
    openAssignModal('');                      // [+ 과제 할당]
    const t3 = { title: document.querySelector('#m-add-assign .mt').textContent.trim(), btn: document.getElementById('assign-save-btn').textContent.trim(), cat: document.getElementById('modal-assign-cat').value, rows: document.querySelectorAll('#c5-rows .c5-row').length, extra: (document.getElementById('modal-assign-extra').textContent || '').trim().length };
    const before = (_cache.assignments || []).length;
    const toasts = []; const ot = window.toast; window.toast = m => toasts.push(String(m));
    await saveModalAssignment();              // 빈 폼으로 저장 시도
    window.toast = ot;
    closeAssignModal();
    return { t1, t2, t3, before, after: (_cache.assignments || []).length, toasts, aid: tgt.id, n: (tgt.schedule || []).length };
  }, sid);
  say(b.t1.title === '📋 과제 수정' && b.t1.btn === '저장', '수정 모드 제목·버튼', b.t1.title + ' / ' + b.t1.btn);
  say(b.t2.editId === null, '닫으면 수정 상태 해제 (전: 남아서 다음 저장이 덮어씀)');
  say(b.t3.title === '📋 과제 할당' && b.t3.btn === '할당', '새 할당 제목·버튼');
  say(!b.t3.cat && b.t3.rows === 0 && b.t3.extra === 0, '구분·일정 칸이 비어 있음', `구분=${b.t3.cat || '(없음)'} · 일정 ${b.t3.rows}줄`);
  say(b.before === b.after && /학생을 선택|구분을 고르거나/.test(b.toasts.join(' ')), '빈 폼 저장은 막힘 · 과제 수 그대로', b.toasts.join(' / '));

  // ───── 1-B ─────
  console.log('\n── 1-B  미리보기 공지 팝업');
  const c = await page.evaluate(async (sid) => {
    const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const readBefore = (JSON.parse(localStorage.getItem('pp_notice_read') || '[]')).length;
    await previewAsStudent(sid);
    await new Promise(r => setTimeout(r, 1400));
    const inStu = { popup: vis('notice-popup'), screen: (document.querySelector('.screen.active') || {}).id };
    let marked = null;
    if (inStu.popup) { closeNotice(); marked = (JSON.parse(localStorage.getItem('pp_notice_read') || '[]')).length !== readBefore; }
    await previewAsStudent(sid);            // 다시 띄워 두고
    await new Promise(r => setTimeout(r, 1400));
    const again = vis('notice-popup');
    returnToTeacher();
    await new Promise(r => setTimeout(r, 700));
    const back = { popup: vis('notice-popup'), overlay: vis('notice-overlay'), screen: (document.querySelector('.screen.active') || {}).id };
    return { inStu, marked, again, back, readAfter: (JSON.parse(localStorage.getItem('pp_notice_read') || '[]')).length, readBefore };
  }, sid);
  say(c.inStu.popup, '학생 미리보기에서 공지가 뜬다(종전대로)');
  say(c.marked === false, '미리보기의 [확인]이 이 기기 읽음 기록을 바꾸지 않음', `pp_notice_read ${c.readBefore}건 → ${c.readAfter}건`);
  say(c.again, '그래서 다음 미리보기에도 그대로 뜬다');
  say(!c.back.popup && !c.back.overlay && c.back.screen === 's-teacher', '선생님 뷰로 돌아오면 팝업·배경이 사라짐');

  // ───── 2-C / 2-E ─────
  console.log('\n── 2-C · 2-E  학생 화면');
  const d = await page.evaluate(async (sid) => {
    const s = DB.stus().find(x => x.id === sid);
    await loginStudent(s);
    await new Promise(r => setTimeout(r, 1500));
    // 기간형 단건 과제(오늘~3일 뒤)를 캐시에만 넣어 본다
    const add = (n) => { const x = new Date(ppToday() + 'T12:00:00'); x.setDate(x.getDate() + n); return ppYmd(x); };
    _cache.assignments.unshift({ id: 'probe-span', sid, type: 'textbook', category: 'vocab', date: ppToday(), due: add(3), bookTitle: '', range: '테스트 숙제' });
    renderStudentHome(sid);
    await new Promise(r => setTimeout(r, 900));
    const home = (document.getElementById('st-home').textContent || '').replace(/\s+/g, ' ');
    const headBefore = (home.match(/남은 퀘스트 (\d+)개/) || [])[1];
    const spanShown = home.indexOf('테스트 숙제') >= 0;
    // 오늘 퀘스트 하나 체크 → 위쪽 문구가 같이 바뀌는지
    const card = [...document.querySelectorAll('#st-home .hw-check-card')].find(c => !c.classList.contains('done') && c.id.startsWith('sch-card-'));
    let changed = null, before = null, after = null;
    if (card) {
      const m = card.id.match(/^sch-card-(.+)-(\d{4}-\d{2}-\d{2})$/);
      before = ((document.getElementById('st-home').textContent || '').match(/남은 퀘스트 (\d+)개/) || [])[1] || '(없음)';
      await completeSchedDay(sid, m[1], m[2]);
      await new Promise(r => setTimeout(r, 1200));
      after = ((document.getElementById('st-home').textContent || '').match(/남은 퀘스트 (\d+)개/) || [])[1] || '(없음)';
      changed = before !== after;
    }
    return { spanShown, headBefore, before, after, changed, hasCard: !!card };
  }, sid);
  say(d.spanShown, '오늘 낸 3일짜리 과제가 오늘 화면에 보임(범위 글 포함)');
  if (d.hasCard) say(d.changed, '체크하면 "남은 퀘스트" 문구가 함께 바뀜', d.before + '개 → ' + d.after + '개');
  else console.log('     (오늘 체크할 퀘스트가 없어 2-C 는 건너뜀)');

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 6).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
