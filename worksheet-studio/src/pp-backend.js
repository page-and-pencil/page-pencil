// Page & Pencil 내장판 백엔드 (GitHub Pages — Express 서버 없음).
// - AI 호출: 기존 Supabase Edge Function `claude-proxy` 경유 (요청 본문 그대로 전달됨)
// - 저장: Supabase `worksheets` 테이블 직접 호출 (본 앱과 동일한 anon 키)
// - API 키: 페이지앤펜슬이 이미 쓰는 키 (localStorage `pp_apikey` → settings 테이블 순)
// 빌드: `vite build --mode pp` 일 때 api.js가 이 구현을 선택한다.
import { SECTION_DEFS } from "../server/sections.js";

const SUPA_URL = "https://pznpcewwdsbxwibpnapn.supabase.co";
const SUPA_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bnBjZXd3ZHNieHdpYnBuYXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NjQ4NzUsImV4cCI6MjA5NTQ0MDg3NX0.fzXJKPfcxR-vrgsFbgt6-5sMEjtUH2p_rPsv6XjHe-c";
const SUPA_HEADERS = {
  apikey: SUPA_KEY,
  Authorization: "Bearer " + SUPA_KEY,
  "Content-Type": "application/json",
};
const MODEL = "claude-opus-4-8";
const CONCURRENCY = 3;
// claude-proxy(엣지 함수)로 보내는 본문 크기 여유치 — 이미지/PDF base64 합계 제한
const MAX_IMPORT_TOTAL_BASE64 = 11_000_000; // ≈ 원본 8MB

// ── API 키 (페이지앤펜슬 설정 재사용) ────────────────────────────────────────
let _apiKeyCache;
async function getApiKey() {
  if (_apiKeyCache !== undefined) return _apiKeyCache;
  try {
    const local = JSON.parse(localStorage.getItem("pp_apikey") || "null");
    if (local) return (_apiKeyCache = local);
  } catch {}
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/settings?key=eq.apikey&limit=1`, {
      headers: { ...SUPA_HEADERS, Accept: "application/vnd.pgrst.object+json" },
    });
    if (r.ok) {
      const d = await r.json();
      if (d?.value) return (_apiKeyCache = d.value);
    }
  } catch {}
  return (_apiKeyCache = "");
}

// ── claude-proxy 호출 ────────────────────────────────────────────────────────
async function callClaude(body) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("Claude API 키가 없습니다 — 페이지앤펜슬 설정 탭에서 API Key를 확인해 주세요.");
  }
  const res = await fetch(`${SUPA_URL}/functions/v1/claude-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + SUPA_KEY },
    body: JSON.stringify({ apiKey, ...body }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.type === "error") {
    const err = new Error(d.error?.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return d;
}

// ── 워크시트 생성 (server/generate.js의 클라이언트 포트) ─────────────────────
const SYSTEM_PROMPT =
  "You are an expert ESL/reading curriculum designer. You produce complete, classroom-ready reading worksheets from a passage. " +
  "All student-facing questions and tasks are in English, leveled to the requested US grade. " +
  "Translations, definitions support, and learner guidance use the requested guideline language. " +
  "Quote from the passage exactly when a section asks for passage examples.";

const META_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    topic: { type: "string" },
    passageSummary: { type: "string" },
  },
  required: ["title", "topic", "passageSummary"],
  additionalProperties: false,
};

