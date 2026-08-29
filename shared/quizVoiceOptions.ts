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
