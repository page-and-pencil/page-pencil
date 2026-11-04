// Page & Pencil — 화면 자동 점검 (실제 렌더 스크린샷 + 콘솔 오류 수집)
//
// 쓰는 방법:  node design_audit.js            배포본(GitHub Pages) 점검
//             node design_audit.js --local    로컬 파일 점검 (git push 전)
//             node design_audit.js --keep     브라우저를 닫지 않고 남겨두기
//
// 하는 일: 선생님·학생·학부모 화면을 320 / 390 / 1440px 로 열어 스크린샷을 저장하고,
//          콘솔 오류·가로 스크롤·화면 밖으로 나간 요소를 모아 보고합니다.
// 로그인은 비밀번호 없이 localStorage의 pp_session 을 심어 들어갑니다
// (저장된 비밀번호는 64자 해시라 평문이 없고, 자격 증명을 다룰 필요도 없습니다).
// 저장·게시·삭제·발송 버튼은 누르지 않습니다 (읽기와 캡처만).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const LOCAL = process.argv.includes('--local');
const KEEP = process.argv.includes('--keep');
const OUT = path.join('design_shots');
const BASE = LOCAL ? 'file://' + path.resolve('index.html') : 'https://page-and-pencil.github.io/page-pencil/';

const VIEWPORTS = [
  { k: 'mobile-320', w: 320, h: 760 },
  { k: 'mobile-390', w: 390, h: 844 },
  { k: 'desktop-1440', w: 1440, h: 900 },
];

function ensurePlaywright() {
  try { return require('playwright'); } catch (_) {}
  console.log('playwright 설치 중… (처음 한 번만, 브라우저는 이미 깔린 크롬을 씁니다)');
  execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', 'playwright'], { stdio: 'inherit', shell: true, timeout: 600000 });
  return require('playwright');
}

// 점검에 쓸 학생 한 명 (학생·학부모 화면용)
async function firstStudent() {
  const db = fs.readFileSync('js/db.js', 'utf8');
  const U = db.match(/const SUPA_URL='([^']+)'/)[1];
  const K = db.match(/const SUPA_KEY='([^']+)'/)[1];
  const rows = await (await fetch(`${U}/rest/v1/students?select=*&limit=50`, { headers: { apikey: K, Authorization: 'Bearer ' + K } })).json();
  return rows.map((r) => ({ id: r.id, ...(r.data || {}) })).filter((s) => !s.inactive)[0] || null;
}
// 역할 세션을 심고 그 화면으로 들어간다 (로그인 화면을 거치지 않음)
async function enter(page, base, role, sid) {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ role, sid }) => {
    localStorage.setItem('pp_session', JSON.stringify(sid ? { role, sid } : { role }));
  }, { role, sid: sid || null });
  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3500);
  return await page.evaluate(() => {
    const on = [...document.querySelectorAll('.screen.active')].map((e) => e.id)[0] || '';
    return on;
  });
}

