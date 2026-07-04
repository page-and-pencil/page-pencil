import { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import SetupStep from "./components/SetupStep.jsx";
import GenerateStep from "./components/GenerateStep.jsx";
import ReviewStep from "./components/ReviewStep.jsx";
import HistoryDrawer from "./components/HistoryDrawer.jsx";
import { SAMPLE_PASSAGE, SECTIONS, DEFAULT_DESIGN, loadDefaults } from "./constants.js";

function initialSetup() {
  const saved = loadDefaults().setup || {};
  return {
    title: "",
    passage: "",
    passageType: saved.passageType || "informational",
    gradeLevel: saved.gradeLevel || "Grade 6",
    guidelineLanguage: saved.guidelineLanguage || "Korean",
    sections: saved.sections?.length ? saved.sections : ["summary", "vocab", "comp", "discussion"],
    schoolName: saved.schoolName || "",
  };
}

export default function App() {
  const [boot, setBoot] = useState(null);
  const [step, setStep] = useState("setup"); // setup | generate | review
  const [setup, setSetup] = useState(initialSetup);
  const [jobId, setJobId] = useState(null);
  const [worksheet, setWorksheet] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.bootstrap().then(setBoot).catch(console.error);
  }, []);

  const notify = useCallback((msg, kind = "info") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }, []);

  async function startGeneration(setupState) {
    setSetup(setupState);
    try {
      const { jobId } = await api.createJob({
        title: setupState.title,
        passage: setupState.passage,
        passageType: setupState.passageType,
        gradeLevel: setupState.gradeLevel,
        guidelineLanguage: setupState.guidelineLanguage,
        sections: setupState.sections,
      });
      setJobId(jobId);
      setStep("generate");
    } catch (err) {
      notify(err.message, "error");
    }
  }

  function onGenerated(result) {
    const design = { ...DEFAULT_DESIGN, ...(loadDefaults().design || {}) };
    setWorksheet({ ...result, schoolName: setup.schoolName || "", design });
    setSavedId(null);
    setStep("review");
  }

  async function saveWorksheet(w) {
    try {
      const { worksheet: saved } = await api.saveWorksheet(w);
      setSavedId(saved.id);
      notify("Worksheet saved to your history.");
    } catch (err) {
      notify(err.message, "error");
    }
  }

  async function openSaved(id) {
    try {
      const { worksheet: w } = await api.getWorksheet(id);
      setWorksheet(w);
      setSavedId(w.id);
      setHistoryOpen(false);
      setStep("review");
    } catch (err) {
      notify(err.message, "error");
    }
  }

  function newWorksheet() {
    setWorksheet(null);
    setSavedId(null);
    setJobId(null);
    setSetup(initialSetup());
    setStep("setup");
  }

  return (
    <div className="app-shell">
      <header className="topbar no-print">
        <button className="brand" onClick={newWorksheet}>
          <span className="brand-mark">WS</span>
          <span className="brand-name">
            Worksheet <em>Studio</em>
          </span>
        </button>
        <nav className="topbar-actions">
          {boot && !boot.aiConfigured && (
            <span className="badge badge-warn" title="Claude API 키가 설정되어야 실제 AI 생성이 가능합니다">
              Demo mode
            </span>
          )}
          <button className="btn btn-ghost" onClick={() => setHistoryOpen(true)}>
            History
          </button>
          {import.meta.env.MODE === "pp" && (
            <a className="btn btn-ghost" href="../index.html" style={{ textDecoration: "none" }}>
              ← Page &amp; Pencil
            </a>
          )}
        </nav>
      </header>

      <main className="main">
        {step === "setup" && (
          <SetupStep
            initial={setup}
            aiConfigured={boot?.aiConfigured}
            notify={notify}
            onSubmit={startGeneration}
            onLoadSample={() => setSetup((s) => ({ ...s, passage: SAMPLE_PASSAGE, title: "" }))}
          />
        )}
        {step === "generate" && (
          <GenerateStep
            jobId={jobId}
            sections={setup.sections}
            onDone={onGenerated}
            onError={(m) => {
              notify(m, "error");
              setStep("setup");
            }}
            onCancel={() => setStep("setup")}
          />
        )}
        {step === "review" && worksheet && (
          <ReviewStep
            worksheet={worksheet}
            setWorksheet={setWorksheet}
            savedId={savedId}
            onSave={saveWorksheet}
            onNew={newWorksheet}
            notify={notify}
          />
        )}
      </main>

      {historyOpen && <HistoryDrawer onClose={() => setHistoryOpen(false)} onOpen={openSaved} notify={notify} />}
      {toast && <div className={`toast toast-${toast.kind} no-print`}>{toast.msg}</div>}

      <footer className="footer no-print">
        <span>Worksheet Studio — generate, review, and download print-ready reading worksheets.</span>
        <span className="footer-sections">{SECTIONS.length} worksheet sections · 8 native languages · personal edition</span>
      </footer>
    </div>
  );
}
