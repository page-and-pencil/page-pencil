// Worksheet section catalog — mirrors the client-side catalog.
// Each section defines the JSON shape the AI must return for it.

export const SECTION_DEFS = {
  summary: {
    label: "Summary Infographic",
    schema: {
      type: "object",
      properties: {
        essentialQuestion: { type: "string" },
        overview: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
        branches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topic: { type: "string" },
              points: { type: "array", items: { type: "string" } },
            },
            required: ["topic", "points"],
            additionalProperties: false,
          },
        },
        realLifeConnection: { type: "string" },
      },
      required: ["essentialQuestion", "overview", "keywords", "branches", "realLifeConnection"],
      additionalProperties: false,
    },
    prompt:
      "A mind-map style summary infographic: an essential question, a 2-3 sentence overview, 4-6 keywords, 3-4 topic branches each with 2-3 short points, and a real-life connection sentence.",
  },
  literal: {
    label: "Sentence Translation",
    schema: {
      type: "object",
      properties: {
        sentences: {
          type: "array",
          items: {
            type: "object",
            properties: {
              original: { type: "string" },
              translation: { type: "string" },
            },
            required: ["original", "translation"],
            additionalProperties: false,
          },
        },
      },
      required: ["sentences"],
      additionalProperties: false,
    },
    prompt:
      "Line-by-line native-language translation: split the passage into individual sentences and translate each into the guideline language. If the guideline language is English, provide a simplified paraphrase instead.",
  },
  vocab: {
    label: "Vocabulary Worksheet",
    schema: {
      type: "object",
      properties: {
        words: {
          type: "array",
          items: {
            type: "object",
            properties: {
              word: { type: "string" },
              partOfSpeech: { type: "string" },
              translation: { type: "string" },
              definition: { type: "string" },
              exampleFromPassage: { type: "string" },
              fillBlankSentence: { type: "string" },
            },
            required: ["word", "partOfSpeech", "translation", "definition", "exampleFromPassage", "fillBlankSentence"],
            additionalProperties: false,
          },
        },
        quiz: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["Multiple Choice", "Fill in Blank", "Short Answer"] },
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              answer: { type: "string" },
            },
            required: ["type", "question", "options", "answer"],
            additionalProperties: false,
          },
        },
      },
      required: ["words", "quiz"],
      additionalProperties: false,
    },
    prompt:
      "6-10 key vocabulary words leveled to the grade. " +
      "CRITICAL — the `word` field MUST be the DICTIONARY BASE FORM (lemma / headword), never the inflected form as it appears in the passage: " +
      "3rd-person '-s' → base (makes→make, goes→go), gerund/participle → base (running→run, studying→study, hidden→hide), " +
      "past tense → base (ran→run, bought→buy), plural noun → singular (cities→city, leaves→leaf), comparative/superlative → base (bigger→big, happiest→happy). " +
      "Prefer single-word headwords; only keep multi-word entries for real phrasal verbs or idioms. Do not list the same lemma twice. " +
      "`partOfSpeech` is the part of speech of the base word. " +
      "`translation` (native language) and `definition` (English learner definition) both describe the BASE word. " +
      "`exampleFromPassage` is the sentence copied from the passage EXACTLY as written (it may contain the inflected form). " +
      "`fillBlankSentence` is a short practice sentence with the target word replaced by ____ (the answer is the base word). " +
      "Then a 3-4 item vocabulary quiz mixing Multiple Choice (4 options each) and Fill in Blank items (options = [] for non-multiple-choice), each with the answer.",
  },
  comp: {
    label: "Comprehension Questions",
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              stage: { type: "string", enum: ["Before Reading", "During Reading", "After Reading"] },
              question: { type: "string" },
              answer: { type: "string" },
            },
            required: ["stage", "question", "answer"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    },
    prompt:
      "6-9 comprehension questions spread across Before Reading, During Reading (including inference & reference questions), and After Reading stages, each with a model answer.",
  },
  thinking: {
    label: "Thinking Worksheet",
    schema: {
      type: "object",
      properties: {
        prompts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              paragraphRef: { type: "string" },
              prompt: { type: "string" },
              sampleResponse: { type: "string" },
            },
            required: ["paragraphRef", "prompt", "sampleResponse"],
            additionalProperties: false,
          },
        },
      },
      required: ["prompts"],
      additionalProperties: false,
    },
    prompt:
      "Critical-thinking prompts tied to each paragraph of the passage (one per paragraph, max 6), each with a short sample response.",
  },
  discussion: {
    label: "Discussion Questions",
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["Brainstorming", "Interpretation", "Real-life"] },
              question: { type: "string" },
              followUp: { type: "string" },
            },
            required: ["type", "question", "followUp"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    },
    prompt:
      "5-6 open discussion questions mixing brainstorming, interpretation, and real-life connection types, each with a follow-up question.",
  },
  writing: {
    label: "Writing Worksheet",
    schema: {
      type: "object",
      properties: {
        essayType: {
          type: "string",
          enum: ["Personal Opinion", "Personal Narrative", "Descriptive", "Compare and Contrast"],
        },
        topic: { type: "string" },
        brainstorm: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              sampleIdea: { type: "string" },
            },
            required: ["question", "sampleIdea"],
            additionalProperties: false,
          },
        },
        template: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              frame: { type: "string" },
            },
            required: ["label", "frame"],
            additionalProperties: false,
          },
        },
        draftChecklist: { type: "array", items: { type: "string" } },
      },
      required: ["essayType", "topic", "brainstorm", "template", "draftChecklist"],
      additionalProperties: false,
    },
    prompt:
      "A three-part writing worksheet tied to the passage topic: (1) pick the best essay type and a specific writing topic; " +
      "(2) 3-4 brainstorming questions each with a short sample idea; " +
      "(3) a sentence template — 3-4 labeled sentence frames with ____ blanks that scaffold the essay (e.g. My Opinion / My Reason / My Example / My Conclusion, adapted to the essay type); " +
      "(4) a 3-item self-check checklist for the first draft.",
  },
  grammar: {
    label: "Grammar Spotlight",
    schema: {
      type: "object",
      properties: {
        points: {
          type: "array",
          items: {
            type: "object",
            properties: {
              point: { type: "string" },
              explanation: { type: "string" },
              examplesFromPassage: { type: "array", items: { type: "string" } },
              practice: { type: "string" },
              practiceAnswer: { type: "string" },
            },
            required: ["point", "explanation", "examplesFromPassage", "practice", "practiceAnswer"],
            additionalProperties: false,
          },
        },
      },
      required: ["points"],
      additionalProperties: false,
    },
    prompt:
      "2-3 grammar points that actually appear in the passage: name, learner-friendly explanation in the guideline language, example sentences quoted from the passage, and one practice item with answer.",
  },
  textstructure: {
    label: "Text Structure",
    schema: {
      type: "object",
      properties: {
        structureType: { type: "string" },
        explanation: { type: "string" },
        elements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              content: { type: "string" },
            },
            required: ["label", "content"],
            additionalProperties: false,
          },
        },
      },
      required: ["structureType", "explanation", "elements"],
      additionalProperties: false,
    },
    prompt:
      "Identify the text structure (e.g. cause & effect, problem-solution, chronological, compare & contrast) with an explanation and a breakdown of the passage into labeled structural elements.",
  },
  literary: {
    label: "Literary Devices",
    literatureOnly: true,
    schema: {
      type: "object",
      properties: {
        devices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              device: { type: "string" },
              quote: { type: "string" },
              explanation: { type: "string" },
            },
            required: ["device", "quote", "explanation"],
            additionalProperties: false,
          },
        },
      },
      required: ["devices"],
      additionalProperties: false,
    },
    prompt:
      "3-5 literary devices found in the passage, each with the exact quote from the passage and an explanation of its effect.",
  },
  character: {
    label: "Character Analysis",
    literatureOnly: true,
    schema: {
      type: "object",
      properties: {
        characters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              traits: { type: "array", items: { type: "string" } },
              evidence: { type: "string" },
            },
            required: ["name", "traits", "evidence"],
            additionalProperties: false,
          },
        },
      },
      required: ["characters"],
      additionalProperties: false,
    },
    prompt:
      "Analysis of the main characters: traits and the textual evidence supporting each.",
  },
  plot: {
    label: "Plot Elements",
    literatureOnly: true,
    schema: {
      type: "object",
      properties: {
        elements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              stage: { type: "string" },
              description: { type: "string" },
            },
            required: ["stage", "description"],
            additionalProperties: false,
          },
        },
      },
      required: ["elements"],
      additionalProperties: false,
    },
    prompt:
      "Plot breakdown: exposition, rising action, climax, falling action, resolution (as applicable to the excerpt).",
  },
  theme: {
    label: "Theme & Symbolism",
    literatureOnly: true,
    schema: {
      type: "object",
      properties: {
        themes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              theme: { type: "string" },
              symbols: { type: "array", items: { type: "string" } },
              explanation: { type: "string" },
            },
            required: ["theme", "symbols", "explanation"],
            additionalProperties: false,
          },
        },
      },
      required: ["themes"],
      additionalProperties: false,
    },
    prompt: "Major themes and any symbols in the passage, with explanations.",
  },
};

// NOTE: parts are generated one-per-call (see generate.js) — a single schema
// combining every section exceeds the API's compiled-grammar size limit.
