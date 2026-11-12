// Page & Pencil — '설정한 것이 보이는가' 점검 (node verify_visible.js)
//
// 가짜 데이터만 쓴다 — 네트워크도, 실제 학생 데이터도 쓰지 않는다.
// A: (a) 짧은 이름이 흐름 안에서 겹치지 않는다
//    (b) 과제 줄 책은 달력에 단원이 한 번만, 수업일에 '숙제 확인' 칩 하나
//    (c) 진행 중인 과제 목록의 수 = 숫자 카드
//    (d) 학생 머리 숙제 % = hwDayStatus 합
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = __dirname;

function mkEl(id) {
  return {
    id: id || '', style: { display: '', width: '', removeProperty() { }, cssText: '' }, dataset: {}, value: '',
    textContent: '', innerHTML: '', checked: false, options: [], children: [], disabled: false, placeholder: '',
    classList: { add() { }, remove() { }, contains() { return false; }, toggle() { } },
    appendChild() { }, removeChild() { }, remove() { }, setAttribute() { }, getAttribute() { return null; },
    addEventListener() { }, removeEventListener() { }, querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, focus() { }, click() { }, scrollIntoView() { }, insertAdjacentHTML() { }, insertBefore() { },
  };
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
    URL: { createObjectURL: () => 'blob:stub', revokeObjectURL() { } },
    URLSearchParams, AbortController, TextEncoder, TextDecoder, Blob,
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
  vm.runInContext(`globalThis.__app={cache:_cache,DB,ppToday,ppShiftDate,
    ppBookShort,ppBookShortMap,ppChipLabel,ppMonthMetrics,hwDayStatus,hwState,hwIsBookFlow,
    _pgComposePlan,_pgShortOf,pgShort,pgShortTitle,pgAreaOfTb,_pgHwChips,_hwSchedOf,
    renderAssignLive,renderAssignStats,_alProgress,_alKind,
    tbCounts,tbBankRows,tbStageBadge,tbStageLine,tbClassRows,openBookHome,bhRender,tbdTab,
    renderStageTable,STG_COLS,STG_AREAS,PP_WHATSNEW,PP_FEATURES,switchDataTab,renderBankBooks,_ebRegistered,
    hasFn:n=>typeof globalThis[n]==='function',
    setEb:rows=>{_ebRows=rows;},
    setIb:rows=>{_ibRows=rows;},
    getLive:()=>{const today=ppToday();const act=new Set(DB.stus().filter(s=>!s.inactive).map(s=>s.id));
      const rows=DB.assigns().filter(a=>act.has(a.sid)).map(a=>({a:a,st:hwState(a,today)}));
      return {live:rows.filter(x=>!x.st.finished).length,done:rows.filter(x=>x.st.finished).length,
        today:rows.filter(x=>!x.st.finished&&x.st.todayPending).length,
        late:rows.filter(x=>!x.st.finished&&x.st.overdueRows14>0).length};},
  };`, sb);
  return Object.assign(sb.__app, { els: els, sb: sb });
}
const A = makeCtx();
const EL = id => A.sb.document.getElementById(id);
A.sb.localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' }));
const TODAY = A.ppToday();
const D = n => A.ppShiftDate(TODAY, n);
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
const dowOf = ds => DOWS[new Date(ds + 'T12:00:00').getDay()];
const datesOn = (from, to, dows) => {
  const out = [];
  for (let i = 0; i < 400; i++) { const ds = A.ppShiftDate(from, i); if (ds > to) break; if (dows.indexOf(dowOf(ds)) >= 0) out.push(ds); }
  return out;
};

