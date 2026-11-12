require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// Page & Pencil — '다음 교재 하나로 잇기' 점검 (node verify_link.js)
//
// 교재 흐름(commonMaterials)과 교재형 숙제를 **함께** 맞추는 길을 확인한다.
// 가짜 데이터만 쓴다 — 네트워크도, 실제 학생 데이터도 쓰지 않는다.
//   (a) 과제 줄 지금 책에 숙제가 없을 때 '이어서 내기' 미리 보기 값
//   (b) 다음 교재를 과제 줄에 넣은 뒤의 미리 보기
//   (c) 고른 요일(custom) + 휴강일에서의 일정
//   (d) 손 편집 → 규칙 추정 (맞는 경우 / 안 맞는 경우)
//   (e) Review 만 남은 책 점검
//   (f) 점검이 0건이면 아무것도 보이지 않는다
//   (g) 옛 스냅샷으로 서버를 덮어쓰지 않는다
//   (h) 평소 월·화·수·금 + 방학 한 달 매일인 일정의 요일 이름표
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const G = require('./verify_guard');   // 실제 서버 쓰기 막음 장치
const ROOT = path.resolve(__dirname, '..');

function mkEl(id) {
  return {
    id: id || '', style: { display: '', removeProperty() { }, cssText: '' }, dataset: {}, value: '',
    textContent: '', innerHTML: '', checked: false, options: [], children: [], disabled: false,
    classList: { add() { }, remove() { }, contains() { return false; }, toggle() { } },
    appendChild() { }, removeChild() { }, remove() { }, setAttribute() { }, getAttribute() { return null; },
    addEventListener() { }, removeEventListener() { }, querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, focus() { }, click() { }, scrollIntoView() { }, insertAdjacentHTML() { },
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
    fetch: G.guardFetch(),                     // 실제 서버에 쓰려 하면 그 자리에서 멈춘다
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
    ppToday,ppShiftDate,hwState,hwIsBookFlow,ppFlow,ppFlowForStudent,ppHwBanner,ppHwDows,ppRuleLabelOf,
    ppHwRuleInfer,ppHwNextPlan,ppReviewOnlyLeft,ppHwUnitSync,ppApplyUnitSync,ppSaveAssignMerged,
    ppServerFresh,ppDoneWord,recurRebase,buildRecurSchedule,recurAutoMaintain,_recurMaintainOne,
    _pgFlowChecks,_pgFlowCheckCount,_pgTrackBoardHtml,_pgFlowAddBook,pgMoveToHwTrack,pgMarkDone,
    hwContinueSave,confirmOk,syncClassTbsToStudent,
    setCtx:p=>{_hwNextCtx=p;},
    setFresh:v=>{_srvFreshAt=v?Date.now():0;},
    setFetchRow:fn=>{ppFetchRow=fn;},
    setUpsert:fn=>{supaUpsert=fn;},
    busy:()=>_recurMaintainBusy,
    chkCacheClear:()=>{_pgChkCache={};},
  };`, sb);
  return Object.assign(sb.__app, { els: els });
}
const A = makeCtx();
const TODAY = A.ppToday();
const D = n => A.ppShiftDate(TODAY, n);
const DOWS = ['일', '월', '화', '수', '목', '금', '토'];
const dowOf = ds => DOWS[new Date(ds + 'T12:00:00').getDay()];
// from~to 사이에서 그 요일인 날짜들
const datesOn = (from, to, dows) => {
  const out = [];
  for (let i = 0; ; i++) {
    const ds = A.ppShiftDate(from, i);
    if (ds > to) break;
    if (dows.indexOf(dowOf(ds)) >= 0) out.push(ds);
    if (i > 400) break;
  }
  return out;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 가짜 데이터 ──
const SID = 'stu-link-1', SID2 = 'stu-link-2', CID = 'cls-link-1';
function units(n, pre) { const o = {}; for (let i = 1; i <= n; i++)o[(pre || 'Day ') + i] = [{ word: 'w' + i, ko: '뜻' + i }]; return o; }
const BOOK = (id, title, n, pre, extra) => Object.assign({ id, title, category: '어휘', units: units(n, pre), totalUnits: n }, extra || {});
const LESSON = (date, key, book, bookId, unit) => ({ id: 'les-' + date + '-' + key + '-' + unit, sid: SID, classId: CID, date, att: 'normal', materials: { [key]: { book, bookId, unit } } });
const HW = (id, bookId, bookTitle, rows, extra) => Object.assign({
  id, sid: SID, type: 'recur', category: 'recur', recurRule: 'daily', bookId, bookTitle,
  date: rows[0] && rows[0].date, due: rows[rows.length - 1] && rows[rows.length - 1].date, schedule: rows,
}, extra || {});
function reset(o) {
  o = o || {};
  const c = A.cache;
  c.students = [{ id: SID, name: '가나다', grade: '초6' }, { id: SID2, name: '라마바', grade: '초6' }];
  c.globalClasses = [{
    id: CID, name: '테스트반', active: true, studentIds: o.sids || [SID],
    days: o.days || ['월', '수', '금'], commonMaterials: o.mats || {},
    ...(o.skipDates ? { skipDates: o.skipDates } : {}), ...(o.doneUpto ? { doneUpto: o.doneUpto } : {}),
  }];
  c.globalTextbooks = o.books || [];
  c.lessons = o.lessons || [];
  c.assignments = o.assigns || [];
  c.homeworks = []; c.textbooks = []; c.vocab_cards = []; c.readings = []; c.tests = []; c.logs = [];
  A.chkCacheClear();
  A.els['pp_chkSeen'] = undefined;
  return c;
}

let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✅ ' + name + (note ? ' — ' + note : '')); }
  else { fail++; console.log('  ❌ ' + name + (note ? ' — ' + note : '')); }
};
const kinds = ch => ch.map(x => x.kind).join(',');

(async () => {

  // ───────────────────────────────────────────────────────────
  console.log('\n(a) 과제 줄 지금 책에 숙제가 없으면 — 이어서 내기 미리 보기');
  {
    const A1 = BOOK('tb-a', '테스트 어휘 A', 3), B1 = BOOK('tb-b', '테스트 어휘 B', 5);
    // A 는 수업에서 3과까지 다 나갔고, A 숙제는 아직 3일 더 남았다 → B 는 '지금' 책이지만 숙제가 없다
    const aDates = datesOn(D(-20), D(2), ['화', '목']);
    reset({
      books: [A1, B1],
      mats: { vocab: { book: A1.title, bookId: A1.id, run: 'hw' }, vocab_2: { book: B1.title, bookId: B1.id } },
      lessons: [LESSON(D(-3), 'vocab', A1.title, A1.id, 'Day 3')],
      assigns: [HW('hw-a', A1.id, A1.title, aDates.map((d, i) => ({ date: d, book: A1.title, unit: 'Day ' + ((i % 3) + 1), ...(d < TODAY ? { done: true, doneBy: 'student' } : {}) })),
        { recurRule: 'custom', recurDays: ['화', '목'], auto: false, noUnitSync: true })],
    });
    const bn = A.ppHwBanner(SID);
    const nd = bn.find(x => x.kind === 'need-hw');
    ok('배너가 지금 책 숙제가 없다고 알린다', !!nd && nd.title === B1.title && nd.soon === false,
      nd ? nd.kind + ':' + nd.title + (nd.soon ? '(미리)' : '') : '없음');
    const pl = A.ppHwNextPlan(SID, B1.id, {});
    const lastA = aDates[aDates.length - 1];
    ok('시작일 = 직전 숙제 마지막 날 다음 가능일', !!pl && pl.start > lastA, pl ? pl.start + ' (직전 끝 ' + lastA + ')' : '-');
    ok('반복 요일 = 직전 숙제 그대로', !!pl && pl.rule === 'custom' && pl.days.join('·') === '화·목', pl ? pl.ruleLabel : '-');
    ok('시작 단원 = 첫 단원 (수업 기록 없음)', !!pl && pl.unit === 'Day 1', pl ? pl.unit : '-');
    ok('끝나는 날이 나온다 (단원 수만큼)', !!pl && pl.n === 5 && !!pl.end, pl ? pl.n + '일 · ~' + pl.end : '-');
    ok('모든 날이 화·목', !!pl && pl.rows.every(r => ['화', '목'].indexOf(dowOf(r.date)) >= 0), pl ? pl.rows.map(r => dowOf(r.date)).join('') : '-');
    const ch = A._pgFlowChecks(CID);
    ok('보드 점검에 「숙제 없음」이 있다', ch.some(x => x.kind === '숙제 없음' && x.title === B1.title), kinds(ch) || '없음');
    ok('그 점검의 단추가 이어서 내기다', (ch.find(x => x.kind === '숙제 없음') || {}).act.indexOf('hwContinueOpen') >= 0);
  }

  // ───────────────────────────────────────────────────────────
  console.log('\n(a-2) 반 학생이 여러 명이면 학생마다 같은 숙제');
  {
    const A1 = BOOK('tb-a', '테스트 어휘 A', 2), B1 = BOOK('tb-b', '테스트 어휘 B', 4);
    reset({
      sids: [SID, SID2], books: [A1, B1],
      mats: { vocab: { book: A1.title, bookId: A1.id, run: 'hw' }, vocab_2: { book: B1.title, bookId: B1.id } },
      lessons: [LESSON(D(-2), 'vocab', A1.title, A1.id, 'Day 2')],
      assigns: [],
    });
    const pl = A.ppHwNextPlan(SID, B1.id, {});
    ok('대상이 반 학생 2명', !!pl && pl.sids.length === 2, pl ? pl.sids.length + '명' : '-');
    const sent = [];
    A.setUpsert(async (t, id, data, sid) => { sent.push({ t, id, sid, data }); return true; });
    A.setCtx({ sid: SID, plan: pl });
    await A.hwContinueSave();
    ok('학생마다 한 벌씩 저장', sent.length === 2 && sent[0].data.bookId === B1.id, sent.map(x => x.sid).join(','));
    ok('일정이 같다', sent.length === 2 && JSON.stringify(sent[0].data.schedule.map(r => r.date)) === JSON.stringify(sent[1].data.schedule.map(r => r.date)));
    ok('교재형으로 저장 (auto · bookId)', sent.length === 2 && sent[0].data.auto === true && sent[0].data.category === 'recur');
    A.setUpsert(async () => true);
  }

  // ───────────────────────────────────────────────────────────
  console.log('\n(a-3) 지금 책 숙제가 끝나기 3일 전 — 다음 책을 미리 알린다');
  {
    const A1 = BOOK('tb-a', '테스트 어휘 A', 5), B1 = BOOK('tb-b', '테스트 어휘 B', 5);
    reset({
      books: [A1, B1],
      mats: { vocab: { book: A1.title, bookId: A1.id, run: 'hw' }, vocab_2: { book: B1.title, bookId: B1.id } },
      lessons: [LESSON(D(-3), 'vocab', A1.title, A1.id, 'Day 2')],       // A 는 아직 진행 중
      assigns: [HW('hw-a', A1.id, A1.title,
        [{ date: D(-4), book: A1.title, unit: 'Day 3', done: true, doneBy: 'student' },
         { date: D(1), book: A1.title, unit: 'Day 4' },
         { date: D(2), book: A1.title, unit: 'Day 5' }],
        { recurRule: 'custom', recurDays: ['화', '목'], auto: false, noUnitSync: true })],
    });
    const bn = A.ppHwBanner(SID);
    const nd = bn.find(x => x.kind === 'need-hw');
    ok('다음 책을 미리 알린다 (soon)', !!nd && nd.title === B1.title && nd.soon === true,
      nd ? nd.title + (nd.soon ? '(미리)' : '') : '없음');
    ok('직전 숙제 끝나는 날을 함께 알린다', !!nd && nd.prevEnd === D(2) && nd.prevTitle === A1.title,
      nd ? nd.prevTitle + ' ~' + nd.prevEnd : '-');
    const pl = A.ppHwNextPlan(SID, B1.id, {});
    ok('빈 날이 생기지 않게 직전 끝 다음부터', !!pl && pl.start > D(2), pl ? pl.start : '-');
    A.cache.assignments[0].schedule.push({ date: D(20), book: A1.title, unit: 'Day 5' });
    ok('끝이 3일보다 멀면 알리지 않는다', !A.ppHwBanner(SID).some(x => x.kind === 'need-hw'),
      A.ppHwBanner(SID).map(x => x.kind).join(',') || '없음');
  }

  console.log('\n(b) 다음 교재를 과제 줄에 넣은 뒤 — 그 책의 미리 보기');
  {
    const A1 = BOOK('tb-a', '테스트 어휘 A', 2), B1 = BOOK('tb-b', '테스트 어휘 B', 3);
    const aDates = datesOn(D(-10), D(1), ['화', '목']);
    reset({
      books: [A1, B1],
      mats: { vocab: { book: A1.title, bookId: A1.id, run: 'hw' } },   // B 는 아직 흐름에 없다
      lessons: [LESSON(D(-2), 'vocab', A1.title, A1.id, 'Day 2')],
      assigns: [HW('hw-a', A1.id, A1.title, aDates.map((d, i) => ({ date: d, book: A1.title, unit: 'Day ' + ((i % 2) + 1), done: true, doneBy: 'student' })),
        { recurRule: 'custom', recurDays: ['화', '목'], auto: false, noUnitSync: true })],
    });
    const before = A.ppFlow(CID)[0].tracks[0].books.length;
    // pgPickNext → pgFixSave 가 하는 일 (그 줄 뒤에 끼우기)
    const c = A.cache.globalClasses[0];
    c.commonMaterials = { vocab: c.commonMaterials.vocab, vocab_2: { book: B1.title, bookId: B1.id } };
    const fl = A.ppFlow(CID);
    const tr = fl[0].tracks[0];
    ok('같은 줄에 들어간다 (과제 줄)', tr.books.length === before + 1 && tr.mode === 'hw', tr.books.length + '권 · ' + tr.mode);
    const pl = A.ppHwNextPlan(SID, B1.id, {});
    ok('바로 미리 보기를 만들 수 있다', !!pl && pl.n === 3, pl ? pl.n + '일 · ' + pl.start + '~' + pl.end : '-');
    ok('시작일이 직전 숙제 뒤', !!pl && pl.start > aDates[aDates.length - 1], pl ? pl.start : '-');
  }

  // ───────────────────────────────────────────────────────────
  console.log('\n(c) 고른 요일(custom) + 휴강일');
  {
    const B1 = BOOK('tb-c', '테스트 어휘 C', 6);
    const tue = datesOn(D(1), D(40), ['화'])[0];       // 첫 화요일을 휴강일로
    reset({ books: [B1], days: ['월', '수', '금'], skipDates: [tue] });
    const mk = skipOk => A.buildRecurSchedule({
      rule: 'custom', start: D(1), end: '', clsDays: ['월', '수', '금'], skipDates: [tue], extraDates: [],
      recurDays: ['화', '목'], recurSkipOk: skipOk, tb: B1, startUnit: 'Day 1',
    });
    const s1 = mk(false), s2 = mk(true);
    ok('고른 요일만 나온다', s1.every(r => ['화', '목'].indexOf(dowOf(r.date)) >= 0), s1.slice(0, 4).map(r => dowOf(r.date)).join(''));
    ok('휴강일은 기본으로 뺀다', s1.every(r => r.date !== tue), '휴강 ' + tue);
    ok("'수업 없는 날에도 내기'면 휴강일에도 낸다", s2.some(r => r.date === tue));
    ok('단원은 1과씩 소진', s1.length === 6 && s1[0].unit === 'Day 1' && s1[5].unit === 'Day 6', s1.length + '일');
    // recurRebase 도 같은 규칙을 안다
    const a = HW('hw-c', B1.id, B1.title, s1.map(r => ({ ...r })), { recurRule: 'custom', recurDays: ['화', '목'], auto: true, date: D(1) });
    A.cache.assignments = [a];
    const reb = A.recurRebase(a);
    const dates = (reb || a.schedule).map(r => r.date);
    ok('recurRebase 도 고른 요일을 안다', dates.every(d => ['화', '목'].indexOf(dowOf(d)) >= 0) && dates.indexOf(tue) < 0,
      dates.slice(0, 4).join(' '));
    const a2 = { ...a, recurSkipOk: true };
    const reb2 = A.recurRebase(a2) || a2.schedule;
    ok('휴강일 포함도 recurRebase 가 안다', reb2.some(r => r.date === tue));
  }

  // ───────────────────────────────────────────────────────────
  console.log('\n(d) 손 편집 → 규칙 추정');
  {
    const B1 = BOOK('tb-d', '테스트 어휘 D', 8);
    reset({ books: [B1], days: ['월', '수', '금'] });
    const tueThu = datesOn(D(0), D(30), ['화', '목']).slice(0, 8);
    const a = HW('hw-d', B1.id, B1.title, tueThu.map((d, i) => ({ date: d, book: B1.title, unit: 'Day ' + (i + 1) })), { auto: true, noUnitSync: true });
    A.cache.assignments = [a];
    const inf = A.ppHwRuleInfer(a);
    ok('화·목으로 고친 일정 → custom 화·목', !!inf && inf.rule === 'custom' && inf.days.join('·') === '화·목',
      inf ? A.ppRuleLabelOf(inf.rule, inf.days, inf.skipOk) : 'null');
    // 수업 있는 날(월·수·금)로 고치면 규칙 이름이 나온다
    const mwf = datesOn(D(0), D(30), ['월', '수', '금']).slice(0, 8);
    const a2 = { ...a, schedule: mwf.map((d, i) => ({ date: d, book: B1.title, unit: 'Day ' + (i + 1) })) };
    const inf2 = A.ppHwRuleInfer(a2);
    ok('월·수·금(수업일)으로 고친 일정 → 규칙으로 설명된다', !!inf2 && (inf2.rule === 'class' || (inf2.rule === 'custom' && inf2.days.join('·') === '월·수·금')),
      inf2 ? A.ppRuleLabelOf(inf2.rule, inf2.days, inf2.skipOk) : 'null');
    // 설명되지 않는 날짜 (한 날을 빼먹은 화·목)
    const odd = tueThu.filter((d, i) => i !== 3);
    const a3 = { ...a, schedule: odd.map((d, i) => ({ date: d, book: B1.title, unit: 'Day ' + (i + 1) })) };
    ok('규칙으로 설명되지 않으면 null', A.ppHwRuleInfer(a3) === null, '한 날을 뺀 화·목');
  }

  // ───────────────────────────────────────────────────────────
  console.log('\n(e) Review 만 남은 책');
  {
    const B1 = {
      id: 'tb-e', title: '테스트 리딩 E', category: '리딩', totalUnits: 4,
      units: { 'Unit 1': [], 'Unit 2': [], 'Review 1': [], 'Review 2': [] },
      unitOrder: ['Unit 1', 'Unit 2', 'Review 1', 'Review 2'],   // 교재가 정한 순서 (Review 는 뒤)
    };
    const B2 = BOOK('tb-e2', '테스트 리딩 E2', 4, 'Unit ');
    reset({
      books: [B1, B2],
      mats: { reading: { book: B1.title, bookId: B1.id }, reading_2: { book: B2.title, bookId: B2.id } },
      lessons: [LESSON(D(-30), 'reading', B1.title, B1.id, 'Unit 2'), LESSON(D(-3), 'reading', B2.title, B2.id, 'Unit 1')],
    });
    const rv = A.ppReviewOnlyLeft(CID, B1, 1);
    ok('남은 단원이 Review 류뿐', !!rv && rv.n === 2, rv ? rv.left.join(', ') : 'null');
    const ch = A._pgFlowChecks(CID);
    const r = ch.find(x => x.kind === 'Review만');
    ok('보드 점검에 「Review만」', !!r && r.title === B1.title, kinds(ch) || '없음');
    ok('끝낸 걸로 하기 / 그대로 두기 단추', !!r && r.act.indexOf('pgMarkDone') >= 0 && r.act.indexOf('pgChkSeen') >= 0);
    ok('자동으로 넘기지는 않는다', !((A.cache.globalClasses[0].doneUpto || {})[B1.id]), '진도 지정 없음');
    // 끝낸 걸로 하기
    A.setUpsert(async () => true);
    A.pgMarkDone(CID, B1.id);
    A.confirmOk();
    await sleep(10);
    ok('[끝낸 걸로 하기] 를 누르면 진도 기준점만 바뀐다',
      (A.cache.globalClasses[0].doneUpto || {})[B1.id] === 'Review 2',
      JSON.stringify(A.cache.globalClasses[0].doneUpto || {}));
    // 2주가 안 지나고 다음 책 기록도 없으면 알리지 않는다
    reset({
      books: [B1, B2], mats: { reading: { book: B1.title, bookId: B1.id }, reading_2: { book: B2.title, bookId: B2.id } },
      lessons: [LESSON(D(-2), 'reading', B1.title, B1.id, 'Unit 2')],
    });
    ok('최근 기록이 있고 다음 책도 시작 안 했으면 알리지 않는다',
      !A._pgFlowChecks(CID).some(x => x.kind === 'Review만'), kinds(A._pgFlowChecks(CID)) || '없음');
  }

  // ───────────────────────────────────────────────────────────
  console.log('\n(f) 점검이 0건이면 아무것도 보이지 않는다');
  {
    // 과제 줄에 지금 책 + 다음 책이 있고, 지금 책 숙제가 끝까지 깔려 있다 → 손볼 것이 없다
    const B1 = BOOK('tb-f', '테스트 어휘 F', 8), B2 = BOOK('tb-f2', '테스트 어휘 F2', 8);
    const fDates = datesOn(D(-6), D(120), ['화', '목']).slice(0, 8);
    reset({
      books: [B1, B2],
      mats: { vocab: { book: B1.title, bookId: B1.id, run: 'hw' }, vocab_2: { book: B2.title, bookId: B2.id } },
      lessons: [LESSON(D(-3), 'vocab', B1.title, B1.id, 'Day 1')],
      assigns: [HW('hw-f', B1.id, B1.title,
        fDates.map((d, i) => ({ date: d, book: B1.title, unit: 'Day ' + (i + 1), ...(d < TODAY ? { done: true, doneBy: 'student' } : {}) })),
        { recurRule: 'custom', recurDays: ['화', '목'], auto: false, noUnitSync: true })],
    });
    const ch = A._pgFlowChecks(CID);
    ok('점검 0건', ch.length === 0, kinds(ch) || '없음');
    const html = A._pgTrackBoardHtml(CID);
    ok('보드에 점검 칸이 없다', html.indexOf('tb-chk') < 0, '길이 ' + html.length);
    ok('진도 줄은 그대로 보인다', html.indexOf('tb-track') >= 0);
    ok('대시보드 숫자도 0', A._pgFlowCheckCount(CID) === 0);
  }

  // ───────────────────────────────────────────────────────────
  console.log('\n(f-2) 수업 줄 책에 교재형 숙제 / 흐름 밖 숙제');
  {
    const B1 = BOOK('tb-g', '테스트 어휘 G', 6), B2 = BOOK('tb-h', '테스트 어휘 H', 6);
    const dates = datesOn(D(-2), D(30), ['화', '목']).slice(0, 6);
    reset({
      books: [B1, B2],
      mats: { vocab: { book: B1.title, bookId: B1.id, run: 'class' } },      // 수업 줄인데 숙제가 있다
      lessons: [LESSON(D(-3), 'vocab', B1.title, B1.id, 'Day 1')],
      assigns: [
        HW('hw-g', B1.id, B1.title, dates.map((d, i) => ({ date: d, book: B1.title, unit: 'Day ' + (i + 2) })), { auto: false, noUnitSync: true }),
        HW('hw-h', B2.id, B2.title, dates.map((d, i) => ({ date: d, book: B2.title, unit: 'Day ' + (i + 1) })), { auto: false, noUnitSync: true }),
      ],
    });
    const ch = A._pgFlowChecks(CID);
    const mis = ch.find(x => x.kind === '줄 어긋남');
    ok('수업 줄 책에 숙제가 있으면 알린다', !!mis && mis.title === B1.title, kinds(ch));
    ok('과제 줄로 옮기기 / 숙제 끝내기 단추', !!mis && mis.act.indexOf('pgMoveToHwTrack') >= 0 && mis.act.indexOf('hwEndNow') >= 0);
    ok('흐름에 없는 책으로 나가는 숙제도 알린다', ch.some(x => x.kind === '흐름 밖' && x.title === B2.title));
    ok('흐름에 넣기 단추', (ch.find(x => x.kind === '흐름 밖') || {}).act.indexOf('_pgFlowAddBook') >= 0);
    // 과제 줄로 옮기면 점검이 사라진다
    A.setUpsert(async () => true);
    await A.pgMoveToHwTrack(CID, B1.id, true);
    A.chkCacheClear();
    const ch2 = A._pgFlowChecks(CID);
    ok('옮기면 「줄 어긋남」이 사라진다', !ch2.some(x => x.kind === '줄 어긋남'), kinds(ch2));
    ok('옮긴 책은 과제 줄', (A.cache.globalClasses[0].commonMaterials.vocab || {}).run === 'hw',
      JSON.stringify(A.cache.globalClasses[0].commonMaterials));
  }

  // ───────────────────────────────────────────────────────────
  console.log('\n(g) 옛 스냅샷으로 서버를 덮어쓰지 않는다');
  {
    const B1 = BOOK('tb-s', '테스트 어휘 S', 6);
    // 화면(스냅샷)의 옛 줄: 지난 Day 1·2 가 아직 미완, 앞으로 Day 3~6
    const past = datesOn(D(-8), D(-1), ['화', '목']).slice(0, 2);
    const fut = datesOn(D(0), D(30), ['화', '목']).slice(0, 4);
    const mkRows = () => [
      ...past.map((d, i) => ({ date: d, book: B1.title, unit: 'Day ' + (i + 1) })),
      ...fut.map((d, i) => ({ date: d, book: B1.title, unit: 'Day ' + (i + 3) })),
    ];
    const setup = () => reset({
      books: [B1], mats: { vocab: { book: B1.title, bookId: B1.id, run: 'hw' } },
      lessons: [LESSON(D(-2), 'vocab', B1.title, B1.id, 'Day 2')],   // 수업이 Day 2 까지 나갔다
      assigns: [HW('hw-s', B1.id, B1.title, mkRows(), { recurRule: 'custom', recurDays: ['화', '목'], auto: false })],
    });

    // g1. 스냅샷으로 부팅한 첫 그리기 — 저장하지 않는다
    setup();
    let sent = [];
    A.setUpsert(async (t, id, data, sid) => { sent.push({ id, data: JSON.parse(JSON.stringify(data)) }); return true; });
    A.setFetchRow(async () => null);
    A.setFresh(false);
    A.recurAutoMaintain();
    await sleep(20);
    ok('서버에서 받기 전에는 저장 0회', sent.length === 0, '쓰기 ' + sent.length + '회');
    const cacheRow = A.cache.assignments[0];
    ok('화면에는 맞춘 결과가 보인다', cacheRow.schedule.filter(r => r.doneBy === 'lesson').length === 2,
      '수업 처리 ' + cacheRow.schedule.filter(r => r.doneBy === 'lesson').length + '줄');

    // g2. 서버에 '학생이 체크한 새 줄'이 있고, 바뀔 것이 없으면 저장 0회
    setup();
    sent = [];
    const srvRows = mkRows();
    srvRows[0].done = true; srvRows[0].doneBy = 'lesson';
    srvRows[1].done = true; srvRows[1].doneBy = 'lesson';
    srvRows[2].done = true; srvRows[2].doneBy = 'student'; srvRows[2].doneAt = '2026-11-12T08:00:00.000Z';
    const srv = { ...A.cache.assignments[0], schedule: srvRows, schedulePrev: mkRows(), schedulePrevAt: '2026-11-12T06:51:00.000Z' };
    A.setFetchRow(async () => ({ id: 'hw-s', data: JSON.parse(JSON.stringify(srv)), sid: SID }));
    A.setFresh(true);
    A.recurAutoMaintain();
    for (let i = 0; i < 40 && A.busy(); i++) await sleep(10);
    await sleep(10);
    ok('바뀔 것이 없으면 저장 0회', sent.length === 0, '쓰기 ' + sent.length + '회');
    const row2 = A.cache.assignments[0];
    ok('서버의 학생 체크가 남아 있다', row2.schedule.some(r => r.doneBy === 'student' && r.done),
      row2.schedule.map(r => (r.done ? (r.doneBy || 'done') : '·')).join(' '));
    ok('서버의 직전 일정(되돌리기 기준점)을 덮어쓰지 않는다', row2.schedulePrevAt === '2026-11-12T06:51:00.000Z', row2.schedulePrevAt || '-');

    // g3. 서버 줄이 아직 안 맞춰져 있으면 — 서버 것을 기준으로 다시 계산해 저장
    setup();
    sent = [];
    const srv3 = { ...A.cache.assignments[0], schedule: mkRows() };
    srv3.schedule[3].done = true; srv3.schedule[3].doneBy = 'student';   // 학생이 미리 한 앞날 줄
    A.setFetchRow(async () => ({ id: 'hw-s', data: JSON.parse(JSON.stringify(srv3)), sid: SID }));
    A.setFresh(true);
    A.recurAutoMaintain();
    for (let i = 0; i < 40 && A.busy(); i++) await sleep(10);
    await sleep(10);
    ok('바뀔 것이 있으면 저장 1회', sent.length === 1, '쓰기 ' + sent.length + '회');
    const saved = sent[0] ? sent[0].data : { schedule: [] };
    ok('저장한 줄에 서버의 학생 체크가 그대로', saved.schedule.some(r => r.done && r.doneBy === 'student'),
      saved.schedule.map(r => (r.done ? (r.doneBy || 'done') : '·')).join(' '));
    ok('지난 몫은 수업 처리로 완료', saved.schedule.filter(r => r.doneBy === 'lesson').length === 2);
    ok('날짜 목록은 선생님이 정한 그대로', JSON.stringify(saved.schedule.map(r => r.date)) === JSON.stringify(mkRows().map(r => r.date).slice(0, saved.schedule.length)),
      saved.schedule.length + '줄');
    ok('직전 일정을 남겨 되돌릴 수 있다', (saved.schedulePrev || []).length > 0);

    // g4. 휴지통에 간 과제는 되살리지 않는다
    setup();
    sent = [];
    A.setFetchRow(async () => ({ id: 'hw-s', data: { ...A.cache.assignments[0], _deleted: true }, sid: SID }));
    A.setFresh(true);
    A.recurAutoMaintain();
    for (let i = 0; i < 40 && A.busy(); i++) await sleep(10);
    await sleep(10);
    ok('휴지통 행은 되살리지 않는다 (저장 0회)', sent.length === 0, '쓰기 ' + sent.length + '회');
    A.setUpsert(async () => true);
    A.setFetchRow(async () => null);

    // g5. 학생 교재 동기화도 같은 규칙 — 화면을 열었을 뿐이면 서버에서 받은 뒤에만 쓴다
    const B2 = BOOK('tb-s2', '테스트 어휘 S2', 4);
    reset({ books: [B2], mats: { vocab: { book: B2.title, bookId: B2.id, run: 'class' } } });
    A.cache.textbooks = [];
    let t2 = [];
    A.setUpsert(async (t, id, data, sid) => { t2.push(t); return true; });
    A.setFresh(false);
    await A.syncClassTbsToStudent(SID, true);
    ok('학생 교재 동기화 — 받기 전에는 저장 0회', t2.length === 0, '쓰기 ' + t2.length + '회');
    A.setFresh(true);
    await A.syncClassTbsToStudent(SID, true);
    ok('받은 뒤에는 평소대로 만든다', t2.filter(x => x === 'textbooks').length === 1, '쓰기 ' + t2.length + '회');
    A.setUpsert(async () => true);
  }

  // ───────────────────────────────────────────────────────────
  console.log('\n(h) 요일 이름표 — 평소 월·화·수·금 + 방학 한 달 매일');
  {
    reset({ books: [], days: ['월', '수', '금'] });
    const normal1 = datesOn(D(-40), D(39), ['월', '화', '수', '금']);
    const vac = []; for (let i = 40; i <= 70; i++)vac.push(D(i));
    const normal2 = datesOn(D(71), D(140), ['월', '화', '수', '금']);
    const a = {
      id: 'hw-x', sid: SID, type: 'recur', category: 'recur', recurRule: 'custom', recurDays: ['월', '화', '수', '금'],
      bookTitle: '단어 쓰기', schedule: [...normal1, ...vac, ...normal2].map(d => ({ date: d, book: '단어 쓰기', unit: '' })),
    };
    A.cache.assignments = [a];
    ok('오늘 기준 4주 → 월·화·수·금', A.ppHwDows(a) === '월·화·수·금', A.ppHwDows(a));
    ok('방학 한 달 안에서는 매일', A.ppHwDows(a, { today: D(45) }) === '매일', A.ppHwDows(a, { today: D(45) }));
    ok('방학 뒤에는 다시 월·화·수·금', A.ppHwDows(a, { today: D(80) }) === '월·화·수·금', A.ppHwDows(a, { today: D(80) }));
    const fin = { ...a, schedule: normal1.filter(d => d < D(-10)).map(d => ({ date: d, book: 'x', unit: '', done: true, doneBy: 'student' })) };
    ok('끝난 숙제는 가장 가까운 4주로 읽는다', A.ppHwDows(fin) === '월·화·수·금', A.ppHwDows(fin));
  }

  // ───────────────────────────────────────────────────────────
  console.log("\n(i) '수업에서 함' 은 한 말로");
  {
    ok("doneBy 'lesson' → 수업에서 함", A.ppDoneWord('lesson') === '수업에서 함', A.ppDoneWord('lesson'));
    ok("학생·선생님 체크 → 제출완료", A.ppDoneWord('student') === '제출완료' && A.ppDoneWord('teacher') === '제출완료');
  }

  console.log('\n' + G.guardLine());
  console.log((fail ? '❌' : '✅') + ' 통과 ' + pass + ' / 실패 ' + fail + '\n');
  process.exit(fail ? 1 : 0);
})();
