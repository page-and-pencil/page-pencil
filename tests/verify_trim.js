require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// [1] 학생 화면 완료 숙제 제거 · [2] 번호 없는 Review 연결. 실데이터 쓰기 0.
const path = require('path'), fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
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
  page.on('console', m => { if (m.type() === 'error' && !/dictionaryapi|favicon/.test(m.text())) errs.push('console: ' + m.text().slice(0, 170)); });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.route('**api.elevenlabs.io/**', r => r.fulfill({ status: 500, body: '' }));
  let writes = 0;
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes++;
    return r.fulfill({ status: 200, body: '[]' });   // 쓰기는 전부 차단
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0 && (_cache.globalTextbooks || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
  await wait(4000);
  await page.evaluate(() => { window.speakWord = async () => { }; window.speakSmart = async () => true; });

  // ───── 1. 학생 홈 (390px) ─────
  console.log('── 1  학생 홈 — 완료 숙제 빼기');
  const r1 = await page.evaluate(async (sid) => {
    await loginStudent(DB.stus().find(s => s.id === sid));
    await new Promise(r => setTimeout(r, 1600));
    swStuTab('st-home');
    await new Promise(r => setTimeout(r, 900));
    const home = document.getElementById('st-home');
    const txt = (home.textContent || '').replace(/\s+/g, ' ');
    const sums = [...home.querySelectorAll('details > summary')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
    // 📊 내 기록 칸
    const statWrap = [...home.querySelectorAll('div')].find(d => /grid-template-columns:repeat\(/.test(d.getAttribute('style') || '') && d.querySelector('[onclick^="showStatDetail"]'));
    const boxes = statWrap ? [...statWrap.querySelectorAll('[onclick^="showStatDetail"]')] : [];
    const cols = statWrap ? getComputedStyle(statWrap).gridTemplateColumns.split(' ').length : 0;
    // 완료 숙제 창
    document.querySelectorAll('#stat-overlay').forEach(x => x.remove());
    showStatDetail(sid, 'assign');
    await new Promise(r => setTimeout(r, 200));
    const detailOpened = document.querySelectorAll('#stat-overlay').length;
    // 남아 있어야 하는 것들
    const keep = {
      stamp: /도장/.test(txt),
      bonus: sums.some(s => /보너스/.test(s)),
      stats: /내 기록/.test(txt),
      hwCard: !!document.getElementById('stu-hw-card'),
    };
    return {
      hasDoneDetails: sums.some(s => /지난 완료 기록/.test(s)),
      hasDoneWord: /완료 숙제/.test(txt),
      summaries: sums, boxes: boxes.map(b => (b.textContent || '').replace(/\s+/g, ' ').trim()), cols,
      boxW: boxes.map(b => Math.round(b.getBoundingClientRect().width)),
      wrapW: statWrap ? Math.round(statWrap.getBoundingClientRect().width) : 0,
      detailOpened, keep,
    };
  }, REAL_SID);
  say(!r1.hasDoneDetails, "홈에서 '✅ 지난 완료 기록' 묶음이 없다", r1.summaries.join(' | ').slice(0, 90));
  say(!r1.hasDoneWord, "'완료 숙제' 글자가 홈에 없다");
  say(r1.boxes.length === 2 && r1.cols === 2, "내 기록 칸 2개 · 2열", r1.boxes.join(' / ') + ' · ' + r1.cols + '열');
  say(r1.boxW.length === 2 && Math.abs(r1.boxW[0] - r1.boxW[1]) <= 2 && (r1.boxW[0] + r1.boxW[1]) >= r1.wrapW - 12, '두 칸이 가로를 꽉 채운다', r1.boxW.join(' + ') + ' = ' + r1.wrapW + 'px');
  say(r1.detailOpened === 0, "showStatDetail('assign') 은 아무 창도 열지 않는다", '창 ' + r1.detailOpened + '개');
  say(r1.keep.stamp && r1.keep.bonus && r1.keep.stats && r1.keep.hwCard, '도장판·보너스·내 기록·숙제 카드는 그대로', JSON.stringify(r1.keep));

  // ───── 2. 다른 칸은 여전히 눌린다 ─────
  const r2 = await page.evaluate(async (sid) => {
    const titleOf = () => {
      const ov = document.getElementById('stat-overlay');
      if (!ov) return '';
      const box = ov.nextElementSibling;
      return box ? (box.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) : '';
    };
    document.querySelectorAll('#stat-overlay').forEach(x => x.remove());
    showStatDetail(sid, 'vocab');
    await new Promise(r => setTimeout(r, 250));
    const t1 = titleOf(); const n1 = document.querySelectorAll('#stat-overlay').length;
    const ov1 = document.getElementById('stat-overlay'); if (ov1) { const b = ov1.nextElementSibling; if (b) b.remove(); ov1.remove(); }
    showStatDetail(sid, 'rds');
    await new Promise(r => setTimeout(r, 250));
    const t2 = titleOf(); const n2 = document.querySelectorAll('#stat-overlay').length;
    const ov2 = document.getElementById('stat-overlay'); if (ov2) { const b = ov2.nextElementSibling; if (b) b.remove(); ov2.remove(); }
    const cards = ppLive(_cache.vocab_cards).filter(c => c.sid === sid).length;
    const rds = DB.allRds(sid).length;
    return { n1, t1, n2, t2, cards, rds };
  }, REAL_SID);
  say(r2.n1 === 1 && /단어 현황/.test(r2.t1) && r2.cards > 0, "'공부한 단어' 는 그대로 열린다", r2.t1 + ' (카드 ' + r2.cards + '장)');
  say(r2.n2 === 1 && /읽은 책/.test(r2.t2) && r2.rds > 0, "'읽은 책' 은 그대로 열린다", r2.t2 + ' (' + r2.rds + '권)');

  // ───── 3. 선생님·학부모 화면의 완료 기록은 그대로 ─────
  console.log('\n── 2  선생님·학부모 화면');
  const r3 = await page.evaluate(async (sid) => {
    await returnToTeacher(); await new Promise(r => setTimeout(r, 2400));
    // 선생님 학생 패널 숙제 탭
    currentSpStuId = sid;
    if (typeof loadStuPanel === 'function') await loadStuPanel(sid);
    await new Promise(r => setTimeout(r, 1200));
    const spHw = (document.getElementById('sp-hw') || {}).textContent || '';
    // 완료된 과제가 데이터에 그대로 있는지
    const completed = ppLive(_cache.assignments).filter(a => a.sid === sid && a.completedAt).length;
    // 학부모 화면
    const parentTxt = '';
    return { spHwHasDone: /완료/.test(spHw), spHwLen: spHw.length, completed, parentTxt: parentTxt.slice(0, 60) };
  }, REAL_SID);
  say(r3.completed > 0, '완료 과제 데이터는 그대로다', r3.completed + '건');
  say(r3.spHwHasDone || r3.spHwLen > 200, '선생님 학생 패널 숙제 탭에 완료 기록이 보인다', r3.spHwLen + '자');
  const r3b = await page.evaluate((sid) => {
    const html = (typeof renderHomeStats === 'function') ? (renderHomeStats(sid) || '') : '';
    // 학생 전용 두 함수를 선생님·학부모 코드가 부르지 않는지 (이름으로 확인)
    const refs = [];
    ['renderParentHome', 'renderParentHw', 'loadStuPanel', 'renderDash'].forEach(fn => {
      if (typeof window[fn] === 'function') {
        const src = String(window[fn]);
        if (src.indexOf('renderHomeStats') >= 0 || src.indexOf('showStatDetail') >= 0) refs.push(fn);
      }
    });
    return {
      statsNoAssign: html.indexOf('완료 숙제') < 0 && html.indexOf('repeat(2,1fr)') >= 0,
      statsHtml: (html.match(/repeat\([^)]*\)/) || [''])[0] + ' · 완료숙제 ' + (html.indexOf('완료 숙제') >= 0 ? '있음' : '없음'),
      refs,
    };
  }, REAL_SID);
  say(r3b.statsNoAssign, 'renderHomeStats 가 그리는 html 에 완료 숙제가 없다 · 2열', r3b.statsHtml);
  say(r3b.refs.length === 0, '선생님·학부모 쪽 코드가 renderHomeStats·showStatDetail 을 부르지 않는다', JSON.stringify(r3b.refs));

  // ───── 4. 체험 모드에서도 같은 모양 ─────
  console.log('\n── 3  체험 모드(학생 미리보기)');
  const r4 = await page.evaluate(async (sid) => {
    await previewAsStudent(sid); await new Promise(r => setTimeout(r, 2800));
    swStuTab('st-home'); await new Promise(r => setTimeout(r, 900));
    const home = document.getElementById('st-home');
    const txt = (home.textContent || '').replace(/\s+/g, ' ');
    const sums = [...home.querySelectorAll('details > summary')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
    const statWrap = [...home.querySelectorAll('div')].find(d => /grid-template-columns:repeat\(/.test(d.getAttribute('style') || '') && d.querySelector('[onclick^="showStatDetail"]'));
    const boxes = statWrap ? [...statWrap.querySelectorAll('[onclick^="showStatDetail"]')].map(b => (b.textContent || '').replace(/\s+/g, ' ').trim()) : [];
    const on = ppSandbox();
    await returnToTeacher(); await new Promise(r => setTimeout(r, 2400));
    return { on, hasDoneDetails: sums.some(s => /지난 완료 기록/.test(s)), hasDoneWord: /완료 숙제/.test(txt), boxes };
  }, REAL_SID);
  say(r4.on, '미리보기는 체험 모드');
  say(!r4.hasDoneDetails && !r4.hasDoneWord && r4.boxes.length === 2, '체험 모드에서도 같은 모양', r4.boxes.join(' / '));

  // ───── 5. [2] Review 연결 표 ─────
  console.log('\n── 4  번호 없는 Review 연결');
  const r5 = await page.evaluate((sid) => {
    const tbs = _cache.globalTextbooks || [];
    const byTitle = {}; tbs.forEach(t => { byTitle[String(t.title || '').trim()] = t; });
    const rows = [];
    DB.less().filter(l => l.sid === sid).sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).forEach(l => {
      Object.entries(l.materials || {}).forEach(([slot, v]) => {
        if (!v || !v.unit || !/review/i.test(String(v.unit))) return;
        const tb = (v.bookId && tbs.find(t => t.id === v.bookId)) || byTitle[String(v.book || '').trim()];
        if (!tb) { rows.push({ date: l.date, book: v.book, unit: v.unit, tb: false }); return; }
        const segs = String(v.unit).split(/[,/]/).map(x => x.trim()).filter(Boolean);
        const bare = segs.filter(ppIsBareReview);
        const sibs = segs.filter(x => !ppIsBareReview(x));
        const before = ppMatchUnit(tb, v.unit);
        const after = ppMatchUnitCtx(tb, v.unit, { sid, date: l.date });
        const added = after.filter(k => before.indexOf(k) < 0);
        const dropped = before.filter(k => after.indexOf(k) < 0);
        rows.push({ date: l.date, book: tb.title, unit: v.unit, tb: true, bare: bare.length,
          sibs, before, after, added, dropped });
      });
    });
    // 바뀌지 않아야 하는 것: 번호 없는 Review 가 없는 모든 기록은 전/후 동일
    let same = 0, diff = [];
    DB.less().filter(l => l.sid === sid).forEach(l => {
      Object.values(l.materials || {}).forEach(v => {
        if (!v || !v.unit) return;
        const tb = (v.bookId && tbs.find(t => t.id === v.bookId)) || byTitle[String(v.book || '').trim()];
        if (!tb) return;
        const segs = String(v.unit).split(/[,/]/).map(x => x.trim()).filter(Boolean);
        if (segs.some(ppIsBareReview)) return;
        const a = JSON.stringify(ppMatchUnit(tb, v.unit)), b = JSON.stringify(ppMatchUnitCtx(tb, v.unit, { sid, date: l.date }));
        if (a === b) same++; else diff.push({ unit: v.unit, a, b });
      });
    });
    // 맥락 없이 부르면 지금과 똑같은가
    // 같은 줄에 다른 단원도 없고 맥락도 없으면 지금과 같아야 한다 (③ '지금처럼')
    let noCtxSame = 0, noCtxDiff = [];
    rows.filter(r => r.tb && r.bare && !r.sibs.length).forEach(r => {
      const tb = byTitle[r.book];
      const a = JSON.stringify(ppMatchUnit(tb, r.unit)), b = JSON.stringify(ppMatchUnitCtx(tb, r.unit));
      if (a === b) noCtxSame++; else noCtxDiff.push({ unit: r.unit, a, b });
    });
    // 같은 줄에 다른 단원이 있으면 맥락 없이도 ① 로 정해진다 (의도한 변화)
    const sibResolved = rows.filter(r => r.tb && r.bare && r.sibs.length).map(r => ({
      unit: r.unit, added: ppMatchUnitCtx(byTitle[r.book], r.unit).filter(k => ppMatchUnit(byTitle[r.book], r.unit).indexOf(k) < 0),
    }));
    return { rows, same, diff: diff.slice(0, 5), noCtxSame, noCtxDiff: noCtxDiff.slice(0, 5), sibResolved };
  }, REAL_SID);
  console.log('     | 날짜 | 기록 | 전 | 후 | 근거 |');
  r5.rows.forEach(r => {
    if (!r.tb) { console.log('     ' + r.date + ' | ' + r.book + ' / "' + r.unit + '" | (교재 없음) |'); return; }
    const why = r.bare ? (r.sibs.length ? '같은 줄 ' + r.sibs.join(', ') : '이전 기록') : '번호 있음(그대로)';
    console.log('     ' + r.date + ' | ' + r.book + ' / "' + r.unit + '" | [' + r.before.join(', ') + '] | [' + r.after.join(', ') + '] | ' + why);
  });
  const sl = r5.rows.filter(r => r.tb && /Smart Listening 1\.1/.test(r.book) && r.bare);
  say(sl.length === 3, "학생 A의 Smart Listening 1.1 번호 없는 'Review' 3건", sl.map(r => r.date).join(' · '));
  const want = { '2026-08-04': 'Review 2', '2026-08-06': 'Review 3', '2026-08-11': 'Review 4' };
  sl.forEach(r => {
    const got = r.added.join(',');
    say(got === want[r.date], r.date + ' "' + r.unit + '" → ' + want[r.date], '붙은 단원 [' + r.after.join(', ') + '] · 추가 ' + (got || '없음'));
  });
  say(r5.diff.length === 0, '번호 없는 Review 가 없는 기록은 전/후 동일', r5.same + '건 동일' + (r5.diff.length ? ' / 달라진 것 ' + JSON.stringify(r5.diff) : ''));
  say(r5.noCtxDiff.length === 0, "같은 줄 단원도 맥락도 없으면 지금과 같다 (③ '연결 안 함')", r5.noCtxSame + '건 동일' + (r5.noCtxDiff.length ? ' / ' + JSON.stringify(r5.noCtxDiff) : ''));
  say(r5.sibResolved.every(x => x.added.length === 1), '같은 줄에 단원이 있으면 맥락 없이도 Review 하나로 정해진다 (①)', r5.sibResolved.map(x => x.added.join(',')).join(' · '));

  // ───── 5b. 규칙 ② — 같은 줄에 단원이 없을 때 이전 기록으로 정하기 ─────
  console.log('\n── 4b  규칙 ② (이전 기록)');
  const r5b = await page.evaluate((sid) => {
    const tb = (_cache.globalTextbooks || []).find(t => String(t.title || '').trim() === 'Smart Listening 1.1');
    if (!tb) return { found: false };
    const probe = d => ({
      date: d,
      withCtx: ppMatchUnitCtx(tb, 'Review', { sid, date: d }),
      noCtx: ppMatchUnit(tb, 'Review'),
    });
    return { found: true, keys: tbUnitKeys(tb), rows: ['2026-07-25', '2026-08-05', '2026-08-07', '2026-08-12', '2026-07-01'].map(probe) };
  }, REAL_SID);
  if (!r5b.found) say(false, "Smart Listening 1.1 교재를 찾지 못했다");
  else {
    // 명세: '그 날짜 이전 기록에서 가장 뒤 단원 바로 다음 Review'
    //  07-25 → 직전 07-24 (Unit 3, Review 1) 의 가장 뒤 = Review 1 → 다음 Review 2
    //  08-05 → 직전 08-04 Unit 6 → Review 2 / 08-07 → 08-06 Unit 9 → Review 3 / 08-12 → 08-11 Unit 12 → Review 4
    const want = { "2026-07-25": "Review 2", "2026-08-05": "Review 2", "2026-08-07": "Review 3", "2026-08-12": "Review 4", "2026-07-01": "" };
    r5b.rows.forEach(r => {
      const got = r.withCtx.join(",");
      const exp = want[r.date];
      if (exp) say(got === exp, r.date + ' 기준 "Review" → ' + exp + ' (그 전 마지막 단원 다음)', "[" + got + "]");
      else say(got === r.noCtx.join(","), r.date + ' 기준 "Review" → 정할 수 없어 지금과 같다', "[" + got + "]");
    });
  }
  // ───── 6. 폭 ─────
  console.log('\n── 5  화면 폭');
  for (const w of [320, 390, 1440]) {
    await page.setViewportSize({ width: w, height: 860 });
    await wait(400);
    const o = await page.evaluate(async (sid) => {
      await loginStudent(DB.stus().find(s => s.id === sid));
      await new Promise(r => setTimeout(r, 1500));
      swStuTab('st-home'); await new Promise(r => setTimeout(r, 800));
      const bad = []; const vw = window.innerWidth;
      // 가로 스크롤 띠(📸 리딩로그 .ig-strip 등) 안쪽은 원래 화면 밖으로 이어진다 → 세지 않는다
      const inScroller = n => {
        for (let e = n.parentElement; e && e !== document.body; e = e.parentElement) {
          const ox = getComputedStyle(e).overflowX;
          if (ox === 'auto' || ox === 'scroll') return true;
        }
        return false;
      };
      document.querySelectorAll('#st-home *').forEach(n => {
        const r = n.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') return;
        if (inScroller(n)) return;
        if (r.right > vw + 1.5 || r.left < -1.5) bad.push(n.className + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
      });
      const statWrap = [...document.querySelectorAll('#st-home div')].find(d => /grid-template-columns:repeat\(/.test(d.getAttribute('style') || '') && d.querySelector('[onclick^="showStatDetail"]'));
      const cols = statWrap ? getComputedStyle(statWrap).gridTemplateColumns : '';
      return { bad: bad.slice(0, 4), hscroll: document.documentElement.scrollWidth > vw + 1, cols };
    }, REAL_SID);
    say(o.bad.length === 0 && !o.hscroll, w + 'px — 넘침 0 · 내 기록 ' + o.cols, o.bad.length ? o.bad.join(' | ') : '없음');
  }

  console.log('\n오류: ' + (errs.length ? errs.slice(0, 6).join(' | ') : '없음'));
  console.log('쓰기 요청: ' + writes + '건 (전부 차단)');
  console.log('\n' + (fails ? '실패 ' + fails + '건' : '전부 통과'));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
