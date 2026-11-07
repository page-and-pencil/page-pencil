// Page & Pencil — 학생·학부모 로그인 (2026-11-08, AUTH_PLAN 2-A)
//
// 왜: 지금은 이름+PIN 대조를 브라우저가 한다. 그러려면 students 를 공개 anon 키로
//     읽을 수 있어야 하고, 그래서 PIN·학부모 연락처가 전부 공개돼 있다.
//     이 함수가 대조를 서버에서 하고 Auth 세션만 돌려주면 students 를 닫을 수 있다.
//
// 선생님은 이 함수를 쓰지 않는다 (Supabase Auth 이메일 계정 1개 — auth_teacher_setup.md).
//
// ── 필요한 시크릿 ───────────────────────────────────────────────────────
//   SUPABASE_URL               (기본 제공)
//   SUPABASE_ANON_KEY          (기본 제공) — 토큰 발급 호출에 씀
//   SUPABASE_SERVICE_ROLE_KEY  (기본 제공) — students 조회·Auth 사용자 생성에 씀
//   LOGIN_SECRET               (필수, Aside 가 무작위로 생성해 등록)
//                              학생별 비밀번호를 서버에서 유도하는 데만 쓴다.
//                              **이 값이 바뀌면 이미 만든 Auth 사용자로 로그인할 수 없다**
//                              (그때는 auth_teacher_setup.md 의 '비밀번호 다시 맞추기' 참고)
//   LOGIN_ALLOWED_ORIGINS      (선택) 쉼표 구분. 기본값은 아래 DEFAULT_ORIGINS
//   LOGIN_ALLOW_NO_ORIGIN      (선택) '1' 이면 Origin 없는 요청도 통과(로컬 file:// 시험용)
//   LOGIN_STU_DOMAIN / LOGIN_PAR_DOMAIN (선택) Auth 계정 이메일 도메인.
//                              기본 stu.jikgyeol.local / par.jikgyeol.local
//                              Supabase 가 이 도메인을 거부하면 이 두 값을 바꾼다.
//   LOGIN_MAX_FAIL_SID / LOGIN_MAX_FAIL_IP (선택) 기본 10 / 20
//
// ── 입력 (POST JSON) ────────────────────────────────────────────────────
//   { role:'student'|'parent', name?, pin? }   이름+PIN
//   { role:'student'|'parent', qr:'<토큰>' }    QR 토큰
//   { probe:true }                              상태만 ({ok, ready})
// ── 출력 ────────────────────────────────────────────────────────────────
//   { access_token, refresh_token, expires_in, sid, name }
//
// PIN 값은 로그·응답·오류 메시지 어디에도 넣지 않는다.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DEFAULT_ORIGINS = [
  "https://page-and-pencil.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
];

const env = (k: string) => Deno.env.get(k) || "";
const list = (k: string, dflt: string[]) => {
  const v = env(k).split(",").map((s) => s.trim()).filter(Boolean);
  return v.length ? v : dflt;
};
const num = (k: string, dflt: number) => {
  const n = parseInt(env(k), 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const bad = (status: number, message: string, origin = "*") =>
  new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });

// ── 시도 횟수 (함수 인스턴스 메모리) ──
// 인스턴스가 여러 개면 각자 세므로 상한이 그만큼 느슨하다. 완벽한 차단이 아니라
// 'PIN 네 자리를 기계로 다 넣어 보는 것'을 막는 장치다.
type Fail = { hour: number; n: number; until: number };
const failBySid = new Map<string, Fail>();
const failByIp = new Map<string, Fail>();
function hitFail(map: Map<string, Fail>, key: string, max: number, lockMs: number) {
  const now = Date.now();
  const hour = Math.floor(now / 3600000);
  const f = map.get(key) || { hour, n: 0, until: 0 };
  if (f.hour !== hour) { f.hour = hour; f.n = 0; }
  f.n++;
  if (f.n > max) f.until = now + lockMs;
  map.set(key, f);
  if (map.size > 5000) map.clear();
}
function lockedFor(map: Map<string, Fail>, key: string) {
  const f = map.get(key);
  if (!f || !f.until) return 0;
  const left = f.until - Date.now();
  if (left <= 0) { f.until = 0; f.n = 0; return 0; }
  return left;
}
function clearFail(key: string, ip: string) {
  failBySid.delete(key);
  const f = failByIp.get(ip);
  if (f) { f.n = 0; f.until = 0; }
}

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 길이가 같은 값끼리 상수 시간 비교 (PIN 대조)
function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

