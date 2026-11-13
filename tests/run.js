// 검사를 모아 돌리는 **하나뿐인 문**.
//
//   node tests/run.js                 — core 만 (배포 때마다 돌리는 것)
//   node tests/run.js live            — 실제 서버를 읽는 검사 (한 번에 하나, 500 이면 한 번 더)
//   node tests/run.js legacy          — 고치면 쓸 수 있는 옛 검사
//   node tests/run.js all             — core + live + legacy
//   node tests/run.js iso item        — 이름에 그 글자가 든 것만 (묶음을 가리지 않는다)
//   node tests/run.js --list          — 묶음별 목록만
//   node tests/run.js --jobs 4        — 한 번에 몇 개씩 (기본 3, live 는 늘 1)
//   node tests/run.js --timeout 300   — 한 검사의 제한 시간(초, 기본 240)
//
// 묶음은 tests/_groups.js 에 적는다 (README 의 표도 거기서 나온다 — node tests/run.js --readme).
//
// 규칙 (2026-11-12 사고 뒤):
//   · 모든 검사는 막음 장치(_guard_preload.js)를 거쳐서만 돈다.
//   · 첫 줄에 require('./_guard_assert') 가 없는 검사가 하나라도 있으면 **아무것도 돌리지 않는다**.
//   · 돌고 난 뒤 막음 장치의 기록(표식 파일)이 없으면 그 검사는 실패로 친다.
//   · tests/live/ 안의 것은 실제 서버에 **쓰는** 도구다 — 여기서 절대 돌리지 않는다.
//   · tests/retired/ 는 쓰지 않는 검사다 — run.js 가 보지 않는다.
//
// 2026-11-13 (전송량 14.61GB / 5GB · 11/15 부터 프로젝트 제한):
//   · 검사는 실제 서버를 **읽지도 않는다**. 앱이 뜨는 데 필요한 줄은 tests/fixtures/db.json 에서 가짜로 답한다.
//   · 실제로 나가는 요청은 이 파일이 재는 '줄 수 전후' 확인뿐이다(표 4개 × 앞뒤 = 8건).
//   · live 묶음만 PP_ALLOW_LIVE_READ=1 로 실제 서버를 읽는다 — 원장이 시킬 때만.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const RC = require('./rowcount');
const G = require('./_groups');

const DIR = __dirname;
const ROOT = path.resolve(DIR, '..');
const PRELOAD = path.join(DIR, '_guard_preload.js');
const OUT = path.join(os.tmpdir(), 'pp-tests-' + process.pid);
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const has = n => args.indexOf('--' + n) >= 0;
const TMO = Math.max(10, +flag('timeout', 240)) * 1000;
const words = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && /^--(jobs|timeout)$/.test(args[i - 1])));
const picked = words.filter(w => G.GROUPS.indexOf(w) >= 0 || w === 'all');
const pats = words.filter(w => picked.indexOf(w) < 0);

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

// ── 묶음 ──
const unknown = all.filter(f => !G.TESTS[f]);
const groupOf = f => (G.TESTS[f] ? G.TESTS[f].g : 'legacy');
if (has('readme')) { console.log(G.markdown(all)); process.exit(0); }

let want;                                  // 돌릴 묶음
if (pats.length) want = null;              // 이름으로 고르면 묶음을 가리지 않는다
else if (picked.indexOf('all') >= 0) want = ['core', 'live', 'legacy'];
else want = picked.length ? picked : ['core'];
if (want && want.indexOf('retired') >= 0) {
  console.error('retired 는 돌리지 않습니다 — tests/retired/ 로 옮긴 검사입니다 (tests/README.md).');
  process.exit(2);
}
const list = (pats.length
  ? all.filter(f => pats.some(p => f.indexOf(p) >= 0))
  : all.filter(f => want.indexOf(groupOf(f)) >= 0));

if (has('list')) {
  G.GROUPS.forEach(g => {
    const fs2 = (g === 'retired') ? G.retired() : all.filter(x => groupOf(x) === g);
    console.log('\n── ' + g + ' (' + fs2.length + ') ──');
    fs2.forEach(f => console.log('   ' + f.replace(/\.js$/, '').padEnd(24) + ' ' + ((G.TESTS[f] || {}).w || '')));
  });
  if (unknown.length) console.log('\n표에 없는 검사: ' + unknown.join(', '));
  process.exit(0);
}
if (!list.length) { console.error('고른 검사가 없습니다'); process.exit(2); }

