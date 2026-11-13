// 검사를 돌리기 전에 먼저 읽히는 파일 (node --require).
//
// 하는 일: **브라우저가 만들어지는 순간, 페이지를 열기 전에** 실제 서버를 쓰지도 읽지도 못하게 막는다.
//   · playwright 의 launch/newContext/newPage/launchPersistentContext 를 가로채
//     만들어진 컨텍스트마다 rest/v1·functions/v1 의 POST·PATCH·PUT·DELETE 를 막는 route 를 건다.
//   · 이 route 는 **컨텍스트 단계**에 건다. 검사가 따로 거는 page.route(가짜 서버)가 더 먼저 잡으므로
//     가짜 서버를 끼운 표는 그대로 돌고, 아무도 안 막은 표만 이 장치에 걸린다.
//   · 걸리면 verify_guard 가 기록하고, 엄격 모드(기본)에서는 그 자리에서 멈춘다.
//
// 2026-11-13: 전송량이 한 주기에 14.61GB / 5GB 가 됐다(11/15 부터 프로젝트 제한).
//   그래서 **읽기도** 막는다. 앱이 뜨는 데 필요한 줄은 tests/fixtures/db.json 에서 가짜로 답하고,
//   표에 없는 읽기는 404 로 막고 '막은 읽기' 로 센다.
//   예외 둘: (a) run.js 끝줄의 '줄 수 전후' 확인(노드에서 HEAD+count, 표 4개)
//            (b) PP_ALLOW_LIVE_READ=1 로 돌리는 live 묶음
//   검사가 건 page.route 가 route.continue() 를 불러도 실제로 나가지 않는다 — 아래에서 가로챈다.
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

const FDB = require('./_fakedb');
const isSupa = u => {
  const s = String(u || '');
  return /\.supabase\.co/i.test(s) || s.indexOf('/rest/v1/') >= 0 || s.indexOf('/functions/v1/') >= 0;
};
// 읽기 — 가짜 표에 있으면 그 줄로, 없으면 404 로 막고 센다 (실제로 나가지 않는다)
function answerRead(route) {
  const url = route.request().url();
  let rows = null;
  try { rows = FDB.answer(url); } catch (e) { rows = null; }
  if (rows === null) {
    G.guardRead(url, 'block');
    return route.fulfill({
      status: 404, contentType: 'application/json',
      body: JSON.stringify({ message: '검사 중에는 실제 서버를 읽지 않습니다 (verify_guard)' })
    });
  }
  G.guardRead(url, 'fake');
  return route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'content-range': '0-' + Math.max(0, rows.length - 1) + '/' + rows.length },
    body: JSON.stringify(rows)
  });
}
// 검사가 건 route 핸들러에 넘기는 route 를 감싼다 — continue() 가 실제 서버로 나가지 않게.
// (playwright 의 route.continue() 는 다른 핸들러를 건너뛰고 바로 망으로 나간다)
function wrapRoute(route) {
  return new Proxy(route, {
    get(t, k) {
      if (k === 'continue') {
        return (...a) => {
          const u = t.request().url();
          if (!isSupa(u)) return t.continue(...a);
          const m = t.request().method();
          if (m === 'GET' || m === 'HEAD') {
            if (G.guardAllowLive()) { G.guardRead(u, 'live'); return t.continue(...a); }
            return answerRead(t);
          }
          G.guardCheck(m, u);
          return t.fulfill({
            status: 403, contentType: 'application/json',
            body: JSON.stringify({ message: '검사 중에는 실제 서버에 쓸 수 없습니다 (verify_guard)' })
          });
        };
      }
      const v = Reflect.get(t, k, t);
      return typeof v === 'function' ? v.bind(t) : v;
    }
  });
}
function wrapRouteFn(obj) {
  if (!obj || obj.__ppRouteWrapped || typeof obj.route !== 'function') return obj;
  obj.__ppRouteWrapped = true;
  const orig = obj.route.bind(obj);
  obj.route = (url, handler, opts) =>
    orig(url, (route, req) => handler(wrapRoute(route), req), opts);
  return obj;
}

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
    if (m === 'GET' || m === 'HEAD') {
      if (G.guardAllowLive()) { G.guardRead(req.url(), 'live'); return route.continue(); }
      return answerRead(route);
    }
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

// 노드에서 바로 부르는 fetch 도 막는다 — 검사가 '실학생 id' 를 실제 서버에서 집어 오던 길.
// (브라우저 쪽은 route 로 막는다. run.js 가 재는 '줄 수 전후' 확인은 run.js 안에서 돌아 이 장치를 거치지 않는다.)
const _origFetch = global.fetch;
if (typeof _origFetch === 'function') {
  const reply = (body, status, extra) => new Response(JSON.stringify(body), {
    status: status, headers: Object.assign({ 'content-type': 'application/json' }, extra || {})
  });
  global.fetch = async (u, o) => {
    const url = (u && u.url) || String(u || '');
    if (!isSupa(url)) return _origFetch(u, o);
    const m = String((o && o.method) || 'GET').toUpperCase();
    if (m === 'GET' || m === 'HEAD') {
      if (G.guardAllowLive()) { G.guardRead(url, 'live'); return _origFetch(u, o); }
      let rows = null;
      try { rows = FDB.answer(url); } catch (e) { rows = null; }
      if (rows === null) {
        G.guardRead(url, 'block');
        return reply({ message: '검사 중에는 실제 서버를 읽지 않습니다 (verify_guard)' }, 404);
      }
      G.guardRead(url, 'fake');
      return reply(rows, 200, { 'content-range': '0-' + Math.max(0, rows.length - 1) + '/' + rows.length });
    }
    G.guardCheck(m, url);
    return reply({ message: '검사 중에는 실제 서버에 쓸 수 없습니다 (verify_guard)' }, 403);
  };
}

function patchContext(ctx) {
  if (!ctx || ctx.__ppArmed) return ctx;
  ctx.__ppArmed = true;
  armContext(ctx);                 // 아무도 안 막은 요청을 잡는 바닥
  wrapRouteFn(ctx);                // 검사가 거는 ctx.route 의 continue() 를 가로챈다
  if (typeof ctx.newPage === 'function') {
    const np = ctx.newPage.bind(ctx);
    ctx.newPage = async (...a) => wrapRouteFn(await np(...a));
  }
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
    b.newPage = async (...a) => { const p = await np(...a); try { patchContext(p.context()); } catch (e) { } return wrapRouteFn(p); };
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
      fs.writeFileSync(mark, JSON.stringify({ blocked: r.blocked, calls: r.calls, fake: r.fake, pw: patched,
        readsBlocked: r.readsBlocked, readsFake: r.readsFake, readsLive: r.readsLive }), 'utf8');
    } catch (e) { }
  }
  if (r.blocked.length) console.error('막음 장치가 막은 실제 서버 쓰기: ' + r.blocked.length + '건 — ' + r.blocked.slice(0, 8).join(', '));
});
