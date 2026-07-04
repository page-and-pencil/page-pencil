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
          <p className="step-eyebrow">STEP 3 — 검토 &amp; 다운로드</p>
          <h2>{worksheet.title}</h2>
        </div>
        <div className="review-toolbar-actions">
          <label className="switch">
            <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
            <span>{showAnswers ? "답안 숨기기" : "답안 보기"}</span>
          </label>
          <button className="btn btn-ghost" onClick={() => download(false)}>
            문제지 PDF
          </button>
          <button className="btn btn-ghost" onClick={() => download(true)}>
            답안지 PDF
          </button>
          <button className="btn btn-ghost" onClick={exportExcel}>
            Excel
          </button>
          <button className="btn btn-primary" disabled={!!savedId} onClick={() => onSave(worksheet)}>
            {savedId ? "저장됨 ✓" : "저장"}
          </button>
          <button className="btn btn-ghost" onClick={onNew}>
            새로 만들기
          </button>
        </div>
      </div>

      <p className="muted small no-print edit-hint">
        미리보기의 모든 텍스트는 클릭해서 바로 수정할 수 있어요. 섹션 순서는 ▲▼로 변경 · PDF는 인쇄 대화상자에서 "PDF로 저장"을 선택하세요.
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
            <h3>워크시트 디자인</h3>
            <button className="btn-link" onClick={saveDesignDefaults} title="Use these design settings for every new worksheet">
              기본값 저장
            </button>
          </div>

          <div className="design-body">
            <div className="design-group">
              <p className="design-group-title">색상</p>
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
                <span>포인트 색</span>
                <input type="color" value={colors.primary} onChange={(e) => setColor("primary", e.target.value)} />
              </div>
              <div className="color-pick-row">
                <span>섹션 헤더 배경</span>
                <input type="color" value={colors.header} onChange={(e) => setColor("header", e.target.value)} />
              </div>
              <div className="color-pick-row">
                <span>본문 글자색</span>
                <input type="color" value={colors.text} onChange={(e) => setColor("text", e.target.value)} />
              </div>
              {design.colors && (
                <button className="btn-link" onClick={() => setDesign({ colors: null })}>
                  색상 초기화
                </button>
              )}
            </div>

            <div className="design-group">
              <p className="design-group-title">글꼴</p>
              <div className="design-row">
                <p className="design-row-label">서체</p>
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
                <p className="design-row-label">제목 굵기</p>
                <Seg options={TITLE_WEIGHTS} value={design.titleWeight} onChange={(v) => setDesign({ titleWeight: v })} />
              </div>
            </div>

            <div className="design-group">
              <p className="design-group-title">페이지 레이아웃</p>
              <div className="design-row">
                <p className="design-row-label">여백</p>
                <Seg options={MARGIN_OPTIONS} value={design.margins} onChange={(v) => setDesign({ margins: v })} />
              </div>
              <div className="design-row">
                <p className="design-row-label">행 높이</p>
                <Seg options={ROW_HEIGHT_OPTIONS} value={design.rowHeight} onChange={(v) => setDesign({ rowHeight: v })} />
              </div>
              <div className="design-row">
                <p className="design-row-label">본문 정렬</p>
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
                <p className="design-row-label">번호 스타일</p>
                <Seg options={NUMBER_STYLES} value={design.numberStyle} onChange={(v) => setDesign({ numberStyle: v })} />
              </div>
              <div className="design-row">
                <p className="design-row-label">영어 칸 너비</p>
                <Seg options={COL_WIDTH_OPTIONS} value={design.colWidth} onChange={(v) => setDesign({ colWidth: v })} />
              </div>
            </div>

            <div className="design-group">
              <p className="design-group-title">표시 옵션</p>
              <Toggle label="원문 지문" checked={design.showPassage} onChange={(v) => setDesign({ showPassage: v })} />
              <Toggle
                label="줄 번호"
                checked={design.showLineNumbers}
                onChange={(v) => setDesign({ showLineNumbers: v })}
              />
              <Toggle
                label="모국어 칸"
                checked={design.showNative}
                onChange={(v) => setDesign({ showNative: v })}
              />
              <Toggle label="섹션 이모지" checked={design.showEmojis} onChange={(v) => setDesign({ showEmojis: v })} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
