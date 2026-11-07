// Page & Pencil — Claude API 서버 경유 (2026-11-07 남용 방지 강화)
//
// 바뀐 점
//  1. 클라이언트가 보내는 apiKey 필드는 **무시**한다. 키는 시크릿 ANTHROPIC_API_KEY 만.
//  2. 허용 모델 목록 밖의 model 은 거부.
//  3. max_tokens 상한 강제 (초과하면 상한으로 깎는다 — 요청을 깨지 않는다).
//  4. 요청 본문 크기 상한.
//  5. Origin 확인.
//  6. IP 별 분당·일별 요청 수 상한.
//
// 시크릿:
//   ANTHROPIC_API_KEY        (필수)
//   CLAUDE_ALLOWED_ORIGINS   (선택) 쉼표 구분. 기본값 DEFAULT_ORIGINS. '*' = 확인 안 함
//   CLAUDE_ALLOW_NO_ORIGIN   (선택) '1' 이면 Origin 없는 요청도 통과(로컬 file:// 시험용)
//   CLAUDE_ALLOWED_MODELS    (선택) 쉼표 구분. 기본값 DEFAULT_MODELS
//   CLAUDE_MAX_TOKENS        (선택) 기본 16000
//   CLAUDE_MAX_BODY_BYTES    (선택) 기본 12582912 (12MB — 워크시트 스튜디오의 이미지 가져오기)
//   CLAUDE_MAX_PER_MIN       (선택) 기본 30
//   CLAUDE_MAX_PER_DAY       (선택) 기본 800

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DEFAULT_ORIGINS = [
  "https://page-and-pencil.github.io",
];
// 앱이 실제로 쓰는 모델만
const DEFAULT_MODELS = [
  "claude-haiku-4-5-20251001", // 코멘트 변환·단어 뜻 등 대부분
  "claude-sonnet-4-6",         // 월간 리포트·학생 응원 문구
  "claude-opus-4-8",           // 워크시트 스튜디오
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

// IP 별 사용량 (함수 인스턴스 메모리). 인스턴스가 여러 개면 각자 세므로 완벽한 차단이
// 아니라 '한 사람이 몰아서 쓰는 것'을 막는 장치다.
type Hit = { min: number; n: number; day: string; d: number };
const hits = new Map<string, Hit>();
function allow(ip: string) {
  const now = Date.now();
  const min = Math.floor(now / 60000);
  const day = new Date(now).toISOString().slice(0, 10);
  const h = hits.get(ip) || { min, n: 0, day, d: 0 };
  if (h.min !== min) { h.min = min; h.n = 0; }
  if (h.day !== day) { h.day = day; h.d = 0; }
  h.n++; h.d++;
  hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  if (h.n > num("CLAUDE_MAX_PER_MIN", 30)) return "분당 요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.";
  if (h.d > num("CLAUDE_MAX_PER_DAY", 800)) return "오늘 AI 요청 한도를 넘었습니다.";
  return "";
}

serve(async (req) => {
  // file:// 로 열면 Origin 이 문자열 "null" 로 온다 — 헤더가 없는 것과 같이 본다
  const originRaw = req.headers.get("origin") || "";
  const origin = originRaw === "null" ? "" : originRaw;
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return bad(405, "POST only", origin);

  const allowedOrigins = list("CLAUDE_ALLOWED_ORIGINS", DEFAULT_ORIGINS);
  if (!allowedOrigins.includes("*")) {
    if (origin) {
      if (!allowedOrigins.includes(origin)) return bad(403, "출처가 허용되지 않았습니다", origin);
    } else if (env("CLAUDE_ALLOW_NO_ORIGIN") !== "1") {
      return bad(403, "출처를 확인할 수 없습니다", origin);
    }
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return bad(400, "본문을 읽을 수 없습니다", origin);
  }
  const maxBody = num("CLAUDE_MAX_BODY_BYTES", 12 * 1024 * 1024);
  if (raw.length > maxBody) return bad(413, "요청이 너무 큽니다", origin);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    return bad(400, "JSON 형식 오류", origin);
  }
  // 클라이언트 키는 무시한다 (공개 소스에 키를 둘 이유가 없어졌다)
  delete parsed.apiKey;

  const key = env("ANTHROPIC_API_KEY");
  // 앱은 이 문구로 '서버 키가 있는지' 확인한다(ppProbeAiProxy) — 바꾸면 그 확인이 깨진다
  if (!key) return bad(400, "API key required", origin);

  const models = list("CLAUDE_ALLOWED_MODELS", DEFAULT_MODELS);
  const model = String(parsed.model || "");
  if (!model) return bad(400, "model 이 없습니다", origin);
  if (!models.includes(model)) return bad(400, "허용되지 않은 model 입니다: " + model, origin);

  const cap = num("CLAUDE_MAX_TOKENS", 16000);
  const want = Number(parsed.max_tokens);
  parsed.max_tokens = Number.isFinite(want) && want > 0 ? Math.min(want, cap) : 1000;

  const why = allow(ip);
  if (why) return bad(429, why, origin);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify(parsed),
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...cors(origin), "Content-Type": "application/json" },
    });
  } catch (e) {
    return bad(500, String((e as Error).message || e), origin);
  }
});
