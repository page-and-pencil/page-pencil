require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// fix/terms-2 — 여기서 보는 것은 '테스트', 학교 것은 '시험', 종이는 '시험지'
//   · 선생님 여덟 탭·학생 세 탭·학부모 두 탭에 재시험·자체 시험·테스트지·미시험·최초 시험 0곳
//   · 종류 고르기에 '자체 테스트', 저장 값은 inhouse 그대로
//   · '시험 일정'·'영어 시험일'·'시험지'·'단어 시험지' 는 그대로 · Ctrl K '재시험' → 재테스트
// 가짜 서버만 쓴다. 실제 서버로는 한 건도 나가지 않는다. 이름·교재는 지어낸 것만.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { pageUrl } = require('./_page');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };
const note = t => console.log('      · ' + t);

const T = new Date(), pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = ymd(T);
const shift = (ds, d) => { const x = new Date(ds + 'T12:00:00'); x.setDate(x.getDate() + d); return ymd(x); };
const OLD = ['재시험', '자체 시험', '테스트지', '미시험', '최초 시험'];

const SNAP = {
  students: [{ id: 't2-s1', name: '나봄', grade: '초4', cls: 't2-c1', pin: '0001', fee: 0 }],
  globalClasses: [{ id: 't2-c1', name: '보기반 가', active: true, days: ['월', '수'], studentIds: ['t2-s1'], commonMaterials: {} }],
  globalTextbooks: [], library: [], readings: [], logs: [],
  lessons: [{ id: 't2-l1', sid: 't2-s1', classId: 't2-c1', date: shift(today, -2), att: 'normal', cmt: '', materials: {} }],
  // 불합격한 단어 테스트 하나 — 재테스트 대기·예정이 화면에 뜨게
  tests: [
    { id: 't2-t1', sid: 't2-s1', date: shift(today, -3), testKind: 'inhouse', vocabCorrect: 8, vocabTotal: 20,
      wrongWords: ['barn', 'goat', 'hay'] },
    { id: 't2-t2', sid: 't2-s1', date: shift(today, -10), testKind: 'inhouse', vocabCorrect: 18, vocabTotal: 20 },
  ],
  assignments: [],
  vocab_cards: [{ id: 't2-v1', sid: 't2-s1', word: 'barn', meaning: '헛간', pos: 'n', addedDate: shift(today, -5), hits: 0, misses: 1 }],
};
let reqs = { get: 0, write: 0 };
function serve(route) {
  const req = route.request();
  const isWrite = req.method() !== 'GET' && req.method() !== 'HEAD';
  if (isWrite) reqs.write++; else reqs.get++;
  const t = (new URL(req.url()).pathname.split('/rest/v1/')[1] || '').split('?')[0];
  const rows = ({ students: SNAP.students, classes: SNAP.globalClasses, lessons: SNAP.lessons, tests: SNAP.tests,
    vocab_cards: SNAP.vocab_cards })[t] || [];
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(isWrite ? [] : rows.map(d => ({ id: d.id, sid: d.sid || null, data: d, updated_at: '2026-11-13T00:00:00.000Z' }))) });
}
const errs = [];
async function makePage(browser, sess, vp) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR' });
  await ctx.addInitScript(s => { try { localStorage.setItem('pp_session', JSON.stringify(s)); } catch (e) { } }, sess);
  const page = await ctx.newPage();
  await page.route('**/rest/v1/**', serve);
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false,"server":false}' }));
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  await page.goto(pageUrl(null, null, true), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => (typeof _cache !== 'undefined') && (_cache.students || []).length > 0, null, { timeout: 60000 }).catch(() => { });
  await wait(1300);
  return { ctx, page };
}
// 보이는 글(그리고 고르기 항목) 에서 옛 말 찾기 — '새로 생긴 것' 지난 줄은 뺀다
const FIND = (sel, words) => {
  const SKIP = '#dash-whatsnew,#cfg-whatsnew,.wn-row,#m-gsearch';
  const root = document.querySelector(sel) || document.body;
  const hits = new Set();
  root.querySelectorAll('*').forEach(el => {
    if (el.closest(SKIP)) return;
    const t = el.tagName === 'OPTION' ? el.textContent : [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
    if (!t.trim()) return;
    if (el.tagName !== 'OPTION') {
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
      const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none') return;
    } else if (!el.closest('select') || !el.closest('select').offsetParent) return;
    words.forEach(w => { if (t.indexOf(w) >= 0) hits.add(w + ' — "' + t.trim().replace(/\s+/g, ' ').slice(0, 36) + '"'); });
  });
  return [...hits];
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  // ═══ 선생님 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'teacher' }, { width: 1366, height: 900 });
    const all = [];
    for (const tab of ['t-dash', 't-class', 't-stu', 't-assign', 't-tst', 't-bks', 't-les', 't-cfg']) {
      const h = await page.evaluate(async (o) => {
        swTab(o.tab); await new Promise(r => setTimeout(r, 700));
        if (o.tab === 't-stu') { loadStuPanel('t2-s1'); await new Promise(r => setTimeout(r, 700)); }
        if (o.tab === 't-tst') { const s = document.getElementById('ts-stu'); if (s) { s.value = 't2-s1'; s.dispatchEvent(new Event('change')); } await new Promise(r => setTimeout(r, 600)); }
        return eval('(' + o.fn + ')')('#' + o.tab, o.words);
      }, { tab, fn: FIND.toString(), words: OLD });
      h.forEach(x => all.push(tab + ' · ' + x));
    }
    ok('[1] 선생님 여덟 탭에 옛 말(재시험·자체 시험·테스트지·미시험·최초 시험) 0곳', all.length === 0, all.length + '곳');
    all.slice(0, 8).forEach(note);

    const k = await page.evaluate(async () => {
      swTab('t-tst'); await new Promise(r => setTimeout(r, 400));
      const opts = [...document.querySelectorAll('#ts-kind option')].map(o => ({ v: o.value, t: o.textContent.trim() }));
      const rt = [...document.querySelectorAll('#t-tst option')].map(o => o.textContent.trim()).filter(t => /첫 테스트/.test(t));
      const lbl = [...document.querySelectorAll('#t-tst label')].map(l => l.textContent.trim()).filter(t => /시험지 사진|재테스트/.test(t));
      return { opts, rt, lbl, kindName: (typeof ppTestKind === 'function' ? '' : '') };
    });
    const inh = k.opts.find(o => o.v === 'inhouse');
    ok("[1] 종류 고르기에 '자체 테스트', 저장 값은 inhouse 그대로", !!inh && inh.t === '자체 테스트', inh ? inh.v + ' = "' + inh.t + '"' : '없음');
    ok("[1][3] '첫 테스트'·'시험지 사진'·'재테스트' 가 테스트 탭에 보인다", k.rt.length > 0 && k.lbl.some(t => /시험지 사진/.test(t)) && k.lbl.some(t => /재테스트/.test(t)),
      k.lbl.join(' · '));

    // 학교 것은 '시험', 종이는 '시험지' 그대로
    const keep = await page.evaluate(async () => {
      swTab('t-data'); switchDataTab('exam'); await new Promise(r => setTimeout(r, 500));
      const exam = (document.getElementById('dtab-exam') || {}).textContent || '';
      const paper = (document.getElementById('dtab-paper') || {}).textContent || '';
      const html = document.body.innerHTML;
      return { exam: exam.trim(), paper: paper.trim(), examDate: html.indexOf('영어 시험일') >= 0, vp: html.indexOf('단어 시험지') >= 0 };
    });
    ok("[2][3] '시험 일정'·'시험지' 화면 이름과 '영어 시험일'·'단어 시험지' 는 그대로",
      /시험 일정/.test(keep.exam) && /시험지/.test(keep.paper) && keep.examDate && keep.vp, keep.exam + ' · ' + keep.paper);

    const gs = await page.evaluate(async () => {
      const out = {};
      for (const q of ['재시험', '자체 시험']) {
        openGlobalSearch(); await new Promise(r => setTimeout(r, 200));
        const i = document.getElementById('gs-q'); i.value = q; gsRender(); await new Promise(r => setTimeout(r, 200));
        out[q] = [...document.querySelectorAll('#gs-results .gs-item')].map(e => e.innerText.replace(/\s+/g, ' ').trim());
        closeM('m-gsearch');
      }
      return out;
    });
    ok("[5] Ctrl K 에 '재시험' 을 치면 재테스트 쪽이 나온다", gs['재시험'].some(x => /재테스트/.test(x)), gs['재시험'].slice(0, 2).join(' | '));
    ok("[5] Ctrl K 에 '자체 시험' 을 치면 자체 테스트가 나온다", gs['자체 시험'].some(x => /자체 테스트/.test(x)), gs['자체 시험'].slice(0, 2).join(' | '));
    await ctx.close();
  }
  // ═══ 학생 세 탭 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'student', sid: 't2-s1' }, { width: 390, height: 800 });
    const all = [];
    for (const t of ['st-home', 'st-vocab', 'st-library']) {
      const h = await page.evaluate(async (o) => {
        currentStudentSid = 't2-s1'; if (o.t === 'st-home') renderStudentHome('t2-s1');
        swStuTab(o.t); await new Promise(r => setTimeout(r, 700));
        document.querySelectorAll('#' + o.t + ' details').forEach(d => d.open = true);
        return eval('(' + o.fn + ')')('#' + o.t, o.words);
      }, { t, fn: FIND.toString(), words: OLD });
      h.forEach(x => all.push(t + ' · ' + x));
    }
    ok('[4] 학생 세 탭에 옛 말 0곳', all.length === 0, all.join(' | ') || '0곳');
    await ctx.close();
  }
  // ═══ 학부모 두 탭 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'parent', sid: 't2-s1' }, { width: 390, height: 800 });
    const all = await page.evaluate(async (o) => {
      currentParentSid = 't2-s1'; loadParent('t2-s1'); await new Promise(r => setTimeout(r, 1400));
      const out = [];
      for (const t of ['les', 'score']) {
        const b = document.querySelector('#s-parent .stu-bottomnav .stutab[data-ppnav="' + t + '"]'); if (b) b.click();
        await new Promise(r => setTimeout(r, 600));
        document.querySelectorAll('#pp-body details').forEach(d => d.open = true);
        eval('(' + o.fn + ')')('#pp-body', o.words).forEach(x => out.push(t + ' · ' + x));
      }
      return out;
    }, { fn: FIND.toString(), words: OLD });
    ok('[4] 학부모 두 탭에 옛 말 0곳', all.length === 0, all.join(' | ') || '0곳');
    // 학부모 쪽 불합격 표시 — '재테스트 예정'
    const lbl = await page.evaluate(() => (typeof ppPassLabel === 'function') ? '' : (document.getElementById('pp-body').innerText.match(/재테스트[^\n]{0,8}/) || [''])[0]);
    note('학부모 화면: ' + (lbl || '(불합격 표시 없음)'));
    await ctx.close();
  }
  await browser.close();
  ok('콘솔 오류 0건', errs.length === 0, errs.slice(0, 4).join(' | '));
  console.log('\n가짜 서버가 받은 요청: 읽기 ' + reqs.get + '건 · 쓰기 ' + reqs.write + '건 (실제 서버로는 0건)');
  console.log('\n' + pass.length + '/' + (pass.length + fail.length) + ' 통과');
  if (fail.length) { console.log('실패:\n - ' + fail.join('\n - ')); process.exit(1); }
})().catch(e => { console.error('실패:', e); process.exit(1); });
