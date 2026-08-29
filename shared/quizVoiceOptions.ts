/** Creator-facing quiz read-aloud profiles for native quizzes (not mock exams). */
export const QUIZ_TTS_VOICES = [
  { id: "nova", label: "Female" },
  { id: "onyx", label: "Male" },
] as const;

export type QuizTtsVoiceId = (typeof QUIZ_TTS_VOICES)[number]["id"];
export type QuizReadAloudVoice = "female" | "male";

export const DEFAULT_QUIZ_TTS_VOICE: QuizTtsVoiceId = "nova";
export const DEFAULT_QUIZ_READ_ALOUD_VOICE: QuizReadAloudVoice = "female";

export const QUIZ_TTS_VOICE_IDS = QUIZ_TTS_VOICES.map((v) => v.id) as [
  QuizTtsVoiceId,
  ...QuizTtsVoiceId[],
];

export function getQuizVoiceLabel(voiceId: QuizTtsVoiceId): string {
  return QUIZ_TTS_VOICES.find((voice) => voice.id === voiceId)?.label ?? voiceId;
}

export function quizReadAloudVoiceToTtsVoice(voice: QuizReadAloudVoice): QuizTtsVoiceId {
  return voice === "male" ? "onyx" : "nova";
}

/** Spoken label for a creator-configured quiz voice. */
export function getQuizVoiceSpokenName(voiceId: QuizTtsVoiceId): string {
  return getQuizVoiceLabel(voiceId);
}

export function buildQuizVoiceSampleScript(voiceId: QuizTtsVoiceId, quizTitle: string): string {
  const spokenName = getQuizVoiceSpokenName(voiceId);
  const title = quizTitle.trim();
  if (!title) {
    return `Hello, I am ${spokenName}. I will read the questions for this quiz.`;
  }
  return `Hello, I am ${spokenName}. I will read the questions for the ${title} quiz.`;
}
