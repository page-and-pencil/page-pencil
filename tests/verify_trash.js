require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 휴지통 행이 새어 나오는지 검증. 실데이터 GET 만, 쓰기는 전부 차단.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1];
const K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];
const DEL = 'mw4t32s8lzs8';   // 지운 '리딩앤' (주말만, 11/7~11/8)
const KEEP = '1a11aa1fc51z7s9'; // 남긴 '리딩앤 원서 읽기'
const SID = (process.env.PP_REAL_SID || '');
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pp_session', JSON.stringify({ role: 'teacher' })); } catch (e) { } });
  const page = await ctx.newPage();
  const writes = []; const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
  await page.route('**/functions/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, server: true, ready: true, voices: ['XrExE9yKIg1WjnnlVkGX'], content: [{ text: '좋아요' }] }) }));
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    if (m === 'GET' || m === 'HEAD') return r.continue();
    writes.push(m + ' ' + r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({ status: 200, body: '[]' });
  });
  await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
  await page.waitForTimeout(4500);

  // ───── 서버에 휴지통 행이 실제로 있는지(전제 확인) ─────
  const raw = await page.evaluate(async (o) => {
    const rows = await supaFetchBySid('assignments', o.sid, { withDeleted: true });
    const live = await supaFetchBySid('assignments', o.sid);
    return { all: rows.length, live: live.length, delInAll: rows.some(a => a.id === o.DEL), delInLive: live.some(a => a.id === o.DEL), keepInLive: live.some(a => a.id === o.KEEP) };
  }, { sid: SID, DEL, KEEP });
  console.log('── 전제: 서버 행');
  say(raw.delInAll, '휴지통에 ' + DEL + ' 가 있다(withDeleted:true 로는 보임)', raw.all + '건');
  say(!raw.delInLive, 'supaFetchBySid 기본값은 휴지통을 뺀다', raw.live + '건');
  say(raw.keepInLive, '남긴 숙제는 그대로 받아진다');

  // ───── 1·2. 학생 로그인(미리보기) → 오늘 퀘스트 ─────
  console.log('\n── 1·2  학생 화면');
  const stu = await page.evaluate(async (o) => {
    await previewAsStudent(o.sid);
    await new Promise(r => setTimeout(r, 2600));
    const cacheHasDel = (_cache.assignments || []).some(a => a.id === o.DEL);
    const home = (document.getElementById('st-home').textContent || '').replace(/\s+/g, ' ');
    // 오늘 칸의 카드 id 목록
    const ids = [...document.querySelectorAll('#st-home [id^="sch-card-"], #st-home [id^="hw-card-"]')].map(e => e.id);
    return {
      cacheHasDel,
      delCard: ids.some(i => i.indexOf(o.DEL) >= 0),
      keepCard: ids.some(i => i.indexOf(o.KEEP) >= 0),
      // '리딩앤' 과 '리딩앤 원서 읽기' 는 앞글자가 같다 — 제목 전체로 센다
      nReadAnd: (home.match(/리딩앤(?! 원서)/g) || []).length,
      nReadAndBook: (home.match(/리딩앤 원서 읽기/g) || []).length,
      ids: ids.slice(0, 8),
    };
  }, { sid: SID, DEL, KEEP });
  say(!stu.cacheHasDel, '학생 로그인이 휴지통 행을 캐시에 넣지 않음');
  say(!stu.delCard, "오늘 퀘스트에 '리딩앤'(" + DEL + ') 카드 없음');
  say(stu.keepCard || stu.nReadAndBook > 0, "'리딩앤 원서 읽기' 는 그대로 보임", stu.ids.join(' / ') || '(오늘 카드 없음)');
  console.log('     본문에 "리딩앤"(원서 제외) ' + stu.nReadAnd + '회 · "리딩앤 원서 읽기" ' + stu.nReadAndBook + '회');

  // ───── 3. 미리보기 뒤 선생님 화면 ─────
  console.log('\n── 3  미리보기 뒤 선생님 화면');
  const tea = await page.evaluate(async (o) => {
    returnToTeacher();
    await new Promise(r => setTimeout(r, 1200));
    const inCache = (_cache.assignments || []).some(a => a.id === o.DEL);
    const inDbAssigns = DB.assigns().some(a => a.id === o.DEL);
    swTab('t-assign');
    await new Promise(r => setTimeout(r, 1500));
    const pane = (document.getElementById('t-assign').textContent || '');
    const html = (document.getElementById('t-assign').innerHTML || '');
    return { inCache, inDbAssigns, inTabHtml: html.indexOf(o.DEL) >= 0, nReadAnd: (pane.match(/리딩앤(?! 원서)/g) || []).length };
  }, { DEL });
  say(!tea.inCache, '미리보기 뒤에도 선생님 캐시에 휴지통 행이 없음');
  say(!tea.inDbAssigns, 'DB.assigns() 에 없음');
  say(!tea.inTabHtml, '과제 탭·숙제 캘린더 HTML 에 ' + DEL + ' 없음', '리딩앤(원서 제외) ' + tea.nReadAnd + '회');

  // ───── 4. 휴지통 단어 되살리기 (목업 — 서버 쓰기는 차단) ─────
  console.log('\n── 4  휴지통 단어를 다시 넣으면');
  const vo = await page.evaluate(async (sid) => {
    const word = 'probeword' + Date.now().toString(36);
    const trashed = { id: 'probe-card-' + Date.now(), sid, word, meaning: '점검용', hits: 2, misses: 1, phase: 1, _deleted: true, _deletedAt: new Date().toISOString() };
    // 서버 응답을 흉내 낸다 — supaFetchBySid 를 잠깐 바꿔 끼운다
    const realFetch = window.supaFetchBySid;
    window.supaFetchBySid = async (t, s2, opts) => (t === 'vocab_cards') ? (opts && opts.withDeleted ? [trashed] : []) : realFetch(t, s2, opts);
    _cache.vocab_cards = (_cache.vocab_cards || []).filter(c => c.id !== trashed.id);
    const saved = [];
    const realUp = window.supaUpsert;
    window.supaUpsert = async (t, id, obj, s3) => { saved.push({ t, id, obj }); return true; };
    await syncVocabCards(sid, [{ word, ko: '점검용' }], [], ppToday(), '테스트', 'study');
    window.supaUpsert = realUp; window.supaFetchBySid = realFetch;
    const row = saved.find(x => x.t === 'vocab_cards');
    const inCache = (_cache.vocab_cards || []).find(c => c.word === word);
    const live = ppLive(_cache.vocab_cards).some(c => c.word === word);
    _cache.vocab_cards = (_cache.vocab_cards || []).filter(c => c.word !== word);
    return {
      savedId: row ? row.id : null, sameRow: row ? row.id === trashed.id : false,
      stillDeleted: row ? !!row.obj._deleted : null, keptHits: row ? row.obj.hits : null,
      inCache: !!inCache, live,
    };
  }, SID);
  say(vo.sameRow, '같은 행을 되살린다(새 카드를 만들어 중복시키지 않음)', vo.savedId || '(저장 없음)');
  say(vo.stillDeleted === false, '_deleted 표식이 지워짐');
  say(vo.live, '단어장 목록(ppLive)에 보임');
  say(vo.keptHits >= 2, '학습 기록(hits)이 이어짐', 'hits=' + vo.keptHits);

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(writes)].slice(0, 5).forEach(w => console.log('   · ' + w));
  [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
