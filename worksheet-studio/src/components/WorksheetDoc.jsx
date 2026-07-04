import {
  THEMES,
  SECTIONS,
  FONTS,
  MARGIN_OPTIONS,
  ROW_HEIGHT_OPTIONS,
  COL_WIDTH_OPTIONS,
  DEFAULT_DESIGN,
  formatNumber,
} from "../constants.js";

const sectionMeta = (id) => SECTIONS.find((s) => s.id === id) || { label: id, emoji: "" };

export function resolveDesign(worksheet) {
  return {
    ...DEFAULT_DESIGN,
    themeId: worksheet.themeId || DEFAULT_DESIGN.themeId, // legacy field
    ...(worksheet.design || {}),
  };
}

function Blank({ lines = 2 }) {
  return (
    <div className="write-lines">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="write-line" />
      ))}
    </div>
  );
}

function Answer({ children, show, lines = 2, ...rest }) {
  if (!show) return <Blank lines={lines} />;
  return (
    <p className="answer-text" {...rest}>
      {children}
    </p>
  );
}

export default function WorksheetDoc({ worksheet, showAnswers, editable, onEdit, onReorder }) {
  const design = resolveDesign(worksheet);
  const theme = THEMES.find((t) => t.id === design.themeId) || THEMES[0];
  const colors = { primary: theme.primary, accent: theme.accent, header: theme.header, text: theme.text, ...(design.colors || {}) };
  const font = FONTS.find((f) => f.id === design.fontId) || FONTS[0];
  const margins = MARGIN_OPTIONS.find((m) => m.id === design.margins) || MARGIN_OPTIONS[1];
  const rowHeight = ROW_HEIGHT_OPTIONS.find((r) => r.id === design.rowHeight) || ROW_HEIGHT_OPTIONS[1];
  const colWidth = COL_WIDTH_OPTIONS.find((c) => c.id === design.colWidth) || COL_WIDTH_OPTIONS[1];

  const s = worksheet.sections || {};
  const order = (worksheet.sectionIds || Object.keys(s)).filter((id) => s[id]);

  const style = {
    "--wk-primary": colors.primary,
    "--wk-accent": colors.accent,
    "--wk-header": colors.header,
    "--wk-text": colors.text,
    "--wk-display": font.display,
    "--wk-body": font.body,
    "--wk-title-weight": design.titleWeight === "semibold" ? 600 : 800,
    "--wk-align": design.textAlign,
    "--wk-cell-pad": rowHeight.cellPad,
    "--wk-write-line": `${rowHeight.writeLine}px`,
    padding: margins.pad,
    fontFamily: font.body,
    lineHeight: rowHeight.lineHeight,
  };

  const E = editable
    ? (path) => ({
        contentEditable: true,
        suppressContentEditableWarning: true,
        className: "editable",
        onBlur: (e) => onEdit?.(path, e.currentTarget.textContent),
      })
    : () => ({});

  const num = (i) => formatNumber(design.numberStyle, i + 1);

  return (
    <article className="worksheet-doc" style={style}>
      <style>{`@page { margin: ${margins.page}; }`}</style>

      <header className="wk-header">
        <div>
          {worksheet.schoolName ? (
            <p className="wk-school" {...E(["schoolName"])}>
              {worksheet.schoolName}
            </p>
          ) : null}
          <h1 {...E(["title"])}>{worksheet.title}</h1>
          <p className="wk-meta">
            {worksheet.gradeLevel} · {worksheet.passageType === "literature" ? "Literature" : "Informational"} ·{" "}
            {worksheet.guidelineLanguage}
            {showAnswers && <strong className="answer-flag"> · ANSWER KEY</strong>}
          </p>
        </div>
        <div className="wk-namebox">
          <span>
            Name <span className="fill" />
          </span>
          <span>
            Date <span className="fill" />
          </span>
          <span>
            Score <span className="fill" />
          </span>
        </div>
      </header>

      {design.showPassage && worksheet.passage && (
        <section className="wk-section">
          <h2>
            {design.showEmojis && <span>📄</span>}
            <span>Original Reading Text</span>
          </h2>
          {worksheet.passage.split(/\n\n+/).map((p, i) => (
            <p key={i} className="wk-passage">
              {p}
            </p>
          ))}
        </section>
      )}

      {order.map((id, idx) => {
        const meta = sectionMeta(id);
        return (
          <section className="wk-section" key={id}>
            <h2>
              {design.showEmojis && meta.emoji && <span>{meta.emoji}</span>}
              <span>{meta.label}</span>
              {editable && onReorder && (
                <span className="wk-sec-tools no-print">
                  <button title="Move up" disabled={idx === 0} onClick={() => onReorder(id, -1)}>
                    ▲
                  </button>
                  <button title="Move down" disabled={idx === order.length - 1} onClick={() => onReorder(id, 1)}>
                    ▼
                  </button>
                </span>
              )}
            </h2>
            {renderSection(id, s[id], {
              show: showAnswers,
              design,
              colWidth,
              num,
              E: (...sub) => E(["sections", id, ...sub]),
            })}
          </section>
        );
      })}
    </article>
  );
}

