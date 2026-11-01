// Page & Pencil — 매일 숙제 푸시 알림
// 남은 숙제가 있는 학생에게만 '본문 없는' 웹 푸시(tickle)를 보낸다.
// 본문을 싣지 않으므로 RFC 8291 암호화가 필요 없고 VAPID 서명(ES256 JWT)만 하면 된다.
// 알림 문구는 브라우저의 서비스워커(sw.js)가 만든다 — 기기에 저장된 역할(학생/학부모)에 맞춰서.
//
// 배포:
//   supabase secrets set VAPID_PRIVATE_JWK='{"kty":"EC",...}' VAPID_PUBLIC='B...' VAPID_SUBJECT='mailto:...'
//   supabase functions deploy push-hw --no-verify-jwt
// 스케줄: supabase/push_setup.sql 의 cron.schedule 참고
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const b64u = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// 대시보드에 비밀키를 붙여넣을 때 흔한 실수를 흡수한다.
// 실제로 겪은 사례: 여는·닫는 중괄호가 선택에서 빠져 저장됨 → JSON.parse가 position 5에서 실패.
// 값 자체는 절대 로그에 남기지 않고, 어디가 틀렸는지만 알려준다.
function readVapidJwk(): Record<string, string> {
  const raw0 = (Deno.env.get("VAPID_PRIVATE_JWK") || "").trim();
  if (!raw0) throw new Error("VAPID_PRIVATE_JWK 시크릿이 비어 있습니다");
  const NEED = ["kty", "crv", "d", "x", "y"];
  // 붙여넣기 실수를 차례로 시도해 본다 — 값을 추측해 고치지 않고, 형태만 바로잡는다.
  // 순서대로 넣고 처음 성공하는 것을 쓴다 (실제로 겪은 사고: 여는·닫는 중괄호가 선택에서 빠짐)
  const strip = (t: string) => {
    for (const q of ["'", '"', "`"]) {
      if (t.length > 1 && t.startsWith(q) && t.endsWith(q) && t.slice(1, -1).trim().startsWith("{")) {
        return t.slice(1, -1).trim();
      }
    }
    return t;
  };
  // 'VAPID_PRIVATE_JWK=...' 처럼 키 이름까지 붙여 넣은 경우를 떼어낸다.
  // 이전 판은 '={' 만 찾아서 중괄호가 함께 빠진 'NAME="kty":...' 는 못 떼어냈다 (대시보드 AI 지적).
  const nameEq = /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*/.exec(raw0);
  const base = strip(nameEq ? raw0.slice(nameEq[0].length).trim() : raw0);
  const tries = [base, "{" + base + "}", "{" + base.replace(/^\{/, "").replace(/\}$/, "") + "}"];
  for (const t of tries) {
    try {
      const j = JSON.parse(t);
      if (j && typeof j === "object" && NEED.every((k) => typeof j[k] === "string" && j[k])) return j;
    } catch (_) { /* 다음 후보 */ }
  }
  // 어느 형태로도 안 되면 값은 숨기고 어디가 틀렸는지만 알린다
  const found = NEED.filter((k) => base.includes('"' + k + '"')).join(",") || "없음";
  throw new Error(
    `VAPID_PRIVATE_JWK를 읽지 못했습니다 (길이 ${base.length}, 첫 글자 "${base.slice(0, 1)}", 찾은 항목 ${found}). ` +
      `VAPID_KEYS_LOCAL.txt 의 비밀키 한 줄을 { 부터 } 까지 전부 복사해 다시 넣어 주세요`,
  );
}

// ── VAPID: ES256 JWT 서명 ──
async function vapidAuth(audience: string): Promise<string> {
  const jwk = readVapidJwk();
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, crv: jwk.crv, d: jwk.d, x: jwk.x, y: jwk.y, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = b64u(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64u(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  })));
  const data = new TextEncoder().encode(header + "." + payload);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data);
  return `vapid t=${header}.${payload}.${b64u(sig)}, k=${VAPID_PUBLIC}`;
}

async function sb(path: string) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return await r.json();
}

