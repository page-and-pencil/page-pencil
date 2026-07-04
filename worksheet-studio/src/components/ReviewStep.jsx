import { useState } from "react";
import WorksheetDoc, { resolveDesign } from "./WorksheetDoc.jsx";
import { downloadExcel } from "../excel.js";
import {
  THEMES,
  FONTS,
  MARGIN_OPTIONS,
  ROW_HEIGHT_OPTIONS,
  COL_WIDTH_OPTIONS,
  NUMBER_STYLES,
  TITLE_WEIGHTS,
  saveDefaults,
} from "../constants.js";

function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} className={value === o.id ? "seg-on" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`toggle ${checked ? "toggle-on" : ""}`}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

export default function ReviewStep({ worksheet, setWorksheet, savedId, onSave, onNew, notify }) {
  const [showAnswers, setShowAnswers] = useState(false);
  const design = resolveDesign(worksheet);
  const theme = THEMES.find((t) => t.id === design.themeId) || THEMES[0];
  const colors = { primary: theme.primary, header: theme.header, text: theme.text, ...(design.colors || {}) };

  function setDesign(patch) {
    setWorksheet((w) => ({ ...w, design: { ...resolveDesign(w), ...patch } }));
  }

  function setColor(key, value) {
    setDesign({ colors: { ...(design.colors || {}), [key]: value } });
  }

  function handleEdit(path, value) {
    setWorksheet((w) => {
      const next = structuredClone(w);
      let obj = next;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path.at(-1)] = value;
      return next;
    });
  }

  function handleReorder(id, dir) {
    setWorksheet((w) => {
      const ids = [...(w.sectionIds || Object.keys(w.sections || {}))];
      const i = ids.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ids.length) return w;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return { ...w, sectionIds: ids };
    });
  }

  function download(withAnswers) {
    setShowAnswers(withAnswers);
    // give React a tick to re-render with the right answer state before printing
    setTimeout(() => window.print(), 120);
  }

  function exportExcel() {
    try {
      downloadExcel(worksheet);
      notify("Excel file downloaded.");
    } catch (err) {
      notify(err.message, "error");
    }
  }

  function saveDesignDefaults() {
    saveDefaults({ design });
    notify("Saved as your default design settings.");
  }

  return (
    <div className="review">
      <div className="review-toolbar no-print">
        <div className="review-toolbar-left">
          <p className="step-eyebrow">Step 3 of 3 — Review &amp; Download</p>
          <h2>{worksheet.title}</h2>
        </div>
        <div className="review-toolbar-actions">
          <label className="switch">
            <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
            <span>{showAnswers ? "Hide Answers" : "Show Answers"}</span>
          </label>
          <button className="btn btn-ghost" onClick={() => download(false)}>
            Download PDF
          </button>
          <button className="btn btn-ghost" onClick={() => download(true)}>
            Answer Key PDF
          </button>
          <button className="btn btn-ghost" onClick={exportExcel}>
            Excel
          </button>
          <button className="btn btn-primary" disabled={!!savedId} onClick={() => onSave(worksheet)}>
            {savedId ? "Saved ✓" : "Save Worksheet"}
          </button>
          <button className="btn btn-ghost" onClick={onNew}>
            New Worksheet
          </button>
        </div>
      </div>

      <p className="muted small no-print edit-hint">
        Everything is editable inline — click any text in the preview to change it. Use ▲▼ on section bars to
        reorder. “Download PDF” → choose “Save as PDF” in the print dialog.
      </p>

      <div className="studio">
        <div className="doc-frame">
          <WorksheetDoc
            worksheet={worksheet}
            showAnswers={showAnswers}
            editable
            onEdit={handleEdit}
            onReorder={handleReorder}
          />
        </div>

        <aside className="design-panel no-print">
          <div className="design-panel-head">
            <h3>Worksheet Design</h3>
            <button className="btn-link" onClick={saveDesignDefaults} title="Use these design settings for every new worksheet">
              Save as default
            </button>
          </div>

          <div className="design-body">
            <div className="design-group">
              <p className="design-group-title">Colors</p>
              <div className="theme-row">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    title={t.name}
                    className={`theme-dot ${design.themeId === t.id && !design.colors ? "theme-dot-active" : ""}`}
                    style={{ background: t.primary }}
                    onClick={() => setDesign({ themeId: t.id, colors: null })}
                  />
                ))}
              </div>
              <div className="color-pick-row">
                <span>Primary</span>
                <input type="color" value={colors.primary} onChange={(e) => setColor("primary", e.target.value)} />
              </div>
              <div className="color-pick-row">
                <span>Section Header BG</span>
                <input type="color" value={colors.header} onChange={(e) => setColor("header", e.target.value)} />
              </div>
              <div className="color-pick-row">
                <span>Text</span>
                <input type="color" value={colors.text} onChange={(e) => setColor("text", e.target.value)} />
              </div>
              {design.colors && (
                <button className="btn-link" onClick={() => setDesign({ colors: null })}>
                  Reset Colors
                </button>
              )}
            </div>

            <div className="design-group">
              <p className="design-group-title">Typography</p>
              <div className="design-row">
                <p className="design-row-label">Font</p>
                <select
                  className="design-select"
                  value={design.fontId}
                  onChange={(e) => setDesign({ fontId: e.target.value })}
                >
                  {FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="design-row">
                <p className="design-row-label">Title Weight</p>
                <Seg options={TITLE_WEIGHTS} value={design.titleWeight} onChange={(v) => setDesign({ titleWeight: v })} />
              </div>
            </div>

            <div className="design-group">
              <p className="design-group-title">Page Layout</p>
              <div className="design-row">
                <p className="design-row-label">Margins</p>
                <Seg options={MARGIN_OPTIONS} value={design.margins} onChange={(v) => setDesign({ margins: v })} />
              </div>
              <div className="design-row">
                <p className="design-row-label">Row Height</p>
                <Seg options={ROW_HEIGHT_OPTIONS} value={design.rowHeight} onChange={(v) => setDesign({ rowHeight: v })} />
              </div>
              <div className="design-row">
                <p className="design-row-label">Text Alignment</p>
                <Seg
                  options={[
                    { id: "left", label: "Left" },
                    { id: "justify", label: "Justify" },
                  ]}
                  value={design.textAlign}
                  onChange={(v) => setDesign({ textAlign: v })}
                />
              </div>
              <div className="design-row">
                <p className="design-row-label">Number Style</p>
                <Seg options={NUMBER_STYLES} value={design.numberStyle} onChange={(v) => setDesign({ numberStyle: v })} />
              </div>
              <div className="design-row">
                <p className="design-row-label">English Column Width</p>
                <Seg options={COL_WIDTH_OPTIONS} value={design.colWidth} onChange={(v) => setDesign({ colWidth: v })} />
              </div>
            </div>

            <div className="design-group">
              <p className="design-group-title">Options</p>
              <Toggle label="Original passage" checked={design.showPassage} onChange={(v) => setDesign({ showPassage: v })} />
              <Toggle
                label="Line numbers"
                checked={design.showLineNumbers}
                onChange={(v) => setDesign({ showLineNumbers: v })}
              />
              <Toggle
                label="Native language column"
                checked={design.showNative}
                onChange={(v) => setDesign({ showNative: v })}
              />
              <Toggle label="Section emojis" checked={design.showEmojis} onChange={(v) => setDesign({ showEmojis: v })} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
