// AI worksheet generation via the Anthropic Claude API.
// Each worksheet part (title/meta + every section) is generated as its own
// small structured-output call — one big combined schema exceeds the API's
// compiled-grammar limit — and the calls run with limited parallelism.
// If ANTHROPIC_API_KEY is not configured, falls back to a demo generator
// so the app remains fully explorable without a key.
import Anthropic from "@anthropic-ai/sdk";
import { SECTION_DEFS } from "./sections.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const CONCURRENCY = 3;

export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

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

function apiErrorMessage(err) {
  return err?.error?.error?.message || err?.message || "Unknown API error.";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Run fn over items with at most `limit` concurrent executions.
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

// One structured-output call for a single worksheet part, with retries on
// transient API errors (rate limit / overloaded / connection).
async function generatePart(client, { label, instruction, schema, context }) {
  for (let attempt = 1; ; attempt++) {
    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 12000,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              // shared prefix is identical across all part calls → prompt cache
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
      const text = message.content.find((b) => b.type === "text")?.text;
      if (!text) throw new Error("Empty response from the AI model.");
      return JSON.parse(text);
    } catch (err) {
      const status = err?.status;
      const retriable =
        !err.fatal &&
        (status === 429 || status === 529 || (status >= 500 && status < 600) || err?.name === "APIConnectionError");
      if (attempt < 3 && retriable) {
        await sleep(1500 * attempt);
        continue;
      }
      throw new Error(`${label} failed — ${apiErrorMessage(err)}`);
    }
  }
}

export async function generateWorksheet(input, log) {
  const { sections, title } = input;

  if (!hasApiKey()) {
    log("ANTHROPIC_API_KEY not set — generating demo worksheet.");
    return demoWorksheet(input, log);
  }

  const client = new Anthropic();
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
    const data = await generatePart(client, { ...part, context });
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

// ── Image / PDF → passage extraction (via Claude vision & document support) ──

export async function extractPassageFromFiles(files) {
  if (!hasApiKey()) {
    throw new Error("File import requires ANTHROPIC_API_KEY in .env.");
  }
  const client = new Anthropic();
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
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: "user", content }],
    });
    const text = message.content.find((b) => b.type === "text")?.text?.trim();
    if (!text) throw new Error("Could not extract text from the file(s).");
    return text;
  } catch (err) {
    throw new Error(apiErrorMessage(err));
  }
}

// ── Demo fallback ────────────────────────────────────────────────────────────

function demoWorksheet(input, log) {
  const { passage, sections, gradeLevel, guidelineLanguage } = input;
  const sentences = passage
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  const words = [...new Set(passage.toLowerCase().match(/[a-z]{7,}/g) || [])].slice(0, 8);
  const demoNote = `[DEMO] Add ANTHROPIC_API_KEY to .env for real AI content (${guidelineLanguage}).`;

  const builders = {
    summary: () => ({
      essentialQuestion: "What is the main idea of this passage?",
      overview: sentences.slice(0, 2).join(" "),
      keywords: words.slice(0, 5),
      branches: [
        { topic: "Main Idea", points: [sentences[0] || "Key point 1", "Supporting detail"] },
        { topic: "Details", points: [sentences[1] || "Key point 2", "Evidence from text"] },
        { topic: "Conclusion", points: [sentences.at(-1) || "Closing point"] },
      ],
      realLifeConnection: demoNote,
    }),
    literal: () => ({
      sentences: sentences.slice(0, 8).map((s) => ({ original: s, translation: demoNote })),
    }),
    vocab: () => ({
      words: words.map((w) => ({
        word: w,
        partOfSpeech: "noun",
        translation: demoNote,
        definition: `Definition of "${w}" for grade ${gradeLevel}.`,
        exampleFromPassage: sentences.find((s) => s.toLowerCase().includes(w)) || sentences[0] || "",
        fillBlankSentence: (sentences.find((s) => s.toLowerCase().includes(w)) || `The ____ was important.`).replace(
          new RegExp(w, "i"),
          "____"
        ),
      })),
      quiz: [
        {
          type: "Multiple Choice",
          question: `Which word means "${words[0] || "example"}"?`,
          options: words.slice(0, 4).length === 4 ? words.slice(0, 4) : ["option A", "option B", "option C", "option D"],
          answer: words[0] || "option A",
        },
        {
          type: "Fill in Blank",
          question: "The scientists made an important ____ about the topic.",
          options: [],
          answer: words[1] || "discovery",
        },
      ],
    }),
    comp: () => ({
      questions: [
        { stage: "Before Reading", question: "What do you already know about this topic?", answer: "Answers vary." },
        { stage: "During Reading", question: "What is the main idea of paragraph 1?", answer: sentences[0] || "" },
        { stage: "After Reading", question: "Summarize the passage in one sentence.", answer: sentences.at(-1) || "" },
      ],
    }),
    thinking: () => ({
      prompts: [
        { paragraphRef: "Paragraph 1", prompt: "Why does the author begin this way?", sampleResponse: demoNote },
      ],
    }),
    discussion: () => ({
      questions: [
        { type: "Brainstorming", question: "What ideas come to mind about this topic?", followUp: "Why?" },
        { type: "Real-life", question: "How does this connect to your life?", followUp: "Give an example." },
      ],
    }),
    writing: () => ({
      essayType: "Personal Opinion",
      topic: "What do you think about this topic? Explain your opinion.",
      brainstorm: [
        { question: "What is the most interesting idea in the passage?", sampleIdea: demoNote },
        { question: "How does this topic connect to your life?", sampleIdea: demoNote },
        { question: "What would you tell a friend about it?", sampleIdea: demoNote },
      ],
      template: [
        { label: "My Opinion", frame: "I believe that ____ because ____." },
        { label: "My Reason", frame: "One reason is ____. For example, ____." },
        { label: "My Conclusion", frame: "In conclusion, I think ____." },
      ],
      draftChecklist: ["I stated my opinion clearly.", "I gave at least one reason.", "I checked my spelling."],
    }),
    grammar: () => ({
      points: [
        {
          point: "Present Simple",
          explanation: demoNote,
          examplesFromPassage: [sentences[0] || ""],
          practice: "Complete: The passage ____ (describe) an important topic.",
          practiceAnswer: "describes",
        },
      ],
    }),
    textstructure: () => ({
      structureType: "Descriptive",
      explanation: demoNote,
      elements: sentences.slice(0, 3).map((s, i) => ({ label: `Part ${i + 1}`, content: s })),
    }),
    literary: () => ({
      devices: [{ device: "Imagery", quote: sentences[0] || "", explanation: demoNote }],
    }),
    character: () => ({
      characters: [{ name: "Main character", traits: ["curious", "brave"], evidence: sentences[0] || "" }],
    }),
    plot: () => ({
      elements: [
        { stage: "Exposition", description: sentences[0] || "" },
        { stage: "Resolution", description: sentences.at(-1) || "" },
      ],
    }),
    theme: () => ({
      themes: [{ theme: "Growth", symbols: ["journey"], explanation: demoNote }],
    }),
  };

  const out = {};
  for (const id of sections) {
    log(`Building section: ${SECTION_DEFS[id]?.label || id}`);
    out[id] = (builders[id] || (() => ({})))();
  }
  return {
    title: input.title || "Reading Worksheet (Demo)",
    topic: words[0] ? words[0][0].toUpperCase() + words[0].slice(1) : "Reading",
    passageSummary: sentences.slice(0, 2).join(" "),
    sections: out,
  };
}
