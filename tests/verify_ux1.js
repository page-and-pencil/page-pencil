require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// fix/ux-1 — 이름 부르기 · 학부모 수업 탭 · 빈 탭 · 학생 인사 · 공지 기간 · 수업 기록 저장
// 가짜 서버만 쓴다. 실제 서버로는 한 건도 나가지 않는다. 이름·교재는 지어낸 것만.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { pageUrl } = require('./_page');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const fs = require('fs');
const OUT = path.join(__dirname, 'shots', 'ux1');   // 검사가 남긴 그림은 tests/shots/ 아래 (저장소에 넣지 않는다)
fs.mkdirSync(OUT, { recursive: true });
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };

const T = new Date(), pad = n => String(n).padStart(2, '0');
const today = T.getFullYear() + '-' + pad(T.getMonth() + 1) + '-' + pad(T.getDate());
const DOW = ['일', '월', '화', '수', '목', '금', '토'][T.getDay()];
const shift = (ds, d) => { const x = new Date(ds + 'T12:00:00'); x.setDate(x.getDate() + d); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };

// 가짜 자료 — '가은'(두 글자) · '김가은'(세 글자)
const SNAP = {
  students: [
    { id: 'ux-s1', name: '가은', grade: '초4', cls: 'ux-c1', pin: '0001', fee: 0 },
    { id: 'ux-s2', name: '김가은', grade: '초5', cls: 'ux-c1', pin: '0002', fee: 0 },
  ],
  globalClasses: [{
    id: 'ux-c1', name: '보기반 A', active: true, days: [DOW], studentIds: ['ux-s1', 'ux-s2'],
    commonMaterials: { reading: { book: '보기 리딩 1', unit: 'Unit 4 On the Farm', bookId: 'ux-tb1' } },
  }],
  globalTextbooks: [{
    id: 'ux-tb1', type: 'textbook', title: '보기 리딩 1', category: '리딩',
    units: { 'Unit 4 On the Farm': [{ word: 'barn', ko: '헛간' }], 'Unit 5 In the City': [{ word: 'city', ko: '도시' }] },
  }],
  library: [],
  // 코멘트 없는 수업 — '곧 업데이트됩니다' 줄이 나오지 않아야 한다
  lessons: [
    { id: 'ux-l1', sid: 'ux-s1', classId: 'ux-c1', date: shift(today, -3), att: 'normal', materials: {}, cmt: '' },
    { id: 'ux-l2', sid: 'ux-s1', classId: 'ux-c1', date: shift(today, -10), att: 'normal', materials: {}, cmt: '' },
    { id: 'ux-l3', sid: 'ux-s2', classId: 'ux-c1', date: shift(today, -3), att: 'normal', materials: {}, cmt: '' },
  ],
  // 오늘 몫 둘 · 그중 하나는 최근 2주에 12일이 비어 있다
  assignments: [
    {
      id: 'ux-a1', sid: 'ux-s1', category: 'vocab', text: '앱으로 단어 20개 학습', date: today, due: today,
      schedule: Array.from({ length: 12 }, (_, i) => ({ date: shift(today, -(i + 1)), book: '보기 리딩 1', unit: 'Unit 3' }))
        .concat([{ date: today, book: '보기 리딩 1', unit: 'Unit 4 On the Farm' }]),
    },
    {
      id: 'ux-a2', sid: 'ux-s1', category: 'recur', text: '보기 리딩 1 읽기', bookTitle: '보기 리딩 1', date: today, due: today,
      schedule: [{ date: today, book: '보기 리딩 1', unit: 'Unit 4 On the Farm' }],
    },
    { id: 'ux-a3', sid: 'ux-s2', category: 'recur', text: '보기 리딩 1 읽기', bookTitle: '보기 리딩 1', date: today, due: today,
      schedule: [{ date: today, book: '보기 리딩 1', unit: 'Unit 4 On the Farm' }] },
  ],
  tests: [], readings: [], logs: [], notices: [], homeworks: [], textbooks: [], messages: [],
  monthlyReports: [], examSchedules: [], counsels: [], vocab_cards: [],
  settings: { acct: { name: '보기 학원' } },
};

