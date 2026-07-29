import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type {
  QuizFile,
  QuizQuestion,
  QuizMeta,
  QuestionType,
  LicenseState,
  LicenseTier,
  QuestionData,
} from "../types/quiz";

function defaultData(type: QuestionType): QuestionData {
  switch (type) {
    case "mcq":
      return {
        choices: [
          { id: uuidv4(), text: "Option A", correct: true },
          { id: uuidv4(), text: "Option B", correct: false },
          { id: uuidv4(), text: "Option C", correct: false },
          { id: uuidv4(), text: "Option D", correct: false },
        ],
        multiSelect: false,
      };
    case "tf":
      return { correct: true };
    case "matching":
      return {
        pairs: [
          { id: uuidv4(), premise: "Term 1", response: "Definition 1" },
          { id: uuidv4(), premise: "Term 2", response: "Definition 2" },
          { id: uuidv4(), premise: "Term 3", response: "Definition 3" },
        ],
      };
    case "hotspot":
      return { imageUrl: "", imageAlt: "", regions: [], multiSelect: false };
    case "fill_blank":
      return {
        template: "The {{blank1}} is important for {{blank2}}.",
        blanks: [
          { id: "blank1", acceptedAnswers: ["answer"], caseSensitive: false },
          { id: "blank2", acceptedAnswers: ["learning"], caseSensitive: false },
        ],
      };
    case "short_answer":
      return { sampleAnswer: "", keywords: [], autoGrade: false, acceptedVariants: [] };
    case "image_choice":
      return {
        choices: [
          { id: uuidv4(), imageUrl: "", label: "Option A", correct: true },
          { id: uuidv4(), imageUrl: "", label: "Option B", correct: false },
        ],
        multiSelect: false,
      };
    case "ordering":
      return {
        items: [
          { id: uuidv4(), text: "First item" },
          { id: uuidv4(), text: "Second item" },
          { id: uuidv4(), text: "Third item" },
          { id: uuidv4(), text: "Fourth item" },
        ],
      };
    case "drag_drop":
      return {
        backgroundImageUrl: "",
        targets: [
          { id: uuidv4(), label: "Target 1", x: 10, y: 10, width: 20, height: 15 },
          { id: uuidv4(), label: "Target 2", x: 60, y: 10, width: 20, height: 15 },
        ],
        items: [],
      };
    case "drag_words":
      return {
        template: "The {{blank1}} jumped over the {{blank2}}.",
        blanks: [
          { id: "blank1", correctWord: "fox" },
          { id: "blank2", correctWord: "fence" },
        ],
        distractorWords: ["cat", "wall"],
      };
    case "dropdown":
      return {
        template: "The capital of France is {{blank1}} and it is in {{blank2}}.",
        blanks: [
          { id: "blank1", options: ["Paris", "London", "Berlin", "Madrid"], correctIndex: 0 },
          { id: "blank2", options: ["Europe", "Asia", "Africa", "America"], correctIndex: 0 },
        ],
      };
    case "numeric":
      return {
        correctValue: 0,
        tolerance: 0,
        allowRange: false,
      };
    case "likert":
      return {
        statements: [
          { id: uuidv4(), text: "I found this topic interesting" },
          { id: uuidv4(), text: "I feel confident about this subject" },
        ],
        scaleLabels: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"],
        scaleSize: 5,
      };
    case "essay":
      return {
        minWords: undefined,
        maxWords: undefined,
        placeholder: "Write your answer here...",
        rubric: "",
      };
  }
}

function newQuestion(type: QuestionType, order: number): QuizQuestion {
  return {
    id: uuidv4(),
    type,
    order,
    points: type === "likert" || type === "essay" ? 0 : 1,
    required: true,
    stem: "",
    image: null,
    explanation: "",
    data: defaultData(type),
  };
}

function defaultMeta(): QuizMeta {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title: "Untitled Quiz",
    description: "",
    author: "",
    authorEmail: "",
    createdAt: now,
    updatedAt: now,
    version: 1,
    licenseKey: null,
    teachificOrgId: null,
    tags: [],
    passingScore: 70,
    timeLimit: null,
    shuffleQuestions: false,
    shuffleAnswers: false,
    showFeedback: "immediate",
    allowRetry: true,
    maxAttempts: 3,
    allowBackNavigation: true,
    showProgressBar: true,
  };
}

interface QuizStore {
  // Quiz data
  quiz: QuizFile;
  activeQuestionId: string | null;
  isDirty: boolean;
  savedFilename: string | null;

  // License
  license: LicenseState;

  // Recent quizzes list (stored in localStorage)
  recentQuizzes: { id: string; title: string; updatedAt: string }[];

  // Actions
  newQuiz: () => void;
  loadQuiz: (quiz: QuizFile, filename?: string) => void;
  updateMeta: (meta: Partial<QuizMeta>) => void;
  addQuestion: (type: QuestionType) => void;
  duplicateQuestion: (id: string) => void;
  deleteQuestion: (id: string) => void;
  setActiveQuestion: (id: string | null) => void;
  updateQuestion: (id: string, updates: Partial<QuizQuestion>) => void;
  reorderQuestions: (fromIndex: number, toIndex: number) => void;
  markSaved: (filename: string) => void;

