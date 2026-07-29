// ─── .quiz File Format Types ──────────────────────────────────────────────────

export type QuestionType =
  | "mcq"
  | "tf"
  | "matching"
  | "hotspot"
  | "fill_blank"
  | "short_answer"
  | "image_choice"
  | "ordering"
  | "drag_drop"
  | "drag_words"
  | "dropdown"
  | "numeric"
  | "likert"
  | "essay";

export interface McqData {
  choices: { id: string; text: string; correct: boolean; imageUrl?: string }[];
  multiSelect: boolean;
}

export interface TfData {
  correct: boolean;
}

export interface MatchingPair {
  id: string;
  premise: string;
  premiseImageUrl?: string;
  response: string;
  responseImageUrl?: string;
}
export interface MatchingData {
  pairs: MatchingPair[];
  extraDistractors?: string[];
}

export type HotspotShape = "circle" | "rect" | "polygon";
export interface HotspotRegion {
  id: string;
  label: string;
  correct: boolean;
  shape: HotspotShape;
  // All values as % of image dimensions (0-100)
  x: number;
  y: number;
  radius?: number; // circle only
  width?: number;  // rect only
  height?: number; // rect only
  points?: { x: number; y: number }[]; // polygon only
}
export interface HotspotData {
  imageUrl: string; // data: URI or uploaded URL
  imageAlt: string;
  regions: HotspotRegion[];
  multiSelect: boolean;
}

export interface FillBlankBlank {
  id: string;
  acceptedAnswers: string[];
  caseSensitive: boolean;
}
export interface FillBlankData {
  template: string; // use {{blankId}} placeholders
  blanks: FillBlankBlank[];
}

export interface ShortAnswerData {
  sampleAnswer: string;
  keywords: string[];
  autoGrade: boolean;
  acceptedVariants?: string[]; // for typos/abbreviations
}

export interface ImageChoiceOption {
  id: string;
  imageUrl: string; // data: URI or uploaded URL
  label: string;
  correct: boolean;
}
export interface ImageChoiceData {
  choices: ImageChoiceOption[];
  multiSelect: boolean;
}

// ─── New iSpring-equivalent types ────────────────────────────────────────────

export interface OrderingItem {
  id: string;
  text: string;
  imageUrl?: string;
}
export interface OrderingData {
  items: OrderingItem[]; // items in CORRECT order; player shuffles them
}

export interface DragDropTarget {
  id: string;
  label: string;
  x: number; // % of image
  y: number;
  width: number;
  height: number;
}
export interface DragDropItem {
  id: string;
  text: string;
  imageUrl?: string;
  targetId: string; // which target it belongs to
}
export interface DragDropData {
  backgroundImageUrl: string;
  targets: DragDropTarget[];
  items: DragDropItem[];
}

export interface DragWordsBlank {
  id: string;
  correctWord: string;
}
export interface DragWordsData {
  template: string; // use {{blankId}} placeholders
  blanks: DragWordsBlank[];
  distractorWords?: string[]; // extra words not needed
}

export interface DropdownBlank {
  id: string;
  options: string[];
  correctIndex: number;
}
export interface DropdownData {
  template: string; // use {{blankId}} placeholders
  blanks: DropdownBlank[];
}

export interface NumericData {
  correctValue: number;
  tolerance: number; // e.g., 0.5 means ±0.5
  allowRange: boolean;
  rangeMin?: number;
  rangeMax?: number;
  unit?: string;
}

export interface LikertStatement {
  id: string;
  text: string;
}
export interface LikertData {
  statements: LikertStatement[];
  scaleLabels: string[]; // e.g., ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]
  scaleSize: number; // typically 5 or 7
}

export interface EssayData {
  minWords?: number;
  maxWords?: number;
  placeholder?: string;
  rubric?: string; // grading criteria for manual review
}

export type QuestionData =
  | McqData
  | TfData
  | MatchingData
  | HotspotData
  | FillBlankData
  | ShortAnswerData
  | ImageChoiceData
  | OrderingData
  | DragDropData
  | DragWordsData
  | DropdownData
  | NumericData
  | LikertData
  | EssayData;