let reqs = { get: 0, write: 0 };
function serve(route) {
  const req = route.request();
  const isWrite = req.method() !== 'GET' && req.method() !== 'HEAD';
  if (isWrite) reqs.write++; else reqs.get++;
  const t = (new URL(req.url()).pathname.split('/rest/v1/')[1] || '').split('?')[0];
  const rows = ({
    students: SNAP.students, classes: SNAP.globalClasses, global_textbooks: SNAP.globalTextbooks,
    lessons: SNAP.lessons, assignments: SNAP.assignments,
  })[t] || [];
  return route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(isWrite ? [] : rows.map(d => ({ id: d.id, sid: d.sid || null, data: d, updated_at: '2026-11-13T00:00:00.000Z' }))),
  });
}

const errs = [];
async function makePage(browser, sess, vp) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR' });
  await ctx.addInitScript(s => {
    try { localStorage.setItem('pp_session', JSON.stringify(s)); localStorage.removeItem('pp_notice_read'); } catch (e) { }
  }, sess);
  const page = await ctx.newPage();
  await page.route('**/rest/v1/**', serve);
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false,"server":false}' }));
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  await page.goto(pageUrl(null, null, true), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => (typeof _cache !== 'undefined') && (_cache.students || []).length > 0, null, { timeout: 60000 }).catch(() => { });
  await wait(1200);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  // ═══ ① 학부모 390px — 이름 · 숙제 카드 자리 · 빈 탭 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'parent', sid: 'ux-s1' }, { width: 390, height: 844 });
    const r = await page.evaluate(async () => {
      loadParent('ux-s1');
      await new Promise(r => setTimeout(r, 700));
      const cardTop = word => {
        const c = [...document.querySelectorAll('#pp-body .card')].find(x => ((x.querySelector('.ct') || {}).textContent || '').indexOf(word) >= 0);
        return c ? Math.round(c.getBoundingClientRect().top) : -1;
      };
      const txt = document.getElementById('pp-body').innerText;
      return {
        name: (txt.match(/\d+월 한 달, [^\n]*/) || [''])[0],
        hwTop: cardTop('숙제'), lesTop: cardTop('최근 수업'),
        head: (txt.match(/오늘 숙제 \d+\/\d+/) || [''])[0],
        overdue: (txt.match(/[^\n]*밀림/g) || []).slice(0, 3),
        recurTag: txt.indexOf('[반복]') >= 0,
        summed: /밀린 \d+일/.test(txt),
        praise: txt.indexOf('성실하게') >= 0,
        soon: txt.indexOf('곧 업데이트') >= 0,
        nav: [...document.querySelectorAll('#s-parent .stu-bottomnav .stutab')].filter(b => b.offsetWidth > 0).map(b => b.dataset.ppnav),
      };
    });
    ok('[1] 두 글자 이름은 그대로 — 학부모 요약', /가은은/.test(r.name) && !/^.*연은/.test(r.name), '"' + r.name + '"');
    ok('[2] 숙제 카드가 "최근 수업" 보다 위', r.hwTop > 0 && r.lesTop > 0 && r.hwTop < r.lesTop, '숙제 ' + r.hwTop + 'px · 최근 수업 ' + r.lesTop + 'px');
    ok('[2] 머리는 "오늘 숙제 n/m"', r.head === '오늘 숙제 0/2', '"' + r.head + '"');
    ok('[2] 밀린 것은 과제별로 적는다', r.overdue.some(x => /앱으로 단어 20개 학습 · 12일 밀림/.test(x)), '"' + (r.overdue[0] || '') + '"');
    ok('[2] 더한 숫자(밀린 n일)를 쓰지 않는다', r.summed === false);
    ok('[2] "[반복]" 꼬리표가 없다', r.recurTag === false);
    ok('[2] 밀린 숙제가 있으면 "성실하게" 를 쓰지 않는다', r.praise === false);
    ok('[2] 코멘트 없는 수업에 "곧 업데이트" 가 없다', r.soon === false);
    ok('[3] 카카오·결제 정보가 없으면 아래 메뉴가 둘', r.nav.length === 2 && r.nav.join(',') === 'les,score', r.nav.join(','));
    await page.evaluate(() => {
      const c = [...document.querySelectorAll('#pp-body .card')].find(x => ((x.querySelector('.ct') || {}).textContent || '').indexOf('숙제') >= 0);
      if (c) c.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    await wait(300);
    await page.screenshot({ path: path.join(OUT, 'parent_390.png') }).catch(() => { });

    // 세 글자 이름 — 성을 뗀다
    const r2 = await page.evaluate(async () => {
      loadParent('ux-s2');
      await new Promise(r => setTimeout(r, 600));
      return (document.getElementById('pp-body').innerText.match(/\d+월 한 달, [^\n]*/) || [''])[0];
    });
    ok('[1] 세 글자 이름은 성을 뗀다 — 학부모 요약', /가은은/.test(r2), '"' + r2 + '"');

    // 오늘 몫을 다 하면 '오늘 몫 완료'
    const r3 = await page.evaluate(async t => {
      (_cache.assignments || []).forEach(a => (a.schedule || []).forEach(s => { if (s.date === t) s.done = true; }));
      loadParent('ux-s1');
      await new Promise(r => setTimeout(r, 600));
      return document.getElementById('pp-body').innerText;
    }, today);
    ok('[2] 오늘 몫을 다 하면 "오늘 몫 완료"', r3.indexOf('오늘 몫 완료') >= 0);

    // 카카오 연락처·납부 계좌가 있으면 넷
    const r4 = await page.evaluate(async t => {
      (_cache.assignments || []).forEach(a => (a.schedule || []).forEach(s => { if (s.date === t) delete s.done; }));
      _cache.settings.kakao = { openchat: 'https://open.kakao.example/x', phone: '' };
      _cache.settings.acct = { name: '보기 학원', bank: '보기은행', number: '000-00-0000' };
      loadParent('ux-s1');
      await new Promise(r => setTimeout(r, 600));
      return [...document.querySelectorAll('#s-parent .stu-bottomnav .stutab')].filter(b => b.offsetWidth > 0).map(b => b.dataset.ppnav);
    }, today);
    ok('[3] 카카오·결제 정보가 있으면 아래 메뉴가 넷', r4.length === 4, r4.join(','));

    // 공지 띠 — 보이는 기간 밖이면 뜨지 않는다
    const nb = await page.evaluate(async o => {
      const out = {};
      const set = ns => { _cache.notices = ns; showParentNoticeBanner(); return document.getElementById('parent-notice-banner').style.display; };
      out.future = set([{ id: 'ux-n1', text: '보기 공지 — 아직', active: true, date: o.today, from: o.tomorrow }]);
      out.past = set([{ id: 'ux-n2', text: '보기 공지 — 지났다', active: true, date: o.today, until: o.yest }]);
      out.old = set([{ id: 'ux-n3', text: '보기 공지 — 기간 없음', active: true, date: o.today }]);
      return out;
    }, { today, tomorrow: shift(today, 1), yest: shift(today, -1) });
    ok('[5] 학부모 띠 — 시작 전(from=내일)이면 안 보인다', nb.future === 'none');
    ok('[5] 학부모 띠 — 기간 지난 공지(until=어제)는 안 보인다', nb.past === 'none');
    ok('[5] 학부모 띠 — 기간 없는 옛 공지는 보인다', nb.old === 'block');
    await ctx.close();
  }

  // ═══ ② 학생 390x780 — 인사 · 퀘스트 · 공지 팝업 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'student', sid: 'ux-s1' }, { width: 390, height: 780 });
    const g = await page.evaluate(async t => {
      const draw = async () => { renderStudentHome('ux-s1'); await new Promise(r => setTimeout(r, 700)); };
      const title = () => (document.querySelector('.stu-hero-title') || {}).textContent || '';
      const mark = (id, on) => (_cache.assignments || []).forEach(a => { if (a.id === id) (a.schedule || []).forEach(s => { if (s.date === t) { if (on) s.done = true; else delete s.done; } }); });
      const out = {};
      await draw(); out.zero = title();
      out.slim = !!document.querySelector('#s-student .stu-hero.slim');
      out.quest = [...document.querySelectorAll('#stu-hw-card .hw-check-card .hw-ico')].map(i => {
        const r = i.parentElement.getBoundingClientRect();
        return { txt: (i.parentElement.textContent || '').replace(/\s+/g, ' ').slice(0, 16), top: Math.round(r.top), bottom: Math.round(r.bottom) };
      });
      // 아래 탭바는 화면에 붙어 있어 그 위까지가 '보이는 곳'
      const nav = document.querySelector('#s-student .stu-bottomnav');
      out.vh = Math.round(Math.min(window.innerHeight, nav ? nav.getBoundingClientRect().top : window.innerHeight));
      out.winH = window.innerHeight;
      mark('ux-a1', true); await draw(); out.half = title();
      mark('ux-a2', true); await draw(); out.full = title();
      mark('ux-a1', false); mark('ux-a2', false);
      return out;
    }, today);
    ok('[4] 한 것이 없으면 "잘했어" 가 아니다', g.zero.indexOf('잘했어') < 0 && /오늘도 시작해 볼까/.test(g.zero), '"' + g.zero + '"');
    ok('[1] 두 글자 이름은 그대로 — 학생 인사', /^가은아/.test(g.zero), '"' + g.zero + '"');
    ok('[4] 일부 했으면 다른 글', /조금만 더/.test(g.half) && g.half !== g.zero, '"' + g.half + '"');
    ok('[4] 다 했으면 "잘했어!"', /잘했어/.test(g.full) && g.full !== g.half, '"' + g.full + '"');
    ok('[4] 응원이 없으면 인사 카드를 낮춘다(slim)', g.slim === true);
    ok('[4] 퀘스트 카드 두 개의 제목이 첫 화면 안', g.quest.length >= 2 && g.quest[0].bottom <= g.vh && g.quest[1].bottom <= g.vh,
      g.quest.map(q => q.txt + '@' + q.top + '~' + q.bottom).join(' · ') + ' / 탭바 위 ' + g.vh + 'px (화면 ' + g.winH + ')');
    await page.evaluate(async () => { renderStudentHome('ux-s1'); await new Promise(r => setTimeout(r, 600)); });
    await page.screenshot({ path: path.join(OUT, 'student_0of2_390.png') }).catch(() => { });

    // 세 글자 이름 — 학생 인사
    const g2 = await page.evaluate(async () => {
      currentStudentSid = 'ux-s2';
      renderStudentHome('ux-s2');
      await new Promise(r => setTimeout(r, 600));
      return (document.querySelector('.stu-hero-title') || {}).textContent || '';
    });
    ok('[1] 세 글자 이름은 성을 뗀다 — 학생 인사', /^가은아/.test(g2), '"' + g2 + '"');

    // 공지 팝업 — 기간 · 셋 묶음 · [확인] 한 번
    const np = await page.evaluate(async o => {
      const out = {};
      currentStudentSid = 'ux-s1';
      const run = ns => { _cache.notices = ns; closeNotice(); try { localStorage.removeItem('pp_notice_read'); } catch (e) { } checkNotice(); return document.getElementById('notice-popup').style.display; };
      out.future = run([{ id: 'ux-n1', text: '보기 공지 — 아직', active: true, date: o.today, from: o.tomorrow }]);
      out.past = run([{ id: 'ux-n2', text: '보기 공지 — 지났다', active: true, date: o.today, until: o.yest }]);
      out.old = run([{ id: 'ux-n3', text: '보기 공지 — 기간 없음', active: true, date: o.today }]);
      closeNotice();
      out.three = run([
        { id: 'ux-m1', text: '보기 공지 하나', active: true, date: o.today },
        { id: 'ux-m2', text: '보기 공지 둘', active: true, date: o.today },
        { id: 'ux-m3', text: '보기 공지 셋', active: true, date: o.today },
      ]);
      out.txt = document.getElementById('notice-text').textContent;
      out.head = (document.getElementById('notice-head') || {}).textContent || '';
      return out;
    }, { today, tomorrow: shift(today, 1), yest: shift(today, -1) });
    await page.screenshot({ path: path.join(OUT, 'notice_popup_3.png') }).catch(() => { });
    // [확인] 한 번 — 셋 다 읽음
    const nc = await page.evaluate(async () => {
      document.querySelector('#notice-popup button').click();
      const afterClose = document.getElementById('notice-popup').style.display;
      checkNotice();
      return { afterClose, again: document.getElementById('notice-popup').style.display,
        read: (JSON.parse(localStorage.getItem('pp_notice_read') || '[]')).length };
    });
    ok('[5] 학생 팝업 — 시작 전(from=내일)이면 뜨지 않는다', np.future !== 'block');
    ok('[5] 학생 팝업 — 기간 지난 공지(until=어제)는 뜨지 않는다', np.past !== 'block');
    ok('[5] 학생 팝업 — 기간 없는 옛 공지는 뜬다', np.old === 'block');
    ok('[5] 안 읽은 공지 셋이면 팝업 하나에 모두', np.three === 'block'
      && ['하나', '둘', '셋'].every(w => np.txt.indexOf('보기 공지 ' + w) >= 0), '"' + np.head + '" / ' + np.txt.replace(/\n+/g, ' | '));
    ok('[5] [확인] 한 번으로 셋 다 읽음', nc.afterClose === 'none' && nc.again !== 'block' && nc.read === 3, '읽음 기록 ' + nc.read + '건');
    await ctx.close();
  }

  // ═══ ③ 선생님 1366x800 — 공지 목록 · 휴강 안내 · 수업 기록 ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'teacher' }, { width: 1366, height: 800 });
    const nl = await page.evaluate(async o => {
      _cache.notices = [
        { id: 'ux-n1', text: '보기 공지 — 아직', active: true, date: o.today, from: o.from },
        { id: 'ux-n2', text: '보기 공지 — 지났다', active: true, date: o.today, until: o.yest },
        { id: 'ux-n3', text: '보기 공지 — 기간 없음', active: true, date: o.today },
      ];
      swTab('t-dash');
      await new Promise(r => setTimeout(r, 500));
      renderDashNotice();
      await new Promise(r => setTimeout(r, 300));
      const txt = document.getElementById('notice-board').innerText;
      const dates = document.querySelectorAll('#notice-board input[type="date"]').length;
      // 옛 공지에 기간을 넣을 수 있다
      await noticeSetWindow('ux-n3', 'until', o.from);
      await new Promise(r => setTimeout(r, 300));
      const n3 = (_cache.notices || []).find(n => n.id === 'ux-n3') || {};
      return {
        all: ['아직', '지났다', '기간 없음'].every(w => txt.indexOf('보기 공지 — ' + w) >= 0),
        future: txt.indexOf('부터 보임') >= 0, past: txt.indexOf('기간 지남') >= 0,
        dates, set: n3.until || '', until: o.from,
        hasUntilBox: !!document.getElementById('dash-notice-until'),
      };
    }, { today, from: shift(today, 27), yest: shift(today, -1) });
    ok('[5] 선생님 목록에는 기간 밖 공지도 보인다', nl.all === true);
    ok('[5] 선생님 목록에 "…부터 보임" 이 글로 적힌다', nl.future === true);
    ok('[5] 선생님 목록에 "기간 지남" 이 글로 적힌다', nl.past === true);
    ok('[5] 목록 줄마다 기간을 고칠 수 있다 (옛 공지에도)', nl.dates >= 6 && nl.set === nl.until, '날짜 칸 ' + nl.dates + '개 · 넣은 값 ' + nl.set);
    ok('[5] 공지 빠른 등록에 "언제까지" 칸', nl.hasUntilBox === true);

    // 휴강 안내 — from = 휴강 14일 전 · until = 휴강 날
    const sn = await page.evaluate(async () => {
      openSkipNotice('ux-c1', '2026-12-25');
      await new Promise(r => setTimeout(r, 300));
      const f = (document.getElementById('skip-notice-from') || {}).value || '';
      const u = (document.getElementById('skip-notice-until') || {}).value || '';
      skipNoticeClose();
      openSkipNotice('ux-c1', ['2026-12-25', '2027-01-01']);
      await new Promise(r => setTimeout(r, 300));
      const f2 = (document.getElementById('skip-notice-from') || {}).value || '';
      const u2 = (document.getElementById('skip-notice-until') || {}).value || '';
      skipNoticeClose();
      return { f, u, f2, u2 };
    });
    ok('[5] 휴강 안내 12/25 → 보이는 기간 12/11 ~ 12/25', sn.f === '2026-12-11' && sn.u === '2026-12-25', sn.f + ' ~ ' + sn.u);
    ok('[5] 기간 휴강이면 첫날 2주 전 ~ 마지막 날', sn.f2 === '2026-12-11' && sn.u2 === '2027-01-01', sn.f2 + ' ~ ' + sn.u2);

    // 수업 기록 — [저장하기]·기록 칸 폭·가로 스크롤
    const cl = await page.evaluate(async () => {
      swTab('t-class');
      await new Promise(r => setTimeout(r, 400));
      openClsDetail('ux-c1');
      await new Promise(r => setTimeout(r, 400));
      openClassLesson('ux-c1', ppToday());
      await new Promise(r => setTimeout(r, 900));
      const split = document.getElementById('cls-split');
      const rec = document.getElementById('cls-record-col'), mid = document.getElementById('cls-detail-col');
      const body = document.getElementById('cls-lessons-body'), inner = document.querySelector('.cls-record-inner');
      const btn = document.getElementById('cl-save-btn'), b = btn.getBoundingClientRect();
      const unit = document.querySelector('#cl-subj-rows input[data-f="unit"]');
      const over = el => el ? (el.scrollWidth - el.clientWidth) : 0;
      const out = {
        fold: split.classList.contains('rec-fold'),
        listW: (split.querySelector('.cls-list-col') || {}).offsetWidth || 0,
        recW: rec.offsetWidth, midW: mid.offsetWidth,
        xover: [over(body), over(inner), over(mid), over(document.documentElement)],
        btnIn: b.top >= 0 && b.bottom <= window.innerHeight + 1, btnTop: Math.round(b.top),
        btnHit: (() => { const el = document.elementFromPoint(Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2)); return !!(el && (el === btn || btn.contains(el))); })(),
        unitVal: unit ? unit.value : '', unitW: unit ? Math.round(unit.getBoundingClientRect().width) : 0,
        unitFits: unit ? (unit.scrollWidth <= unit.clientWidth + 1) : false,
      };
      return out;
    });
    ok('[6] 1366px — [저장하기] 가 스크롤 없이 화면 안 (가려지지도 않는다)', cl.btnIn === true && cl.btnHit === true, '단추 top ' + cl.btnTop + 'px');
    ok('[6] 1366px — 목록을 접어 기록 칸이 560px 이상', cl.fold === true && cl.recW >= 560, '기록 ' + cl.recW + 'px · 가운데 ' + cl.midW + 'px · 목록 ' + cl.listW + 'px');
    ok('[6] 1366px — 가로 스크롤이 없다', cl.xover.every(v => v <= 0), '넘침 ' + cl.xover.join('/') + 'px');
    ok('[6] 1366px — 20자 단원 이름이 잘리지 않는다', cl.unitVal === 'Unit 4 On the Farm' && cl.unitFits === true, '단원 칸 ' + cl.unitW + 'px "' + cl.unitVal + '"');
    await page.screenshot({ path: path.join(OUT, 'teacher_1366.png') }).catch(() => { });
    const back = await page.evaluate(async () => {
      closeClsRecord();
      await new Promise(r => setTimeout(r, 300));
      const split = document.getElementById('cls-split');
      return { fold: split.classList.contains('rec-fold'), listW: (split.querySelector('.cls-list-col') || {}).offsetWidth || 0 };
    });
    ok('[6] 기록을 닫으면 목록이 돌아온다', back.fold === false && back.listW > 0, '목록 ' + back.listW + 'px');
    // 자리를 옮겼어도 서버 제한 중 꺼짐 표시는 그대로여야 한다
    const lim = await page.evaluate(async () => {
      ppLimitOn('검사');
      await new Promise(r => setTimeout(r, 200));
      const off = !!document.getElementById('cl-save-btn').disabled;
      ppLimitOff();
      await new Promise(r => setTimeout(r, 200));
      return { off, back: !!document.getElementById('cl-save-btn').disabled };
    });
    ok('[6] 서버 제한 중에는 [저장하기] 가 꺼진다 (자리를 옮겨도 그대로)', lim.off === true && lim.back === false);
    await ctx.close();
  }

  // ═══ ④ 선생님 390x780 — 수업 기록(폰) ═══
  {
    const { ctx, page } = await makePage(browser, { role: 'teacher' }, { width: 390, height: 780 });
    const cl = await page.evaluate(async () => {
      swTab('t-class');
      await new Promise(r => setTimeout(r, 400));
      openClsDetail('ux-c1');
      await new Promise(r => setTimeout(r, 300));
      openClassLesson('ux-c1', ppToday());
      await new Promise(r => setTimeout(r, 900));
      const btn = document.getElementById('cl-save-btn'), b = btn.getBoundingClientRect();
      const el = document.elementFromPoint(Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2));
      const unit = document.querySelector('#cl-subj-rows input[data-f="unit"]');
      return {
        btnIn: b.top >= 0 && b.bottom <= window.innerHeight + 1, btnTop: Math.round(b.top),
        btnHit: !!(el && (el === btn || btn.contains(el))), hit: el ? (el.id || el.className || el.tagName) : '',
        unitVal: unit ? unit.value : '', unitFits: unit ? (unit.scrollWidth <= unit.clientWidth + 1) : false,
        xover: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    ok('[6] 390px — [저장하기] 가 스크롤 없이 화면 안 (가려지지도 않는다)', cl.btnIn === true && cl.btnHit === true,
      '단추 top ' + cl.btnTop + 'px · 그 자리의 요소 "' + cl.hit + '"');
    ok('[6] 390px — 20자 단원 이름이 잘리지 않는다', cl.unitVal === 'Unit 4 On the Farm' && cl.unitFits === true, '"' + cl.unitVal + '"');
    ok('[6] 390px — 가로 넘침 0', cl.xover <= 0, cl.xover + 'px');
    await page.screenshot({ path: path.join(OUT, 'teacher_390.png') }).catch(() => { });
    await ctx.close();
  }

  console.log('\n가짜 서버가 받은 요청 — 읽기 ' + reqs.get + ' · 쓰기 ' + reqs.write + ' (전부 가짜)');
  console.log('콘솔 오류 ' + errs.length + '건');
  errs.slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_ux1 실패:', e); process.exit(1); });
