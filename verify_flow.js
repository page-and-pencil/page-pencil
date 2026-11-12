// Page & Pencil — '같은 사실은 한 곳에서' 점검 (node verify_flow.js)
//
// 숙제·진도 판정이 화면마다 어긋나던 것을 공용 함수로 모았다(utils.js hwState·ppFlow 등).
// 이 파일은 **가짜 데이터**로 그 판정들을 확인한다. 네트워크도, 실제 학생 데이터도 쓰지 않는다.
//   · 앱 파일(js/utils.js·js/db.js·js/teacher.js)을 node 안에 그대로 올리고
//   · _cache 에 가짜 반·학생·교재·수업 기록·숙제를 넣은 뒤
//   · 화면이 쓰는 함수를 직접 불러 값을 확인한다.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = __dirname;

// ── 아주 작은 DOM 흉내 (화면 함수가 멈추지 않을 만큼만) ──
function mkEl(id) {
  const e = {
    id: id || '', style: {}, dataset: {}, value: '', textContent: '', innerHTML: '', checked: false,
    options: [], children: [],
    classList: { add() { }, remove() { }, contains() { return false; }, toggle() { } },
    appendChild() { }, removeChild() { }, remove() { }, setAttribute() { }, getAttribute() { return null; },
    addEventListener() { }, removeEventListener() { }, querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, focus() { }, click() { }, scrollIntoView() { }, insertAdjacentHTML() { },
  };
  return e;
}
function makeCtx() {
  const els = {};
  const doc = {
    getElementById(id) { return els[id] || (els[id] = mkEl(id)); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return mkEl(); }, addEventListener() { }, removeEventListener() { },
    body: mkEl(), documentElement: mkEl(), head: mkEl(), cookie: '', readyState: 'complete',
  };
  const store = () => ({ d: {}, getItem(k) { return this.d[k] === undefined ? null : this.d[k]; }, setItem(k, v) { this.d[k] = String(v); }, removeItem(k) { delete this.d[k]; } });
  const sb = {
    console, document: doc, localStorage: store(), sessionStorage: store(),
    navigator: { userAgent: 'node' }, location: { href: '', search: '', pathname: '/' },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => ({ ok: false, status: 0, headers: { get: () => null }, json: async () => ({}), text: async () => '' }),
    alert() { }, confirm() { return false; }, requestAnimationFrame(f) { return setTimeout(f, 0); },
    URL, URLSearchParams, AbortController, TextEncoder, TextDecoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    crypto: require('crypto').webcrypto,
    addEventListener() { }, removeEventListener() { }, matchMedia() { return { matches: false, addEventListener() { } }; },
    innerWidth: 1440, innerHeight: 900, open() { return null; },
  };
  sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.els = els;
  vm.createContext(sb);
  ['js/utils.js', 'js/db.js', 'js/teacher.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  });
  // const/function 은 vm 바깥에서 보이지 않으므로 다리를 놓는다
  vm.runInContext(`globalThis.__app={cache:_cache,DB,
    hwState,hwIsBookFlow,hwFinished,hwOverdueDays,hwDayStatus,ppHwUnitSync,ppApplyUnitSync,ppHwRuleLabel,
    ppFlow,ppFlowForStudent,ppHwBanner,ppBookPath,ppBookPathLineHtml,ppToday,ppShiftDate,
    _pgComposePlan,_pgActiveMats,_pgActiveMatPick,_pgTrackBoardHtml,renderAssignStats,bookIsRecurHw};`, sb);
  return Object.assign(sb.__app, { els: els });
}
const A = makeCtx();
const TODAY = A.ppToday();
const D = n => A.ppShiftDate(TODAY, n);

// ── 가짜 데이터 ──
const SID = 'stu-test-1';
const CID = 'cls-test-1';
function units(n, pre) { const o = {}; for (let i = 1; i <= n; i++)o[(pre || 'Day ') + i] = [{ word: 'w' + i, ko: '뜻' + i }]; return o; }
function reset(opts) {
  const o = opts || {};
  const c = A.cache;
  c.students = [{ id: SID, name: '가나다', grade: '초6' }];
  c.globalClasses = [{ id: CID, name: '테스트반', active: true, studentIds: [SID], days: o.days || ['월', '화', '수', '목', '금', '토', '일'], commonMaterials: o.mats || {} }];
  c.globalTextbooks = o.books || [];
  c.lessons = o.lessons || [];
  c.assignments = o.assigns || [];
  c.homeworks = []; c.textbooks = []; c.vocab_cards = []; c.readings = []; c.tests = []; c.logs = [];
  return c;
}
const BOOK = (id, title, n, pre, extra) => Object.assign({ id, title, category: '어휘', units: units(n, pre), totalUnits: n }, extra || {});
const LESSON = (date, key, book, bookId, unit) => ({ id: 'les-' + date + '-' + key, sid: SID, classId: CID, date, att: 'normal', materials: { [key]: { book, bookId, unit } } });
const HW = (id, bookId, bookTitle, rows, extra) => Object.assign({
  id, sid: SID, type: 'recur', category: 'recur', recurRule: 'daily', bookId, bookTitle,
  date: rows[0] && rows[0].date, due: rows[rows.length - 1] && rows[rows.length - 1].date, schedule: rows,
}, extra || {});

// ── 결과 모으기 ──
let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✅ ' + name + (note ? ' — ' + note : '')); }
  else { fail++; console.log('  ❌ ' + name + (note ? ' — ' + note : '')); }
};

