import * as XLSX from "xlsx";
import { SECTIONS } from "./constants.js";

const label = (id) => SECTIONS.find((s) => s.id === id)?.label || id;

// Build array-of-arrays rows per section type.
const builders = {
  summary: (d) => [
    ["Essential Question", d.essentialQuestion],
    ["Overview", d.overview],
    ["Keywords", (d.keywords || []).join(", ")],
    [],
    ["Branch Topic", "Points"],
    ...(d.branches || []).map((b) => [b.topic, (b.points || []).join(" | ")]),
    [],
    ["Real-life Connection", d.realLifeConnection],
  ],
  literal: (d) => [
    ["#", "English Sentence", "Translation"],
    ...(d.sentences || []).map((x, i) => [i + 1, x.original, x.translation]),
  ],
  vocab: (d) => [
    ["Word", "Part of Speech", "Native Meaning", "Definition", "Example From The Passage", "Practice", "Answer"],
    ...(d.words || []).map((w) => [
      w.word,
      w.partOfSpeech || "",
      w.translation,
      w.definition,
      w.exampleFromPassage,
      w.fillBlankSentence,
      w.word,
    ]),
    [],
    ["Quiz Type", "Question", "Options", "Answer"],
    ...(d.quiz || []).map((q) => [q.type, q.question, (q.options || []).join(" / "), q.answer]),
  ],
  comp: (d) => [
    ["Stage", "Question", "Answer"],
    ...(d.questions || []).map((q) => [q.stage, q.question, q.answer]),
  ],
  thinking: (d) => [
    ["Paragraph", "Prompt", "Sample Response"],
    ...(d.prompts || []).map((p) => [p.paragraphRef, p.prompt, p.sampleResponse]),
  ],
  discussion: (d) => [
    ["Type", "Question", "Follow-up"],
    ...(d.questions || []).map((q) => [q.type, q.question, q.followUp]),
  ],
  writing: (d) =>
    d.tasks
      ? [["Type", "Prompt", "Starters"], ...d.tasks.map((t) => [t.type, t.prompt, (t.sentenceStarters || []).join(" / ")])]
      : [
          ["Essay Type", d.essayType],
          ["Topic", d.topic],
          [],
          ["Brainstorming Question", "Sample Idea"],
          ...(d.brainstorm || []).map((b) => [b.question, b.sampleIdea]),
          [],
          ["Template Label", "Frame"],
          ...(d.template || []).map((t) => [t.label, t.frame]),
          [],
          ["Draft Checklist", (d.draftChecklist || []).join(" | ")],
        ],
  grammar: (d) => [
    ["Point", "Explanation", "Examples", "Practice", "Answer"],
    ...(d.points || []).map((g) => [
      g.point,
      g.explanation,
      (g.examplesFromPassage || []).join(" | "),
      g.practice,
      g.practiceAnswer,
    ]),
  ],
  textstructure: (d) => [
    ["Structure", d.structureType],
    ["Explanation", d.explanation],
    [],
    ["Label", "Content"],
    ...(d.elements || []).map((e) => [e.label, e.content]),
  ],
  literary: (d) => [
    ["Device", "Quote", "Effect"],
    ...(d.devices || []).map((x) => [x.device, x.quote, x.explanation]),
  ],
  character: (d) => [
    ["Name", "Traits", "Evidence"],
    ...(d.characters || []).map((c) => [c.name, (c.traits || []).join(", "), c.evidence]),
  ],
  plot: (d) => [
    ["Stage", "Description"],
    ...(d.elements || []).map((e) => [e.stage, e.description]),
  ],
  theme: (d) => [
    ["Theme", "Symbols", "Explanation"],
    ...(d.themes || []).map((t) => [t.theme, (t.symbols || []).join(", "), t.explanation]),
  ],
};

const sheetName = (name) => name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Sheet";

export function downloadExcel(worksheet) {
  const wb = XLSX.utils.book_new();

  const info = [
    ["Title", worksheet.title],
    ["Grade", worksheet.gradeLevel],
    ["Type", worksheet.passageType],
    ["Language", worksheet.guidelineLanguage],
    [],
    ["Passage"],
    ...(worksheet.passage || "").split(/\n\n+/).map((p) => [p]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), "Worksheet");

  const order = (worksheet.sectionIds || Object.keys(worksheet.sections || {})).filter(
    (id) => worksheet.sections?.[id]
  );
  for (const id of order) {
    const build = builders[id];
    if (!build) continue;
    const rows = build(worksheet.sections[id]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName(label(id)));
  }

  const filename = `${(worksheet.title || "worksheet").replace(/[\\/:*?"<>|]/g, "")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
