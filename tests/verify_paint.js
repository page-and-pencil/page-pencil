require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
const { pageUrl, fileUrl } = require('./_page');
// 실제로 '칠해진' 파랑·남색·보라만 찾는다 — 계산된 스타일 기준. 소스에 남아 있어도 덮여 있으면 제외.
// 동시에 초록 배경 위 글자 대비를 재서 4.5:1 미만을 보고한다. 실DB 쓰기 차단.
const path = require('path');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const dbs = fs.readFileSync(ROOT + '/js/db.js', 'utf8');
const U = dbs.match(/const SUPA_URL='([^']+)'/)[1];
const K = dbs.match(/const SUPA_KEY='([^']+)'/)[1];

const SCAN = () => {
  const parse = (s) => { const m = String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };
  const hue = (c) => { const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return { h: 0, s: 0, l: (mx + mn) / 2 }; let h; if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; const l = (mx + mn) / 2; return { h, s: d / (1 - Math.abs(2 * l - 1)), l }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const cr = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05); };
  const bgOf = (el) => { let e = el; while (e && e !== document.documentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > .5) return c; e = e.parentElement; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const blues = [], low = [];
  const sel = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '');
  document.querySelectorAll('body *').forEach(e => {
    const r = e.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') return;
    for (const prop of ['backgroundColor', 'color', 'borderTopColor', 'borderLeftColor']) {
      const c = parse(cs[prop]); if (!c || c.a < .35) continue;
      if (prop !== 'color' && prop !== 'backgroundColor' && cs.borderTopWidth === '0px' && cs.borderLeftWidth === '0px') continue;
      const h = hue(c);
      const NEUTRAL = ['27,36,48','95,102,114','154,161,172','230,232,236','233,236,242','247,248,250','241,243,246','213,217,224','23,43,77','15,48,74'];
      if (NEUTRAL.indexOf(c.r + ',' + c.g + ',' + c.b) >= 0) continue;   // 의도된 무채색(글자·테두리·그림자)
      if (h.h >= 195 && h.h <= 295 && h.s >= .35 && h.l > .08 && h.l < .95) {
        blues.push({ sel: sel(e), prop, col: `rgb(${c.r},${c.g},${c.b})`, hue: Math.round(h.h), txt: (e.textContent || '').trim().slice(0, 18) });
      }
    }
    // 글자 대비 — 초록 계열 배경 위만
    const t = (e.textContent || '').trim();
    if (t && e.children.length === 0) {
      const fg = parse(cs.color), bg = bgOf(e);
      if (fg && fg.a > .5) {
        const hb = hue(bg);
        if (hb.h >= 100 && hb.h <= 180 && hb.s >= .08) {
          const ratio = cr(fg, bg);
          const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
          if (ratio < (big ? 3 : 4.5)) low.push({ sel: sel(e), ratio: Math.round(ratio * 100) / 100, fg: `rgb(${fg.r},${fg.g},${fg.b})`, bg: `rgb(${bg.r},${bg.g},${bg.b})`, size: cs.fontSize, txt: t.slice(0, 20) });
        }
      }
    }
  });
  const uniq = (arr, k) => { const m = new Map(); arr.forEach(x => { const key = k(x); if (!m.has(key)) m.set(key, x); }); return [...m.values()]; };
  return { blues: uniq(blues, x => x.sel + x.prop + x.col), low: uniq(low, x => x.sel + x.fg + x.bg) };
};

(async () => {
  const srows = await (await fetch(U + '/rest/v1/students?select=*&limit=20', { headers: { apikey: K, Authorization: 'Bearer ' + K } })).json();
  const stu = srows.map(r => ({ id: r.id, ...(r.data || {}) })).filter(s => !s.inactive && !s._deleted)[0];
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const BASE = pageUrl();
  const allBlues = [], allLow = [];
  for (const [role, label] of [[null, '진입 화면'], ['teacher', '선생님 대시보드'], ['student', '학생 화면'], ['parent', '학부모 화면']]) {
    for (const w of [320, 390, 1440]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'ko-KR' });
      if (role) await ctx.addInitScript(o => { try { localStorage.setItem('pp_session', JSON.stringify({ role: o.r, sid: o.s })); } catch (e) { } }, { r: role, s: stu.id });
      const page = await ctx.newPage();
      await page.route('**/rest/v1/**', r => { const m = r.request().method(); return (m === 'GET' || m === 'HEAD') ? r.continue() : r.fulfill({ status: 200, body: '[]' }); });
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
      if (role) await page.waitForFunction(() => { try { return (_cache.students || []).length > 0; } catch (e) { return false; } }, null, { timeout: 90000 });
      await page.waitForTimeout(role ? 5000 : 1500);
      const r = await page.evaluate(SCAN);
      r.blues.forEach(x => allBlues.push({ ...x, screen: label, w }));
      r.low.forEach(x => allLow.push({ ...x, screen: label, w }));
      await ctx.close();
    }
  }
  const key = x => x.sel + x.prop + x.col;
  const seen = new Set(); const blues = allBlues.filter(x => { if (seen.has(key(x))) return false; seen.add(key(x)); return true; });
  console.log('■ 실제로 칠해진 파랑·남색·보라: ' + blues.length + '종');
  blues.sort((a, b) => a.screen.localeCompare(b.screen)).forEach(x =>
    console.log(`   [${x.screen}] ${x.sel}  ${x.prop}=${x.col} hue${x.hue}  "${x.txt}"`));
  const seen2 = new Set(); const low = allLow.filter(x => { const k = x.sel + x.fg + x.bg; if (seen2.has(k)) return false; seen2.add(k); return true; });
  console.log('\n■ 초록 배경 위 글자 대비 4.5:1 미만: ' + low.length + '종');
  low.forEach(x => console.log(`   [${x.screen}] ${x.sel}  ${x.ratio}:1  ${x.fg} on ${x.bg}  ${x.size}  "${x.txt}"`));
  await browser.close();
})();