// ─────────────────────────────────────────────────────────────
console.log('\nD1. A책 숙제 끝 + B책 숙제(auto=false) 진행 중 → 배너 없음');
{
  const tbA = BOOK('tbA', '테스트 어휘 A', 3), tbB = BOOK('tbB', '테스트 어휘 B', 6);
  reset({
    books: [tbA, tbB],
    mats: { vocab: { book: tbA.title, bookId: 'tbA', unit: 'Day 1', run: 'hw' }, vocab_2: { book: tbB.title, bookId: 'tbB', unit: 'Day 1' } },
    lessons: [LESSON(D(-7), 'vocab', tbA.title, 'tbA', 'Day 3')],          // A 는 끝까지 나갔다
    assigns: [
      HW('hwA', 'tbA', tbA.title, [1, 2, 3].map((i, k) => ({ date: D(-10 + k), book: tbA.title, unit: 'Day ' + i, done: true, doneBy: 'student' })), { auto: true }),
      // B 는 선생님이 일정을 손으로 고쳐 auto 가 꺼진 교재형 숙제 — 한창 진행 중이다
      HW('hwB', 'tbB', tbB.title, [1, 2, 3, 4].map((i, k) => ({ date: D(k), book: tbB.title, unit: 'Day ' + i })), { auto: false }),
    ],
  });
  const bn = A.ppHwBanner(SID);
  ok('배너가 뜨지 않는다', bn.length === 0, '배너 ' + bn.length + '개' + (bn.length ? ' (' + bn.map(x => x.kind).join(',') + ')' : ''));
  ok('auto 가 꺼져도 교재형 숙제로 본다', A.hwIsBookFlow(A.cache.assignments[1]) === true, 'hwIsBookFlow(hwB)=' + A.hwIsBookFlow(A.cache.assignments[1]));
  const flow = A.ppFlowForStudent(SID);
  const t = flow[0].tracks[0];
  ok("지금 책은 B, 숙제 id 가 붙는다", t.now && t.now.tb.id === 'tbB' && t.now.hwId === 'hwB', '지금=' + (t.now && t.now.tb.title) + ' / hwId=' + (t.now && t.now.hwId));
  // 숙제를 지우면 '숙제가 아직 없어요' 가 떠야 한다
  A.cache.assignments = [A.cache.assignments[0]];
  const bn2 = A.ppHwBanner(SID);
  ok("숙제가 없으면 '숙제 내기'를 알린다", bn2.length === 1 && bn2[0].kind === 'need-hw' && bn2[0].title === '테스트 어휘 B',
    bn2.map(x => x.kind + ':' + x.title + ' ' + x.unit).join(' / '));
}