(async () => {
  const { chromium } = ensurePlaywright();
  const stu = await firstStudent();
  console.log(`대상: ${BASE}`);
  console.log('로그인: pp_session 세션을 심어 들어갑니다 (비밀번호 불필요)');
  console.log(`학생: ${stu ? stu.name : '없음'}`);
  fs.mkdirSync(OUT, { recursive: true });

  // 스크롤바를 숨기지 않는다 — 헤드리스 기본값(--hide-scrollbars)으로 재면
  // 세로 스크롤바 폭(약 15px)만큼의 가로 넘침을 놓친다(실제 브라우저에서는 보인다).
  const browser = await chromium.launch({ channel: 'chrome', headless: !KEEP,
    ignoreDefaultArgs: ['--hide-scrollbars'] });
  const report = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, locale: 'ko-KR' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e.message).slice(0, 200)));

    const shot = async (name) => {
      const f = path.join(OUT, `${vp.k}__${name}.png`);
      await page.screenshot({ path: f, fullPage: true });
      // 가로 스크롤 · 화면 밖으로 나간 요소 찾기
      const diag = await page.evaluate(() => {
        const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const bad = [];
        // 가로 스크롤 컨테이너(탭바·갤러리 띠) 안의 요소는 화면 밖에 있는 게 정상 — 오탐이므로 건너뛴다
        const inScroller = (el) => {
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if (o === 'auto' || o === 'scroll') return true;
          }
          return false;
        };
        document.querySelectorAll('body *').forEach((el) => {
          if (bad.length >= 6) return;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          // 화면 밖에 '완전히' 나가 있는 것은 슬라이드인 패널(translateX(100%))이라 정상.
          // 진짜 넘침은 왼쪽 끝이 화면 안에 있으면서 오른쪽만 삐져나온 경우다.
          if (r.left >= window.innerWidth - 1) return;
          if (r.right > window.innerWidth + 2 && !inScroller(el)) {
            bad.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0] || '-'} right=${Math.round(r.right)}`);
          }
        });
        return { over, bad };
      });
      report.push({ vp: vp.k, name, file: f, over: diag.over, bad: diag.bad, errs: errs.slice() });
      console.log(`  ${vp.k} / ${name}  가로넘침 ${diag.over}px` + (diag.bad.length ? `  밖으로: ${diag.bad.join(', ')}` : '') + (errs.length ? `  콘솔오류 ${errs.length}` : ''));
      errs.length = 0;
    };

    console.log(`[${vp.k}]`);
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1200);
    await shot('01-landing');

    // ── 선생님 ──
    {
      const on = await enter(page, BASE, 'teacher');
      if (on !== 's-teacher') console.log(`  ${vp.k} / 선생님 진입 실패 — 활성 화면 ${on || '(없음)'}`);
      await shot('02-teacher-dash');
      for (const [tab, label] of [['t-class', '03-teacher-class'], ['t-assign', '04-teacher-assign'], ['t-stu', '05-teacher-stu']]) {
        const ok = await page.evaluate((t) => { try { swTab(t); return true; } catch (_) { return false; } }, tab);
        if (!ok) continue;
        await page.waitForTimeout(1500);
        if (tab === 't-class') {
          // 첫 클래스를 열어 진도 캘린더·숙제 패널까지 보이게 (읽기만)
          await page.evaluate(() => { const c = document.querySelector('.cls-card'); if (c) c.click(); }).catch(() => {});
          await page.waitForTimeout(2500);
        }
        await shot(label);
      }
    }

    // ── 학생 ──
    if (stu) {
      const on = await enter(page, BASE, 'student', stu.id);
      if (on !== 's-student') console.log(`  ${vp.k} / 학생 진입 실패 — 활성 화면 ${on || '(없음)'}`);
      await shot('06-student-home');
      for (const [t, label] of [['st-vocab', '07-student-vocab'], ['st-library', '08-student-review']]) {
        const ok = await page.evaluate((x) => { try { swStuTab(x); return true; } catch (_) { return false; } }, t);
        if (ok) { await page.waitForTimeout(1200); await shot(label); }
      }
      // ── 학부모 ──
      const onP = await enter(page, BASE, 'parent', stu.id);
      if (onP !== 's-parent') console.log(`  ${vp.k} / 학부모 진입 실패 — 활성 화면 ${onP || '(없음)'}`);
      else { await shot('09-parent-lessons'); }
    }

    await ctx.close();
  }

  if (!KEEP) await browser.close();

  // ── 요약 ──
  console.log('\n════ 요약 ════');
  const overs = report.filter((r) => r.over > 0);
  const bads = report.filter((r) => r.bad.length);
  const errd = report.filter((r) => r.errs.length);
  console.log(`스크린샷 ${report.length}장 → ${OUT}/`);
  console.log(`가로 스크롤 생긴 화면: ${overs.length}` + (overs.length ? ' → ' + overs.map((r) => `${r.vp}/${r.name}(${r.over}px)`).join(', ') : ''));
  console.log(`화면 밖으로 나간 요소: ${bads.length}` + (bads.length ? '' : ' (없음)'));
  bads.forEach((r) => console.log(`  ${r.vp}/${r.name}: ${r.bad.join(' | ')}`));
  console.log(`콘솔 오류 발생 화면: ${errd.length}`);
  errd.forEach((r) => r.errs.slice(0, 3).forEach((e) => console.log(`  ${r.vp}/${r.name}: ${e}`)));
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log(`상세: ${OUT}/report.json`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
