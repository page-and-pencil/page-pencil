// 검사를 돌리기 전에 먼저 읽히는 파일 (node --require).
//
// 하는 일 하나: **브라우저가 만들어지는 순간, 페이지를 열기 전에** 실제 서버 쓰기를 막는다.
//   · playwright 의 launch/newContext/newPage/launchPersistentContext 를 가로채
//     만들어진 컨텍스트마다 rest/v1·functions/v1 의 POST·PATCH·PUT·DELETE 를 막는 route 를 건다.
//   · 이 route 는 **컨텍스트 단계**에 건다. 검사가 따로 거는 page.route(가짜 서버)가 더 먼저 잡으므로
//     가짜 서버를 끼운 표는 그대로 돌고, 아무도 안 막은 표만 이 장치에 걸린다.
//   · 걸리면 verify_guard 가 기록하고, 엄격 모드(기본)에서는 그 자리에서 멈춘다.
//
// 2026-11-12 사고: verify_iso.js 가 rest/v1/worksheets 만 가짜로 끼우고 item_bank 는 안 끼웠다.
//   동형 문항 자동 저장(_isoAutoSave → _isoBankSync → ibPutItem → supaUpsert('item_bank'))이
//   실제 주소로 나가 문항 7줄이 두 번 들어갔다. 이 파일은 그 길을 통째로 막는다.
const path = require('path');
const fs = require('fs');
const G = require('./verify_guard');
const ROOT = path.resolve(__dirname, '..');

global.__PP_GUARD_ARMED = true;
global.__PP_GUARD = G;
// PP_GUARD_SOFT=1 — 멈추지 않고 '무엇을 쓰려 했는지' 끝까지 적는다(새는 길을 찾을 때만).
// 요청은 어느 쪽이든 실제로 나가지 않는다.
if (process.env.PP_GUARD_SOFT === '1') G.guardStrict(false);

const isSupa = u => {
  const s = String(u || '');
  return s.indexOf('/rest/v1/') >= 0 || s.indexOf('/functions/v1/') >= 0;
};

// 앱이 뜰 때 하는 '살아 있나' 확인 두 가지 — 돈도 안 들고 아무것도 안 바뀐다.
// 여기서 **대신 답해** 준다(네트워크로 나가지 않는다). 그래야 검사마다 403 콘솔 오류가 쌓이지 않는다.
//   · tts-proxy  {"probe":true}   (js/db.js ppProbeTtsProxy)
//   · claude-proxy {}             (js/db.js ppProbeAiProxy — 일부러 model 을 빼고 보낸다)
function probeAnswer(url, body) {
  const u = String(url || ''), b = String(body || '').trim();
  if (u.indexOf('/functions/v1/tts-proxy') >= 0 && /"probe"\s*:\s*true/.test(b))
    return { ok: false, server: false };
  if (u.indexOf('/functions/v1/claude-proxy') >= 0 && (b === '' || b === '{}'))
    return { error: { message: 'API key required (검사 중에는 부르지 않습니다)' } };
  return null;
}

function armContext(ctx) {
  // 컨텍스트 단계 — 검사가 거는 page.route 가 우선한다(가짜 서버는 그대로 돈다)
  return ctx.route(u => isSupa(u), route => {
    const req = route.request();
    const m = req.method();
    if (m === 'GET' || m === 'HEAD') return route.continue();
    const probe = probeAnswer(req.url(), req.postData());
    if (probe) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(probe) });
    G.guardCheck(m, req.url());          // 엄격 모드면 여기서 멈춘다
    // 끊지 않고 403 으로 답한다 — 요청은 서버에 닿지 않고, 앱은 '저장 실패'로만 본다.
    // (route.abort() 로 끊으면 ERR_FAILED 가 콘솔에 쌓여 '콘솔 오류 0' 검사가 헛되이 깨진다)
    return route.fulfill({
      status: 403, contentType: 'application/json',
      body: JSON.stringify({ message: '검사 중에는 실제 서버에 쓸 수 없습니다 (verify_guard)' })
    });
  }).catch(() => { });
}

function patchContext(ctx) {
  if (!ctx || ctx.__ppArmed) return ctx;
  ctx.__ppArmed = true;
  armContext(ctx);
  return ctx;
}

function patchBrowser(b) {
  if (!b || b.__ppPatched) return b;
  b.__ppPatched = true;
  if (typeof b.newContext === 'function') {
    const nc = b.newContext.bind(b);
    b.newContext = async (...a) => patchContext(await nc(...a));
  }
  if (typeof b.newPage === 'function') {
    const np = b.newPage.bind(b);
    b.newPage = async (...a) => { const p = await np(...a); try { patchContext(p.context()); } catch (e) { } return p; };
  }
  return b;
}

let patched = false;
try {
  const pw = require(path.join(ROOT, 'node_modules', 'playwright'));
  ['chromium', 'firefox', 'webkit'].forEach(name => {
    const t = pw[name];
    if (!t) return;
    if (typeof t.launch === 'function') {
      const launch = t.launch.bind(t);
      t.launch = async (...a) => patchBrowser(await launch(...a));
    }
    if (typeof t.launchPersistentContext === 'function') {
      const lpc = t.launchPersistentContext.bind(t);
      t.launchPersistentContext = async (...a) => patchContext(await lpc(...a));
    }
    if (typeof t.connectOverCDP === 'function') {
      const cdp = t.connectOverCDP.bind(t);
      t.connectOverCDP = async (...a) => patchBrowser(await cdp(...a));
    }
  });
  patched = true;
} catch (e) {
  // playwright 가 없는 검사(노드 안에서만 도는 것)도 있다 — 그때는 fetch 쪽 장치만으로 충분하다
}
global.__PP_GUARD_PW = patched;

// 끝날 때 기록을 남긴다 — run.js 가 이 표식으로 '막음 장치를 거쳤다'를 확인한다
process.on('exit', () => {
  const r = G.guardReport();
  const mark = process.env.PP_GUARD_MARK;
  if (mark) {
    try {
      fs.writeFileSync(mark, JSON.stringify({ blocked: r.blocked, calls: r.calls, fake: r.fake, pw: patched }), 'utf8');
    } catch (e) { }
  }
  if (r.blocked.length) console.error('막음 장치가 막은 실제 서버 쓰기: ' + r.blocked.length + '건 — ' + r.blocked.slice(0, 8).join(', '));
});