console.log('\nD2. 일정 3/3 완료·completedAt 없음·마감 지남 → 진행 중 아님, 밀림 아님');
{
  const tbA = BOOK('tbA', '테스트 어휘 A', 3);
  reset({
    books: [tbA], mats: {},
    assigns: [HW('hw1', 'tbA', tbA.title, [1, 2, 3].map((i, k) => ({ date: D(-5 + k), book: tbA.title, unit: 'Day ' + i, done: true, doneBy: 'student' })), { auto: false })],
  });
  const st = A.hwState(A.cache.assignments[0], TODAY);
  ok('끝난 것으로 본다', st.finished === true, 'finished=' + st.finished + ' · ' + st.doneCount + '/' + st.total);
  ok('밀린 날 0', st.overdueRows14 === 0 && st.overdueRows === 0, 'overdue=' + st.overdueRows + ' (최근 2주 ' + st.overdueRows14 + ')');
  ok('hwOverdueDays 도 0', A.hwOverdueDays(A.cache.assignments[0], TODAY, 14) === 0, '' + A.hwOverdueDays(A.cache.assignments[0], TODAY, 14));
  // 숫자 카드까지 — 진행 중 0건 · 미제출(지남) 0건
  A.renderAssignStats();
  const nums = (A.els['assign-stats'].innerHTML.match(/dash-stat-num[^>]*>(\d+)/g) || []).map(x => x.replace(/\D/g, ''));
  ok('숫자 카드: 진행 중 0 · 미제출 0', nums[0] === '0' && nums[2] === '0', '진행 중 ' + nums[0] + ' · 오늘 마감 ' + nums[1] + ' · 미제출 ' + nums[2]);
}

console.log('\nD3. 다른 숙제의 일정에만 이름이 있는 수업 책 → 예정에 정상으로 깔린다');
{
  const tb1 = BOOK('tbL1', '테스트 리스닝 1', 4, 'Unit '), tb2 = BOOK('tbL2', '테스트 리스닝 2', 4, 'Unit ');
  reset({
    books: [tb1, tb2],
    mats: {
      listening: { book: tb1.title, bookId: 'tbL1', unit: 'Unit 1', run: 'class' },
      listening_2: { book: tb2.title, bookId: 'tbL2', unit: 'Unit 1' },
    },
    lessons: [LESSON(D(-3), 'listening', tb1.title, 'tbL1', 'Unit 2')],     // 2단원까지 나갔다 (2단원 남음)
    assigns: [
      // 온라인 복습용 반복 숙제 — bookId 가 없고, 일정 줄에 리스닝 1 이름만 적혀 있다
      { id: 'hwApp', sid: SID, category: 'recur', recurRule: 'daily', bookTitle: '온라인 복습', auto: false,
        date: D(0), due: D(5), schedule: [0, 1, 2].map(k => ({ date: D(k), book: '테스트 리스닝 1', unit: '복습' })) },
    ],
  });
  ok('bookIsRecurHw 가 더 이상 오판하지 않는다', A.bookIsRecurHw(SID, '테스트 리스닝 1') === false, '' + A.bookIsRecurHw(SID, '테스트 리스닝 1'));
  const plan = A._pgComposePlan(CID, A.DB.classes()[0], D(60));
  const g1 = [], g2 = [];
  Object.entries(plan.ghostBy || {}).forEach(([d, list]) => (list || []).forEach(g => { if (g.tbId === 'tbL1') g1.push(d); if (g.tbId === 'tbL2') g2.push(d); }));
  g1.sort(); g2.sort();
  ok('리스닝 1 의 남은 2단원이 예정에 깔린다', g1.length === 2, '칩 ' + g1.length + '개 ' + g1.join(','));
  ok('다음 책은 그 뒤에 깔린다', g2.length > 0 && g1.length > 0 && g2[0] > g1[g1.length - 1], '리스닝1 마지막 ' + g1[g1.length - 1] + ' → 리스닝2 첫 ' + (g2[0] || '없음'));
  const board = A._pgTrackBoardHtml(CID);
  ok('보드에 1년 내 미완이 아니라 완료 예정일(eta)이 나온다', board.indexOf('1년 내 미완') < 0 && board.indexOf('~') > 0, board.indexOf('1년 내 미완') < 0 ? 'eta 있음' : '아직 1년 내 미완');
  const flow = A.ppFlow(CID);
  const t = flow[0].tracks[0];
  ok('지금 책은 리스닝 1 (2/4)', t.now && t.now.tb.id === 'tbL1' && t.now.doneIdx + 1 === 2, (t.now ? t.now.tb.title + ' ' + (t.now.doneIdx + 1) + '/' + t.now.total : '없음'));
}