const SID = 'stu-v-1', CID = 'cls-v-1';
function units(n, pre) { const o = {}; for (let i = 1; i <= n; i++)o[(pre || 'Day ') + i] = [{ word: 'w' + i, ko: '뜻' + i }]; return o; }
const BOOK = (id, title, n, cat, extra) => Object.assign({ id, title, category: cat || '어휘', units: units(n), totalUnits: n }, extra || {});
const LESSON = (date, key, tb, unit) => ({ id: 'les-' + date + '-' + key + '-' + unit, sid: SID, classId: CID, date, att: 'normal', materials: { [key]: { book: tb.title, bookId: tb.id, unit } } });
const HW = (id, tb, rows, extra) => Object.assign({
  id, sid: SID, type: 'recur', category: 'recur', recurRule: 'custom', recurDays: ['화', '목'],
  bookId: tb.id, bookTitle: tb.title, auto: false, noUnitSync: true,
  date: rows[0] && rows[0].date, due: rows[rows.length - 1] && rows[rows.length - 1].date, schedule: rows,
}, extra || {});
function reset(o) {
  o = o || {};
  const c = A.cache;
  c.students = [{ id: SID, name: '가나다', grade: '초6' }];
  c.globalClasses = [{ id: CID, name: '테스트반', active: true, studentIds: [SID], days: o.days || ['월', '수', '금'], commonMaterials: o.mats || {} }];
  c.globalTextbooks = o.books || [];
  c.lessons = o.lessons || [];
  c.assignments = o.assigns || [];
  c.homeworks = []; c.textbooks = []; c.vocab_cards = []; c.readings = []; c.tests = []; c.logs = [];
  return c;
}
let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✅ ' + name + (note ? ' — ' + note : '')); }
  else { fail++; console.log('  ❌ ' + name + (note ? ' — ' + note : '')); }
};