  // License actions
  setLicense: (license: Partial<LicenseState>) => void;
  clearLicense: () => void;
}

const defaultLicense: LicenseState = {
  tier: "free",
  licenseKey: null,
  teachificEmail: null,
  teachificOrgId: null,
  validatedAt: null,
};

export const useQuizStore = create<QuizStore>((set, get) => ({
  quiz: { meta: defaultMeta(), questions: [] },
  activeQuestionId: null,
  isDirty: false,
  savedFilename: null,
  license: (() => {
    try {
      const stored = localStorage.getItem("teachific_quiz_license");
      return stored ? (JSON.parse(stored) as LicenseState) : defaultLicense;
    } catch {
      return defaultLicense;
    }
  })(),
  recentQuizzes: (() => {
    try {
      const stored = localStorage.getItem("teachific_quiz_recent");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  })(),

  newQuiz: () =>
    set({
      quiz: { meta: defaultMeta(), questions: [] },
      activeQuestionId: null,
      isDirty: false,
      savedFilename: null,
    }),

  loadQuiz: (quiz, filename) =>
    set({
      quiz,
      activeQuestionId: quiz.questions[0]?.id ?? null,
      isDirty: false,
      savedFilename: filename ?? null,
    }),

  updateMeta: (meta) =>
    set((s) => ({
      quiz: {
        ...s.quiz,
        meta: { ...s.quiz.meta, ...meta, updatedAt: new Date().toISOString() },
      },
      isDirty: true,
    })),

  addQuestion: (type) => {
    const { quiz, license } = get();
    const FREE_LIMIT = 10;
    if (license.tier === "free" && quiz.questions.length >= FREE_LIMIT) {
      alert(`Free tier is limited to ${FREE_LIMIT} questions per quiz. Upgrade to Pro for unlimited questions.`);
      return;
    }
    const q = newQuestion(type, quiz.questions.length + 1);
    set((s) => ({
      quiz: { ...s.quiz, questions: [...s.quiz.questions, q] },
      activeQuestionId: q.id,
      isDirty: true,
    }));
  },

  duplicateQuestion: (id) => {
    const { quiz } = get();
    const src = quiz.questions.find((q) => q.id === id);
    if (!src) return;
    const dup: QuizQuestion = {
      ...JSON.parse(JSON.stringify(src)),
      id: uuidv4(),
      order: quiz.questions.length + 1,
    };
    set((s) => ({
      quiz: { ...s.quiz, questions: [...s.quiz.questions, dup] },
      activeQuestionId: dup.id,
      isDirty: true,
    }));
  },

  deleteQuestion: (id) =>
    set((s) => {
      const questions = s.quiz.questions
        .filter((q) => q.id !== id)
        .map((q, i) => ({ ...q, order: i + 1 }));
      const activeQuestionId =
        s.activeQuestionId === id
          ? (questions[0]?.id ?? null)
          : s.activeQuestionId;
      return { quiz: { ...s.quiz, questions }, activeQuestionId, isDirty: true };
    }),

  setActiveQuestion: (id) => set({ activeQuestionId: id }),

  updateQuestion: (id, updates) =>
    set((s) => ({
      quiz: {
        ...s.quiz,
        questions: s.quiz.questions.map((q) =>
          q.id === id ? { ...q, ...updates } : q
        ),
      },
      isDirty: true,
    })),

  reorderQuestions: (fromIndex, toIndex) =>
    set((s) => {
      const questions = [...s.quiz.questions];
      const [moved] = questions.splice(fromIndex, 1);
      questions.splice(toIndex, 0, moved);
      return {
        quiz: {
          ...s.quiz,
          questions: questions.map((q, i) => ({ ...q, order: i + 1 })),
        },
        isDirty: true,
      };
    }),

  markSaved: (filename) =>
    set((s) => {
      // Update recent list
      const recent = [
        { id: s.quiz.meta.id, title: s.quiz.meta.title, updatedAt: s.quiz.meta.updatedAt },
        ...s.recentQuizzes.filter((r) => r.id !== s.quiz.meta.id),
      ].slice(0, 10);
      localStorage.setItem("teachific_quiz_recent", JSON.stringify(recent));
      return { isDirty: false, savedFilename: filename, recentQuizzes: recent };
    }),

  setLicense: (license) =>
    set((s) => {
      const updated = { ...s.license, ...license };
      localStorage.setItem("teachific_quiz_license", JSON.stringify(updated));
      return { license: updated };
    }),

  clearLicense: () => {
    localStorage.removeItem("teachific_quiz_license");
    set({ license: defaultLicense });
  },
}));

// ─── Free tier limits ─────────────────────────────────────────────────────────
export const FREE_QUIZ_LIMIT = 5;
export const FREE_QUESTION_LIMIT = 10;

export function canCreateQuiz(tier: LicenseTier, existingCount: number) {
  if (tier !== "free") return true;
  return existingCount < FREE_QUIZ_LIMIT;
}