console.log('\nD4. auto=false 교재형 숙제가 수업 진도를 따라간다 (날짜는 그대로, 단원만)');
{
  const tb = BOOK('tbB', '테스트 교재 B', 6);
  reset({
    books: [tb],
    mats: { vocab: { book: tb.title, bookId: 'tbB', unit: 'Day 1', run: 'hw' } },
    lessons: [LESSON(D(-4), 'vocab', tb.title, 'tbB', 'Day 1, Day 2, Day 3')],   // 수업은 Day 3 까지
    assigns: [HW('hwB', 'tbB', tb.title, [
      { date: D(-1), book: tb.title, unit: 'Day 2' },
      { date: D(1), book: tb.title, unit: 'Day 3' },
      { date: D(2), book: tb.title, unit: 'Day 4' },
      { date: D(3), book: tb.title, unit: 'Day 5' },
    ], { auto: false })],
  });
  const a = A.cache.assignments[0];
  const before = a.schedule.map(s => s.date + ':' + s.unit).join(' | ');
  const changed = A.ppApplyUnitSync(a);
  const after = a.schedule.map(s => s.date + ':' + s.unit + (s.done ? '(' + (s.doneBy || '✓') + ')' : '')).join(' | ');
  ok('맞췄다', changed === true, '전: ' + before + '\n        후: ' + after);
  const r0 = a.schedule.find(s => s.date === D(-1));
  ok('어제 몫(Day 2)은 수업 처리로 완료', !!r0 && r0.done === true && r0.doneBy === 'lesson', r0 ? r0.unit + ' done=' + r0.done + ' by=' + r0.doneBy : '없음');
  const r1 = a.schedule.find(s => s.date === D(1));
  ok('내일 몫은 Day 4 (Day 3 은 수업에서 나갔다)', !!r1 && r1.unit === 'Day 4', r1 ? r1.unit : '없음');
  ok('날짜 목록은 그대로, 끝에서 하나만 줄었다', a.schedule.length === 3 && a.schedule[0].date === D(-1) && a.schedule[a.schedule.length - 1].date === D(2),
    a.schedule.map(s => s.date).join(','));
  ok('직전 일정이 남는다 (되돌리기용)', (a.schedulePrev || []).length === 4 && !!a.schedulePrevAt, 'schedulePrev ' + (a.schedulePrev || []).length + '줄');
  const again = A.ppApplyUnitSync(a);
  ok('한 번 더 돌려도 바뀌지 않는다', again === false, 'changed=' + again);
  // 학생·학부모·선생님이 보는 '지금 일정'이 같다
  const st = A.hwState(a, TODAY);
  ok('밀린 날로 세지 않는다 (수업 처리 몫)', st.overdueRows === 0, 'overdue=' + st.overdueRows);
  const day = A.hwDayStatus(SID, D(1));
  ok('그 날 할 일에도 같은 값이 보인다', day.total === 1 && day.done === 0, D(1) + ' ' + day.done + '/' + day.total);
}

