export const PASSAGE_TYPES = [
  {
    id: "informational",
    label: "Informational",
    description: "Nonfiction, explanatory, article, and informational passages.",
  },
  {
    id: "literature",
    label: "Literature",
    description: "Stories, excerpts, poems, and literary passages.",
  },
];

export const SECTIONS = [
  { id: "summary", label: "Summary Infographic", emoji: "🧠", hint: "Mind map with topic branches & essential question" },
  { id: "literal", label: "Sentence Translation", emoji: "🌐", hint: "Line-by-line native translation" },
  { id: "vocab", label: "Vocabulary Worksheet", emoji: "📖", hint: "Word table + vocab quiz" },
  { id: "comp", label: "Comprehension Questions", emoji: "❓", hint: "Before / During / After reading Q&A" },
  { id: "thinking", label: "Thinking Worksheet", emoji: "💭", hint: "Critical thinking prompts per paragraph" },
  { id: "discussion", label: "Discussion Questions", emoji: "💬", hint: "Brainstorming & interpretation questions" },
  { id: "writing", label: "Writing Worksheet", emoji: "✍️", hint: "Brainstorm + sentence template + first draft" },
  { id: "grammar", label: "Grammar Spotlight", emoji: "🔍", hint: "Grammar points with passage examples" },
  { id: "textstructure", label: "Text Structure", emoji: "🧱", hint: "How the passage is organized" },
  { id: "literary", label: "Literary Devices", emoji: "🎭", hint: "Devices with passage quotes", literatureOnly: true },
  { id: "character", label: "Character Analysis", emoji: "👤", hint: "Traits with textual evidence", literatureOnly: true },
  { id: "plot", label: "Plot Elements", emoji: "📈", hint: "Exposition through resolution", literatureOnly: true },
  { id: "theme", label: "Theme & Symbolism", emoji: "🗝️", hint: "Major themes and symbols", literatureOnly: true },
];

export const LANGUAGES = [
  { id: "ko", name: "Korean", native: "한국어" },
  { id: "en", name: "English only", native: "English only" },
  { id: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { id: "hi", name: "Hindi", native: "हिन्दी" },
  { id: "ja", name: "Japanese", native: "日本語" },
  { id: "zh", name: "Chinese (Simplified)", native: "简体中文" },
  { id: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { id: "ar", name: "Arabic", native: "العربية" },
];

export const GRADES = Array.from({ length: 11 }, (_, i) => {
  const g = i + 2;
  return { id: `Grade ${g}`, label: `Grade ${g}`, age: `Age ${g + 5}–${g + 6}` };
});

// ── Worksheet design system ──────────────────────────────────────────────────

export const THEMES = [
  { id: "teal", name: "Teal", primary: "#0B8DAE", accent: "#0CA4C9", header: "#E3F5FA", text: "#14304A" },
  { id: "indigo", name: "Indigo", primary: "#4F46E5", accent: "#818CF8", header: "#EEF2FF", text: "#1E1B4B" },
  { id: "rose", name: "Rose", primary: "#E11D48", accent: "#FB7185", header: "#FFF1F2", text: "#4C0519" },
  { id: "amber", name: "Amber", primary: "#D97706", accent: "#FCD34D", header: "#FFFBEB", text: "#451A03" },
  { id: "slate", name: "Slate", primary: "#334155", accent: "#94A3B8", header: "#F1F5F9", text: "#0F172A" },
];

export const FONTS = [
  {
    id: "editorial",
    name: "Editorial Serif",
    display: "'DM Serif Display', 'Noto Serif KR', serif",
    body: "'DM Sans', 'Noto Sans KR', sans-serif",
  },
  {
    id: "classroom",
    name: "Classroom Serif",
    display: "'IBM Plex Serif', 'Noto Serif KR', serif",
    body: "'DM Sans', 'Noto Sans KR', sans-serif",
  },
  {
    id: "modern",
    name: "Modern Sans",
    display: "'DM Sans', 'Noto Sans KR', sans-serif",
    body: "'DM Sans', 'Noto Sans KR', sans-serif",
  },
  {
    id: "clean",
    name: "Clean Sans",
    display: "'Noto Sans KR', 'DM Sans', sans-serif",
    body: "'Noto Sans KR', 'DM Sans', sans-serif",
  },
  {
    id: "poster",
    name: "Poster Sans",
    display: "'Bebas Neue', 'DM Sans', sans-serif",
    body: "'DM Sans', 'Noto Sans KR', sans-serif",
  },
];

export const MARGIN_OPTIONS = [
  { id: "compact", label: "Compact", pad: "36px 42px", page: "12mm 12mm" },
  { id: "normal", label: "Normal", pad: "48px 56px", page: "18mm 16mm" },
  { id: "roomy", label: "Roomy", pad: "60px 68px", page: "24mm 20mm" },
];

export const ROW_HEIGHT_OPTIONS = [
  { id: "compact", label: "Compact", lineHeight: 1.5, writeLine: 22, cellPad: "6px 8px" },
  { id: "normal", label: "Normal", lineHeight: 1.65, writeLine: 27, cellPad: "8px 10px" },
  { id: "tall", label: "Tall", lineHeight: 1.85, writeLine: 33, cellPad: "11px 12px" },
];

export const COL_WIDTH_OPTIONS = [
  { id: "narrow", label: "45%", width: "45%" },
  { id: "balanced", label: "55%", width: "55%" },
  { id: "wide", label: "65%", width: "65%" },
];

export const NUMBER_STYLES = [
  { id: "dot", label: "1." },
  { id: "paren", label: "1)" },
  { id: "q", label: "Q1." },
];

export const TITLE_WEIGHTS = [
  { id: "semibold", label: "Semi Bold", weight: 600 },
  { id: "extrabold", label: "Extra Bold", weight: 800 },
];

export const DEFAULT_DESIGN = {
  themeId: "teal",
  colors: null, // { primary, header, text } — custom override of the theme
  fontId: "editorial",
  titleWeight: "extrabold",
  margins: "normal",
  rowHeight: "normal",
  colWidth: "balanced",
  textAlign: "justify",
  numberStyle: "dot",
  showLineNumbers: true,
  showNative: true,
  showEmojis: true,
  showPassage: true,
};

export function formatNumber(styleId, n) {
  if (styleId === "paren") return `${n})`;
  if (styleId === "q") return `Q${n}.`;
  return `${n}.`;
}

// localStorage keys for personal default settings
export const DEFAULTS_KEY = "worksheet-studio-defaults";

export function loadDefaults() {
  try {
    return JSON.parse(localStorage.getItem(DEFAULTS_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveDefaults(patch) {
  const current = loadDefaults();
  const next = { ...current, ...patch };
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify(next));
  return next;
}

export const SAMPLE_PASSAGE = `Climate change is one of the greatest challenges facing our planet today. Scientists agree that human activity is the main cause of rising temperatures. When we burn fossil fuels, carbon dioxide is released and traps heat in the atmosphere.

The effects of climate change can be seen all around the world. Glaciers are melting, sea levels are rising, and extreme weather events are becoming more common. Many animal species are losing their habitats and struggling to survive.

However, there is still hope. People everywhere are working to reduce their carbon footprint. Renewable energy sources like solar and wind power are becoming cheaper and more popular. Small actions, such as recycling and using public transportation, can also make a difference when millions of people do them together.`;