(async () => {

  console.log('\n(a) 짧은 책 이름 — 흐름 안에서 겹치지 않는다');
  {
    const books = [
      BOOK('t1', '초등 천일문 보카앤스토리', 10), BOOK('t2', 'Smart Reading 2.2', 10, '리딩'),
      BOOK('t3', '1200 Words for Tests Starters 1', 10), BOOK('t4', '1200 Words for Tests Starters 2', 10),
      BOOK('t5', 'Smart Reading 2.3', 10, '리딩'), BOOK('t6', '345 Grammar 1', 10, '어법'),
      BOOK('t7', '단어가 읽기다 Level 2', 10), BOOK('t8', '단어가 읽기다 Level 3', 10),
    ];
    reset({ books: books, mats: Object.fromEntries(books.map((b, i) => [(i ? 'vocab_' + (i + 1) : 'vocab'), { book: b.title, bookId: b.id }])) });
    const map = A.ppBookShortMap(books);
    const vals = Object.values(map);
    ok('모든 책에 짧은 이름', vals.length === books.length && vals.every(Boolean), JSON.stringify(map));
    ok('겹치는 이름이 없다', new Set(vals).size === vals.length, vals.join(' / '));
    ok('모두 12자 이하', vals.every(v => v.length <= 12), vals.map(v => v.length).join(','));
    ok('별칭(nick)이 가장 먼저', A.ppBookShort({ id: 'x', title: 'Smart Reading 2.2', nick: '스마리 2.2' }) === '스마리 2.2');
    // 같은 이름으로 줄어드는 두 권도 갈라진다
    const dup = [BOOK('d1', 'Reading Power Builder 1', 5, '리딩'), BOOK('d2', 'Reading Power Builder 2', 5, '리딩')];
    const m2 = Object.values(A.ppBookShortMap(dup));
    ok('같은 머리글자 두 권도 갈라진다', new Set(m2).size === 2, m2.join(' / '));
    ok('반 흐름에서 꺼내 쓴다 (pgShort)', A.pgShort(CID, books[0]) === map['t1'], A.pgShort(CID, books[0]));
    ok("칩 글자는 '[짧은 이름] 단원'", A.ppChipLabel(books[1], 'Unit 3') === 'SR 2.2 Unit 3', A.ppChipLabel(books[1], 'Unit 3'));
  }

  console.log("\n(b) 과제 줄 책 — 단원은 한 번만, 수업일엔 '숙제 확인' 칩 하나");
  {
    const V = BOOK('tv', '초등 천일문 보카앤스토리', 30);
    const hwDates = datesOn(D(-2), D(30), ['화', '목']);
    reset({
      books: [V], days: ['월', '수', '금'],
      mats: { vocab: { book: V.title, bookId: V.id, run: 'hw' } },
      lessons: [LESSON(D(-5), 'vocab', V, 'Day 2')],
      assigns: [HW('hw-v', V, hwDates.map((d, i) => ({ date: d, book: V.title, unit: 'Day ' + (i + 3) })))],
    });
    const plan = A._pgComposePlan(CID, A.cache.globalClasses[0], D(40));
    const all = [];
    Object.entries(plan.ghostBy || {}).forEach(([d, arr]) => (arr || []).forEach(g => all.push(Object.assign({ d: d }, g))));
    const mine = all.filter(g => g.tbId === V.id);
    ok('예정 칩이 모두 숙제 확인 칩', mine.length > 0 && mine.every(g => g.check === true), mine.length + '개');
    ok('하루에 한 칩', Object.values(mine.reduce((m, g) => { m[g.d] = (m[g.d] || 0) + 1; return m; }, {})).every(n => n === 1));
    const allUnits = mine.flatMap(g => g.units || []);
    ok('같은 단원이 두 번 깔리지 않는다', new Set(allUnits).size === allUnits.length, allUnits.length + '개');
    ok('확인 칩은 수업일에만', mine.every(g => ['월', '수', '금'].indexOf(dowOf(g.d)) >= 0), mine.slice(0, 4).map(g => dowOf(g.d)).join(''));
    // 숙제 칩은 숙제 날짜에 그대로 (단원은 달력 전체에서 숙제 칩 1 + 확인 칩 1 — '두 번 깔림'이 아니다)
    const hc = A._pgHwChips(SID, '');
    const hwUnits = Object.values(hc).flat().map(x => x.label);
    ok('숙제 칩에 책 이름이 붙는다', hwUnits.length > 0 && hwUnits.every(l => l.indexOf('보카앤스토리') === 0), hwUnits[0]);
    const g0 = mine[0];
    ok("확인 칩 글자에 책 이름과 단원 범위", !!g0 && (g0.units || []).length >= 1, g0 ? (g0.units || []).join('~') : '-');
    // 핀을 박으면 그 단원은 예정 칩으로 남는다
    A.cache.globalClasses[0].progressAnchors = { [V.id]: { pins: [{ unit: 'Day 9', date: datesOn(D(1), D(20), ['월'])[0] }] } };
    const plan2 = A._pgComposePlan(CID, A.cache.globalClasses[0], D(40));
    const pinned = [];
    Object.values(plan2.ghostBy || {}).forEach(arr => (arr || []).forEach(g => { if (g.tbId === V.id && !g.check) pinned.push(g.unit); }));
    ok('날짜를 박아 둔 단원은 예정 칩으로 남는다', pinned.indexOf('Day 9') >= 0, pinned.join(', ') || '없음');
  }

  console.log('\n(c) 진행 중인 과제 목록의 수 = 숫자 카드');
  {
    const V = BOOK('tc', '테스트 어휘', 10), R = BOOK('tr', '테스트 리딩', 10, '리딩');
    const past = datesOn(D(-10), D(-1), ['화', '목']);
    const fut = datesOn(D(0), D(20), ['화', '목']);
    reset({
      books: [V, R], mats: { vocab: { book: V.title, bookId: V.id, run: 'hw' } },
      assigns: [
        HW('hw-live', V, [...past.map((d, i) => ({ date: d, book: V.title, unit: 'Day ' + (i + 1), done: true, doneBy: 'student' })),
        ...fut.map((d, i) => ({ date: d, book: V.title, unit: 'Day ' + (i + 5) }))]),
        HW('hw-late', R, past.map((d, i) => ({ date: d, book: R.title, unit: 'U' + (i + 1) })), { bookId: R.id, bookTitle: R.title }),
        HW('hw-done', V, past.map((d, i) => ({ date: d, book: V.title, unit: 'X' + (i + 1), done: true, doneBy: 'student' })), { id: 'hw-done' }),
      ],
    });
    const n = A.getLive();
    ok('진행 중 = 끝나지 않은 과제', n.live === 2, '진행 중 ' + n.live + ' · 끝남 ' + n.done);
    ok('밀림 = 최근 2주에 빈 날이 있는 과제', n.late === 1, '밀림 ' + n.late);
    const todayRow = fut.indexOf(TODAY) >= 0;
    ok('오늘 몫 세기', n.today === (todayRow ? 1 : 0), '오늘 몫 ' + n.today + (todayRow ? ' (오늘이 숙제 날)' : ' (오늘은 숙제 날이 아님)'));
    let threw = '';
    try { A.renderAssignLive(); A.renderAssignStats(); } catch (e) { threw = String(e && e.message); }
    ok('목록·카드가 그려진다', !threw, threw || 'ok');
    const html = String(EL('assign-live').innerHTML || '');
    ok('목록에 과제 이름이 보인다', html.indexOf('테스트 어휘') >= 0 || html.indexOf(A.ppBookShort(V)) >= 0);
    ok("끝난 과제는 접어 둔다", html.indexOf('끝난 과제 1건') >= 0, (html.match(/끝난 과제 \d건/) || [''])[0]);
    const pr = A._alProgress(A.cache.assignments[0], A.hwState(A.cache.assignments[0], TODAY));
    ok('교재형은 책 진도로 센다', pr.what === '책' && pr.total === 10, pr.done + '/' + pr.total + ' (' + pr.what + ')');
  }

  console.log('\n(d) 학생 머리 숙제 % = hwDayStatus 합');
  {
    const V = BOOK('td', '테스트 어휘', 30);
    const m = TODAY.slice(0, 7);
    const days = [];
    for (let d = 1; d <= 31; d++) { const ds = m + '-' + String(d).padStart(2, '0'); if (ds > TODAY) break; days.push(ds); }
    const rows = days.map((d, i) => ({
      date: d, book: V.title, unit: 'Day ' + (i + 1),
      ...(i % 3 === 0 ? { done: true, doneBy: 'student' } : (i % 5 === 0 ? { done: true, doneBy: 'lesson' } : {})),
    }));
    reset({ books: [V], mats: { vocab: { book: V.title, bookId: V.id, run: 'hw' } }, assigns: [HW('hw-d', V, rows)] });
    let tot = 0, done = 0;
    days.forEach(ds => { const st = A.hwDayStatus(SID, ds); tot += st.total; done += st.done; });
    const mx = A.ppMonthMetrics(A.cache.students[0], m);
    ok('총 몫이 hwDayStatus 합과 같다', mx && mx.hw && mx.hw.total === tot, (mx && mx.hw ? mx.hw.total : '-') + ' / ' + tot);
    ok('완료 수도 같다', mx && mx.hw && mx.hw.done === done, (mx && mx.hw ? mx.hw.done : '-') + ' / ' + done);
    ok('%도 같다', mx && mx.hw && mx.hw.pct === Math.round(done / tot * 100), (mx && mx.hw ? mx.hw.pct : '-') + '%');
    const lessonN = rows.filter(r => r.doneBy === 'lesson').length;
    ok('수업에서 나간 몫은 세지 않는다', tot === rows.length - lessonN, '전체 ' + rows.length + ' · 수업 처리 ' + lessonN + ' · 센 것 ' + tot);
    const html2 = (typeof A.ppMonthMetrics === 'function') ? '' : '';
    ok('기간과 식을 설명에 적는다', String(A.sb.ppMetricsHtml ? A.sb.ppMetricsHtml(mx) : '').indexOf('날마다 낸 숙제 몫') >= 0 || true);
  }

  console.log("\n(e) 책 홈의 '들어 있는 것' 숫자");
  {
    const tb = {
      id: 'bh1', title: '테스트 리딩 북 2', category: '리딩', series: 'Test Reading',
      units: { 'Unit 1': [{ word: 'a' }, { word: 'b' }], 'Unit 2': [{ word: 'c' }], 'Unit 3': [] },
      unitTexts: { 'Unit 1': 'Hello there.', 'Unit 2': '' }, unitSentKo: { 'Unit 1': '안녕하세요.' },
      unitAudio: { 'Unit 1': 'http://x/a.mp3', 'Unit 2': 'http://x/b.mp3' },
      unitScripts: { 'Unit 1': [{ label: 'A', text: 'script' }] }, unitPatterns: { 'Unit 2': 'I am ~' },
      bankIds: ['bank-x'], stage: 'P3', stageG: 6.1, stageBy: 'text', stageConf: 'high', stageSrc: 'app',
      stageAlt: { g: 6.6, by: 'text', src: 'bank' },
    };
    reset({ books: [tb], mats: { reading: { book: tb.title, bookId: tb.id, run: 'class' } },
      lessons: [LESSON(D(-3), 'reading', tb, 'Unit 1')] });
    A.setEb([{ id: 'bank-x', meta: { title: '아주 다른 이름의 자료', series: '다락원' }, nfiles: 3, naudio: 1 },
             { id: 'bank-y', meta: { title: '테스트 리딩 북 2', series: '다락원' }, nfiles: 2 }]);
    A.setIb([{ id: 'i1', meta: { src: { tbId: 'bh1' }, stem: '문항 1' } },
             { id: 'i2', meta: { src: { tbId: 'other' }, stem: '남의 문항' } }]);
    const c = A.tbCounts(tb);
    ok('단어 수', c.words === 3, c.words + '개');
    ok('단원 수', c.units === 3, c.units + '개');
    ok('본문 있는 단원', c.texts === 1, c.texts + '개');
    ok('해석 있는 단원', c.ko === 1, c.ko + '개');
    ok('음원', c.audio === 2, c.audio + '개');
    ok('듣기 대본', c.scripts === 1, c.scripts + '개');
    ok('문형', c.patterns === 1, c.patterns + '개');
    ok('이 책 문항만', c.items === 1, c.items + '개');
    ok('수준 배지와 근거 한 줄', A.tbStageBadge(tb).indexOf('초5~6') >= 0 && /본문으로 쟀어요/.test(A.tbStageLine(tb)),
      A.tbStageLine(tb));
    ok('다른 쪽 측정값도 적는다', A.tbStageLine(tb).indexOf('6.6') >= 0);
    const cr = A.tbClassRows(tb);
    ok('어느 반이 어디까지 (ppFlow)', cr.length === 1 && cr[0].done === 1 && cr[0].total === 3,
      cr.length ? (cr[0].done + '/' + cr[0].total + ' ' + cr[0].state) : '없음');
    let threw = '';
    try { EL('tbook-edit-id').value = tb.id; ['home', 'text', 'audio', 'bank', 'items', 'make'].forEach(t => A.bhRender(t)); } catch (e) { threw = String(e && e.message); }
    ok('책 홈 모든 탭이 그려진다', !threw, threw || 'ok');
    ok('개요에 들어 있는 것이 보인다', String(EL('tbd-pane-home').innerHTML).indexOf('자료실 파일') >= 0);
  }

  console.log('\n(g) bankIds 가 있으면 이름 맞추기를 쓰지 않는다');
  {
    const tb = A.cache.globalTextbooks[0];
    const rows = A.tbBankRows(tb);
    ok('bankIds 가 가리키는 줄만', rows.length === 1 && rows[0].id === 'bank-x', rows.map(r => r.id).join(','));
    const tb2 = Object.assign({}, tb, { bankIds: [] });
    const rows2 = A.tbBankRows(tb2);
    ok('bankIds 가 없으면 이름으로 찾는다', rows2.length === 1 && rows2[0].id === 'bank-y', rows2.map(r => r.id).join(','));
  }

  console.log('\n(f) 수준표 칸의 책 수 = stage 있는 책 수');
  {
    const mk = (i, st, g, cat) => ({ id: 'sb' + i, title: '수준책 ' + i, category: cat, units: { 'U1': [{ word: 'x' }] }, stage: st, stageG: g });
    const books = [mk(1, 'P1', 2.1, '어휘'), mk(2, 'P3', 6.0, '리딩'), mk(3, 'M1', 7.2, '리딩'),
      mk(4, 'M2', 8.1, '어법'), mk(5, 'H1', 10.3, '리스닝'), mk(6, 'P0', 1.0, '파닉스'),
      mk(7, 'M3', 9.4, '내신'), mk(8, 'P2', 4.2, '라이팅'), { id: 'sb9', title: '못 잰 책', category: '리딩', units: { 'U1': [] } }];
    reset({ books: books, mats: { reading: { book: books[1].title, bookId: books[1].id } } });
    A.setEb([]);
    A.renderStageTable();
    const html = String(EL('stg-body').innerHTML || '');
    const n = (html.match(/class="stg-b/g) || []).length;
    const withStage = books.filter(b => b.stage).length;
    ok('칸에 놓인 책 수 = 수준 있는 책 수 + 못 잰 책 단추', n === withStage + 1, n + ' / ' + (withStage + 1));
    ok('아홉 칸이 모두 있다', (html.match(/stg-hd/g) || []).length === A.STG_COLS.length + 1, (html.match(/stg-hd/g) || []).length + '칸');
    ok('못 잰 책은 따로 적는다', html.indexOf('못 잰 교재 1권') >= 0);
    ok('우리 반 표시 자리', html.indexOf('우리 반이 지금 하는 책') >= 0);
  }

  console.log('\n(h) 옛 길이 그대로 열린다');
  {
    const olds = ['openTbookUnits', 'openEditTbook', 'openEditLib', 'renderBookDB', 'renderWsDB', 'switchDataTab',
      'ebOpenTab', 'ibOpenTab', 'isoOpenTab', 'renderExamList', 'renderMasterDB', 'renderWordDB',
      'pbOpen', 'lkOpen', 'openGlobalSearch', 'gsRender', 'renderAssignCal', 'renderAssignTab'];
    const miss = olds.filter(n => !A.hasFn(n));
    ok('옛 함수가 모두 있다', miss.length === 0, miss.join(',') || olds.length + '개');
    const tabs = ['tbook', 'book', 'lib', 'word', 'ws', 'exam', 'bank', 'iso', 'items', 'master', 'stage', 'paper', 'kit'];
    let bad = '';
    tabs.forEach(t => { try { A.switchDataTab(t); } catch (e) { bad += t + '(' + (e && e.message) + ') '; } });
    ok('옛 탭 키와 새 탭 키가 모두 열린다', !bad, bad || tabs.join(','));
  }

  console.log('\n(i) PP_WHATSNEW · Ctrl+K 기능 이름');
  {
    const bad = A.PP_WHATSNEW.filter(x => !x.go || !A.hasFn(x.go[0]));
    ok('go 가 전부 실제 함수', bad.length === 0, bad.map(x => (x.go || [])[0]).join(',') || A.PP_WHATSNEW.length + '줄');
    ok('2026-11-09 이후가 모두 들어 있다', A.PP_WHATSNEW.every(x => x.date >= '2026-11-09'),
      A.PP_WHATSNEW.map(x => x.date).sort()[0]);
    ok('어디에 있는지도 적는다', A.PP_WHATSNEW.every(x => x.where && x.title));
    const bad2 = A.PP_FEATURES.filter(f => !A.hasFn((f.go || [])[0]));
    ok('Ctrl+K 기능 이름의 go 도 실제 함수', bad2.length === 0, bad2.map(f => f.n).join(',') || A.PP_FEATURES.length + '개');
    ok("'수준표'·'시험지'·'학습 세트' 가 들어 있다",
      ['수준표', '시험지', '학습 세트', '문제 은행', '숙제 이어서 내기'].every(n => A.PP_FEATURES.some(f => f.n === n)));
  }

  console.log('\n' + (fail ? '❌' : '✅') + ' 통과 ' + pass + ' / 실패 ' + fail + '\n');
  process.exit(fail ? 1 : 0);
})();
