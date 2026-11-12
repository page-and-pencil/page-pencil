require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 조건 3 — 스냅샷 부팅 뒤에도 학생 단어장 3단계와 원서 듣기 본문이 온전한지.
// 같은 항목을 '전체 로드 부팅' 과 '스냅샷 부팅' 에서 재서 비교한다. 실DB 쓰기 차단.
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 860 }, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 130)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 130)); });
  let full = 0;
  page.on('request', r => { if (/global_textbooks\?limit=/.test(r.url())) full++; });
  await page.route('**/rest/v1/**', r => {
    const m = r.request().method();
    return (m === 'GET' || m === 'HEAD') ? r.continue() : r.fulfill({ status: 200, body: '[]' });
  });
  const BASE = 'file:///' + encodeURI(ROOT + '/index.html');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.evaluate(s => localStorage.setItem('pp_session', JSON.stringify({ role: 'student', sid: s })), sid);

  const probe = async () => {
    full = 0;
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
    await page.waitForTimeout(5000);
    const out = await page.evaluate(async (s) => {
      const r = { full: 0 };
      // 단어장 3단계
      r.stages = (typeof vocabStagePlan === 'function') ? vocabStagePlan(s) : null;
      r.cards = (_cache.vocab_cards || []).filter(c => c.sid === s).length;
      try { swStuTab('st-vocab'); } catch (e) { r.vocabErr = e.message; }
      await new Promise(x => setTimeout(x, 800));
      try { if (typeof openVocabStudy === 'function') openVocabStudy('today'); } catch (e) { r.deckErr = e.message; }
      await new Promise(x => setTimeout(x, 1200));
      r.deckWords = (typeof deckState !== 'undefined' && deckState && Array.isArray(deckState.cards)) ? deckState.cards.length : -1;
      r.deckStages = (typeof deckState !== 'undefined' && deckState && Array.isArray(deckState.stages)) ? deckState.stages.join('>') : '';
      const ve = document.getElementById('st-vocab');
      r.vocabText = ve ? (ve.textContent || '').replace(/\s+/g, ' ').trim().length : 0;
      r.vocabHead = ve ? (ve.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90) : '';
      r.stageBar = !!document.querySelector('#st-vocab .vc-bar, #st-vocab .vcstage, #st-vocab [class*=stage]');
      // 원서 듣기 본문
      const libs = (_cache.library || []);
      r.libs = libs.length;
      r.withText = libs.filter(b => typeof bookTextOf === 'function' && bookTextOf(b)).length;
      r.listenable = libs.filter(b => typeof bookListenable === 'function' && bookListenable(b)).length;
      const sample = libs.find(b => typeof bookTextOf === 'function' && bookTextOf(b).length > 100);
      r.sampleLen = sample ? bookTextOf(sample).length : 0;
      // 교재 단원 단어·본문
      r.tbUnits = (_cache.globalTextbooks || []).filter(b => b.units && Object.keys(b.units).length).length;
      r.tbTexts = (_cache.globalTextbooks || []).filter(b => b.unitTexts && Object.keys(b.unitTexts).length).length;
      r.tbWordTotal = (_cache.globalTextbooks || []).reduce((a, b) => a + Object.values(b.units || {}).reduce((x, u) => x + (Array.isArray(u) ? u.length : 0), 0), 0);
      try { swStuTab('st-library'); } catch (e) { r.libErr = e.message; }
      await new Promise(x => setTimeout(x, 900));
      const le = document.getElementById('st-library');
      r.libText = le ? (le.textContent || '').replace(/\s+/g, ' ').trim().length : 0;
      return r;
    }, sid);
    out.full = full;
    return out;
  };

  const a = await probe();   // 1회차: 스냅샷 없음 → 전체 로드
  const b = await probe();   // 2회차: 스냅샷 부팅
  console.log('\n           전체 로드 부팅 → 스냅샷 부팅');
  say(a.full === 1 && b.full === 0, '2회차는 교재 전체를 받지 않음', a.full + '회 → ' + b.full + '회');
  say(b.cards === a.cards && b.cards > 0, '내 단어카드 수 동일', a.cards + ' → ' + b.cards);
  say(JSON.stringify(b.stages) === JSON.stringify(a.stages) && (b.stages || []).length === 3, '3단계 구성 동일', (a.stages || []).join('>') + ' → ' + (b.stages || []).join('>'));
  say(b.deckWords === a.deckWords && b.deckWords > 0, '덱에 들어간 단어 수 동일', a.deckWords + ' → ' + b.deckWords);
  say(b.deckStages === a.deckStages && !!b.deckStages, '덱 단계 순서 동일', a.deckStages + ' → ' + b.deckStages);
  say(b.tbWordTotal === a.tbWordTotal && b.tbWordTotal > 0, '교재 단원 단어 총수 동일', a.tbWordTotal + ' → ' + b.tbWordTotal);
  say(b.tbTexts === a.tbTexts, '본문 있는 교재 수 동일', a.tbTexts + ' → ' + b.tbTexts);
  say(b.withText === a.withText && b.listenable === a.listenable, '원서 본문·듣기 가능 권수 동일',
    `본문 ${a.withText}→${b.withText}권 · 듣기 ${a.listenable}→${b.listenable}권 / 전체 ${b.libs}권`);
  say(b.sampleLen === a.sampleLen && b.sampleLen > 100, '표본 원서 본문 길이 동일', a.sampleLen + '자 → ' + b.sampleLen + '자');
  say(b.vocabText > 50 && b.libText > 50, '단어장·원서 화면이 내용과 함께 그려짐', '단어장 ' + b.vocabText + '자 · 원서 ' + b.libText + '자');
  say(b.vocabHead === a.vocabHead, '단어장 화면 첫 문구 동일', '[' + b.vocabHead + ']');
  say(!a.vocabErr && !b.vocabErr && !a.deckErr && !b.deckErr && !a.libErr && !b.libErr, '렌더 중 예외 없음',
    [a.vocabErr, b.vocabErr, a.deckErr, b.deckErr, a.libErr, b.libErr].filter(Boolean).join(' | ') || '없음');
  console.log('\n콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 5).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await ctx.close(); await browser.close();
  process.exit(fails ? 1 : 0);
})();