function sharedContext({ passage, passageType, gradeLevel, guidelineLanguage }) {
  return [
    `Source material for a reading worksheet.`,
    ``,
    `Passage type: ${passageType}`,
    `Grade level (US): ${gradeLevel}`,
    `Guideline language for translations/support: ${guidelineLanguage}`,
    ``,
    `PASSAGE:`,
    `"""`,
    passage,
    `"""`,
  ].join("\n");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function generatePart({ label, instruction, schema, context }) {
  for (let attempt = 1; ; attempt++) {
    try {
      const message = await callClaude({
        model: MODEL,
        max_tokens: 12000,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: context, cache_control: { type: "ephemeral" } },
              { type: "text", text: instruction },
            ],
          },
        ],
        output_config: { format: { type: "json_schema", schema } },
      });

      if (message.stop_reason === "refusal") {
        const e = new Error("The AI declined to process this passage. Please try a different passage.");
        e.fatal = true;
        throw e;
      }
      if (message.stop_reason === "max_tokens") {
        const e = new Error("The section output was too long. Try a shorter passage.");
        e.fatal = true;
        throw e;
      }
      const text = message.content?.find((b) => b.type === "text")?.text;
      if (!text) throw new Error("Empty response from the AI model.");
      return JSON.parse(text);
    } catch (err) {
      const status = err?.status;
      const retriable = !err.fatal && (status === 429 || status === 529 || (status >= 500 && status < 600));
      if (attempt < 3 && retriable) {
        await sleep(1500 * attempt);
        continue;
      }
      throw new Error(`${label} failed — ${err.message}`);
    }
  }
}

async function runGeneration(input, log) {
  const { sections, title } = input;
  const context = sharedContext(input);

  const parts = [
    {
      key: "__meta",
      label: "Title & summary",
      schema: META_SCHEMA,
      instruction: [
        title
          ? `Use exactly this worksheet title: "${title}".`
          : `Create a short, engaging worksheet title from the passage topic.`,
        `Also provide the topic (a short phrase) and a 1-2 sentence passageSummary.`,
      ].join("\n"),
    },
    ...sections.map((id) => ({
      key: id,
      label: SECTION_DEFS[id].label,
      schema: SECTION_DEFS[id].schema,
      instruction: `Generate the "${SECTION_DEFS[id].label}" worksheet section.\n${SECTION_DEFS[id].prompt}`,
    })),
  ];

  log(`Calling Claude (${MODEL}) — ${parts.length} parts, up to ${CONCURRENCY} in parallel...`);

  let done = 0;
  const results = await mapLimit(parts, CONCURRENCY, async (part) => {
    const data = await generatePart({ ...part, context });
    done += 1;
    log(`✓ ${part.label} (${done}/${parts.length})`);
    return data;
  });

  const out = { sections: {} };
  parts.forEach((part, i) => {
    if (part.key === "__meta") Object.assign(out, results[i]);
    else out.sections[part.key] = results[i];
  });
  if (title) out.title = title;
  log("All sections complete.");
  return out;
}

// ── 잡 에뮬레이션 (기존 컴포넌트의 createJob/getJob 폴링 인터페이스 유지) ────
const jobs = new Map();

async function createJob(payload) {
  const { passage, passageType, gradeLevel, guidelineLanguage, sections, title } = payload;
  if (!passage || !passage.trim()) throw new Error("Passage text is required.");
  if (!Array.isArray(sections) || sections.length === 0) throw new Error("Select at least one worksheet section.");

  const id = crypto.randomUUID();
  const job = { id, status: "running", logs: [], result: null, error: null };
  jobs.set(id, job);
  const log = (msg) => job.logs.push({ t: Date.now(), msg });

  log("Job accepted. Preparing generation...");
  runGeneration({ passage, passageType, gradeLevel, guidelineLanguage, sections, title }, log)
    .then((result) => {
      job.result = { ...result, passage, passageType, gradeLevel, guidelineLanguage, sectionIds: sections };
      job.status = "done";
      log("Worksheet ready.");
    })
    .catch((err) => {
      job.status = "error";
      job.error = err.message || "Generation failed.";
      log(`Error: ${job.error}`);
    });

  return { jobId: id };
}

async function getJob(id) {
  const job = jobs.get(id);
  if (!job) throw new Error("Job not found.");
  return { id: job.id, status: job.status, logs: [...job.logs], result: job.result, error: job.error };
}