console.log('\nD5. 한 영역에 줄이 둘 → 지금 책도 둘, 모든 화면이 같은 두 권');
{
  const tbV1 = BOOK('tbV1', '테스트 어휘 과제책', 5), tbV2 = BOOK('tbV2', '테스트 어휘 수업책', 5, 'Unit ');
  reset({
    books: [tbV1, tbV2],
    mats: {
      vocab: { book: tbV1.title, bookId: 'tbV1', unit: 'Day 1', run: 'hw' },
      vocab_2: { book: tbV2.title, bookId: 'tbV2', unit: 'Unit 1', run: 'class' },
    },
    lessons: [LESSON(D(-2), 'vocab_2', tbV2.title, 'tbV2', 'Unit 1')],
    assigns: [HW('hwV1', 'tbV1', tbV1.title, [1, 2].map((i, k) => ({ date: D(k), book: tbV1.title, unit: 'Day ' + i })), { auto: false })],
  });
  const flow = A.ppFlow(CID);
  const area = flow.find(x => x.area === 'vocab');
  const nows = (area.tracks || []).map(t => t.now && t.now.tb.title).filter(Boolean);
  ok('ppFlow 가 지금 책 둘을 돌려준다', nows.length === 2 && nows.indexOf('테스트 어휘 과제책') >= 0 && nows.indexOf('테스트 어휘 수업책') >= 0, nows.join(' / '));
  ok('줄 방식도 각각 (과제 줄 / 수업 줄)', area.tracks.map(t => t.mode).join(',') === 'hw,class', area.tracks.map(t => t.mode).join(','));
  const am = A._pgActiveMats(CID, A.DB.classes()[0]);
  ok('수업 기록 창도 두 권을 채운다', Object.keys(am).length === 2, Object.entries(am).map(([k, v]) => k + '=' + v.book).join(' / '));
  const pick = A._pgActiveMatPick(CID, A.DB.classes()[0], 'vocab');
  ok('한 권만 필요한 곳은 과제 줄 책을 고른다', !!pick && pick[1].bookId === 'tbV1', pick ? pick[1].book : '없음');
  const bp = A.ppBookPath(SID, CID).find(x => x.area === 'vocab');
  ok('교재 여정도 지금 책 둘', bp && bp.now.length === 2, bp ? bp.now.map(x => x.title + ' ' + x.n + '/' + x.total).join(' / ') : '없음');
  const line = A.ppBookPathLineHtml([SID], CID);
  ok('대시보드 반별 진도에도 둘 다', line.indexOf('테스트 어휘 과제책') >= 0 && line.indexOf('테스트 어휘 수업책') >= 0, '두 권 모두 보임');
}

console.log('\nD6. 단원 16개(Review 4개 포함)·마지막 기록 14번째 → 어디서나 14/16');
{
  const keys = ['Unit 1', 'Unit 2', 'Unit 3', 'Review 1', 'Unit 4', 'Unit 5', 'Unit 6', 'Review 2',
    'Unit 7', 'Unit 8', 'Unit 9', 'Review 3', 'Unit 10', 'Unit 11', 'Unit 12', 'Review 4'];
  const u = {}; keys.forEach(k => { u[k] = [{ word: 'w', ko: '뜻' }]; });
  const tb = { id: 'tbR', title: '테스트 리딩 16과', category: '리딩', units: u, unitOrder: keys, totalUnits: 16 };
  reset({
    books: [tb],
    mats: { reading: { book: tb.title, bookId: 'tbR', unit: 'Unit 1', run: 'class' } },
    lessons: [LESSON(D(-2), 'reading', tb.title, 'tbR', 'Unit 11')],       // 14번째 키
  });
  const flow = A.ppFlow(CID);
  const now = flow[0].tracks[0].now;
  ok('ppFlow: 14/16', now && now.doneIdx + 1 === 14 && now.total === 16, now ? (now.doneIdx + 1) + '/' + now.total : '없음');
  const bp = A.ppBookPath(SID, CID).find(x => x.area === 'reading');
  ok('교재 여정: 14/16', bp && bp.now[0] && bp.now[0].n === 14 && bp.now[0].total === 16, bp && bp.now[0] ? bp.now[0].n + '/' + bp.now[0].total : '없음');
  const line = A.ppBookPathLineHtml([SID], CID);
  ok('대시보드 반별 진도: 14/16', line.indexOf('>14/16<') >= 0, line.indexOf('>14/16<') >= 0 ? '14/16' : line.slice(0, 120));
  const board = A._pgTrackBoardHtml(CID);
  ok('진도 보드: 14/16', board.indexOf('14<em>/16</em>') >= 0, board.indexOf('14<em>/16</em>') >= 0 ? '14/16' : '다름');
}

