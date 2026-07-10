import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { apiKey, ...body } = await req.json();
    // 보안: 서버 시크릿 우선 — `supabase secrets set ANTHROPIC_API_KEY=...` 후에는
    // 클라이언트(공개 소스)에 키를 둘 필요가 없음. 시크릿이 없으면 기존처럼 body 키 사용(하위 호환)
    const key = Deno.env.get("ANTHROPIC_API_KEY") || apiKey;
    if (!key) {
      return new Response(JSON.stringify({ error: { message: "API key required" } }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: e.message } }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
