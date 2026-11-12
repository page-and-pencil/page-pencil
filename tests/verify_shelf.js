require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 학생 복습 탭 '수업 교재 복습' 검증 — 실데이터 GET 만, 쓰기 전부 차단.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const SID = (process.env.PP_REAL_SID || '');           // 실학생
const TB = 'cpbsdmsu00vu';            // Read It! 30-1
let fails = 0;
const say = (p, l, e) => { if (!p) fails++; console.log((p ? 'OK  ' : 'FAIL') + ' ' + l + (e ? '  — ' + e : '')); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
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

  const r = await page.evaluate(async (o) => {
    await previewAsStudent(o.sid);
    await new Promise(x => setTimeout(x, 2600));
    swStuTab('st-library');
    await new Promise(x => setTimeout(x, 1200));
    // Read It! 30-1 책을 펼친다
    stuShelfToggle(o.tb);
    await new Promise(x => setTimeout(x, 900));
    const panel = document.getElementById('tb-shelf-panel') || document.getElementById('st-library');
    const el = document.getElementById('st-library');
    const txt = (el.textContent || '').replace(/\s+/g, ' ');
    // 펼쳐진 책의 단원 줄 = 복습/듣기 버튼이 달린 행
    const rows = [...el.querySelectorAll('div')].filter(d => /^Unit \d/.test((d.textContent || '').trim()) && d.children.length <= 3);
    const panelEl = document.getElementById('tb-shelf-panel');
    const scope = panelEl || el;
    const unitNames = [...new Set([...scope.querySelectorAll('[onclick^="openUnitReview"]')].map(b => (b.getAttribute('onclick') || '').split("','")[1] || ''))].map(x => x.replace(/'\)$/, ''));
    const allRows = [...scope.querySelectorAll('div')].map(d => d.firstElementChild && d.firstElementChild.firstElementChild ? (d.firstElementChild.firstElementChild.textContent || '').trim() : '').filter(Boolean);
    const tbObj = (_cache.globalTextbooks || []).find(b => b.id === o.tb);
    const shelfTitles = [...el.querySelectorAll('.shelf-t')].map(x => x.textContent.trim());
    return {
      openId: _stuShelfOpen,
      title: tbObj ? tbObj.title : '(없음)',
      dbUnits: Object.keys((tbObj || {}).units || {}).length,
      reviewBtns: unitNames.length,
      units: unitNames.sort(),
      inShelf: shelfTitles.indexOf(tbObj ? tbObj.title : '') >= 0,
      shelfN: shelfTitles.length,
      hasReadIt: /Read It! 30-1/.test(txt),
      panelFound: !!panelEl, allRows: [...new Set(allRows)].slice(0, 30),
    };
  }, { sid: SID, tb: TB });

  console.log('── 실학생 학생 뷰 · 수업 교재 복습');
  console.log('   책장 ' + r.shelfN + '권 · 펼친 책 ' + r.title + ' (교재 DB 단원 ' + r.dbUnits + '개)');
  say(r.inShelf, '책장에 Read It! 30-1 가 있다');
  say(r.reviewBtns === 16, "'📖 복습' 버튼이 달린 단원 수 = 16", r.reviewBtns + '개');
  console.log('   단원: ' + r.units.join(' · '));
  console.log('   패널 id 찾음: ' + r.panelFound + ' · _stuShelfOpen=' + r.openId);
  console.log('   패널 행: ' + r.allRows.join(' | ').slice(0, 400));

  console.log('\n실DB 쓰기 시도 ' + writes.length + '건(전부 차단) · 콘솔 오류 ' + errs.length + '건');
  [...new Set(errs)].slice(0, 4).forEach(e => console.log('   ! ' + e));
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
