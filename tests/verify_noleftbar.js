require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 한쪽에만 굵은 색 선 금지 (fix/no-leftbar, 2026-11-15 Todd 결정)
//   ① 파일: style.css·tokens.css·index.html·js/*.js 에 border-left 2px 이상 · inset Npx 0 0 (N≥2) 0곳
//   ② 화면: 선생님 8탭 · 교재·문제 13화면 · 수업 기록 · 학생 3탭 · 학부모 탭에서
//           왼쪽 테두리만 굵은 요소 0 · 왼쪽에 붙은 폭 2~8px ::before/::after 막대 0
//   ③ 숙제 줄: 체크 네모가 영역 색, 줄 바탕은 영역과 상관없이 같다
//   ④ 고른 줄(.al-row.on)은 바탕이 다르다
// 실제 서버는 읽지도 쓰지도 않는다.
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const ok = (n, c, note) => { (c ? pass : fail).push(n); console.log((c ? '  OK  ' : '  X   ') + n + (note ? ' — ' + note : '')); };

// ── ① 파일을 읽어 센다 ──
const FILES = ['css/style.css', 'css/tokens.css', 'index.html', ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => /\.js$/.test(f)).map(f => 'js/' + f)];
const hits = [];
for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((line, i) => {
    // border-left: 3px … / border-left-width: 4px
    for (const m of line.matchAll(/border-left(?:-width)?\s*:\s*([^;"'`}]*)/g)) {
      const px = (m[1].match(/(\d+(?:\.\d+)?)px/) || [])[1];
      if (px && parseFloat(px) >= 2) hits.push(f + ':' + (i + 1) + ' ' + m[0].slice(0, 50));
    }
    // border-width: 위 오른 아래 왼 — 왼쪽이 2px 이상이고 다른 쪽보다 굵다
    for (const m of line.matchAll(/border-width\s*:\s*([\d.]+)(?:px)?\s+([\d.]+)(?:px)?\s+([\d.]+)(?:px)?\s+([\d.]+)px/g)) {
      const [t, r, b, l] = [m[1], m[2], m[3], m[4]].map(parseFloat);
      if (l >= 2 && l > Math.max(t, r, b) + 1.5) hits.push(f + ':' + (i + 1) + ' ' + m[0]);
    }
    // inset 3px 0 0 — 안쪽 그림자 띠
    for (const m of line.matchAll(/inset\s+([\d.]+)px\s+0(?:px)?\s+0(?:px)?/g)) {
      if (parseFloat(m[1]) >= 2) hits.push(f + ':' + (i + 1) + ' ' + m[0]);
    }
  });
}
ok('① 파일에 왼쪽 굵은 선·안쪽 그림자 띠 0곳', hits.length === 0, FILES.length + '개 파일' + (hits.length ? ' · ' + hits.slice(0, 8).join(' | ') : ''));

// ── ② 화면 ──
const scan = (pg, sel) => pg.evaluate(sel => {
  const root = document.querySelector(sel);
  if (!root || root.offsetParent === null && getComputedStyle(root).position !== 'fixed') return { skip: true };
  const out = [];
  const nm = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  for (const e of [root, ...root.querySelectorAll('*')]) {
    if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') continue;
    const cs = getComputedStyle(e);
    const L = cs.borderLeftStyle === 'none' ? 0 : parseFloat(cs.borderLeftWidth) || 0;
    if (L >= 2) {
      const o = Math.max(...['Top', 'Right', 'Bottom'].map(k => cs['border' + k + 'Style'] === 'none' ? 0 : parseFloat(cs['border' + k + 'Width']) || 0));
      if (L > o + 1.5) out.push(nm(e) + ' 왼쪽 ' + L + 'px');
    }
    const sh = cs.boxShadow || '';
    if (/inset/.test(sh) && /(^|,)\s*(rgba?\([^)]*\)\s*)?[2-9]\d*(\.\d+)?px 0px 0px/.test(sh.replace(/inset/g, ''))) out.push(nm(e) + ' 안쪽 그림자 ' + sh.slice(0, 40));
    for (const ps of ['::before', '::after']) {
      const p = getComputedStyle(e, ps);
      if (!p || p.content === 'none' || p.content === 'normal' || p.display === 'none') continue;
      if (p.position !== 'absolute' && p.position !== 'fixed') continue;
      const w = parseFloat(p.width), h = parseFloat(p.height), lf = parseFloat(p.left);
      const filled = (p.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(p.backgroundColor)) || p.backgroundImage !== 'none';
      if (w >= 2 && w <= 8 && h >= 10 && !isNaN(lf) && lf <= 2 && filled && h > w * 2.5) out.push(nm(e) + ps + ' 막대 ' + w + 'x' + h);
    }
  }
  return { hits: out };
}, sel);

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const mk = async (sess, vp) => {
    const ctx = await browser.newContext({ viewport: vp || { width: 1366, height: 800 }, locale: 'ko-KR' });
    await ctx.addInitScript(s => { try { localStorage.setItem('pp_session', JSON.stringify(s)); } catch (e) { } }, sess);
    const page = await ctx.newPage();
    await page.route('**/rest/v1/**', r => r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 201, body: '[]' }));
    await page.route('**/functions/v1/**', r => r.fulfill({ status: 400, contentType: 'application/json', body: '{}' }));
    await page.goto('http://localhost:5500/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 120000 });
    await wait(1500);
    return { ctx, page };
  };
  const errs = [];
  const T = await mk({ role: 'teacher' });
  T.page.on('pageerror', e => errs.push('T ' + String(e.message).slice(0, 120)));
  const SCREENS = [
    ...['t-dash', 't-class', 't-stu', 't-assign', 't-tst', 't-data', 't-worksheet', 't-cfg'].map(k => [k, "swTab('" + k + "')", '#' + k]),
    ...['library', 'tbook', 'lib', 'word', 'bank', 'make', 'items', 'paper', 'iso', 'kit', 'ws', 'exam', 'master']
      .map(k => ['교재·문제 ' + k, "swTab('t-data');switchDataTab('" + k + "')", '#t-data']),
    ['수업 기록', "swTab('t-les');document.querySelectorAll('#subj-chips .chip[data-s=reading]').forEach(c=>c.click())", '#t-les'],
  ];
  const bad = [];
  let seen = 0;
  for (const [nmS, open, sel] of SCREENS) {
    await T.page.evaluate(src => { try { (0, eval)(src); } catch (e) { } }, open);
    await wait(350);
    const r = await scan(T.page, sel);
    if (r.skip) continue;
    seen++;
    r.hits.forEach(h => bad.push(nmS + ' — ' + h));
  }
  const S = await mk({ role: 'student', sid: 'fx-stu-1' }, { width: 390, height: 780 });
  for (const k of ['st-home', 'st-vocab', 'st-library']) {
    await S.page.evaluate(k => { try { swStuTab(k); } catch (e) { } }, k);
    await wait(350);
    const r = await scan(S.page, '#' + k);
    if (r.skip) continue;
    seen++;
    r.hits.forEach(h => bad.push('학생 ' + k + ' — ' + h));
  }
  const P = await mk({ role: 'parent', sid: 'fx-stu-1' }, { width: 390, height: 780 });
  const tabs = await P.page.evaluate(() => [...document.querySelectorAll('#s-parent [data-ppnav]')].filter(b => b.offsetParent !== null).map(b => b.dataset.ppnav));
  for (const k of tabs) {
    await P.page.evaluate(k => { try { ppNav(document.querySelector('[data-ppnav="' + k + '"]'), k); } catch (e) { } }, k);
    await wait(350);
    const r = await scan(P.page, '#s-parent');
    if (r.skip) continue;
    seen++;
    r.hits.forEach(h => bad.push('학부모 ' + k + ' — ' + h));
  }
  bad.forEach(b => console.log('      ' + b));
  ok('② 화면에 왼쪽만 굵은 테두리·왼쪽 막대 0개', bad.length === 0 && seen >= 26, '본 화면 ' + seen + '개 · 걸림 ' + bad.length);

  // ── ③ 숙제 줄 — 체크 네모가 영역 색 ──
  const hw = await T.page.evaluate(() => {
    swTab('t-class');
    const box = document.createElement('div'); box.id = '__nlb'; box.style.cssText = 'position:fixed;left:10px;top:10px;width:200px;z-index:99999;background:#fff';
    const COLS = ['#3B6FD4', '#7C4DD6', '#10876A'];
    box.innerHTML = COLS.map(c => _pgHwRowHtml({ label: '안 함', color: c, done: false }) + _pgHwRowHtml({ label: '함', color: c, done: true })).join('');
    document.body.appendChild(box);
    const rgb = h => { const d = document.createElement('i'); d.style.color = h; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; };
    const rows = [...box.querySelectorAll('.pg-hw-row')];
    const res = rows.map((r, i) => { const ck = r.querySelector('.pg-ck'), cs = getComputedStyle(ck);
      return { want: rgb(COLS[i >> 1]), done: r.classList.contains('done'), border: cs.borderTopColor, fill: cs.backgroundColor, rowBg: getComputedStyle(r).backgroundColor,
        after: getComputedStyle(ck, '::after').content, left: getComputedStyle(r).borderLeftWidth }; });
    box.remove();
    return res;
  });
  const undone = hw.filter(x => !x.done), done = hw.filter(x => x.done);
  ok('③ 안 한 줄: 체크 네모 테두리가 영역 색 (빈 네모)', undone.every(x => x.border === x.want && x.fill === 'rgb(255, 255, 255)'), undone.map(x => x.border + '/' + x.fill).join(' · '));
  ok('③ 한 줄: 네모 채움이 영역 색 · 흰 체크', done.every(x => x.fill === x.want && x.after !== 'none'), done.map(x => x.fill).join(' · '));
  ok('③ 줄 바탕은 영역과 상관없이 같다 · 왼쪽 선 없음', new Set(hw.map(x => x.rowBg)).size === 1 && hw.every(x => parseFloat(x.left) < 2), [...new Set(hw.map(x => x.rowBg))].join(' · '));

  // ── ④ 고른 줄 ──
  const al = await T.page.evaluate(() => {
    swTab('t-assign');
    const host = document.querySelector('#t-assign') || document.body;
    const box = document.createElement('div');
    box.innerHTML = '<div class="al-row"><span>가</span></div><div class="al-row on"><span>나</span></div>';
    host.appendChild(box);
    const [a, b] = box.querySelectorAll('.al-row');
    const r = { a: getComputedStyle(a).backgroundColor, b: getComputedStyle(b).backgroundColor, sh: getComputedStyle(b).boxShadow, fw: getComputedStyle(b.firstElementChild).fontWeight };
    box.remove();
    return r;
  });
  ok('④ 고른 줄은 바탕이 다르고 굵은 글자 · 안쪽 그림자 없음', al.a !== al.b && !/inset/.test(al.sh) && +al.fw >= 600, al.a + ' → ' + al.b + ' · ' + al.fw);

  console.log('\n콘솔 오류 ' + errs.length + '건');
  console.log('\n' + (global.__PP_GUARD ? global.__PP_GUARD.guardLine() : ''));
  console.log((fail.length ? '❌' : '✅') + ' 통과 ' + pass.length + ' / 실패 ' + fail.length);
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('verify_noleftbar 실패:', e); process.exit(1); });
