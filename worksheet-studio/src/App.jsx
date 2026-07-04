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

  // P&P 자료 DB에서 특정 워크시트 바로 열기: studio/index.html#open=<id>
  useEffect(() => {
    const openFromHash = () => {
      const m = window.location.hash.match(/open=([^&]+)/);
      if (m) {
        window.location.hash = "";
        openSaved(decodeURIComponent(m[1]));
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const embedded = import.meta.env.MODE === "pp" && window.self !== window.top; // P&P 내장(iframe) 모드

  return (
    <div className="app-shell">
      <header className="topbar no-print" style={embedded ? { padding: "8px 20px" } : undefined}>
        <button className="brand" onClick={newWorksheet} title="처음 화면으로">
          {!embedded && <span className="brand-mark">WS</span>}
          <span className="brand-name" style={embedded ? { fontSize: 15 } : undefined}>
            {embedded ? <>📝 워크시트 스튜디오</> : <>Worksheet <em>Studio</em></>}
          </span>
        </button>
        <nav className="topbar-actions">
          {boot && !boot.aiConfigured && (
            <span className="badge badge-warn" title="Claude API 키가 설정되어야 실제 AI 생성이 가능합니다">
              데모 모드
            </span>
          )}
          <button className="btn btn-ghost" onClick={() => setHistoryOpen(true)}>
            📂 기록
          </button>
          {import.meta.env.MODE === "pp" && window.self === window.top && (
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

      {!embedded && (
        <footer className="footer no-print">
          <span>Worksheet Studio — AI 리딩 워크시트 생성 · 검토 · 인쇄</span>
          <span className="footer-sections">{SECTIONS.length}개 섹션 · 8개 모국어 · Page &amp; Pencil</span>
        </footer>
      )}
    </div>
  );
}
