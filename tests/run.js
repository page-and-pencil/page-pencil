// 검사를 모아 돌리는 **하나뿐인 문**.
//
//   node tests/run.js                 — 전부
//   node tests/run.js iso item        — 이름에 그 글자가 든 것만
//   node tests/run.js --list          — 목록만
//   node tests/run.js --jobs 4        — 한 번에 몇 개씩 (기본 3)
//   node tests/run.js --timeout 300   — 한 검사의 제한 시간(초, 기본 240)
//
// 규칙 (2026-11-12 사고 뒤):
//   · 모든 검사는 막음 장치(_guard_preload.js)를 거쳐서만 돈다.
//   · 첫 줄에 require('./_guard_assert') 가 없는 검사가 하나라도 있으면 **아무것도 돌리지 않는다**.
//   · 돌고 난 뒤 막음 장치의 기록(표식 파일)이 없으면 그 검사는 실패로 친다.
//   · tests/live/ 안의 것은 실제 서버에 쓰는 도구다 — 여기서 절대 돌리지 않는다.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const RC = require('./rowcount');

const DIR = __dirname;
const ROOT = path.resolve(DIR, '..');
const PRELOAD = path.join(DIR, '_guard_preload.js');
const OUT = path.join(os.tmpdir(), 'pp-tests-' + process.pid);
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const has = n => args.indexOf('--' + n) >= 0;
const JOBS = Math.max(1, +flag('jobs', 3));
const TMO = Math.max(10, +flag('timeout', 240)) * 1000;
const pats = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && /^--(jobs|timeout)$/.test(args[i - 1])));

// verify_guard.js 는 장치 그 자체라 검사 목록이 아니다
const all = fs.readdirSync(DIR).filter(f => /^verify_.*\.js$/.test(f) && f !== 'verify_guard.js').sort();

// ── 돌리기 전 점검: 막음 장치를 거치지 않는 검사가 하나라도 있으면 멈춘다 ──
const NEEDLE = "require('./_guard_assert')";
const naked = all.filter(f => {
  const head = fs.readFileSync(path.join(DIR, f), 'utf8').slice(0, 600);
  return head.indexOf(NEEDLE) < 0;
});
if (naked.length) {
  console.error('\n🛑 막음 장치를 거치지 않는 검사가 ' + naked.length + '개 있습니다 — 아무것도 돌리지 않습니다.');
  naked.forEach(f => console.error('   · tests/' + f));
  console.error("\n   각 파일 첫 줄에 " + NEEDLE + "; 를 넣어 주세요.");
  process.exit(2);
}
if (!fs.existsSync(PRELOAD)) { console.error('🛑 막음 장치 파일이 없습니다: tests/_guard_preload.js'); process.exit(2); }

const list = pats.length ? all.filter(f => pats.some(p => f.indexOf(p) >= 0)) : all;
if (has('list')) { list.forEach(f => console.log(f)); process.exit(0); }
if (!list.length) { console.error('고른 검사가 없습니다'); process.exit(2); }

const RESULT = [];
function runOne(f) {
  return new Promise(res => {
    const mark = path.join(OUT, f + '.mark');
    const t0 = Date.now();
    const ch = spawn(process.execPath, ['--require', PRELOAD, path.join(DIR, f)], {
      cwd: ROOT,
      env: { ...process.env, PP_GUARD_MARK: mark, PP_TEST_OUT: OUT },
      windowsHide: true,
    });
    let buf = '', killed = false;
    const tm = setTimeout(() => { killed = true; try { ch.kill(); } catch (e) { } }, TMO);
    ch.stdout.on('data', d => { buf += d; });
    ch.stderr.on('data', d => { buf += d; });
    ch.on('close', code => {
      clearTimeout(tm);
      let m = null;
      try { m = JSON.parse(fs.readFileSync(mark, 'utf8')); } catch (e) { }
      const secs = Math.round((Date.now() - t0) / 100) / 10;
      const r = {
        f, code, secs, killed,
        guarded: !!m,
        blocked: m ? m.blocked.length : 0,
        blockedWhat: m ? m.blocked.slice(0, 4) : [],
        calls: m && m.calls ? m.calls.length : 0,
        tail: buf.split(/\r?\n/).filter(Boolean).slice(-3).join(' | ').slice(0, 220),
        pass: null,
      };
      // 통과/실패 줄이 있으면 읽는다
      const mm = buf.match(/통과\s*(\d+)\s*\/\s*실패\s*(\d+)/);
      if (mm) r.pass = { ok: +mm[1], no: +mm[2] };
      r.ok = !killed && code === 0 && r.guarded && r.blocked === 0 && (!r.pass || r.pass.no === 0);
      RESULT.push(r);
      const tag = r.ok ? '✅' : (!r.guarded ? '🛑' : (r.blocked ? '🛑' : (killed ? '⏱' : '❌')));
      console.log(tag + ' ' + f.padEnd(26) + ' ' + String(r.secs + 's').padStart(7) +
        (r.pass ? ('  통과 ' + r.pass.ok + '/실패 ' + r.pass.no) : '') +
        (r.blocked ? ('  ← 실제 서버 쓰기 ' + r.blocked + '건 막음 (' + r.blockedWhat.join(', ') + ')') : '') +
        (r.calls ? ('  · 바깥 호출 ' + r.calls + '건 막음') : '') +
        (!r.guarded ? '  ← 막음 장치 표식 없음' : '') +
        (killed ? '  ← 시간 초과' : ''));
      res(r);
    });
  });
}

(async () => {
  console.log('검사 ' + list.length + '개 · 한 번에 ' + JOBS + '개 · 제한 ' + (TMO / 1000) + '초');
  console.log('막음 장치: tests/_guard_preload.js (모든 검사가 거친다)');
  const before = await RC.snapshot();
  console.log('\n돌리기 전 줄 수 — ' + RC.line(before) + '\n');

  const q = list.slice();
  const workers = Array.from({ length: Math.min(JOBS, q.length) }, async () => {
    while (q.length) await runOne(q.shift());
  });
  await Promise.all(workers);

  const after = await RC.snapshot();
  const d = RC.diff(before, after);
  console.log('\n돌린 뒤 줄 수   — ' + RC.line(after));
  console.log(d.length ? ('🛑 줄 수가 바뀌었습니다: ' + d.join(', ')) : '✅ 줄 수 그대로 — 실제 서버에 아무것도 넣지 않았습니다');

  const bad = RESULT.filter(r => !r.ok);
  const leak = RESULT.filter(r => r.blocked > 0);
  const nog = RESULT.filter(r => !r.guarded);
  console.log('\n── 결과 ──');
  console.log('  통과 ' + (RESULT.length - bad.length) + ' / ' + RESULT.length);
  if (leak.length) {
    console.log('  🛑 실제 서버에 쓰려 한 검사 ' + leak.length + '개:');
    leak.forEach(r => console.log('     · ' + r.f + ' — ' + r.blockedWhat.join(', ')));
  }
  if (nog.length) console.log('  🛑 막음 장치를 못 거친 검사: ' + nog.map(r => r.f).join(', '));
  const other = bad.filter(r => !r.blocked && r.guarded);
  if (other.length) {
    console.log('  ❌ 그 밖에 실패한 검사 ' + other.length + '개 (화면이 바뀌어 옛 검사가 안 맞는 경우가 많다):');
    other.forEach(r => console.log('     · ' + r.f + (r.killed ? ' (시간 초과)' : ' (나감 ' + r.code + ')') + ' — ' + r.tail));
  }
  process.exit(leak.length || nog.length || d.length ? 2 : 0);
})();
