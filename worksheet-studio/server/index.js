import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { store } from "./store.js";
import { generateWorksheet, extractPassageFromFiles, hasApiKey } from "./generate.js";

const app = express();
app.use(express.json({ limit: "60mb" })); // base64 images / PDFs for passage import

const PORT = process.env.API_PORT || 8787;

// 개인용 단일 사용자 모드 — 로그인 없이 항상 로컬 사용자로 동작합니다.
const LOCAL_USER = store.upsertUser({
  id: "local-user",
  name: "내 워크시트",
  email: "local@this-machine",
  provider: "local",
});

function withUser(req, _res, next) {
  req.user = LOCAL_USER;
  next();
}
app.use(withUser);

// ── Bootstrap ────────────────────────────────────────────────────────────────

app.get("/api/bootstrap", (req, res) => {
  res.json({
    user: { id: req.user.id, name: req.user.name },
    aiConfigured: hasApiKey(),
  });
});

// ── Generation jobs ──────────────────────────────────────────────────────────

const jobs = new Map();

app.post("/api/generation/jobs", (req, res) => {
  const { passage, passageType, gradeLevel, guidelineLanguage, sections, title } = req.body || {};
  if (!passage || !passage.trim()) return res.status(400).json({ error: "Passage text is required." });
  if (!Array.isArray(sections) || sections.length === 0)
    return res.status(400).json({ error: "Select at least one worksheet section." });

  const id = crypto.randomUUID();
  const job = { id, status: "running", logs: [], result: null, error: null, createdAt: Date.now() };
  jobs.set(id, job);
  const log = (msg) => job.logs.push({ t: Date.now(), msg });

  log("Job accepted. Preparing generation...");
  generateWorksheet(
    {
      passage,
      passageType: passageType || "informational",
      gradeLevel: gradeLevel || "Grade 6",
      guidelineLanguage: guidelineLanguage || "Korean",
      sections,
      title,
    },
    log
  )
    .then((result) => {
      job.result = { ...result, passage, passageType, gradeLevel, guidelineLanguage, sectionIds: sections };
      job.status = "done";
      log("Worksheet ready.");
    })
    .catch((err) => {
      console.error("Generation failed:", err);
      job.status = "error";
      job.error = err.message || "Generation failed.";
      log(`Error: ${job.error}`);
    });

  res.json({ jobId: id });
});

app.get("/api/generation/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json({ id: job.id, status: job.status, logs: job.logs, result: job.result, error: job.error });
});

// ── Image / PDF → passage import ─────────────────────────────────────────────

const IMPORT_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);

app.post("/api/import/files", async (req, res) => {
  const files = req.body?.files;
  if (!Array.isArray(files) || files.length === 0)
    return res.status(400).json({ error: "No files provided." });
  if (files.length > 4) return res.status(400).json({ error: "Up to 4 files at a time." });
  for (const f of files) {
    if (!f?.data || !IMPORT_TYPES.has(f.mediaType))
      return res.status(400).json({ error: `Unsupported file type: ${f?.mediaType || "unknown"}. Use JPG/PNG/WEBP/GIF images or PDF.` });
  }
  try {
    const text = await extractPassageFromFiles(files);
    res.json({ text });
  } catch (err) {
    console.error("File import failed:", err);
    res.status(400).json({ error: err.message || "File import failed." });
  }
});

// ── Saved worksheets ─────────────────────────────────────────────────────────

app.get("/api/worksheets", (req, res) => {
  res.json({ worksheets: store.listWorksheets(req.user.id) });
});

app.post("/api/worksheets", (req, res) => {
  const w = req.body?.worksheet;
  if (!w || !w.title || !w.sections) return res.status(400).json({ error: "Invalid worksheet payload." });
  res.json({ worksheet: store.saveWorksheet(req.user.id, w) });
});

app.get("/api/worksheets/:id", (req, res) => {
  const w = store.getWorksheet(req.user.id, req.params.id);
  if (!w) return res.status(404).json({ error: "Worksheet not found." });
  res.json({ worksheet: w });
});

app.delete("/api/worksheets/:id", (req, res) => {
  const ok = store.deleteWorksheet(req.user.id, req.params.id);
  if (!ok) return res.status(404).json({ error: "Worksheet not found." });
  res.json({ ok: true });
});

// ── Static (production build) ────────────────────────────────────────────────

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
app.use(express.static(dist));
app.get(/^\/(?!api\/).*/, (req, res, next) => {
  res.sendFile(path.join(dist, "index.html"), (err) => err && next());
});

app.listen(PORT, () => {
  console.log(`Worksheet Studio API on http://localhost:${PORT}`);
  console.log(
    `AI generation: ${hasApiKey() ? `Claude (${process.env.ANTHROPIC_MODEL || "claude-opus-4-8"})` : "DEMO mode (set ANTHROPIC_API_KEY)"}`
  );
});
