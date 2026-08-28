import { randomUUID } from "crypto";

export const SITE_BRAND_THEMES = {
  aaus: {
    primaryColor: "#24abbc",
    backgroundColor: "#0d1f3c",
    textColor: "#ffffff",
    fontFamily: "Inter",
  },
  iheartecho: {
    primaryColor: "#e11d48",
    backgroundColor: "#1a0a0f",
    textColor: "#ffffff",
    fontFamily: "Inter",
  },
} as const;

export type BuilderBrand = keyof typeof SITE_BRAND_THEMES;

export interface QuizBranding {
  primaryColor: string;
  backgroundColor: string;
  textColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  backgroundImageUrl?: string;
  backgroundOverlay?: number;
}

export interface QuizFileMeta {
  id: string;
  title: string;
  description: string;
  author: string;
  authorEmail: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  licenseKey: string | null;
  teachificOrgId: number | null;
  tags: string[];
  passingScore: number;
  timeLimit: number | null;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showFeedback: "immediate" | "deferred" | "never";
  showPerQuestionResult?: boolean;
  showGroupNames?: boolean;
  allowRetry: boolean;
  maxAttempts: number;
  branding?: QuizBranding;
  introSlide?: Record<string, unknown>;
  resultSlide?: Record<string, unknown>;
  allowBackNavigation?: boolean;
  showProgressBar?: boolean;
  questionsPerPage?: number;
  branchingEnabled?: boolean;
  groups?: { id: string; name: string; color: string }[];
  drawConfig?: {
    enabled: boolean;
    totalQuestions: number;
    groupDraws: { groupId: string; drawCount: number }[];
    ungroupedDrawCount: number;
  };
  editorViewMode?: "form" | "slide";
  cloudId?: number;
}

export interface QuizFile {
  meta: QuizFileMeta;
  questions: unknown[];
}

export function defaultBrandingForBrand(brand: BuilderBrand): QuizBranding {
  return { ...SITE_BRAND_THEMES[brand] };
}

export function parseBuilderConfig(raw: string | null | undefined): QuizFile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QuizFile;
    if (!parsed?.meta || !Array.isArray(parsed.questions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function serializeBuilderConfig(config: QuizFile): string {
  return JSON.stringify(config);
}

/** Merge quiz DB row settings into builder meta on load */
export function builderConfigFromQuizRow(
  quiz: {
    id: number;
    title: string;
    description: string | null;
    passingScore: number;
    timeLimitMinutes: number | null;
    shuffleQuestions: boolean;
    shuffleAnswers: boolean;
    allowRetakes: boolean;
    maxAttempts: number | null;
    brand: BuilderBrand;
    builderConfig: string | null;
  },
  user?: { name?: string | null; email?: string | null }
): QuizFile {
  const existing = parseBuilderConfig(quiz.builderConfig);
  if (existing) {
    return {
      ...existing,
      meta: {
        ...existing.meta,
        cloudId: quiz.id,
        title: quiz.title,
        description: quiz.description ?? existing.meta.description,
        passingScore: quiz.passingScore,
        timeLimit: quiz.timeLimitMinutes,
        shuffleQuestions: quiz.shuffleQuestions,
        shuffleAnswers: quiz.shuffleAnswers,
        allowRetry: quiz.allowRetakes,
        maxAttempts: quiz.maxAttempts ?? existing.meta.maxAttempts,
        branding: existing.meta.branding ?? defaultBrandingForBrand(quiz.brand),
      },
    };
  }

  const now = new Date().toISOString();
  return {
    meta: {
      id: randomUUID(),
      title: quiz.title,
      description: quiz.description ?? "",
      author: user?.name ?? "",
      authorEmail: user?.email ?? "",
      createdAt: now,
      updatedAt: now,
      version: 1,
      licenseKey: null,
      teachificOrgId: null,
      tags: [],
      passingScore: quiz.passingScore,
      timeLimit: quiz.timeLimitMinutes,
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleAnswers: quiz.shuffleAnswers,
      showFeedback: "immediate",
      showPerQuestionResult: true,
      showGroupNames: false,
      allowRetry: quiz.allowRetakes,
      maxAttempts: quiz.maxAttempts ?? 3,
      branding: defaultBrandingForBrand(quiz.brand),
      introSlide: { enabled: true, title: quiz.title, description: quiz.description ?? "" },
      resultSlide: {
        enabled: true,
        passTitle: "Congratulations!",
        passMessage: "You passed!",
        failTitle: "Not Quite",
        failMessage: "Review the material and try again.",
        showScore: true,
        showPassFail: true,
        showReviewButton: true,
      },
      allowBackNavigation: true,
      showProgressBar: true,
      branchingEnabled: false,
      groups: [],
      editorViewMode: "form",
      cloudId: quiz.id,
    },
    questions: [],
  };
}

/** Fisher-Yates shuffle */
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Draw questions per group config (iSpring-style pools) */
export function drawQuestionsFromBuilder(config: QuizFile): unknown[] {
  const { questions, meta } = config;
  const drawConfig = meta.drawConfig;
  if (!drawConfig?.enabled) {
    return meta.shuffleQuestions ? shuffleArray(questions) : [...questions];
  }

  const grouped: Record<string, unknown[]> = {};
  const ungrouped: unknown[] = [];
  for (const q of questions) {
    const groupId = (q as { groupId?: string }).groupId;
    if (groupId) {
      if (!grouped[groupId]) grouped[groupId] = [];
      grouped[groupId].push(q);
    } else {
      ungrouped.push(q);
    }
  }

  const drawn: unknown[] = [];
  for (const gd of drawConfig.groupDraws) {
    const pool = grouped[gd.groupId] ?? [];
    drawn.push(...shuffleArray(pool).slice(0, gd.drawCount));
  }
  drawn.push(...shuffleArray(ungrouped).slice(0, drawConfig.ungroupedDrawCount ?? 0));
  return meta.shuffleQuestions ? shuffleArray(drawn) : drawn;
}