// ─── Branching / Conditional Logic ──────────────────────────────────────────

export type BranchCondition =
  | { type: "correct" }                          // answer is correct
  | { type: "incorrect" }                        // answer is incorrect
  | { type: "choice"; choiceId: string }         // specific choice selected (MCQ)
  | { type: "score_above"; threshold: number }   // cumulative score above threshold
  | { type: "score_below"; threshold: number }   // cumulative score below threshold
  | { type: "always" };                          // unconditional jump

export type BranchTarget =
  | { type: "question"; questionId: string }     // jump to specific question
  | { type: "end" }                              // end quiz immediately
  | { type: "result" }                           // go to result slide
  | { type: "next" };                            // continue to next (default)

export interface BranchRule {
  id: string;
  condition: BranchCondition;
  target: BranchTarget;
  priority: number; // lower = evaluated first
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  order: number;
  points: number;
  required: boolean;
  stem: string;
  stemHtml?: string; // rich text HTML for the question stem
  image?: { url: string; alt: string } | null;
  audio?: { url: string; label?: string } | null;
  video?: { url: string; type?: string } | null;
  explanation: string;
  explanationHtml?: string;
  feedback?: {
    correct?: string;
    incorrect?: string;
    partial?: string;
  };
  // Per-question appearance
  backgroundImageUrl?: string;
  backgroundColor?: string;
  // Branching / conditional logic
  branchRules?: BranchRule[];
  // Group assignment
  groupId?: string;
  // Randomization override
  lockAnswerOrder?: boolean; // if true, answers stay in set order even when quiz-level shuffle is on
  data: QuestionData;
}

// ─── Quiz Branding / Theme ───────────────────────────────────────────────────

export interface QuizBranding {
  primaryColor: string;
  backgroundColor: string;
  textColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  backgroundImageUrl?: string;
  backgroundOverlay?: number; // 0-1 opacity
}

// ─── Intro / Result Slides ───────────────────────────────────────────────────

export interface QuizIntroSlide {
  enabled: boolean;
  title?: string;
  description?: string;
  imageUrl?: string;
  buttonText?: string;
}

export interface QuizResultSlide {
  enabled: boolean;
  passTitle?: string;
  passMessage?: string;
  passImageUrl?: string;
  failTitle?: string;
  failMessage?: string;
  failImageUrl?: string;
  showScore?: boolean;
  showPassFail?: boolean;
  showReviewButton?: boolean;
}

// ─── Question Groups / Pools ─────────────────────────────────────────────────

export interface QuestionGroup {
  id: string;
  name: string;
  color: string; // hex color for visual identification
}

export interface GroupDrawConfig {
  groupId: string;
  drawCount: number; // how many questions to draw from this group per attempt
}

export interface DrawConfig {
  enabled: boolean; // when true, use pool/draw mode instead of showing all questions
  totalQuestions: number; // total questions to show per attempt (sum of group draws + ungrouped)
  groupDraws: GroupDrawConfig[]; // per-group draw counts
  ungroupedDrawCount: number; // how many ungrouped questions to include
}

export interface QuizMeta {
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
  timeLimit: number | null; // minutes
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showFeedback: "immediate" | "deferred" | "never";
  allowRetry: boolean;
  maxAttempts: number;
  // Enhanced features
  branding?: QuizBranding;
  introSlide?: QuizIntroSlide;
  resultSlide?: QuizResultSlide;
  // Navigation
  allowBackNavigation?: boolean;
  showProgressBar?: boolean;
  questionsPerPage?: number; // null = one at a time
  // Branching
  branchingEnabled?: boolean; // when true, quiz uses branching logic instead of linear flow
  // Question Groups / Pools
  groups?: QuestionGroup[];
  drawConfig?: DrawConfig;
}

export interface QuizFile {
  meta: QuizMeta;
  questions: QuizQuestion[];
}

// ─── License ──────────────────────────────────────────────────────────────────
export type LicenseTier = "free" | "pro" | "enterprise";

export interface LicenseState {
  tier: LicenseTier;
  licenseKey: string | null;
  teachificEmail: string | null;
  teachificOrgId: number | null;
  validatedAt: string | null;
}
