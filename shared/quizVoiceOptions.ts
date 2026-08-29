/** Manus AI TTS voices available for native quiz read-aloud (not mock exams). */
export const QUIZ_TTS_VOICES = [
  { id: "alloy", label: "Alloy — neutral" },
  { id: "nova", label: "Nova — warm" },
  { id: "shimmer", label: "Shimmer — bright" },
  { id: "echo", label: "Echo — clear" },
  { id: "fable", label: "Fable — expressive" },
  { id: "onyx", label: "Onyx — deep" },
] as const;

export type QuizTtsVoiceId = (typeof QUIZ_TTS_VOICES)[number]["id"];

export const DEFAULT_QUIZ_TTS_VOICE: QuizTtsVoiceId = "nova";

export const QUIZ_TTS_VOICE_IDS = QUIZ_TTS_VOICES.map((v) => v.id) as [
  QuizTtsVoiceId,
  ...QuizTtsVoiceId[],
];

export function getQuizVoiceLabel(voiceId: QuizTtsVoiceId): string {
  return QUIZ_TTS_VOICES.find((voice) => voice.id === voiceId)?.label ?? voiceId;
}

/** Spoken first name for sample intros (e.g. "Nova — warm" → "Nova"). */
export function getQuizVoiceSpokenName(voiceId: QuizTtsVoiceId): string {
  const label = getQuizVoiceLabel(voiceId);
  const spoken = label.split(" — ")[0]?.trim();
  return spoken || voiceId;
}

export function buildQuizVoiceSampleScript(voiceId: QuizTtsVoiceId, quizTitle: string): string {
  const spokenName = getQuizVoiceSpokenName(voiceId);
  const title = quizTitle.trim();
  if (!title) {
    return `Hello, I am ${spokenName}. I will read the questions for this quiz.`;
  }
  return `Hello, I am ${spokenName}. I will read the questions for the ${title} quiz.`;
}