const onlyLive = list.every(f => groupOf(f) === 'live');
const hasLive = list.some(f => groupOf(f) === 'live');
// live 묶음은 실제 서버를 읽는다 — 원장이 시켰을 때, 그 표시를 달고만 돈다
if (hasLive && process.env.PP_ALLOW_LIVE_READ !== '1') {
  if (onlyLive) {
    console.error('\nlive 묶음은 실제 서버를 읽습니다 (전송량이 듭니다).');
    console.error('  PP_ALLOW_LIVE_READ=1 node tests/run.js live --jobs 1');
    console.error('  원장이 시켰을 때만 돌립니다 — tests/README.md 맨 위.');
    process.exit(2);
  }
  console.log('※ live 검사 ' + list.filter(f => groupOf(f) === 'live').length + '개는 건너뜁니다 (PP_ALLOW_LIVE_READ=1 이 아닙니다)');
  for (let i = list.length - 1; i >= 0; i--) if (groupOf(list[i]) === 'live') list.splice(i, 1);
}
const JOBS = onlyLive ? 1 : Math.max(1, +flag('jobs', 3));

const RESULT = [];
function runOne(f, again) {
  return new Promise(res => {
    const mark = path.join(OUT, f + (again ? '.2' : '') + '.mark');
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
    ch.on('close', async code => {
      clearTimeout(tm);
      let m = null;
      try { m = JSON.parse(fs.readFileSync(mark, 'utf8')); } catch (e) { }
      const secs = Math.round((Date.now() - t0) / 100) / 10;
      const r = {
        f, code, secs, killed,
        group: groupOf(f),
        guarded: !!m,
        blocked: m ? m.blocked.length : 0,
        blockedWhat: m ? m.blocked.slice(0, 4) : [],
        calls: m && m.calls ? m.calls.length : 0,
        readsFake: m && m.readsFake ? m.readsFake : 0,
        readsBlocked: m && m.readsBlocked ? m.readsBlocked.length : 0,
        readsLive: m && m.readsLive ? m.readsLive : 0,
        tail: buf.split(/\r?\n/).filter(Boolean).slice(-3).join(' | ').slice(0, 220),
        pass: null,
      };
      const mm = buf.match(/통과\s*(\d+)\s*\/\s*실패\s*(\d+)/);
      if (mm) r.pass = { ok: +mm[1], no: +mm[2] };
      r.ok = !killed && code === 0 && r.guarded && r.blocked === 0 && (!r.pass || r.pass.no === 0);
      // 실제 서버를 읽는 검사는 500 이 튀면 한 번만 다시 해 본다
      if (!r.ok && r.group === 'live' && !again && !r.blocked && r.guarded) {
        console.log('↻ ' + f.padEnd(26) + ' 다시 한 번 (실제 서버가 흔들릴 수 있습니다)');
        return res(await runOne(f, true));
      }
      if (again) r.retried = true;
      RESULT.push(r);
      const tag = r.ok ? '✅' : (!r.guarded ? '🛑' : (r.blocked ? '🛑' : (killed ? '⏱' : '❌')));
      console.log(tag + ' ' + f.padEnd(26) + ' ' + String(r.secs + 's').padStart(7) +
        (r.pass ? ('  통과 ' + r.pass.ok + '/실패 ' + r.pass.no) : '') +
        (r.retried ? '  (다시 한 번)' : '') +
        (r.blocked ? ('  ← 실제 서버 쓰기 ' + r.blocked + '건 막음 (' + r.blockedWhat.join(', ') + ')') : '') +
        (r.calls ? ('  · 바깥 호출 ' + r.calls + '건 막음') : '') +
        (r.readsBlocked ? ('  · 막은 읽기 ' + r.readsBlocked + '건') : '') +
        (r.readsLive ? ('  · 실제 읽기 ' + r.readsLive + '건') : '') +
        (!r.guarded ? '  ← 막음 장치 표식 없음' : '') +
        (killed ? '  ← 시간 초과' : ''));
      res(r);
    });
  });
}

