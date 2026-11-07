// Page & Pencil — ElevenLabs TTS 서버 경유 (2026-11-07)
//
// 왜: 지금까지 브라우저가 api.elevenlabs.io 를 직접 불러서 ElevenLabs 키가
//     settings 행(공개 anon 키로 읽힘)과 localStorage 에 있어야 했다.
//     이 함수를 쓰면 키는 Supabase 시크릿 ELEVENLABS_API_KEY 에만 둔다.
//
// 시크릿:
//   ELEVENLABS_API_KEY   (필수)
//   TTS_ALLOWED_ORIGINS  (선택) 쉼표 구분. 기본값은 아래 DEFAULT_ORIGINS.
//                        '*' 를 넣으면 출처 확인을 하지 않는다(권장하지 않음).
//   TTS_ALLOW_NO_ORIGIN  (선택) '1' 이면 Origin 헤더가 없는 요청도 통과(로컬 file:// 시험용).
//   TTS_ALLOWED_VOICES   (선택) 쉼표 구분 voiceId 목록. 기본값은 아래 DEFAULT_VOICES.
//   TTS_MAX_PER_MIN      (선택) IP 당 분당 요청 수 (기본 40)
//   TTS_MAX_CHARS_PER_DAY(선택) IP 당 하루 생성 글자 수 (기본 20000)
//
// 입력 (POST JSON):
//   { probe: true }                       → 호출 없이 상태만 ({ok, server, voices})
//   { mode:'audio', text, voiceId?, wordMode? }      → mp3 바이트
//   { mode:'timestamps', text, voiceId?, speed? }    → ElevenLabs with-timestamps JSON
//
// 모델·voice_settings 는 서버가 정한다 — 클라이언트가 바꿀 수 없다(요금 방어).
// 값은 앱이 쓰던 것과 같다(원장이 고른 톤) — 바꾸면 들었던 느낌이 달라진다.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DEFAULT_ORIGINS = [
  "https://page-and-pencil.github.io",
];
// 앱이 쓰는 목소리만 — 모르는 voiceId 로 아무 음성이나 만들지 못하게 한다.
const DEFAULT_VOICES = [
  "XrExE9yKIg1WjnnlVkGX", // Matilda — 앱 설정에 들어 있는 목소리
  "EXAVITQu4vr4xnSDxMaL", // Sarah — 코드 기본값
];
const MAX_CHARS = { audio: 300, timestamps: 5000 };
const MAX_BODY = 32 * 1024;

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

// ── IP 별 사용량 (함수 인스턴스 메모리) ──
// 인스턴스가 여러 개면 각자 세므로 상한이 그만큼 느슨하다. 완벽한 차단이 아니라
// '한 사람이 몰아서 쓰는 것'을 막는 장치다. 더 엄격히 막으려면 테이블에 기록해야 한다.
type Hit = { min: number; n: number; day: string; chars: number };
const hits = new Map<string, Hit>();
function allow(ip: string, chars: number) {
  const now = Date.now();
  const min = Math.floor(now / 60000);
  const day = new Date(now).toISOString().slice(0, 10);
  const h = hits.get(ip) || { min, n: 0, day, chars: 0 };
  if (h.min !== min) { h.min = min; h.n = 0; }
  if (h.day !== day) { h.day = day; h.chars = 0; }
  h.n++; h.chars += chars;
  hits.set(ip, h);
  if (hits.size > 5000) hits.clear();   // 메모리 보호
  if (h.n > num("TTS_MAX_PER_MIN", 40)) return "분당 요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.";
  if (h.chars > num("TTS_MAX_CHARS_PER_DAY", 20000)) return "오늘 음성 생성 한도를 넘었습니다.";
  return "";
}

serve(async (req) => {
  // file:// 로 열면 Origin 이 문자열 "null" 로 온다 — 헤더가 없는 것과 같이 본다
  const originRaw = req.headers.get("origin") || "";
  const origin = originRaw === "null" ? "" : originRaw;
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return bad(405, "POST only", origin);

  // 출처 확인 — 다른 사이트에 붙여 넣은 페이지가 이 함수를 쓰지 못하게
  const allowed = list("TTS_ALLOWED_ORIGINS", DEFAULT_ORIGINS);
  if (!allowed.includes("*")) {
    if (origin) {
      if (!allowed.includes(origin)) return bad(403, "출처가 허용되지 않았습니다", origin);
    } else if (env("TTS_ALLOW_NO_ORIGIN") !== "1") {
      return bad(403, "출처를 확인할 수 없습니다", origin);
    }
  }

  const key = env("ELEVENLABS_API_KEY");
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return bad(413, "요청이 너무 큽니다", origin);
    body = JSON.parse(raw || "{}");
  } catch {
    return bad(400, "JSON 형식 오류", origin);
  }

  const voices = list("TTS_ALLOWED_VOICES", DEFAULT_VOICES);

  // 상태 확인 — ElevenLabs 를 부르지 않는다(크레딧 0)
  if (body.probe === true) {
    return new Response(JSON.stringify({ ok: true, server: !!key, voices }), {
      headers: { ...cors(origin), "Content-Type": "application/json" },
    });
  }
  if (!key) return bad(400, "서버에 ELEVENLABS_API_KEY 가 없습니다", origin);

  const mode = body.mode === "timestamps" ? "timestamps" : "audio";
  const text = String(body.text || "").trim();
  if (!text) return bad(400, "text 가 비어 있습니다", origin);
  if (text.length > MAX_CHARS[mode]) {
    return bad(400, `글자 수 상한(${MAX_CHARS[mode]}자)을 넘었습니다`, origin);
  }
  const voice = String(body.voiceId || voices[0]);
  if (!voices.includes(voice)) return bad(400, "허용되지 않은 voiceId 입니다", origin);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const why = allow(ip, text.length);
  if (why) return bad(429, why, origin);

  // 모델·톤은 서버가 고정 — 앱이 쓰던 값과 같다
  const speed = Math.min(1.2, Math.max(0.7, Number(body.speed) || 1));
  const payload = mode === "timestamps"
    ? {
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed },
      }
    : body.wordMode
      // 단어 하나는 다국어 모델이 언어를 오인한다(come → 이탈리아어 '코메') → 영어 강제
      ? {
          text,
          model_id: "eleven_turbo_v2_5",
          language_code: "en",
          voice_settings: { stability: 0.85, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
        }
      : {
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
        };

  const url = mode === "timestamps"
    ? `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_64`
    : `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const whyTxt = await res.text().catch(() => "");
      // 키 값은 응답에 들어가지 않는다 — ElevenLabs 의 오류 코드만 그대로 전한다
      return bad(res.status, "ElevenLabs " + res.status + " " + whyTxt.slice(0, 300), origin);
    }
    if (mode === "timestamps") {
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...cors(origin), "Content-Type": "application/json" },
      });
    }
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: { ...cors(origin), "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return bad(502, String((e as Error).message || e), origin);
  }
});