// 한국 시간 기준 오늘 (서버는 UTC로 돌아간다)
function todayKST(): string {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// 그 학생에게 '오늘 남은 숙제'가 있는가.
// recurRebase 같은 계산은 선생님 앱이 이미 돌려 schedule에 저장해 두므로 여기서는 읽기만 한다.
function pendingToday(rows: any[], sid: string, today: string): number {
  let n = 0;
  for (const row of rows) {
    const a = row.data || {};
    if (a._deleted || a.sid !== sid) continue;
    const sch = a.schedule;
    if (Array.isArray(sch) && sch.length) {
      for (const s of sch) if (s && s.date === today && !s.done) n++;
      continue;
    }
    const due = String(a.due || a.date || "").slice(0, 10);
    if (due === today && !a.completedAt) n++;
  }
  return n;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // force=true면 '하루 1회' 제한을 무시한다 (시험 발송용).
    // ⚠️ 아무나 쓰면 알림을 쌓을 수 있으므로 **service_role 키로 호출할 때만** 허용한다.
    // 스케줄러는 공개 키로 호출하므로 force 없이 평소 경로(기기당 하루 1회)를 탄다.
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const isAdmin = !!SERVICE_KEY && bearer === SERVICE_KEY;
    let wanted = false;
    try { const b = await req.json(); wanted = !!(b && b.force); } catch (_) { /* 본문 없음 */ }
    const force = wanted && isAdmin;
    const forceDenied = wanted && !isAdmin;
    const today = todayKST();
    // 시크릿이 잘못돼 있으면 구독마다 같은 오류를 반복하지 말고 여기서 한 번 분명히 알린다
    try {
      readVapidJwk();
      if (!VAPID_PUBLIC) throw new Error("VAPID_PUBLIC 시크릿이 비어 있습니다");
    } catch (e) {
      return new Response(JSON.stringify({ error: "시크릿 설정 문제", detail: String(e instanceof Error ? e.message : e) }, null, 1), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const subs = await sb("push_subs?select=*");
    const asgn = await sb("assignments?select=*&limit=20000");
    const stus = await sb("students?select=*&limit=5000");
    const nameOf = (sid: string) => {
      const s = stus.find((x: any) => x.id === sid);
      return (s && s.data && s.data.name) || "";
    };

    const result: any[] = [];
    const pendingCache = new Map<string, number>();

    for (const row of subs) {
      const d = row.data || {};
      if (d.active === false || !d.endpoint || !d.sid) continue;
      // 같은 날 두 번 보내지 않는다 — 누가 함수를 여러 번 호출해도 기기마다 하루 한 번뿐.
      // 이 보장이 있어서 스케줄러가 공개 키(anon)로 호출해도 알림이 쌓이지 않는다.
      if (!force && d.lastSentDate === today) { result.push({ sid: d.sid, skipped: "오늘 이미 보냄" }); continue; }
      if (!pendingCache.has(d.sid)) pendingCache.set(d.sid, pendingToday(asgn, d.sid, today));
      const pending = pendingCache.get(d.sid)!;
      if (pending <= 0) { result.push({ sid: d.sid, skipped: "남은 숙제 없음" }); continue; }

      let status = 0, note = "";
      try {
        const u = new URL(d.endpoint);
        const res = await fetch(d.endpoint, {
          method: "POST",
          headers: {
            TTL: "7200",
            Urgency: "normal",
            Authorization: await vapidAuth(`${u.protocol}//${u.host}`),
            "Content-Length": "0",
          },
        });
        status = res.status;
        // 404·410 = 끊긴 구독 → 더 두드리지 않게 지운다
        if (status === 404 || status === 410) {
          await fetch(`${SUPA_URL}/rest/v1/push_subs?id=eq.${encodeURIComponent(row.id)}`, {
            method: "DELETE",
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
          });
          note = "만료 구독 삭제";
        } else if (status >= 400) {
          note = (await res.text()).slice(0, 200);
        } else {
          // 보낸 날짜를 적어 둔다 (하루 1회 보장의 기준)
          await fetch(`${SUPA_URL}/rest/v1/push_subs?id=eq.${encodeURIComponent(row.id)}`, {
            method: "PATCH",
            headers: {
              apikey: SERVICE_KEY,
              Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ data: { ...d, lastSentDate: today }, updated_at: new Date().toISOString() }),
          });
        }
      } catch (e) {
        note = String(e).slice(0, 200);
      }
      result.push({ sid: d.sid, name: nameOf(d.sid), role: d.role, pending, status, note });
    }
    const sent = result.filter((r) => r.status && r.status >= 200 && r.status < 300).length;
    return new Response(JSON.stringify({
      today, force, sent, total: subs.length,
      ...(forceDenied ? { forceDenied: "force는 service_role 키로 호출할 때만 쓸 수 있습니다" } : {}),
      result,
    }, null, 1), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
