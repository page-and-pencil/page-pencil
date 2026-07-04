import { useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { PASSAGE_TYPES, SECTIONS, LANGUAGES, GRADES, saveDefaults } from "../constants.js";

const MAX_IMPORT_FILE_MB = 10;

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const [head, data] = String(reader.result).split(",");
      const mediaType = head.match(/data:(.*?)[;,]/)?.[1] || "image/jpeg";
      resolve({ mediaType, data });
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export default function SetupStep({ initial, onSubmit, onLoadSample, aiConfigured, notify }) {
  const [state, setState] = useState(initial);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const set = (patch) => setState((s) => ({ ...s, ...patch }));

  // keep in sync when parent injects the sample passage
  if (initial.passage !== state.passage && initial.passage && !state.passage) {
    setState(initial);
  }

  const visibleSections = useMemo(
    () => SECTIONS.filter((s) => !s.literatureOnly || state.passageType === "literature"),
    [state.passageType]
  );

  function toggleSection(id) {
    set({
      sections: state.sections.includes(id)
        ? state.sections.filter((s) => s !== id)
        : [...state.sections, id],
    });
  }

  async function importFiles(fileList) {
    if (!fileList?.length) return;
    if (!aiConfigured) {
      notify("File import requires an Anthropic API key in .env.", "error");
      return;
    }
    const files = [...fileList].slice(0, 4);
    const tooBig = files.find((f) => f.size > MAX_IMPORT_FILE_MB * 1024 * 1024);
    if (tooBig) {
      notify(`"${tooBig.name}" is over ${MAX_IMPORT_FILE_MB}MB — please use a smaller file.`, "error");
      return;
    }
    setImporting(true);
    try {
      const payloads = await Promise.all(files.map(fileToPayload));
      const { text } = await api.importFiles(payloads);
      set({ passage: state.passage.trim() ? `${state.passage.trim()}\n\n${text}` : text });
      notify("Passage imported.");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function saveSetupDefaults() {
    saveDefaults({
      setup: {
        passageType: state.passageType,
        gradeLevel: state.gradeLevel,
        guidelineLanguage: state.guidelineLanguage,
        sections: state.sections,
        schoolName: state.schoolName || "",
      },
    });
    notify("Saved as your default settings.");
  }

  function submit() {
    const sections = state.sections.filter((id) => visibleSections.some((s) => s.id === id));
    onSubmit({ ...state, sections });
  }

  const canSubmit = state.passage.trim().length > 0 && state.sections.length > 0;

  return (
    <div className="setup">
      <div className="step-header">
        <p className="step-eyebrow">STEP 1 — 지문 입력</p>
        <h1>AI 리딩 워크시트 만들기</h1>
        <p className="step-sub">
          지문을 붙여넣고 학년과 섹션만 고르면, AI가 인쇄용 워크시트와 답안지를 한 번에 만들어 드려요.
        </p>
      </div>

      <div className="setup-grid">
        <section className="card">
          <div className="card-title-row">
            <h2>원문 지문</h2>
            <button className="btn-link" onClick={onLoadSample}>
              샘플 지문 불러오기
            </button>
          </div>

          <div className="import-row">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              hidden
              onChange={(e) => importFiles(e.target.files)}
            />
            <button className="btn btn-ghost" disabled={importing} onClick={() => fileRef.current?.click()}>
              {importing ? "지문 추출 중…" : "📎 사진 / PDF에서 가져오기"}
            </button>
            <span className="import-hint">교재 사진이나 PDF를 올리면 AI가 지문만 추출해요 (최대 4개)</span>
          </div>

          <input
            className="input"
            placeholder="워크시트 제목 (비우면 지문 주제로 자동 설정)"
            value={state.title}
            onChange={(e) => set({ title: e.target.value })}
          />
          <textarea
            className="textarea"
            rows={13}
            placeholder="영어 지문을 여기에 붙여넣으세요…"
            value={state.passage}
            onChange={(e) => set({ passage: e.target.value })}
          />
          <div className="char-count">{state.passage.length.toLocaleString()}자</div>

          <label className="field-label">지문 유형</label>
          <div className="type-row">
            {PASSAGE_TYPES.map((t) => (
              <button
                key={t.id}
                className={`type-card ${state.passageType === t.id ? "type-card-active" : ""}`}
                onClick={() => set({ passageType: t.id })}
              >
                <strong>{t.label}</strong>
                <span>{t.description}</span>
              </button>
            ))}
          </div>

          <label className="field-label">
            학교 / 교사명 <span className="muted">(선택 — 워크시트에 인쇄)</span>
          </label>
          <input
            className="input"
            placeholder="e.g. Sunrise Learning Center · Ms. Ahn"
            value={state.schoolName || ""}
            onChange={(e) => set({ schoolName: e.target.value })}
          />
        </section>

        <section className="card">
          <h2>학년 &amp; 섹션 선택</h2>

          <label className="field-label">학년 (미국 기준)</label>
          <select className="input" value={state.gradeLevel} onChange={(e) => set({ gradeLevel: e.target.value })}>
            {GRADES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label} · {g.age}
              </option>
            ))}
          </select>

          <label className="field-label">모국어 지원 언어 (번역·해설)</label>
          <select
            className="input"
            value={state.guidelineLanguage}
            onChange={(e) => set({ guidelineLanguage: e.target.value })}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.name}>
                {l.name} — {l.native}
              </option>
            ))}
          </select>

          <label className="field-label">
            워크시트 섹션 <span className="muted">({state.sections.length}개 선택)</span>
          </label>
          <div className="section-list">
            {visibleSections.map((s) => (
              <label key={s.id} className={`section-item ${state.sections.includes(s.id) ? "section-item-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={state.sections.includes(s.id)}
                  onChange={() => toggleSection(s.id)}
                />
                <span className="section-label">
                  {s.emoji} {s.label}
                </span>
                <span className="section-hint">{s.hint}</span>
              </label>
            ))}
          </div>

          <button className="btn btn-primary btn-lg" disabled={!canSubmit} onClick={submit}>
            ✨ 워크시트 생성
          </button>
          <div className="setup-footer-row">
            <span className="muted small">학년·언어·섹션 구성</span>
            <button className="btn-link" onClick={saveSetupDefaults}>
              기본 설정으로 저장
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