(async () => {
  const label = pats.length ? ('이름 "' + pats.join(' ') + '"') : want.join('+');
  console.log('검사 ' + list.length + '개 (' + label + ') · 한 번에 ' + JOBS + '개 · 제한 ' + (TMO / 1000) + '초');
  console.log('막음 장치: tests/_guard_preload.js (모든 검사가 거친다)');
  if (unknown.length) console.log('※ 묶음 표에 없는 검사 ' + unknown.length + '개 — tests/_groups.js 에 한 줄 적어 주세요: ' + unknown.join(', '));
  const t0 = Date.now();
  const before = await RC.snapshot();
  console.log('\n돌리기 전 줄 수 — ' + RC.line(before) + '\n');

  const q = list.slice();
  const workers = Array.from({ length: Math.min(JOBS, q.length) }, async () => {
    while (q.length) await runOne(q.shift());
  });
  await Promise.all(workers);

  const after = await RC.snapshot();
  const d = RC.diff(before, after);
  const mins = Math.round((Date.now() - t0) / 1000);
  console.log('\n돌린 뒤 줄 수   — ' + RC.line(after));
  console.log(d.length ? ('🛑 줄 수가 바뀌었습니다: ' + d.join(', ')) : '✅ 줄 수 그대로 — 실제 서버에 아무것도 넣지 않았습니다');

  const bad = RESULT.filter(r => !r.ok);
  const leak = RESULT.filter(r => r.blocked > 0);
  const nog = RESULT.filter(r => !r.guarded);
  console.log('\n── 결과 ──');
  console.log('  통과 ' + (RESULT.length - bad.length) + ' / ' + RESULT.length + ' · ' + mins + '초');
  if (leak.length) {
    console.log('  🛑 실제 서버에 쓰려 한 검사 ' + leak.length + '개:');
    leak.forEach(r => console.log('     · ' + r.f + ' — ' + r.blockedWhat.join(', ')));
  }
  if (nog.length) console.log('  🛑 막음 장치를 못 거친 검사: ' + nog.map(r => r.f).join(', '));
  const other = bad.filter(r => !r.blocked && r.guarded);
  if (other.length) {
    console.log('  ❌ 그 밖에 실패한 검사 ' + other.length + '개:');
    other.forEach(r => console.log('     · ' + r.f + (r.killed ? ' (시간 초과)' : ' (나감 ' + r.code + ')') + ' — ' + r.tail));
  }
  // 오래 걸린 검사 셋 (core 가 5분을 넘으면 알린다)
  const slow = RESULT.slice().sort((a, b) => b.secs - a.secs).slice(0, 3);
  if (mins > 300) {
    console.log('  ⏱ 5분을 넘었습니다 — 오래 걸린 검사 셋: ' +
      slow.map(r => r.f.replace(/\.js$/, '') + ' ' + r.secs + 's').join(' · '));
  }
  // 끝줄 한 줄 — 실제로 나간 요청이 몇 건인지 먼저 적는다
  const sum = k => RESULT.reduce((a, r) => a + (r[k] || 0), 0);
  const rowReqs = RC.TABLES.length * 2;                 // 줄 수 확인(앞뒤) — 이것만 실제로 나간다
  const liveReads = sum('readsLive');
  console.log('\n' + label + ' ' + (RESULT.length - bad.length) + '/' + RESULT.length + ' 통과 · ' +
    '실제 서버 요청 ' + (rowReqs + liveReads) + '건(읽기 ' + (rowReqs + liveReads) + ' · 쓰기 0)' +
    (liveReads ? (' — 줄 수 확인 ' + rowReqs + ' · live 읽기 ' + liveReads) : ' — 줄 수 확인뿐') + ' · ' +
    '가짜로 답한 읽기 ' + sum('readsFake') + '건 · 막은 읽기 ' + sum('readsBlocked') + '건 · ' +
    '막은 쓰기 ' + sum('blocked') + '건 · ' +
    (d.length ? ('줄 수 바뀜(' + d.join(', ') + ')') : ('줄 수 전후 같음(' + RC.line(after) + ')')) +
    ' · ' + mins + '초');
  process.exit(leak.length || nog.length || d.length || bad.length ? 2 : 0);
})();