// ── 이미지/PDF → 지문 추출 ──────────────────────────────────────────────────
async function importFiles(files) {
  const total = files.reduce((n, f) => n + (f.data?.length || 0), 0);
  if (total > MAX_IMPORT_TOTAL_BASE64) {
    throw new Error("파일이 너무 큽니다 — 내장판은 합계 8MB까지 지원해요. 파일 수를 줄이거나 해상도를 낮춰 주세요.");
  }
  const content = [
    ...files.map((f) =>
      f.mediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } }
        : { type: "image", source: { type: "base64", media_type: f.mediaType, data: f.data } }
    ),
    {
      type: "text",
      text:
        "Extract the English reading passage from these files (textbook pages, worksheets, photos, or PDF documents). " +
        "Return ONLY the passage text: keep paragraph breaks as blank lines, join words split by end-of-line hyphenation, " +
        "and skip page numbers, headers, captions, and question numbers. " +
        "If there are multiple passages, extract all of them separated by blank lines. No commentary.",
    },
  ];
  const message = await callClaude({ model: MODEL, max_tokens: 8000, messages: [{ role: "user", content }] });
  const text = message.content?.find((b) => b.type === "text")?.text?.trim();
  if (!text) throw new Error("Could not extract text from the file(s).");
  return { text };
}

// ── 저장/히스토리 (Supabase worksheets 테이블, 본 앱과 동일 스키마) ──────────
function rowSummary(row) {
  const w = row.data || {};
  return {
    id: row.id,
    title: w.title || "Untitled worksheet",
    gradeLevel: w.gradeLevel,
    passageType: w.passageType,
    createdAt: w.createdAt || Date.parse(row.updated_at) || Date.now(),
    sectionCount: w.sections ? Object.keys(w.sections).length : 0,
  };
}

async function listWorksheets() {
  const r = await fetch(`${SUPA_URL}/rest/v1/worksheets?select=*&order=updated_at.desc`, { headers: SUPA_HEADERS });
  if (!r.ok) throw new Error(r.status === 404 ? "worksheets 테이블이 없습니다 — supabase_worksheets_table.sql을 실행해 주세요." : `저장소 오류 (HTTP ${r.status})`);
  const rows = await r.json();
  return { worksheets: rows.map(rowSummary) };
}

async function getWorksheet(id) {
  const r = await fetch(`${SUPA_URL}/rest/v1/worksheets?id=eq.${encodeURIComponent(id)}&limit=1`, {
    headers: { ...SUPA_HEADERS, Accept: "application/vnd.pgrst.object+json" },
  });
  if (!r.ok) throw new Error("Worksheet not found.");
  const row = await r.json();
  return { worksheet: row.data };
}

async function saveWorksheet(worksheet) {
  if (!worksheet || !worksheet.title || !worksheet.sections) throw new Error("Invalid worksheet payload.");
  const id = crypto.randomUUID();
  const record = { ...worksheet, id, createdAt: Date.now() };
  const r = await fetch(`${SUPA_URL}/rest/v1/worksheets`, {
    method: "POST",
    headers: { ...SUPA_HEADERS, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id, sid: null, data: record, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(r.status === 404 ? "worksheets 테이블이 없습니다 — supabase_worksheets_table.sql을 실행해 주세요." : `저장 실패: ${t || r.status}`);
  }
  return { worksheet: record };
}

async function deleteWorksheet(id) {
  const r = await fetch(`${SUPA_URL}/rest/v1/worksheets?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: SUPA_HEADERS,
  });
  if (!r.ok) throw new Error("삭제 실패 (HTTP " + r.status + ")");
  return { ok: true };
}

export const ppApi = {
  bootstrap: async () => ({
    user: { id: "pp-teacher", name: "Page & Pencil" },
    aiConfigured: Boolean(await getApiKey()),
  }),
  importFiles,
  createJob,
  getJob,
  listWorksheets,
  getWorksheet,
  saveWorksheet,
  deleteWorksheet,
};