function renderSection(id, data, ctx) {
  const { show, design, colWidth, num, E } = ctx;
  if (!data) return null;

  switch (id) {
    case "summary":
      return (
        <div className="wk-body">
          <p className="wk-callout">
            <strong>Essential Question:</strong> <span {...E("essentialQuestion")}>{data.essentialQuestion}</span>
          </p>
          <p {...E("overview")}>{data.overview}</p>
          <p>
            <strong>Keywords:</strong>{" "}
            {(data.keywords || []).map((k, i) => (
              <span key={i}>
                {i > 0 && " · "}
                <span {...E("keywords", i)}>{k}</span>
              </span>
            ))}
          </p>
          <div className="branch-grid">
            {(data.branches || []).map((b, i) => (
              <div className="branch" key={i}>
                <strong {...E("branches", i, "topic")}>{b.topic}</strong>
                <ul>
                  {(b.points || []).map((p, j) => (
                    <li key={j} {...E("branches", i, "points", j)}>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p>
            <strong>Real-life connection:</strong>{" "}
            <span {...E("realLifeConnection")}>{data.realLifeConnection}</span>
          </p>
        </div>
      );

    case "literal":
      return (
        <table className="wk-table">
          <colgroup>
            {design.showLineNumbers && <col style={{ width: "34px" }} />}
            <col style={{ width: colWidth.width }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              {design.showLineNumbers && <th>#</th>}
              <th>English Sentence</th>
              <th>{design.showNative ? "Translation" : "Notes"}</th>
            </tr>
          </thead>
          <tbody>
            {(data.sentences || []).map((x, i) => (
              <tr key={i}>
                {design.showLineNumbers && <td>{i + 1}</td>}
                <td {...E("sentences", i, "original")}>{x.original}</td>
                <td>
                  {design.showNative ? (
                    <Answer show={show} lines={2} {...E("sentences", i, "translation")}>
                      {x.translation}
                    </Answer>
                  ) : (
                    <Blank lines={2} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "vocab":
      return (
        <div>
          <table className="wk-table">
            <thead>
              <tr>
                <th>Word</th>
                {design.showNative && <th>Native Meaning</th>}
                <th>Definition</th>
                <th>Example From The Passage</th>
                <th>Practice</th>
              </tr>
            </thead>
            <tbody>
              {(data.words || []).map((w, i) => (
                <tr key={i}>
                  <td>
                    <strong {...E("words", i, "word")}>{w.word}</strong>
                    {w.partOfSpeech ? <em className="muted"> ({w.partOfSpeech})</em> : null}
                  </td>
                  {design.showNative && (
                    <td className="wk-native" {...E("words", i, "translation")}>
                      {w.translation}
                    </td>
                  )}
                  <td {...E("words", i, "definition")}>{w.definition}</td>
                  <td {...E("words", i, "exampleFromPassage")}>{w.exampleFromPassage}</td>
                  <td>
                    <span {...E("words", i, "fillBlankSentence")}>{w.fillBlankSentence}</span>
                    {show && <em className="answer-text"> → {w.word}</em>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(data.quiz || []).length > 0 && (
            <div>
              <p className="wk-sub">Vocabulary Quiz</p>
              <ul className="wk-items">
                {data.quiz.map((q, i) => (
                  <li className="wk-item" key={i}>
                    <span className="wk-item-num">{num(i)}</span>
                    <div>
                      <span className="stage-tag">{q.type}</span>
                      <p {...E("quiz", i, "question")}>{q.question}</p>
                      {(q.options || []).length > 0 && (
                        <div className="wk-quiz-options">
                          {q.options.map((o, j) => (
                            <span key={j}>
                              {String.fromCharCode(65 + j)}. <span {...E("quiz", i, "options", j)}>{o}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {show ? (
                        <p className="answer-text" {...E("quiz", i, "answer")}>
                          {q.answer}
                        </p>
                      ) : (
                        (q.options || []).length === 0 && <Blank lines={1} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );

    case "comp":
      return (
        <ul className="wk-items">
          {(data.questions || []).map((q, i) => (
            <li className="wk-item" key={i}>
              <span className="wk-item-num">{num(i)}</span>
              <div>
                <span className="stage-tag">{q.stage}</span>
                <p {...E("questions", i, "question")}>{q.question}</p>
                <Answer show={show} {...E("questions", i, "answer")}>
                  {q.answer}
                </Answer>
              </div>
            </li>
          ))}
        </ul>
      );

    case "thinking":
      return (
        <ul className="wk-items">
          {(data.prompts || []).map((p, i) => (
            <li className="wk-item" key={i}>
              <span className="wk-item-num">{num(i)}</span>
              <div>
                <span className="stage-tag">{p.paragraphRef}</span>
                <p {...E("prompts", i, "prompt")}>{p.prompt}</p>
                <Answer show={show} {...E("prompts", i, "sampleResponse")}>
                  {p.sampleResponse}
                </Answer>
              </div>
            </li>
          ))}
        </ul>
      );

    case "discussion":
      return (
        <ul className="wk-items">
          {(data.questions || []).map((q, i) => (
            <li className="wk-item" key={i}>
              <span className="wk-item-num">{num(i)}</span>
              <div>
                <span className="stage-tag">{q.type}</span>
                <p {...E("questions", i, "question")}>{q.question}</p>
                <p className="muted">
                  Follow-up: <span {...E("questions", i, "followUp")}>{q.followUp}</span>
                </p>
                {!show && <Blank lines={2} />}
              </div>
            </li>
          ))}
        </ul>
      );

    case "writing": {
      // legacy shape (old saved worksheets): { tasks: [...] }
      if (data.tasks) {
        return (
          <div>
            {data.tasks.map((t, i) => (
              <div key={i} className="writing-task">
                <span className="stage-tag">{t.type}</span>
                <p {...E("tasks", i, "prompt")}>{t.prompt}</p>
                <p className="muted">Starters: {(t.sentenceStarters || []).join(" / ")}</p>
                {!show && <Blank lines={4} />}
              </div>
            ))}
          </div>
        );
      }
      return (
        <div>
          <p>
            <span className="stage-tag">{data.essayType}</span>
          </p>
          <p>
            <strong>Writing Topic:</strong> <span {...E("topic")}>{data.topic}</span>
          </p>

          <p className="wk-sub">Step 1 — Brainstorming</p>
          <ul className="wk-items">
            {(data.brainstorm || []).map((b, i) => (
              <li className="wk-item" key={i}>
                <span className="wk-item-num">{num(i)}</span>
                <div>
                  <p {...E("brainstorm", i, "question")}>{b.question}</p>
                  <Answer show={show} {...E("brainstorm", i, "sampleIdea")}>
                    {b.sampleIdea}
                  </Answer>
                </div>
              </li>
            ))}
          </ul>

          <p className="wk-sub">Step 2 — Sentence Template</p>
          {(data.template || []).map((t, i) => (
            <div className="wk-frame" key={i}>
              <strong {...E("template", i, "label")}>{t.label}</strong>{" "}
              <span {...E("template", i, "frame")}>{t.frame}</span>
            </div>
          ))}

          <p className="wk-sub">Step 3 — First Draft</p>
          <Blank lines={8} />
          <ul className="wk-checklist">
            {(data.draftChecklist || []).map((c, i) => (
              <li key={i} {...E("draftChecklist", i)}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    case "grammar":
      return (
        <div>
          {(data.points || []).map((g, i) => (
            <div key={i} className="writing-task">
              <p>
                <strong {...E("points", i, "point")}>{g.point}</strong> —{" "}
                <span {...E("points", i, "explanation")}>{g.explanation}</span>
              </p>
              <ul>
                {(g.examplesFromPassage || []).map((e, j) => (
                  <li key={j}>
                    <em {...E("points", i, "examplesFromPassage", j)}>{e}</em>
                  </li>
                ))}
              </ul>
              <p {...E("points", i, "practice")}>{g.practice}</p>
              <Answer show={show} lines={1} {...E("points", i, "practiceAnswer")}>
                {g.practiceAnswer}
              </Answer>
            </div>
          ))}
        </div>
      );

    case "textstructure":
      return (
        <div className="wk-body">
          <p>
            <strong>Structure:</strong> <span {...E("structureType")}>{data.structureType}</span>
          </p>
          <p {...E("explanation")}>{data.explanation}</p>
          <table className="wk-table">
            <tbody>
              {(data.elements || []).map((e, i) => (
                <tr key={i}>
                  <td style={{ width: "28%" }}>
                    <strong {...E("elements", i, "label")}>{e.label}</strong>
                  </td>
                  <td {...E("elements", i, "content")}>{e.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "literary":
      return (
        <table className="wk-table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Quote</th>
              <th>Effect</th>
            </tr>
          </thead>
          <tbody>
            {(data.devices || []).map((d, i) => (
              <tr key={i}>
                <td>
                  <strong {...E("devices", i, "device")}>{d.device}</strong>
                </td>
                <td>
                  <em {...E("devices", i, "quote")}>{d.quote}</em>
                </td>
                <td>
                  {show ? (
                    <span className="answer-text" {...E("devices", i, "explanation")}>
                      {d.explanation}
                    </span>
                  ) : (
                    <Blank lines={1} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "character":
      return (
        <div>
          {(data.characters || []).map((c, i) => (
            <div key={i} className="writing-task">
              <p>
                <strong {...E("characters", i, "name")}>{c.name}</strong> — {(c.traits || []).join(", ")}
              </p>
              <Answer show={show} {...E("characters", i, "evidence")}>
                {c.evidence}
              </Answer>
            </div>
          ))}
        </div>
      );

    case "plot":
      return (
        <table className="wk-table">
          <tbody>
            {(data.elements || []).map((e, i) => (
              <tr key={i}>
                <td style={{ width: "28%" }}>
                  <strong {...E("elements", i, "stage")}>{e.stage}</strong>
                </td>
                <td>
                  {show ? (
                    <span className="answer-text" {...E("elements", i, "description")}>
                      {e.description}
                    </span>
                  ) : (
                    <Blank lines={1} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "theme":
      return (
        <div>
          {(data.themes || []).map((t, i) => (
            <div key={i} className="writing-task">
              <p>
                <strong {...E("themes", i, "theme")}>{t.theme}</strong>
                {t.symbols?.length ? <span> · Symbols: {t.symbols.join(", ")}</span> : null}
              </p>
              <Answer show={show} {...E("themes", i, "explanation")}>
                {t.explanation}
              </Answer>
            </div>
          ))}
        </div>
      );

    default:
      return <pre>{JSON.stringify(data, null, 2)}</pre>;
  }
}
