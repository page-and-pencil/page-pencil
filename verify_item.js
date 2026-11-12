// Page & Pencil — 자료실·문제 은행 잇기 점검 (node verify_item.js)
//
// 가짜 데이터만 쓴다 — 네트워크도, 실제 학생 데이터도, 기출 원문도 쓰지 않는다.
//   (a) src.bankId 로 문항 수 세기와 거르기
//   (b) 3,000문항 가져오기 — 멈춤 없음·요약 숫자·다시 넣으면 건너뜀 3,000
//   (c) hasImage·warn 표시와 거르기
//   (d) 원문이 든 문항은 서버 저장 호출 0회 (기기에만)
//   (e) 백업 내보내기 → 빈 기기에서 가져오기 → 같은 내용
//   (f) 제목 꼴 첫 줄 (?·! 로 끝나는 제목)
//   + 3,000문항에서 검색이 몇 ms 걸리는지
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = __dirname;

function mkEl(id) {
  return {
    id: id || '', style: { display: '', width: '', removeProperty() { }, cssText: '' }, dataset: {}, value: '',
    textContent: '', innerHTML: '', checked: false, options: [], children: [], disabled: false,
    classList: { add() { }, remove() { }, contains() { return false; }, toggle() { } },
    appendChild() { }, removeChild() { }, remove() { }, setAttribute() { }, getAttribute() { return null; },
    addEventListener() { }, removeEventListener() { }, querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, focus() { }, click() { }, scrollIntoView() { }, insertAdjacentHTML() { },
    insertBefore() { },
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
  vm.runInContext(`globalThis.__app={cache:_cache,DB,ppToday,
    _ibNorm,_ibLightOf,_ibMatch,_ibFiltered,_ibBadges,_ibItemBtns,_ibDevAll,_ibDevOnly,
    ibCountForBank,ibFromBank,ibClearBank,_ibImportScan,_ibImportGo,ibDevExport,ibBasketToggle,
    _lkParse,_lkTitleish,ITEM_KEEP_SERVER,confirmOk,confirmCancel,ppConfirmPending,
    setRows:r=>{_ibRows=r;_ibMergeIdx=null;},
    getRows:()=>_ibRows,
    setF:f=>{Object.assign(_ibF,f);},
    getF:()=>_ibF,
    resetF:()=>ibResetFilters(),
    setMode:m=>{_ibImportMode=m;},
    setBulk:fn=>{_ibBulkUpsert=fn;},
    setIdb:(g,s)=>{idbGet=g;idbSet=s;},
    noTable:v=>{_ibNoTable=v;},
    basket:()=>ibBasket(),
  };`, sb);
  return Object.assign(sb.__app, { els: els, sb: sb });
}
const A = makeCtx();
A.sb.localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' }));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 기기 보관(IndexedDB) 흉내
const IDB = new Map();
A.setIdb(async k => (IDB.has(k) ? JSON.parse(JSON.stringify(IDB.get(k))) : null),
  async (k, v) => { IDB.set(k, JSON.parse(JSON.stringify(v))); return true; });

let pass = 0, fail = 0;
const ok = (name, cond, note) => {
  if (cond) { pass++; console.log('  ✅ ' + name + (note ? ' — ' + note : '')); }
  else { fail++; console.log('  ❌ ' + name + (note ? ' — ' + note : '')); }
};
// 가짜 문항 (기출 원문은 쓰지 않는다 — 모양만 본뜬 글)
const mkItem = (i, extra) => Object.assign({
  id: 'it-' + i, type: 'l_purpose', grade: '중2',
  stem: '다음을 듣고, 남자가 하는 말의 목적으로 가장 적절한 것을 고르시오. (' + i + ')',
  passage: '', script: 'This is a sample listening script number ' + i + ' about a school festival.',
  choices: ['안내하려고', '사과하려고', '부탁하려고', '칭찬하려고', '제안하려고'], answer: 0,
  src: { kind: 'exam', exam: '테스트 듣기평가 ' + ((i % 5) + 1) + '회', qno: String((i % 20) + 1), bankId: 'bank-' + ((i % 3) + 1), fileId: 'file-' + ((i % 3) + 1), page: (i % 7) + 1, audioId: 'au-' + ((i % 3) + 1) },
  rate: 40 + (i % 50),
}, extra || {});
const light = d => A._ibLightOf(d, d.id);
// 가져오기 한 벌 (askConfirm → confirmOk 까지)
async function runImport(arr, mode) {
  A.setMode(mode || 'skip');
  const el = A.els['ib-prog-close']; if (el) el.style.display = 'none';
  await A._ibImportScan(arr);
  // 확인 창이 뜨면 '넣기'를 누른다
  for (let i = 0; i < 400 && !A.ppConfirmPending(); i++) await sleep(5);
  if (A.ppConfirmPending()) A.confirmOk();
  for (let i = 0; i < 2000; i++) {
    if (A.els['ib-prog-close'] && A.els['ib-prog-close'].style.display === '') break;
    await sleep(5);
  }
  return String((A.els['ib-prog-sum'] || {}).innerHTML || '');
}

(async () => {

  console.log('\n(a) 자료실 줄(src.bankId)로 문항 수 세기·거르기');
  {
    A.setRows([1, 2, 3, 4, 5, 6, 7].map(i => light(A._ibNorm(mkItem(i)))));
    A.resetF();
    ok('bank-1 문항 수', A.ibCountForBank('bank-1') === 2, A.ibCountForBank('bank-1') + '개');
    ok('bank-2 문항 수', A.ibCountForBank('bank-2') === 3, A.ibCountForBank('bank-2') + '개');
    ok('없는 자료는 0', A.ibCountForBank('bank-없음') === 0);
    A.setF({ bankId: 'bank-1' });
    const f = A._ibFiltered();
    ok('그 자료로 걸러 보기', f.length === 2 && f.every(r => r.meta.src.bankId === 'bank-1'), f.length + '개');
    A.setF({ bankId: '' });
    ok('풀면 다시 전체', A._ibFiltered().length === 7);
  }

  console.log('\n(c) 그림 문항·검토 필요');
  {
    const rows = [
      light(A._ibNorm(mkItem(1, { hasImage: true }))),
      light(A._ibNorm(mkItem(2, { warn: '지문이 잘린 것 같아요' }))),
      light(A._ibNorm(mkItem(3))),
    ];
    A.setRows(rows); A.resetF();
    ok('hasImage 가 목록 줄까지 간다', rows[0].meta.hasImage === true);
    ok('warn 이 목록 줄까지 간다', rows[1].meta.warn === '지문이 잘린 것 같아요');
    const b0 = A._ibBadges(rows[0].meta), b1 = A._ibBadges(rows[1].meta), b2 = A._ibBadges(rows[2].meta);
    ok("'그림 문항' 표시", b0.indexOf('그림 문항') >= 0 && b2.indexOf('그림 문항') < 0);
    ok("'검토 필요' 표시", b1.indexOf('검토 필요') >= 0 && b2.indexOf('검토 필요') < 0);
    ok("정답률이 글자로 보인다", /정답률 \d+%/.test(b2), (b2.match(/정답률 \d+%/) || [''])[0]);
    const btn = A._ibItemBtns(rows[0]);
    ok('그림 문항은 [원본 보기]가 맨 앞', btn.indexOf('ibOpenSrcFile') >= 0 && btn.indexOf('ibOpenSrcFile') < btn.indexOf('ibStar'));
    ok('음원이 있으면 듣기 단추', btn.indexOf('ibPlayAudio') >= 0);
    A.setF({ warn: true });
    const f = A._ibFiltered();
    ok("'검토 필요만' 거르기", f.length === 1 && f[0].id === 'it-2', f.length + '개');
    A.resetF();
  }

  console.log('\n(b) 3,000문항 가져오기');
  {
    A.setRows([]); IDB.clear(); A.noTable(false);
    const sent = [];
    A.setBulk(async list => { sent.push(list.length); return true; });
    const arr = [];
    for (let i = 1; i <= 3000; i++)arr.push(mkItem(i));
    arr.push({ id: 'bad-1' });                       // 쓸 수 없는 줄 (발문·지문·대본 없음)
    arr.push('이건 문항이 아니다');
    // 화면이 멈추지 않는가 — 가져오는 동안 타이머가 돌아야 한다
    let ticks = 0;
    const tm = setInterval(() => { ticks++; }, 1);
    const t0 = Date.now();
    const sum = await runImport(arr, 'skip');
    const ms = Date.now() - t0;
    clearInterval(tm);
    ok('3,000개가 들어갔다', A.getRows().length === 3000, A.getRows().length + '개 · ' + ms + 'ms');
    ok('200개씩 나눠 올린다', sent.length === 15 && sent.every(n => n <= 200), sent.length + '묶음');
    ok('가져오는 동안에도 화면이 돈다 (타이머가 멈추지 않는다)', ticks > 5, '틱 ' + ticks + '회');
    ok('요약에 새로 3,000', sum.indexOf('새로 3,000') >= 0, sum.replace(/<[^>]+>/g, ' ').trim().slice(0, 90));
    ok('오류 2건과 줄 번호', sum.indexOf('오류 2') >= 0 && sum.indexOf('3001, 3002') >= 0);
    // 다시 넣으면 이어진다 (id 로 건너뛴다)
    const sum2 = await runImport(arr, 'skip');
    ok('같은 파일을 다시 넣으면 건너뜀 3,000', sum2.indexOf('건너뜀 3,000') >= 0, sum2.replace(/<[^>]+>/g, ' ').trim().slice(0, 90));
    ok('더 늘지 않는다', A.getRows().length === 3000, A.getRows().length + '개');

    // 검색 시간
    A.setF({ q: 'festival' });
    const t1 = Date.now(); let n = 0;
    for (let i = 0; i < 20; i++)n = A._ibFiltered().length;
    const per = (Date.now() - t1) / 20;
    console.log('  ⏱ 3,000문항에서 거르기+검색 ' + per.toFixed(1) + 'ms (20회 평균, ' + n.toLocaleString() + '개 맞음)');
    A.setF({ q: '목적으로' });
    const t2 = Date.now(); let n2 = 0;
    for (let i = 0; i < 20; i++)n2 = A._ibFiltered().length;
    console.log('  ⏱ 한글 발문 검색 ' + ((Date.now() - t2) / 20).toFixed(1) + 'ms (' + n2.toLocaleString() + '개 맞음)');
    ok('검색이 50ms 안에 끝난다', per < 50, per.toFixed(1) + 'ms');
    A.resetF();
  }

  console.log('\n(d) 원문이 든 문항은 서버에 올리지 않는다');
  {
    A.setRows([]); IDB.clear();
    const sent = [];
    A.setBulk(async list => { sent.push(list.length); return true; });
    const arr = [];
    for (let i = 1; i <= 120; i++)arr.push(mkItem(i, { src: Object.assign({}, mkItem(i).src, { keep: true }) }));
    await runImport(arr, 'skip');
    ok('ITEM_KEEP_SERVER 는 그대로 false', A.ITEM_KEEP_SERVER === false);
    ok('서버 저장 호출 0회', sent.length === 0, '호출 ' + sent.length + '회');
    const dev = await A._ibDevAll();
    ok('기기에 120개가 보관된다', dev.length === 120, dev.length + '개');
    ok('목록에는 그대로 보인다', A.getRows().length === 120);
    // 섞여 들어와도 갈라진다
    A.setRows([]); IDB.clear(); sent.length = 0;
    const mix = [];
    for (let i = 200; i < 240; i++)mix.push(mkItem(i, i % 2 ? { src: Object.assign({}, mkItem(i).src, { keep: true }) } : null));
    await runImport(mix, 'skip');
    const dev2 = await A._ibDevAll();
    ok('원문은 기기, 나머지는 서버로 갈라진다', dev2.length === 20 && sent.reduce((a, b) => a + b, 0) === 20,
      '기기 ' + dev2.length + ' · 서버 ' + sent.reduce((a, b) => a + b, 0));
  }

  console.log('\n(e) 기기 보관분 백업 → 빈 기기에서 되살리기');
  {
    const before = await A._ibDevAll();
    const dump = { v: 1, kind: 'pp-item-device', at: new Date().toISOString(), items: before };
    const json = JSON.stringify(dump);
    ok('내보낼 것이 있다', before.length > 0, before.length + '개');
    let threw = '';
    try { await A.ibDevExport(); } catch (e) { threw = String(e && e.message); }
    ok('내보내기가 멈추지 않는다', !threw, threw || 'ok');
    // 빈 기기
    A.setRows([]); IDB.clear();
    const sent = [];
    A.setBulk(async list => { sent.push(list.length); return true; });
    const back = JSON.parse(json);
    await runImport(back.items, 'skip');
    const after = await A._ibDevAll();
    ok('같은 수가 돌아온다', after.length === before.length, after.length + ' / ' + before.length);
    const key = x => x.id + '|' + x.stem + '|' + (x.script || '') + '|' + (x.choices || []).join(',') + '|' + x.answer;
    const a1 = before.map(key).sort().join('§'), a2 = after.map(key).sort().join('§');
    ok('내용이 같다', a1 === a2);
    ok('되살릴 때도 서버 저장 0회', sent.length === 0, '호출 ' + sent.length + '회');
  }

  console.log('\n(f) 제목 꼴 첫 줄');
  {
    const NL = String.fromCharCode(10);
    const t1 = A._lkParse('Who Is in Your Heart?' + NL + 'Everyone has someone special.' + NL + 'I have my grandmother.');
    ok("'Who Is in Your Heart?' 를 제목으로 뗀다", t1.title === 'Who Is in Your Heart?', t1.title || '(못 뗌)');
    ok('1번 문장은 본문 첫 문장', t1.sents[0] && t1.sents[0].text === 'Everyone has someone special.', (t1.sents[0] || {}).text);
    const t2 = A._lkParse('Find a Dream and Live It!' + NL + 'Many people have dreams.' + NL + 'They work hard.');
    ok("'Find a Dream and Live It!' 도 제목", t2.title === 'Find a Dream and Live It!', t2.title || '(못 뗌)');
    const t3 = A._lkParse('Do you like it?' + NL + 'Yes, I do.' + NL + 'It is fun.');
    ok('보통 의문문은 제목이 아니다', t3.title === '' && t3.sents[0].text === 'Do you like it?', t3.title || '(제목 없음)');
    const t4 = A._lkParse('Street Art in London' + NL + 'Modern street art comes in many forms.');
    ok('문장부호 없는 제목은 그대로', t4.title === 'Street Art in London', t4.title);
    ok('제목 꼴 판정', A._lkTitleish('Who Is in Your Heart?') === true
      && A._lkTitleish('Do you like it?') === false
      && A._lkTitleish('I am going to the store right now to buy some milk?') === false);
    // 해석은 줄 번호로 붙는다 — 제목 줄을 뗀 뒤에도 어긋나지 않아야 한다
    ok('제목 줄 번호가 남는다 (해석은 줄 번호로 찾는다)', t1.titleLine === 0 && t1.sents[0].line === 1,
      '제목줄 ' + t1.titleLine + ' · 첫 문장줄 ' + t1.sents[0].line);
  }

  console.log('\n' + (fail ? '❌' : '✅') + ' 통과 ' + pass + ' / 실패 ' + fail + '\n');
  process.exit(fail ? 1 : 0);
})();