serve(async (req) => {
  // file:// 로 열면 Origin 이 문자열 "null" 로 온다 — 헤더가 없는 것과 같이 본다
  const originRaw = req.headers.get("origin") || "";
  const origin = originRaw === "null" ? "" : originRaw;
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return bad(405, "POST only", origin);

  const allowed = list("LOGIN_ALLOWED_ORIGINS", DEFAULT_ORIGINS);
  if (!allowed.includes("*")) {
    if (origin) {
      if (!allowed.includes(origin)) return bad(403, "출처가 허용되지 않았습니다", origin);
    } else if (env("LOGIN_ALLOW_NO_ORIGIN") !== "1") {
      return bad(403, "출처를 확인할 수 없습니다", origin);
    }
  }

  const URL_ = env("SUPABASE_URL");
  const ANON = env("SUPABASE_ANON_KEY");
  const SRV = env("SUPABASE_SERVICE_ROLE_KEY");
  const SECRET = env("LOGIN_SECRET");

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 4096) return bad(413, "요청이 너무 큽니다", origin);
    body = JSON.parse(raw || "{}");
  } catch {
    return bad(400, "JSON 형식 오류", origin);
  }

  if (body.probe === true) {
    return new Response(JSON.stringify({ ok: true, ready: !!(URL_ && ANON && SRV && SECRET) }), {
      headers: { ...cors(origin), "Content-Type": "application/json" },
    });
  }
  if (!URL_ || !ANON || !SRV) return bad(500, "서버 설정이 비어 있습니다", origin);
  if (!SECRET) return bad(500, "LOGIN_SECRET 이 없습니다", origin);

  const role = body.role === "parent" ? "parent" : "student";
  const name = String(body.name || "").trim();
  const pin = String(body.pin || "").trim();
  const qr = String(body.qr || "").trim();
  if (!qr && !pin) return bad(400, "입력이 비어 있습니다", origin);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const ipLock = lockedFor(failByIp, ip);
  if (ipLock > 0) return bad(429, `잠시 뒤에 다시 시도해 주세요 (${Math.ceil(ipLock / 60000)}분)`, origin);

  const srvHeaders = { apikey: SRV, Authorization: "Bearer " + SRV, "Content-Type": "application/json" };

  // ── 1. students 에서 대조 (service_role) ──
  // 이름을 받았으면 **이름으로** 찾아 PIN 을 맞춰 본다 — 그래야 실패했을 때 '누구를 노렸는지'(sid)를
  // 알 수 있어 그 학생만 잠글 수 있다. 이름이 없으면(학생 키패드) PIN 으로 찾고, 실패는 IP 로만 센다.
  const norm = (v: unknown) => String(v || "").replace(/\s+/g, "").toLowerCase();
  let rows: Array<{ id: string; data: Record<string, unknown> }> = [];
  try {
    const q = qr
      ? `${URL_}/rest/v1/students?select=id,data&data->>qrToken=eq.${encodeURIComponent(qr)}`
      : (name
        ? `${URL_}/rest/v1/students?select=id,data&data->>name=eq.${encodeURIComponent(name)}`
        : `${URL_}/rest/v1/students?select=id,data&data->>pin=eq.${encodeURIComponent(pin)}`);
    const r = await fetch(q, { headers: srvHeaders });
    if (!r.ok) return bad(502, "학생 조회 실패 " + r.status, origin);
    rows = await r.json();
  } catch (e) {
    return bad(502, String((e as Error).message || e), origin);
  }

  let alive = (rows || []).filter((x) => {
    const d = (x && x.data) || {};
    return !d._deleted && !d.inactive;
  });
  // 공백·대소문자만 다른 이름도 같게 본다 (PostgREST 는 정확히 일치만 찾으므로 한 번 더)
  if (!qr && name && !alive.length) {
    try {
      const r2 = await fetch(`${URL_}/rest/v1/students?select=id,data&limit=2000`, { headers: srvHeaders });
      if (r2.ok) {
        const all = await r2.json();
        alive = (all || []).filter((x: { data: Record<string, unknown> }) => {
          const d = x.data || {};
          return !d._deleted && !d.inactive && norm(d.name) === norm(name);
        });
      }
    } catch { /* 못 찾으면 아래에서 실패로 처리된다 */ }
  }
  // PIN 은 상수 시간으로 비교한다
  const hit = qr ? alive : alive.filter((x) => sameSecret(String((x.data as Record<string, unknown>).pin || ""), pin));

  if (hit.length !== 1) {
    // 이름으로 찾은 학생이 하나인데 PIN 이 틀렸다면 '누구를 노렸는지' 를 안다 → 그 학생만 잠근다.
    // 이름 없이 PIN 만 틀린 경우는 대상을 모르므로 IP 로만 센다.
    const sidForLog = (!qr && name && alive.length === 1) ? alive[0].id : "";
    hitFail(failByIp, ip, num("LOGIN_MAX_FAIL_IP", 20), 3600000);
    if (sidForLog) hitFail(failBySid, sidForLog, num("LOGIN_MAX_FAIL_SID", 10), 900000);
    // 실패 기록 — PIN 값은 남기지 않는다
    try {
      await fetch(`${URL_}/rest/v1/logs`, {
        method: "POST",
        headers: { ...srvHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({
          id: "lf" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          sid: sidForLog || null,
          data: { type: "login_fail", sid: sidForLog || "", role, at: new Date().toISOString(), by: qr ? "qr" : "pin" },
        }),
      });
    } catch { /* 기록 실패는 로그인 응답에 영향 주지 않는다 */ }
    if (hit.length > 1) {
      // 이름을 골라 다시 보내도록 후보 '이름만' 돌려준다 (PIN·연락처는 보내지 않는다)
      return new Response(JSON.stringify({
        error: { message: "같은 PIN 인 학생이 여럿입니다 — 이름을 골라 주세요" },
        candidates: hit.map((x) => ({ name: String((x.data as Record<string, unknown>).name || "") })),
      }), { status: 409, headers: { ...cors(origin), "Content-Type": "application/json" } });
    }
    return bad(401, qr ? "링크가 더 이상 유효하지 않습니다" : "이름 또는 PIN 이 맞지 않습니다", origin);
  }

  const sid = hit[0].id;
  const stuName = String((hit[0].data as Record<string, unknown>).name || "");
  const sidLock = lockedFor(failBySid, sid);
  if (sidLock > 0) return bad(429, `잠시 뒤에 다시 시도해 주세요 (${Math.ceil(sidLock / 60000)}분)`, origin);

  // ── 2. 그 학생·역할 전용 Auth 사용자로 세션 발급 ──
  // 학생용·학부모용을 나눈다 — 같은 sid 라도 role 이 다른 별도 계정이다.
  const domain = role === "parent"
    ? (env("LOGIN_PAR_DOMAIN") || "par.jikgyeol.local")
    : (env("LOGIN_STU_DOMAIN") || "stu.jikgyeol.local");
  const email = `${sid}@${domain}`;
  const password = await hmacHex(SECRET, sid + "|" + role);   // 어디에도 저장·노출하지 않는다

  const signIn = async () => {
    const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
  };

  let s = await signIn();
  if (!s.ok) {
    // 아직 계정이 없다 → 만든다 (확인 메일을 보내지 않도록 email_confirm)
    const c = await fetch(`${URL_}/auth/v1/admin/users`, {
      method: "POST",
      headers: srvHeaders,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        app_metadata: { sid, role },
        user_metadata: { name: stuName },
      }),
    });
    if (!c.ok && c.status !== 422) {
      const why = await c.text().catch(() => "");
      return bad(502, "계정 생성 실패 " + c.status + " " + why.slice(0, 200), origin);
    }
    s = await signIn();
  }
  if (!s.ok) return bad(502, "세션 발급 실패 " + s.status, origin);

  // app_metadata 가 비어 있으면(옛 계정) 채워 넣고 다시 발급 — RLS 가 이 값을 본다
  const meta = ((s.data as Record<string, unknown>).user as Record<string, unknown> | undefined)?.app_metadata as
    | Record<string, unknown>
    | undefined;
  if (!meta || meta.sid !== sid || meta.role !== role) {
    const uid = ((s.data as Record<string, unknown>).user as Record<string, unknown> | undefined)?.id;
    if (uid) {
      await fetch(`${URL_}/auth/v1/admin/users/${uid}`, {
        method: "PUT",
        headers: srvHeaders,
        body: JSON.stringify({ app_metadata: { sid, role } }),
      }).catch(() => {});
      s = await signIn();
      if (!s.ok) return bad(502, "세션 발급 실패 " + s.status, origin);
    }
  }

  clearFail(sid, ip);
  const d = s.data as Record<string, unknown>;
  return new Response(JSON.stringify({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_in: d.expires_in,
    sid,
    name: stuName,
    role,
  }), { headers: { ...cors(origin), "Content-Type": "application/json" } });
});