console.log('\nD7. 학생이 체크한 줄은 자동 맞춤이 건드리지 않는다');
{
  const tb = BOOK('tbB', '테스트 교재 B', 6);
  reset({
    books: [tb],
    mats: { vocab: { book: tb.title, bookId: 'tbB', unit: 'Day 1', run: 'hw' } },
    lessons: [LESSON(D(-4), 'vocab', tb.title, 'tbB', 'Day 1, Day 2, Day 3')],
    assigns: [HW('hwB', 'tbB', tb.title, [
      { date: D(-1), book: tb.title, unit: 'Day 2', done: true, doneBy: 'student', doneAt: '2026-01-01T00:00:00Z' },
      { date: D(1), book: tb.title, unit: 'Day 3', done: true, doneBy: 'student', doneAt: '2026-01-01T00:00:00Z' },
      { date: D(2), book: tb.title, unit: 'Day 4' },
      { date: D(3), book: tb.title, unit: 'Day 5' },
    ], { auto: false })],
  });
  const a = A.cache.assignments[0];
  A.ppApplyUnitSync(a);
  const r0 = a.schedule.find(s => s.date === D(-1));
  const r1 = a.schedule.find(s => s.date === D(1));
  ok('학생이 체크한 지난 줄 그대로', !!r0 && r0.unit === 'Day 2' && r0.doneBy === 'student', r0 ? r0.unit + '/' + r0.doneBy : '없음');
  ok('학생이 체크한 앞으로의 줄도 그대로', !!r1 && r1.unit === 'Day 3' && r1.doneBy === 'student', r1 ? r1.unit + '/' + r1.doneBy : '없음');
  const rest = a.schedule.filter(s => s.date > D(1)).map(s => s.unit);
  ok('나머지 줄만 당겨진다', rest.join(',') === 'Day 4,Day 5', rest.join(','));
}

console.log('\n추가. 반복 숙제 이름표는 일정의 실제 요일로');
{
  const tb = BOOK('tbB', '테스트 교재 B', 8);
  // 월·화·수·금만 남긴 일정 (규칙은 noclass 로 적혀 있지만 실제와 다르다)
  const mon = (() => { let d = new Date(TODAY + 'T12:00:00'); while (d.getDay() !== 1) d.setDate(d.getDate() + 1); return d; })();
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const rows = [0, 1, 2, 4].map((off, i) => { const d = new Date(mon); d.setDate(mon.getDate() + off); return { date: ymd(d), book: tb.title, unit: 'Day ' + (i + 1) }; });
  reset({ books: [tb], mats: {}, assigns: [HW('hwB', 'tbB', tb.title, rows, { auto: false, recurRule: 'noclass' })] });
  const lbl = A.ppHwRuleLabel(A.cache.assignments[0]);
  ok("실제 요일로 부른다", lbl === '월·화·수·금', lbl);
}

console.log('\n추가2. 끝난 과제 줄 옆에서 다른 과제 줄이 돌고 있으면 보채지 않는다');
{
  const tbA = BOOK('tbA', '테스트 어휘 A', 2), tbC = BOOK('tbC', '테스트 어휘 C', 5);
  reset({
    books: [tbA, tbC],
    mats: {
      vocab: { book: tbA.title, bookId: 'tbA', unit: 'Day 1', run: 'hw' },        // 이 줄은 끝났다
      vocab_2: { book: tbC.title, bookId: 'tbC', unit: 'Day 1', run: 'hw' },      // 새 과제 줄이 돈다
    },
    lessons: [LESSON(D(-9), 'vocab', tbA.title, 'tbA', 'Day 2')],
    assigns: [
      HW('hwA', 'tbA', tbA.title, [1, 2].map((i, k) => ({ date: D(-9 + k), book: tbA.title, unit: 'Day ' + i, done: true, doneBy: 'student' })), { auto: false }),
      HW('hwC', 'tbC', tbC.title, [1, 2, 3].map((i, k) => ({ date: D(k), book: tbC.title, unit: 'Day ' + i })), { auto: false }),
    ],
  });
  const flow = A.ppFlowForStudent(SID);
  const area = flow.find(x => x.area === 'vocab');
  ok('줄 둘 중 하나는 끝, 하나는 진행', area.tracks.length === 2 && !area.tracks[0].now && !!area.tracks[1].now,
    area.tracks.map(t => t.now ? t.now.tb.title : '(줄 끝)').join(' / '));
  const bn = A.ppHwBanner(SID);
  ok('배너 없음', bn.length === 0, bn.map(x => x.kind + ':' + x.title).join(',') || '없음');
  // 도는 줄이 없으면 그때는 알린다
  A.cache.globalClasses[0].commonMaterials = { vocab: { book: tbA.title, bookId: 'tbA', unit: 'Day 1', run: 'hw' } };
  const bn2 = A.ppHwBanner(SID);
  ok('도는 줄이 없으면 다음 교재를 알린다', bn2.length === 1 && bn2[0].kind === 'pick-next', bn2.map(x => x.kind + ':' + x.title).join(','));
}

console.log('\n' + (fail ? '❌' : '✅') + ' 통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
